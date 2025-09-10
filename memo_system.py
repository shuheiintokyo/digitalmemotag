import streamlit as st
import datetime
import pytz  # Add this import for timezone handling
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

def format_timestamp_jst(timestamp_str):
    """Convert UTC timestamp to JST and format for display"""
    if not timestamp_str:
        return "時刻不明"
    
    try:
        # Parse the UTC timestamp
        if timestamp_str.endswith('Z'):
            dt_utc = datetime.datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
        elif '+00:00' in timestamp_str:
            dt_utc = datetime.datetime.fromisoformat(timestamp_str)
        else:
            # Assume UTC if no timezone info
            dt_utc = datetime.datetime.fromisoformat(timestamp_str).replace(tzinfo=datetime.timezone.utc)
        
        # Convert to JST (UTC+9)
        jst = pytz.timezone('Asia/Tokyo')
        dt_jst = dt_utc.astimezone(jst)
        
        # Format in Japanese style
        return dt_jst.strftime("%Y年%m月%d日 %H:%M")
    except Exception as e:
        print(f"Timestamp parsing error: {e}")
        return "時刻不明"

# Japanese translations
STATUS_TRANSLATIONS = {
    "Working": "社内対応",
    "Needs Maintenance": "社外対応",
    "Out of Order": "保留中"
}

MESSAGE_TYPE_TRANSLATIONS = {
    "general": "一般",
    "issue": "問題", 
    "fixed": "修理済み",
    "question": "質問",
    "status_update": "ステータス更新"
}

MESSAGE_TYPE_EMOJIS = {
    'general': '💬',
    'issue': '⚠️',
    'fixed': '✅', 
    'question': '❓',
    'status_update': '🔄'
}

MESSAGE_TYPE_COLORS = {
    'issue': '#fff3cd',
    'question': '#d1edff',
    'fixed': '#d4edda',
    'status_update': '#e2e3e5',
    'general': '#f8f9fa'
}

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
        """データベース接続をテスト"""
        try:
            response = requests.get(
                f"{self.base_url}/rest/v1/{self.messages_table}?limit=1",
                headers=self.headers,
                timeout=10
            )
            return response.status_code in [200, 201]
        except Exception as e:
            st.error(f"接続テストが失敗しました: {e}")
            return False
    
    def get_items(self):
        """データベースからすべてのアイテムを取得"""
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
                st.error(f"アイテム取得エラー: {response.status_code} - {response.text}")
                return []
        except Exception as e:
            st.error(f"アイテム取得で例外発生: {e}")
            return []
    
    def get_messages(self, item_id=None):
        """メッセージを取得、オプションでitem_idでフィルタ"""
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
                            'user_name': payload.get('user', 'Anonymous'),  # Map to user_name
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
                st.error(f"メッセージ取得エラー: {response.status_code}")
                return []
        except Exception as e:
            st.error(f"メッセージ取得で例外発生: {e}")
            return []
    
    def add_item(self, item_id, name, location, status="Working"):
        """新しいアイテムをデータベースに追加"""
        try:
            # Check if item already exists
            existing_items = self.get_items()
            for item in existing_items:
                if item.get('item_id') == item_id:
                    return False, "アイテムIDが既に存在します"
            
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
                return True, "成功"
            else:
                error_detail = ""
                try:
                    error_data = response.json()
                    error_detail = error_data.get('message', response.text)
                except:
                    error_detail = response.text
                return False, f"ステータス {response.status_code}: {error_detail}"
        except Exception as e:
            return False, str(e)
    
    def add_message(self, item_id, message, user, msg_type="general"):
        """新しいメッセージをデータベースに追加 - user_name列を使用"""
        try:
            # Clean and validate user input
            user = user.strip() if user and user.strip() else ""
            message = message.strip() if message else ""
            
            if not message:
                return False, "メッセージが空です"
            
            # Set default user if empty
            final_user = user if user else "匿名"
            
            # Use user_name column to match your database schema
            data = {
                "item_id": item_id,
                "message": message,
                "user_name": final_user,  # Use user_name to match your DB schema
                "msg_type": msg_type,
                "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
            }
            
            # Make the request
            response = requests.post(
                f"{self.base_url}/rest/v1/{self.messages_table}",
                headers=self.headers,
                json=data,
                timeout=10
            )
            
            if response.status_code == 201:
                return True, "メッセージが正常に投稿されました"
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
                
                return False, f"メッセージ投稿に失敗しました (ステータス {response.status_code}): {error_detail}"
                
        except requests.exceptions.Timeout:
            return False, "リクエストがタイムアウトしました。インターネット接続を確認してください。"
        except requests.exceptions.ConnectionError:
            return False, "接続エラー。インターネット接続を確認してください。"
        except Exception as e:
            return False, f"予期しないエラー: {str(e)}"
    
    def update_item_status(self, item_id, status):
        """アイテムステータスを更新"""
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
            st.error(f"ステータス更新で例外発生: {e}")
            return False
    
    def delete_item(self, item_id):
        """アイテムとそのすべてのメッセージを削除"""
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
            st.error(f"アイテム削除で例外発生: {e}")
            return False

