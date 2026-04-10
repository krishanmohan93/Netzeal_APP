"""
Initialize schemas package
"""
from .user import (
    UserCreate,
    UserUpdate,
    UserResponse,
    UserProfileResponse,
    Token,
    TokenData,
    RefreshTokenRequest,
    VerifyEmailRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
)
from .content import (
    PostCreate,
    PostUpdate,
    PostResponse,
    CommentCreate,
    CommentResponse,
    LikeResponse,
    BookmarkResponse,
    CommentLikeResponse,
)
from .ai import (
    ChatMessage,
    ChatResponse,
    RecommendationRequest,
    RecommendationResponse,
    UserAnalytics,
)

__all__ = [
    "UserCreate",
    "UserUpdate",
    "UserResponse",
    "UserProfileResponse",
    "Token",
    "TokenData",
    "RefreshTokenRequest",
    "VerifyEmailRequest",
    "ForgotPasswordRequest",
    "ResetPasswordRequest",
    "PostCreate",
    "PostUpdate",
    "PostResponse",
    "CommentCreate",
    "CommentResponse",
    "LikeResponse",
    "BookmarkResponse",
    "CommentLikeResponse",
    "ChatMessage",
    "ChatResponse",
    "RecommendationRequest",
    "RecommendationResponse",
    "UserAnalytics",
]
