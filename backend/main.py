from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional
import requests
import datetime
import pytz
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Digital Memo Tag API", version="1.0.0")

# CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://your-frontend-domain.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
security = HTTPBearer()
ADMIN_PASSWORD = "1234"

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Pydantic models
class ItemCreate(BaseModel):
    item_id: str
    name: str
    location: str
    status: str = "Working"

class Item(BaseModel):
    id: Optional[int] = None
    item_id: str
    name: str
    location: str
    status: str
    created_at: Optional[str] = None

class MessageCreate(BaseModel):
    item_id: str
    message: str
    user_name: str = "匿名"
    msg_type: str = "general"

class Message(BaseModel):
    id: Optional[int] = None
    item_id: str
    message: str
    user_name: str
    msg_type: str
    created_at: Optional[str] = None

class LoginRequest(BaseModel):
    password: str

class StatusUpdate(BaseModel):
    status: str

# Database class (extracted from your Streamlit code)
class Database:
    def __init__(self):
        self.base_url = SUPABASE_URL
        self.headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        }
        self.messages_table = "messages"
        self.items_table = "items"
    
    def get_items(self):
        try:
            response = requests.get(
                f"{self.base_url}/rest/v1/{self.items_table}?select=*&order=created_at.desc",
                headers=self.headers,
                timeout=10
            )
            if response.status_code == 200:
                return response.json()
            return []
        except Exception as e:
            print(f"Error getting items: {e}")
            return []
    
    def get_messages(self, item_id=None):
        try:
            url = f"{self.base_url}/rest/v1/{self.messages_table}?select=*&order=created_at.desc"
            if item_id:
                url += f"&item_id=eq.{item_id}"
            
            response = requests.get(url, headers=self.headers, timeout=10)
            
            if response.status_code == 200:
                messages = response.json()
                
                # Handle JSONB structure if needed
                if messages and 'payload' in messages[0]:
                    transformed_messages = []
                    for msg in messages:
                        payload = msg.get('payload', {})
                        if item_id and payload.get('item_id') != item_id:
                            continue
                        
                        transformed_msg = {
                            'item_id': payload.get('item_id', ''),
                            'message': payload.get('message', ''),
                            'user_name': payload.get('user', 'Anonymous'),
                            'msg_type': msg.get('topic', 'general'),
                            'created_at': msg.get('created_at', ''),
                            'id': msg.get('id', '')
                        }
                        transformed_messages.append(transformed_msg)
                    return transformed_messages
                else:
                    return messages
            return []
        except Exception as e:
            print(f"Error getting messages: {e}")
            return []
    
    def add_item(self, item_id, name, location, status="Working"):
        try:
            # Check if item exists
            existing_items = self.get_items()
            for item in existing_items:
                if item.get('item_id') == item_id:
                    return False, "Item ID already exists"
            
            data = {
                "item_id": item_id,
                "name": name,
                "location": location,
                "status": status,
                "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
            }
            
            response = requests.post(
                f"{self.base_url}/rest/v1/{self.items_table}",
                headers=self.headers,
                json=data,
                timeout=10
            )
            
            if response.status_code == 201:
                return True, "Success"
            else:
                return False, f"Status {response.status_code}: {response.text}"
        except Exception as e:
            return False, str(e)
    
    def add_message(self, item_id, message, user_name, msg_type="general"):
        try:
            user_name = user_name.strip() if user_name and user_name.strip() else "匿名"
            message = message.strip() if message else ""
            
            if not message:
                return False, "Message is empty"
            
            data = {
                "item_id": item_id,
                "message": message,
                "user_name": user_name,
                "msg_type": msg_type,
                "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
            }
            
            response = requests.post(
                f"{self.base_url}/rest/v1/{self.messages_table}",
                headers=self.headers,
                json=data,
                timeout=10
            )
            
            if response.status_code == 201:
                return True, "Message posted successfully"
            else:
                return False, f"Failed to post message: {response.status_code}"
                
        except Exception as e:
            return False, f"Unexpected error: {str(e)}"
    
    def update_item_status(self, item_id, status):
        try:
            data = {
                "status": status,
                "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
            }
            
            response = requests.patch(
                f"{self.base_url}/rest/v1/{self.items_table}?item_id=eq.{item_id}",
                headers=self.headers,
                json=data,
                timeout=10
            )
            
            return response.status_code in [200, 204]
        except Exception as e:
            return False
    
    def delete_item(self, item_id):
        try:
            # Delete messages first
            requests.delete(
                f"{self.base_url}/rest/v1/{self.messages_table}?item_id=eq.{item_id}",
                headers=self.headers,
                timeout=10
            )
            
            # Delete item
            response = requests.delete(
                f"{self.base_url}/rest/v1/{self.items_table}?item_id=eq.{item_id}",
                headers=self.headers,
                timeout=10
            )
            
            return response.status_code in [200, 204]
        except Exception as e:
            return False