def check_password():
    """パスワード認証をチェック"""
    # Initialize authentication state
    if 'authenticated' not in st.session_state:
        st.session_state.authenticated = False
    
    return st.session_state.authenticated

def show_password_form():
    """シンプルな白黒ログインフォーム"""
    # Minimal black and white CSS
    st.markdown("""
    <style>
    /* Clean white background for everything */
    .stForm {
        background-color: white !important;
        background-image: none !important;
        background: white !important;
        padding: 3rem !important;
        border: 2px solid #000000 !important;
        border-radius: 8px !important;
        max-width: 400px !important;
        margin: 0 auto !important;
        box-shadow: none !important;
    }
    
    /* Remove any inherited backgrounds */
    .stForm > div,
    .stForm .stMarkdown,
    .stForm .stTextInput,
    .stForm .stButton {
        background: none !important;
        background-color: transparent !important;
        background-image: none !important;
    }
    
    /* Simple black text */
    .simple-title {
        color: #000000 !important;
        font-size: 1.8rem !important;
        font-weight: bold !important;
        text-align: center !important;
        margin-bottom: 2rem !important;
        background: none !important;
    }
    
    /* Black labels */
    .stForm .stTextInput label {
        color: #000000 !important;
        font-size: 1rem !important;
        font-weight: normal !important;
        background: none !important;
    }
    
    /* Simple white input with black border */
    .stForm .stTextInput input {
        background-color: white !important;
        border: 2px solid #000000 !important;
        border-radius: 4px !important;
        color: #000000 !important;
        font-size: 1.2rem !important;
        padding: 0.8rem !important;
        text-align: center !important;
    }
    
    .stForm .stTextInput input::placeholder {
        color: #666666 !important;
        text-align: center !important;
    }
    
    .stForm .stTextInput input:focus {
        border-color: #000000 !important;
        box-shadow: none !important;
        outline: none !important;
    }
    
    /* Simple black button */
    .stForm .stButton button {
        background-color: #000000 !important;
        color: white !important;
        border: none !important;
        font-size: 1.1rem !important;
        font-weight: bold !important;
        padding: 0.8rem 2rem !important;
        border-radius: 4px !important;
        width: 100% !important;
        cursor: pointer !important;
    }
    
    .stForm .stButton button:hover {
        background-color: #333333 !important;
        transform: none !important;
        box-shadow: none !important;
    }
    </style>
    """, unsafe_allow_html=True)
    
    # Center the form
    col1, col2, col3 = st.columns([1, 1, 1])
    
    with col2:
        with st.form("password_form"):
            # Simple title
            st.markdown('<div class="simple-title">管理者ログイン</div>', unsafe_allow_html=True)
            
            # Password input
            password = st.text_input(
                "パスワード",
                type="password",
                max_chars=4,
                # placeholder="パスワード入力",
                key="login_password"
            )
            
            # Login button
            submit_button = st.form_submit_button("ログイン", type="primary")
            
            if submit_button:
                if password and len(password) == 4 and password.isdigit():
                    ADMIN_PASSWORD = "1234"
                    
                    if password == ADMIN_PASSWORD:
                        st.session_state.authenticated = True
                        st.rerun()
                    else:
                        st.error("パスワードが正しくありません")
                else:
                    st.error("正しいパスワードを入力してください")

