from fastapi import FastAPI, HTTPException, Depends, status, Query
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
from appwrite.query import Query as AppwriteQuery
from appwrite.id import ID
from appwrite.exception import AppwriteException

load_dotenv()

VERSION = "2.0.1"

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

app = FastAPI(
    title="Digital Memo Tag API with Appwrite", 
    version=VERSION,
    default_response_class=UnicodeJSONResponse
)

# CORS middleware
origins = [
    "http://localhost:3000",
    "http://localhost:8000",
    "https://digitalmemotag.vercel.app",
    "https://memotag.digital",
    "https://www.memotag.digital",
    "https://digitalmemotag-backend.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
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
ADMIN_EMAIL_STRING = os.getenv("ADMIN_EMAIL", "")
ADMIN_EMAILS = [email.strip() for email in ADMIN_EMAIL_STRING.split(',') if email.strip()]

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
print(f"✅ Items Collection: {ITEMS_COLLECTION}")
print(f"✅ Resend: {'Configured' if RESEND_API_KEY else 'Not configured'}")
if ADMIN_EMAILS:
    print(f"✅ Admin Emails: {len(ADMIN_EMAILS)} configured")
else:
    print("⚠️ Admin Email: Not configured")
print("="*60)

# Pydantic models
class ItemCreate(BaseModel):
    item_id: str
    name: str
    location: str
    status: str = "Working"
    user_email: Optional[str] = None
    total_pieces: Optional[int] = None
    target_date: Optional[str] = None
    progress: Optional[int] = 0

class Item(BaseModel):
    id: Optional[str] = None
    item_id: str
    name: str
    location: str
    status: str
    user_email: Optional[str] = None
    total_pieces: Optional[int] = None
    target_date: Optional[str] = None
    progress: Optional[int] = 0
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

class ProgressUpdate(BaseModel):
    progress: int

class EmailSubscription(BaseModel):
    item_id: str
    email: EmailStr
    notify_all: bool = False

# Email notification function
def send_email_notification(to_email: str, item_name: str, item_id: str, message: str, user_name: str):
    """Send email notification using Resend"""
    
    print("="*60)
    print("📧 SEND EMAIL NOTIFICATION")
    print("="*60)
    print(f"To: {to_email}")
    print(f"From: {RESEND_FROM_EMAIL}")
    print(f"Item: {item_name} ({item_id})")
    print(f"User: {user_name}")
    print(f"Message: {message[:50]}...")
    print(f"Resend API Key exists: {bool(RESEND_API_KEY)}")
    print(f"Resend API Key length: {len(RESEND_API_KEY) if RESEND_API_KEY else 0}")
    print("="*60)
    
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
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center;">
                    <h1 style="margin: 0; font-size: 24px; font-weight: 600;">📱 デジタルメモタグシステム</h1>
                    <p style="margin: 10px 0 0 0; font-size: 14px; opacity: 0.95;">新しいメッセージが投稿されました</p>
                </div>
                
                <div style="padding: 30px 20px;">
                    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin-bottom: 25px; border-radius: 4px;">
                        <p style="margin: 0; color: #92400e; font-weight: 600; font-size: 14px;">⚠️ 新しいメッセージ</p>
                        <p style="margin: 5px 0 0 0; color: #92400e; font-size: 13px;">ご確認ください</p>
                    </div>
                    
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
                    
                    <div style="background-color: #ffffff; border: 2px solid #667eea; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
                        <h3 style="margin: 0 0 12px 0; font-size: 15px; color: #374151; font-weight: 600;">💬 メッセージ内容</h3>
                        <p style="margin: 0; color: #111827; line-height: 1.6; white-space: pre-wrap; font-size: 14px;">{message}</p>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="https://memotag.digital/memo/{item_id}" 
                           style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                                  color: white; padding: 14px 40px; text-decoration: none; border-radius: 8px; 
                                  font-weight: 600; font-size: 15px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.4);">
                            📋 メッセージボードを開く
                        </a>
                    </div>
                    
                    <div style="background-color: #eff6ff; border-radius: 8px; padding: 15px; margin-top: 25px;">
                        <p style="margin: 0; font-size: 13px; color: #1e40af; line-height: 1.5;">
                            💡 <strong>ヒント:</strong> このメールに返信することはできません。メッセージボードから返信してください。
                        </p>
                    </div>
                </div>
                
                <div style="background-color: #f9fafb; padding: 25px 20px; text-align: center; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0 0 8px 0; font-size: 12px; color: #6b7280;">
                        このメールは自動送信されています
                    </p>
                    <p style="margin: 0 0 15px 0; font-size: 12px; color: #9ca3af;">
                        デジタルメモタグシステム © 2025
                    </p>
                </div>
            </div>
        </body>
        </html>
        """
        
        params = {
            "from": RESEND_FROM_EMAIL,
            "to": [to_email],
            "subject": f"🔔 新規メッセージ通知: {item_name}",
            "html": html_content,
        }
        
        print(f"📤 Sending email via Resend...")
        print(f"   From: {params['from']}")
        print(f"   To: {params['to']}")
        print(f"   Subject: {params['subject']}")
        
        email_response = resend.Emails.send(params)
        
        print(f"✅ Resend Response: {email_response}")
        print(f"   Email ID: {email_response.get('id', 'N/A')}")
        print("="*60)
        
        return True
        
    except Exception as e:
        print(f"❌ Error sending email to {to_email}")
        print(f"   Error type: {type(e).__name__}")
        print(f"   Error message: {str(e)}")
        print(f"   Full error: {repr(e)}")
        print("="*60)
        return False

# Database class
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
                    AppwriteQuery.order_desc('$createdAt'),
                    AppwriteQuery.limit(100)
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
                    'user_email': doc.get('user_email'),
                    'total_pieces': doc.get('total_pieces'),
                    'target_date': doc.get('target_date'),
                    'progress': doc.get('progress', 0),
                    'created_at': doc.get('$createdAt'),
                    'updated_at': doc.get('$updatedAt')
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
                    AppwriteQuery.equal('item_id', item_id),
                    AppwriteQuery.limit(1)
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
                    'user_email': doc.get('user_email'),
                    'total_pieces': doc.get('total_pieces'),
                    'target_date': doc.get('target_date'),
                    'progress': doc.get('progress', 0),
                    'created_at': doc.get('$createdAt')
                }
            return None
        except Exception as e:
            print(f"❌ Error getting item: {e}")
            return None
    
    def get_messages(self, item_id=None):
        """Get messages, optionally filtered by item_id"""
        try:
            queries = [
                AppwriteQuery.order_desc('$createdAt'),
                AppwriteQuery.limit(100)
            ]
            
            if item_id:
                queries.append(AppwriteQuery.equal('item_id', item_id))
            
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
                    'created_at': doc.get('$createdAt')
                }
                messages.append(msg)
            
            return messages
        except Exception as e:
            print(f"❌ Error getting messages: {e}")
            return []
    
    def add_item(self, item_id, name, location, status="Working", user_email=None, 
                 total_pieces=None, target_date=None, progress=0):
        """Add new item"""
        try:
            existing = self.get_item_by_id(item_id)
            if existing:
                return False, "Item ID already exists"
            
            data = {
                'item_id': item_id,
                'name': name,
                'location': location,
                'status': status,
                'progress': progress
            }
            
            if user_email:
                data['user_email'] = user_email
            if total_pieces is not None:
                data['total_pieces'] = total_pieces
            if target_date:
                data['target_date'] = target_date
            
            doc = self.databases.create_document(
                database_id=self.database_id,
                collection_id=self.items_collection,
                document_id=ID.unique(),
                data=data
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
        """Add new message and optionally send notifications to multiple recipients"""
        try:
            user_name = user_name.strip() if user_name and user_name.strip() else "匿名"
            message = message.strip() if message else ""
            
            if not message:
                return False, "Message is empty"
            
            item = self.get_item_by_id(item_id)
            if not item:
                return False, "Item not found"
            
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
            print(f"📧 Send notification requested: {send_notification}")
            
            # Send email notification if requested
            if send_notification:
                print("\n" + "="*60)
                print("📧 EMAIL NOTIFICATION FLOW")
                print("="*60)
                
                item_name = item['name']
                user_email_string = item.get('user_email', '')
                
                print(f"Item: {item_name}")
                print(f"User who posted: {user_name}")
                print(f"Item user_email field: '{user_email_string}'")
                print(f"Admin emails configured: {ADMIN_EMAILS}")
                print(f"Number of admin emails: {len(ADMIN_EMAILS)}")
                
                # Parse multiple user emails (comma-separated)
                user_emails = [email.strip() for email in user_email_string.split(',') if email.strip()] if user_email_string else []
                print(f"Parsed user emails: {user_emails}")
                print(f"Number of user emails: {len(user_emails)}")
                
                # Determine recipient based on who posted
                if user_name in ['管理者', 'admin', 'Admin', 'Administrator']:
                    print("\n🔵 ADMIN → USER notification")
                    # Admin posted - send to ALL user emails
                    if user_emails:
                        print(f"📧 Sending notification from admin to {len(user_emails)} user(s)")
                        success_count = 0
                        for user_email in user_emails:
                            print(f"\n   Sending to: {user_email}")
                            if send_email_notification(user_email, item_name, item_id, message, user_name):
                                success_count += 1
                                print(f"   ✅ Sent successfully to {user_email}")
                            else:
                                print(f"   ❌ Failed to send to {user_email}")
                        print(f"\n✅ Total sent: {success_count}/{len(user_emails)} user(s)")
                    else:
                        print("⚠️ No user emails configured for this item")
                        print("   Item user_email field is empty or invalid")
                else:
                    print("\n🔵 USER → ADMIN notification")
                    # User posted - send to ALL admins
                    if ADMIN_EMAILS:
                        print(f"📧 Sending notification from user to {len(ADMIN_EMAILS)} admin(s)")
                        success_count = 0
                        for admin_email in ADMIN_EMAILS:
                            print(f"\n   Sending to admin: {admin_email}")
                            if send_email_notification(admin_email, item_name, item_id, message, user_name):
                                success_count += 1
                                print(f"   ✅ Sent successfully to {admin_email}")
                            else:
                                print(f"   ❌ Failed to send to {admin_email}")
                        print(f"\n✅ Total sent: {success_count}/{len(ADMIN_EMAILS)} admin(s)")
                    else:
                        print("⚠️ No admin emails configured")
                        print("   ADMIN_EMAIL environment variable is not set")
                
                print("="*60 + "\n")
            
            return True, "Message posted successfully"
            
        except AppwriteException as e:
            print(f"❌ Appwrite error adding message: {e.message}")
            return False, f"Failed to post message: {e.message}"
        except Exception as e:
            print(f"❌ Error adding message: {e}")
            return False, f"Unexpected error: {str(e)}"
    
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
                data={'status': status}
            )
            
            print(f"✅ Status updated: {item_id} -> {status}")
            return True
            
        except Exception as e:
            print(f"❌ Error updating status: {e}")
            return False
    
    def update_item_progress(self, item_id, progress):
        """Update item progress"""
        try:
            item = self.get_item_by_id(item_id)
            if not item:
                print(f"❌ Item not found: {item_id}")
                return False
            
            self.databases.update_document(
                database_id=self.database_id,
                collection_id=self.items_collection,
                document_id=item['id'],
                data={'progress': progress}
            )
            
            print(f"✅ Progress updated: {item_id} -> {progress}%")
            return True
            
        except AppwriteException as e:
            print(f"❌ Appwrite error updating progress: {e.message}")
            return False
        except Exception as e:
            print(f"❌ Error updating progress: {e}")
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
            
            self.databases.delete_document(
                database_id=self.database_id,
                collection_id=self.items_collection,
                document_id=item['id']
            )
            
            print(f"✅ Item deleted: {item_id}")
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

# ===== API ROUTES =====

@app.get("/")
def read_root():
    return {
        "message": "Digital Memo Tag API with Appwrite + Resend",
        "version": VERSION,  
        "database": "Appwrite",
        "email": "Resend" if RESEND_API_KEY else "Not configured"
    }

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.datetime.now().isoformat(),
        "database": "Appwrite",
        "email": "Resend configured" if RESEND_API_KEY else "Resend not configured"
    }

@app.get("/debug/appwrite")
def debug_appwrite():
    """Debug endpoint to check Appwrite connection"""
    try:
        config_info = {
            "endpoint": APPWRITE_ENDPOINT,
            "project_id": APPWRITE_PROJECT_ID,
            "database_id": DATABASE_ID,
            "items_collection": ITEMS_COLLECTION,
            "api_key_exists": bool(APPWRITE_API_KEY),
            "api_key_length": len(APPWRITE_API_KEY) if APPWRITE_API_KEY else 0
        }
        
        result = databases.list_documents(
            database_id=DATABASE_ID,
            collection_id=ITEMS_COLLECTION,
            queries=[AppwriteQuery.limit(2)]
        )
        
        return {
            "success": True,
            "config": config_info,
            "total_documents": result.get('total', 0),
            "documents_preview": result.get('documents', [])[:2]
        }
    except AppwriteException as e:
        return {
            "success": False,
            "error": e.message,
            "code": e.code,
            "config": config_info
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__
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
    success, message = db.add_item(
        item.item_id, item.name, item.location, item.status,
        item.user_email, item.total_pieces, item.target_date, item.progress
    )
    if success:
        return {"success": True, "message": message}
    else:
        raise HTTPException(status_code=400, detail=message)

@app.delete("/items/{item_id}")
def delete_item(item_id: str, _: str = Depends(verify_admin_token)):
    success = db.delete_item(item_id)
    if success:
        return {"success": True, "message": "Item deleted"}
    else:
        raise HTTPException(status_code=400, detail="Failed to delete item")

@app.patch("/items/{item_id}/status")
def update_item_status(item_id: str, status_update: StatusUpdate, _: str = Depends(verify_admin_token)):
    success = db.update_item_status(item_id, status_update.status)
    if success:
        return {"success": True, "message": "Status updated"}
    else:
        raise HTTPException(status_code=400, detail="Failed to update status")

@app.patch("/items/{item_id}/progress")
def update_item_progress(item_id: str, progress: int = Query(..., ge=0, le=100)):
    """Update item progress (0-100%)"""
    success = db.update_item_progress(item_id, progress)
    
    if success:
        # Auto update status
        if progress == 100:
            db.update_item_status(item_id, "Completed")
        elif progress >= 75:
            db.update_item_status(item_id, "Working")
        elif progress < 25:
            db.update_item_status(item_id, "Delayed")
        
        return {"success": True, "message": "Progress updated"}
    else:
        raise HTTPException(status_code=404, detail="Item not found")

@app.get("/public/progress/{item_id}/{progress}")
def public_update_progress(item_id: str, progress: int):
    """Public endpoint for progress updates - NO AUTH REQUIRED"""
    if progress < 0 or progress > 100:
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": "Progress must be between 0 and 100"}
        )
    
    success = db.update_item_progress(item_id, progress)
    
    if success:
        # Auto update status
        if progress == 100:
            db.update_item_status(item_id, "Completed")
        elif progress >= 75:
            db.update_item_status(item_id, "Working")
        elif progress < 25:
            db.update_item_status(item_id, "Delayed")
        
        return JSONResponse(
            status_code=200,
            content={"success": True, "message": "Progress updated", "progress": progress}
        )
    else:
        return JSONResponse(
            status_code=404,
            content={"success": False, "error": "Item not found"}
        )

@app.get("/messages", response_model=List[Message])
def get_messages(item_id: Optional[str] = None):
    messages = db.get_messages(item_id)
    for msg in messages:
        msg['formatted_time'] = format_timestamp_jst(msg.get('created_at', ''))
    return messages

@app.post("/messages")
def create_message(message: MessageCreate):
    success, error_msg = db.add_message(
        message.item_id, message.message, message.user_name, 
        message.msg_type, message.send_notification
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
    
@app.get("/debug/env")
def debug_env():
        """Check environment variables"""
        return {
            "APPWRITE_DATABASE_ID": os.getenv("APPWRITE_DATABASE_ID"),
            "APPWRITE_PROJECT_ID": os.getenv("APPWRITE_PROJECT_ID"),
            "APPWRITE_API_KEY_EXISTS": bool(os.getenv("APPWRITE_API_KEY")),
            "DATABASE_ID_BEING_USED": DATABASE_ID,
            "ALL_ENV_VARS": list(os.environ.keys())
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)