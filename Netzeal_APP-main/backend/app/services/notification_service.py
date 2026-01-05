from sqlalchemy.orm import Session
from ..models.notification import Notification
from ..utils.ws import manager

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
    except Exception as e:
        print(f"Error creating notification: {e}")

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..models.user import User

async def create_notification_async(
    db: AsyncSession, 
    recipient_id: int, 
    sender_id: int, 
    type: str, 
    text: str = None, 
    entity_id: int = None
):
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
        await db.commit()
        await db.refresh(new_notif)
        
        # Fetch sender details for WS payload
        stmt = select(User).where(User.id == sender_id)
        result = await db.execute(stmt)
        sender = result.scalar_one_or_none()
        
        payload = {
            "type": "NOTIFICATION",
            "data": {
                "id": new_notif.id,
                "type": type,
                "text": text,
                "sender": {
                    "username": sender.username if sender else "Unknown",
                    "profile_photo": sender.profile_photo if sender else None,
                    "public_id": str(sender.public_id) if sender and sender.public_id else None
                },
                "entity_id": entity_id,
                "created_at": new_notif.created_at.isoformat()
            }
        }
        await manager.send_personal_message(payload, recipient_id)
    except Exception as e:
        print(f"Error creating async notification: {e}")
