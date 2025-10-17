from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from fastapi.responses import JSONResponse
import datetime
import pytz
import os
from dotenv import load_dotenv
import resend
import json
from starlette.responses import Response
from appwrite.client import Client
from appwrite.services.databases import Databases
from appwrite.query import Query
from appwrite.id import ID
from appwrite.exception import AppwriteException

load_dotenv()

app = FastAPI(title="Digital Memo Tag API with Appwrite", version="2.0.0")

app = FastAPI(title="Digital Memo Tag API with Appwrite", version="2.0.0")

class UnicodeJSONResponse(Response):
    media_type = "application/json"
    
    def render(self, content) -> bytes:
        return json.dumps(
            content,
            ensure_ascii=False,
            allow_nan=False,
            indent=None,
            separators=(",", ":"),
        ).encode("utf-8")

# Set as default response class
app = FastAPI(
    title="Digital Memo Tag API with Appwrite", 
    version="2.0.0",
    default_response_class=UnicodeJSONResponse
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https://.*\.vercel\.app",  # ✅ Allow all Vercel URLs
    allow_origins=[
        "http://localhost:3000",
        "https://digitalmemotag.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
security = HTTPBearer()
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "1234")

# Appwrite configuration
APPWRITE_ENDPOINT = os.getenv("APPWRITE_ENDPOINT", "https://cloud.appwrite.io/v1")
APPWRITE_PROJECT_ID = os.getenv("APPWRITE_PROJECT_ID")
APPWRITE_API_KEY = os.getenv("APPWRITE_API_KEY")
DATABASE_ID = os.getenv("APPWRITE_DATABASE_ID", "memo_tag_db")

# Collection IDs
ITEMS_COLLECTION = os.getenv("APPWRITE_ITEMS_COLLECTION", "items")
MESSAGES_COLLECTION = os.getenv("APPWRITE_MESSAGES_COLLECTION", "messages")
SUBSCRIPTIONS_COLLECTION = os.getenv("APPWRITE_SUBSCRIPTIONS_COLLECTION", "email_subscriptions")

# Resend configuration
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
RESEND_FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL", "onboarding@resend.dev")

# Initialize Appwrite
client = Client()
client.set_endpoint(APPWRITE_ENDPOINT)
client.set_project(APPWRITE_PROJECT_ID)
client.set_key(APPWRITE_API_KEY)

databases = Databases(client)

# Initialize Resend
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

print("="*60)
print("🚀 Digital Memo Tag API with Appwrite + Resend")
print("="*60)
print(f"✅ Appwrite Endpoint: {APPWRITE_ENDPOINT}")
print(f"✅ Project ID: {APPWRITE_PROJECT_ID}")
print(f"✅ Database ID: {DATABASE_ID}")
print(f"✅ Resend: {'Configured' if RESEND_API_KEY else 'Not configured'}")
print("="*60)

# Pydantic models
class ItemCreate(BaseModel):
    item_id: str
    name: str
    location: str
    status: str = "Working"

class Item(BaseModel):
    id: Optional[str] = None
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
    send_notification: bool = False

class Message(BaseModel):
    id: Optional[str] = None
    item_id: str
    message: str
    user_name: str
    msg_type: str
    created_at: Optional[str] = None

class LoginRequest(BaseModel):
    password: str

class StatusUpdate(BaseModel):
    status: str

class EmailSubscription(BaseModel):
    item_id: str
    email: EmailStr
    notify_all: bool = False

# Email notification function with Resend
def send_email_notification(to_email: str, item_name: str, item_id: str, message: str, user_name: str):
    """Send email notification using Resend"""
    
    if not RESEND_API_KEY:
        print("⚠️  Warning: Resend API key not configured")
        return False
    
    try:
        current_time = datetime.datetime.now(pytz.timezone('Asia/Tokyo')).strftime('%Y年%m月%d日 %H:%M')
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center;">
                    <h1 style="margin: 0; font-size: 24px; font-weight: 600;">📱 デジタルメモタグシステム</h1>
                    <p style="margin: 10px 0 0 0; font-size: 14px; opacity: 0.95;">新しいメッセージが投稿されました</p>
                </div>
                
                <!-- Content -->
                <div style="padding: 30px 20px;">
                    <!-- Alert Box -->
                    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin-bottom: 25px; border-radius: 4px;">
                        <p style="margin: 0; color: #92400e; font-weight: 600; font-size: 14px;">⚠️ 緊急メッセージ</p>
                        <p style="margin: 5px 0 0 0; color: #92400e; font-size: 13px;">至急ご確認ください</p>
                    </div>
                    
                    <!-- Item Info Card -->
                    <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
                        <h2 style="margin: 0 0 15px 0; font-size: 16px; color: #374151; font-weight: 600;">📋 機器情報</h2>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 8px 0; font-weight: 500; color: #6b7280; font-size: 14px; width: 90px;">機器名</td>
                                <td style="padding: 8px 0; color: #111827; font-size: 14px;">{item_name}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; font-weight: 500; color: #6b7280; font-size: 14px;">機器ID</td>
                                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-family: 'Courier New', monospace;">{item_id}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; font-weight: 500; color: #6b7280; font-size: 14px;">投稿者</td>
                                <td style="padding: 8px 0; color: #111827; font-size: 14px;">{user_name}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; font-weight: 500; color: #6b7280; font-size: 14px;">日時</td>
                                <td style="padding: 8px 0; color: #111827; font-size: 14px;">{current_time}</td>
                            </tr>
                        </table>
                    </div>
                    
                    <!-- Message Content -->
                    <div style="background-color: #ffffff; border: 2px solid #667eea; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
                        <h3 style="margin: 0 0 12px 0; font-size: 15px; color: #374151; font-weight: 600;">💬 メッセージ内容</h3>
                        <p style="margin: 0; color: #111827; line-height: 1.6; white-space: pre-wrap; font-size: 14px;">{message}</p>
                    </div>
                    
                    <!-- Action Button -->
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="http://localhost:3000/memo/{item_id}" 
                           style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                                  color: white; padding: 14px 40px; text-decoration: none; border-radius: 8px; 
                                  font-weight: 600; font-size: 15px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.4);">
                            📋 メッセージボードを開く
                        </a>
                    </div>
                    
                    <!-- Help Text -->
                    <div style="background-color: #eff6ff; border-radius: 8px; padding: 15px; margin-top: 25px;">
                        <p style="margin: 0; font-size: 13px; color: #1e40af; line-height: 1.5;">
                            💡 <strong>ヒント:</strong> このメールに返信することはできません。メッセージボードから返信してください。
                        </p>
                    </div>
                </div>
                
                <!-- Footer -->
                <div style="background-color: #f9fafb; padding: 25px 20px; text-align: center; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0 0 8px 0; font-size: 12px; color: #6b7280;">
                        このメールは自動送信されています
                    </p>
                    <p style="margin: 0 0 15px 0; font-size: 12px; color: #9ca3af;">
                        デジタルメモタグシステム © 2024
                    </p>
                    <div style="margin-top: 15px;">
                        <a href="#" style="color: #667eea; text-decoration: none; font-size: 11px; margin: 0 8px;">通知設定</a>
                        <span style="color: #d1d5db;">•</span>
                        <a href="#" style="color: #667eea; text-decoration: none; font-size: 11px; margin: 0 8px;">ヘルプ</a>
                        <span style="color: #d1d5db;">•</span>
                        <a href="#" style="color: #667eea; text-decoration: none; font-size: 11px; margin: 0 8px;">配信停止</a>
                    </div>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Send email using Resend
        params = {
            "from": RESEND_FROM_EMAIL,
            "to": [to_email],
            "subject": f"🔔 新規メッセージ通知: {item_name}",
            "html": html_content,
        }
        
        email = resend.Emails.send(params)
        
        print(f"✅ Email sent to {to_email} - ID: {email.get('id', 'N/A')}")
        return True
        
    except Exception as e:
        print(f"❌ Error sending email to {to_email}: {str(e)}")
        return False

