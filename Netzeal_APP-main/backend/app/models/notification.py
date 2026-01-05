"""
Notification model
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..core.database import Base

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    recipient_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Types: "follow", "like", "comment", "mention"
    type = Column(String(50), nullable=False)
    
    # ID of the related entity (post_id for likes/comments, or user_id for follows)
    entity_id = Column(Integer, nullable=True)
    
    text = Column(String(500))
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    recipient = relationship("User", foreign_keys=[recipient_id], backref="notifications_received")
    sender = relationship("User", foreign_keys=[sender_id], backref="notifications_sent")

    def __repr__(self):
        return f"<Notification {self.id} type={self.type} to={self.recipient_id}>"
