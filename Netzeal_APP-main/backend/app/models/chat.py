"""
Chat and messaging models
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Enum as SQLEnum, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from ..core.database import Base


class ConversationType(enum.Enum):
    """Type of conversation"""
    DIRECT = "direct"  # One-on-one chat
    GROUP = "group"    # Group chat


class MessageType(enum.Enum):
    """Type of message content"""
    TEXT = "text"
    IMAGE = "image"
    VIDEO = "video"
    FILE = "file"
    VOICE = "voice"
    SYSTEM = "system"  # System notifications


class Conversation(Base):
    """Conversation/chat thread between users"""
    
    __tablename__ = "conversations"
    
    id = Column(Integer, primary_key=True, index=True)
    type = Column(SQLEnum(ConversationType), default=ConversationType.DIRECT, nullable=False)
    title = Column(String(255))  # For group chats
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_message_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    created_by = relationship("User", foreign_keys=[created_by_id])
    participants = relationship("ConversationParticipant", back_populates="conversation", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Conversation {self.id} type={self.type.value}>"


Index("ix_conversations_last_message", Conversation.last_message_at.desc())


class ConversationParticipant(Base):
    """Tracks users in a conversation"""
    
    __tablename__ = "conversation_participants"
    
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    joined_at = Column(DateTime(timezone=True), server_default=func.now())
    last_read_at = Column(DateTime(timezone=True))
    last_seen_message_id = Column(Integer, ForeignKey("messages.id", ondelete="SET NULL"))
    is_muted = Column(Boolean, default=False)
    
    # Relationships
    conversation = relationship("Conversation", back_populates="participants")
    user = relationship("User")
    last_seen_message = relationship("Message", foreign_keys=[last_seen_message_id])
    
    def __repr__(self):
        return f"<ConversationParticipant conv={self.conversation_id} user={self.user_id}>"


Index("ix_conv_participants_user", ConversationParticipant.user_id)
Index("ix_conv_participants_conv", ConversationParticipant.conversation_id)
Index("ix_conv_participants_unique", ConversationParticipant.conversation_id, ConversationParticipant.user_id, unique=True)


class Message(Base):
    """Individual message in a conversation"""
    
    __tablename__ = "messages"
    
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    content = Column(Text)  # Text content
    message_type = Column(SQLEnum(MessageType), default=MessageType.TEXT, nullable=False)
    media_url = Column(String(1000))  # Cloudinary URL for media
    media_thumbnail_url = Column(String(1000))
    message_metadata = Column(Text)  # JSON string for extra data (file size, duration, etc.)
    
    # Reply/thread support
    reply_to_id = Column(Integer, ForeignKey("messages.id", ondelete="SET NULL"))
    
    # Status
    is_edited = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    edited_at = Column(DateTime(timezone=True))
    
    # Relationships
    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User", foreign_keys=[sender_id])
    reply_to = relationship("Message", remote_side=[id], foreign_keys=[reply_to_id])
    read_receipts = relationship("MessageReadReceipt", back_populates="message", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Message {self.id} conv={self.conversation_id} from={self.sender_id}>"


Index("ix_messages_conv_created", Message.conversation_id, Message.created_at.desc())


class MessageReadReceipt(Base):
    """Tracks which users have read which messages (blue ticks)"""
    
    __tablename__ = "message_read_receipts"
    
    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("messages.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    delivered_at = Column(DateTime(timezone=True))  # Double tick - message delivered
    read_at = Column(DateTime(timezone=True))  # Blue tick - message read/seen
    
    # Relationships
    message = relationship("Message", back_populates="read_receipts")
    user = relationship("User")
    
    def __repr__(self):
        return f"<MessageReadReceipt msg={self.message_id} user={self.user_id}>"


Index("ix_read_receipts_message", MessageReadReceipt.message_id)
Index("ix_read_receipts_user_message", MessageReadReceipt.user_id, MessageReadReceipt.message_id, unique=True)


class MessageEmbedding(Base):
    """Stores vector embeddings for messages (for semantic search via Qdrant)"""
    
    __tablename__ = "message_embeddings"
    
    id = Column(Integer, primary_key=True)
    message_id = Column(Integer, ForeignKey("messages.id", ondelete="CASCADE"), unique=True, nullable=False)
    embedding_vector = Column(Text)  # JSON array of floats
    qdrant_id = Column(String(128))  # ID in Qdrant collection
    model_version = Column(String(64), default="all-MiniLM-L6-v2")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    def __repr__(self):
        return f"<MessageEmbedding msg={self.message_id}>"


Index("ix_message_embeddings_message", MessageEmbedding.message_id)
