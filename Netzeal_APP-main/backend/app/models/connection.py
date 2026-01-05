"""
Connection and v2 chat models using UUID-based public identifiers
"""
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from ..core.database import Base


class Connection(Base):
    __tablename__ = "connections"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    follower_id = Column(UUID(as_uuid=True), ForeignKey("users.public_id", ondelete="CASCADE"), nullable=False)
    following_id = Column(UUID(as_uuid=True), ForeignKey("users.public_id", ondelete="CASCADE"), nullable=False)
    status = Column(String(32), nullable=False, server_default="connected")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("follower_id", "following_id", name="uq_connections_pair"),
        Index("ix_connections_follower", "follower_id"),
        Index("ix_connections_following", "following_id"),
    )


class ConversationV2(Base):
    __tablename__ = "conversations_v2"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_a_id = Column(UUID(as_uuid=True), ForeignKey("users.public_id", ondelete="CASCADE"), nullable=False)
    user_b_id = Column(UUID(as_uuid=True), ForeignKey("users.public_id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_message_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("user_a_id", "user_b_id", name="uq_conversations_v2_pair"),
        Index("ix_conversations_v2_user_a", "user_a_id"),
        Index("ix_conversations_v2_user_b", "user_b_id"),
        Index("ix_conversations_v2_last_message", "last_message_at"),
    )


class MessageV2(Base):
    __tablename__ = "messages_v2"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations_v2.id", ondelete="CASCADE"), nullable=False)
    sender_id = Column(UUID(as_uuid=True), ForeignKey("users.public_id", ondelete="CASCADE"), nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_messages_v2_conversation", "conversation_id"),
        Index("ix_messages_v2_sender", "sender_id"),
        Index("ix_messages_v2_created_at", "created_at"),
    )
