"""
Content schemas for posts, comments, and engagement
"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime
from ..models.content import ContentType, MediaType


class PostBase(BaseModel):
    """Base post schema"""
    title: Optional[str] = None
    content: str = Field(..., min_length=1)
    content_type: ContentType = ContentType.POST
    media_urls: Optional[List[str]] = None
    tags: Optional[List[str]] = None


class PostCreate(PostBase):
    """Schema for creating a post"""
    pass


class InstagramPostCreate(BaseModel):
    """Schema for Instagram-like post creation with media"""
    caption: str = Field(..., min_length=1, max_length=2200, description="Post caption")
    content_type: ContentType = ContentType.POST
    tags: Optional[List[str]] = Field(default=None, description="Hashtags")
    
    @field_validator('caption')
    @classmethod
    def validate_caption(cls, v: str) -> str:
        """Ensure caption is not empty or just whitespace"""
        if not v or not v.strip():
            raise ValueError('Caption cannot be empty')
        return v.strip()


class PostUpdate(BaseModel):
    """Schema for updating a post"""
    title: Optional[str] = None
    content: Optional[str] = None
    media_urls: Optional[List[str]] = None
    tags: Optional[List[str]] = None


class PostResponse(PostBase):
    """Schema for post response"""
    id: int
    author_id: int
    views_count: int
    likes_count: int
    comments_count: int
    shares_count: int
    topics: Optional[List[str]] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    # Author info
    author_username: Optional[str] = None
    author_full_name: Optional[str] = None
    author_photo: Optional[str] = None
    
    # User interaction flags
    is_liked: bool = False
    is_bookmarked: bool = False
    
    class Config:
        from_attributes = True


class InstagramFeedPostResponse(BaseModel):
    """Instagram-like feed post response with all user info"""
    id: int
    caption: str
    media_url: str
    media_type: str  # 'image' or 'video'
    width: Optional[int] = None
    height: Optional[int] = None
    duration: Optional[float] = None  # for videos
    thumbnail_url: Optional[str] = None  # for videos/reels
    type: Optional[str] = None  # post | reel | video
    
    # Author details
    author_id: int
    author_username: str
    author_full_name: Optional[str] = None
    author_profile_picture: Optional[str] = None
    author_is_verified: bool = False
    
    # Engagement
    likes_count: int = 0
    comments_count: int = 0
    views_count: int = 0
    is_liked: bool = False
    is_bookmarked: bool = False
    
    # Tags
    tags: Optional[List[str]] = None
    
    # Timestamp
    created_at: datetime
    # Published time if available (for ordering)
    published_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


# New: Cursor-based feed response
class FeedResponse(BaseModel):
    items: List[InstagramFeedPostResponse]
    next_cursor: Optional[str] = None


# New: Draft create and publish
class PostDraftCreate(BaseModel):
    caption: str
    media_url: str
    media_type: str  # 'image' | 'video'
    visibility: Optional[str] = Field(default="public")


class PostPublishResponse(BaseModel):
    id: int
    published_at: datetime
    message: str = "Published"


class LiveSessionCreate(BaseModel):
    """Start live session request"""
    title: Optional[str] = None
    description: Optional[str] = None


class LiveSessionResponse(BaseModel):
    id: int
    host_user_id: int
    title: Optional[str] = None
    description: Optional[str] = None
    stream_key: str
    is_active: int
    viewer_count: int
    started_at: datetime
    ended_at: Optional[datetime] = None
    replay_media_url: Optional[str] = None
    thumbnail_url: Optional[str] = None

    class Config:
        from_attributes = True


class LiveCommentCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=500)


class LiveCommentResponse(BaseModel):
    id: int
    live_session_id: int
    author_id: int
    author_username: Optional[str] = None
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class CommentBase(BaseModel):
    """Base comment schema"""
    content: str = Field(..., min_length=1, max_length=2000)


class CommentCreate(CommentBase):
    """Schema for creating a comment"""
    post_id: int


class CommentResponse(CommentBase):
    """Schema for comment response"""
    id: int
    post_id: int
    author_id: int
    author_username: Optional[str] = None
    author_full_name: Optional[str] = None
    author_photo: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class LikeResponse(BaseModel):
    """Schema for like response"""
    id: int
    user_id: int
    post_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class BookmarkResponse(BaseModel):
    """Schema for bookmark response"""
    id: int
    user_id: int
    post_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


# Multi-media post schemas
class PostMediaOut(BaseModel):
    """Schema for post media item output"""
    id: int
    media_type: MediaType
    url: str
    thumb_url: Optional[str] = None
    order_index: int
    width: Optional[int] = None
    height: Optional[int] = None
    is_reel: bool = False
    duration_seconds: Optional[int] = None
    transform_state: Optional[dict] = None
    
    class Config:
        from_attributes = True


class MultiMediaPostCreate(BaseModel):
    """Schema for creating multi-media post"""
    title: Optional[str] = Field(None, max_length=500)
    caption: Optional[str] = Field(None, max_length=3000)
    tags: Optional[List[str]] = None
    hashtags: Optional[List[str]] = None


class MultiMediaPostOut(BaseModel):
    """Schema for multi-media post output"""
    id: int
    author_id: int
    title: Optional[str] = None
    content: str
    hashtags: Optional[str] = None
    tags: Optional[str] = None
    created_at: datetime
    likes_count: int = 0
    comments_count: int = 0
    views_count: int = 0
    media_items: List[PostMediaOut] = []
    
    # Author details
    author_username: Optional[str] = None
    author_full_name: Optional[str] = None
    author_profile_picture: Optional[str] = None
    
    # User interaction flags
    is_liked: bool = False
    is_bookmarked: bool = False
    
    class Config:
        from_attributes = True


class TransformStateUpdate(BaseModel):
    """Schema for updating a media item's transform state"""
    transform_state: dict
