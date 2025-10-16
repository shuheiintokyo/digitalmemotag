from appwrite.client import Client
from appwrite.services.databases import Databases
from appwrite.id import ID
from appwrite.exception import AppwriteException # Import for specific error handling
import json
import os
from dotenv import load_dotenv
from datetime import datetime
import sys # Import for graceful exit

# --------------------
# 1. CONFIGURATION
# --------------------

load_dotenv() # Load variables from the .env file

# Load Appwrite Configuration from environment variables
APPWRITE_ENDPOINT = os.getenv("APPWRITE_ENDPOINT", "https://cloud.appwrite.io/v1")
APPWRITE_PROJECT_ID = os.getenv("APPWRITE_PROJECT_ID")
APPWRITE_API_KEY = os.getenv("APPWRITE_API_KEY")
DATABASE_ID = os.getenv("APPWRITE_DATABASE_ID")

# Load Collection IDs
ITEMS_COLLECTION_ID = os.getenv("APPWRITE_ITEMS_COLLECTION_ID")
MESSAGES_COLLECTION_ID = os.getenv("APPWRITE_MESSAGES_COLLECTION_ID")
SUBSCRIPTIONS_COLLECTION_ID = os.getenv("APPWRITE_SUBSCRIPTIONS_COLLECTION_ID")

# --------------------
# 2. INITIALIZATION
# --------------------

# Basic check for critical configuration
if not all([APPWRITE_PROJECT_ID, APPWRITE_API_KEY, DATABASE_ID]):
    print("❌ Critical Error: Missing Appwrite configuration (PROJECT_ID, API_KEY, or DATABASE_ID) in .env file.")
    sys.exit(1)

try:
    client = Client()
    client.set_endpoint(APPWRITE_ENDPOINT)
    client.set_project(APPWRITE_PROJECT_ID)
    client.set_key(APPWRITE_API_KEY)
    databases = Databases(client)
    print("✅ Appwrite Client Initialized.")
except Exception as e:
    print(f"❌ Initialization Error: Could not set up Appwrite client. {e}")
    sys.exit(1)


# --------------------
# 3. HELPER FUNCTIONS
# --------------------

def convert_timestamp(timestamp_str):
    """Convert timestamp to ISO format for Appwrite compatibility"""
    if not timestamp_str:
        return datetime.now().isoformat()
    
    # Simple check for T, common in ISO format
    if 'T' in timestamp_str:
        return timestamp_str
    
    try:
        # Tries to parse and then converts to ISO
        return datetime.fromisoformat(timestamp_str).isoformat()
    except ValueError:
        # Fallback if timestamp format is unrecognized
        return datetime.now().isoformat()

def import_table(data, collection_id, data_mapping_func):
    """Generic function to import data using a specific mapping function."""
    success = 0
    errors = 0
    
    if not data:
        return 0, 0

    for item in data:
        try:
            # Get the data mapped to Appwrite's schema
            mapped_data = data_mapping_func(item)
            
            databases.create_document(
                database_id=DATABASE_ID,
                collection_id=collection_id,
                document_id=ID.unique(),
                data=mapped_data
            )
            success += 1
        except AppwriteException as e:
            errors += 1
            # AppwriteException often provides helpful API error messages
            print(f"❌ Appwrite Error for {collection_id}: {e.code} - {e.message}")
        except Exception as e:
            errors += 1
            print(f"❌ General Error for {collection_id}: {str(e)}")
            
    return success, errors

# --------------------
# 4. MAPPING FUNCTIONS
# --------------------

def map_item_data(item):
    """Maps a single 'items' record from Supabase to Appwrite schema."""
    return {
        # Appwrite attributes must match your collection schema
        'item_id': item['item_id'],
        'name': item['name'],
        'location': item['location'],
        'status': item.get('status', 'Working')
    }

def map_message_data(msg):
    """Maps a single 'messages' record from Supabase to Appwrite schema."""
    return {
        'item_id': msg['item_id'],
        'message': msg['message'],
        'user_name': msg.get('user_name', 'Anonymous'),
        'msg_type': msg.get('msg_type', 'general'),
    }

def map_subscription_data(sub):
    """Maps a single 'email_subscriptions' record to Appwrite schema."""
    return {
        'item_id': sub['item_id'],
        'email': sub['email'],
        'notify_all': sub.get('notify_all', False)
    }


# --------------------
# 5. MAIN EXECUTION
# --------------------

if __name__ == "__main__":
    print("\n🚀 Starting Appwrite Data Import...\n")
    
    # --- A. Load Exported Data ---
    
    items_data = []
    messages_data = []
    subscriptions_data = []

    try:
        with open('items_export.json', 'r', encoding='utf-8') as f:
            items_data = json.load(f)
        print("✅ Loaded items_export.json")
    except FileNotFoundError:
        print("❌ Critical Error: items_export.json not found. Exiting.")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error loading items_export.json: {e}")
        sys.exit(1)

    try:
        with open('messages_export.json', 'r', encoding='utf-8') as f:
            messages_data = json.load(f)
        print("✅ Loaded messages_export.json")
    except FileNotFoundError:
        print("❌ Critical Error: messages_export.json not found. Exiting.")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error loading messages_export.json: {e}")
        sys.exit(1)

    # Handle the optional/missing subscriptions file gracefully
    try:
        with open('email_subscriptions_export.json', 'r', encoding='utf-8') as f:
            subscriptions_data = json.load(f)
            print("✅ Loaded email_subscriptions_export.json")
    except FileNotFoundError:
        print("⚠️ Subscriptions export file not found. Setting data to empty list.")
    except Exception as e:
        print(f"❌ Error loading subscriptions file: {e}. Setting data to empty list.")
        
    
    # --- B. Perform Imports ---

    # Import items
    print("\n📦 Importing items...")
    items_success, items_errors = import_table(items_data, ITEMS_COLLECTION_ID, map_item_data)
    
    # Import messages
    print("\n💬 Importing messages...")
    messages_success, messages_errors = import_table(messages_data, MESSAGES_COLLECTION_ID, map_message_data)
    
    # Import subscriptions
    print("\n📧 Importing subscriptions...")
    subs_success, subs_errors = import_table(subscriptions_data, SUBSCRIPTIONS_COLLECTION_ID, map_subscription_data)
    
    # --- C. Summary ---
    
    print("\n" + "="*50)
    print("📊 Appwrite Import Summary:")
    print("="*50)
    print(f"Items:          {items_success} ✅  {items_errors} ❌")
    print(f"Messages:       {messages_success} ✅  {messages_errors} ❌")
    print(f"Subscriptions:  {subs_success} ✅  {subs_errors} ❌")
    print("="*50)