def main():
    """メインアプリケーション関数"""
    st.set_page_config(
        page_title="デジタルメモタグシステム",
        page_icon="🏷️",
        layout="wide",
        initial_sidebar_state="collapsed"  # Hide sidebar since we're using horizontal tabs
    )
    
    # Add custom CSS for better navigation and typography
    st.markdown("""
    <style>
    /* Hide sidebar completely */
    .css-1d391kg {
        display: none;
    }
    
    /* Hide any flash messages during transitions */
    .stAlert[data-testid="stNotificationContentInfo"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
    }
    
    /* Tab styling - MUCH LARGER */
    .stTabs [data-baseweb="tab-list"] {
        gap: 40px;
        justify-content: center;
        margin-bottom: 2rem;
        background-color: #f8f9fa;
        padding: 1.5rem;
        border-radius: 12px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .stTabs [data-baseweb="tab"] {
        height: 90px;
        padding: 0px 50px;
        background-color: white;
        border-radius: 8px;
        border: 2px solid transparent;
        transition: all 0.3s ease;
    }
    
    .stTabs [data-baseweb="tab"]:hover {
        background-color: #e3f2fd;
        border-color: #2196f3;
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0,0,0,0.15);
    }
    
    .stTabs [data-baseweb="tab-list"] button [data-testid="stMarkdownContainer"] p {
        font-size: 36px !important;
        font-weight: bold;
        color: #37474f;
        margin: 0;
        text-align: center;
    }
    
    .stTabs [aria-selected="true"] {
        background-color: #2196f3 !important;
        border-color: #2196f3 !important;
        box-shadow: 0 4px 12px rgba(33, 150, 243, 0.4) !important;
    }
    
    .stTabs [aria-selected="true"] [data-testid="stMarkdownContainer"] p {
        color: white !important;
        font-weight: 900;
    }
    
    /* Main content styling */
    .block-container {
        padding-top: 2rem;
        max-width: none;
        padding-left: 2rem;
        padding-right: 2rem;
    }
    
    /* Header styling - MUCH LARGER */
    h1, h2, h3 {
        font-weight: bold !important;
        color: #263238;
    }
    
    h1 {
        font-size: 5rem !important;
    }
    
    h2 {
        font-size: 4rem !important;
    }
    
    h3 {
        font-size: 3rem !important;
    }
    
    /* Make regular text MUCH larger for desktop */
    .stMarkdown p {
        font-size: 30px !important;
        line-height: 1.6;
        font-weight: 500;
    }
    
    /* List items much larger */
    .stMarkdown li {
        font-size: 28px !important;
        line-height: 1.6;
        margin-bottom: 0.5rem;
    }
    
    /* Button styling - MUCH LARGER */
    .stButton > button {
        font-weight: 600;
        border-radius: 8px;
        transition: all 0.3s ease;
        font-size: 28px !important;
        padding: 1.2rem 2rem !important;
        min-height: 60px;
    }
    
    .stButton > button:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(0,0,0,0.15);
    }
    
    /* Form styling - MUCH LARGER with PROPERLY CENTERED PLACEHOLDERS */
    .stSelectbox > div > div {
        font-size: 28px !important;
        min-height: 60px;
        text-align: center !important;
    }
    
    .stSelectbox label {
        font-size: 26px !important;
        font-weight: 600 !important;
        margin-bottom: 1rem !important;
        text-align: left !important;
    }
    
    .stTextInput > div > div > input {
        font-size: 28px !important;
        padding: 1.5rem !important;
        min-height: 60px;
        text-align: center !important;
    }
    
    .stTextInput > div > div > input::placeholder {
        text-align: center !important;
        font-size: 28px !important;
        color: #999 !important;
        opacity: 1 !important;
    }
    
    .stTextInput label {
        font-size: 26px !important;
        font-weight: 600 !important;
        margin-bottom: 1rem !important;
        text-align: left !important;
    }
    
    .stTextArea > div > div > textarea {
        font-size: 28px !important;
        padding: 1.5rem !important;
        min-height: 120px;
        text-align: left !important;
    }
    
    .stTextArea > div > div > textarea::placeholder {
        font-size: 28px !important;
        color: #999 !important;
        opacity: 1 !important;
        text-align: left !important;
    }
    
    .stTextArea label {
        font-size: 26px !important;
        font-weight: 600 !important;
        margin-bottom: 1rem !important;
        text-align: left !important;
    }
    
    /* Center dropdown content properly */
    .stSelectbox > div > div > div {
        text-align: center !important;
    }
    
    /* Center form submit buttons */
    .stFormSubmitButton > button {
        font-size: 28px !important;
        padding: 1.2rem 2rem !important;
        min-height: 60px !important;
        margin: 0 auto !important;
        display: block !important;
    }
    
    /* Metric styling - MUCH LARGER */
    .metric-container [data-testid="metric-container"] {
        font-size: 40px !important;
    }
    
    .metric-container [data-testid="metric-container"] label {
        font-size: 32px !important;
        font-weight: 600 !important;
    }
    
    /* Info/Warning/Error boxes - MUCH LARGER */
    .stAlert {
        font-size: 26px !important;
        padding: 1.5rem !important;
    }
    
    /* Expander styling - MUCH LARGER */
    .streamlit-expanderHeader {
        font-size: 30px !important;
        font-weight: 600 !important;
        padding: 1rem !important;
    }
    
    /* Caption styling - LARGER */
    .caption {
        font-size: 22px !important;
    }
    
    /* Code blocks - LARGER */
    .stCode {
        font-size: 22px !important;
        padding: 1rem !important;
    }
    
    /* Table styling - LARGER */
    .stDataFrame {
        font-size: 24px !important;
    }
    
    /* Subheader styling - MUCH LARGER */
    .stMarkdown h4, .stMarkdown h5, .stMarkdown h6 {
        font-size: 2.5rem !important;
        font-weight: bold !important;
    }
    </style>
    """, unsafe_allow_html=True)
    
    # Initialize database
    if not SUPABASE_URL or not SUPABASE_KEY:
        st.error("⚠️ データベースが設定されていません。StreamlitシークレットでSupabase認証情報を設定してください。")
        st.info("StreamlitシークレットにSUPABASE_URLとSUPABASE_KEYを追加してください。")
        with st.expander("セットアップ手順"):
            st.markdown("""
            1. Streamlitアプリ設定に移動
            2. 以下のシークレットを追加:
               ```
               SUPABASE_URL = "your_supabase_project_url"
               SUPABASE_KEY = "your_supabase_anon_key"
               ```
            3. Supabase SQLエディタでテーブルを作成（管理パネルのSQLコマンドを参照）
            """)
        use_fallback_mode()
        return
    
    db = Database()
    
    # Test connection on first load
    if 'connection_tested' not in st.session_state:
        with st.spinner("データベース接続をテスト中..."):
            if db.test_connection():
                st.session_state.connection_tested = True
            else:
                st.error("❌ データベースへの接続に失敗しました。認証情報を確認してください。")
                st.info("テスト用のフォールバックモードを引き続き使用できます。")
                use_fallback_mode()
                return
    
    # Handle URL parameters for direct item access
    query_params = st.query_params
    direct_item = query_params.get("item", None)
    
    # If accessed via QR code, go directly to memo board (no password required)
    if direct_item:
        show_memo_board_direct(direct_item, db)
    else:
        # Check password for main dashboard access
        if not check_password():
            show_password_form()
        else:
            # Add logout button in top right
            col1, col2, col3 = st.columns([6, 1, 1])
            with col3:
                if st.button("🚪 ログアウト"):
                    st.session_state.authenticated = False
                    st.rerun()
            
            # Create horizontal navigation tabs
            tab1, tab2, tab3, tab4 = st.tabs([
                "🏠 **ホーム**", 
                "📱 **メモボード**", 
                "⚙️ **管理パネル**", 
                "❓ **ヘルプ**"
            ])
            
            with tab1:
                show_home_page(db)
            
            with tab2:
                show_memo_board(db)
            
            with tab3:
                show_admin_panel(db)
            
            with tab4:
                show_help_page()