# Database class with Appwrite
class Database:
    def __init__(self):
        self.databases = databases
        self.database_id = DATABASE_ID
        self.items_collection = ITEMS_COLLECTION
        self.messages_collection = MESSAGES_COLLECTION
        self.subscriptions_collection = SUBSCRIPTIONS_COLLECTION
    
    def get_items(self):
        """Get all items"""
        try:
            result = self.databases.list_documents(
                database_id=self.database_id,
                collection_id=self.items_collection,
                queries=[
                    Query.order_desc('$createdAt'),  # ✅ FIXED: Use $createdAt
                    Query.limit(100)
                ]
            )
            
            items = []
            for doc in result['documents']:
                item = {
                    'id': doc['$id'],
                    'item_id': doc['item_id'],
                    'name': doc['name'],
                    'location': doc['location'],
                    'status': doc['status'],
                    'created_at': doc.get('$createdAt'),  # ✅ FIXED: Use $createdAt
                    'updated_at': doc.get('$updatedAt')   # ✅ FIXED: Use $updatedAt
                }
                items.append(item)
            
            return items
        except AppwriteException as e:
            print(f"❌ Appwrite error getting items: {e.message}")
            return []
        except Exception as e:
            print(f"❌ Error getting items: {e}")
            return []
    
    def get_item_by_id(self, item_id: str):
        """Get single item by item_id"""
        try:
            result = self.databases.list_documents(
                database_id=self.database_id,
                collection_id=self.items_collection,
                queries=[
                    Query.equal('item_id', item_id),
                    Query.limit(1)
                ]
            )
            
            if result['total'] > 0:
                doc = result['documents'][0]
                return {
                    'id': doc['$id'],
                    'item_id': doc['item_id'],
                    'name': doc['name'],
                    'location': doc['location'],
                    'status': doc['status'],
                    'created_at': doc.get('$createdAt')  # ✅ FIXED: Use $createdAt
                }
            return None
        except Exception as e:
            print(f"❌ Error getting item: {e}")
            return None
    
    def get_messages(self, item_id=None):
        """Get messages, optionally filtered by item_id"""
        try:
            queries = [
                Query.order_desc('$createdAt'),  # ✅ FIXED: Use $createdAt
                Query.limit(100)
            ]
            
            if item_id:
                queries.append(Query.equal('item_id', item_id))
            
            result = self.databases.list_documents(
                database_id=self.database_id,
                collection_id=self.messages_collection,
                queries=queries
            )
            
            messages = []
            for doc in result['documents']:
                msg = {
                    'id': doc['$id'],
                    'item_id': doc['item_id'],
                    'message': doc['message'],
                    'user_name': doc.get('user_name', '匿名'),
                    'msg_type': doc.get('msg_type', 'general'),
                    'created_at': doc.get('$createdAt')  # ✅ FIXED: Use $createdAt
                }
                messages.append(msg)
            
            return messages
        except Exception as e:
            print(f"❌ Error getting messages: {e}")
            return []
    
    def add_item(self, item_id, name, location, status="Working"):
        """Add new item"""
        try:
            existing = self.get_item_by_id(item_id)
            if existing:
                return False, "Item ID already exists"
            
            doc = self.databases.create_document(
                database_id=self.database_id,
                collection_id=self.items_collection,
                document_id=ID.unique(),
                data={
                    'item_id': item_id,
                    'name': name,
                    'location': location,
                    'status': status
                }
            )
            
            print(f"✅ Added item: {item_id} - {name}")
            return True, "Success"
        except AppwriteException as e:
            print(f"❌ Appwrite error adding item: {e.message}")
            return False, e.message
        except Exception as e:
            print(f"❌ Error adding item: {e}")
            return False, str(e)
    
    def add_message(self, item_id, message, user_name, msg_type="general", send_notification=False):
        """Add new message and optionally send notifications"""
        try:
            user_name = user_name.strip() if user_name and user_name.strip() else "匿名"
            message = message.strip() if message else ""
            
            if not message:
                return False, "Message is empty"
            
            doc = self.databases.create_document(
                database_id=self.database_id,
                collection_id=self.messages_collection,
                document_id=ID.unique(),
                data={
                    'item_id': item_id,
                    'message': message,
                    'user_name': user_name,
                    'msg_type': msg_type
                }
            )
            
            print(f"✅ Message added: {item_id} by {user_name}")
            
            if send_notification:
                print(f"📧 Sending notifications for item: {item_id}")
                self.send_notifications_for_item(item_id, message, user_name)
            
            return True, "Message posted successfully"
            
        except AppwriteException as e:
            print(f"❌ Appwrite error adding message: {e.message}")
            return False, f"Failed to post message: {e.message}"
        except Exception as e:
            print(f"❌ Error adding message: {e}")
            return False, f"Unexpected error: {str(e)}"
    
    def send_notifications_for_item(self, item_id, message, user_name):
        """Send email notifications to subscribed users"""
        try:
            item = self.get_item_by_id(item_id)
            if not item:
                print(f"⚠️  Item not found: {item_id}")
                return
            
            item_name = item['name']
            subscribers = self.get_subscriptions(item_id)
            
            if not subscribers:
                print(f"ℹ️  No subscribers for item: {item_id}")
                return
            
            print(f"📧 Sending notifications to {len(subscribers)} subscriber(s)")
            
            success_count = 0
            for sub in subscribers:
                email = sub.get('email')
                if email:
                    if send_email_notification(email, item_name, item_id, message, user_name):
                        success_count += 1
            
            print(f"✅ Sent {success_count}/{len(subscribers)} notifications")
                    
        except Exception as e:
            print(f"❌ Error sending notifications: {e}")
    
    def add_subscription(self, item_id, email, notify_all=False):
        """Add email subscription for an item"""
        try:
            existing = self.get_subscriptions(item_id)
            for sub in existing:
                if sub.get('email') == email:
                    return False, "Already subscribed"
            
            doc = self.databases.create_document(
                database_id=self.database_id,
                collection_id=self.subscriptions_collection,
                document_id=ID.unique(),
                data={
                    'item_id': item_id,
                    'email': email,
                    'notify_all': notify_all
                }
            )
            
            print(f"✅ Subscription added: {email} for {item_id}")
            return True, "Subscription added"
            
        except AppwriteException as e:
            print(f"❌ Appwrite error adding subscription: {e.message}")
            return False, e.message
        except Exception as e:
            print(f"❌ Error adding subscription: {e}")
            return False, str(e)
    
    def get_subscriptions(self, item_id=None):
        """Get email subscriptions, optionally filtered by item_id"""
        try:
            queries = [Query.limit(100)]
            
            if item_id:
                queries.append(Query.equal('item_id', item_id))
            
            result = self.databases.list_documents(
                database_id=self.database_id,
                collection_id=self.subscriptions_collection,
                queries=queries
            )
            
            subscriptions = []
            for doc in result['documents']:
                sub = {
                    'id': doc['$id'],
                    'item_id': doc['item_id'],
                    'email': doc['email'],
                    'notify_all': doc.get('notify_all', False)
                }
                subscriptions.append(sub)
            
            return subscriptions
        except Exception as e:
            print(f"❌ Error getting subscriptions: {e}")
            return []
    
    def delete_subscription(self, item_id, email):
        """Remove email subscription"""
        try:
            subscriptions = self.get_subscriptions(item_id)
            
            for sub in subscriptions:
                if sub['email'] == email:
                    self.databases.delete_document(
                        database_id=self.database_id,
                        collection_id=self.subscriptions_collection,
                        document_id=sub['id']
                    )
                    print(f"✅ Subscription removed: {email} from {item_id}")
                    return True
            
            print(f"⚠️  Subscription not found: {email} for {item_id}")
            return False
            
        except Exception as e:
            print(f"❌ Error deleting subscription: {e}")
            return False
    
    def update_item_status(self, item_id, status):
        """Update item status"""
        try:
            item = self.get_item_by_id(item_id)
            
            if not item:
                return False
            
            self.databases.update_document(
                database_id=self.database_id,
                collection_id=self.items_collection,
                document_id=item['id'],
                data={
                    'status': status
                }
            )
            
            print(f"✅ Status updated: {item_id} -> {status}")
            return True
            
        except Exception as e:
            print(f"❌ Error updating status: {e}")
            return False
    
    def delete_item(self, item_id):
        """Delete item and all related data"""
        try:
            item = self.get_item_by_id(item_id)
            
            if not item:
                return False
            
            messages = self.get_messages(item_id)
            for msg in messages:
                self.databases.delete_document(
                    database_id=self.database_id,
                    collection_id=self.messages_collection,
                    document_id=msg['id']
                )
            
            subscriptions = self.get_subscriptions(item_id)
            for sub in subscriptions:
                self.databases.delete_document(
                    database_id=self.database_id,
                    collection_id=self.subscriptions_collection,
                    document_id=sub['id']
                )
            
            self.databases.delete_document(
                database_id=self.database_id,
                collection_id=self.items_collection,
                document_id=item['id']
            )
            
            print(f"✅ Item deleted: {item_id} (including {len(messages)} messages and {len(subscriptions)} subscriptions)")
            return True
            
        except Exception as e:
            print(f"❌ Error deleting item: {e}")
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
    return {
        "message": "Digital Memo Tag API with Appwrite + Resend",
        "version": "2.0.0",
        "database": "Appwrite",
        "email": "Resend" if RESEND_API_KEY else "Not configured"
    }

