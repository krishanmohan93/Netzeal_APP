"""
Search, connect, and chat v2 endpoints using UUID public identifiers
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import and_, or_, desc, select
from uuid import UUID, uuid4
from typing import List

from ..core.database import get_db, get_async_db
from ..models.user import User
from ..models.connection import Connection, ConversationV2, MessageV2
from ..models.content import Post, ContentType
from sqlalchemy.sql import func
from ..schemas.connect import (
    SearchUserResponse,
    ConnectToggleRequest,
    ConnectionResponse,
    ChatCreateRequest,
    ChatSendRequest,
    ChatConversationResponse,
    ChatMessageResponse,
    ChatMessagesResponse,
)
from ..routers.auth import get_current_user
from ..services.notification_service import create_notification_async
from ..schemas.content import PostResponse

router = APIRouter(tags=["Network"])


async def _ensure_public_id(user: User, db) -> UUID:
    """Guarantee a public_id exists; auto-create if missing to avoid 500s."""

    if user.public_id:
        return user.public_id

    new_id = uuid4()
    user.public_id = new_id

    try:
        # Support both async and sync sessions
        if isinstance(db, AsyncSession):
            db.add(user)
            await db.commit()
            await db.refresh(user)
        else:
            db.add(user)
            db.commit()
            db.refresh(user)

        print(f"🔧 Assigned public_id for user {user.id} ({user.username}) -> {new_id}")
        return new_id
    except Exception:
        # If persistence fails, fall back to old behavior to surface the problem
        print(f"❌ Failed to assign public_id for user {user.id} ({user.username})")
        raise HTTPException(status_code=500, detail="User missing public_id; please contact support")


def _ordered_pair(a: UUID, b: UUID) -> tuple[UUID, UUID]:
    # Canonical ordering to guarantee unique pair rows
    return (a, b) if str(a) < str(b) else (b, a)


@router.get("/search/users", response_model=List[SearchUserResponse])
def search_users(
    query: str = Query(..., min_length=1, max_length=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Search users by username, email, or full name"""
    print(f"🔍 Search request from user: {current_user.username}")
    print(f"   Query: {query}")
    
    if not current_user.public_id:
        raise HTTPException(status_code=500, detail="User missing public_id; please contact support")
    
    # Search by username, email, or full name
    users = (
        db.query(User)
        .filter(
            or_(
                User.username.ilike(f"%{query}%"),
                User.email.ilike(f"%{query}%"),
                User.full_name.ilike(f"%{query}%")
            )
        )
        .order_by(User.username.asc())
        .limit(25)
        .all()
    )
    
    print(f"   Found {len(users)} users")
    for user in users:
        print(f"   - {user.username} ({user.email})")
    
    results = [
        SearchUserResponse(
            public_id=u.public_id,
            username=u.username,
            full_name=u.full_name,
            profile_photo=u.profile_photo,
        )
        for u in users
        if u.public_id is not None
    ]
    
    print(f"   Returning {len(results)} results")
    return results


