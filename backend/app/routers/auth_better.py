"""
Better Auth Integration Router
Uses Neon DB's Better Auth for serverless authentication

Better Auth handles:
- User registration and login
- Email verification
- Password reset
- OAuth providers (Google, GitHub, etc.)
- Session management
- Multi-factor authentication

This router acts as a proxy/wrapper for Better Auth endpoints
and provides additional user data enrichment.
"""

from fastapi import APIRouter, HTTPException, Depends, Request, Cookie
from fastapi.responses import JSONResponse
import httpx
import os
from datetime import datetime
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr

from app.core.database import get_db
from app.models.user import User
from app.schemas.user import UserResponse, UserProfile
from app.core.config import settings

router = APIRouter(prefix="/auth", tags=["authentication"])

# Better Auth endpoints
BETTER_AUTH_URL = os.getenv("BETTER_AUTH_URL")
BETTER_AUTH_SECRET = os.getenv("BETTER_AUTH_SECRET")

if not BETTER_AUTH_URL:
    raise ValueError("BETTER_AUTH_URL environment variable is required")


class BetterAuthError(Exception):
    """Better Auth specific errors"""
    pass


async def verify_better_auth_token(token: str) -> dict:
    """
    Verify token with Better Auth JWKS endpoint
    
    Args:
        token: JWT token from Better Auth
        
    Returns:
        Decoded token data with user info
    """
    try:
        async with httpx.AsyncClient() as client:
            # Better Auth validates tokens via JWKS
            response = await client.post(
                f"{BETTER_AUTH_URL}/verify",
                headers={"Authorization": f"Bearer {token}"},
                timeout=10
            )
            
            if response.status_code != 200:
                raise BetterAuthError("Token verification failed")
                
            return response.json()
    except Exception as e:
        raise BetterAuthError(f"Token verification error: {str(e)}")


async def get_better_auth_user(
    request: Request, 
    db: Session = Depends(get_db)
) -> User:
    """
    Get current user from Better Auth session
    
    Args:
        request: FastAPI request
        db: Database session
        
    Returns:
        Current user from database
        
    Raises:
        HTTPException: If user not authenticated
    """
    # Try to get token from Authorization header
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = auth_header[7:]  # Remove "Bearer "
    
    try:
        token_data = await verify_better_auth_token(token)
        email = token_data.get("email")
        
        if not email:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = db.query(User).filter(User.email == email).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        return user
    except BetterAuthError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ============================================================================
# PUBLIC ENDPOINTS
# ============================================================================

@router.post("/register")
async def register(request: Request, db: Session = Depends(get_db)):
    """
    Register endpoint - Better Auth handles registration
    
    This endpoint receives registration data and forwards to Better Auth.
    Better Auth creates user in its database and returns session token.
    
    Request body:
    {
        "email": "user@example.com",
        "password": "secure_password",
        "name": "User Name"
    }
    
    Returns:
    {
        "status": "success",
        "token": "jwt_token",
        "user": {
            "id": "user_id",
            "email": "user@example.com",
            "name": "User Name"
        }
    }
    """
    try:
        body = await request.json()
        
        async with httpx.AsyncClient() as client:
            # Forward to Better Auth registration endpoint
            response = await client.post(
                f"{BETTER_AUTH_URL}/sign-up/email",
                json={
                    "email": body.get("email"),
                    "password": body.get("password"),
                    "name": body.get("name", "")
                },
                headers={"x-better-auth-secret": BETTER_AUTH_SECRET},
                timeout=10
            )
            
            if response.status_code not in [200, 201]:
                error_data = response.json()
                raise HTTPException(
                    status_code=response.status_code,
                    detail=error_data.get("message", "Registration failed")
                )
            
            result = response.json()
            
            # Also create/update user in our database for additional data
            email = body.get("email")
            existing_user = db.query(User).filter(User.email == email).first()
            
            if not existing_user:
                user = User(
                    email=email,
                    username=body.get("name", email.split("@")[0]),
                    auth_provider="better_auth",
                    provider_id=result.get("user", {}).get("id"),
                    created_at=datetime.utcnow()
                )
                db.add(user)
                db.commit()
                db.refresh(user)
            
            return {
                "status": "success",
                "message": "Registration successful",
                "token": result.get("token"),
                "user": result.get("user")
            }
            
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail="Auth service unavailable")
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid authentication request")


