import streamlit as st
import datetime
import requests
import json

# Try to import qrcode
try:
    import qrcode
    import io
    import base64
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
            'Content-Type': 'application/json'
        }
    
    def get_items(self):
        """Get all items from database"""
        try:
            response = requests.get(f"{self.base_url}/rest/v1/items", headers=self.headers)
            if response.status_code == 200:
                return response.json()
            return []
        except:
            return []
    
    def get_messages(self, item_id=None):
        """Get messages, optionally filtered by item_id"""
        try:
            url = f"{self.base_url}/rest/v1/messages?select=*&order=created_at.desc"
            if item_id:
                url += f"&item_id=eq.{item_id}"
            response = requests.get(url, headers=self.headers)
            if response.status_code == 200:
                return response.json()
            return []
        except:
            return []
    
    def add_item(self, item_id, name, location, status="Working"):
        """Add new item to database"""
        try:
            data = {
                "item_id": item_id,
                "name": name,
                "location": location,
                "status": status,
                "created_at": datetime.datetime.now().isoformat()
            }
            response = requests.post(f"{self.base_url}/rest/v1/items", 
                                   headers=self.headers, json=data)
            return response.status_code == 201
        except:
            return False
    
    def add_message(self, item_id, message, user, msg_type="general"):
        """Add new message to database"""
        try:
            data = {
                "item_id": item_id,
                "message": message,
                "user": user,
                "msg_type": msg_type,
                "created_at": datetime.datetime.now().isoformat()
            }
            response = requests.post(f"{self.base_url}/rest/v1/messages", 
                                   headers=self.headers, json=data)
            return response.status_code == 201
        except:
            return False
    
    def update_item_status(self, item_id, status):
        """Update item status"""
        try:
            data = {"status": status}
            response = requests.patch(f"{self.base_url}/rest/v1/items?item_id=eq.{item_id}", 
                                    headers=self.headers, json=data)
            return response.status_code == 200
        except:
            return False

def main():
    """Main application function"""
    st.set_page_config(page_title="Digital Memo Tag System", layout="wide")
    
    # Initialize database
    if not SUPABASE_URL or not SUPABASE_KEY:
        st.error("⚠️ Database not configured. Please set up Supabase credentials in Streamlit secrets.")
        st.info("For local testing, you can use the fallback mode below.")
        use_fallback_mode()
        return
    
    db = Database()
    
    # Handle URL parameters for direct item access
    query_params = st.query_params
    direct_item = query_params.get("item", None)
    
    st.title("🏷️ Digital Memo Tag System")
    st.markdown("*Persistent cloud storage - Messages are saved permanently*")
    
    # If accessed via QR code, go directly to memo board
    if direct_item:
        show_memo_board_direct(direct_item, db)
    else:
        # Normal navigation
        st.sidebar.title("Navigation")
        mode = st.sidebar.selectbox(
            "Select Mode",
            ["🏠 Home", "📱 Memo Board", "⚙️ Admin Panel"]
        )
        
        if mode == "🏠 Home":
            show_home_page(db)
        elif mode == "📱 Memo Board":
            show_memo_board(db)
        elif mode == "⚙️ Admin Panel":
            show_admin_panel(db)

def show_memo_board_direct(item_id, db):
    """Display memo board directly for QR code access"""
    items = db.get_items()
    item_dict = {item['item_id']: item for item in items}
    
    if item_id not in item_dict:
        st.error(f"Item '{item_id}' not found!")
        return
    
    item_info = item_dict[item_id]
    
    # Back button
    if st.button("← Back to Home"):
        st.query_params.clear()
        st.rerun()
    
    # Item Header
    st.markdown(f"## 🏷️ {item_info['name']}")
    col1, col2 = st.columns(2)
    with col1:
        st.markdown(f"📍 **Location**: {item_info['location']}")
    with col2:
        status_color = "🟢" if item_info['status'] == "Working" else "🟡"
        st.markdown(f"{status_color} **Status**: {item_info['status']}")
    
    st.markdown("---")
    
    # Quick status update
    with st.expander("🔄 Update Status"):
        new_status = st.selectbox("Status:", ["Working", "Needs Maintenance", "Out of Order"])
        if st.button("Update Status"):
            if db.update_item_status(item_id, new_status):
                # Add automatic status message
                db.add_message(item_id, f"Status updated to: {new_status}", "System", "status_update")
                st.success(f"Status updated to: {new_status}")
                st.rerun()
            else:
                st.error("Failed to update status")
    
    # Message Board
    st.subheader("💬 Message Board")
    
    # Post new message
    with st.expander("✍️ Post New Message", expanded=True):
        col1, col2 = st.columns([2, 1])
        with col1:
            user_name = st.text_input("Your name (optional):", placeholder="Anonymous")
        with col2:
            message_type = st.selectbox("Type:", ["general", "issue", "fixed", "question"])
        
        message = st.text_area("Message:", placeholder="Enter instructions, updates, or questions...")
        
        if st.button("Post Message", type="primary"):
            if message.strip():
                if db.add_message(item_id, message.strip(), user_name or "Anonymous", message_type):
                    st.success("Message posted!")
                    st.rerun()
                else:
                    st.error("Failed to post message")
            else:
                st.error("Please enter a message")
    
    # Display messages
    display_messages_for_item(item_id, db)

