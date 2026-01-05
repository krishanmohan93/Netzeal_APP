"""
Production-Ready WebSocket Manager for Real-Time Chat
Handles: Authentication, Reconnection, Heartbeat, Room Management
"""
from typing import Dict, List, Set, Optional
from fastapi import WebSocket, WebSocketDisconnect
import json
import asyncio
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


class WebSocketConnectionManager:
    """
    Enterprise-grade WebSocket manager with:
    - Connection pooling per user
    - Automatic heartbeat/ping-pong
    - Graceful reconnection
    - Room-based messaging
    - Presence tracking
    """
    
    def __init__(self):
        # Active connections: {user_id: {connection_id: WebSocket}}
        self.connections: Dict[int, Dict[str, WebSocket]] = {}
        
        # Room memberships: {room_id: Set[user_id]}
        self.rooms: Dict[str, Set[int]] = {}
        
        # Typing indicators: {room_id: {user_id: expiry_timestamp}}
        self.typing_status: Dict[str, Dict[int, datetime]] = {}
        
        # User presence: {user_id: {status, last_seen, connection_count}}
        self.presence: Dict[int, dict] = {}
        
        # Heartbeat tracking: {connection_id: last_ping}
        self.heartbeats: Dict[str, datetime] = {}
        
        # Connection metadata: {connection_id: {user_id, connected_at, device_info}}
        self.connection_meta: Dict[str, dict] = {}
        
    async def connect(
        self, 
        websocket: WebSocket, 
        user_id: int, 
        connection_id: str,
        device_info: Optional[dict] = None
    ):
        """
        Accept WebSocket connection with authentication
        Multiple connections per user supported (multi-device)
        """
        try:
            await websocket.accept()
            
            # Store connection
            if user_id not in self.connections:
                self.connections[user_id] = {}
            self.connections[user_id][connection_id] = websocket
            
            # Store metadata
            self.connection_meta[connection_id] = {
                "user_id": user_id,
                "connected_at": datetime.utcnow(),
                "device_info": device_info or {},
                "last_activity": datetime.utcnow()
            }
            
            # Initialize heartbeat
            self.heartbeats[connection_id] = datetime.utcnow()
            
            # Update presence
            self._update_presence(user_id, is_online=True)
            
            # Send connection success message
            await websocket.send_json({
                "type": "CONNECTION_SUCCESS",
                "data": {
                    "connection_id": connection_id,
                    "user_id": user_id,
                    "connected_at": datetime.utcnow().isoformat(),
                    "message": "WebSocket connected successfully"
                }
            })
            
            # Broadcast online status to relevant users
            await self._broadcast_presence_update(user_id, is_online=True)
            
            logger.info(
                f"✅ WebSocket connected | User: {user_id} | "
                f"Connection: {connection_id} | "
                f"Total connections: {len(self.connections[user_id])}"
            )
            
        except Exception as e:
            logger.error(f"❌ Connection error for user {user_id}: {e}")
            raise
    
    async def disconnect(self, connection_id: str, user_id: int):
        """
        Gracefully disconnect WebSocket
        Only mark user offline if all connections are closed
        """
        try:
            # Remove connection
            if user_id in self.connections and connection_id in self.connections[user_id]:
                del self.connections[user_id][connection_id]
                
                # Clean up if no more connections
                if not self.connections[user_id]:
                    del self.connections[user_id]
                    self._update_presence(user_id, is_online=False)
                    await self._broadcast_presence_update(user_id, is_online=False)
            
            # Clean up metadata
            self.connection_meta.pop(connection_id, None)
            self.heartbeats.pop(connection_id, None)
            
            # Remove from all rooms
            for room_id in list(self.rooms.keys()):
                if user_id in self.rooms[room_id]:
                    # Only remove if user has no other connections
                    if user_id not in self.connections:
                        self.rooms[room_id].discard(user_id)
                        if not self.rooms[room_id]:
                            del self.rooms[room_id]
            
            logger.info(f"🔌 WebSocket disconnected | User: {user_id} | Connection: {connection_id}")
            
        except Exception as e:
            logger.error(f"❌ Disconnect error: {e}")
    
    async def send_to_user(self, user_id: int, message: dict):
        """
        Send message to ALL connections of a specific user
        Handles multi-device scenarios
        """
        if user_id not in self.connections:
            logger.warning(f"⚠️ User {user_id} not connected")
            return False
        
        dead_connections = []
        success_count = 0
        
        for connection_id, websocket in self.connections[user_id].items():
            try:
                await websocket.send_json(message)
                success_count += 1
                
                # Update last activity
                if connection_id in self.connection_meta:
                    self.connection_meta[connection_id]["last_activity"] = datetime.utcnow()
                    
            except WebSocketDisconnect:
                logger.warning(f"⚠️ Connection {connection_id} disconnected during send")
                dead_connections.append(connection_id)
            except Exception as e:
                logger.error(f"❌ Send error to connection {connection_id}: {e}")
                dead_connections.append(connection_id)
        
        # Clean up dead connections
        for conn_id in dead_connections:
            await self.disconnect(conn_id, user_id)
        
        return success_count > 0
    
    async def broadcast_to_room(
        self, 
        room_id: str, 
        message: dict, 
        exclude_user_id: Optional[int] = None
    ):
        """
        Broadcast message to all users in a room
        Used for: chat messages, typing indicators, read receipts
        """
        if room_id not in self.rooms:
            logger.warning(f"⚠️ Room {room_id} not found")
            return
        
        broadcast_count = 0
        for user_id in self.rooms[room_id]:
            if exclude_user_id and user_id == exclude_user_id:
                continue
            
            success = await self.send_to_user(user_id, message)
            if success:
                broadcast_count += 1
        
        logger.debug(f"📤 Broadcast to room {room_id}: {broadcast_count} users reached")
    
    async def join_room(self, room_id: str, user_id: int):
        """Subscribe user to a room (conversation)"""
        if room_id not in self.rooms:
            self.rooms[room_id] = set()
        
        self.rooms[room_id].add(user_id)
        logger.info(f"➕ User {user_id} joined room {room_id}")
    
    async def leave_room(self, room_id: str, user_id: int):
        """Unsubscribe user from a room"""
        if room_id in self.rooms:
            self.rooms[room_id].discard(user_id)
            
            # Clean up empty rooms
            if not self.rooms[room_id]:
                del self.rooms[room_id]
                logger.info(f"🗑️ Room {room_id} deleted (empty)")
        
        logger.info(f"➖ User {user_id} left room {room_id}")
    
    async def handle_typing(self, room_id: str, user_id: int, is_typing: bool):
        """
        Handle typing indicators with auto-expiry
        Typing status expires after 5 seconds automatically
        """
        if is_typing:
            if room_id not in self.typing_status:
                self.typing_status[room_id] = {}
            
            # Set expiry time
            expiry = datetime.utcnow() + timedelta(seconds=5)
            self.typing_status[room_id][user_id] = expiry
        else:
            # Clear typing status
            if room_id in self.typing_status:
                self.typing_status[room_id].pop(user_id, None)
        
        # Broadcast typing event
        await self.broadcast_to_room(
            room_id,
            {
                "type": "TYPING",
                "data": {
                    "room_id": room_id,
                    "user_id": user_id,
                    "is_typing": is_typing,
                    "timestamp": datetime.utcnow().isoformat()
                }
            },
            exclude_user_id=user_id
        )
    
    async def handle_heartbeat(self, connection_id: str):
        """
        Process heartbeat/ping from client
        Respond with pong to keep connection alive
        """
        if connection_id in self.connection_meta:
            self.heartbeats[connection_id] = datetime.utcnow()
            self.connection_meta[connection_id]["last_activity"] = datetime.utcnow()
            
            # Find user and send pong
            user_id = self.connection_meta[connection_id]["user_id"]
            if user_id in self.connections and connection_id in self.connections[user_id]:
                try:
                    await self.connections[user_id][connection_id].send_json({
                        "type": "PONG",
                        "timestamp": datetime.utcnow().isoformat()
                    })
                except Exception as e:
                    logger.error(f"❌ Pong error: {e}")
    
    async def cleanup_stale_connections(self):
        """
        Background task to clean up stale connections
        Run every 30 seconds to remove dead heartbeats
        """
        while True:
            try:
                await asyncio.sleep(30)
                
                now = datetime.utcnow()
                stale_threshold = timedelta(seconds=60)
                
                stale_connections = []
                for conn_id, last_ping in self.heartbeats.items():
                    if now - last_ping > stale_threshold:
                        stale_connections.append(conn_id)
                
                # Remove stale connections
                for conn_id in stale_connections:
                    if conn_id in self.connection_meta:
                        user_id = self.connection_meta[conn_id]["user_id"]
                        await self.disconnect(conn_id, user_id)
                        logger.warning(f"🧹 Cleaned stale connection: {conn_id}")
                
                # Clean expired typing indicators
                for room_id in list(self.typing_status.keys()):
                    expired_users = [
                        uid for uid, expiry in self.typing_status[room_id].items()
                        if now > expiry
                    ]
                    for uid in expired_users:
                        del self.typing_status[room_id][uid]
                        # Broadcast typing stopped
                        await self.broadcast_to_room(
                            room_id,
                            {
                                "type": "TYPING",
                                "data": {
                                    "room_id": room_id,
                                    "user_id": uid,
                                    "is_typing": False,
                                    "timestamp": now.isoformat()
                                }
                            }
                        )
                
            except Exception as e:
                logger.error(f"❌ Cleanup error: {e}")
    
    def _update_presence(self, user_id: int, is_online: bool):
        """Update user presence status"""
        self.presence[user_id] = {
            "is_online": is_online,
            "last_seen": datetime.utcnow(),
            "connection_count": len(self.connections.get(user_id, {}))
        }
    
    async def _broadcast_presence_update(self, user_id: int, is_online: bool):
        """
        Notify relevant users about presence change
        Send to all rooms where this user is a member
        """
        message = {
            "type": "PRESENCE_UPDATE",
            "data": {
                "user_id": user_id,
                "is_online": is_online,
                "last_seen": datetime.utcnow().isoformat()
            }
        }
        
        # Find all rooms this user is in
        user_rooms = [room_id for room_id, members in self.rooms.items() if user_id in members]
        
        for room_id in user_rooms:
            await self.broadcast_to_room(room_id, message, exclude_user_id=user_id)
    
    def get_online_users(self) -> List[int]:
        """Get list of currently online user IDs"""
        return list(self.connections.keys())
    
    def get_room_members(self, room_id: str) -> Set[int]:
        """Get list of user IDs in a specific room"""
        return self.rooms.get(room_id, set())
    
    def is_user_online(self, user_id: int) -> bool:
        """Check if user has any active connections"""
        return user_id in self.connections and len(self.connections[user_id]) > 0
    
    def get_connection_stats(self) -> dict:
        """Get statistics about current connections"""
        return {
            "total_users_online": len(self.connections),
            "total_connections": sum(len(conns) for conns in self.connections.values()),
            "total_rooms": len(self.rooms),
            "active_typing": sum(len(typing) for typing in self.typing_status.values())
        }


# Global manager instance
ws_manager = WebSocketConnectionManager()
