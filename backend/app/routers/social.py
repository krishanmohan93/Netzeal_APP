"""
Social networking routes (follow, networking)
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, text
from sqlalchemy.exc import IntegrityError
from typing import List

from ..core.database import get_db
from ..core.security import get_current_user
from ..core.rate_limit import engagement_rate_limit
from ..core.feature_gates import require_semantic_features_enabled
from ..utils.redis_cache import invalidate_profile_cache, invalidate_all_feeds
from ..models import User, Follow, Post, Connection
from ..schemas.user import UserResponse
from ..services.embedding_service import EmbeddingService
from ..services.qdrant_service import QdrantService
from ..services.notification_service import create_notification
from ..services.recommendation_service import recommendation_service

router = APIRouter(prefix="/social", tags=["Social Networking"])

# Lazy initialization of services for AI-powered matching
_embedding_service = None
_embedding_init_attempted = False
_qdrant_service = None
_qdrant_init_attempted = False


def _seed_feed_for_new_follow(db: Session, follower_id: int, following_id: int, limit: int = 50) -> int:
    """Backfill recent published posts from followed user into follower feed."""
    if not follower_id or not following_id:
        return 0

    seed_query = text(
        """
        INSERT INTO feed_items (user_id, post_id)
        SELECT :follower_id, p.id
        FROM posts p
        LEFT JOIN feed_items fi
          ON fi.user_id = :follower_id AND fi.post_id = p.id
        WHERE p.author_id = :following_id
          AND p.is_published = true
          AND fi.id IS NULL
        ORDER BY COALESCE(p.published_at, p.created_at) DESC
        LIMIT :seed_limit
        """
    )
    result = db.execute(
        seed_query,
        {
            "follower_id": follower_id,
            "following_id": following_id,
            "seed_limit": max(1, min(limit, 200)),
        },
    )
    return int(result.rowcount or 0)


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
        return _embedding_service
    except Exception as e:
        print(f"⚠️ Embedding initialization failed in social router: {e}")
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
        return _qdrant_service
    except Exception as e:
        print(f"⚠️ Qdrant initialization failed in social router: {e}")
        return None


def _connection_followers_ids(db: Session, target: User) -> set[int]:
    if not target.public_id:
        return set()
    follower_public_ids = {
        row[0]
        for row in db.query(Connection.follower_id).filter(
            Connection.following_id == target.public_id,
            Connection.status == "connected",
        ).all()
        if row and row[0]
    }
    if not follower_public_ids:
        return set()
    return {
        row[0]
        for row in db.query(User.id).filter(User.public_id.in_(follower_public_ids)).all()
        if row and row[0]
    }


def _connection_following_ids(db: Session, source: User) -> set[int]:
    if not source.public_id:
        return set()
    following_public_ids = {
        row[0]
        for row in db.query(Connection.following_id).filter(
            Connection.follower_id == source.public_id,
            Connection.status == "connected",
        ).all()
        if row and row[0]
    }
    if not following_public_ids:
        return set()
    return {
        row[0]
        for row in db.query(User.id).filter(User.public_id.in_(following_public_ids)).all()
        if row and row[0]
    }


def _ensure_connection_sync(db: Session, follower: User, following: User) -> None:
    if not follower.public_id or not following.public_id:
        return
    existing_connection = db.query(Connection).filter(
        Connection.follower_id == follower.public_id,
        Connection.following_id == following.public_id,
    ).first()
    if not existing_connection:
        db.add(
            Connection(
                follower_id=follower.public_id,
                following_id=following.public_id,
                status="connected",
            )
        )


def _remove_connection_sync(db: Session, follower: User, following: User) -> None:
    if not follower.public_id or not following.public_id:
        return
    existing_connection = db.query(Connection).filter(
        Connection.follower_id == follower.public_id,
        Connection.following_id == following.public_id,
    ).first()
    if existing_connection:
        db.delete(existing_connection)


@router.post("/follow/{user_id}")
async def follow_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _: None = Depends(engagement_rate_limit),
):
    """Follow a user"""
    
    # Check if trying to follow self
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot follow yourself"
        )
    
    # Check if user exists
    user_to_follow = db.query(User).filter(User.id == user_id).first()
    if not user_to_follow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check if already following
    existing_follow = db.query(Follow).filter(
        Follow.follower_id == current_user.id,
        Follow.following_id == user_id
    ).first()
    
    if existing_follow:
        # Keep UUID graph in sync for feed/profile/chat-v2 paths.
        _ensure_connection_sync(db, current_user, user_to_follow)
        _seed_feed_for_new_follow(db, current_user.id, user_id)
        db.commit()
        await invalidate_profile_cache([current_user.id, user_id])
        await invalidate_all_feeds([current_user.id])
        return {"message": f"Successfully followed {user_to_follow.username}"}
    
    # Create follow relationship
    new_follow = Follow(
        follower_id=current_user.id,
        following_id=user_id
    )
    
    db.add(new_follow)
    _ensure_connection_sync(db, current_user, user_to_follow)
    _seed_feed_for_new_follow(db, current_user.id, user_id)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
    else:
        await create_notification(
            db=db,
            recipient_id=user_to_follow.id,
            sender_id=current_user.id,
            type="follow",
            text=f"{current_user.username} followed you",
            entity_id=current_user.id,
        )

    await invalidate_profile_cache([current_user.id, user_id])
    await invalidate_all_feeds([current_user.id])
    
    return {"message": f"Successfully followed {user_to_follow.username}"}


@router.delete("/unfollow/{user_id}")
async def unfollow_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _: None = Depends(engagement_rate_limit),
):
    """Unfollow a user"""
    
    user_to_unfollow = db.query(User).filter(User.id == user_id).first()
    if not user_to_unfollow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    follow = db.query(Follow).filter(
        Follow.follower_id == current_user.id,
        Follow.following_id == user_id
    ).first()
    
    if follow:
        db.delete(follow)

    _remove_connection_sync(db, current_user, user_to_unfollow)
    db.commit()

    await invalidate_profile_cache([current_user.id, user_id])
    
    return {"message": "Successfully unfollowed user"}


@router.get("/followers", response_model=List[UserResponse])
async def get_followers(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get list of users following the current user"""
    
    follower_ids = {
        row[0]
        for row in db.query(Follow.follower_id).filter(
            Follow.following_id == current_user.id
        ).all()
        if row and row[0]
    }
    follower_ids.update(_connection_followers_ids(db, current_user))

    if not follower_ids:
        return []

    followers = (
        db.query(User)
        .filter(User.id.in_(list(follower_ids)))
        .offset(skip)
        .limit(limit)
        .all()
    )
    
    return followers


