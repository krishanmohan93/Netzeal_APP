"""
Content management routes (posts, comments, likes, bookmarks)
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
import logging
import mimetypes
from sqlalchemy.orm import Session, joinedload, load_only, selectinload
from sqlalchemy import desc, or_, func
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
from typing import List, Optional
import json

from ..core.database import get_db
from ..core.config import settings
from ..core.security import get_current_user
from ..core.rate_limit import post_create_rate_limit, engagement_rate_limit
from ..core.feature_gates import require_live_streaming_enabled, require_semantic_features_enabled
from ..core.cloudinary_config import cloudinary_service
from ..models import User, Post, Comment, Like, Bookmark, UserInteraction, InteractionType, Connection, Follow
from ..models.content import ContentType, LiveSession, LiveComment, PostMedia, MediaType
from ..schemas.content import (
    PostCreate,
    PostUpdate,
    PostResponse,
    InstagramPostCreate,
    InstagramFeedPostResponse,
    MultiMediaPostOut,
    PostMediaOut,
    TransformStateUpdate,
    LiveSessionCreate,
    LiveSessionResponse,
    LiveCommentCreate,
    LiveCommentResponse,
    CommentCreate,
    CommentResponse,
    LikeResponse,
    BookmarkResponse,
    PostDraftCreate,
    PostPublishResponse,
    FeedResponse
)
from ..utils.ws import manager
from ..services.notification_service import create_notification
from ..utils.redis_cache import get_cached_json, set_cached_json, paged_feed_cache_key, get_cache, set_cache, invalidate_all_feeds
from ..models.content import FeedItem
from ..services.groq_deepseek_service import AIService
from ..services.embedding_service import EmbeddingService
from ..services.qdrant_service import QdrantService
from ..workers.feed_tasks import fanout_post_to_followers

router = APIRouter(prefix="/content", tags=["Content"])
logger = logging.getLogger(__name__)

# Lazy initialization of Qdrant and Embedding services
_embedding_service = None
_embedding_init_attempted = False
_qdrant_service = None
_qdrant_init_attempted = False


def _enqueue_fanout(post_id: int, author_id: int) -> None:
    try:
        if settings.CELERY_BROKER_URL:
            fanout_post_to_followers.delay(post_id, author_id)
        else:
            fanout_post_to_followers.run(post_id, author_id)
    except Exception as e:
        logger.warning("Failed to run fanout task for post %s: %s", post_id, e)


def get_embedding_service():
    """Lazy initialization of embedding service with error handling."""
    global _embedding_service, _embedding_init_attempted

    if _embedding_service is not None:
        return _embedding_service

    if _embedding_init_attempted:
        return None

    _embedding_init_attempted = True

    try:
        _embedding_service = EmbeddingService()
        print("✅ Embedding model initialized")
        return _embedding_service
    except Exception as e:
        print(f"⚠️ Embedding model initialization failed: {e}")
        print("   Semantic features are currently unavailable")
        return None

def get_qdrant_service():
    """Lazy initialization of Qdrant service with error handling."""
    global _qdrant_service, _qdrant_init_attempted
    
    if _qdrant_service is not None:
        return _qdrant_service
    
    if _qdrant_init_attempted:
        return None
    
    _qdrant_init_attempted = True
    
    try:
        _qdrant_service = QdrantService()
        _qdrant_service.init_posts_collection()
        print("✅ Qdrant posts collection initialized")
        return _qdrant_service
    except Exception as e:
        print(f"⚠️ Qdrant initialization failed: {e}")
        print("   Semantic search features will be disabled")
        return None


def _get_allowed_author_ids(db: Session, current_user: User) -> List[int]:
    allowed_author_ids = {current_user.id}

    legacy_following = {
        row[0]
        for row in db.query(Follow.following_id).filter(Follow.follower_id == current_user.id).all()
        if row and row[0]
    }
    allowed_author_ids.update(legacy_following)

    if current_user.public_id:
        connection_rows = (
            db.query(Connection.following_id)
            .filter(Connection.follower_id == current_user.public_id, Connection.status == "connected")
            .all()
        )
        public_ids = {row[0] for row in connection_rows if row and row[0]}
        if public_ids:
            mapped_ids = {
                row[0]
                for row in db.query(User.id).filter(User.public_id.in_(list(public_ids))).all()
                if row and row[0]
            }
            allowed_author_ids.update(mapped_ids)

    return list(allowed_author_ids)


def _resolve_upload_mime(upload: UploadFile) -> str:
    content_type = (upload.content_type or "").lower().strip()
    if content_type:
        return content_type
    guessed_type, _ = mimetypes.guess_type(upload.filename or "")
    return (guessed_type or "").lower().strip()


def _validate_media_size(file_bytes: bytes, *, is_video: bool = False) -> None:
    size_bytes = len(file_bytes)
    max_bytes = settings.MAX_VIDEO_UPLOAD_SIZE_BYTES if is_video else settings.MAX_MEDIA_UPLOAD_SIZE_BYTES
    if size_bytes > max_bytes:
        max_mb = round(max_bytes / (1024 * 1024))
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum allowed size is {max_mb}MB",
        )


@router.post("/posts", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def create_post(
    post_data: PostCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _: None = Depends(post_create_rate_limit),
):
    """Create a new post"""
    
    # Create post
    new_post = Post(
        author_id=current_user.id,
        title=post_data.title,
        content=post_data.content,
        content_type=post_data.content_type,
        media_urls=post_data.media_urls,
        tags=post_data.tags
    )
    
    db.add(new_post)
    db.commit()
    db.refresh(new_post)
    
    # Generate AI metadata using Groq (async task in production)
    try:
        # Extract topics using Groq
        content_text = f"{post_data.title or ''} {post_data.content}"
        topics_prompt = f"Extract 3-5 main topics/keywords from this content (comma-separated): {content_text[:500]}"
        topics_response = await AIService.generate_ai_response(
            prompt=topics_prompt,
            mode="free",
            temperature=0.3,
            max_tokens=50
        )
        topics = [t.strip() for t in topics_response.split(",")][:5]
        new_post.topics = topics
        
        # For embeddings, we'll use a simple hash-based approach or skip for now
        # In production, you can use sentence-transformers or similar
        
        db.commit()
    except Exception as e:
        print(f"Error generating AI metadata: {e}")

    # Index post in Qdrant for semantic search
    try:
        embedding_service = get_embedding_service()
        if not embedding_service:
            raise RuntimeError("Embedding service unavailable")

        vectors = embedding_service.embed_post(
            post_id=new_post.id,
            caption=post_data.content or "",
            hashtags=post_data.tags,
        )
        payload = {
            "caption": post_data.content or "",
            "tags": post_data.tags or [],
            "media_type": (post_data.content_type.value if post_data.content_type else "post"),
            "author_username": current_user.username,
            "created_at": new_post.created_at.isoformat(),
        }
        qdrant = get_qdrant_service()
        if qdrant:
            qdrant.upsert_post(new_post.id, current_user.id, vectors, payload)
            print(f"✅ Post indexed in Qdrant: {new_post.id}")
    except Exception as e:
        print(f"⚠️ Qdrant indexing failed for post {new_post.id}: {e}")

    _enqueue_fanout(new_post.id, current_user.id)

    try:
        await manager.broadcast_json({"type": "NEW_POST", "post_id": new_post.id})
    except Exception:
        pass
    
    # Add author info
    post_dict = PostResponse.model_validate(new_post).model_dump()
    post_dict["author_username"] = current_user.username
    post_dict["author_full_name"] = current_user.full_name
    post_dict["author_photo"] = current_user.profile_photo
    
    return post_dict



@router.get("/users/{user_identifier}/posts", response_model=List[PostResponse])
async def get_user_posts_by_id(
    user_identifier: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get posts for a specific user profile"""

    limit = min(limit, 50)
    
    # Resolve user
    user = None
    try:
        from uuid import UUID
        user_uuid = UUID(user_identifier)
        user = db.query(User).filter(User.public_id == user_uuid).first()
    except Exception:
        user = None

    if not user and user_identifier.isdigit():
        user = db.query(User).filter(User.id == int(user_identifier)).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Get posts (public visibility check could be added here)
    posts = (
        db.query(Post)
        .options(
            load_only(
                Post.id,
                Post.author_id,
                Post.title,
                Post.content,
                Post.content_type,
                Post.media_urls,
                Post.tags,
                Post.views_count,
                Post.likes_count,
                Post.comments_count,
                Post.shares_count,
                Post.topics,
                Post.created_at,
                Post.updated_at,
            ),
            joinedload(Post.author).load_only(User.id, User.username, User.full_name, User.profile_photo),
            selectinload(Post.comments).load_only(Comment.id, Comment.post_id)
        )
        .filter(Post.author_id == user.id)
        .order_by(desc(Post.created_at))
        .offset(skip)
        .limit(limit)
        .all()
    )

    post_ids = [post.id for post in posts]
    
    # Get user's likes and bookmarks reuse logic
    user_likes = set()
    user_bookmarks = set()
    if post_ids:
        user_likes = {
            like.post_id
            for like in db.query(Like)
            .options(load_only(Like.post_id))
            .filter(Like.user_id == current_user.id, Like.post_id.in_(post_ids))
            .all()
        }
        user_bookmarks = {
            bm.post_id
            for bm in db.query(Bookmark)
            .options(load_only(Bookmark.post_id))
            .filter(Bookmark.user_id == current_user.id, Bookmark.post_id.in_(post_ids))
            .all()
        }
    
    result = []
    for post in posts:
        post_dict = PostResponse.model_validate(post).model_dump()
        post_dict["author_username"] = post.author.username
        post_dict["author_full_name"] = post.author.full_name
        post_dict["author_photo"] = post.author.profile_photo
        post_dict["is_liked"] = post.id in user_likes
        post_dict["is_bookmarked"] = post.id in user_bookmarks
        result.append(post_dict)
    
    return result


