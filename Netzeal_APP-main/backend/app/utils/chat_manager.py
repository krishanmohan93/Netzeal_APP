"""
Enhanced WebSocket connection manager with chat support
"""
from typing import Dict, List, Set, Optional
from fastapi import WebSocket
import json
import asyncio
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class ChatConnectionManager:
    """
    Manages WebSocket connections for real-time chat
    Supports: chat rooms, typing indicators, presence tracking, Redis pub/sub
    """
    
    def __init__(self):
        # User connections: {user_id: [WebSocket, ...]}
        self.active_connections: Dict[int, List[WebSocket]] = {}
        
        # Room subscriptions: {conversation_id: {user_id, ...}}
        self.room_members: Dict[int, Set[int]] = {}
        
        # Typing indicators: {conversation_id: {user_id: timestamp}}
        self.typing_users: Dict[int, Dict[int, datetime]] = {}
        
        # Online presence: {user_id: last_seen}
        self.user_presence: Dict[int, datetime] = {}
        
        # Redis client (optional - for multi-server)
        self.redis = None
        
    async def connect(self, websocket: WebSocket, user_id: int):
        """Accept WebSocket connection and track user"""
        await websocket.accept()
        
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        
        # Update presence
        self.user_presence[user_id] = datetime.utcnow()
        
        # Notify others user is online
        await self.broadcast_presence(user_id, is_online=True)
        
        logger.info(f"User {user_id} connected. Total connections: {len(self.active_connections[user_id])}")
        
    async def disconnect(self, websocket: WebSocket, user_id: int):
        """Remove WebSocket connection"""
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            
            # If no more connections, mark offline
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
                await self.broadcast_presence(user_id, is_online=False)
                logger.info(f"User {user_id} fully disconnected")
        
        # Clean up room memberships
        for room_id in list(self.room_members.keys()):
            if user_id in self.room_members[room_id]:
                self.room_members[room_id].discard(user_id)
                if not self.room_members[room_id]:
                    del self.room_members[room_id]
    
    async def join_room(self, conversation_id: int, user_id: int):
        """Subscribe user to conversation room"""
        if conversation_id not in self.room_members:
            self.room_members[conversation_id] = set()
        self.room_members[conversation_id].add(user_id)
        logger.info(f"User {user_id} joined room {conversation_id}")
    
    async def leave_room(self, conversation_id: int, user_id: int):
        """Unsubscribe user from conversation room"""
        if conversation_id in self.room_members:
            self.room_members[conversation_id].discard(user_id)
            if not self.room_members[conversation_id]:
                del self.room_members[conversation_id]
        logger.info(f"User {user_id} left room {conversation_id}")
    
    async def send_personal_message(self, message: dict, user_id: int):
        """Send message to specific user (all their connections)"""
        if user_id in self.active_connections:
            disconnected = []
            for websocket in self.active_connections[user_id]:
                try:
                    await websocket.send_json(message)
                except Exception as e:
                    logger.error(f"Error sending to user {user_id}: {e}")
                    disconnected.append(websocket)
            
            # Clean up dead connections
            for ws in disconnected:
                await self.disconnect(ws, user_id)
    
    async def broadcast_to_room(self, conversation_id: int, message: dict, exclude_user: Optional[int] = None):
        """
        Send message to all users in a conversation
        Used for: new messages, typing indicators, read receipts
        """
        if conversation_id not in self.room_members:
            return
        
        for user_id in self.room_members[conversation_id]:
            if exclude_user and user_id == exclude_user:
                continue
            await self.send_personal_message(message, user_id)
    
    async def broadcast_presence(self, user_id: int, is_online: bool):
        """
        Notify all relevant users about online/offline status
        Sends to all conversations where this user is a participant
        """
        message = {
            "type": "USER_ONLINE" if is_online else "USER_OFFLINE",
            "data": {
                "user_id": user_id,
                "timestamp": datetime.utcnow().isoformat(),
                "last_seen": self.user_presence.get(user_id, datetime.utcnow()).isoformat()
            }
        }
        
        # Find all rooms this user is in and notify participants
        for room_id, members in self.room_members.items():
            if user_id in members:
                await self.broadcast_to_room(room_id, message, exclude_user=user_id)
    
    async def handle_typing(self, conversation_id: int, user_id: int, username: str, is_typing: bool):
        """
        Handle typing indicator events
        Auto-expires after 3 seconds if not updated
        """
        if is_typing:
            if conversation_id not in self.typing_users:
                self.typing_users[conversation_id] = {}
            self.typing_users[conversation_id][user_id] = datetime.utcnow()
        else:
            if conversation_id in self.typing_users:
                self.typing_users[conversation_id].pop(user_id, None)
        
        # Broadcast to room
        message = {
            "type": "TYPING",
            "data": {
                "conversation_id": conversation_id,
                "user_id": user_id,
                "username": username,
                "is_typing": is_typing
            }
        }
        await self.broadcast_to_room(conversation_id, message, exclude_user=user_id)
    
    async def handle_new_message(self, conversation_id: int, message_data: dict):
        """
        Broadcast new message to all room members
        Clear typing indicators for sender
        """
        sender_id = message_data.get("sender_id")
        
        # Clear typing indicator
        if conversation_id in self.typing_users:
            self.typing_users[conversation_id].pop(sender_id, None)
        
        # Broadcast message
        ws_message = {
            "type": "NEW_MESSAGE",
            "data": message_data
        }
        await self.broadcast_to_room(conversation_id, ws_message)
        
        # If Redis available, publish for multi-server
        if self.redis:
            try:
                await self.redis.publish(
                    f"chat:conversation:{conversation_id}",
                    json.dumps(ws_message)
                )
            except Exception as e:
                logger.error(f"Redis publish error: {e}")
    
    async def handle_read_receipt(self, conversation_id: int, message_id: int, user_id: int):
        """Broadcast read receipt to conversation"""
        message = {
            "type": "READ_RECEIPT",
            "data": {
                "conversation_id": conversation_id,
                "message_id": message_id,
                "user_id": user_id,
                "read_at": datetime.utcnow().isoformat()
            }
        }
        await self.broadcast_to_room(conversation_id, message)
    
    def get_online_users(self) -> List[int]:
        """Get list of currently online user IDs"""
        return list(self.active_connections.keys())
    
    def is_user_online(self, user_id: int) -> bool:
        """Check if user has active connection"""
        return user_id in self.active_connections
    
    def get_room_members_count(self, conversation_id: int) -> int:
        """Get count of active users in room"""
        return len(self.room_members.get(conversation_id, set()))
    
    async def set_redis(self, redis_client):
        """
        Set Redis client for multi-server support
        Subscribes to chat channels for message distribution
        """
        self.redis = redis_client
        
        # Start listening to Redis pub/sub
        if self.redis:
            asyncio.create_task(self._redis_subscriber())
    
    async def _redis_subscriber(self):
        """
        Subscribe to Redis channels and distribute messages
        Enables horizontal scaling with multiple backend servers
        """
        if not self.redis:
            return
        
        pubsub = self.redis.pubsub()
        await pubsub.psubscribe("chat:*")
        
        logger.info("Redis pub/sub listener started for chat")
        
        async for message in pubsub.listen():
            if message["type"] == "pmessage":
                try:
                    channel = message["channel"].decode()
                    data = json.loads(message["data"])
                    
                    # Extract conversation_id from channel
                    if channel.startswith("chat:conversation:"):
                        conversation_id = int(channel.split(":")[-1])
                        await self.broadcast_to_room(conversation_id, data)
                except Exception as e:
                    logger.error(f"Redis message processing error: {e}")


# Global instance
chat_manager = ChatConnectionManager()
