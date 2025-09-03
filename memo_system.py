import streamlit as st
import datetime

# Try to import qrcode, handle if not installed
try:
    import qrcode
    import io
    import base64
    QR_AVAILABLE = True
except ImportError:
    QR_AVAILABLE = False

def main():
    """Main application function"""
    # Page configuration
    st.set_page_config(page_title="Digital Memo Tag System", layout="wide")
    
    st.title("🏷️ Digital Memo Tag System")
    st.markdown("*Prototype - Replace handwritten notes with digital, updateable memos*")
    
    # Initialize session state for storing messages
    if 'messages' not in st.session_state:
        st.session_state['messages'] = []
    
    # Sample initial data
    if 'items' not in st.session_state:
        st.session_state['items'] = {
            "machine_a": {"name": "CNC Machine A", "location": "Workshop Floor 1"},
            "printer_b": {"name": "3D Printer B", "location": "Design Lab"},
            "drill_c": {"name": "Industrial Drill C", "location": "Workshop Floor 2"}
        }
    
    # Sidebar navigation
    st.sidebar.title("Navigation")
    mode = st.sidebar.selectbox(
        "Select Mode",
        ["🏠 Home", "📱 Memo Board", "⚙️ Admin Panel"]
    )
    
    # Display selected page
    if mode == "🏠 Home":
        show_home_page()
    elif mode == "📱 Memo Board":
        show_memo_board()
    elif mode == "⚙️ Admin Panel":
        show_admin_panel()

def show_home_page():
    """Display home page"""
    st.header("Welcome to Digital Memo System")
    
    st.markdown("""
    ### How it works:
    1. **Owner**: Prints QR codes and attaches them to equipment/products
    2. **User**: Scans QR code to access memo page
    3. **Communication**: Both can read and post updates in real-time
    4. **No Login Required**: Simple, accessible message board
    """)
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.subheader("📊 System Overview")
        items_count = len(st.session_state['items'])
        messages_count = len(st.session_state['messages'])
        st.metric("Total Items", items_count)
        st.metric("Total Messages", messages_count)
        
    with col2:
        st.subheader("🔗 Quick Access")
        item_keys = list(st.session_state['items'].keys())
        if item_keys:
            selected_item = st.selectbox("Jump to Item:", item_keys)
            if st.button("Go to Memo Board"):
                st.session_state['current_item'] = selected_item
                st.rerun()

def show_memo_board():
    """Display the memo board"""
    st.header("📱 Memo Board")
    st.markdown("*This simulates what users see when they scan a QR code*")
    
    # Item selection
    item_keys = list(st.session_state['items'].keys())
    if not item_keys:
        st.error("No items available. Please add items in the Admin Panel.")
        return
    
    selected_item = st.selectbox(
        "Select Item:",
        item_keys,
        format_func=lambda x: f"{st.session_state['items'][x]['name']} - {st.session_state['items'][x]['location']}"
    )
    
    if selected_item:
        item_info = st.session_state['items'][selected_item]
        
        # Item Header
        st.markdown(f"## 🏷️ {item_info['name']}")
        st.markdown(f"📍 **Location**: {item_info['location']}")
        st.markdown("---")
        
        # Message Board
        st.subheader("💬 Message Board")
        
        # Post new message
        with st.expander("✍️ Post New Message", expanded=False):
            user_name = st.text_input("Your name (optional):", placeholder="Anonymous")
            message = st.text_area("Message:", placeholder="Enter instructions, updates, or questions...")
            
            if st.button("Post Message", type="primary"):
                if message.strip():
                    # Add message to session state
                    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    new_message = {
                        "id": len(st.session_state['messages']) + 1,
                        "item_id": selected_item,
                        "message": message.strip(),
                        "user": user_name or "Anonymous",
                        "timestamp": timestamp
                    }
                    st.session_state['messages'].insert(0, new_message)
                    st.success("Message posted!")
                    st.rerun()
                else:
                    st.error("Please enter a message")
        
        # Display messages for this item
        item_messages = [msg for msg in st.session_state['messages'] if msg['item_id'] == selected_item]
        
        if item_messages:
            st.markdown(f"**{len(item_messages)} message(s)**")
            
            for msg in item_messages:
                with st.container():
                    st.markdown(f"""
                    <div style="border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin: 10px 0; background-color: #f9f9f9;">
                        <div style="font-size: 14px; color: #666; margin-bottom: 8px;">
                            👤 {msg['user']} • 📅 {msg['timestamp']}
                        </div>
                        <div style="font-size: 16px; line-height: 1.4;">
                            {msg['message']}
                        </div>
                    </div>
                    """, unsafe_allow_html=True)
        else:
            st.info("No messages yet. Be the first to post!")

