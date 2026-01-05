from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from ..core.database import get_db
from ..core.security import get_current_user
from ..models import User, Notification
from pydantic import BaseModel
from datetime import datetime
from ..utils.ws import manager

router = APIRouter(tags=["Notifications"])

class SenderOut(BaseModel):
    id: int
    public_id: Optional[UUID] = None
    username: str
    profile_photo: Optional[str] = None
    
    class Config:
        from_attributes = True # Pydantic v2

class NotificationOut(BaseModel):
    id: int
    type: str # follow, like, comment
    text: Optional[str]
    is_read: bool
    created_at: datetime
    entity_id: Optional[int]
    sender: SenderOut

    class Config:
        from_attributes = True

@router.get("/", response_model=List[NotificationOut])
async def get_notifications(
    skip: int = 0, 
    limit: int = 20, 
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    notifs = (
        db.query(Notification)
        .filter(Notification.recipient_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return notifs

@router.post("/{notification_id}/read")
async def mark_read(
   notification_id: int,
   current_user: User = Depends(get_current_user),
   db: Session = Depends(get_db)
):
    notif = db.query(Notification).filter(Notification.id == notification_id, Notification.recipient_id == current_user.id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    notif.is_read = True
    db.commit()
    return {"status": "success"}

async def create_notification(
    db: Session, 
    recipient_id: int, 
    sender_id: int, 
    type: str, 
    text: str = None, 
    entity_id: int = None
):
    """
    Create a notification and send real-time update via WebSocket.
    This should be called from other routers.
    """
    if recipient_id == sender_id:
        return
        
    try:
        new_notif = Notification(
            recipient_id=recipient_id,
            sender_id=sender_id,
            type=type,
            text=text,
            entity_id=entity_id
        )
        db.add(new_notif)
        db.commit()
        db.refresh(new_notif)
        
        # Prepare WS payload
        payload = {
            "type": "NOTIFICATION",
            "data": {
                "id": new_notif.id,
                "type": type,
                "text": text,
                "sender": {
                    "username": new_notif.sender.username,
                    "profile_photo": new_notif.sender.profile_photo,
                    "public_id": str(new_notif.sender.public_id) if new_notif.sender.public_id else None
                },
                "entity_id": entity_id,
                "created_at": new_notif.created_at.isoformat()
            }
        }
        await manager.send_personal_message(payload, recipient_id)
    except Exception as e:
        print(f"Error creating notification: {e}")