@app.post("/login")
def login(request: LoginRequest):
    if request.password == ADMIN_PASSWORD:
        return {"success": True, "token": ADMIN_PASSWORD}
    else:
        raise HTTPException(status_code=401, detail="Invalid password")

@app.get("/items")
def get_items():
    items = db.get_items()
    return JSONResponse(content=items, media_type="application/json; charset=utf-8")

@app.get("/items/{item_id}")
def get_item(item_id: str):
    item = db.get_item_by_id(item_id)
    if item:
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
def update_item_status(item_id: str, status_update: StatusUpdate, _: str = Depends(verify_admin_token)):
    success = db.update_item_status(item_id, status_update.status)
    if success:
        return {"success": True, "message": "Status updated"}
    else:
        raise HTTPException(status_code=400, detail="Failed to update status")

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
    for msg in messages:
        msg['formatted_time'] = format_timestamp_jst(msg.get('created_at', ''))
    return messages

@app.post("/messages")
def create_message(message: MessageCreate):
    success, error_msg = db.add_message(
        message.item_id, 
        message.message, 
        message.user_name, 
        message.msg_type,
        message.send_notification
    )
    if success:
        return {"success": True, "message": "Message posted successfully"}
    else:
        raise HTTPException(status_code=400, detail=error_msg)
    