def display_messages_for_item(item_id, db):
    """Display messages for a specific item"""
    messages = db.get_messages(item_id)
    
    if messages:
        st.markdown(f"**{len(messages)} message(s)**")
        
        for msg in messages:
            msg_type = msg.get('msg_type', 'general')
            type_emoji = {
                'general': '💬',
                'issue': '⚠️',
                'fixed': '✅',
                'question': '❓',
                'status_update': '🔄'
            }.get(msg_type, '💬')
            
            # Format timestamp
            created_at = msg.get('created_at', '')
            if created_at:
                try:
                    dt = datetime.datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                    formatted_time = dt.strftime("%Y-%m-%d %H:%M")
                except:
                    formatted_time = created_at
            else:
                formatted_time = "Unknown"
            
            with st.container():
                st.markdown(f"""
                <div style="border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin: 10px 0; 
                     background-color: {'#fff3cd' if msg_type == 'issue' else '#d1edff' if msg_type == 'question' else '#d4edda' if msg_type == 'fixed' else '#f9f9f9'};">
                    <div style="font-size: 14px; color: #666; margin-bottom: 8px;">
                        {type_emoji} {msg['user']} • 📅 {formatted_time}
                    </div>
                    <div style="font-size: 16px; line-height: 1.4;">
                        {msg['message']}
                    </div>
                </div>
                """, unsafe_allow_html=True)
    else:
        st.info("No messages yet. Be the first to post!")

def show_home_page(db):
    """Display home page"""
    st.header("Welcome to Digital Memo System")
    
    st.markdown("""
    ### How it works:
    1. **Owner**: Prints QR codes and attaches them to equipment/products
    2. **User**: Scans QR code to access memo page
    3. **Communication**: Both can read and post updates in real-time
    4. **Persistent Storage**: All messages are saved to cloud database
    """)
    
    # Get stats from database
    items = db.get_items()
    all_messages = db.get_messages()
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.subheader("📊 System Overview")
        st.metric("Total Items", len(items))
        st.metric("Total Messages", len(all_messages))
        
        # Recent activity
        recent = len([m for m in all_messages 
                     if datetime.datetime.fromisoformat(m.get('created_at', '2020-01-01T00:00:00').replace('Z', '+00:00')) > 
                     datetime.datetime.now() - datetime.timedelta(days=7)])
        st.metric("This Week", recent)
        
    with col2:
        st.subheader("🔗 Quick Access")
        if items:
            for item in items[:5]:  # Show first 5 items
                if st.button(f"📱 {item['name']}", key=f"quick_{item['item_id']}"):
                    st.query_params.update({"item": item['item_id']})
                    st.rerun()
        else:
            st.info("No items available")

def show_memo_board(db):
    """Display memo board with item selection"""
    st.header("📱 Memo Board")
    
    items = db.get_items()
    if not items:
        st.error("No items available. Please add items in the Admin Panel.")
        return
    
    item_options = {item['item_id']: f"{item['name']} - {item['location']}" for item in items}
    selected_item = st.selectbox("Select Item:", list(item_options.keys()), 
                                format_func=lambda x: item_options[x])
    
    if selected_item:
        show_memo_board_direct(selected_item, db)