@router.get("/profile/{public_id}")
async def get_user_profile(
    public_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """Get full user profile with stats"""
    me_public_id = await _ensure_public_id(current_user, db)
    
    # Get user
    result = await db.execute(select(User).where(User.public_id == public_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Get stats
    try:
        # 1. Posts count (using integer ID)
        posts_res = await db.execute(select(func.count(Post.id)).where(Post.author_id == user.id))
        posts_count = posts_res.scalar() or 0
        
        # 2. Followers count (using UUID public_id)
        followers_res = await db.execute(
            select(func.count(Connection.id)).where(
                and_(Connection.following_id == public_id, Connection.status == "connected")
            )
        )
        followers_count = followers_res.scalar() or 0
        
        # 3. Following count (using UUID public_id)
        following_res = await db.execute(
            select(func.count(Connection.id)).where(
                and_(Connection.follower_id == public_id, Connection.status == "connected")
            )
        )
        following_count = following_res.scalar() or 0
        
        # 4. Is Following?
        is_following_res = await db.execute(
            select(Connection).where(
                and_(
                    Connection.follower_id == me_public_id, 
                    Connection.following_id == public_id,
                    Connection.status == "connected"
                )
            )
        )
        is_following = is_following_res.scalar_one_or_none() is not None
        
        return {
            "id": user.public_id,
            "username": user.username,
            "full_name": user.full_name,
            "bio": user.bio,
            "profile_picture": user.profile_photo,
            "followers_count": followers_count,
            "following_count": following_count,
            "posts_count": posts_count,
            "is_following": is_following,
            "is_verified": user.is_verified,
            "website": None, # Add to model if needed
            "category": None # Add to model if needed
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"ERROR in get_user_profile for {public_id}: {e}")
        # Soft failure: return user info with 0 stats
        return {
            "id": user.public_id,
            "username": user.username,
            "full_name": user.full_name,
            "bio": user.bio,
            "profile_picture": user.profile_photo,
            "followers_count": 0,
            "following_count": 0,
            "posts_count": 0,
            "is_following": False,
            "is_verified": user.is_verified,
            "website": None,
            "category": None
        }


@router.get("/profile/username/{username}")
async def get_profile_by_username(
    username: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Get full user profile including detailed content lists.
    Response must always return: { user, posts, projects, shorts, followers, following }
    """
    try:
        me_public_id = await _ensure_public_id(current_user, db)
        
        # 1. Fetch User
        result = await db.execute(select(User).where(User.username.ilike(username)))
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
            
        if not user.public_id:
            print(f"Warning: User {user.username} has no public_id")
            
        # 2. Counts
        posts_count_q = await db.execute(select(func.count(Post.id)).where(Post.author_id == user.id))
        posts_count = posts_count_q.scalar() or 0
        
        followers_count = 0
        following_count = 0
        is_following = False
        
        if user.public_id:
            followers_res = await db.execute(
                select(func.count(Connection.id)).where(
                    and_(Connection.following_id == user.public_id, Connection.status == "connected")
                )
            )
            followers_count = followers_res.scalar() or 0
            
            following_res = await db.execute(
                select(func.count(Connection.id)).where(
                    and_(Connection.follower_id == user.public_id, Connection.status == "connected")
                )
            )
            following_count = following_res.scalar() or 0
            
            is_following_res = await db.execute(
                select(Connection).where(
                    and_(
                        Connection.follower_id == me_public_id, 
                        Connection.following_id == user.public_id,
                        Connection.status == "connected"
                    )
                )
            )
            is_following = is_following_res.scalar_one_or_none() is not None

        # 3. User Object
        user_data = {
            "id": user.public_id, # Return UUID as ID for frontend consistency
            "internal_id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "bio": user.bio,
            "profile_picture": user.profile_photo,
            "followers_count": followers_count,
            "following_count": following_count,
            "posts_count": posts_count,
            "is_following": is_following,
            "is_verified": user.is_verified,
            "website": None,
            "category": None
        }

        # 4. Fetch Content
        posts_query = await db.execute(
            select(Post)
            .where(Post.author_id == user.id, Post.is_published == True)
            .order_by(desc(Post.created_at))
            .limit(100) # Limit reasonable amount
        )
        all_posts = posts_query.scalars().all()
        
        posts_list = []
        shortcuts_list = [] # Reels
        projects_list = []
        
        for p in all_posts:
            # Map Post to dict
            p_dict = {
                "id": p.id,
                "title": p.title,
                "content": p.content,
                "media_urls": p.media_urls,
                "thumbnail_url": p.thumbnail_url,
                "type": p.content_type.value if p.content_type else "post",
                "likes_count": p.likes_count,
                "comments_count": p.comments_count,
                "created_at": p.created_at.isoformat() if p.created_at else None
            }
            
            if p.content_type == ContentType.PROJECT:
                projects_list.append(p_dict)
            elif p.content_type == ContentType.REEL or p.content_type == ContentType.VIDEO:
                shortcuts_list.append(p_dict)
            else:
                posts_list.append(p_dict)

        return {
            "user": user_data,
            "posts": posts_list,
            "shorts": shortcuts_list,
            "projects": projects_list,
            "followers": followers_count,
            "following": following_count
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"ERROR fetching profile for {username}: {e}")
        # Return fallback empty structure instead of crashing
        return {
            "user": {"username": username, "error": "Failed to load"},
            "posts": [],
            "shorts": [],
            "projects": [],
            "followers": 0,
            "following": 0
        }


async def _get_or_create_conversation(db: AsyncSession, user_a: UUID, user_b: UUID) -> ConversationV2:
    a, b = _ordered_pair(user_a, user_b)
    existing = await db.execute(
        select(ConversationV2).where(
            and_(ConversationV2.user_a_id == a, ConversationV2.user_b_id == b)
        )
    )
    conv = existing.scalar_one_or_none()
    if conv:
        return conv
    conv = ConversationV2(user_a_id=a, user_b_id=b)
    db.add(conv)
    await db.flush()
    return conv


@router.post("/connect", response_model=ConnectionResponse)
async def connect_toggle(
    payload: ConnectToggleRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    me_public_id = await _ensure_public_id(current_user, db)
    target_public_id = payload.target_public_id
    if target_public_id == me_public_id:
        raise HTTPException(status_code=400, detail="Cannot connect to yourself")

    target = await db.execute(select(User).where(User.public_id == target_public_id))
    target_user = target.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="Target user not found")

    async with db.begin():
        existing_conn = await db.execute(
            select(Connection).where(
                and_(Connection.follower_id == me_public_id, Connection.following_id == target_public_id)
            )
        )
        conn_obj = existing_conn.scalar_one_or_none()
        conversation_id = None
        trigger_notification = False

        if conn_obj:
            # Unfollow: remove connection and conversation
            await db.delete(conn_obj)
            a, b = _ordered_pair(me_public_id, target_public_id)
            conv_result = await db.execute(
                select(ConversationV2).where(
                    and_(ConversationV2.user_a_id == a, ConversationV2.user_b_id == b)
                )
            )
            conv_obj = conv_result.scalar_one_or_none()
            if conv_obj:
                await db.delete(conv_obj)
        else:
            # Follow: create connection and conversation
            new_conn = Connection(
                follower_id=me_public_id,
                following_id=target_public_id,
                status="connected",
            )
            db.add(new_conn)
            conv = await _get_or_create_conversation(db, me_public_id, target_public_id)
            conversation_id = conv.id
            await db.flush()
            conn_obj = new_conn
            trigger_notification = True

    await db.commit()

    if trigger_notification:
         # target_user.id is integer ID needed for notification
         await create_notification_async(
             db, 
             target_user.id, 
             current_user.id, 
             "follow", 
             f"{current_user.username} followed you", 
             current_user.id
         )

    return ConnectionResponse(
        follower_id=me_public_id,
        following_id=target_public_id,
        status=conn_obj.status if conn_obj else "connected",
        conversation_id=conversation_id,
        created_at=conn_obj.created_at if conn_obj else None,
    )


@router.post("/chat/create", response_model=ChatConversationResponse)
async def create_chat(
    payload: ChatCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    me_public_id = await _ensure_public_id(current_user, db)
    target_public_id = payload.target_public_id
    if target_public_id == me_public_id:
        raise HTTPException(status_code=400, detail="Cannot create chat with yourself")

    target = await db.execute(select(User).where(User.public_id == target_public_id))
    target_user = target.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="Target user not found")

    async with db.begin():
        conv = await _get_or_create_conversation(db, me_public_id, target_public_id)

    return ChatConversationResponse(
        id=conv.id,
        user_id=target_public_id,
        username=target_user.username,
        full_name=target_user.full_name,
        profile_photo=target_user.profile_photo,
        last_message=None,
        last_message_at=conv.last_message_at,
    )


@router.post("/chat/send", response_model=ChatMessageResponse)
async def send_message(
    payload: ChatSendRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    me_public_id = await _ensure_public_id(current_user, db)

    conv_result = await db.execute(
        select(ConversationV2).where(ConversationV2.id == payload.conversation_id)
    )
    conv = conv_result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if me_public_id not in {conv.user_a_id, conv.user_b_id}:
        raise HTTPException(status_code=403, detail="Not a participant")

    async with db.begin():
        msg = MessageV2(
            conversation_id=conv.id,
            sender_id=me_public_id,
            body=payload.body,
        )
        db.add(msg)
        conv.last_message_at = msg.created_at
        await db.flush()

    await db.commit()
    await db.refresh(msg)

    return ChatMessageResponse(
        id=msg.id,
        conversation_id=msg.conversation_id,
        sender_id=msg.sender_id,
        body=msg.body,
        created_at=msg.created_at,
    )


@router.get("/chat/list", response_model=List[ChatConversationResponse])
async def list_conversations(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    me_public_id = await _ensure_public_id(current_user, db)

    stmt = (
        select(ConversationV2)
        .where(or_(ConversationV2.user_a_id == me_public_id, ConversationV2.user_b_id == me_public_id))
        .order_by(desc(ConversationV2.last_message_at))
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    conversations = result.scalars().all()

    responses: List[ChatConversationResponse] = []
    for conv in conversations:
        other_id = conv.user_b_id if conv.user_a_id == me_public_id else conv.user_a_id
        other_result = await db.execute(select(User).where(User.public_id == other_id))
        other_user = other_result.scalar_one_or_none()

        last_msg_result = await db.execute(
            select(MessageV2).where(MessageV2.conversation_id == conv.id).order_by(desc(MessageV2.created_at)).limit(1)
        )
        last_msg = last_msg_result.scalar_one_or_none()

        responses.append(
            ChatConversationResponse(
                id=conv.id,
                user_id=other_id,
                username=other_user.username if other_user else None,
                full_name=other_user.full_name if other_user else None,
                profile_photo=other_user.profile_photo if other_user else None,
                last_message=last_msg.body if last_msg else None,
                last_message_at=last_msg.created_at if last_msg else conv.last_message_at,
            )
        )

    return responses


@router.get("/chat/messages/{conversation_id}", response_model=ChatMessagesResponse)
async def list_messages(
    conversation_id: UUID,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    me_public_id = await _ensure_public_id(current_user, db)

    conv_result = await db.execute(select(ConversationV2).where(ConversationV2.id == conversation_id))
    conv = conv_result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if me_public_id not in {conv.user_a_id, conv.user_b_id}:
        raise HTTPException(status_code=403, detail="Not a participant")

    msgs_result = await db.execute(
        select(MessageV2)
        .where(MessageV2.conversation_id == conversation_id)
        .order_by(desc(MessageV2.created_at))
        .limit(limit)
        .offset(offset)
    )
    msgs = list(reversed(msgs_result.scalars().all()))

    return ChatMessagesResponse(
        conversation_id=conversation_id,
        messages=[
            ChatMessageResponse(
                id=m.id,
                conversation_id=m.conversation_id,
                sender_id=m.sender_id,
                body=m.body,
                created_at=m.created_at,
            )
            for m in msgs
        ],
    )