def show_memo_board_direct(item_id, db):
    """QRコードアクセス用のメモボードを直接表示"""
    items = db.get_items()
    item_dict = {item['item_id']: item for item in items}
    
    if item_id not in item_dict:
        st.error(f"❌ アイテム '{item_id}' が見つかりません!")
        if st.button("🏠 ホームに移動"):
            st.query_params.clear()
            st.rerun()
        return
    
    item_info = item_dict[item_id]
    
    # Item Header
    st.markdown(f"## 🏷️ {item_info['name']}")
    
    # Message Board Section
    st.markdown("### 💬 メッセージボード")
    
    # Post new message form
    with st.form("new_message_form", clear_on_submit=True):
        st.markdown("**新しいメッセージを投稿**")
        
        col1, col2 = st.columns([2, 1])
        with col1:
            user_name = st.text_input(
                "お名前（任意）:",
                # placeholder="匿名",
                key="user_input"
            )
        
        message_type = "general"

        message = st.text_area(
            "メッセージ:",
            # placeholder="メッセージ、指示、質問、更新情報をここに書いてください...",
            key="message_input",
            height=100
        )
        
        col1, col2, col3 = st.columns([1, 1, 3])
        with col1:
            submit_button = st.form_submit_button("📮 メッセージ投稿", type="primary")
        
        if submit_button:
            if message and message.strip():
                with st.spinner("メッセージを投稿中..."):
                    success, error_msg = db.add_message(item_id, message.strip(), user_name or "匿名", message_type)
                    if success:
                        st.success("✅ メッセージが正常に投稿されました!")
                        st.rerun()
                    else:
                        st.error(f"❌ {error_msg}")
            else:
                st.warning("⚠️ 投稿する前にメッセージを入力してください。")
    
    # Display messages
    st.divider()
    display_messages_for_item(item_id, db)

