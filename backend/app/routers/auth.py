"""
Authentication routes - Email + Password + Google OAuth
Production-ready authentication with Neon DB
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import timedelta, datetime
import time
from typing import Optional
import hashlib
import secrets

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
from ..core.rate_limit import strict_auth_rate_limit
from ..utils.redis_cache import get_cached_json, set_cached_json, profile_cache_key, invalidate_profile_cache
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
    GoogleAuthResponse,
    RefreshTokenRequest,
    VerifyEmailRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
)
from ..services.email_service import send_auth_email, render_auth_email_template

router = APIRouter(prefix="/auth", tags=["Authentication"])

# Google OAuth Configuration (use settings object to ensure proper .env loading)
GOOGLE_CLIENT_ID = settings.GOOGLE_CLIENT_ID
GOOGLE_ANDROID_CLIENT_ID = settings.GOOGLE_ANDROID_CLIENT_ID
GOOGLE_IOS_CLIENT_ID = settings.GOOGLE_IOS_CLIENT_ID
GOOGLE_CLIENT_SECRET = settings.GOOGLE_CLIENT_SECRET
GOOGLE_ALLOWED_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}
GOOGLE_ALLOWED_AUDIENCES = {
    cid
    for cid in [GOOGLE_CLIENT_ID, GOOGLE_ANDROID_CLIENT_ID, GOOGLE_IOS_CLIENT_ID]
    if cid
}

if GOOGLE_CLIENT_ID:
    print("✅ Google OAuth configured successfully")
else:
    print("⚠️  Warning: GOOGLE_CLIENT_ID not set. Google OAuth will not work.")


def _hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def _generate_raw_token() -> str:
    return secrets.token_urlsafe(32)


def _frontend_base_url() -> str:
    return (settings.FRONTEND_BASE_URL or "https://app.netzeal.com").rstrip("/")


def _set_email_verification_token(user: User) -> str:
    raw = _generate_raw_token()
    user.email_verification_token = _hash_token(raw)
    user.email_verification_expires_at = datetime.utcnow() + timedelta(
        minutes=settings.EMAIL_VERIFICATION_TOKEN_EXPIRE_MINUTES
    )
    return raw


def _set_password_reset_token(user: User) -> str:
    raw = _generate_raw_token()
    user.password_reset_token = _hash_token(raw)
    user.password_reset_expires_at = datetime.utcnow() + timedelta(
        minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES
    )
    return raw


def _send_verification_email(user: User, raw_token: str) -> None:
    verify_url = f"{_frontend_base_url()}/verify-email?token={raw_token}"
    html = render_auth_email_template(
        title="Verify your email",
        body="Confirm your email address to activate your account.",
        action_text="Verify Email",
        action_url=verify_url,
        expiry_minutes=settings.EMAIL_VERIFICATION_TOKEN_EXPIRE_MINUTES,
    )
    send_auth_email(user.email, "Verify your NetZeal email", html)


def _send_password_reset_email(user: User, raw_token: str) -> None:
    reset_url = f"{_frontend_base_url()}/reset-password?token={raw_token}"
    html = render_auth_email_template(
        title="Reset your password",
        body="Use this secure link to set a new password.",
        action_text="Reset Password",
        action_url=reset_url,
        expiry_minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES,
    )
    send_auth_email(user.email, "Reset your NetZeal password", html)


# ==================== EMAIL + PASSWORD AUTHENTICATION ====================

@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    _: None = Depends(strict_auth_rate_limit),
):
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
        if existing_email.auth_provider == "google" and not existing_email.hashed_password:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email is registered with Google sign-in"
            )
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
        is_verified=False,
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    verification_token = _set_email_verification_token(new_user)
    db.commit()
    _send_verification_email(new_user, verification_token)
    
    # Create tokens
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(new_user.id)},
        expires_delta=access_token_expires
    )
    
    refresh_token = create_refresh_token(
        data={"sub": str(new_user.id)},
        token_version=new_user.refresh_token_version,
    )
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": new_user
    }


@router.post("/login", response_model=Token)
async def login(
    user_data: UserLogin,
    db: Session = Depends(get_db),
    _: None = Depends(strict_auth_rate_limit),
):
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
    if user.auth_provider == "google" and not user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This account uses Google sign-in"
        )

    if not user.hashed_password or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    if user.auth_provider == "email" and not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified"
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
        data={"sub": str(user.id)},
        token_version=user.refresh_token_version,
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
    token_request: Optional[RefreshTokenRequest] = Body(default=None),
    refresh_token: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    _: None = Depends(strict_auth_rate_limit),
):
    """
    Refresh access token using refresh token
    
    This endpoint validates the refresh token and issues a new access token.
    """
    resolved_refresh_token = token_request.refresh_token if token_request else refresh_token
    if not resolved_refresh_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="refresh_token is required"
        )

    try:
        # Verify refresh token
        payload = verify_token(resolved_refresh_token, token_type="refresh")
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

        token_version = int(payload.get("rv", 0))
        if token_version != int(user.refresh_token_version or 0):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token has been invalidated"
            )
        
        # Create new access token
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        new_access_token = create_access_token(
            data={"sub": str(user.id)},
            expires_delta=access_token_expires
        )
        
        # Optionally rotate refresh token for security
        new_refresh_token = create_refresh_token(
            data={"sub": str(user.id)},
            token_version=user.refresh_token_version,
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
async def google_auth(
    token_request: GoogleAuthRequest,
    db: Session = Depends(get_db),
    _: None = Depends(strict_auth_rate_limit),
):
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
    
    if not GOOGLE_ALLOWED_AUDIENCES:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google OAuth not configured"
        )
    
    try:
        # Verify Google ID token
        idinfo = id_token.verify_oauth2_token(
            token_request.id_token,
            requests.Request(),
            None
        )
        
        # Extra validation (defense-in-depth)
        token_aud = idinfo.get("aud")
        token_iss = idinfo.get("iss")
        token_exp = idinfo.get("exp")
        token_email_verified = idinfo.get("email_verified")

        if token_aud not in GOOGLE_ALLOWED_AUDIENCES:
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
        
        user_by_provider = db.query(User).filter(User.provider_id == google_id).first()
        user_by_email = db.query(User).filter(User.email == email).first()

        if user_by_provider and user_by_provider.email != email:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Google account is already linked to a different email"
            )

        if user_by_provider and user_by_email and user_by_provider.id != user_by_email.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Authentication account conflict detected"
            )

        user = user_by_provider or user_by_email
        
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
            if user.auth_provider == "google" and user.provider_id and user.provider_id != google_id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Google account conflict detected"
                )

            if user.auth_provider == "email":
                if user.provider_id and user.provider_id != google_id:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="Email account is linked to a different Google account"
                    )
                user.provider_id = google_id
                user.profile_photo = picture or user.profile_photo
                user.is_verified = True
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
            data={"sub": str(user.id)},
            token_version=user.refresh_token_version,
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


@router.post("/send-verification-email")
async def send_verification_email(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _: None = Depends(strict_auth_rate_limit),
):
    if current_user.auth_provider != "email":
        return {"message": "Email verification is not required for this account"}

    if current_user.is_verified:
        return {"message": "Email already verified"}

    raw_token = _set_email_verification_token(current_user)
    db.commit()
    _send_verification_email(current_user, raw_token)
    return {"message": "Verification email sent"}


@router.post("/verify-email")
async def verify_email(
    request_data: VerifyEmailRequest,
    db: Session = Depends(get_db),
    _: None = Depends(strict_auth_rate_limit),
):
    token_hash = _hash_token(request_data.token)
    user = db.query(User).filter(User.email_verification_token == token_hash).first()

    if not user or not user.email_verification_expires_at or user.email_verification_expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token"
        )

    user.is_verified = True
    user.email_verification_token = None
    user.email_verification_expires_at = None
    db.commit()

    return {"message": "Email verified successfully"}


@router.post("/forgot-password")
async def forgot_password(
    request_data: ForgotPasswordRequest,
    db: Session = Depends(get_db),
    _: None = Depends(strict_auth_rate_limit),
):
    user = db.query(User).filter(User.email == request_data.email).first()

    if user and user.is_active and (user.auth_provider != "google" or user.hashed_password):
        raw_token = _set_password_reset_token(user)
        db.commit()
        _send_password_reset_email(user, raw_token)

    return {"message": "If the email exists, a password reset link has been sent"}


@router.post("/reset-password")
async def reset_password(
    request_data: ResetPasswordRequest,
    db: Session = Depends(get_db),
    _: None = Depends(strict_auth_rate_limit),
):
    token_hash = _hash_token(request_data.token)
    user = db.query(User).filter(User.password_reset_token == token_hash).first()

    if not user or not user.password_reset_expires_at or user.password_reset_expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )

    user.hashed_password = get_password_hash(request_data.new_password)
    user.password_reset_token = None
    user.password_reset_expires_at = None
    user.refresh_token_version = int(user.refresh_token_version or 0) + 1
    db.commit()

    return {"message": "Password reset successfully"}


# ==================== USER PROFILE ENDPOINTS ====================

@router.get("/me", response_model=UserProfileResponse)
async def get_current_user_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get current authenticated user's profile with statistics
    """
    
    cached = await get_cached_json(profile_cache_key(current_user.id))
    if cached is not None:
        return cached

    counts_row = db.query(
        db.query(func.count(Follow.id)).filter(Follow.following_id == current_user.id).scalar_subquery().label("followers_count"),
        db.query(func.count(Follow.id)).filter(Follow.follower_id == current_user.id).scalar_subquery().label("following_count"),
        db.query(func.count(Post.id)).filter(Post.author_id == current_user.id).scalar_subquery().label("posts_count"),
    ).first()

    followers_count = counts_row.followers_count or 0
    following_count = counts_row.following_count or 0
    posts_count = counts_row.posts_count or 0
    
    profile_payload = {
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

    await set_cached_json(
        profile_cache_key(current_user.id),
        profile_payload,
        settings.PROFILE_CACHE_TTL_SECONDS,
    )

    return profile_payload


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

    await invalidate_profile_cache([current_user.id])
    
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
    
    cached = await get_cached_json(profile_cache_key(user_id))
    if cached is not None:
        return cached

    row = db.query(
        User,
        db.query(func.count(Follow.id)).filter(Follow.following_id == User.id).correlate(User).scalar_subquery().label("followers_count"),
        db.query(func.count(Follow.id)).filter(Follow.follower_id == User.id).correlate(User).scalar_subquery().label("following_count"),
        db.query(func.count(Post.id)).filter(Post.author_id == User.id).correlate(User).scalar_subquery().label("posts_count"),
    ).filter(User.id == user_id).first()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    user = row[0]
    followers_count = row.followers_count or 0
    following_count = row.following_count or 0
    posts_count = row.posts_count or 0
    
    profile_payload = {
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

    await set_cached_json(
        profile_cache_key(user_id),
        profile_payload,
        settings.PROFILE_CACHE_TTL_SECONDS,
    )

    return profile_payload


@router.post("/logout")
async def logout(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Logout endpoint (optional - mainly for frontend to clear tokens)
    
    Frontend should:
    1. Delete stored tokens from secure storage
    2. Clear user data from context
    3. Navigate to login screen
    """
    current_user.refresh_token_version = int(current_user.refresh_token_version or 0) + 1
    db.commit()
    return {"message": "Logged out successfully"}