def show_admin_panel(db):
    """Display admin panel"""
    st.header("⚙️ Admin Panel")
    
    tab1, tab2, tab3 = st.tabs(["📋 Manage Items", "🔍 View Messages", "🏷️ QR Codes"])
    
    with tab1:
        st.subheader("📋 Manage Items")
        
        # Add new item
        with st.expander("➕ Add New Item"):
            col1, col2 = st.columns(2)
            with col1:
                new_id = st.text_input("Item ID:", placeholder="e.g., machine_d")
                new_name = st.text_input("Item Name:", placeholder="e.g., Laser Cutter D")
            with col2:
                new_location = st.text_input("Location:", placeholder="e.g., Workshop Floor 3")
                new_status = st.selectbox("Initial Status:", ["Working", "Needs Maintenance", "Out of Order"])
            
            if st.button("Add Item"):
                if new_id and new_name and new_location:
                    success, error_msg = db.add_item(new_id, new_name, new_location, new_status)
                    if success:
                        st.success(f"Item '{new_name}' added!")
                        st.rerun()
                    else:
                        st.error(f"Failed to add item: {error_msg}")
                else:
                    st.error("Please fill in all fields")
        
        # List existing items
        st.markdown("### Current Items:")
        items = db.get_items()
        for item in items:
            col1, col2, col3 = st.columns([3, 2, 2])
            with col1:
                st.write(f"**{item['name']}**")
            with col2:
                st.write(f"📍 {item['location']}")
            with col3:
                status_color = "🟢" if item['status'] == "Working" else "🟡"
                st.write(f"{status_color} {item['status']}")
    
    with tab2:
        st.subheader("🔍 All Messages")
        all_messages = db.get_messages()
        
        if all_messages:
            items = db.get_items()
            item_dict = {item['item_id']: item['name'] for item in items}
            
            # Summary stats
            col1, col2, col3 = st.columns(3)
            with col1:
                st.metric("Total Messages", len(all_messages))
            with col2:
                issues = len([m for m in all_messages if m.get('msg_type') == 'issue'])
                st.metric("Issues", issues)
            with col3:
                recent = len([m for m in all_messages 
                            if datetime.datetime.fromisoformat(m.get('created_at', '2020-01-01T00:00:00').replace('Z', '+00:00')) > 
                            datetime.datetime.now() - datetime.timedelta(days=1)])
                st.metric("Today", recent)
            
            for msg in all_messages:
                item_name = item_dict.get(msg['item_id'], 'Unknown Item')
                msg_type = msg.get('msg_type', 'general')
                type_emoji = {'general': '💬', 'issue': '⚠️', 'fixed': '✅', 'question': '❓', 'status_update': '🔄'}.get(msg_type, '💬')
                
                created_at = msg.get('created_at', '')
                try:
                    dt = datetime.datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                    formatted_time = dt.strftime("%Y-%m-%d %H:%M")
                except:
                    formatted_time = created_at
                
                with st.expander(f"{type_emoji} {item_name} • {msg['user']} • {formatted_time}"):
                    st.write(msg['message'])
        else:
            st.info("No messages posted yet.")
    
    with tab3:
        st.subheader("🏷️ Generate QR Codes")
        
        if not QR_AVAILABLE:
            st.warning("⚠️ Install qrcode library: `pip install qrcode[pil]`")
        
        base_url = st.text_input("Base URL:", value="https://your-app-name.streamlit.app", 
                                help="Enter your actual Streamlit app URL")
        
        items = db.get_items()
        if st.button("Generate All QR Codes"):
            for item in items:
                col1, col2 = st.columns([1, 2])
                
                with col2:
                    st.markdown(f"**{item['name']}**")
                    st.write(f"Location: {item['location']}")
                    qr_url = f"{base_url}?item={item['item_id']}"
                    st.code(qr_url, language="text")
                
                if QR_AVAILABLE:
                    with col1:
                        try:
                            qr = qrcode.QRCode(version=1, box_size=6, border=4)
                            qr.add_data(qr_url)
                            qr.make(fit=True)
                            img = qr.make_image(fill_color="black", back_color="white")
                            
                            buffer = io.BytesIO()
                            img.save(buffer, format='PNG')
                            buffer.seek(0)
                            qr_b64 = base64.b64encode(buffer.read()).decode()
                            
                            st.markdown(f'<img src="data:image/png;base64,{qr_b64}" width="150">', unsafe_allow_html=True)
                        except Exception as e:
                            st.error(f"Error generating QR code: {e}")
                else:
                    with col1:
                        st.info("QR code will appear here")
                
                st.markdown("---")

def use_fallback_mode():
    """Fallback mode without database (for testing)"""
    st.warning("Running in fallback mode - data will not persist!")
    
    # Initialize session state
    if 'items' not in st.session_state:
        st.session_state.items = {
            "test_machine": {"name": "Test Machine", "location": "Workshop", "status": "Working"}
        }
    
    if 'messages' not in st.session_state:
        st.session_state.messages = []
    
    st.subheader("Test Message Board")
    
    # Simple message posting
    with st.form("post_message"):
        name = st.text_input("Your Name:", placeholder="Anonymous")
        message = st.text_area("Message:")
        submitted = st.form_submit_button("Post Message")
        
        if submitted and message:
            new_msg = {
                "user": name or "Anonymous",
                "message": message,
                "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            st.session_state.messages.insert(0, new_msg)
            st.success("Message posted!")
            st.rerun()
    
    # Display messages
    for msg in st.session_state.messages:
        st.markdown(f"""
        **{msg['user']}** - {msg['timestamp']}
        
        {msg['message']}
        
        ---
        """)

if __name__ == "__main__":
    main()