def display_messages_for_item(item_id, db):
    """特定のアイテムのメッセージを表示 - user_name列対応版"""
    with st.spinner("メッセージを読み込み中..."):
        messages = db.get_messages(item_id)
    
    if not messages:
        st.info("📭 まだメッセージがありません。最初の投稿者になりましょう!")
        return
    
    st.markdown(f"**📊 {len(messages)} 件のメッセージ**")
    
    for msg in messages:
        msg_type = msg.get('msg_type', 'general')
        emoji = MESSAGE_TYPE_EMOJIS.get(msg_type, '💬')
        bg_color = MESSAGE_TYPE_COLORS.get(msg_type, '#f8f9fa')
        
        # Get user name - use user_name column from your database
        user_name = msg.get('user_name', '匿名')
        
        # Format timestamp with JST conversion
        created_at = msg.get('created_at', '')
        formatted_time = format_timestamp_jst(created_at)
        
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
                {emoji} <strong>{user_name}</strong> • {formatted_time}
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
    """概要付きホームページを表示"""
    st.header("🏠 デジタルメモシステムへようこそ")
    
    # Introduction
    st.markdown("""
    ### 📱 使い方
    
    1. **機器管理者** - 機器・装置にQRコードを貼り付け
    2. **利用者** - QRコードをスキャンしてメモボードにアクセス
    3. **コミュニケーション** - メッセージを残す、問題を報告、指示を共有
    4. **データ保存** - 全データはクラウドデータベースに保存
    """)
    
    # Statistics
    with st.spinner("統計を読み込み中..."):
        items = db.get_items()
        all_messages = db.get_messages()
    
    st.divider()
    
    # Quick Access Section
    col1, col2 = st.columns([1, 1])
    
    with col1:
        st.subheader("🚀 クイックアクセス")
        if items:
            st.markdown("アイテムに直接移動:")
            for item in items[:5]:
                col_a, col_b = st.columns([3, 1])
                with col_a:
                    st.markdown(f"**{item['name']}**")
                    st.caption(f"📍 {item.get('location', '不明')}")
                with col_b:
                    if st.button("開く", key=f"quick_{item['item_id']}"):
                        st.query_params.update({"item": item['item_id']})
                        st.rerun()
        else:
            st.info("まだアイテムが設定されていません。管理パネルでアイテムを追加してください。")
    
    with col2:
        st.subheader("📊 直近の投稿一覧")
        recent_messages = sorted(all_messages, 
                                key=lambda x: x.get('created_at', ''), 
                                reverse=True)[:5]
        
        if recent_messages:
            items_dict = {item['item_id']: item['name'] for item in items}
            for msg in recent_messages:
                item_name = items_dict.get(msg.get('item_id', ''), '不明')
                st.markdown(f"**{msg.get('user_name', '匿名')}** → _{item_name}_")
                with st.container():
                    message_preview = msg.get('message', '')
                    if len(message_preview) > 100:
                        message_preview = message_preview[:100] + "..."
                    st.caption(message_preview)
        else:
            st.info("最近のアクティビティはありません")

def show_memo_board(db):
    """アイテム選択付きメモボードを表示"""
    st.header("📱 メモボード")
    
    items = db.get_items()
    
    if not items:
        st.warning("⚠️ まだアイテムが設定されていません!")
        st.info("まず管理パネルでアイテムを追加してください。")
        
        if st.button("管理パネルに移動"):
            st.rerun()
        return
    
    # Item selection
    item_dict = {item['item_id']: f"{item['name']} ({item.get('location', '不明')})" 
                 for item in items}
    
    selected_item = st.selectbox(
        "🏷️ アイテムを選択:",
        options=list(item_dict.keys()),
        format_func=lambda x: item_dict[x]
    )
    
    if selected_item:
        st.divider()
        # Reuse the direct view function
        show_memo_board_direct(selected_item, db)

