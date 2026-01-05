"""
User model for authentication and profile management
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, JSON, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..core.database import Base


class User(Base):
    """User model representing a registered user in the platform"""
    
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    public_id = Column(UUID(as_uuid=True), unique=True, nullable=False, server_default=text("gen_random_uuid()"))
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=True)  # Nullable for Firebase phone auth users
    
    # Firebase Authentication
    firebase_uid = Column(String(128), unique=True, index=True, nullable=True)  # Firebase user ID
    phone_number = Column(String(20), unique=True, index=True, nullable=True)  # Phone number for Firebase auth
    
    # Profile Information
    full_name = Column(String(255))
    bio = Column(Text)
    profile_photo = Column(String(500))
    
    # Professional Details
    education = Column(JSON)  # List of education entries
    work_experience = Column(JSON)  # List of work experience entries
    skills = Column(JSON)  # List of skills
    interests = Column(JSON)  # List of interests
    achievements = Column(JSON)  # List of achievements/certifications
    
    # Account Status
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    posts = relationship("Post", back_populates="author", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="author", cascade="all, delete-orphan")
    likes = relationship("Like", back_populates="user", cascade="all, delete-orphan")
    bookmarks = relationship("Bookmark", back_populates="user", cascade="all, delete-orphan")
    followers = relationship(
        "Follow",
        foreign_keys="Follow.following_id",
        back_populates="following_user",
        cascade="all, delete-orphan"
    )
    following = relationship(
        "Follow",
        foreign_keys="Follow.follower_id",
        back_populates="follower_user",
        cascade="all, delete-orphan"
    )
    interactions = relationship("UserInteraction", back_populates="user", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<User {self.username}>"
