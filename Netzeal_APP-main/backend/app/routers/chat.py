"""
Chat and messaging API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, desc
from typing import List, Optional
from datetime import datetime, timedelta
import json

from ..core.database import get_async_db
from ..models.user import User
from ..models.chat import (
    Conversation, ConversationParticipant, Message, 
    MessageReadReceipt, MessageEmbedding,
    ConversationType, MessageType
)
from ..schemas.chat import (
    ConversationCreate, ConversationResponse, ConversationParticipantResponse,
    MessageCreate, MessageUpdate, MessageResponse, MessagesResponse,
    TypingEvent, ReadReceiptEvent, MediaUploadResponse
)
from ..routers.auth import get_current_user
from ..utils.chat_manager import chat_manager
from ..core.cloudinary_config import cloudinary_service
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/chat", tags=["chat"])


# ===== Conversation Endpoints =====

@router.post("/conversations", response_model=ConversationResponse)
async def create_conversation(
    data: ConversationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Create new conversation (direct or group chat)
    """
    # Validate participants exist
    participants_result = await db.execute(
        select(User).where(User.id.in_(data.participant_ids))
    )
    participants = participants_result.scalars().all()
    
    if len(participants) != len(data.participant_ids):
        raise HTTPException(status_code=400, detail="Invalid participant IDs")
    
    # For direct chat, check if conversation already exists
    if data.type == ConversationType.DIRECT:
        if len(data.participant_ids) != 1:
            raise HTTPException(status_code=400, detail="Direct chat must have exactly 1 other participant")
        
        other_user_id = data.participant_ids[0]
        
        # Check existing direct conversation
        existing = await db.execute(
            select(Conversation).join(ConversationParticipant).where(
                and_(
                    Conversation.type == ConversationType.DIRECT,
                    ConversationParticipant.user_id.in_([current_user.id, other_user_id])
                )
            ).group_by(Conversation.id).having(
                func.count(ConversationParticipant.user_id) == 2
            )
        )
        existing_conv = existing.scalar_one_or_none()
        if existing_conv:
            return await get_conversation_details(existing_conv.id, current_user, db)
    
    # Create conversation
    conversation = Conversation(
        type=data.type,
        title=data.title,
        created_by_id=current_user.id,
        created_at=datetime.utcnow(),
        last_message_at=datetime.utcnow()
    )
    db.add(conversation)
    await db.flush()
    
    # Add participants (including creator)
    all_participant_ids = [current_user.id] + data.participant_ids
    for user_id in set(all_participant_ids):
        participant = ConversationParticipant(
            conversation_id=conversation.id,
            user_id=user_id,
            joined_at=datetime.utcnow()
        )
        db.add(participant)
    
    await db.commit()
    
    # Subscribe creator to room
    await chat_manager.join_room(conversation.id, current_user.id)
    
    return await get_conversation_details(conversation.id, current_user, db)