def show_admin_panel(db):
    """システム管理用の管理パネルを表示"""
    st.header("⚙️ 管理パネル")
    
    tab1, tab2, tab3, tab4 = st.tabs(["📦 アイテム", "💬 メッセージ", "🏷️ QRコード", "🗄️ データベース"])
    
    with tab1:
        st.subheader("📦 アイテム管理")
        
        # Add new item form
        with st.expander("➕ 新しいアイテムを追加", expanded=True):
            with st.form("add_item_form"):
                col1, col2 = st.columns(2)
                
                with col1:
                    new_id = st.text_input(
                        "管理番号ID（ダブらないように!）:",
                        # placeholder="例: 20250909_01",
                        help="英数字とアンダースコアのみ使用してください。スペースや特殊文字は不可。"
                    )
                    new_name = st.text_input(
                        "アイテム名:",
                        # placeholder="例:樹脂カバーA"
                    )
                
                with col2:
                    new_location = st.text_input(
                        "場所:",
                        # placeholder="例: 工場2階"
                    )
                    new_status = st.selectbox(
                        "分類:",
                        ["Working", "Needs Maintenance", "Out of Order"],
                        format_func=lambda x: STATUS_TRANSLATIONS.get(x, x)
                    )
                
                submitted = st.form_submit_button("アイテム追加", type="primary")
                
                if submitted:
                    if new_id and new_name and new_location:
                        # Validate item_id format
                        if ' ' in new_id or any(c in new_id for c in ['/', '\\', '?', '#']):
                            st.error("アイテムIDにスペースや特殊文字を含めることはできません。英数字とアンダースコアのみ使用してください。")
                        else:
                            with st.spinner("アイテムを追加中..."):
                                success, msg = db.add_item(new_id, new_name, new_location, new_status)
                                if success:
                                    st.success(f"✅ アイテム '{new_name}' が正常に追加されました!")
                                    st.rerun()
                                else:
                                    st.error(f"❌ アイテムの追加に失敗しました: {msg}")
                    else:
                        st.error("すべての必須フィールドに入力してください")
        
        # List existing items
        st.divider()
        st.markdown("### 📋 現在のアイテム")
        
        items = db.get_items()
        if items:
            for idx, item in enumerate(items):
                col1, col2, col3, col4, col5 = st.columns([3, 2, 2, 1, 1])
                
                with col1:
                    st.markdown(f"**{item['name']}**")
                    st.caption(f"ID: {item['item_id']}")
                
                with col2:
                    st.markdown(f"📍 {item.get('location', '不明')}")
                
                with col3:
                    status = item.get('status', '不明')
                    status_jp = STATUS_TRANSLATIONS.get(status, status)
                    status_emoji = {
                        "Working": "🟢",
                        "Needs Maintenance": "🟡",
                        "Out of Order": "🔴"
                    }.get(status, "⚪")
                    st.markdown(f"{status_emoji} {status_jp}")
                
                with col4:
                    if st.button("表示", key=f"view_{item['item_id']}"):
                        st.query_params.update({"item": item['item_id']})
                        st.rerun()
                
                with col5:
                    if st.button("🗑️", key=f"delete_{item['item_id']}", help="アイテムを削除"):
                        if st.session_state.get(f"confirm_delete_{item['item_id']}", False):
                            if db.delete_item(item['item_id']):
                                st.success(f"{item['name']} を削除しました")
                                st.rerun()
                            else:
                                st.error("アイテムの削除に失敗しました")
                        else:
                            st.session_state[f"confirm_delete_{item['item_id']}"] = True
                            st.warning("削除を確認するためもう一度クリックしてください")
                
                if idx < len(items) - 1:
                    st.divider()
        else:
            st.info("まだアイテムが設定されていません。上記で最初のアイテムを追加してください!")
    
    with tab2:
        st.subheader("💬 すべてのメッセージ")
        
        all_messages = db.get_messages()
        
        if all_messages:
            # Statistics
            col1, col2, col3, col4 = st.columns(4)
            
            with col1:
                st.metric("総メッセージ数", len(all_messages))
            
            with col2:
                issues = len([m for m in all_messages if m.get('msg_type') == 'issue'])
                st.metric("問題", issues)
            
            with col3:
                questions = len([m for m in all_messages if m.get('msg_type') == 'question'])
                st.metric("質問", questions)
            
            with col4:
                fixed = len([m for m in all_messages if m.get('msg_type') == 'fixed'])
                st.metric("修理済み", fixed)
            
            st.divider()
            
            # Filter options
            col1, col2 = st.columns(2)
            with col1:
                type_options = ["すべて", "general", "issue", "question", "fixed", "status_update"]
                filter_type = st.selectbox(
                    "種類でフィルタ:",
                    type_options,
                    format_func=lambda x: MESSAGE_TYPE_TRANSLATIONS.get(x, x) if x != "すべて" else x
                )
            
            with col2:
                items = db.get_items()
                item_options = ["すべて"] + [item['item_id'] for item in items]
                filter_item = st.selectbox("アイテムでフィルタ:", item_options)
            
            # Display messages
            filtered_messages = all_messages
            
            if filter_type != "すべて":
                filtered_messages = [m for m in filtered_messages if m.get('msg_type') == filter_type]
            
            if filter_item != "すべて":
                filtered_messages = [m for m in filtered_messages if m.get('item_id') == filter_item]
            
            st.markdown(f"**{len(filtered_messages)} 件のメッセージを表示中**")
            
            items_dict = {item['item_id']: item['name'] for item in items}
            
            for msg in filtered_messages[:20]:  # Show latest 20
                item_name = items_dict.get(msg.get('item_id', ''), '不明なアイテム')
                msg_type = msg.get('msg_type', 'general')
                
                emoji = MESSAGE_TYPE_EMOJIS.get(msg_type, '💬')
                type_name = MESSAGE_TYPE_TRANSLATIONS.get(msg_type, msg_type)
                
                with st.expander(f"{emoji} {item_name} - {msg.get('user_name', '匿名')}"):
                    st.write(msg.get('message', ''))
                    created_at = msg.get('created_at', '不明な時刻')
                    formatted_time = format_timestamp_jst(created_at)
                    st.caption(f"投稿日時: {formatted_time}")
        else:
            st.info("まだメッセージが投稿されていません。")
    
    with tab3:
        st.subheader("🏷️ QRコード生成")
        
        # Get app URL
        app_url = st.text_input(
            "アプリURL:",
            value="https://kinugasa-hirata-digitalmemotag-memo-system-7egpza.streamlit.app/",
            help="StreamlitアプリのURL（アプリのURLが事前入力されています）"
        )
        
        items = db.get_items()
        
        if not items:
            st.warning("まだアイテムが設定されていません。まずアイテムを追加してください。")
        elif not QR_AVAILABLE:
            st.error("QRコードライブラリがインストールされていません。実行: pip install qrcode[pil]")
        else:
            if st.button("🎯 すべてのQRコードを生成", type="primary"):
                st.markdown("### 生成されたQRコード")
                st.info("画像を右クリックして保存し、印刷してください")
                
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
                            st.error(f"QR生成エラー: {e}")
                    
                    with col2:
                        st.markdown(f"### {item['name']}")
                        st.markdown(f"**設置場所:** {item.get('location', '不明')}")
                        st.markdown(f"**アイテムID:** `{item['item_id']}`")
                        st.code(qr_url, language="text")
                        
                        # Download button
                        try:
                            buffer.seek(0)
                            st.download_button(
                                label="QRコードをダウンロード",
                                data=buffer.getvalue(),
                                file_name=f"qr_{item['item_id']}.png",
                                mime="image/png"
                            )
                        except:
                            pass
    
    with tab4:
        st.subheader("🗄️ データベースセットアップ")
        
        st.info("Supabaseテーブルが適切に設定されていることを確認してください。")
        
        with st.expander("📋 必要なテーブルスキーマ"):
            st.markdown("### アイテムテーブル")
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
            
            st.markdown("### メッセージテーブル")
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
            
            st.markdown("### 行レベルセキュリティを有効化（オプション）")
            st.code("""
-- RLSを有効化
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- パブリックアクセス用のポリシーを作成
CREATE POLICY "Allow all operations on items" ON items FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on messages" ON messages FOR ALL TO anon USING (true) WITH CHECK (true);
            """, language="sql")
        
        # Connection test
        st.markdown("### 接続テスト")
        if st.button("🧪 データベース接続をテスト"):
            with st.spinner("接続をテスト中..."):
                if db.test_connection():
                    st.success("✅ データベース接続成功!")
                    
                    # Test table access
                    items = db.get_items()
                    messages = db.get_messages()
                    
                    col1, col2 = st.columns(2)
                    with col1:
                        st.metric("見つかったアイテム", len(items))
                    with col2:
                        st.metric("見つかったメッセージ", len(messages))
                else:
                    st.error("❌ データベース接続に失敗しました!")