@router.get("/posts", response_model=List[PostResponse])
async def get_posts(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all posts (feed)"""

    limit = min(limit, 50)

    cache_key = paged_feed_cache_key(current_user.id, skip, limit)
    cached = await get_cached_json(cache_key)
    if cached is not None:
        return cached

    allowed_author_ids = _get_allowed_author_ids(db, current_user)
    if not allowed_author_ids:
        return []

    posts = (
        db.query(Post)
        .options(
            load_only(
                Post.id,
                Post.author_id,
                Post.title,
                Post.content,
                Post.content_type,
                Post.media_urls,
                Post.tags,
                Post.views_count,
                Post.likes_count,
                Post.comments_count,
                Post.shares_count,
                Post.topics,
                Post.created_at,
                Post.updated_at,
            ),
            joinedload(Post.author).load_only(User.id, User.username, User.full_name, User.profile_photo)
        )
        .filter(Post.author_id.in_(allowed_author_ids))
        .order_by(desc(Post.created_at))
        .offset(skip)
        .limit(limit)
        .all()
    )

    post_ids = [post.id for post in posts]
    
    # Get user's likes and bookmarks
    user_likes = set()
    user_bookmarks = set()
    if post_ids:
        user_likes = {
            like.post_id
            for like in db.query(Like)
            .options(load_only(Like.post_id))
            .filter(Like.user_id == current_user.id, Like.post_id.in_(post_ids))
            .all()
        }
        user_bookmarks = {
            bm.post_id
            for bm in db.query(Bookmark)
            .options(load_only(Bookmark.post_id))
            .filter(Bookmark.user_id == current_user.id, Bookmark.post_id.in_(post_ids))
            .all()
        }
    
    result = []
    for post in posts:
        post_dict = PostResponse.model_validate(post).model_dump()
        post_dict["author_username"] = post.author.username
        post_dict["author_full_name"] = post.author.full_name
        post_dict["author_photo"] = post.author.profile_photo
        post_dict["is_liked"] = post.id in user_likes
        post_dict["is_bookmarked"] = post.id in user_bookmarks
        result.append(post_dict)
    
    await set_cached_json(cache_key, result, settings.FEED_CACHE_TTL_SECONDS)
    return result


@router.delete("/posts/{post_id}", status_code=200)
async def delete_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Robust deletion of a post with full transaction safety.

    Workflow:
    1. Fetch post; return 404 JSON if missing.
    2. Authorize current user.
    3. Delete dependent rows (manual or rely on DB CASCADE) inside a try block.
    4. Roll back immediately on any failure to avoid InFailedSqlTransaction state.
    5. Commit only after all deletes succeed.
    Returns stable JSON structure suitable for clients.
    """
    logger.info("Delete request: post_id=%s user=%s", post_id, current_user.username)

    # Fast existence check (no locks)
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        logger.warning("Post %s not found", post_id)
        raise HTTPException(status_code=404, detail={"success": False, "message": "Post not found"})

    if post.author_id != current_user.id:
        logger.warning("Unauthorized delete attempt user=%s post=%s", current_user.username, post_id)
        raise HTTPException(status_code=403, detail={"success": False, "message": "Not authorized to delete this post"})

    from sqlalchemy import inspect
    inspector = inspect(db.bind)
    table_names = set(inspector.get_table_names())

    try:
        # Explicit child deletions (defensive). If ON DELETE CASCADE is active these become no-ops.
        likes_deleted = db.query(Like).filter(Like.post_id == post_id).delete(synchronize_session=False)
        comments_deleted = db.query(Comment).filter(Comment.post_id == post_id).delete(synchronize_session=False)
        bookmarks_deleted = db.query(Bookmark).filter(Bookmark.post_id == post_id).delete(synchronize_session=False)
        interactions_deleted = db.query(UserInteraction).filter(UserInteraction.post_id == post_id).delete(synchronize_session=False)

        feed_deleted = 0
        from ..models.content import FeedItem
        feed_deleted = db.query(FeedItem).filter(FeedItem.post_id == post_id).delete(synchronize_session=False)

        # Optional PostMedia table cleanup only if table exists
        media_deleted = 0
        if "post_media" in table_names:
            try:
                from ..models.content import PostMedia
                media_deleted = db.query(PostMedia).filter(PostMedia.post_id == post_id).delete(synchronize_session=False)
            except Exception as media_err:
                db.rollback()  # rollback media error only, then re-start transaction for remaining operations
                logger.error("PostMedia delete failed for post %s: %s", post_id, media_err)
                # Re-run prior successful deletes to ensure consistent state before final post delete
                likes_deleted = db.query(Like).filter(Like.post_id == post_id).delete(synchronize_session=False)
                comments_deleted = db.query(Comment).filter(Comment.post_id == post_id).delete(synchronize_session=False)
                bookmarks_deleted = db.query(Bookmark).filter(Bookmark.post_id == post_id).delete(synchronize_session=False)
                interactions_deleted = db.query(UserInteraction).filter(UserInteraction.post_id == post_id).delete(synchronize_session=False)
                feed_deleted = db.query(FeedItem).filter(FeedItem.post_id == post_id).delete(synchronize_session=False)

        # Finally delete the post
        db.delete(post)
        db.commit()
        logger.info(
            "Post %s deleted (likes=%s comments=%s bookmarks=%s interactions=%s feed=%s media=%s)",
            post_id, likes_deleted, comments_deleted, bookmarks_deleted, interactions_deleted, feed_deleted, media_deleted
        )
        return {"success": True, "message": "Post deleted successfully", "post_id": post_id}
    except HTTPException:
        # Already structured; ensure rollback then propagate
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.exception("Delete failed for post %s", post_id)
        raise HTTPException(status_code=500, detail={"success": False, "message": f"Failed to delete post: {e}"})


@router.get("/posts/{post_id}", response_model=PostResponse)
async def get_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific post"""
    
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found"
        )
    
    # Increment view count
    post.views_count += 1
    db.commit()
    
    # Track interaction
    interaction = UserInteraction(
        user_id=current_user.id,
        post_id=post_id,
        interaction_type=InteractionType.VIEW
    )
    db.add(interaction)
    db.commit()
    
    # Check if user liked/bookmarked
    is_liked = db.query(Like).filter(
        Like.user_id == current_user.id,
        Like.post_id == post_id
    ).first() is not None
    
    is_bookmarked = db.query(Bookmark).filter(
        Bookmark.user_id == current_user.id,
        Bookmark.post_id == post_id
    ).first() is not None
    
    post_dict = PostResponse.model_validate(post).model_dump()
    post_dict["author_username"] = post.author.username
    post_dict["author_full_name"] = post.author.full_name
    post_dict["author_photo"] = post.author.profile_photo
    post_dict["is_liked"] = is_liked
    post_dict["is_bookmarked"] = is_bookmarked
    
    return post_dict


@router.post("/posts/{post_id}/like", response_model=LikeResponse)
async def like_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _: None = Depends(engagement_rate_limit),
):
    """Like a post"""
    
    # Check if post exists
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found"
        )
    
    # Check if already liked
    existing_like = db.query(Like).filter(
        Like.user_id == current_user.id,
        Like.post_id == post_id
    ).first()
    
    if existing_like:
        return existing_like
    
    # Create like
    new_like = Like(user_id=current_user.id, post_id=post_id)
    db.add(new_like)
    
    # Update post likes count atomically
    db.query(Post).filter(Post.id == post_id).update(
        {Post.likes_count: Post.likes_count + 1},
        synchronize_session=False,
    )
    
    # Track interaction
    interaction = UserInteraction(
        user_id=current_user.id,
        post_id=post_id,
        interaction_type=InteractionType.LIKE
    )
    db.add(interaction)
    
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing_like = db.query(Like).filter(
            Like.user_id == current_user.id,
            Like.post_id == post_id,
        ).first()
        if existing_like:
            return existing_like
        raise

    db.refresh(new_like)

    try:
        await invalidate_all_feeds([current_user.id, post.author_id])
    except Exception:
        pass
    
    # NOTIFICATION
    await create_notification(
        db,
        post.author_id,
        current_user.id,
        "like",
        f"{current_user.username} liked your post",
        post.id
    )

    return new_like


@router.delete("/posts/{post_id}/like")
async def unlike_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _: None = Depends(engagement_rate_limit),
):
    """Unlike a post"""
    
    like = db.query(Like).filter(
        Like.user_id == current_user.id,
        Like.post_id == post_id
    ).first()
    
    if not like:
        return {"message": "Post already unliked"}
    
    post = db.query(Post).filter(Post.id == post_id).first()
    post_author_id = post.author_id if post else None

    # Update post likes count atomically
    db.query(Post).filter(Post.id == post_id).update(
        {Post.likes_count: func.greatest(Post.likes_count - 1, 0)},
        synchronize_session=False,
    )
    
    db.delete(like)
    db.commit()

    try:
        await invalidate_all_feeds([current_user.id, post_author_id])
    except Exception:
        pass
    
    return {"message": "Post unliked successfully"}


@router.post("/posts/{post_id}/bookmark", response_model=BookmarkResponse)
async def bookmark_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Bookmark a post"""
    
    # Check if post exists
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found"
        )
    
    # Check if already bookmarked
    existing_bookmark = db.query(Bookmark).filter(
        Bookmark.user_id == current_user.id,
        Bookmark.post_id == post_id
    ).first()
    
    if existing_bookmark:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Already bookmarked this post"
        )
    
    # Create bookmark
    new_bookmark = Bookmark(user_id=current_user.id, post_id=post_id)
    db.add(new_bookmark)
    
    # Track interaction
    interaction = UserInteraction(
        user_id=current_user.id,
        post_id=post_id,
        interaction_type=InteractionType.BOOKMARK
    )
    db.add(interaction)
    
    db.commit()
    db.refresh(new_bookmark)
    
    return new_bookmark