@router.get("/conversations", response_model=List[ConversationResponse])
async def list_conversations(
    limit: int = 20,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    List user's conversations with last message preview
    Ordered by last activity
    """
    result = await db.execute(
        select(Conversation)
        .join(ConversationParticipant)
        .where(ConversationParticipant.user_id == current_user.id)
        .order_by(desc(Conversation.last_message_at))
        .limit(limit)
        .offset(offset)
    )
    conversations = result.scalars().all()
    
    # Build response with details
    response = []
    for conv in conversations:
        conv_data = await get_conversation_details(conv.id, current_user, db)
        response.append(conv_data)
    
    return response


@router.get("/conversations/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """Get conversation details"""
    # Check if user is participant
    participant = await db.execute(
        select(ConversationParticipant).where(
            and_(
                ConversationParticipant.conversation_id == conversation_id,
                ConversationParticipant.user_id == current_user.id
            )
        )
    )
    if not participant.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a conversation participant")
    
    return await get_conversation_details(conversation_id, current_user, db)


async def get_conversation_details(
    conversation_id: int, 
    current_user: User, 
    db: AsyncSession
) -> ConversationResponse:
    """Helper to build detailed conversation response"""
    # Get conversation
    conv_result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = conv_result.scalar_one()
    
    # Get participants with user info
    participants_result = await db.execute(
        select(ConversationParticipant, User)
        .join(User, ConversationParticipant.user_id == User.id)
        .where(ConversationParticipant.conversation_id == conversation_id)
    )
    participants = participants_result.all()
    
    participant_responses = []
    for participant, user in participants:
        participant_responses.append(ConversationParticipantResponse(
            user_id=user.id,
            username=user.username,
            full_name=user.full_name,
            profile_photo=user.profile_photo,
            last_read_at=participant.last_read_at,
            is_online=chat_manager.is_user_online(user.id)
        ))
    
    # Get last message
    last_msg_result = await db.execute(
        select(Message, User)
        .join(User, Message.sender_id == User.id)
        .where(Message.conversation_id == conversation_id)
        .order_by(desc(Message.created_at))
        .limit(1)
    )
    last_msg_data = last_msg_result.first()
    
    last_message = None
    last_message_sender = None
    if last_msg_data:
        msg, sender = last_msg_data
        last_message = msg.content or f"[{msg.message_type.value}]"
        last_message_sender = sender.username
    
    # Count unread messages
    current_participant = await db.execute(
        select(ConversationParticipant).where(
            and_(
                ConversationParticipant.conversation_id == conversation_id,
                ConversationParticipant.user_id == current_user.id
            )
        )
    )
    current_part = current_participant.scalar_one()
    
    unread_count = 0
    if current_part.last_read_at:
        unread_result = await db.execute(
            select(func.count(Message.id)).where(
                and_(
                    Message.conversation_id == conversation_id,
                    Message.created_at > current_part.last_read_at,
                    Message.sender_id != current_user.id
                )
            )
        )
        unread_count = unread_result.scalar()
    else:
        unread_result = await db.execute(
            select(func.count(Message.id)).where(
                and_(
                    Message.conversation_id == conversation_id,
                    Message.sender_id != current_user.id
                )
            )
        )
        unread_count = unread_result.scalar()
    
    return ConversationResponse(
        id=conversation.id,
        type=conversation.type,
        title=conversation.title,
        created_at=conversation.created_at,
        last_message_at=conversation.last_message_at,
        participants=participant_responses,
        unread_count=unread_count,
        last_message=last_message,
        last_message_sender=last_message_sender
    )


# ===== Message Endpoints =====

@router.get("/conversations/{conversation_id}/messages", response_model=MessagesResponse)
async def get_messages(
    conversation_id: int,
    cursor: Optional[str] = None,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Get messages with cursor pagination
    Cursor format: "timestamp_messageid" (e.g., "2024-01-01T12:00:00_123")
    """
    # Check participant
    participant = await db.execute(
        select(ConversationParticipant).where(
            and_(
                ConversationParticipant.conversation_id == conversation_id,
                ConversationParticipant.user_id == current_user.id
            )
        )
    )
    if not participant.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a conversation participant")
    
    # Parse cursor
    query = select(Message, User).join(User, Message.sender_id == User.id).where(
        Message.conversation_id == conversation_id
    )
    
    if cursor:
        try:
            cursor_time, cursor_id = cursor.rsplit("_", 1)
            cursor_dt = datetime.fromisoformat(cursor_time)
            query = query.where(
                or_(
                    Message.created_at < cursor_dt,
                    and_(Message.created_at == cursor_dt, Message.id < int(cursor_id))
                )
            )
        except Exception as e:
            logger.error(f"Invalid cursor: {e}")
            raise HTTPException(status_code=400, detail="Invalid cursor")
    
    # Fetch messages (newest first, then reverse for display)
    query = query.order_by(desc(Message.created_at), desc(Message.id)).limit(limit + 1)
    result = await db.execute(query)
    messages_data = result.all()
    
    has_more = len(messages_data) > limit
    if has_more:
        messages_data = messages_data[:limit]
    
    # Build response
    message_responses = []
    for msg, sender in messages_data:
        # Get read receipts
        receipts_result = await db.execute(
            select(MessageReadReceipt.user_id).where(
                MessageReadReceipt.message_id == msg.id
            )
        )
        read_by = [user_id for (user_id,) in receipts_result.all()]
        
        message_responses.append(MessageResponse(
            id=msg.id,
            conversation_id=msg.conversation_id,
            sender_id=msg.sender_id,
            sender_username=sender.username,
            sender_full_name=sender.full_name,
            sender_profile_photo=sender.profile_photo,
            content=msg.content,
            message_type=msg.message_type,
            media_url=msg.media_url,
            media_thumbnail_url=msg.media_thumbnail_url,
            message_metadata=msg.message_metadata,
            reply_to_id=msg.reply_to_id,
            is_edited=msg.is_edited,
            is_deleted=msg.is_deleted,
            created_at=msg.created_at,
            edited_at=msg.edited_at,
            read_by=read_by,
            is_read=current_user.id in read_by
        ))
    
    # Reverse to chronological order
    message_responses.reverse()
    
    # Generate next cursor
    next_cursor = None
    if has_more and messages_data:
        last_msg = messages_data[-1][0]
        next_cursor = f"{last_msg.created_at.isoformat()}_{last_msg.id}"
    
    return MessagesResponse(
        items=message_responses,
        next_cursor=next_cursor,
        has_more=has_more
    )


@router.post("/conversations/{conversation_id}/messages", response_model=MessageResponse)
async def send_message(
    conversation_id: int,
    content: Optional[str] = Form(None),
    message_type: MessageType = Form(MessageType.TEXT),
    reply_to_id: Optional[int] = Form(None),
    media: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Send message (text or media)
    Supports replies and media uploads
    """
    # Check participant
    participant = await db.execute(
        select(ConversationParticipant).where(
            and_(
                ConversationParticipant.conversation_id == conversation_id,
                ConversationParticipant.user_id == current_user.id
            )
        )
    )
    if not participant.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a conversation participant")
    
    # Upload media if provided
    media_url = None
    media_thumbnail_url = None
    if media:
        try:
            file_content = await media.read()
            upload_result = await cloudinary_service.upload_image(
                file_content,
                media.filename,
                folder="netzeal/chat"
            )
            media_url = upload_result["secure_url"]
            # Cloudinary doesn't return thumbnail by default, but we can use transformations
            if upload_result.get("resource_type") == "image":
                media_thumbnail_url = upload_result.get("secure_url")
        except Exception as e:
            logger.error(f"Media upload failed: {e}")
            raise HTTPException(status_code=500, detail="Media upload failed")
    
    # Create message
    message = Message(
        conversation_id=conversation_id,
        sender_id=current_user.id,
        content=content,
        message_type=message_type,
        media_url=media_url,
        media_thumbnail_url=media_thumbnail_url,
        reply_to_id=reply_to_id,
        created_at=datetime.utcnow()
    )
    db.add(message)
    
    # Update conversation last_message_at
    await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conv = (await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )).scalar_one()
    conv.last_message_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(message)
    
    # Build response
    message_response = MessageResponse(
        id=message.id,
        conversation_id=message.conversation_id,
        sender_id=current_user.id,
        sender_username=current_user.username,
        sender_full_name=current_user.full_name,
        sender_profile_photo=current_user.profile_photo,
        content=message.content,
        message_type=message.message_type,
        media_url=message.media_url,
        media_thumbnail_url=message.media_thumbnail_url,
        reply_to_id=message.reply_to_id,
        is_edited=False,
        is_deleted=False,
        created_at=message.created_at,
        read_by=[],
        is_read=False
    )
    
    # Broadcast via WebSocket
    await chat_manager.handle_new_message(
        conversation_id,
        message_response.dict()
    )
    
    return message_response


@router.put("/messages/{message_id}", response_model=MessageResponse)
async def edit_message(
    message_id: int,
    data: MessageUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """Edit message content (text only)"""
    message_result = await db.execute(
        select(Message).where(Message.id == message_id)
    )
    message = message_result.scalar_one_or_none()
    
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    if message.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Can only edit your own messages")
    
    if message.message_type != MessageType.TEXT:
        raise HTTPException(status_code=400, detail="Can only edit text messages")
    
    message.content = data.content
    message.is_edited = True
    message.edited_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(message)
    
    # Get sender info for response
    sender = await db.get(User, message.sender_id)
    
    return MessageResponse(
        id=message.id,
        conversation_id=message.conversation_id,
        sender_id=message.sender_id,
        sender_username=sender.username,
        sender_full_name=sender.full_name,
        sender_profile_photo=sender.profile_photo,
        content=message.content,
        message_type=message.message_type,
        media_url=message.media_url,
        reply_to_id=message.reply_to_id,
        is_edited=message.is_edited,
        is_deleted=message.is_deleted,
        created_at=message.created_at,
        edited_at=message.edited_at,
        read_by=[],
        is_read=False
    )


@router.delete("/messages/{message_id}")
async def delete_message(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """Soft delete message"""
    message_result = await db.execute(
        select(Message).where(Message.id == message_id)
    )
    message = message_result.scalar_one_or_none()
    
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    if message.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Can only delete your own messages")
    
    message.is_deleted = True
    message.content = "[Message deleted]"
    
    await db.commit()
    
    return {"success": True}


@router.post("/messages/{message_id}/read")
async def mark_message_read(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """Mark message as read (creates read receipt)"""
    message = await db.get(Message, message_id)
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    # Check if already read
    existing = await db.execute(
        select(MessageReadReceipt).where(
            and_(
                MessageReadReceipt.message_id == message_id,
                MessageReadReceipt.user_id == current_user.id
            )
        )
    )
    if existing.scalar_one_or_none():
        return {"success": True, "already_read": True}
    
    # Create receipt
    receipt = MessageReadReceipt(
        message_id=message_id,
        user_id=current_user.id,
        read_at=datetime.utcnow()
    )
    db.add(receipt)
    
    # Update participant last_read_at
    await db.execute(
        select(ConversationParticipant).where(
            and_(
                ConversationParticipant.conversation_id == message.conversation_id,
                ConversationParticipant.user_id == current_user.id
            )
        )
    )
    participant = (await db.execute(
        select(ConversationParticipant).where(
            and_(
                ConversationParticipant.conversation_id == message.conversation_id,
                ConversationParticipant.user_id == current_user.id
            )
        )
    )).scalar_one()
    participant.last_read_at = datetime.utcnow()
    participant.last_seen_message_id = message_id
    
    await db.commit()
    
    # Broadcast read receipt
    await chat_manager.handle_read_receipt(
        message.conversation_id,
        message_id,
        current_user.id
    )
    
    return {"success": True}


# ===== WebSocket Endpoint =====

@router.websocket("/ws/{user_id}")
async def chat_websocket(
    websocket: WebSocket,
    user_id: int,
    db: AsyncSession = Depends(get_async_db)
):
    """
    WebSocket endpoint for real-time chat
    Events: NEW_MESSAGE, TYPING, READ_RECEIPT, USER_ONLINE, USER_OFFLINE
    """
    await chat_manager.connect(websocket, user_id)
    
    try:
        # Auto-join all user's conversation rooms
        conversations_result = await db.execute(
            select(ConversationParticipant.conversation_id).where(
                ConversationParticipant.user_id == user_id
            )
        )
        conversation_ids = [conv_id for (conv_id,) in conversations_result.all()]
        
        for conv_id in conversation_ids:
            await chat_manager.join_room(conv_id, user_id)
        
        # Listen for client messages
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            msg_type = message.get("type")
            msg_data = message.get("data", {})
            
            if msg_type == "TYPING":
                # Handle typing indicator
                conversation_id = msg_data.get("conversation_id")
                is_typing = msg_data.get("is_typing", True)
                
                user = await db.get(User, user_id)
                await chat_manager.handle_typing(
                    conversation_id,
                    user_id,
                    user.username,
                    is_typing
                )
            
            elif msg_type == "JOIN_ROOM":
                # Join conversation room
                conversation_id = msg_data.get("conversation_id")
                await chat_manager.join_room(conversation_id, user_id)
            
            elif msg_type == "LEAVE_ROOM":
                # Leave conversation room
                conversation_id = msg_data.get("conversation_id")
                await chat_manager.leave_room(conversation_id, user_id)
    
    except WebSocketDisconnect:
        logger.info(f"User {user_id} disconnected from chat")
    except Exception as e:
        logger.error(f"WebSocket error for user {user_id}: {e}")
    finally:
        await chat_manager.disconnect(websocket, user_id)
