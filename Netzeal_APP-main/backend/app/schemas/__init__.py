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
)
from .content import (
    PostCreate,
    PostUpdate,
    PostResponse,
    CommentCreate,
    CommentResponse,
    LikeResponse,
    BookmarkResponse,
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
    "PostCreate",
    "PostUpdate",
    "PostResponse",
    "CommentCreate",
    "CommentResponse",
    "LikeResponse",
    "BookmarkResponse",
    "ChatMessage",
    "ChatResponse",
    "RecommendationRequest",
    "RecommendationResponse",
    "UserAnalytics",
]
