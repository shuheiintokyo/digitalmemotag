import streamlit as st
import datetime
import requests
import json
import uuid

# Try to import qrcode
try:
    import qrcode
    import io
    import base64
    from PIL import Image
    QR_AVAILABLE = True
except ImportError:
    QR_AVAILABLE = False

# Supabase configuration
SUPABASE_URL = st.secrets.get("SUPABASE_URL", "")
SUPABASE_KEY = st.secrets.get("SUPABASE_KEY", "")

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
    
    def test_connection(self):
        """Test database connection"""
        try:
            response = requests.get(
                f"{self.base_url}/rest/v1/{self.messages_table}?limit=1",
                headers=self.headers,
                timeout=10
            )
            return response.status_code in [200, 201]
        except Exception as e:
            st.error(f"Connection test failed: {e}")
            return False
    
    def get_items(self):
        """Get all items from database"""
        try:
            response = requests.get(
                f"{self.base_url}/rest/v1/{self.items_table}?select=*&order=created_at.desc",
                headers=self.headers,
                timeout=10
            )
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 404:
                return []
            else:
                st.error(f"Error fetching items: {response.status_code} - {response.text}")
                return []
        except Exception as e:
            st.error(f"Exception getting items: {e}")
            return []
    
    def get_messages(self, item_id=None):
        """Get messages, optionally filtered by item_id"""
        try:
            url = f"{self.base_url}/rest/v1/{self.messages_table}?select=*&order=created_at.desc"
            if item_id:
                url += f"&item_id=eq.{item_id}"
            
            response = requests.get(url, headers=self.headers, timeout=10)
            
            if response.status_code == 200:
                messages = response.json()
                
                # Handle both JSONB and flat structure
                if messages and 'payload' in messages[0]:
                    # Transform JSONB structure to flat structure
                    transformed_messages = []
                    for msg in messages:
                        payload = msg.get('payload', {})
                        
                        # Filter by item_id if specified and not already filtered
                        if item_id and payload.get('item_id') != item_id:
                            continue
                        
                        transformed_msg = {
                            'item_id': payload.get('item_id', ''),
                            'message': payload.get('message', ''),
                            'user': payload.get('user', 'Anonymous'),
                            'msg_type': msg.get('topic', 'general'),
                            'created_at': msg.get('created_at', ''),
                            'id': msg.get('id', '')
                        }
                        transformed_messages.append(transformed_msg)
                    return transformed_messages
                else:
                    return messages
            elif response.status_code == 404:
                return []
            else:
                st.error(f"Error fetching messages: {response.status_code}")
                return []
        except Exception as e:
            st.error(f"Exception getting messages: {e}")
            return []
    
    def add_item(self, item_id, name, location, status="Working"):
        """Add new item to database"""
        try:
            # Check if item already exists
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
                error_detail = ""
                try:
                    error_data = response.json()
                    error_detail = error_data.get('message', response.text)
                except:
                    error_detail = response.text
                return False, f"Status {response.status_code}: {error_detail}"
        except Exception as e:
            return False, str(e)
    
    def add_message(self, item_id, message, user, msg_type="general"):
        """Add new message to database - SCHEMA FLEXIBLE VERSION"""
        try:
            # Ensure user is not None or empty
            user = user.strip() if user and user.strip() else "Anonymous"
            
            # First, let's detect the table schema by checking existing messages
            existing_messages = self.get_messages()
            
            # Check if we're using JSONB structure or flat structure
            if existing_messages and 'payload' in existing_messages[0]:
                # JSONB structure (like "Message Table Inspection")
                payload = {
                    "message": message.strip(),
                    "user": user,
                    "item_id": item_id
                }
                
                data = {
                    "topic": msg_type,
                    "payload": payload,
                    "event": "message_posted",
                    "extension": "memo_system",
                    "private": False,
                    "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
                }
            else:
                # Try different possible column names for user
                # Common variations: user, username, author, posted_by, user_name
                data = {
                    "item_id": item_id,
                    "message": message.strip(),
                    "msg_type": msg_type,
                    "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
                }
                
                # Try different user column names
                possible_user_columns = ['user', 'username', 'author', 'posted_by', 'user_name']
                data['user'] = user  # Start with 'user'
            
            # Make the request with proper error handling
            response = requests.post(
                f"{self.base_url}/rest/v1/{self.messages_table}",
                headers=self.headers,
                json=data,
                timeout=10
            )
            
            if response.status_code == 201:
                return True, "Message posted successfully"
            else:
                error_detail = ""
                try:
                    error_data = response.json()
                    if 'message' in error_data:
                        error_detail = error_data['message']
                    elif 'details' in error_data:
                        error_detail = error_data['details']
                    else:
                        error_detail = str(error_data)
                except:
                    error_detail = response.text
                
                # If user column error, try alternative approaches
                if "user" in error_detail.lower() and "column" in error_detail.lower():
                    return self._try_alternative_user_columns(item_id, message, user, msg_type)
                
                return False, f"Failed to post message (Status {response.status_code}): {error_detail}"
                
        except requests.exceptions.Timeout:
            return False, "Request timed out. Please check your internet connection."
        except requests.exceptions.ConnectionError:
            return False, "Connection error. Please check your internet connection."
        except Exception as e:
            return False, f"Unexpected error: {str(e)}"
    
    def _try_alternative_user_columns(self, item_id, message, user, msg_type):
        """Try alternative column names for user"""
        alternative_columns = ['username', 'author', 'posted_by', 'user_name']
        
        for col_name in alternative_columns:
            try:
                data = {
                    "item_id": item_id,
                    "message": message.strip(),
                    "msg_type": msg_type,
                    col_name: user,
                    "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
                }
                
                response = requests.post(
                    f"{self.base_url}/rest/v1/{self.messages_table}",
                    headers=self.headers,
                    json=data,
                    timeout=10
                )
                
                if response.status_code == 201:
                    return True, f"Message posted successfully (using {col_name} column)"
                    
            except Exception:
                continue
        
        # If all alternatives fail, try without user column
        try:
            data = {
                "item_id": item_id,
                "message": f"[{user}]: {message.strip()}",  # Include user in message text
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
                return True, "Message posted (user info included in message text)"
                
        except Exception:
            pass
            
        return False, "Could not find compatible user column. Please check your database schema."
    
    def update_item_status(self, item_id, status):
        """Update item status"""
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
            st.error(f"Exception updating status: {e}")
            return False
    
    def delete_item(self, item_id):
        """Delete item and all its messages"""
        try:
            # First delete all messages for this item
            requests.delete(
                f"{self.base_url}/rest/v1/{self.messages_table}?item_id=eq.{item_id}",
                headers=self.headers,
                timeout=10
            )
            
            # Then delete the item
            response = requests.delete(
                f"{self.base_url}/rest/v1/{self.items_table}?item_id=eq.{item_id}",
                headers=self.headers,
                timeout=10
            )
            
            return response.status_code in [200, 204]
        except Exception as e:
            st.error(f"Exception deleting item: {e}")
            return False

def main():
    """Main application function"""
    st.set_page_config(
        page_title="Digital Memo Tag System",
        page_icon="🏷️",
        layout="wide",
        initial_sidebar_state="expanded"
    )
    
    # Initialize database
    if not SUPABASE_URL or not SUPABASE_KEY:
        st.error("⚠️ Database not configured. Please set up Supabase credentials in Streamlit secrets.")
        st.info("Add SUPABASE_URL and SUPABASE_KEY to your Streamlit secrets.")
        with st.expander("Setup Instructions"):
            st.markdown("""
            1. Go to your Streamlit app settings
            2. Add these secrets:
               ```
               SUPABASE_URL = "your_supabase_project_url"
               SUPABASE_KEY = "your_supabase_anon_key"
               ```
            3. Create tables in Supabase SQL editor (see Admin Panel for SQL commands)
            """)
        use_fallback_mode()
        return
    
    db = Database()
    
    # Test connection on first load
    if 'connection_tested' not in st.session_state:
        with st.spinner("Testing database connection..."):
            if db.test_connection():
                st.session_state.connection_tested = True
                st.success("✅ Database connected successfully!", icon="✅")
            else:
                st.error("❌ Failed to connect to database. Check your credentials.")
                st.info("You can still use the fallback mode for testing.")
                use_fallback_mode()
                return
    
    # Handle URL parameters for direct item access
    query_params = st.query_params
    direct_item = query_params.get("item", None)
    
    st.title("🏷️ Digital Memo Tag System")
    st.markdown("*Cloud-based persistent storage for equipment communication*")
    
    # If accessed via QR code, go directly to memo board
    if direct_item:
        show_memo_board_direct(direct_item, db)
    else:
        # Normal navigation
        with st.sidebar:
            st.title("🧭 Navigation")
            
            mode = st.selectbox(
                "Select Mode",
                ["🏠 Home", "📱 Memo Board", "⚙️ Admin Panel", "❓ Help"]
            )
        
        if mode == "🏠 Home":
            show_home_page(db)
        elif mode == "📱 Memo Board":
            show_memo_board(db)
        elif mode == "⚙️ Admin Panel":
            show_admin_panel(db)
        elif mode == "❓ Help":
            show_help_page()

def show_memo_board_direct(item_id, db):
    """Display memo board directly for QR code access"""
    items = db.get_items()
    item_dict = {item['item_id']: item for item in items}
    
    if item_id not in item_dict:
        st.error(f"❌ Item '{item_id}' not found!")
        if st.button("🏠 Go to Home"):
            st.query_params.clear()
            st.rerun()
        return
    
    item_info = item_dict[item_id]
    
    # Navigation
    col1, col2 = st.columns([1, 5])
    with col1:
        if st.button("← Back"):
            st.query_params.clear()
            st.rerun()
    
    # Item Header
    st.markdown(f"## 🏷️ {item_info['name']}")
    
    col1, col2 = st.columns(2)
    with col1:
        st.info(f"📍 **Location:** {item_info.get('location', 'Unknown')}")
    with col2:
        status = item_info.get('status', 'Unknown')
        status_emoji = {
            "Working": "🟢",
            "Needs Maintenance": "🟡",
            "Out of Order": "🔴"
        }.get(status, "⚪")
        st.info(f"**Status:** {status_emoji} {status}")
    
    st.divider()
    
    # Quick status update
    with st.expander("🔄 Quick Status Update"):
        col1, col2 = st.columns([3, 1])
        with col1:
            new_status = st.selectbox(
                "Change status to:",
                ["Working", "Needs Maintenance", "Out of Order"],
                index=["Working", "Needs Maintenance", "Out of Order"].index(item_info.get('status', 'Working'))
            )
        with col2:
            if st.button("Update", type="primary"):
                if db.update_item_status(item_id, new_status):
                    success, msg = db.add_message(
                        item_id,
                        f"Status changed to: {new_status}",
                        "System",
                        "status_update"
                    )
                    st.success("✅ Status updated!")
                    st.rerun()
                else:
                    st.error("Failed to update status")
    
    # Message Board Section
    st.markdown("### 💬 Message Board")
    
    # Post new message form
    with st.form("new_message_form", clear_on_submit=True):
        st.markdown("**Post a New Message**")
        
        col1, col2 = st.columns([2, 1])
        with col1:
            user_name = st.text_input(
                "Your name (optional):",
                placeholder="Anonymous",
                key="user_input"
            )
        with col2:
            message_type = st.selectbox(
                "Type:",
                options=["general", "issue", "fixed", "question"],
                key="type_input"
            )
        
        message = st.text_area(
            "Message:",
            placeholder="Write your message, instructions, questions, or updates here...",
            key="message_input",
            height=100
        )
        
        col1, col2, col3 = st.columns([1, 1, 3])
        with col1:
            submit_button = st.form_submit_button("📮 Post Message", type="primary")
        
        if submit_button:
            if message and message.strip():
                with st.spinner("Posting message..."):
                    success, error_msg = db.add_message(item_id, message.strip(), user_name or "Anonymous", message_type)
                    if success:
                        st.success("✅ Message posted successfully!")
                        st.rerun()
                    else:
                        st.error(f"❌ {error_msg}")
            else:
                st.warning("⚠️ Please enter a message before posting.")
    
    # Display messages
    st.divider()
    display_messages_for_item(item_id, db)

def display_messages_for_item(item_id, db):
    """Display messages for a specific item"""
    with st.spinner("Loading messages..."):
        messages = db.get_messages(item_id)
    
    if not messages:
        st.info("📭 No messages yet. Be the first to post!")
        return
    
    st.markdown(f"**📊 {len(messages)} message(s)**")
    
    # Message type emoji mapping
    type_emoji = {
        'general': '💬',
        'issue': '⚠️',
        'fixed': '✅',
        'question': '❓',
        'status_update': '🔄'
    }
    
    # Message type color mapping
    type_color = {
        'issue': '#fff3cd',
        'question': '#d1edff',
        'fixed': '#d4edda',
        'status_update': '#e2e3e5',
        'general': '#f8f9fa'
    }
    
    for msg in messages:
        msg_type = msg.get('msg_type', 'general')
        emoji = type_emoji.get(msg_type, '💬')
        bg_color = type_color.get(msg_type, '#f8f9fa')
        
        # Format timestamp
        created_at = msg.get('created_at', '')
        if created_at:
            try:
                dt = datetime.datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                formatted_time = dt.strftime("%b %d, %Y at %I:%M %p")
            except:
                formatted_time = "Unknown time"
        else:
            formatted_time = "Unknown time"
        
        # Create message card
        st.markdown(f"""
        <div style="
            border: 1px solid #dee2e6;
            border-radius: 10px;
            padding: 15px;
            margin: 10px 0;
            background-color: {bg_color};
            box-shadow: 0 1px 3px rgba(0,0,0,0.12);
        ">
            <div style="
                font-size: 13px;
                color: #6c757d;
                margin-bottom: 8px;
                font-weight: 500;
            ">
                {emoji} <strong>{msg.get('user', 'Anonymous')}</strong> • {formatted_time}
            </div>
            <div style="
                font-size: 15px;
                line-height: 1.5;
                color: #212529;
            ">
                {msg.get('message', '')}
            </div>
        </div>
        """, unsafe_allow_html=True)

def show_home_page(db):
    """Display home page with overview"""
    st.header("🏠 Welcome to Digital Memo System")
    
    # Introduction
    st.markdown("""
    ### 📱 How It Works
    
    1. **Equipment Owner** - Attach QR codes to equipment/machines
    2. **Users** - Scan QR code to access the memo board
    3. **Communication** - Leave messages, report issues, share instructions
    4. **Persistence** - All data saved to cloud database
    """)
    
    st.divider()
    
    # Statistics
    with st.spinner("Loading statistics..."):
        items = db.get_items()
        all_messages = db.get_messages()
    
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.metric("📦 Total Items", len(items))
    
    with col2:
        st.metric("💬 Total Messages", len(all_messages))
    
    with col3:
        issues = len([m for m in all_messages if m.get('msg_type') == 'issue'])
        st.metric("⚠️ Open Issues", issues)
    
    with col4:
        # Messages in last 24 hours
        recent = 0
        now = datetime.datetime.now(datetime.timezone.utc)
        for msg in all_messages:
            try:
                msg_time = datetime.datetime.fromisoformat(msg.get('created_at', '').replace('Z', '+00:00'))
                if (now - msg_time).total_seconds() < 86400:
                    recent += 1
            except:
                pass
        st.metric("🕐 Last 24h", recent)
    
    st.divider()
    
    # Quick Access Section
    col1, col2 = st.columns([1, 1])
    
    with col1:
        st.subheader("🚀 Quick Access")
        if items:
            st.markdown("Jump directly to an item:")
            for item in items[:5]:
                col_a, col_b = st.columns([3, 1])
                with col_a:
                    st.markdown(f"**{item['name']}**")
                    st.caption(f"📍 {item.get('location', 'Unknown')}")
                with col_b:
                    if st.button("Open", key=f"quick_{item['item_id']}"):
                        st.query_params.update({"item": item['item_id']})
                        st.rerun()
        else:
            st.info("No items configured yet. Add items in the Admin Panel.")
    
    with col2:
        st.subheader("📊 Recent Activity")
        recent_messages = sorted(all_messages, 
                                key=lambda x: x.get('created_at', ''), 
                                reverse=True)[:5]
        
        if recent_messages:
            items_dict = {item['item_id']: item['name'] for item in items}
            for msg in recent_messages:
                item_name = items_dict.get(msg.get('item_id', ''), 'Unknown')
                st.markdown(f"**{msg.get('user', 'Anonymous')}** → _{item_name}_")
                with st.container():
                    st.caption(msg.get('message', '')[:100] + "..." if len(msg.get('message', '')) > 100 else msg.get('message', ''))
        else:
            st.info("No recent activity")

def show_memo_board(db):
    """Display memo board with item selection"""
    st.header("📱 Memo Board")
    
    items = db.get_items()
    
    if not items:
        st.warning("⚠️ No items configured yet!")
        st.info("Please add items in the Admin Panel first.")
        
        if st.button("Go to Admin Panel"):
            st.rerun()
        return
    
    # Item selection
    item_dict = {item['item_id']: f"{item['name']} ({item.get('location', 'Unknown')})" 
                 for item in items}
    
    selected_item = st.selectbox(
        "🏷️ Select an Item:",
        options=list(item_dict.keys()),
        format_func=lambda x: item_dict[x]
    )
    
    if selected_item:
        st.divider()
        # Reuse the direct view function
        show_memo_board_direct(selected_item, db)

def show_admin_panel(db):
    """Display admin panel for system management"""
    st.header("⚙️ Admin Panel")
    
    tab1, tab2, tab3, tab4 = st.tabs(["📦 Items", "💬 Messages", "🏷️ QR Codes", "🗄️ Database"])
    
    with tab1:
        st.subheader("📦 Manage Items")
        
        # Add new item form
        with st.expander("➕ Add New Item", expanded=True):
            with st.form("add_item_form"):
                col1, col2 = st.columns(2)
                
                with col1:
                    new_id = st.text_input(
                        "Item ID (unique):",
                        placeholder="e.g., machine_01",
                        help="Use letters, numbers, and underscores only"
                    )
                    new_name = st.text_input(
                        "Item Name:",
                        placeholder="e.g., 3D Printer #1"
                    )
                
                with col2:
                    new_location = st.text_input(
                        "Location:",
                        placeholder="e.g., Workshop Floor 2"
                    )
                    new_status = st.selectbox(
                        "Initial Status:",
                        ["Working", "Needs Maintenance", "Out of Order"]
                    )
                
                submitted = st.form_submit_button("Add Item", type="primary")
                
                if submitted:
                    if new_id and new_name and new_location:
                        # Validate item_id format
                        if ' ' in new_id or any(c in new_id for c in ['/', '\\', '?', '#']):
                            st.error("Item ID cannot contain spaces or special characters. Use letters, numbers, and underscores only.")
                        else:
                            with st.spinner("Adding item..."):
                                success, msg = db.add_item(new_id, new_name, new_location, new_status)
                                if success:
                                    st.success(f"✅ Item '{new_name}' added successfully!")
                                    st.rerun()
                                else:
                                    st.error(f"❌ Failed to add item: {msg}")
                    else:
                        st.error("Please fill in all required fields")
        
        # List existing items
        st.divider()
        st.markdown("### 📋 Current Items")
        
        items = db.get_items()
        if items:
            for idx, item in enumerate(items):
                col1, col2, col3, col4, col5 = st.columns([3, 2, 2, 1, 1])
                
                with col1:
                    st.markdown(f"**{item['name']}**")
                    st.caption(f"ID: {item['item_id']}")
                
                with col2:
                    st.markdown(f"📍 {item.get('location', 'Unknown')}")
                
                with col3:
                    status = item.get('status', 'Unknown')
                    status_emoji = {
                        "Working": "🟢",
                        "Needs Maintenance": "🟡",
                        "Out of Order": "🔴"
                    }.get(status, "⚪")
                    st.markdown(f"{status_emoji} {status}")
                
                with col4:
                    if st.button("View", key=f"view_{item['item_id']}"):
                        st.query_params.update({"item": item['item_id']})
                        st.rerun()
                
                with col5:
                    if st.button("🗑️", key=f"delete_{item['item_id']}", help="Delete item"):
                        if st.session_state.get(f"confirm_delete_{item['item_id']}", False):
                            if db.delete_item(item['item_id']):
                                st.success(f"Deleted {item['name']}")
                                st.rerun()
                            else:
                                st.error("Failed to delete item")
                        else:
                            st.session_state[f"confirm_delete_{item['item_id']}"] = True
                            st.warning("Click again to confirm deletion")
                
                if idx < len(items) - 1:
                    st.divider()
        else:
            st.info("No items configured yet. Add your first item above!")
    
    with tab2:
        st.subheader("💬 All Messages")
        
        all_messages = db.get_messages()
        
        if all_messages:
            # Statistics
            col1, col2, col3, col4 = st.columns(4)
            
            with col1:
                st.metric("Total Messages", len(all_messages))
            
            with col2:
                issues = len([m for m in all_messages if m.get('msg_type') == 'issue'])
                st.metric("Issues", issues)
            
            with col3:
                questions = len([m for m in all_messages if m.get('msg_type') == 'question'])
                st.metric("Questions", questions)
            
            with col4:
                fixed = len([m for m in all_messages if m.get('msg_type') == 'fixed'])
                st.metric("Fixed", fixed)
            
            st.divider()
            
            # Filter options
            col1, col2 = st.columns(2)
            with col1:
                filter_type = st.selectbox(
                    "Filter by type:",
                    ["All", "general", "issue", "question", "fixed", "status_update"]
                )
            
            with col2:
                items = db.get_items()
                item_options = ["All"] + [item['item_id'] for item in items]
                filter_item = st.selectbox("Filter by item:", item_options)
            
            # Display messages
            filtered_messages = all_messages
            
            if filter_type != "All":
                filtered_messages = [m for m in filtered_messages if m.get('msg_type') == filter_type]
            
            if filter_item != "All":
                filtered_messages = [m for m in filtered_messages if m.get('item_id') == filter_item]
            
            st.markdown(f"**Showing {len(filtered_messages)} message(s)**")
            
            items_dict = {item['item_id']: item['name'] for item in items}
            
            for msg in filtered_messages[:20]:  # Show latest 20
                item_name = items_dict.get(msg.get('item_id', ''), 'Unknown Item')
                msg_type = msg.get('msg_type', 'general')
                
                type_emoji = {
                    'general': '💬',
                    'issue': '⚠️',
                    'fixed': '✅',
                    'question': '❓',
                    'status_update': '🔄'
                }.get(msg_type, '💬')
                
                with st.expander(f"{type_emoji} {item_name} - {msg.get('user', 'Anonymous')}"):
                    st.write(msg.get('message', ''))
                    st.caption(f"Posted: {msg.get('created_at', 'Unknown')}")
        else:
            st.info("No messages posted yet.")
    
    with tab3:
        st.subheader("🏷️ Generate QR Codes")
        
        # Get app URL
        app_url = st.text_input(
            "Your App URL:",
            value="https://your-app-name.streamlit.app",
            help="Enter your Streamlit app URL (from Share button)"
        )
        
        items = db.get_items()
        
        if not items:
            st.warning("No items configured yet. Add items first.")
        elif not QR_AVAILABLE:
            st.error("QR code library not installed. Run: pip install qrcode[pil]")
        else:
            if st.button("🎯 Generate All QR Codes", type="primary"):
                st.markdown("### Generated QR Codes")
                st.info("Right-click and save images to print them")
                
                for item in items:
                    st.divider()
                    
                    col1, col2 = st.columns([1, 2])
                    
                    # Generate QR code
                    qr_url = f"{app_url}?item={item['item_id']}"
                    
                    with col1:
                        try:
                            qr = qrcode.QRCode(
                                version=1,
                                error_correction=qrcode.constants.ERROR_CORRECT_L,
                                box_size=8,
                                border=4,
                            )
                            qr.add_data(qr_url)
                            qr.make(fit=True)
                            
                            img = qr.make_image(fill_color="black", back_color="white")
                            
                            # Convert to bytes
                            buffer = io.BytesIO()
                            img.save(buffer, format='PNG')
                            buffer.seek(0)
                            
                            # Display
                            st.image(buffer, width=200)
                            
                        except Exception as e:
                            st.error(f"Error generating QR: {e}")
                    
                    with col2:
                        st.markdown(f"### {item['name']}")
                        st.markdown(f"**Location:** {item.get('location', 'Unknown')}")
                        st.markdown(f"**Item ID:** `{item['item_id']}`")
                        st.code(qr_url, language="text")
                        
                        # Download button
                        try:
                            buffer.seek(0)
                            st.download_button(
                                label="Download QR Code",
                                data=buffer.getvalue(),
                                file_name=f"qr_{item['item_id']}.png",
                                mime="image/png"
                            )
                        except:
                            pass
    
    with tab4:
        st.subheader("🗄️ Database Setup")
        
        st.info("Make sure your Supabase tables are properly configured.")
        
        with st.expander("📋 Required Table Schemas"):
            st.markdown("### Items Table")
            st.code("""
CREATE TABLE items (
    id SERIAL PRIMARY KEY,
    item_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    location VARCHAR(200) NOT NULL,
    status VARCHAR(50) DEFAULT 'Working',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
            """, language="sql")
            
            st.markdown("### Messages Table")
            st.code("""
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    item_id VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    user_name VARCHAR(100) DEFAULT 'Anonymous',
    msg_type VARCHAR(20) DEFAULT 'general',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (item_id) REFERENCES items(item_id) ON DELETE CASCADE
);
            """, language="sql")
            
            st.markdown("### Enable Row Level Security (Optional)")
            st.code("""
-- Enable RLS
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create policies for public access
CREATE POLICY "Allow all operations on items" ON items FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on messages" ON messages FOR ALL TO anon USING (true) WITH CHECK (true);
            """, language="sql")
        
        # Connection test
        st.markdown("### Connection Test")
        if st.button("🧪 Test Database Connection"):
            with st.spinner("Testing connection..."):
                if db.test_connection():
                    st.success("✅ Database connection successful!")
                    
                    # Test table access
                    items = db.get_items()
                    messages = db.get_messages()
                    
                    col1, col2 = st.columns(2)
                    with col1:
                        st.metric("Items found", len(items))
                    with col2:
                        st.metric("Messages found", len(messages))
                else:
                    st.error("❌ Database connection failed!")

def show_help_page():
    """Display help and documentation"""
    st.header("❓ Help & Documentation")
    
    tab1, tab2, tab3 = st.tabs(["🚀 Getting Started", "🔧 Troubleshooting", "📖 FAQ"])
    
    with tab1:
        st.markdown("""
        ## Getting Started
        
        ### 1. Setup Database
        - Create a free Supabase account at supabase.com
        - Create a new project
        - Copy your project URL and anon key
        - Add them to your Streamlit secrets
        - Run the SQL commands in the Database tab to create tables
        
        ### 2. Add Items
        - Go to Admin Panel → Items
        - Add your equipment/machines with unique IDs
        - Use simple IDs like "printer_01", "cnc_machine_a"
        
        ### 3. Generate QR Codes
        - Go to Admin Panel → QR Codes
        - Enter your app URL
        - Generate and download QR codes
        - Print and attach to your equipment
        
        ### 4. Test the System
        - Scan a QR code or use direct links
        - Post test messages
        - Update status
        """)
    
    with tab2:
        st.markdown("""
        ## Troubleshooting
        
        ### Database Connection Issues
        - Check your SUPABASE_URL and SUPABASE_KEY in secrets
        - Ensure tables are created with correct schemas
        - Verify Row Level Security policies if using RLS
        
        ### Message Posting Fails
        - Check internet connection
        - Verify table permissions
        - Look for special characters in item IDs
        - Check if item_id exists in items table
        
        ### QR Codes Not Working
        - Install qrcode library: `pip install qrcode[pil]`
        - Ensure app URL is correct and accessible
        - Test links manually before printing
        
        ### Performance Issues
        - Large number of messages may slow loading
        - Consider implementing pagination for messages
        - Check database performance in Supabase dashboard
        """)
    
    with tab3:
        st.markdown("""
        ## Frequently Asked Questions
        
        **Q: Is this system free to use?**
        A: Yes! Uses Supabase free tier which includes 500MB database and 50MB file storage.
        
        **Q: How many items/messages can I have?**
        A: Depends on your Supabase plan. Free tier supports thousands of messages.
        
        **Q: Can I customize the message types?**
        A: Yes, modify the message_type options in the code.
        
        **Q: Is data backed up?**
        A: Supabase provides automatic backups. You can also export data manually.
        
        **Q: Can I use this offline?**
        A: No, requires internet connection for database access.
        
        **Q: How do I update the app?**
        A: Replace the code file and restart your Streamlit app.
        
        **Q: Can multiple people use the same item simultaneously?**
        A: Yes! Multiple users can post messages to the same item in real-time.
        """)

def use_fallback_mode():
    """Fallback mode without database (for testing)"""
    st.warning("⚠️ Running in fallback mode - data will not persist!")
    
    # Initialize session state
    if 'items' not in st.session_state:
        st.session_state.items = {
            "test_machine": {"name": "Test Machine", "location": "Workshop", "status": "Working"}
        }
    
    if 'messages' not in st.session_state:
        st.session_state.messages = []
    
    st.subheader("🧪 Test Message Board")
    
    # Simple message posting
    with st.form("post_message"):
        name = st.text_input("Your Name:", placeholder="Anonymous")
        message = st.text_area("Message:")
        submitted = st.form_submit_button("Post Message")
        
        if submitted and message:
            new_msg = {
                "user": name or "Anonymous",
                "message": message,
                "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "msg_type": "general"
            }
            st.session_state.messages.insert(0, new_msg)
            st.success("Message posted!")
            st.rerun()
    
    # Display messages
    for msg in st.session_state.messages:
        st.markdown(f"""
        <div style="border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin: 10px 0; background-color: #f9f9f9;">
            <div style="font-size: 14px; color: #666; margin-bottom: 8px;">
                💬 <strong>{msg['user']}</strong> • {msg['timestamp']}
            </div>
            <div style="font-size: 16px; line-height: 1.4;">
                {msg['message']}
            </div>
        </div>
        """, unsafe_allow_html=True)

if __name__ == "__main__":
    main()