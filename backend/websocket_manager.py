from fastapi import WebSocket, WebSocketDisconnect
from typing import List, Dict
import json
import asyncio
from datetime import datetime

class ConnectionManager:
    def __init__(self):
        # Store active connections by item_id
        self.active_connections: Dict[str, List[WebSocket]] = {}
        # Store admin connections
        self.admin_connections: List[WebSocket] = []

    async def connect_to_item(self, websocket: WebSocket, item_id: str):
        await websocket.accept()
        if item_id not in self.active_connections:
            self.active_connections[item_id] = []
        self.active_connections[item_id].append(websocket)
        print(f"Client connected to item {item_id}. Total connections: {len(self.active_connections[item_id])}")

    async def connect_admin(self, websocket: WebSocket):
        await websocket.accept()
        self.admin_connections.append(websocket)
        print(f"Admin connected. Total admin connections: {len(self.admin_connections)}")

    def disconnect_from_item(self, websocket: WebSocket, item_id: str):
        if item_id in self.active_connections:
            if websocket in self.active_connections[item_id]:
                self.active_connections[item_id].remove(websocket)
                if not self.active_connections[item_id]:
                    del self.active_connections[item_id]
        print(f"Client disconnected from item {item_id}")

    def disconnect_admin(self, websocket: WebSocket):
        if websocket in self.admin_connections:
            self.admin_connections.remove(websocket)
        print(f"Admin disconnected. Total admin connections: {len(self.admin_connections)}")

    async def send_to_item(self, message: dict, item_id: str):
        if item_id in self.active_connections:
            disconnected = []
            for connection in self.active_connections[item_id]:
                try:
                    await connection.send_text(json.dumps(message))
                except:
                    disconnected.append(connection)
            
            # Remove disconnected connections
            for connection in disconnected:
                self.disconnect_from_item(connection, item_id)

    async def send_to_admins(self, message: dict):
        disconnected = []
        for connection in self.admin_connections:
            try:
                await connection.send_text(json.dumps(message))
            except:
                disconnected.append(connection)
        
        # Remove disconnected connections
        for connection in disconnected:
            self.disconnect_admin(connection)

    async def broadcast_new_message(self, message_data: dict):
        """Broadcast new message to relevant connections"""
        item_id = message_data.get('item_id')
        
        # Send to item-specific connections
        if item_id:
            await self.send_to_item({
                "type": "new_message",
                "data": message_data
            }, item_id)
        
        # Send to admin connections
        await self.send_to_admins({
            "type": "new_message", 
            "data": message_data
        })

    async def broadcast_status_update(self, item_id: str, new_status: str):
        """Broadcast status update to relevant connections"""
        message = {
            "type": "status_update",
            "data": {
                "item_id": item_id,
                "status": new_status,
                "timestamp": datetime.now().isoformat()
            }
        }
        
        # Send to item-specific connections
        await self.send_to_item(message, item_id)
        
        # Send to admin connections
        await self.send_to_admins(message)

# Global connection manager instance
manager = ConnectionManager()