@router.post("/posts/{post_id}/comments", response_model=CommentResponse)
async def create_comment(
    post_id: int,
    comment_data: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _: None = Depends(engagement_rate_limit),
):
    """Add a comment to a post"""

    if comment_data.post_id is not None and int(comment_data.post_id) != int(post_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="post_id mismatch between path and body",
        )
    
    # Check if post exists
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found"
        )
    
    # Create comment
    new_comment = Comment(
        post_id=post_id,
        author_id=current_user.id,
        content=comment_data.content
    )
    
    db.add(new_comment)
    
    # Update post comments count atomically
    db.query(Post).filter(Post.id == post_id).update(
        {Post.comments_count: Post.comments_count + 1},
        synchronize_session=False,
    )
    
    # Track interaction
    interaction = UserInteraction(
        user_id=current_user.id,
        post_id=post_id,
        interaction_type=InteractionType.COMMENT
    )
    db.add(interaction)
    
    db.commit()
    db.refresh(new_comment)

    try:
        await invalidate_all_feeds([current_user.id, post.author_id])
    except Exception:
        pass
    
    # NOTIFICATION
    await create_notification(
        db,
        post.author_id,
        current_user.id,
        "comment",
        f"{current_user.username} commented: {comment_data.content[:20]}...",
        post.id
    )

    comment_dict = CommentResponse.model_validate(new_comment).model_dump()
    comment_dict["author_username"] = current_user.username
    comment_dict["author_full_name"] = current_user.full_name
    comment_dict["author_photo"] = current_user.profile_photo
    
    return comment_dict