def show_help_page():
    """ヘルプとドキュメントを表示"""
    st.header("❓ ヘルプ & ドキュメント")
    
    tab1, tab2, tab3 = st.tabs(["🚀 はじめに", "🔧 トラブルシューティング", "📖 よくある質問"])
    
    with tab1:
        st.markdown("""
        ## はじめに
        
        ### 1. データベースセットアップ
        - supabase.comで無料アカウントを作成
        - 新しいプロジェクトを作成
        - プロジェクトURLとanonキーをコピー
        - Streamlitシークレットに追加
        - データベースタブのSQLコマンドを実行してテーブルを作成
        
        ### 2. アイテム追加
        - 管理パネル → アイテムに移動
        - 機器・装置をユニークIDで追加
        - "printer_01"、"cnc_machine_a"のような簡単なIDを使用
        
        ### 3. QRコード生成
        - 管理パネル → QRコードに移動
        - アプリURLを入力
        - QRコードを生成・ダウンロード
        - 印刷して機器に貼り付け
        
        ### 4. システムテスト
        - QRコードをスキャンまたは直接リンクを使用
        - テストメッセージを投稿
        - ステータスを更新
        """)
    
    with tab2:
        st.markdown("""
        ## トラブルシューティング
        
        ### データベース接続の問題
        - シークレットのSUPABASE_URLとSUPABASE_KEYを確認
        - 正しいスキーマでテーブルが作成されていることを確認
        - RLSを使用している場合は行レベルセキュリティポリシーを確認
        
        ### メッセージ投稿の失敗
        - インターネット接続を確認
        - テーブル権限を確認
        - アイテムIDの特殊文字を確認
        - itemsテーブルにitem_idが存在することを確認
        
        ### QRコードが機能しない
        - qrcodeライブラリをインストール: `pip install qrcode[pil]`
        - アプリURLが正しくアクセス可能であることを確認
        - 印刷前にリンクを手動でテスト
        
        ### パフォーマンスの問題
        - 大量のメッセージは読み込みを遅くする可能性があります
        - メッセージのページネーション実装を検討
        - Supabaseダッシュボードでデータベースパフォーマンスを確認
        """)
    
    with tab3:
        st.markdown("""
        ## よくある質問
        
        **Q: このシステムは無料で使用できますか？**
        A: はい！500MBデータベースと50MBファイルストレージを含むSupabase無料プランを使用します。
        
        **Q: いくつのアイテム/メッセージを持てますか？**
        A: Supabaseプランによります。無料プランは数千のメッセージをサポートします。
        
        **Q: メッセージタイプをカスタマイズできますか？**
        A: はい、コード内のmessage_typeオプションを変更してください。
        
        **Q: データはバックアップされますか？**
        A: Supabaseは自動バックアップを提供します。手動でデータをエクスポートすることも可能です。
        
        **Q: オフラインで使用できますか？**
        A: いいえ、データベースアクセスにはインターネット接続が必要です。
        
        **Q: アプリを更新するには？**
        A: コードファイルを置き換えてStreamlitアプリを再起動してください。
        
        **Q: 複数の人が同じアイテムを同時に使用できますか？**
        A: はい！複数のユーザーが同じアイテムにリアルタイムでメッセージを投稿できます。
        """)