@app.delete("/messages/{message_id}")    
def delete_message(message_id: str, _: str = Depends(verify_admin_token)):
    """Delete a specific message"""
    try:
        db.databases.delete_document(
            database_id=DATABASE_ID,
            collection_id=MESSAGES_COLLECTION,
            document_id=message_id
        )
        return {"success": True, "message": "Message deleted"}
    except Exception as e:
        print(f"❌ Error deleting message: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to delete message: {str(e)}")

@app.post("/subscriptions")
def add_subscription(subscription: EmailSubscription):
    success, message = db.add_subscription(
        subscription.item_id,
        subscription.email,
        subscription.notify_all
    )
    if success:
        return {"success": True, "message": message}
    else:
        raise HTTPException(status_code=400, detail=message)

@app.get("/subscriptions/{item_id}")
def get_subscriptions(item_id: str):
    subscriptions = db.get_subscriptions(item_id)
    return subscriptions

@app.delete("/subscriptions/{item_id}/{email}")
def delete_subscription(item_id: str, email: str, _: str = Depends(verify_admin_token)):
    success = db.delete_subscription(item_id, email)
    if success:
        return {"success": True, "message": "Subscription removed"}
    else:
        raise HTTPException(status_code=400, detail="Failed to remove subscription")

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.datetime.now().isoformat(),
        "database": "Appwrite",
        "email": "Resend configured" if RESEND_API_KEY else "Resend not configured"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)