@router.post("/login")
async def login(request: Request, db: Session = Depends(get_db)):
    """
    Login endpoint - Better Auth handles authentication
    
    Request body:
    {
        "email": "user@example.com",
        "password": "secure_password"
    }
    
    Returns:
    {
        "status": "success",
        "token": "jwt_token",
        "user": {
            "id": "user_id",
            "email": "user@example.com",
            "name": "User Name"
        }
    }
    """
    try:
        body = await request.json()
        
        async with httpx.AsyncClient() as client:
            # Forward to Better Auth login endpoint
            response = await client.post(
                f"{BETTER_AUTH_URL}/sign-in/email",
                json={
                    "email": body.get("email"),
                    "password": body.get("password")
                },
                headers={"x-better-auth-secret": BETTER_AUTH_SECRET},
                timeout=10
            )
            
            if response.status_code != 200:
                error_data = response.json()
                raise HTTPException(
                    status_code=401,
                    detail=error_data.get("message", "Invalid credentials")
                )
            
            result = response.json()
            token = result.get("token")
            user_data = result.get("user", {})
            
            # Update last login in our database
            email = user_data.get("email")
            user = db.query(User).filter(User.email == email).first()
            if user:
                user.last_login = datetime.utcnow()
                db.commit()
            
            return {
                "status": "success",
                "token": token,
                "user": user_data
            }
            
    except httpx.RequestError:
        raise HTTPException(status_code=503, detail="Auth service unavailable")
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid authentication request")


@router.post("/google")
async def google_auth(request: Request, db: Session = Depends(get_db)):
    """
    Google OAuth endpoint - Better Auth handles OAuth flow
    
    Request body:
    {
        "idToken": "google_id_token"  // or authorizationCode
    }
    
    Returns:
    {
        "status": "success",
        "token": "jwt_token",
        "user": {
            "id": "user_id",
            "email": "user@example.com",
            "name": "User Name",
            "image": "profile_image_url"
        }
    }
    """
    try:
        body = await request.json()
        
        async with httpx.AsyncClient() as client:
            # Forward to Better Auth Google OAuth endpoint
            response = await client.post(
                f"{BETTER_AUTH_URL}/sign-in/google",
                json={
                    "idToken": body.get("idToken") or body.get("token"),
                    "redirect_uri": body.get("redirect_uri")
                },
                headers={"x-better-auth-secret": BETTER_AUTH_SECRET},
                timeout=10
            )
            
            if response.status_code != 200:
                error_data = response.json()
                raise HTTPException(
                    status_code=401,
                    detail=error_data.get("message", "Google authentication failed")
                )
            
            result = response.json()
            user_data = result.get("user", {})
            
            # Create or update user in our database
            email = user_data.get("email")
            existing_user = db.query(User).filter(User.email == email).first()
            
            if not existing_user:
                user = User(
                    email=email,
                    username=user_data.get("name", email.split("@")[0]),
                    auth_provider="google",
                    provider_id=user_data.get("id"),
                    created_at=datetime.utcnow()
                )
                db.add(user)
            else:
                # Update existing user's Google info
                existing_user.auth_provider = "google"
                existing_user.provider_id = user_data.get("id")
            
            db.commit()
            
            return {
                "status": "success",
                "token": result.get("token"),
                "user": user_data
            }
            
    except httpx.RequestError:
        raise HTTPException(status_code=503, detail="Auth service unavailable")
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid authentication request")


@router.post("/forgot-password")
async def forgot_password(request: Request):
    """
    Forgot password - Better Auth handles email and reset token
    
    Request body:
    {
        "email": "user@example.com",
        "redirectUrl": "https://app.netzeal.com/reset-password"
    }
    
    Returns:
    {
        "status": "success",
        "message": "Password reset email sent"
    }
    """
    try:
        body = await request.json()
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{BETTER_AUTH_URL}/forgot-password",
                json={
                    "email": body.get("email"),
                    "redirectUrl": body.get("redirectUrl")
                },
                headers={"x-better-auth-secret": BETTER_AUTH_SECRET},
                timeout=10
            )
            
            if response.status_code != 200:
                # Better Auth returns 200 even if email not found (security)
                pass
            
            return {
                "status": "success",
                "message": "If account exists, password reset email has been sent"
            }
            
    except httpx.RequestError:
        raise HTTPException(status_code=503, detail="Auth service unavailable")


@router.post("/reset-password")
async def reset_password(request: Request):
    """
    Reset password with token - Better Auth handles validation
    
    Request body:
    {
        "token": "reset_token",
        "password": "new_password"
    }
    
    Returns:
    {
        "status": "success",
        "message": "Password reset successful"
    }
    """
    try:
        body = await request.json()
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{BETTER_AUTH_URL}/reset-password",
                json={
                    "token": body.get("token"),
                    "password": body.get("password")
                },
                headers={"x-better-auth-secret": BETTER_AUTH_SECRET},
                timeout=10
            )
            
            if response.status_code != 200:
                error_data = response.json()
                raise HTTPException(
                    status_code=400,
                    detail=error_data.get("message", "Invalid or expired token")
                )
            
            return {
                "status": "success",
                "message": "Password reset successful"
            }
            
    except httpx.RequestError:
        raise HTTPException(status_code=503, detail="Auth service unavailable")
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid authentication request")


# ============================================================================
# PROTECTED ENDPOINTS (require authentication)
# ============================================================================

