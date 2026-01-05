"""
Social interaction models for networking and engagement
"""
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from ..core.database import Base


class Follow(Base):
    """Follow model representing user connections"""
    
    __tablename__ = "follows"
    
    id = Column(Integer, primary_key=True, index=True)
    follower_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    following_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    follower_user = relationship("User", foreign_keys=[follower_id], back_populates="following")
    following_user = relationship("User", foreign_keys=[following_id], back_populates="followers")
    
    def __repr__(self):
        return f"<Follow: User {self.follower_id} follows User {self.following_id}>"


class InteractionType(enum.Enum):
    """Enum for different types of user interactions"""
    VIEW = "view"
    READ = "read"
    LIKE = "like"
    COMMENT = "comment"
    SHARE = "share"
    BOOKMARK = "bookmark"
    CLICK = "click"


class UserInteraction(Base):
    """
    User interaction model for tracking behavior and analytics
    This helps the AI understand user preferences
    """
    
    __tablename__ = "user_interactions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=True)
    
    interaction_type = Column(Enum(InteractionType), nullable=False)
    duration_seconds = Column(Integer)  # Time spent on content
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="interactions")
    post = relationship("Post", back_populates="interactions")
    
    def __repr__(self):
        return f"<Interaction: User {self.user_id} - {self.interaction_type}>"


class AIConversation(Base):
    """AI conversation model for storing chatbot interactions"""
    
    __tablename__ = "ai_conversations"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    message = Column(String(2000), nullable=False)
    response = Column(String(5000), nullable=False)
    intent = Column(String(100))  # Detected user intent
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    def __repr__(self):
        return f"<AIConversation {self.id} for User {self.user_id}>"