@router.get("/following", response_model=List[UserResponse])
async def get_following(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get list of users the current user is following"""
    
    following_ids = {
        row[0]
        for row in db.query(Follow.following_id).filter(
            Follow.follower_id == current_user.id
        ).all()
        if row and row[0]
    }
    following_ids.update(_connection_following_ids(db, current_user))

    if not following_ids:
        return []

    following = (
        db.query(User)
        .filter(User.id.in_(list(following_ids)))
        .offset(skip)
        .limit(limit)
        .all()
    )
    
    return following


@router.get("/users/{user_id}/followers", response_model=List[UserResponse])
async def get_user_followers(
    user_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get followers of a specific user"""
    
    # Check if user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    follower_ids = {
        row[0]
        for row in db.query(Follow.follower_id).filter(
            Follow.following_id == user_id
        ).all()
        if row and row[0]
    }
    follower_ids.update(_connection_followers_ids(db, user))

    if not follower_ids:
        return []

    followers = (
        db.query(User)
        .filter(User.id.in_(list(follower_ids)))
        .offset(skip)
        .limit(limit)
        .all()
    )
    
    return followers


@router.get("/users/{user_id}/following", response_model=List[UserResponse])
async def get_user_following(
    user_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get users that a specific user is following"""
    
    # Check if user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    following_ids = {
        row[0]
        for row in db.query(Follow.following_id).filter(
            Follow.follower_id == user_id
        ).all()
        if row and row[0]
    }
    following_ids.update(_connection_following_ids(db, user))

    if not following_ids:
        return []

    following = (
        db.query(User)
        .filter(User.id.in_(list(following_ids)))
        .offset(skip)
        .limit(limit)
        .all()
    )
    
    return following


@router.get("/is-following/{user_id}")
async def check_if_following(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Check if current user is following a specific user"""
    
    follow_row = db.query(Follow).filter(
        Follow.follower_id == current_user.id,
        Follow.following_id == user_id
    ).first()
    is_following = follow_row is not None

    if not is_following and current_user.public_id:
        target_user = db.query(User).filter(User.id == user_id).first()
        if target_user and target_user.public_id:
            is_following = db.query(Connection).filter(
                Connection.follower_id == current_user.public_id,
                Connection.following_id == target_user.public_id,
                Connection.status == "connected",
            ).first() is not None
    
    return {"is_following": is_following}


@router.get("/suggestions")
async def get_follow_suggestions(
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Suggested users to follow based on profile + interactions + mutual graph."""
    suggestions = await recommendation_service.recommend_users_to_follow(
        db=db,
        user_id=current_user.id,
        limit=limit,
    )
    return suggestions


@router.get("/users/match")
async def ai_powered_user_matching(
    limit: int = Query(10, ge=1, le=50, description="Max users to return"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _: None = Depends(require_semantic_features_enabled),
):
    """
    AI-powered user matching and recommendations
    
    - Analyzes your interests, skills, and post content
    - Finds users with similar profiles using semantic embeddings
    - Great for discovering like-minded people and potential collaborators
    - Excludes users you already follow
    """
    try:
        embedding_service = get_embedding_service()
        if not embedding_service:
            raise HTTPException(status_code=503, detail="AI user matching is temporarily unavailable")

        # Build user profile text from interests, skills, and recent posts
        profile_parts = []
        
        if current_user.interests:
            profile_parts.append(" ".join(current_user.interests))
        
        if current_user.skills:
            profile_parts.append(" ".join(current_user.skills))
        
        # Add recent post captions to profile
        recent_posts = db.query(Post).filter(
            Post.author_id == current_user.id
        ).order_by(desc(Post.created_at)).limit(10).all()
        
        for post in recent_posts:
            if post.content:
                profile_parts.append(post.content[:200])  # First 200 chars
        
        if not profile_parts:
            # No profile data, return popular users
            popular_users = db.query(User).filter(
                User.id != current_user.id
            ).order_by(desc(User.id)).limit(limit).all()
            
            return {
                "message": "Complete your profile for better matches",
                "users": [
                    {
                        "id": u.id,
                        "username": u.username,
                        "full_name": u.full_name,
                        "profile_photo": u.profile_photo,
                        "bio": u.bio,
                        "interests": u.interests or [],
                        "skills": u.skills or [],
                        "match_score": 0.0
                    }
                    for u in popular_users
                ],
                "count": len(popular_users)
            }
        
        # Generate user profile embedding
        user_profile_text = " ".join(profile_parts)
        user_embedding = embedding_service.embed_query(user_profile_text)
        
        if not user_embedding:
            raise HTTPException(status_code=500, detail="Failed to generate user profile embedding")
        
        # Search for posts by other users with similar content
        qdrant = get_qdrant_service()
        if not qdrant:
            raise HTTPException(status_code=503, detail="AI user matching is temporarily unavailable")
        
        search_results = qdrant.search_posts(user_embedding, limit=limit * 5)
        
        # Extract unique author IDs (excluding current user)
        candidate_user_ids = set()
        for result in search_results:
            if result.payload.get("user_id") != current_user.id:
                candidate_user_ids.add(result.payload.get("user_id"))
        
        if not candidate_user_ids:
            return {"users": [], "count": 0}
        
        # Get users already followed
        following = db.query(Follow).filter(
            Follow.follower_id == current_user.id
        ).all()
        following_ids = {f.following_id for f in following}
        
        # Filter out followed users
        candidate_user_ids = candidate_user_ids - following_ids
        
        if not candidate_user_ids:
            return {"message": "You're already following similar users!", "users": [], "count": 0}
        
        # Calculate match scores for each candidate
        candidate_users = db.query(User).filter(User.id.in_(candidate_user_ids)).all()
        
        user_matches = []
        for candidate in candidate_users:
            # Build candidate profile
            candidate_parts = []
            if candidate.interests:
                candidate_parts.append(" ".join(candidate.interests))
            if candidate.skills:
                candidate_parts.append(" ".join(candidate.skills))
            
            if not candidate_parts:
                continue
            
            candidate_text = " ".join(candidate_parts)
            candidate_embedding = embedding_service.embed_query(candidate_text)
            
            if not candidate_embedding:
                continue
            
            # Calculate cosine similarity
            import numpy as np
            user_vec = np.array(user_embedding)
            candidate_vec = np.array(candidate_embedding)
            
            if len(user_vec) == len(candidate_vec):
                similarity = float(np.dot(user_vec, candidate_vec))
                
                user_matches.append({
                    "id": candidate.id,
                    "username": candidate.username,
                    "full_name": candidate.full_name,
                    "profile_photo": candidate.profile_photo,
                    "bio": candidate.bio,
                    "interests": candidate.interests or [],
                    "skills": candidate.skills or [],
                    "match_score": round(similarity, 3)
                })
        
        # Sort by match score
        user_matches.sort(key=lambda x: x["match_score"], reverse=True)
        
        # Return top matches
        top_matches = user_matches[:limit]
        
        return {
            "users": top_matches,
            "count": len(top_matches),
            "based_on": {
                "interests": current_user.interests or [],
                "skills": current_user.skills or [],
                "recent_posts": len(recent_posts)
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"⚠️ User matching error: {e}")
        raise HTTPException(status_code=500, detail=f"User matching failed: {str(e)}")

