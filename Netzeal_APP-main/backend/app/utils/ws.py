from typing import Dict, List
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self) -> None:
        # Map user_id to list of active websockets (user might have multiple tabs/devices)
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)

    def disconnect(self, websocket: WebSocket, user_id: int):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def send_personal_message(self, message: dict, user_id: int):
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    # Connection might be dead, but disconnect logic usually handles it
                    pass

    async def broadcast_json(self, data):
        for user_sockets in self.active_connections.values():
            for ws in user_sockets:
                try:
                    await ws.send_json(data)
                except Exception:
                    pass

manager = ConnectionManager()