@router.get("/posts/{post_id}/comments", response_model=List[CommentResponse])
async def get_post_comments(
    post_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get comments for a post"""

    limit = min(limit, 50)
    
    comments = db.query(Comment).options(
        joinedload(Comment.author).load_only(User.id, User.username, User.full_name, User.profile_photo)
    ).filter(
        Comment.post_id == post_id
    ).order_by(desc(Comment.created_at)).offset(skip).limit(limit).all()
    
    result = []
    for comment in comments:
        comment_dict = CommentResponse.model_validate(comment).model_dump()
        comment_dict["author_username"] = comment.author.username
        comment_dict["author_full_name"] = comment.author.full_name
        comment_dict["author_photo"] = comment.author.profile_photo
        result.append(comment_dict)
    
    return result


# ============================================================================
# INSTAGRAM-LIKE ENDPOINTS (Media Upload + Feed)
# ============================================================================

@router.post("/upload-post", response_model=InstagramFeedPostResponse, status_code=status.HTTP_201_CREATED)
async def upload_instagram_post(
    file: UploadFile = File(..., description="Image or video file to upload"),
    caption: str = Form(..., description="Post caption"),
    tags: Optional[str] = Form(None, description="Comma-separated tags"),
    is_reel: bool = Form(False, description="Whether this upload is a reel (short vertical video)"),
    is_project: bool = Form(False, description="Whether this upload is a portfolio project"),
    trim_start: Optional[float] = Form(None, description="Optional trim start in seconds"),
    trim_duration: Optional[float] = Form(None, description="Optional trim duration in seconds (<=60 for reels)"),
    filter: Optional[str] = Form(None, description="Optional filter preset: grayscale|sepia|brightness:50|contrast:50"),
    overlay_text: Optional[str] = Form(None, description="Optional text overlay for video"),
    audio_public_id: Optional[str] = Form(None, description="Optional Cloudinary audio public_id to overlay (reels)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _: None = Depends(post_create_rate_limit),
):
    """
    Upload Instagram-like post with image or video
    
    - Accepts: JPEG, PNG, GIF, MP4, MOV, AVI
    - Max size: Handled by Cloudinary
    - Returns: Post with media URL
    """
    
    print(f"📤 Upload request from user: {current_user.username}")
    print(f"   File: {file.filename}, Type: {file.content_type}")
    print(f"   Caption: {caption[:50]}...")
    print(f"   Is Reel: {is_reel}")
    
    # Validate file type
    allowed_image_types = {"image/jpeg", "image/png", "image/gif", "image/webp"}
    allowed_video_types = {"video/mp4", "video/quicktime", "video/x-msvideo", "video/mpeg"}
    
    content_type = _resolve_upload_mime(file)
    
    is_image = content_type in allowed_image_types
    is_video = content_type in allowed_video_types
    
    if not (is_image or is_video):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type: {content_type}. Please upload an image (JPEG, PNG, GIF) or video (MP4, MOV, AVI)"
        )

    # Reel validation
    if is_reel and not is_video:
        raise HTTPException(status_code=400, detail="Reels must be video files")
    if is_reel and trim_duration and trim_duration > 60:
        raise HTTPException(status_code=400, detail="Reel duration must be <= 60 seconds")
    
    # Read file content
    try:
        file_content = await file.read()
        _validate_media_size(file_content, is_video=is_video)
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error reading file: {str(e)}"
        )
    
    # Upload to Cloudinary
    try:
        if is_image:
            upload_result = await cloudinary_service.upload_image(
                file_content=file_content,
                filename=file.filename,
                folder=f"netzeal/posts/{current_user.id}"
            )
        else:  # is_video
            transformation = None
            if is_reel:
                # Vertical 9:16 crop, optional trim
                base_t = {
                    'aspect_ratio': '9:16',
                    'crop': 'fill',
                    'gravity': 'center',
                    'quality': 'auto:best',
                    'fetch_format': 'auto'
                }
                if trim_start is not None:
                    base_t['start_offset'] = trim_start
                if trim_duration is not None:
                    base_t['duration'] = trim_duration
                transformation = base_t
            upload_result = await cloudinary_service.upload_video(
                file_content=file_content,
                filename=file.filename,
                folder=f"netzeal/videos/{current_user.id}",
                transformation=transformation
            )
        
        if not upload_result.get('success'):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Media upload failed: {upload_result.get('error', 'Unknown error')}"
            )
        
        media_url = upload_result['url']
        media_public_id = upload_result['public_id']
        media_type = 'image' if is_image else ('video' if not is_reel else 'reel')
        width = upload_result.get('width')
        height = upload_result.get('height')
        duration = upload_result.get('duration')

        # Apply transformations for delivery URLs if requested
        # For images: basic effects
        if is_image and filter:
            eff = _map_filter_effect(filter)
            if eff:
                media_url = cloudinary_service.build_image_url(media_public_id, effects=eff)
        # For reels: build transformed URL including trims / overlay / audio
        if is_reel:
            eff_v = _map_filter_effect(filter)
            media_url = cloudinary_service.build_video_url(
                media_public_id,
                start_offset=trim_start,
                duration=trim_duration,
                aspect_ratio='9:16',
                overlay_text=overlay_text,
                audio_public_id=audio_public_id,
                effects=eff_v
            ) or media_url
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload error: {str(e)}"
        )
    
    # Parse tags
    tags_list = None
    if tags:
        tags_list = [tag.strip() for tag in tags.split(',') if tag.strip()]
    
    # Create post in database
    content_type_value = ContentType.PROJECT if is_project else (ContentType.REEL if is_reel else (ContentType.VIDEO if is_video else ContentType.POST))
    print(f"💾 Creating post with content_type: {content_type_value.value}")
    
    new_post = Post(
        author_id=current_user.id,
        title=None,
        content=caption,
        content_type=content_type_value,
        media_urls=[media_url],  # Store as list for consistency
        tags=tags_list,
        views_count=0,
        likes_count=0,
        comments_count=0,
        shares_count=0,
        duration_seconds=int(duration) if duration else None,
        thumbnail_url=cloudinary_service.get_thumbnail_url(media_public_id, width=400, height=700) if is_video else None,
        is_published=True,
        published_at=func.now(),
        visibility="public"
    )

    db.add(new_post)
    db.commit()
    db.refresh(new_post)

    # Index post in Qdrant for semantic search
    try:
        embedding_service = get_embedding_service()
        if not embedding_service:
            raise RuntimeError("Embedding service unavailable")

        vectors = embedding_service.embed_post(
            post_id=new_post.id,
            caption=caption,
            hashtags=tags_list
        )
        payload = {
            "caption": caption,
            "tags": tags_list or [],
            "media_type": media_type,
            "author_username": current_user.username,
            "created_at": new_post.created_at.isoformat()
        }
        qdrant = get_qdrant_service()
        if qdrant:
            qdrant.upsert_post(new_post.id, current_user.id, vectors, payload)
            print(f"✅ Post indexed in Qdrant: {new_post.id}")
    except Exception as e:
        print(f"⚠️ Qdrant indexing failed for post {new_post.id}: {e}")

    # Fan-out in background worker for faster API response
    try:
        _enqueue_fanout(new_post.id, current_user.id)
    except Exception as e:
        logger.warning("Failed to enqueue fanout task for post %s: %s", new_post.id, e)

    try:
        # Broadcast to websocket subscribers
        await manager.broadcast_json({"type": "NEW_POST", "post_id": new_post.id})
    except Exception as e:
        print(f"⚠️ Broadcast failed for upload post {new_post.id}: {e}")

    print(f"✅ Post created & published successfully! ID: {new_post.id}, content_type: {new_post.content_type.value}")
    
    # Return Instagram-like response
    return InstagramFeedPostResponse(
        id=new_post.id,
        caption=caption,
        media_url=media_url,
        media_type='video' if media_type == 'video' else ('image' if media_type == 'image' else 'video'),
        type='reel' if is_reel else ('video' if is_video else 'post'),
        width=width,
        height=height,
        duration=duration,
        thumbnail_url=new_post.thumbnail_url,
        author_id=current_user.id,
        author_username=current_user.username,
        author_full_name=current_user.full_name,
        author_profile_picture=current_user.profile_photo,
        author_is_verified=current_user.is_verified,
        likes_count=0,
        comments_count=0,
        views_count=0,
        is_liked=False,
        is_bookmarked=False,
        tags=tags_list,
        created_at=new_post.created_at
    )


@router.post("/upload-posts", response_model=List[InstagramFeedPostResponse], status_code=status.HTTP_201_CREATED)
async def upload_multiple_media_posts(
    files: List[UploadFile] = File(..., description="List of image/video files to upload"),
    caption: str = Form(..., description="Post caption (applied to all)"),
    tags: Optional[str] = Form(None, description="Comma-separated tags"),
    reels: Optional[str] = Form(None, description="Comma-separated indices (0-based) of files that are reels"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _: None = Depends(post_create_rate_limit),
):
    """Upload multiple media items as separate posts in a single request.

    Notes:
    - Each file becomes an individual Post row for feed consistency.
    - Reel detection indices provided via `reels` form field (e.g., "0,2")
    - Tags applied to each post.
    - Returns list of created InstagramFeedPostResponse items.
    - Future optimization: batch insert + background fan-out.
    """

    if not files:
        raise HTTPException(status_code=400, detail="At least one file is required")

    allowed_image_types = {"image/jpeg", "image/png", "image/gif", "image/webp"}
    allowed_video_types = {"video/mp4", "video/quicktime", "video/x-msvideo", "video/mpeg"}

    reel_indices = set()
    if reels:
        for r in reels.split(','):
            r = r.strip()
            if r.isdigit():
                reel_indices.add(int(r))

    tags_list = None
    if tags:
        tags_list = [t.strip() for t in tags.split(',') if t.strip()]

    responses: List[InstagramFeedPostResponse] = []

    for idx, file in enumerate(files):
        content_type = _resolve_upload_mime(file)
        is_image = content_type in allowed_image_types
        is_video = content_type in allowed_video_types
        is_reel = idx in reel_indices and is_video

        if not (is_image or is_video):
            raise HTTPException(status_code=400, detail=f"Unsupported file type at index {idx}: {content_type}")

        try:
            blob = await file.read()
            _validate_media_size(blob, is_video=is_video)
        except Exception as e:
            if isinstance(e, HTTPException):
                raise
            raise HTTPException(status_code=500, detail="Error processing upload")

        try:
            if is_image:
                upload_result = await cloudinary_service.upload_image(
                    file_content=blob,
                    filename=file.filename,
                    folder=f"netzeal/posts/{current_user.id}"
                )
            else:
                upload_result = await cloudinary_service.upload_video(
                    file_content=blob,
                    filename=file.filename,
                    folder=f"netzeal/videos/{current_user.id}"
                )
            if not upload_result.get('success'):
                raise HTTPException(status_code=500, detail=f"Media upload failed for {file.filename}")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail="Upload failed")

        media_url = upload_result['url']
        media_public_id = upload_result['public_id']
        media_type = 'image' if is_image else ('reel' if is_reel else 'video')

        width = upload_result.get('width')
        height = upload_result.get('height')
        duration = upload_result.get('duration')

        content_type_value = ContentType.REEL if is_reel else (ContentType.VIDEO if is_video else ContentType.POST)

        post = Post(
            author_id=current_user.id,
            title=None,
            content=caption,
            content_type=content_type_value,
            media_urls=[media_url],
            tags=tags_list,
            views_count=0,
            likes_count=0,
            comments_count=0,
            shares_count=0,
            duration_seconds=int(duration) if duration else None,
            thumbnail_url=cloudinary_service.get_thumbnail_url(media_public_id, width=400, height=700) if is_video else None,
            is_published=True,
            published_at=func.now(),
            visibility="public"
        )
        db.add(post)
        db.commit()
        db.refresh(post)

        # Index post in Qdrant for semantic search
        try:
            embedding_service = get_embedding_service()
            if not embedding_service:
                raise RuntimeError("Embedding service unavailable")

            vectors = embedding_service.embed_post(
                post_id=post.id,
                caption=caption,
                hashtags=tags_list
            )
            payload = {
                "caption": caption,
                "tags": tags_list or [],
                "media_type": media_type,
                "author_username": current_user.username,
                "created_at": post.created_at.isoformat()
            }
            qdrant = get_qdrant_service()
            if qdrant:
                qdrant.upsert_post(post.id, current_user.id, vectors, payload)
                print(f"✅ Post indexed in Qdrant: {post.id}")
        except Exception as e:
            print(f"⚠️ Qdrant indexing failed for post {post.id}: {e}")

        # Fan-out in background per post
        try:
            _enqueue_fanout(post.id, current_user.id)
        except Exception as e:
            logger.warning("Failed to enqueue fanout task for post %s: %s", post.id, e)

        try:
            await manager.broadcast_json({"type": "NEW_POST", "post_id": post.id})
        except Exception as e:
            print(f"Broadcast failed for post {post.id}: {e}")

        responses.append(
            InstagramFeedPostResponse(
                id=post.id,
                caption=caption,
                media_url=media_url,
                media_type='video' if media_type == 'video' else ('image' if media_type == 'image' else 'video'),
                type='reel' if is_reel else ('video' if is_video else 'post'),
                width=width,
                height=height,
                duration=duration,
                thumbnail_url=post.thumbnail_url,
                author_id=current_user.id,
                author_username=current_user.username,
                author_full_name=current_user.full_name,
                author_profile_picture=current_user.profile_photo,
                author_is_verified=current_user.is_verified,
                likes_count=0,
                comments_count=0,
                views_count=0,
                is_liked=False,
                is_bookmarked=False,
                tags=tags_list,
                created_at=post.created_at
            )
        )

    return responses


@router.get("/feed", response_model=List[InstagramFeedPostResponse])
async def get_instagram_feed(
    skip: int = Query(0, ge=0, description="Number of posts to skip"),
    limit: int = Query(20, ge=1, le=100, description="Number of posts to return"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get Instagram-like feed
    
    - Returns posts sorted by newest first
    - Includes user info, media URLs, engagement stats
    - Optimized for mobile display
    """
    
    print(f"📰 Feed request from user: {current_user.username} (skip={skip}, limit={limit})")

    cache_key = paged_feed_cache_key(current_user.id, skip, limit)
    cached_feed = await get_cache(cache_key)
    if cached_feed is not None:
        logger.info("Feed cache HIT key=%s user_id=%s", cache_key, current_user.id)
        return cached_feed
    logger.info("Feed cache MISS key=%s user_id=%s", cache_key, current_user.id)

    allowed_author_ids = _get_allowed_author_ids(db, current_user)
    if not allowed_author_ids:
        return []
    
    # Get posts with media (both legacy media_urls and new PostMedia)
    # Include posts that have either media_urls OR PostMedia items
    posts = (
        db.query(Post)
        .options(
            joinedload(Post.author).load_only(
                User.id,
                User.username,
                User.full_name,
                User.profile_photo,
                User.is_verified,
            ),
            selectinload(Post.media_items).load_only(
                PostMedia.id,
                PostMedia.post_id,
                PostMedia.media_type,
                PostMedia.url,
                PostMedia.thumb_url,
                PostMedia.order_index,
                PostMedia.width,
                PostMedia.height,
                PostMedia.duration_seconds,
            ),
            selectinload(Post.likes).load_only(Like.id, Like.post_id),
            selectinload(Post.comments).load_only(Comment.id, Comment.post_id),
        )
        .filter(Post.author_id.in_(allowed_author_ids))
        .filter(
            or_(
                Post.media_urls.isnot(None),
                Post.id.in_(db.query(PostMedia.post_id).distinct())
            )
        )
        .order_by(desc(Post.created_at))
        .offset(skip)
        .limit(limit)
        .all()
    )
    
    print(f"   Found {len(posts)} posts with media")
    for post in posts[:3]:  # Log first 3 posts
        print(f"   - Post {post.id}: {post.content_type.value}, media: {len(post.media_urls) if post.media_urls else 0} URLs")
    
    # Get user's likes and bookmarks for this batch
    post_ids = [post.id for post in posts]
    user_likes = {
        like.post_id 
        for like in db.query(Like).filter(
            Like.user_id == current_user.id,
            Like.post_id.in_(post_ids)
        ).all()
    }
    user_bookmarks = {
        bm.post_id 
        for bm in db.query(Bookmark).filter(
            Bookmark.user_id == current_user.id,
            Bookmark.post_id.in_(post_ids)
        ).all()
    }
    
    # Build feed response
    feed = []
    for post in posts:
        # Check if post has PostMedia items (new carousel system)
        post_media_items = post.media_items or []
        if post_media_items:
            # Use first media item from PostMedia table
            first_media = post_media_items[0]
            media_url = first_media.url
            media_type = 'video' if first_media.media_type == MediaType.VIDEO else 'image'
            width = first_media.width
            height = first_media.height
            duration = first_media.duration_seconds
            thumbnail_url = first_media.thumb_url
        else:
            # Fallback to legacy media_urls
            media_url = post.media_urls[0] if post.media_urls and len(post.media_urls) > 0 else None
            if not media_url:
                continue  # Skip posts without media
            media_type = 'video' if post.content_type in [ContentType.VIDEO, ContentType.REEL] else 'image'
            width = None
            height = None
            duration = None
            thumbnail_url = post.thumbnail_url
        
        feed_post = InstagramFeedPostResponse(
            id=post.id,
            caption=post.content,
            media_url=media_url,
            media_type=media_type,
            type=post.content_type.value,
            width=width,
            height=height,
            duration=duration,
            thumbnail_url=thumbnail_url,
            author_id=post.author_id,
            author_username=post.author.username,
            author_full_name=post.author.full_name,
            author_profile_picture=post.author.profile_photo,
            author_is_verified=post.author.is_verified,
            likes_count=post.likes_count,
            comments_count=post.comments_count,
            views_count=post.views_count,
            is_liked=post.id in user_likes,
            is_bookmarked=post.id in user_bookmarks,
            tags=post.tags,
            created_at=post.created_at
        )
        feed.append(feed_post)

    cache_payload = [item.model_dump() for item in feed]
    await set_cache(cache_key, cache_payload, settings.FEED_CACHE_TTL_SECONDS)

    return feed


@router.get("/multi-feed", response_model=List[MultiMediaPostOut])
async def get_multi_media_feed(
    skip: int = Query(0, ge=0, description="Number of posts to skip"),
    limit: int = Query(20, ge=1, le=50, description="Number of posts to return"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Return feed of posts that have PostMedia carousel items.

    Each post is one entry with ordered media_items. This coexists with legacy /feed.
    """
    allowed_author_ids = _get_allowed_author_ids(db, current_user)
    if not allowed_author_ids:
        return []

    # Query posts that have at least one PostMedia row
    posts = (
        db.query(Post)
        .join(PostMedia, Post.id == PostMedia.post_id)
        .options(
            joinedload(Post.author).load_only(User.id, User.username, User.full_name, User.profile_photo),
            selectinload(Post.media_items).load_only(
                PostMedia.id,
                PostMedia.post_id,
                PostMedia.media_type,
                PostMedia.url,
                PostMedia.thumb_url,
                PostMedia.order_index,
                PostMedia.width,
                PostMedia.height,
                PostMedia.duration_seconds,
            ),
            selectinload(Post.likes).load_only(Like.id, Like.post_id),
            selectinload(Post.comments).load_only(Comment.id, Comment.post_id),
        )
        .filter(Post.author_id.in_(allowed_author_ids))
        .distinct()
        .order_by(desc(Post.created_at))
        .offset(skip)
        .limit(limit)
        .all()
    )

    if not posts:
        return []

    post_ids = [p.id for p in posts]

    # User like & bookmark flags
    user_likes = {like.post_id for like in db.query(Like).filter(Like.user_id == current_user.id, Like.post_id.in_(post_ids)).all()}
    user_bookmarks = {bm.post_id for bm in db.query(Bookmark).filter(Bookmark.user_id == current_user.id, Bookmark.post_id.in_(post_ids)).all()}

    out: List[MultiMediaPostOut] = []
    for post in posts:
        media_items_rows = post.media_items or []
        media_items_out = [PostMediaOut.model_validate(r) for r in media_items_rows]
        out.append(
            MultiMediaPostOut(
                id=post.id,
                author_id=post.author_id,
                title=post.title,
                content=post.content,
                hashtags=None,
                tags=','.join(post.tags) if post.tags else None,
                created_at=post.created_at,
                likes_count=post.likes_count,
                comments_count=post.comments_count,
                views_count=post.views_count,
                media_items=media_items_out,
                author_username=post.author.username if post.author else None,
                author_full_name=post.author.full_name if post.author else None,
                author_profile_picture=post.author.profile_photo if post.author else None,
                is_liked=post.id in user_likes,
                is_bookmarked=post.id in user_bookmarks
            )
        )
    return out


# ============================================================================
# NEW: Draft creation and publish endpoints for fan-out feed
# ============================================================================

@router.post("/posts/draft", response_model=InstagramFeedPostResponse, status_code=201)
async def create_post_draft(
    draft: PostDraftCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _: None = Depends(post_create_rate_limit),
):
    """Create an unpublished draft post (image/video)."""
    if draft.media_type not in {"image", "video"}:
        raise HTTPException(status_code=400, detail="media_type must be 'image' or 'video'")

    content_type_value = ContentType.VIDEO if draft.media_type == "video" else ContentType.POST
    post = Post(
        author_id=current_user.id,
        title=None,
        content=draft.caption,
        content_type=content_type_value,
        media_urls=[draft.media_url],
        tags=None,
        views_count=0,
        is_published=False,
        visibility=draft.visibility or "public"
    )
    db.add(post)
    db.commit()
    db.refresh(post)

    return InstagramFeedPostResponse(
        id=post.id,
        caption=post.content,
        media_url=draft.media_url,
        media_type=draft.media_type,
        type=post.content_type.value,
        author_id=current_user.id,
        author_username=current_user.username,
        author_full_name=current_user.full_name,
        author_profile_picture=current_user.profile_photo,
        author_is_verified=current_user.is_verified,
        likes_count=0,
        comments_count=0,
        views_count=0,
        is_liked=False,
        is_bookmarked=False,
        tags=None,
        created_at=post.created_at,
        published_at=None
    )


@router.post("/posts/{post_id}/publish", response_model=PostPublishResponse)
async def publish_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _: None = Depends(post_create_rate_limit),
):
    """Publish a draft post and fan-out to all user feeds."""
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to publish this post")
    if post.is_published:
        return PostPublishResponse(id=post.id, published_at=post.published_at, message="Already published")

    post.is_published = True
    post.published_at = func.now()
    db.commit()
    db.refresh(post)

    # Index post in Qdrant when draft is published
    try:
        embedding_service = get_embedding_service()
        if not embedding_service:
            raise RuntimeError("Embedding service unavailable")

        vectors = embedding_service.embed_post(
            post_id=post.id,
            caption=post.content or "",
            hashtags=post.tags,
        )
        payload = {
            "caption": post.content or "",
            "tags": post.tags or [],
            "media_type": (post.content_type.value if post.content_type else "post"),
            "author_username": current_user.username,
            "created_at": post.created_at.isoformat() if post.created_at else datetime.utcnow().isoformat(),
            "published_at": post.published_at.isoformat() if getattr(post, "published_at", None) else None,
        }
        qdrant = get_qdrant_service()
        if qdrant:
            qdrant.upsert_post(post.id, current_user.id, vectors, payload)
            print(f"✅ Post indexed in Qdrant: {post.id}")
    except Exception as e:
        print(f"⚠️ Qdrant indexing failed for post {post.id}: {e}")

    # Fan-out in background worker
    try:
        _enqueue_fanout(post.id, current_user.id)
    except Exception as e:
        logger.warning("Failed to enqueue fanout task for published post %s: %s", post.id, e)

    try:
        await manager.broadcast_json({"type": "NEW_POST", "post_id": post.id})
    except Exception as e:
        print(f"⚠️ Publish broadcast failed for post {post.id}: {e}")

    return PostPublishResponse(id=post.id, published_at=post.published_at, message="Published")


@router.get("/feed-cursor", response_model=FeedResponse)
async def get_cursor_feed(
    cursor: Optional[str] = Query(None, description="Pagination cursor from previous response"),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cursor-based feed backed by fan-out table.

    Cursor format: published_at_iso|post_id (e.g., 2025-01-15T12:00:00.123456+00:00_42)
    Returns items ordered by published_at desc, id desc.
    """
    from datetime import datetime

    allowed_author_ids = _get_allowed_author_ids(db, current_user)
    if not allowed_author_ids:
        return FeedResponse(items=[], next_cursor=None)

    cursor_time = None
    cursor_post_id = None
    if cursor:
        try:
            ts, pid = cursor.split("_", 1)
            cursor_time = datetime.fromisoformat(ts)
            cursor_post_id = int(pid)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid cursor format")

    q = db.query(Post).join(FeedItem, FeedItem.post_id == Post.id).options(
        joinedload(Post.author).load_only(
            User.id,
            User.username,
            User.full_name,
            User.profile_photo,
            User.is_verified,
        ),
        selectinload(Post.media_items).load_only(
            PostMedia.id,
            PostMedia.post_id,
            PostMedia.media_type,
            PostMedia.url,
            PostMedia.thumb_url,
            PostMedia.order_index,
            PostMedia.width,
            PostMedia.height,
            PostMedia.duration_seconds,
        ),
        selectinload(Post.likes).load_only(Like.id, Like.post_id),
        selectinload(Post.comments).load_only(Comment.id, Comment.post_id),
    ).filter(
        FeedItem.user_id == current_user.id,
        Post.is_published == True,
        Post.visibility.in_(["public", "private"]),
        Post.author_id.in_(allowed_author_ids)
    )

    if cursor_time and cursor_post_id:
        # (published_at, id) tuple comparison for stable pagination
        q = q.filter(
            or_(
                Post.published_at < cursor_time,
                (Post.published_at == cursor_time) & (Post.id < cursor_post_id)
            )
        )

    q = q.order_by(desc(Post.published_at), desc(Post.id)).limit(limit + 1)  # fetch one extra to decide next_cursor
    rows = q.all()

    # Separate posts; gather IDs for like/bookmark flags
    posts = rows[:limit]
    post_ids = [p.id for p in posts]

    user_likes = {
        like.post_id
        for like in db.query(Like).filter(Like.user_id == current_user.id, Like.post_id.in_(post_ids)).all()
    }
    user_bookmarks = {
        bm.post_id
        for bm in db.query(Bookmark).filter(Bookmark.user_id == current_user.id, Bookmark.post_id.in_(post_ids)).all()
    }

    feed_items = []
    for post in posts:
        # Check if post has PostMedia items (new carousel system)
        post_media_items = post.media_items or []
        if post_media_items:
            # Use first media item from PostMedia table
            first_media = post_media_items[0]
            media_url = first_media.url
            media_type = 'video' if first_media.media_type == MediaType.VIDEO else 'image'
            width = first_media.width
            height = first_media.height
            duration = first_media.duration_seconds
            thumbnail_url = first_media.thumb_url
        else:
            # Fallback to legacy media_urls
            media_url = post.media_urls[0] if post.media_urls else None
            if not media_url:
                continue
            media_type = 'video' if post.content_type in [ContentType.VIDEO, ContentType.REEL] else 'image'
            width = None
            height = None
            duration = None
            thumbnail_url = post.thumbnail_url

        feed_items.append(
            InstagramFeedPostResponse(
                id=post.id,
                caption=post.content,
                media_url=media_url,
                media_type=media_type,
                type=post.content_type.value,
                width=width,
                height=height,
                duration=duration,
                thumbnail_url=thumbnail_url,
                author_id=post.author_id,
                author_username=post.author.username,
                author_full_name=post.author.full_name,
                author_profile_picture=post.author.profile_photo,
                author_is_verified=post.author.is_verified,
                likes_count=post.likes_count,
                comments_count=post.comments_count,
                views_count=post.views_count,
                is_liked=post.id in user_likes,
                is_bookmarked=post.id in user_bookmarks,
                tags=post.tags,
                created_at=post.created_at,
                published_at=post.published_at
            )
        )

    next_cursor = None
    if len(rows) > limit and posts:
        last = posts[-1]
        if last.published_at:
            next_cursor = f"{last.published_at.isoformat()}_{last.id}"

    return FeedResponse(items=feed_items, next_cursor=next_cursor)


# Helpers
def _map_filter_effect(name: Optional[str]):
    if not name:
        return None
    name = name.lower()
    if name == 'grayscale':
        return {'effect': 'grayscale'}
    if name == 'sepia':
        return {'effect': 'sepia'}
    if name.startswith('brightness:'):
        try:
            v = int(name.split(':', 1)[1])
            return {'effect': f'brightness:{v}'}
        except Exception:
            return None
    if name.startswith('contrast:'):
        try:
            v = int(name.split(':', 1)[1])
            return {'effect': f'contrast:{v}'}
        except Exception:
            return None
    return None

# ============================================================================
# LIVE STREAMING ENDPOINTS
# ============================================================================

import secrets

@router.post("/live/start", response_model=LiveSessionResponse)
async def start_live_session(
    data: LiveSessionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _: None = Depends(require_live_streaming_enabled),
):
    """Start a live streaming session (metadata only; streaming handled by external service)."""
    stream_key = secrets.token_hex(16)
    live = LiveSession(
        host_user_id=current_user.id,
        title=data.title,
        description=data.description,
        stream_key=stream_key,
        is_active=1,
        viewer_count=0
    )
    db.add(live)
    db.commit()
    db.refresh(live)
    return live


@router.post("/live/{session_id}/stop", response_model=LiveSessionResponse)
async def stop_live_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _: None = Depends(require_live_streaming_enabled),
):
    live = db.query(LiveSession).filter(LiveSession.id == session_id).first()
    if not live or live.host_user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Live session not found")
    live.is_active = 0
    live.ended_at = func.now()
    db.commit()
    db.refresh(live)
    return live


@router.get("/live/active", response_model=List[LiveSessionResponse])
async def list_active_live_sessions(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: None = Depends(require_live_streaming_enabled),
):
    lives = db.query(LiveSession).filter(LiveSession.is_active == 1).order_by(desc(LiveSession.started_at)).offset(skip).limit(limit).all()
    return lives


@router.post("/live/{session_id}/comment", response_model=LiveCommentResponse)
async def post_live_comment(
    session_id: int,
    data: LiveCommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _: None = Depends(require_live_streaming_enabled),
):
    live = db.query(LiveSession).filter(LiveSession.id == session_id, LiveSession.is_active == 1).first()
    if not live:
        raise HTTPException(status_code=404, detail="Live session not found or inactive")
    comment = LiveComment(
        live_session_id=session_id,
        author_id=current_user.id,
        content=data.content
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    resp = LiveCommentResponse.model_validate(comment).model_dump()
    resp['author_username'] = current_user.username
    return resp


@router.post("/live/{session_id}/viewers")
async def update_viewer_count(
    session_id: int,
    count: int = Form(..., ge=0),
    db: Session = Depends(get_db),
    _: None = Depends(require_live_streaming_enabled),
):
    live = db.query(LiveSession).filter(LiveSession.id == session_id, LiveSession.is_active == 1).first()
    if not live:
        raise HTTPException(status_code=404, detail="Live session not found or inactive")
    live.viewer_count = count
    db.commit()
    return {"session_id": session_id, "viewer_count": live.viewer_count}


# ==================== SEMANTIC SEARCH ENDPOINTS ====================

@router.get("/search/semantic")
async def semantic_search_posts(
    q: str = Query(..., description="Search query text"),
    limit: int = Query(20, ge=1, le=100, description="Max results to return"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _: None = Depends(require_semantic_features_enabled),
):
    """
    Smart post/content search using semantic similarity
    
    - Searches post captions and tags using AI embeddings
    - Returns posts ranked by semantic relevance
    - Much better than keyword search for finding related content
    """
    try:
        embedding_service = get_embedding_service()
        if not embedding_service:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Semantic search is temporarily unavailable. Please try again shortly.",
            )

        # Generate embedding for search query
        query_vector = embedding_service.embed_query(q)
        
        if not query_vector:
            raise HTTPException(status_code=400, detail="Failed to generate query embedding")
        
        # Search Qdrant for similar posts
        qdrant_service = get_qdrant_service()
        if not qdrant_service:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Semantic search is temporarily unavailable. Please try again shortly.",
            )

        search_results = qdrant_service.search_posts(query_vector, limit=limit)
        
        # Retrieve full post details from database
        post_ids = [result.id for result in search_results]
        if not post_ids:
            return {"query": q, "results": [], "count": 0}
        
        posts = db.query(Post).filter(Post.id.in_(post_ids)).all()
        
        # Create lookup for scores
        score_map = {result.id: result.score for result in search_results}
        
        # Build response with scores
        results = []
        for post in posts:
            author = db.query(User).filter(User.id == post.author_id).first()
            results.append({
                "id": post.id,
                "caption": post.content,
                "media_url": post.media_urls[0] if post.media_urls else None,
                "media_type": post.content_type.value,
                "tags": post.tags or [],
                "likes_count": post.likes_count or 0,
                "comments_count": post.comments_count or 0,
                "views_count": post.views_count or 0,
                "created_at": post.created_at.isoformat(),
                "author_id": post.author_id,
                "author_username": author.username if author else None,
                "author_profile_picture": author.profile_photo if author else None,
                "relevance_score": score_map.get(post.id, 0.0)
            })
        
        # Sort by relevance score
        results.sort(key=lambda x: x["relevance_score"], reverse=True)
        
        return {
            "query": q,
            "results": results,
            "count": len(results)
        }
        
    except Exception as e:
        print(f"⚠️ Semantic search error: {e}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@router.get("/posts/{post_id}/similar")
async def find_similar_posts(
    post_id: int,
    limit: int = Query(10, ge=1, le=50, description="Max similar posts to return"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _: None = Depends(require_semantic_features_enabled),
):
    """
    Find posts similar to a given post using AI-powered recommendations
    
    - Analyzes post content, tags, and context
    - Returns semantically similar posts
    - Great for "More like this" features
    """
    try:
        # Get the source post
        post = db.query(Post).filter(Post.id == post_id).first()
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")

        embedding_service = get_embedding_service()
        if not embedding_service:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Similar-post recommendations are temporarily unavailable. Please try again shortly.",
            )
        
        # Generate embedding for the post caption
        query_vector = embedding_service.embed_query(post.content or "")
        
        if not query_vector:
            raise HTTPException(status_code=400, detail="Failed to generate post embedding")
        
        # Search for similar posts (excluding the source post)
        qdrant_service = get_qdrant_service()
        if not qdrant_service:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Similar-post recommendations are temporarily unavailable. Please try again shortly.",
            )

        search_results = qdrant_service.search_posts(query_vector, limit=limit + 1)
        
        # Filter out the source post
        similar_post_ids = [result.id for result in search_results if result.id != post_id][:limit]
        
        if not similar_post_ids:
            return {"post_id": post_id, "similar_posts": [], "count": 0}
        
        # Retrieve full post details
        similar_posts = db.query(Post).filter(Post.id.in_(similar_post_ids)).all()
        
        # Create score lookup
        score_map = {result.id: result.score for result in search_results}
        
        # Build response
        results = []
        for similar_post in similar_posts:
            author = db.query(User).filter(User.id == similar_post.author_id).first()
            results.append({
                "id": similar_post.id,
                "caption": similar_post.content,
                "media_url": similar_post.media_urls[0] if similar_post.media_urls else None,
                "media_type": similar_post.content_type.value,
                "tags": similar_post.tags or [],
                "likes_count": similar_post.likes_count or 0,
                "comments_count": similar_post.comments_count or 0,
                "created_at": similar_post.created_at.isoformat(),
                "author_id": similar_post.author_id,
                "author_username": author.username if author else None,
                "author_profile_picture": author.profile_photo if author else None,
                "similarity_score": score_map.get(similar_post.id, 0.0)
            })
        
        # Sort by similarity
        results.sort(key=lambda x: x["similarity_score"], reverse=True)
        
        return {
            "post_id": post_id,
            "similar_posts": results,
            "count": len(results)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"⚠️ Similar posts error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to find similar posts: {str(e)}")


@router.get("/hashtags/clusters")
async def get_hashtag_clusters(
    limit: int = Query(50, ge=10, le=200, description="Max hashtags to analyze"),
    num_clusters: int = Query(10, ge=3, le=20, description="Number of semantic clusters"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _: None = Depends(require_semantic_features_enabled),
):
    """
    Semantic hashtag clustering using AI
    
    - Groups related hashtags by meaning (not just text similarity)
    - Helps discover trending topics and content themes
    - Example: #AI, #MachineLearning, #DeepLearning clustered together
    """
    try:
        embedding_service = get_embedding_service()
        if not embedding_service:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Hashtag clustering is temporarily unavailable. Please try again shortly.",
            )

        # Get most used hashtags from recent posts
        from collections import Counter
        
        recent_posts = db.query(Post).filter(Post.tags.isnot(None)).order_by(desc(Post.created_at)).limit(500).all()
        
        all_hashtags = []
        for post in recent_posts:
            if post.tags:
                all_hashtags.extend(post.tags)
        
        if not all_hashtags:
            return {"clusters": [], "total_hashtags": 0}
        
        # Get top hashtags by frequency
        hashtag_counts = Counter(all_hashtags)
        top_hashtags = [tag for tag, count in hashtag_counts.most_common(limit)]
        
        # Generate embeddings for each hashtag
        hashtag_embeddings = {}
        for tag in top_hashtags:
            vec = embedding_service.embed_text(tag)
            if vec:
                hashtag_embeddings[tag] = vec
        
        if not hashtag_embeddings:
            return {"clusters": [], "total_hashtags": 0}
        
        # Perform clustering using cosine similarity
        import numpy as np
        from sklearn.cluster import KMeans
        
        tags = list(hashtag_embeddings.keys())
        vectors = np.array(list(hashtag_embeddings.values()))
        
        # Adjust cluster count if fewer hashtags
        actual_clusters = min(num_clusters, len(tags))
        
        kmeans = KMeans(n_clusters=actual_clusters, random_state=42, n_init=10)
        cluster_labels = kmeans.fit_predict(vectors)
        
        # Group hashtags by cluster
        clusters = {}
        for tag, label in zip(tags, cluster_labels):
            label = int(label)
            if label not in clusters:
                clusters[label] = []
            clusters[label].append({
                "hashtag": tag,
                "count": hashtag_counts[tag]
            })
        
        # Format response
        result = []
        for cluster_id, hashtags in clusters.items():
            # Sort by count within cluster
            hashtags.sort(key=lambda x: x["count"], reverse=True)
            result.append({
                "cluster_id": cluster_id,
                "hashtags": hashtags,
                "size": len(hashtags),
                "total_usage": sum(h["count"] for h in hashtags)
            })
        
        # Sort clusters by total usage
        result.sort(key=lambda x: x["total_usage"], reverse=True)
        
        return {
            "clusters": result,
            "total_hashtags": len(tags),
            "num_clusters": actual_clusters
        }
        
    except Exception as e:
        print(f"⚠️ Hashtag clustering error: {e}")
        raise HTTPException(status_code=500, detail=f"Clustering failed: {str(e)}")


# ============================================================================
# MULTI-MEDIA SINGLE POST (Carousel) ENDPOINT
# ============================================================================
@router.post("/upload-multi", response_model=MultiMediaPostOut, status_code=status.HTTP_201_CREATED)
async def upload_multi_media_single_post(
    files: List[UploadFile] = File(..., description="List of image/video/pdf files to upload as one post"),
    caption: str = Form(..., description="Post caption / description"),
    title: Optional[str] = Form(None, description="Optional title (will not duplicate caption)"),
    tags: Optional[str] = Form(None, description="Comma-separated tags"),
    order: Optional[str] = Form(None, description="Comma-separated order indices referencing original file positions"),
    transform_states: Optional[str] = Form(None, description="JSON array of per-file transform state objects (aligned to original file ordering)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload multiple media assets (images/videos/PDF) as ONE post with ordered carousel.

    Implementation details:
    - Validates supported MIME types.
    - Persists a single Post row plus multiple PostMedia rows ordered for a carousel.
    - Leaves legacy `media_urls` NULL to prevent duplicate handling in existing feed endpoints.
    - Returns rich `MultiMediaPostOut` for new frontend carousel renderer.
    """
    if not files:
        raise HTTPException(status_code=400, detail="At least one media file is required")

    # Parse tags
    tags_list = None
    if tags:
        tags_list = [t.strip() for t in tags.split(',') if t.strip()]

    # Determine final ordering
    ordered_indices: List[int] = list(range(len(files)))
    if order:
        try:
            parsed = [int(x.strip()) for x in order.split(',') if x.strip().isdigit()]
            if len(parsed) == len(files) and set(parsed) == set(range(len(files))):
                ordered_indices = parsed
        except Exception:
            pass

    new_post = Post(
        author_id=current_user.id,
        title=title,
        content=caption,
        content_type=ContentType.POST,
        media_urls=None,
        tags=tags_list,
        is_published=True,
        published_at=func.now(),
        visibility="public"
    )
    db.add(new_post)
    db.commit()
    db.refresh(new_post)

    allowed_image_types = {"image/jpeg", "image/png", "image/gif", "image/webp"}
    allowed_video_types = {"video/mp4", "video/quicktime", "video/x-msvideo", "video/mpeg"}
    allowed_pdf_types = {"application/pdf"}

    media_item_outputs: List[PostMediaOut] = []

    # Parse optional transform state array (JSON string -> list[dict]) aligned with original indices
    parsed_transform_states: List[Optional[dict]] = [None] * len(files)
    if transform_states:
        try:
            raw_states = json.loads(transform_states)
            if isinstance(raw_states, list) and len(raw_states) == len(files):
                for i, state in enumerate(raw_states):
                    if isinstance(state, dict):
                        parsed_transform_states[i] = state
        except Exception:
            pass  # Silently ignore malformed transform state payload

    for carousel_position, original_index in enumerate(ordered_indices):
        file = files[original_index]
        content_type = _resolve_upload_mime(file)
        is_image = content_type in allowed_image_types
        is_video = content_type in allowed_video_types
        is_pdf = content_type in allowed_pdf_types
        if not (is_image or is_video or is_pdf):
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {content_type}")
        try:
            blob = await file.read()
            _validate_media_size(blob, is_video=is_video)
        except Exception as e:
            if isinstance(e, HTTPException):
                raise
            raise HTTPException(status_code=500, detail="Error processing upload")
        try:
            if is_image:
                upload_result = await cloudinary_service.upload_image(
                    file_content=blob,
                    filename=file.filename,
                    folder=f"netzeal/posts/{current_user.id}"
                )
            elif is_video:
                upload_result = await cloudinary_service.upload_video(
                    file_content=blob,
                    filename=file.filename,
                    folder=f"netzeal/videos/{current_user.id}"
                )
            else:
                upload_result = await cloudinary_service.upload_raw(
                    file_content=blob,
                    filename=file.filename,
                    folder=f"netzeal/docs/{current_user.id}"
                )
            if not upload_result.get('success'):
                raise HTTPException(status_code=500, detail=f"Media upload failed for {file.filename}")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail="Upload failed")

        url = upload_result['url']
        public_id = upload_result.get('public_id')
        width = upload_result.get('width')
        height = upload_result.get('height')
        duration = upload_result.get('duration')

        media_type_enum = MediaType.IMAGE if is_image else (MediaType.VIDEO if is_video else MediaType.PDF)
        thumb_url = None
        if is_video and public_id:
            thumb_url = cloudinary_service.get_thumbnail_url(public_id, width=400, height=400)

        media_row = PostMedia(
            post_id=new_post.id,
            media_type=media_type_enum,
            url=url,
            thumb_url=thumb_url,
            order_index=carousel_position,
            width=width,
            height=height,
            duration_seconds=int(duration) if duration else None,
            is_reel=False,
            transform_state=parsed_transform_states[original_index]
        )
        db.add(media_row)
        db.commit()
        db.refresh(media_row)
        media_item_outputs.append(PostMediaOut.model_validate(media_row))

    response = MultiMediaPostOut(
        id=new_post.id,
        author_id=current_user.id,
        title=new_post.title,
        content=new_post.content,
        hashtags=None,
        tags=','.join(tags_list) if tags_list else None,
        created_at=new_post.created_at,
        likes_count=new_post.likes_count,
        comments_count=new_post.comments_count,
        views_count=new_post.views_count,
        media_items=media_item_outputs,
        author_username=current_user.username,
        author_full_name=current_user.full_name,
        author_profile_picture=current_user.profile_photo,
        is_liked=False,
        is_bookmarked=False
    )

    try:
        embedding_service = get_embedding_service()
        if not embedding_service:
            raise RuntimeError("Embedding service unavailable")

        vectors = embedding_service.embed_post(
            post_id=new_post.id,
            caption=caption,
            hashtags=tags_list
        )
        payload = {
            "caption": caption,
            "tags": tags_list or [],
            "media_count": len(media_item_outputs),
            "author_username": current_user.username,
            "created_at": new_post.created_at.isoformat()
        }
        qdrant = get_qdrant_service()
        if qdrant:
            qdrant.upsert_post(new_post.id, current_user.id, vectors, payload)
    except Exception:
        pass

    try:
        _enqueue_fanout(new_post.id, current_user.id)
    except Exception as e:
        logger.warning("Failed to enqueue fanout task for multi-media post %s: %s", new_post.id, e)

    try:
        await manager.broadcast_json({"type": "NEW_POST", "post_id": new_post.id})
    except Exception:
        pass

    return response


# ---------------------------------------------------------------------------
# PATCH: Update transform state for a single media item (non-destructive)
# ---------------------------------------------------------------------------
@router.patch("/media/{media_id}/transform-state", response_model=PostMediaOut)
async def update_media_transform_state(
    media_id: int,
    payload: TransformStateUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Persist or update non-destructive editor transform state for a media item.

    Requirements:
    - Caller must own the parent post.
    - Stores full JSON blob (validated client-side) enabling re-edit sessions.
    """
    media = db.query(PostMedia).filter(PostMedia.id == media_id).first()
    if not media:
        raise HTTPException(status_code=404, detail="Media item not found")
    parent_post = db.query(Post).filter(Post.id == media.post_id).first()
    if not parent_post or parent_post.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this media item")

    media.transform_state = payload.transform_state
    db.commit()
    db.refresh(media)
    return PostMediaOut.model_validate(media)


# ============================================================================
# SEARCH ENDPOINTS
# ============================================================================

def _search_content(db: Session, query: str, types: List[ContentType], limit: int):
    results = (
        db.query(Post)
        .filter(
            Post.content_type.in_(types),
            or_(
                Post.content.ilike(f"%{query}%"),
                Post.title.ilike(f"%{query}%")
            )
        )
        .order_by(desc(Post.created_at))
        .limit(limit)
        .all()
    )
    
    out = []
    for post in results:
        p_dict = PostResponse.model_validate(post).model_dump()
        p_dict["author_username"] = post.author.username
        p_dict["author_full_name"] = post.author.full_name
        p_dict["author_photo"] = post.author.profile_photo
        out.append(p_dict)
    return out

@router.get("/search/posts", response_model=List[PostResponse])
async def search_posts_endpoint(
    query: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Search for posts"""
    return _search_content(db, query, [ContentType.POST], limit)

@router.get("/search/reels", response_model=List[PostResponse])
async def search_reels_endpoint(
    query: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Search for reels"""
    return _search_content(db, query, [ContentType.REEL], limit)

@router.get("/search/projects", response_model=List[PostResponse])
async def search_projects_endpoint(
    query: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Search for projects"""
    return _search_content(db, query, [ContentType.PROJECT], limit)

