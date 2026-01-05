"""
Authentication and user management routes
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import timedelta
from typing import List
from pydantic import BaseModel

from ..core.database import get_db
from ..core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    verify_token,
    get_current_user
)
from ..core.config import settings
from ..models.user import User
from ..models.content import Post
from ..models.social import Follow
from ..schemas.user import UserCreate, UserUpdate, UserResponse, UserProfileResponse, Token
from ..core.firebase_admin import verify_firebase_token, initialize_firebase_admin

router = APIRouter(prefix="/auth", tags=["Authentication"])

# Initialize Firebase Admin on module load
try:
    initialize_firebase_admin()
except Exception as e:
    print(f"Warning: Firebase Admin initialization failed: {e}")
    print("Firebase phone authentication will not work until this is fixed.")


class FirebaseTokenRequest(BaseModel):
    """Request body for Firebase token verification"""
    idToken: str


class FirebaseAuthResponse(BaseModel):
    """Response for Firebase authentication"""
    user: UserResponse
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    is_new_user: bool


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user"""
    
    # Check if email exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Check if username exists
    existing_username = db.query(User).filter(User.username == user_data.username).first()
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken"
        )
    
    # Create new user
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        email=user_data.email,
        username=user_data.username,
        full_name=user_data.full_name,
        hashed_password=hashed_password
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return new_user


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """Login and get access token"""
    
    # Find user by username or email
    user = db.query(User).filter(
        (User.username == form_data.username) | (User.email == form_data.username)
    ).first()
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive"
        )
    
    # Create access token and refresh token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=access_token_expires
    )
    
    refresh_token = create_refresh_token(
        data={"sub": str(user.id)}
    )
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60  # in seconds
    }


@router.post("/refresh", response_model=Token)
async def refresh_access_token(
    refresh_token: str,
    db: Session = Depends(get_db)
):
    """
    Refresh access token using refresh token
    Production-ready: Like Instagram, YouTube, Facebook
    """
    try:
        # Verify refresh token
        payload = verify_token(refresh_token, token_type="refresh")
        user_id = payload.get("sub")
        
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
        
        # Verify user still exists and is active
        user = db.query(User).filter(User.id == int(user_id)).first()
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive"
            )
        
        # Create new access token
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        new_access_token = create_access_token(
            data={"sub": str(user.id)},
            expires_delta=access_token_expires
        )
        
        # Optionally create new refresh token (rotate refresh tokens for security)
        new_refresh_token = create_refresh_token(
            data={"sub": str(user.id)}
        )
        
        return {
            "access_token": new_access_token,
            "refresh_token": new_refresh_token,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Refresh token error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate refresh token"
        )


@router.get("/me", response_model=UserProfileResponse)
async def get_current_user_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's profile with statistics"""

    # Count followers and following
    followers_count = (
        db.query(Follow).filter(Follow.following_id == current_user.id).count()
    )
    following_count = (
        db.query(Follow).filter(Follow.follower_id == current_user.id).count()
    )
    # Use direct COUNT to avoid creating a subquery that selects all columns
    posts_count = (
        db.query(func.count(Post.id)).filter(Post.author_id == current_user.id).scalar()
        or 0
    )

    # Build response dict manually to avoid validation issues
    return {
        "id": current_user.id,
        "email": current_user.email,
        "username": current_user.username,
        "full_name": current_user.full_name,
        "bio": current_user.bio,
        "profile_photo": current_user.profile_photo,
        "education": current_user.education,
        "work_experience": current_user.work_experience,
        "skills": current_user.skills,
        "interests": current_user.interests,
        "achievements": current_user.achievements,
        "is_active": current_user.is_active,
        "is_verified": current_user.is_verified,
        "created_at": current_user.created_at,
        "followers_count": followers_count,
        "following_count": following_count,
        "posts_count": posts_count,
    }


@router.put("/me", response_model=UserResponse)
async def update_profile(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update current user's profile"""
    
    update_data = user_update.model_dump(exclude_unset=True)
    
    for field, value in update_data.items():
        setattr(current_user, field, value)
    
    db.commit()
    db.refresh(current_user)
    
    return current_user


@router.get("/users/{user_id}", response_model=UserProfileResponse)
async def get_user_profile(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get any user's public profile"""

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Count followers and following
    followers_count = db.query(Follow).filter(Follow.following_id == user.id).count()
    following_count = db.query(Follow).filter(Follow.follower_id == user.id).count()
    # Use direct COUNT for performance and to avoid selecting all post columns
    posts_count = (
        db.query(func.count(Post.id)).filter(Post.author_id == user.id).scalar() or 0
    )

    return {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "full_name": user.full_name,
        "bio": user.bio,
        "profile_photo": user.profile_photo,
        "education": user.education,
        "work_experience": user.work_experience,
        "skills": user.skills,
        "interests": user.interests,
        "achievements": user.achievements,
        "is_active": user.is_active,
        "is_verified": user.is_verified,
        "created_at": user.created_at,
        "followers_count": followers_count,
        "following_count": following_count,
        "posts_count": posts_count,
    }


@router.post("/verify-firebase-token", response_model=FirebaseAuthResponse)
async def verify_firebase_token_endpoint(
    token_request: FirebaseTokenRequest,
    db: Session = Depends(get_db)
):
    """
    Verify Firebase ID token and authenticate user
    
    This endpoint:
    1. Verifies the Firebase ID token using Firebase Admin SDK
    2. Extracts user information (uid, phone_number)
    3. Checks if user exists in database (by Firebase UID or phone number)
    4. Creates new user if doesn't exist
    5. Returns user data with access/refresh tokens
    """
    try:
        # Verify Firebase token
        firebase_user = verify_firebase_token(token_request.idToken)
        
        firebase_uid = firebase_user['uid']
        phone_number = firebase_user.get('phone_number')
        
        if not phone_number:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Phone number not found in Firebase token"
            )
        
        # Check if user exists by Firebase UID or phone number
        user = db.query(User).filter(
            (User.firebase_uid == firebase_uid) | (User.phone_number == phone_number)
        ).first()
        
        is_new_user = False
        
        if not user:
            # Create new user
            is_new_user = True
            
            # Generate username from phone number (last 10 digits)
            base_username = f"user_{phone_number[-10:]}"
            username = base_username
            counter = 1
            
            # Ensure username is unique
            while db.query(User).filter(User.username == username).first():
                username = f"{base_username}_{counter}"
                counter += 1
            
            user = User(
                firebase_uid=firebase_uid,
                phone_number=phone_number,
                username=username,
                full_name=f"User {phone_number[-4:]}",  # Default name
                email=f"{username}@phone.user",  # Placeholder email
                is_active=True,
                is_verified=True,  # Phone-verified users are verified
            )
            
            db.add(user)
            db.commit()
            db.refresh(user)
            
        else:
            # Update existing user with Firebase UID if missing
            if not user.firebase_uid:
                user.firebase_uid = firebase_uid
                db.commit()
                db.refresh(user)
        
        # Create access and refresh tokens
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": str(user.id)},
            expires_delta=access_token_expires
        )
        
        refresh_token = create_refresh_token(
            data={"sub": str(user.id)}
        )
        
        return {
            "user": user,
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            "is_new_user": is_new_user
        }
        
    except ValueError as e:
        # Token verification failed
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Firebase token verification error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify Firebase token"
        )


@router.get("/notifications")
async def get_notifications(
    skip: int = 0,
    limit: int = 20,
    current_user: User = Depends(get_current_user)
):
    """
    Get user notifications (placeholder endpoint)
    Returns empty list for now - to be implemented with proper notification system
    """
    return []
