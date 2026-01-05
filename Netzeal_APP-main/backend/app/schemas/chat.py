"""
Pydantic schemas for chat and messaging
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class ConversationType(str, Enum):
    DIRECT = "direct"
    GROUP = "group"


class MessageType(str, Enum):
    TEXT = "text"
    IMAGE = "image"
    VIDEO = "video"
    FILE = "file"
    VOICE = "voice"
    SYSTEM = "system"


# Conversation schemas
class ConversationCreate(BaseModel):
    """Create new conversation"""
    type: ConversationType = ConversationType.DIRECT
    title: Optional[str] = None
    participant_ids: List[int] = Field(..., min_items=1, description="User IDs to add to conversation")


class ConversationParticipantResponse(BaseModel):
    """Participant info in conversation"""
    user_id: int
    username: str
    full_name: Optional[str] = None
    profile_photo: Optional[str] = None
    last_read_at: Optional[datetime] = None
    is_online: bool = False
    
    class Config:
        from_attributes = True


class ConversationResponse(BaseModel):
    """Conversation details"""
    id: int
    type: ConversationType
    title: Optional[str] = None
    created_at: datetime
    last_message_at: datetime
    participants: List[ConversationParticipantResponse] = []
    unread_count: int = 0
    last_message: Optional[str] = None
    last_message_sender: Optional[str] = None
    
    class Config:
        from_attributes = True


# Message schemas
class MessageCreate(BaseModel):
    """Send new message"""
    conversation_id: int
    content: Optional[str] = None
    message_type: MessageType = MessageType.TEXT
    media_url: Optional[str] = None
    reply_to_id: Optional[int] = None
    metadata: Optional[str] = None  # JSON string


class MessageUpdate(BaseModel):
    """Edit message"""
    content: Optional[str] = None


class MessageResponse(BaseModel):
    """Message details"""
    id: int
    conversation_id: int
    sender_id: int
    sender_username: str
    sender_full_name: Optional[str] = None
    sender_profile_photo: Optional[str] = None
    content: Optional[str] = None
    message_type: MessageType
    media_url: Optional[str] = None
    media_thumbnail_url: Optional[str] = None
    message_metadata: Optional[str] = None
    reply_to_id: Optional[int] = None
    is_edited: bool = False
    is_deleted: bool = False
    created_at: datetime
    edited_at: Optional[datetime] = None
    read_by: List[int] = []  # User IDs who read this message
    is_read: bool = False  # Whether current user has read it
    
    class Config:
        from_attributes = True


class MessagesResponse(BaseModel):
    """Paginated messages"""
    items: List[MessageResponse]
    next_cursor: Optional[str] = None
    has_more: bool = False


# Typing indicator
class TypingEvent(BaseModel):
    """Typing indicator event"""
    conversation_id: int
    user_id: int
    username: str
    is_typing: bool


# Read receipt
class ReadReceiptEvent(BaseModel):
    """Read receipt event"""
    conversation_id: int
    message_id: int
    user_id: int
    read_at: datetime


# WebSocket message types
class WSMessage(BaseModel):
    """WebSocket message envelope"""
    type: str  # NEW_MESSAGE, TYPING, READ_RECEIPT, USER_ONLINE, USER_OFFLINE
    data: dict


# Media upload
class MediaUploadResponse(BaseModel):
    """Cloudinary upload response"""
    url: str
    thumbnail_url: Optional[str] = None
    public_id: str
    resource_type: str  # image, video, raw
    format: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    duration: Optional[float] = None
    size: int


# AI Chat recommendations
class ChatRecommendation(BaseModel):
    """AI-powered chat recommendations"""
    message_id: int
    relevance_score: float
    content_preview: str
    sender_username: str
    conversation_id: int
    created_at: datetime


class ChatInsight(BaseModel):
    """AI insights about conversations"""
    conversation_id: int
    summary: str
    sentiment: str  # positive, neutral, negative
    key_topics: List[str]
    suggested_responses: List[str]
