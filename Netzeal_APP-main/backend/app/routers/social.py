"""
Social networking routes (follow, networking)
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List

from ..core.database import get_db
from ..core.security import get_current_user
from ..models import User, Follow, Post
from ..schemas.user import UserResponse
from ..services.embedding_service import EmbeddingService
from ..services.qdrant_service import QdrantService

router = APIRouter(prefix="/social", tags=["Social Networking"])

# Initialize services for AI-powered matching
embedding_service = EmbeddingService()
qdrant_service = QdrantService()


@router.post("/follow/{user_id}")
async def follow_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
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
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Already following this user"
        )
    
    # Create follow relationship
    new_follow = Follow(
        follower_id=current_user.id,
        following_id=user_id
    )
    
    db.add(new_follow)
    db.commit()
    
    return {"message": f"Successfully followed {user_to_follow.username}"}


@router.delete("/unfollow/{user_id}")
async def unfollow_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Unfollow a user"""
    
    follow = db.query(Follow).filter(
        Follow.follower_id == current_user.id,
        Follow.following_id == user_id
    ).first()
    
    if not follow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not following this user"
        )
    
    db.delete(follow)
    db.commit()
    
    return {"message": "Successfully unfollowed user"}


@router.get("/followers", response_model=List[UserResponse])
async def get_followers(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get list of users following the current user"""
    
    follows = db.query(Follow).filter(
        Follow.following_id == current_user.id
    ).offset(skip).limit(limit).all()
    
    follower_ids = [f.follower_id for f in follows]
    followers = db.query(User).filter(User.id.in_(follower_ids)).all()
    
    return followers


@router.get("/following", response_model=List[UserResponse])
async def get_following(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get list of users the current user is following"""
    
    follows = db.query(Follow).filter(
        Follow.follower_id == current_user.id
    ).offset(skip).limit(limit).all()
    
    following_ids = [f.following_id for f in follows]
    following = db.query(User).filter(User.id.in_(following_ids)).all()
    
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
    
    follows = db.query(Follow).filter(
        Follow.following_id == user_id
    ).offset(skip).limit(limit).all()
    
    follower_ids = [f.follower_id for f in follows]
    followers = db.query(User).filter(User.id.in_(follower_ids)).all()
    
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
    
    follows = db.query(Follow).filter(
        Follow.follower_id == user_id
    ).offset(skip).limit(limit).all()
    
    following_ids = [f.following_id for f in follows]
    following = db.query(User).filter(User.id.in_(following_ids)).all()
    
    return following


@router.get("/is-following/{user_id}")
async def check_if_following(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Check if current user is following a specific user"""
    
    is_following = db.query(Follow).filter(
        Follow.follower_id == current_user.id,
        Follow.following_id == user_id
    ).first() is not None
    
    return {"is_following": is_following}


@router.get("/users/match")
async def ai_powered_user_matching(
    limit: int = Query(10, ge=1, le=50, description="Max users to return"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    AI-powered user matching and recommendations
    
    - Analyzes your interests, skills, and post content
    - Finds users with similar profiles using semantic embeddings
    - Great for discovering like-minded people and potential collaborators
    - Excludes users you already follow
    """
    try:
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
        search_results = qdrant_service.search_posts(user_embedding, limit=limit * 5)
        
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

