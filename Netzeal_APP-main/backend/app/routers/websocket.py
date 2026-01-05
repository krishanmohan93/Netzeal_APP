"""
WebSocket Router for Real-Time Chat
Handles: Authentication, Events, Heartbeat, Room Management
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import json
import uuid
import logging
from datetime import datetime
from typing import Optional

from ..core.database import get_async_db
from ..core.websocket_manager import ws_manager
from ..models.user import User
from ..models.chat import Message, MessageReadReceipt, Conversation
from ..core.security import decode_access_token

logger = logging.getLogger(__name__)
router = APIRouter(tags=["websocket"])


async def get_user_from_token(token: str, db: AsyncSession) -> Optional[User]:
    """
    Authenticate user from JWT token
    Returns User object or None
    """
    try:
        payload = decode_access_token(token)
        if not payload:
            return None
        
        user_id = payload.get("sub")
        if not user_id:
            return None
        
        result = await db.execute(select(User).where(User.id == int(user_id)))
        user = result.scalar_one_or_none()
        return user
        
    except Exception as e:
        logger.error(f"Token authentication error: {e}")
        return None


@router.websocket("/ws/chat")
async def websocket_chat_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Production WebSocket endpoint for real-time chat
    
    Query Parameters:
        - token: JWT access token for authentication
    
    Events from Client:
        - PING: Heartbeat to keep connection alive
        - JOIN_ROOM: Subscribe to a conversation
        - LEAVE_ROOM: Unsubscribe from a conversation
        - TYPING: Send typing indicator
        - MESSAGE: Send a new message
        - READ_RECEIPT: Mark message as read
        - REQUEST_SYNC: Request message sync
    
    Events to Client:
        - CONNECTION_SUCCESS: Connection established
        - PONG: Heartbeat response
        - NEW_MESSAGE: New message in subscribed room
        - TYPING: Typing indicator from other user
        - READ_RECEIPT: Message read by other user
        - PRESENCE_UPDATE: User online/offline status
        - MESSAGE_DELIVERED: Message delivery confirmation
        - ERROR: Error message
    """
    
    connection_id = str(uuid.uuid4())
    user = None
    
    try:
        # Step 1: Authenticate
        if not token:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Missing token")
            logger.warning("❌ WebSocket connection rejected: No token provided")
            return
        
        user = await get_user_from_token(token, db)
        if not user:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid token")
            logger.warning("❌ WebSocket connection rejected: Invalid token")
            return
        
        # Step 2: Accept connection
        await ws_manager.connect(
            websocket=websocket,
            user_id=user.id,
            connection_id=connection_id,
            device_info={
                "user_agent": websocket.headers.get("user-agent", "Unknown"),
                "platform": "mobile"  # You can enhance this
            }
        )
        
        logger.info(f"✅ WebSocket authenticated | User: {user.username} (ID: {user.id})")
        
        # Step 3: Event loop - listen for messages from client
        while True:
            try:
                # Receive message from client
                raw_data = await websocket.receive_text()
                data = json.loads(raw_data)
                
                event_type = data.get("type")
                event_data = data.get("data", {})
                
                logger.debug(f"📨 Received event: {event_type} from user {user.id}")
                
                # Handle different event types
                if event_type == "PING":
                    # Heartbeat - keep connection alive
                    await ws_manager.handle_heartbeat(connection_id)
                
                elif event_type == "JOIN_ROOM":
                    # Subscribe to conversation
                    room_id = event_data.get("room_id") or event_data.get("conversation_id")
                    if room_id:
                        await ws_manager.join_room(f"conv_{room_id}", user.id)
                        await websocket.send_json({
                            "type": "ROOM_JOINED",
                            "data": {"room_id": room_id, "status": "success"}
                        })
                
                elif event_type == "LEAVE_ROOM":
                    # Unsubscribe from conversation
                    room_id = event_data.get("room_id") or event_data.get("conversation_id")
                    if room_id:
                        await ws_manager.leave_room(f"conv_{room_id}", user.id)
                        await websocket.send_json({
                            "type": "ROOM_LEFT",
                            "data": {"room_id": room_id, "status": "success"}
                        })
                
                elif event_type == "TYPING":
                    # Typing indicator
                    room_id = event_data.get("room_id") or event_data.get("conversation_id")
                    is_typing = event_data.get("is_typing", False)
                    
                    if room_id:
                        await ws_manager.handle_typing(
                            f"conv_{room_id}",
                            user.id,
                            is_typing
                        )
                
                elif event_type == "MESSAGE":
                    # New message sent via WebSocket
                    # For production, prefer HTTP POST then broadcast via WS
                    conversation_id = event_data.get("conversation_id")
                    content = event_data.get("content")
                    
                    if conversation_id and content:
                        # Create message in database
                        message = Message(
                            conversation_id=conversation_id,
                            sender_id=user.id,
                            content=content,
                            type="TEXT",
                            created_at=datetime.utcnow()
                        )
                        db.add(message)
                        await db.flush()
                        
                        # Broadcast to room
                        await ws_manager.broadcast_to_room(
                            f"conv_{conversation_id}",
                            {
                                "type": "NEW_MESSAGE",
                                "data": {
                                    "id": message.id,
                                    "conversation_id": conversation_id,
                                    "sender_id": user.id,
                                    "sender_username": user.username,
                                    "content": content,
                                    "type": "TEXT",
                                    "created_at": message.created_at.isoformat(),
                                    "is_read": False
                                }
                            }
                        )
                        
                        await db.commit()
                        
                        # Send delivery confirmation to sender
                        await websocket.send_json({
                            "type": "MESSAGE_SENT",
                            "data": {
                                "temp_id": event_data.get("temp_id"),
                                "message_id": message.id,
                                "status": "delivered"
                            }
                        })
                
                elif event_type == "READ_RECEIPT":
                    # Mark message as read
                    message_id = event_data.get("message_id")
                    conversation_id = event_data.get("conversation_id")
                    
                    if message_id and conversation_id:
                        # Check if receipt already exists
                        existing = await db.execute(
                            select(MessageReadReceipt).where(
                                MessageReadReceipt.message_id == message_id,
                                MessageReadReceipt.user_id == user.id
                            )
                        )
                        
                        if not existing.scalar_one_or_none():
                            # Create read receipt
                            receipt = MessageReadReceipt(
                                message_id=message_id,
                                user_id=user.id,
                                read_at=datetime.utcnow()
                            )
                            db.add(receipt)
                            await db.commit()
                            
                            # Broadcast read receipt
                            await ws_manager.broadcast_to_room(
                                f"conv_{conversation_id}",
                                {
                                    "type": "READ_RECEIPT",
                                    "data": {
                                        "message_id": message_id,
                                        "conversation_id": conversation_id,
                                        "user_id": user.id,
                                        "read_at": receipt.read_at.isoformat()
                                    }
                                },
                                exclude_user_id=user.id
                            )
                
                elif event_type == "REQUEST_SYNC":
                    # Client requests message sync (after reconnection)
                    conversation_id = event_data.get("conversation_id")
                    last_message_id = event_data.get("last_message_id")
                    
                    if conversation_id:
                        # Fetch messages after last_message_id
                        query = select(Message).where(
                            Message.conversation_id == conversation_id
                        )
                        
                        if last_message_id:
                            query = query.where(Message.id > last_message_id)
                        
                        query = query.order_by(Message.created_at.asc()).limit(50)
                        
                        result = await db.execute(query)
                        messages = result.scalars().all()
                        
                        # Send sync response
                        await websocket.send_json({
                            "type": "SYNC_RESPONSE",
                            "data": {
                                "conversation_id": conversation_id,
                                "messages": [
                                    {
                                        "id": msg.id,
                                        "conversation_id": msg.conversation_id,
                                        "sender_id": msg.sender_id,
                                        "content": msg.content,
                                        "type": msg.type,
                                        "created_at": msg.created_at.isoformat()
                                    }
                                    for msg in messages
                                ]
                            }
                        })
                
                else:
                    # Unknown event type
                    logger.warning(f"⚠️ Unknown event type: {event_type}")
                    await websocket.send_json({
                        "type": "ERROR",
                        "data": {
                            "message": f"Unknown event type: {event_type}",
                            "code": "UNKNOWN_EVENT"
                        }
                    })
            
            except json.JSONDecodeError:
                logger.error("❌ Invalid JSON received")
                await websocket.send_json({
                    "type": "ERROR",
                    "data": {"message": "Invalid JSON format", "code": "INVALID_JSON"}
                })
            
            except Exception as e:
                logger.error(f"❌ Event handling error: {e}")
                await websocket.send_json({
                    "type": "ERROR",
                    "data": {"message": str(e), "code": "PROCESSING_ERROR"}
                })
    
    except WebSocketDisconnect:
        logger.info(f"🔌 WebSocket disconnected | User: {user.id if user else 'Unknown'}")
    
    except Exception as e:
        logger.error(f"❌ WebSocket error: {e}")
    
    finally:
        # Cleanup on disconnect
        if user:
            await ws_manager.disconnect(connection_id, user.id)
