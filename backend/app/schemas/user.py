"""
User schemas for request and response validation
"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict
from datetime import datetime


class UserBase(BaseModel):
    """Base user schema with common fields"""
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=100)
    full_name: Optional[str] = None


class UserCreate(UserBase):
    """Schema for user registration via email"""
    password: str = Field(..., min_length=8, description="Password must be at least 8 characters")


class UserLogin(BaseModel):
    """Schema for email login"""
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    """Schema for updating user profile"""
    full_name: Optional[str] = None
    bio: Optional[str] = None
    profile_photo: Optional[str] = None
    education: Optional[List[Dict]] = None
    work_experience: Optional[List[Dict]] = None
    skills: Optional[List[str]] = None
    interests: Optional[List[str]] = None
    achievements: Optional[List[Dict]] = None


class UserResponse(UserBase):
    """Schema for user response"""
    id: int
    auth_provider: str
    bio: Optional[str] = None
    profile_photo: Optional[str] = None
    education: Optional[List[Dict]] = None
    work_experience: Optional[List[Dict]] = None
    skills: Optional[List[str]] = None
    interests: Optional[List[str]] = None
    achievements: Optional[List[Dict]] = None
    is_active: bool
    is_verified: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class UserProfileResponse(UserResponse):
    """Extended user profile with statistics"""
    followers_count: int = 0
    following_count: int = 0
    posts_count: int = 0


class Token(BaseModel):
    """JWT token response schema"""
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    expires_in: Optional[int] = None  # Expiration time in seconds
    user: Optional[UserResponse] = None


class TokenData(BaseModel):
    """Token payload data"""
    user_id: Optional[int] = None


class GoogleAuthRequest(BaseModel):
    """Schema for Google OAuth token"""
    id_token: str
    redirect_uri: Optional[str] = None


class GoogleAuthResponse(BaseModel):
    """Response after Google authentication"""
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse
    is_new_user: bool


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class VerifyEmailRequest(BaseModel):
    token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8, description="Password must be at least 8 characters")