def use_fallback_mode():
    """フォールバックモード（データベースなし、テスト用）"""
    st.warning("⚠️ フォールバックモードで実行中 - データは保持されません!")
    
    # Initialize session state
    if 'items' not in st.session_state:
        st.session_state.items = {
            "test_machine": {"name": "テストマシン", "location": "工場", "status": "Working"}
        }
    
    if 'messages' not in st.session_state:
        st.session_state.messages = []
    
    st.subheader("🧪 テストメッセージボード")
    
    # Simple message posting
    with st.form("post_message"):
        name = st.text_input("お名前:", placeholder="匿名")
        message = st.text_area("メッセージ:")
        submitted = st.form_submit_button("メッセージ投稿")
        
        if submitted and message:
            new_msg = {
                "user_name": name or "匿名",  # Use user_name for consistency
                "message": message,
                "timestamp": datetime.datetime.now().strftime("%Y年%m月%d日 %H:%M:%S"),
                "msg_type": "general"
            }
            st.session_state.messages.insert(0, new_msg)
            st.success("メッセージが投稿されました!")
            st.rerun()
    
    # Display messages
    for msg in st.session_state.messages:
        st.markdown(f"""
        <div style="border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin: 10px 0; background-color: #f9f9f9;">
            <div style="font-size: 14px; color: #666; margin-bottom: 8px;">
                💬 <strong>{msg['user_name']}</strong> • {msg['timestamp']}
            </div>
            <div style="font-size: 16px; line-height: 1.4;">
                {msg['message']}
            </div>
        </div>
        """, unsafe_allow_html=True)

if __name__ == "__main__":
    main()