# Initialize database
db = Database()

# Auth functions
def verify_admin_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if credentials.credentials != ADMIN_PASSWORD:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    return credentials.credentials

def format_timestamp_jst(timestamp_str):
    """Convert UTC timestamp to JST"""
    if not timestamp_str:
        return "時刻不明"
    
    try:
        if timestamp_str.endswith('Z'):
            dt_utc = datetime.datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
        elif '+00:00' in timestamp_str:
            dt_utc = datetime.datetime.fromisoformat(timestamp_str)
        else:
            dt_utc = datetime.datetime.fromisoformat(timestamp_str).replace(tzinfo=datetime.timezone.utc)
        
        jst = pytz.timezone('Asia/Tokyo')
        dt_jst = dt_utc.astimezone(jst)
        
        return dt_jst.strftime("%Y年%m月%d日 %H:%M")
    except Exception as e:
        return "時刻不明"

# API Routes

@app.get("/")
def read_root():
    return {"message": "Digital Memo Tag API"}

@app.post("/login")
def login(request: LoginRequest):
    if request.password == ADMIN_PASSWORD:
        return {"success": True, "token": ADMIN_PASSWORD}
    else:
        raise HTTPException(status_code=401, detail="Invalid password")

@app.get("/items", response_model=List[Item])
def get_items():
    items = db.get_items()
    return items

@app.get("/items/{item_id}")
def get_item(item_id: str):
    items = db.get_items()
    for item in items:
        if item.get('item_id') == item_id:
            return item
    raise HTTPException(status_code=404, detail="Item not found")

@app.post("/items")
def create_item(item: ItemCreate, _: str = Depends(verify_admin_token)):
    success, message = db.add_item(item.item_id, item.name, item.location, item.status)
    if success:
        return {"success": True, "message": message}
    else:
        raise HTTPException(status_code=400, detail=message)

@app.patch("/items/{item_id}/status")
async def update_item_status(item_id: str, status_update: StatusUpdate, _: str = Depends(verify_admin_token)):
    success = db.update_item_status(item_id, status_update.status)
    if success:
        # Broadcast status update via WebSocket
        await manager.broadcast_status_update(item_id, status_update.status)
        return {"success": True, "message": "Status updated"}
    else:
        raise HTTPException(status_code=400, detail="Failed to update status")

# WebSocket endpoints
@app.websocket("/ws/item/{item_id}")
async def websocket_item_endpoint(websocket: WebSocket, item_id: str):
    await manager.connect_to_item(websocket, item_id)
    try:
        while True:
            # Keep connection alive by waiting for messages
            data = await websocket.receive_text()
            # Echo received data (heartbeat)
            await websocket.send_text(f"Connected to item {item_id}")
    except WebSocketDisconnect:
        manager.disconnect_from_item(websocket, item_id)

@app.websocket("/ws/admin")
async def websocket_admin_endpoint(websocket: WebSocket):
    await manager.connect_admin(websocket)
    try:
        while True:
            # Keep connection alive by waiting for messages
            data = await websocket.receive_text()
            # Echo received data (heartbeat)
            await websocket.send_text("Admin connected")
    except WebSocketDisconnect:
        manager.disconnect_admin(websocket)

@app.delete("/items/{item_id}")
def delete_item(item_id: str, _: str = Depends(verify_admin_token)):
    success = db.delete_item(item_id)
    if success:
        return {"success": True, "message": "Item deleted"}
    else:
        raise HTTPException(status_code=400, detail="Failed to delete item")

@app.get("/messages", response_model=List[Message])
def get_messages(item_id: Optional[str] = None):
    messages = db.get_messages(item_id)
    # Add formatted timestamp to each message
    for msg in messages:
        msg['formatted_time'] = format_timestamp_jst(msg.get('created_at', ''))
    return messages

@app.post("/messages")
def create_message(message: MessageCreate):
    success, error_msg = db.add_message(
        message.item_id, 
        message.message, 
        message.user_name, 
        message.msg_type
    )
    if success:
        return {"success": True, "message": "Message posted successfully"}
    else:
        raise HTTPException(status_code=400, detail=error_msg)

@app.get("/health")
def health_check():
    return {"status": "healthy", "timestamp": datetime.datetime.now().isoformat()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)