@router.get("/me")
async def get_current_user(
    user: User = Depends(get_better_auth_user)
) -> UserResponse:
    """
    Get current authenticated user profile
    
    Headers:
    {
        "Authorization": "Bearer {token}"
    }
    
    Returns:
    {
        "id": "user_id",
        "email": "user@example.com",
        "username": "username",
        "auth_provider": "better_auth",
        "created_at": "2026-02-05T10:30:00Z"
    }
    """
    return UserResponse.from_orm(user)


@router.get("/profile")
async def get_user_profile(
    user: User = Depends(get_better_auth_user),
    db: Session = Depends(get_db)
) -> UserProfile:
    """
    Get detailed user profile with statistics
    
    Headers:
    {
        "Authorization": "Bearer {token}"
    }
    
    Returns:
    {
        "user": { user data },
        "stats": {
            "created_at": "2026-02-05T10:30:00Z",
            "last_login": "2026-02-05T10:30:00Z",
            "auth_provider": "better_auth"
        }
    }
    """
    return UserProfile(
        user=UserResponse.from_orm(user),
        stats={
            "created_at": user.created_at,
            "last_login": user.last_login,
            "auth_provider": user.auth_provider
        }
    )


@router.post("/logout")
async def logout(
    user: User = Depends(get_better_auth_user),
    request: Request = None
) -> dict:
    """
    Logout endpoint
    
    In Better Auth, logout is handled client-side by deleting the session.
    This endpoint can be used for server-side cleanup if needed.
    
    Headers:
    {
        "Authorization": "Bearer {token}"
    }
    
    Returns:
    {
        "status": "success",
        "message": "Logged out successfully"
    }
    """
    # Better Auth handles session deletion client-side
    # This endpoint is for logging/cleanup if needed
    return {
        "status": "success",
        "message": "Logged out successfully"
    }


@router.post("/refresh-session")
async def refresh_session(request: Request, db: Session = Depends(get_db)):
    """
    Refresh authentication session
    
    Better Auth handles token refresh with refresh tokens
    
    Request body:
    {
        "refreshToken": "refresh_token"
    }
    
    Returns:
    {
        "status": "success",
        "token": "new_access_token",
        "user": { user data }
    }
    """
    try:
        body = await request.json()
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{BETTER_AUTH_URL}/refresh-session",
                json={
                    "refreshToken": body.get("refreshToken")
                },
                headers={"x-better-auth-secret": BETTER_AUTH_SECRET},
                timeout=10
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=401, detail="Session refresh failed")
            
            result = response.json()
            return {
                "status": "success",
                "token": result.get("token"),
                "user": result.get("user")
            }
            
    except httpx.RequestError:
        raise HTTPException(status_code=503, detail="Auth service unavailable")
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid authentication request")


@router.post("/verify-email")
async def verify_email(request: Request):
    """
    Verify email with token sent to email
    
    Request body:
    {
        "token": "verification_token"
    }
    
    Returns:
    {
        "status": "success",
        "message": "Email verified successfully"
    }
    """
    try:
        body = await request.json()
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{BETTER_AUTH_URL}/verify-email",
                json={
                    "token": body.get("token")
                },
                headers={"x-better-auth-secret": BETTER_AUTH_SECRET},
                timeout=10
            )
            
            if response.status_code != 200:
                error_data = response.json()
                raise HTTPException(
                    status_code=400,
                    detail=error_data.get("message", "Email verification failed")
                )
            
            return {
                "status": "success",
                "message": "Email verified successfully"
            }
            
    except httpx.RequestError:
        raise HTTPException(status_code=503, detail="Auth service unavailable")
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid authentication request")


@router.post("/resend-verification")
async def resend_verification(request: Request):
    """
    Resend email verification token
    
    Request body:
    {
        "email": "user@example.com"
    }
    
    Returns:
    {
        "status": "success",
        "message": "Verification email sent"
    }
    """
    try:
        body = await request.json()
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{BETTER_AUTH_URL}/resend-verification-email",
                json={
                    "email": body.get("email")
                },
                headers={"x-better-auth-secret": BETTER_AUTH_SECRET},
                timeout=10
            )
            
            if response.status_code != 200:
                pass  # Security: don't reveal if email exists
            
            return {
                "status": "success",
                "message": "If account exists, verification email has been sent"
            }
            
    except httpx.RequestError:
        raise HTTPException(status_code=503, detail="Auth service unavailable")


# ============================================================================
# HEALTH CHECK
# ============================================================================

@router.get("/health")
async def auth_health():
    """
    Check Better Auth service health
    
    Returns:
    {
        "status": "ok",
        "service": "better_auth",
        "timestamp": "2026-02-05T10:30:00Z"
    }
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{BETTER_AUTH_URL}/health",
                timeout=5
            )
            
            return {
                "status": "ok",
                "service": "better_auth",
                "timestamp": datetime.utcnow().isoformat()
            }
    except:
        raise HTTPException(
            status_code=503,
            detail="Auth service unavailable"
        )
