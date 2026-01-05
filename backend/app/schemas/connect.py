"""
Schemas for search, connections, and chat v2 APIs
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from enum import Enum


class ConnectionStatus(str, Enum):
    connected = "connected"
    requested = "requested"


class SearchUserResponse(BaseModel):
    public_id: UUID
    username: str
    full_name: Optional[str] = None
    profile_photo: Optional[str] = None

    class Config:
        from_attributes = True


class ConnectToggleRequest(BaseModel):
    target_public_id: UUID = Field(..., description="Public ID of the user to connect/unconnect")


class ConnectionResponse(BaseModel):
    follower_id: UUID
    following_id: UUID
    status: ConnectionStatus = ConnectionStatus.connected
    conversation_id: Optional[UUID] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ChatCreateRequest(BaseModel):
    target_public_id: UUID


class ChatSendRequest(BaseModel):
    conversation_id: UUID
    body: str = Field(..., min_length=1)


class ChatMessageResponse(BaseModel):
    id: UUID
    conversation_id: UUID
    sender_id: UUID
    body: str
    created_at: datetime

    class Config:
        from_attributes = True


class ChatConversationResponse(BaseModel):
    id: UUID
    user_id: UUID
    username: str
    full_name: Optional[str] = None
    profile_photo: Optional[str] = None
    last_message: Optional[str] = None
    last_message_at: Optional[datetime] = None


class ChatMessagesResponse(BaseModel):
    conversation_id: UUID
    messages: List[ChatMessageResponse]


class ConnectedFeedItem(BaseModel):
    post_id: int
    author_username: Optional[str]
    author_full_name: Optional[str]
    author_photo: Optional[str]
    title: Optional[str]
    content: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
