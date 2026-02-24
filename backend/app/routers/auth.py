"""
Authentication routes - Email + Password + Google OAuth
Production-ready authentication with Neon DB
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import timedelta
import time
from typing import Optional
import os

# Google OAuth
from google.auth.transport import requests
from google.oauth2 import id_token
from google.auth.exceptions import GoogleAuthError

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
from ..schemas.user import (
    UserCreate,
    UserLogin,
    UserUpdate,
    UserResponse,
    UserProfileResponse,
    Token,
    GoogleAuthRequest,
    GoogleAuthResponse
)

router = APIRouter(prefix="/auth", tags=["Authentication"])

# Google OAuth Configuration (use settings object to ensure proper .env loading)
GOOGLE_CLIENT_ID = settings.GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET = settings.GOOGLE_CLIENT_SECRET
GOOGLE_ALLOWED_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}

if GOOGLE_CLIENT_ID:
    print("✅ Google OAuth configured successfully")
else:
    print("⚠️  Warning: GOOGLE_CLIENT_ID not set. Google OAuth will not work.")


# ==================== EMAIL + PASSWORD AUTHENTICATION ====================

@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """
    Register a new user with email and password
    
    Requirements:
    - Email must be unique
    - Username must be unique
    - Password must be at least 8 characters
    """
    
    # Check if email already exists
    existing_email = db.query(User).filter(User.email == user_data.email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered"
        )
    
    # Check if username already exists
    existing_username = db.query(User).filter(User.username == user_data.username).first()
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already taken"
        )
    
    # Create new user with email auth provider
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        email=user_data.email,
        username=user_data.username,
        full_name=user_data.full_name or user_data.username,
        hashed_password=hashed_password,
        auth_provider="email",
        is_active=True,
        is_verified=True  # Auto-verify email auth (you can add email verification later)
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Create tokens
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(new_user.id)},
        expires_delta=access_token_expires
    )
    
    refresh_token = create_refresh_token(
        data={"sub": str(new_user.id)}
    )
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": new_user
    }


@router.post("/login", response_model=Token)
async def login(user_data: UserLogin, db: Session = Depends(get_db)):
    """
    Login with email and password
    
    Returns: JWT access token, refresh token, and user info
    """
    
    # Find user by email
    user = db.query(User).filter(User.email == user_data.email).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    # Verify password
    if not user.hashed_password or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    # Check if account is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled"
        )
    
    # Create tokens
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
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": user
    }


@router.post("/refresh", response_model=Token)
async def refresh_access_token(
    refresh_token: str,
    db: Session = Depends(get_db)
):
    """
    Refresh access token using refresh token
    
    This endpoint validates the refresh token and issues a new access token.
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
        
        # Optionally rotate refresh token for security
        new_refresh_token = create_refresh_token(
            data={"sub": str(user.id)}
        )
        
        return {
            "access_token": new_access_token,
            "refresh_token": new_refresh_token,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            "user": user
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Refresh token error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate refresh token"
        )


# ==================== GOOGLE OAUTH AUTHENTICATION ====================

@router.post("/google", response_model=GoogleAuthResponse)
async def google_auth(token_request: GoogleAuthRequest, db: Session = Depends(get_db)):
    """
    Authenticate with Google OAuth ID token
    
    Flow:
    1. Frontend gets ID token from Google Sign-In
    2. Frontend sends ID token to this endpoint
    3. We verify the token with Google
    4. Create or find user in database
    5. Return access token and user data
    
    Frontend integration (Android):
    - Use Google Sign-In SDK (native)
    - Get ID token from Google
    - POST to /api/v1/auth/google with {id_token: "..."}
    """
    
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google OAuth not configured"
        )
    
    try:
        # Verify Google ID token
        idinfo = id_token.verify_oauth2_token(
            token_request.id_token,
            requests.Request(),
            GOOGLE_CLIENT_ID
        )
        
        # Extra validation (defense-in-depth)
        token_aud = idinfo.get("aud")
        token_iss = idinfo.get("iss")
        token_exp = idinfo.get("exp")
        token_email_verified = idinfo.get("email_verified")

        if token_aud != GOOGLE_CLIENT_ID:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Google token: audience mismatch"
            )

        if token_iss not in GOOGLE_ALLOWED_ISSUERS:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Google token: issuer mismatch"
            )

        if token_exp and int(token_exp) < int(time.time()):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Google token: token expired"
            )

        if token_email_verified is False:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Google email not verified"
            )

        # Extract user information from token
        google_id = idinfo.get('sub')
        email = idinfo.get('email')
        name = idinfo.get('name', 'Google User')
        picture = idinfo.get('picture')
        
        if not google_id or not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid Google token: missing required fields"
            )
        
        # Check if user exists by provider_id or email
        user = db.query(User).filter(
            (User.provider_id == google_id) | (User.email == email)
        ).first()
        
        is_new_user = False
        
        if not user:
            # Create new user for Google sign-in
            is_new_user = True
            
            # Generate unique username from email
            base_username = email.split('@')[0]
            username = base_username
            counter = 1
            
            # Ensure username is unique
            while db.query(User).filter(User.username == username).first():
                username = f"{base_username}_{counter}"
                counter += 1
            
            user = User(
                email=email,
                username=username,
                full_name=name,
                profile_photo=picture,
                auth_provider="google",
                provider_id=google_id,
                is_active=True,
                is_verified=True  # Google-verified
            )
            
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"✅ Created new Google user: {email}")
        
        else:
            # Update existing user with Google info if needed
            if user.auth_provider == "email" and user.provider_id != google_id:
                # Link Google to existing email account
                user.provider_id = google_id
                user.profile_photo = picture or user.profile_photo
                db.commit()
                db.refresh(user)
                print(f"✅ Linked Google account to existing user: {email}")
        
        # Create tokens
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
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            "user": user,
            "is_new_user": is_new_user
        }
        
    except ValueError as e:
        # Token verification failed
        print(f"❌ Google token verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google token"
        )
    except GoogleAuthError as e:
        print(f"❌ Google auth error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google authentication failed"
        )
    except Exception as e:
        print(f"❌ Unexpected error during Google auth: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication failed"
        )


# ==================== USER PROFILE ENDPOINTS ====================

@router.get("/me", response_model=UserProfileResponse)
async def get_current_user_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get current authenticated user's profile with statistics
    """
    
    # Count followers and following
    followers_count = db.query(Follow).filter(Follow.following_id == current_user.id).count()
    following_count = db.query(Follow).filter(Follow.follower_id == current_user.id).count()
    
    # Count posts
    posts_count = (
        db.query(func.count(Post.id))
        .filter(Post.author_id == current_user.id)
        .scalar() or 0
    )
    
    return {
        "id": current_user.id,
        "email": current_user.email,
        "username": current_user.username,
        "auth_provider": current_user.auth_provider,
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
    """
    Update current user's profile information
    """
    
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
    """
    Get any user's public profile with statistics
    """
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Count followers and following
    followers_count = db.query(Follow).filter(Follow.following_id == user.id).count()
    following_count = db.query(Follow).filter(Follow.follower_id == user.id).count()
    
    # Count posts
    posts_count = (
        db.query(func.count(Post.id))
        .filter(Post.author_id == user.id)
        .scalar() or 0
    )
    
    return {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "auth_provider": user.auth_provider,
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


@router.post("/logout")
async def logout(current_user: User = Depends(get_current_user)):
    """
    Logout endpoint (optional - mainly for frontend to clear tokens)
    
    Frontend should:
    1. Delete stored tokens from secure storage
    2. Clear user data from context
    3. Navigate to login screen
    """
    return {"message": "Logged out successfully"}
