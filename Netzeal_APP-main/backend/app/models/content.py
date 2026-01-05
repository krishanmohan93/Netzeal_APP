"""
Content models for posts, articles, and media
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, Enum, ForeignKey, JSON, Boolean, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from ..core.database import Base


class ContentType(enum.Enum):
    """Enum for different types of content"""
    ARTICLE = "article"
    VIDEO = "video"  # Generic long-form video
    INFOGRAPHIC = "infographic"
    POST = "post"     # Standard image/text post
    REEL = "reel"     # Short vertical video (<=60s)
    LIVE = "live"     # Live streaming session placeholder content
    PROJECT = "project" # Portfolio project


class MediaType(enum.Enum):
    """Enum for media types in multi-media posts"""
    IMAGE = "image"
    VIDEO = "video"
    PDF = "pdf"


class Post(Base):
    """Post model representing user-generated content (posts, reels, videos)"""
    
    __tablename__ = "posts"
    
    id = Column(Integer, primary_key=True, index=True)
    author_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Content
    title = Column(String(500))
    content = Column(Text, nullable=False)
    content_type = Column(Enum(ContentType), default=ContentType.POST)
    media_urls = Column(JSON)  # List of media URLs (images, videos, reels variants)
    thumbnail_url = Column(String(1000))  # Pre-generated thumbnail (for videos/reels)
    duration_seconds = Column(Integer)  # Video/Reel duration
    audio_track_url = Column(String(1000))  # Optional background music (for reels)
    location = Column(String(255))  # Optional location tag
    tags = Column(JSON)  # List of tags for categorization (includes hashtags)
    
    # Engagement Metrics
    views_count = Column(Integer, default=0)
    likes_count = Column(Integer, default=0)
    comments_count = Column(Integer, default=0)
    shares_count = Column(Integer, default=0)
    
    # AI-generated metadata
    embedding_vector = Column(JSON)  # Vector representation for AI recommendations
    topics = Column(JSON)  # Extracted topics
    category = Column(String(64))  # Optional content category for explore / diversity
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    # Publishing
    is_published = Column(Boolean, default=True, nullable=False)
    visibility = Column(String(32), default="public", nullable=False)  # public, private, followers (future)
    published_at = Column(DateTime(timezone=True))
    
    # Relationships
    author = relationship("User", back_populates="posts")
    media_items = relationship("PostMedia", back_populates="post", cascade="all, delete-orphan", order_by="PostMedia.order_index", passive_deletes=True)
    comments = relationship("Comment", back_populates="post", cascade="all, delete-orphan", passive_deletes=True)
    likes = relationship("Like", back_populates="post", cascade="all, delete-orphan", passive_deletes=True)
    bookmarks = relationship("Bookmark", back_populates="post", cascade="all, delete-orphan", passive_deletes=True)
    interactions = relationship("UserInteraction", back_populates="post", cascade="all, delete-orphan", passive_deletes=True)
    
    def __repr__(self):
        return f"<Post {self.id} type={self.content_type.value} by User {self.author_id}>"


class PostMedia(Base):
    """Individual media item in a post (supports multiple images/videos per post)"""
    
    __tablename__ = "post_media"
    
    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    media_type = Column(Enum(MediaType), nullable=False)
    url = Column(String(1000), nullable=False)
    thumb_url = Column(String(1000))  # Thumbnail for videos/PDFs
    order_index = Column(Integer, default=0)  # Order in carousel
    width = Column(Integer)
    height = Column(Integer)
    is_reel = Column(Boolean, default=False)  # Flag for vertical short videos
    duration_seconds = Column(Integer)  # For videos
    # Non-destructive editor transform state (JSON blob)
    # {
    #   "version": 1,
    #   "aspectRatio": {"label": "4:5", "value": 0.8},
    #   "base": {"width": <int>, "height": <int>},
    #   "cropRect": {"x": <float>, "y": <float>, "width": <float>, "height": <float>},
    #   "scale": <float>,
    #   "baseScale": <float>,
    #   "translation": {"x": <float>, "y": <float>},
    #   "rotation": <int>,
    #   "filters": {"brightness":1, "contrast":1, ...}
    # }
    transform_state = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    post = relationship("Post", back_populates="media_items")
    
    def __repr__(self):
        return f"<PostMedia {self.id} type={self.media_type.value} post={self.post_id}>"

# Helpful indexes for feed queries (note: with Alembic, create explicit migrations)
Index("ix_posts_published_visibility", Post.is_published, Post.visibility)
Index("ix_posts_published_at_desc", Post.published_at, postgresql_ops=None)
Index("ix_posts_category", Post.category)


class PostEmbedding(Base):
    """Stores cached embedding metadata for a post (caption, hashtags, image)."""
    __tablename__ = "post_embeddings"
    id = Column(Integer, primary_key=True)
    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), unique=True, nullable=False)
    caption_embedding = Column(JSON)  # vector stored as list of floats
    hashtags_embedding = Column(JSON)
    image_embedding = Column(JSON)
    model_version = Column(String(128))
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<PostEmbedding post={self.post_id} model={self.model_version}>"


class UserEmbedding(Base):
    """Stores user interest/profile embedding used for personalized ranking."""
    __tablename__ = "user_embeddings"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    interests_embedding = Column(JSON)
    profile_embedding = Column(JSON)
    model_version = Column(String(128))
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<UserEmbedding user={self.user_id} model={self.model_version}>"


class PostImpression(Base):
    """Tracks user impressions (shows) to penalize already seen posts in ranking."""
    __tablename__ = "post_impressions"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<PostImpression user={self.user_id} post={self.post_id}>"

Index("ix_post_impressions_user_post", PostImpression.user_id, PostImpression.post_id)


class FeedItem(Base):
    """Denormalized fan-out table for fast per-user feeds."""

    __tablename__ = "feed_items"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Relationships
    # We don't need explicit relationships here to keep this table lean.

    def __repr__(self):
        return f"<FeedItem user={self.user_id} post={self.post_id}>"

Index("ix_feed_items_user_post", FeedItem.user_id, FeedItem.post_id)
Index("ix_feed_items_created_desc", FeedItem.created_at)


class LiveSession(Base):
    """Live streaming session metadata"""

    __tablename__ = "live_sessions"

    id = Column(Integer, primary_key=True, index=True)
    host_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255))
    description = Column(Text)
    stream_key = Column(String(255), unique=True, index=True)  # For RTMP ingest (external service)
    is_active = Column(Integer, default=1)  # 1 active, 0 ended (simplify boolean for easy counting)
    viewer_count = Column(Integer, default=0)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    ended_at = Column(DateTime(timezone=True))
    replay_media_url = Column(String(1000))  # Optional recording stored after session ends
    thumbnail_url = Column(String(1000))

    host = relationship("User")
    comments = relationship("LiveComment", back_populates="live_session", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<LiveSession {self.id} host={self.host_user_id} active={self.is_active}>"


class LiveComment(Base):
    """Real-time comment on a live session"""

    __tablename__ = "live_comments"

    id = Column(Integer, primary_key=True, index=True)
    live_session_id = Column(Integer, ForeignKey("live_sessions.id", ondelete="CASCADE"), nullable=False)
    author_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    live_session = relationship("LiveSession", back_populates="comments")
    author = relationship("User")

    def __repr__(self):
        return f"<LiveComment {self.id} live={self.live_session_id} author={self.author_id}>"


class Comment(Base):
    """Comment model for post interactions"""
    
    __tablename__ = "comments"
    
    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    author_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    post = relationship("Post", back_populates="comments")
    author = relationship("User", back_populates="comments")
    
    def __repr__(self):
        return f"<Comment {self.id} on Post {self.post_id}>"


class Like(Base):
    """Like model for post engagement"""
    
    __tablename__ = "likes"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="likes")
    post = relationship("Post", back_populates="likes")
    
    def __repr__(self):
        return f"<Like by User {self.user_id} on Post {self.post_id}>"


class Bookmark(Base):
    """Bookmark model for saved posts"""
    
    __tablename__ = "bookmarks"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="bookmarks")
    post = relationship("Post", back_populates="bookmarks")
    
    def __repr__(self):
        return f"<Bookmark by User {self.user_id} on Post {self.post_id}>"