def show_admin_panel():
    """Display admin panel"""
    st.header("⚙️ Admin Panel")
    
    tab1, tab2, tab3 = st.tabs(["📋 Manage Items", "🔍 View Messages", "🏷️ QR Codes"])
    
    with tab1:
        st.subheader("📋 Manage Items")
        
        # Add new item
        with st.expander("➕ Add New Item"):
            new_id = st.text_input("Item ID:", placeholder="e.g., machine_d")
            new_name = st.text_input("Item Name:", placeholder="e.g., Laser Cutter D")
            new_location = st.text_input("Location:", placeholder="e.g., Workshop Floor 3")
            
            if st.button("Add Item"):
                if new_id and new_name and new_location:
                    if new_id not in st.session_state['items']:
                        st.session_state['items'][new_id] = {
                            "name": new_name,
                            "location": new_location
                        }
                        st.success(f"Item '{new_name}' added!")
                        st.rerun()
                    else:
                        st.error("Item ID already exists!")
                else:
                    st.error("Please fill in all fields")
        
        # List existing items
        st.markdown("### Current Items:")
        for item_id, item_info in st.session_state['items'].items():
            col1, col2, col3 = st.columns([3, 3, 1])
            with col1:
                st.write(f"**{item_info['name']}**")
            with col2:
                st.write(f"📍 {item_info['location']}")
            with col3:
                if st.button("🗑️", key=f"del_{item_id}"):
                    del st.session_state['items'][item_id]
                    # Remove messages for this item
                    st.session_state['messages'] = [msg for msg in st.session_state['messages'] if msg['item_id'] != item_id]
                    st.rerun()
    
    with tab2:
        st.subheader("🔍 All Messages")
        
        if st.session_state['messages']:
            for msg in st.session_state['messages']:
                item_name = st.session_state['items'].get(msg['item_id'], {}).get('name', 'Unknown Item')
                
                with st.expander(f"🏷️ {item_name} • {msg['user']} • {msg['timestamp']}"):
                    st.write(msg['message'])
                    if st.button("Delete Message", key=f"del_msg_{msg['id']}"):
                        st.session_state['messages'] = [m for m in st.session_state['messages'] if m['id'] != msg['id']]
                        st.rerun()
        else:
            st.info("No messages posted yet.")
    
    with tab3:
        st.subheader("🏷️ Generate QR Codes")
        
        if not QR_AVAILABLE:
            st.warning("⚠️ Install qrcode library: `pip install qrcode[pil]`")
        
        base_url = st.text_input("Base URL:", value="https://your-app.streamlit.app")
        
        for item_id, item_info in st.session_state['items'].items():
            st.markdown(f"**{item_info['name']}**")
            st.write(f"Location: {item_info['location']}")
            qr_url = f"{base_url}?item={item_id}"
            st.code(qr_url)
            
            if QR_AVAILABLE:
                try:
                    qr = qrcode.QRCode(version=1, box_size=8, border=4)
                    qr.add_data(qr_url)
                    qr.make(fit=True)
                    img = qr.make_image(fill_color="black", back_color="white")
                    
                    buffer = io.BytesIO()
                    img.save(buffer, format='PNG')
                    buffer.seek(0)
                    qr_b64 = base64.b64encode(buffer.read()).decode()
                    
                    st.markdown(f'<img src="data:image/png;base64,{qr_b64}" width="120">', unsafe_allow_html=True)
                except:
                    st.error("Error generating QR code")
            else:
                st.info("QR code will appear here when library is installed")
            
            st.markdown("---")

if __name__ == "__main__":
    main()