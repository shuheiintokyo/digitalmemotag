import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { QrCode, Plus, MessageSquare, LogOut, Edit, Download, Trash2, Bell, HelpCircle, X } from 'lucide-react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import QRCode from 'qrcode';
import { useAuth } from '../hooks/useAuth';

export default function DigitalMemoTag() {
  const router = useRouter();
  const { isAdmin, user, loading, login, logout } = useAuth();
  
  // All state hooks must be called in the same order every time
  const [currentPage, setCurrentPage] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [items, setItems] = useState([]);
  const [messages, setMessages] = useState([]);
  const [quickButtons, setQuickButtons] = useState({
    blue: '作業を開始しました',
    green: '作業を完了しました', 
    yellow: '作業に遅れが生じています',
    red: '問題が発生しました。'
  });
  const [showSettings, setShowSettings] = useState(false);
  const [qrCodes, setQrCodes] = useState({});
  const [itemToDelete, setItemToDelete] = useState(null);
  const [messageToDelete, setMessageToDelete] = useState(null);
  const [lastViewedTimes, setLastViewedTimes] = useState({});

  // Status color mapping
  const statusColors = {
    'Working': '#3b82f6', // blue
    'Completed': '#10b981', // green  
    'Delayed': '#f59e0b', // yellow
    'Problem': '#ef4444' // red
  };

  // All useEffect hooks must be called in the same order every time
  
  // Load last viewed times from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('lastViewedTimes');
    if (saved) {
      setLastViewedTimes(JSON.parse(saved));
    }
  }, []);

  // Load items when admin is authenticated
  useEffect(() => {
    if (isAdmin) {
      loadItems();
    }
  }, [isAdmin]);

  // Handle initial page routing
  useEffect(() => {
    if (loading) return; // Wait for auth to load
    
    if (router.query.item) {
      handleDirectAccess(router.query.item);
    } else if (isAdmin) {
      setCurrentPage('dashboard');
    } else {
      setCurrentPage('login');
    }
  }, [router.query.item, isAdmin, loading]);

  // Generate QR code for an item
  const generateQRCode = async (itemId) => {
    try {
      const url = `${window.location.origin}?item=${itemId}`;
      const qrCodeDataURL = await QRCode.toDataURL(url, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setQrCodes(prev => ({ ...prev, [itemId]: qrCodeDataURL }));
      return qrCodeDataURL;
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  };

  // Download QR code as image
  const downloadQRCode = (itemId, itemName) => {
    const qrCodeDataURL = qrCodes[itemId];
    if (qrCodeDataURL) {
      const link = document.createElement('a');
      link.download = `QR_${itemId}_${itemName}.png`;
      link.href = qrCodeDataURL;
      link.click();
    }
  };

  // Handle direct access via QR code
  const handleDirectAccess = async (itemId) => {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('item_id', itemId)
        .single();
      
      if (error) throw error;
      if (data) {
        setSelectedItem(data);
        await loadMessages(data.item_id);
        setCurrentPage('messageboard');
      }
    } catch (error) {
      console.error('Item not found:', error);
      setCurrentPage('mobile');
    }
  };

  // Generate item ID in format YYYYMMDD-XX
  const generateItemId = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    
    // Get today's items to determine the next sequence number
    const todayPrefix = `${year}${month}${day}`;
    const todayItems = items.filter(item => item.item_id.startsWith(todayPrefix));
    const nextSequence = String(todayItems.length + 1).padStart(2, '0');
    
    return `${todayPrefix}-${nextSequence}`;
  };

  // Check if item has new messages
  const hasNewMessages = (itemId, latestMessageTime) => {
    const lastViewed = lastViewedTimes[itemId];
    if (!lastViewed || !latestMessageTime) return false;
    return new Date(latestMessageTime) > new Date(lastViewed);
  };

  // Mark messages as viewed for an item
  const markMessagesAsViewed = (itemId) => {
    setLastViewedTimes(prev => ({
      ...prev,
      [itemId]: new Date().toISOString()
    }));
    // Save to localStorage for persistence
    const updated = { ...lastViewedTimes, [itemId]: new Date().toISOString() };
    localStorage.setItem('lastViewedTimes', JSON.stringify(updated));
  };

  // Load items from database
  const loadItems = async () => {
    try {
      const { data: itemsData, error: itemsError } = await supabase
        .from('items')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (itemsError) throw itemsError;
      
      // Get latest message time for each item
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('item_id, created_at')
        .order('created_at', { ascending: false });
      
      if (messagesError) throw messagesError;
      
      // Create a map of latest message times
      const latestMessageTimes = {};
      if (messagesData) {
        messagesData.forEach(msg => {
          if (!latestMessageTimes[msg.item_id]) {
            latestMessageTimes[msg.item_id] = msg.created_at;
          }
        });
      }
      
      // Add latest message time to items
      const itemsWithMessageTimes = (itemsData || []).map(item => ({
        ...item,
        latest_message_time: latestMessageTimes[item.item_id]
      }));
      
      setItems(itemsWithMessageTimes);
      
      // Generate QR codes for all items
      if (itemsWithMessageTimes) {
        itemsWithMessageTimes.forEach(item => {
          generateQRCode(item.item_id);
        });
      }
    } catch (error) {
      console.error('Error loading items:', error);
    }
  };

  // Load messages for specific item
  const loadMessages = async (itemId) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('item_id', itemId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  // Add new item
  const addItem = async (name, location) => {
    try {
      const itemId = generateItemId();
      const { data, error } = await supabase
        .from('items')
        .insert([{
          item_id: itemId,
          name: name,
          location: location || '',
          status: 'Working'
        }]);
      
      if (error) throw error;
      loadItems();
      // Generate QR code for new item
      generateQRCode(itemId);
      return itemId;
    } catch (error) {
      console.error('Error adding item:', error);
    }
  };

  // Delete item and its messages
  const deleteItem = async (itemId) => {
    try {
      // Delete all messages for this item first
      await supabase
        .from('messages')
        .delete()
        .eq('item_id', itemId);
      
      // Then delete the item
      const { error } = await supabase
        .from('items')
        .delete()
        .eq('item_id', itemId);
      
      if (error) throw error;
      
      // Reload items
      loadItems();
      setItemToDelete(null);
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('削除中にエラーが発生しました');
    }
  };

  // Delete individual message
  const deleteMessage = async (messageId) => {
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId);
      
      if (error) throw error;
      
      // Reload messages for current item
      if (selectedItem) {
        loadMessages(selectedItem.item_id);
      }
      // Reload items to update latest message times
      loadItems();
      setMessageToDelete(null);
    } catch (error) {
      console.error('Error deleting message:', error);
      alert('メッセージの削除中にエラーが発生しました');
    }
  };

  // Add message
  const addMessage = async (itemId, message, userName = '匿名', msgType = 'general') => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert([{
          item_id: itemId,
          message: message,
          user_name: userName,
          msg_type: msgType
        }]);
      
      if (error) throw error;
      
      // Update item status based on message type
      if (msgType !== 'general') {
        let status = 'Working';
        if (msgType === 'green') status = 'Completed';
        else if (msgType === 'yellow') status = 'Delayed';
        else if (msgType === 'red') status = 'Problem';
        
        await supabase
          .from('items')
          .update({ status, updated_at: new Date() })
          .eq('item_id', itemId);
      }
      
      if (selectedItem && selectedItem.item_id === itemId) {
        loadMessages(itemId);
      }
      loadItems();
    } catch (error) {
      console.error('Error adding message:', error);
    }
  };

  // Show loading spinner while auth is loading
  if (loading) {
    return (
      <>
        <Head>
          <title>DigitalMemoTag - Loading...</title>
          <meta name="description" content="Factory product tracking and messaging system" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon.ico" />
        </Head>
        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">読み込み中...</p>
          </div>
        </div>
      </>
    );
  }

  // Help Modal Component for Message Board
  const HelpModal = ({ onClose }) => {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
            <h3 className="text-xl font-bold text-gray-900">メッセージボードの使い方</h3>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <X size={24} />
            </button>
          </div>
          
          <div className="px-6 py-4 space-y-4">
            <div>
              <h4 className="font-bold text-lg text-blue-600 mb-2">📋 メッセージボードについて</h4>
              <p className="text-gray-700 leading-relaxed">
                このメッセージボードは、特定の製品やアイテムに紐付けられたQRコードタグと連動しています。
                各製品には固有のメッセージボードがあり、作業状況の報告や連絡事項の共有ができます。
              </p>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-bold text-lg text-green-600 mb-2">✅ クイックアクションの使い方</h4>
              <p className="text-gray-700 leading-relaxed mb-2">
                クイックアクションボタンを使用すると、簡単に作業状況を報告できます：
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-1 ml-2">
                <li><span className="font-semibold text-blue-600">青ボタン：</span>作業開始の報告</li>
                <li><span className="font-semibold text-green-600">緑ボタン：</span>作業完了の報告</li>
                <li><span className="font-semibold text-yellow-600">黄ボタン：</span>遅延の報告</li>
                <li><span className="font-semibold text-red-600">赤ボタン：</span>問題発生の報告</li>
              </ul>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-bold text-lg text-purple-600 mb-2">✍️ メッセージの投稿方法</h4>
              <ul className="list-disc list-inside text-gray-700 space-y-2 ml-2">
                <li><span className="font-semibold">ユーザー名：</span>任意入力です。空欄の場合は「匿名」として投稿されます</li>
                <li><span className="font-semibold">メッセージ：</span>詳細な報告内容や連絡事項を記入してください</li>
                <li><span className="font-semibold">送信ボタン：</span>クリックすると投稿が完了します</li>
              </ul>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-bold text-lg text-red-600 mb-2">🗑️ メッセージの削除について</h4>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-gray-700 leading-relaxed mb-2">
                  投稿したメッセージは削除ボタン（ゴミ箱アイコン）で削除できます。
                </p>
                <p className="text-red-700 font-semibold">
                  ⚠️ 重要：削除したメッセージは復元できません。データベースから完全に削除されます。
                </p>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-bold text-lg text-orange-600 mb-2">🌐 ネットワーク接続について</h4>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p className="text-gray-700 leading-relaxed">
                  メッセージの投稿・削除には<span className="font-semibold">インターネット接続が必要</span>です。
                  オフライン状態では操作できませんので、ご注意ください。
                </p>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-bold text-lg text-indigo-600 mb-2">🔍 製品の確認</h4>
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                <p className="text-gray-700 leading-relaxed mb-2">
                  画面上部に表示されている<span className="font-semibold">製品名とID</span>を必ず確認してください。
                </p>
                <p className="text-gray-700 leading-relaxed">
                  各メッセージボードは特定の製品に紐付いているため、正しいQRコードをスキャンしているか確認することが重要です。
                </p>
              </div>
            </div>

            <div className="border-t pt-4 bg-gray-50 rounded-lg p-4">
              <h4 className="font-bold text-lg text-gray-800 mb-2">💡 ヒント</h4>
              <ul className="list-disc list-inside text-gray-700 space-y-1 ml-2">
                <li>定期的な作業報告でチーム全体の進捗を共有できます</li>
                <li>問題が発生した場合は赤ボタンで即座に報告しましょう</li>
                <li>詳細な情報が必要な場合はカスタムメッセージを活用してください</li>
              </ul>
            </div>
          </div>

          <div className="sticky bottom-0 bg-white border-t px-6 py-4">
            <button
              onClick={onClose}
              className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 font-medium"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Login Component - Updated to use auth hook
  const LoginPage = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async () => {
      setIsLoading(true);
      setError('');
      
      const result = await login(username, password);
      
      if (!result.success) {
        setError(result.message || 'パスコードが間違っています');
        setUsername('');
        setPassword('');
      }
      
      setIsLoading(false);
    };

    const handleKeyPress = (e) => {
      if (e.key === 'Enter' && !isLoading) {
        handleLogin();
      }
    };

    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
          <h1 className="text-2xl font-bold text-center mb-6">管理者ログイン</h1>
          <div>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                ユーザー名
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyPress={handleKeyPress}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
                disabled={isLoading}
              />
            </div>
            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                パスコード
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={handleKeyPress}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
                disabled={isLoading}
              />
            </div>
            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
            <button
              onClick={handleLogin}
              disabled={isLoading}
              className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'ログイン中...' : 'ログイン'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // QR Code Modal Component
  const QRCodeModal = ({ item, onClose }) => {
    const qrCodeUrl = qrCodes[item.item_id];
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full mx-4">
          <div className="text-center">
            <h3 className="text-lg font-bold mb-4">{item.name}</h3>
            <p className="text-sm text-gray-600 mb-4">ID: {item.item_id}</p>
            {qrCodeUrl && (
              <div className="mb-4">
                <img src={qrCodeUrl} alt="QR Code" className="mx-auto border rounded" />
              </div>
            )}
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => downloadQRCode(item.item_id, item.name)}
                className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 flex items-center gap-2"
              >
                <Download size={16} />
                ダウンロード
              </button>
              <button
                onClick={onClose}
                className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Delete Confirmation Modal Component
  const DeleteConfirmModal = ({ item, onConfirm, onCancel }) => {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full mx-4">
          <div className="text-center">
            <h3 className="text-lg font-bold mb-4">削除確認</h3>
            <p className="text-sm text-gray-600 mb-2">以下の製品を削除してもよろしいですか？</p>
            <p className="text-sm font-medium mb-4">
              {item.name} (ID: {item.item_id})
            </p>
            <p className="text-xs text-red-600 mb-6">
              ※ この操作は取り消せません。すべてのメッセージも削除されます。
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={onConfirm}
                className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
              >
                削除する
              </button>
              <button
                onClick={onCancel}
                className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Message Delete Confirmation Modal Component
  const MessageDeleteConfirmModal = ({ message, onConfirm, onCancel }) => {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full mx-4">
          <div className="text-center">
            <h3 className="text-lg font-bold mb-4">メッセージ削除確認</h3>
            <p className="text-sm text-gray-600 mb-2">以下のメッセージを削除してもよろしいですか？</p>
            <div className="text-sm bg-gray-50 p-3 rounded mb-4 text-left">
              <p><strong>投稿者:</strong> {message.user_name}</p>
              <p><strong>内容:</strong> {message.message}</p>
              <p><strong>投稿日時:</strong> {new Date(message.created_at).toLocaleString('ja-JP')}</p>
            </div>
            <p className="text-xs text-red-600 mb-6">
              ※ この操作は取り消せません。
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={onConfirm}
                className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
              >
                削除する
              </button>
              <button
                onClick={onCancel}
                className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Dashboard Component - Updated with improved logout
  const Dashboard = () => {
    const [showAddForm, setShowAddForm] = useState(false);
    const [newItemName, setNewItemName] = useState('');
    const [newItemLocation, setNewItemLocation] = useState('');
    const [selectedQRItem, setSelectedQRItem] = useState(null);

    const handleAddItem = async () => {
      if (newItemName.trim()) {
        await addItem(newItemName.trim(), newItemLocation.trim());
        setNewItemName('');
        setNewItemLocation('');
        setShowAddForm(false);
      }
    };

    const handleViewMessages = (item) => {
      setSelectedItem(item);
      loadMessages(item.item_id);
      markMessagesAsViewed(item.item_id);
      setCurrentPage('messageboard');
    };

    const handleLogout = async () => {
      await logout();
      setCurrentPage('login');
    };

    return (
      <div className="min-h-screen bg-gray-100">
        <div className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">ダッシュボード</h1>
              {user && (
                <p className="text-sm text-gray-600">ログイン中: {user.username}</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 flex items-center gap-2"
              >
                <Edit size={16} />
                設定
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-2"
              >
                <LogOut size={16} />
                ログアウト
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto p-6">
          {/* Quick Button Settings */}
          {showSettings && (
            <div className="bg-white p-6 rounded-lg shadow-md mb-6">
              <h3 className="text-lg font-bold mb-4">クイックボタン設定</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(quickButtons).map(([color, message]) => (
                  <div key={color}>
                    <label className="block text-sm font-medium mb-2">
                      {color === 'blue' && '青ボタン'}
                      {color === 'green' && '緑ボタン'}
                      {color === 'yellow' && '黄ボタン'}
                      {color === 'red' && '赤ボタン'}
                    </label>
                    <input
                      type="text"
                      value={message}
                      onChange={(e) => setQuickButtons({...quickButtons, [color]: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add Item Button */}
          <div className="mb-6">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 flex items-center gap-2"
            >
              <Plus size={16} />
              新しい製品タグを作成
            </button>
          </div>

          {/* Add Item Form */}
          {showAddForm && (
            <div className="bg-white p-6 rounded-lg shadow-md mb-6">
              <h3 className="text-lg font-bold mb-4">新製品追加</h3>
              <div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">製品名 *</label>
                    <input
                      type="text"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">保管場所</label>
                    <input
                      type="text"
                      value={newItemLocation}
                      onChange={(e) => setNewItemLocation(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={handleAddItem}
                    className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600"
                  >
                    追加
                  </button>
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Items Table */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ステータス</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">製品名</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">保管場所</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">QRコード</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">削除</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div 
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: statusColors[item.status] || statusColors['Working'] }}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {item.item_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.location}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                        <button
                          onClick={() => setSelectedQRItem(item)}
                          className="flex items-center gap-1 hover:text-blue-800"
                        >
                          <QrCode size={16} />
                          QR表示
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleViewMessages(item)}
                            className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                          >
                            <MessageSquare size={16} />
                            メッセージ
                          </button>
                          {hasNewMessages(item.item_id, item.latest_message_time) && (
                            <div className="flex items-center gap-1">
                              <Bell size={12} className="text-red-500" />
                              <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">NEW!</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => setItemToDelete(item)}
                          className="text-red-600 hover:text-red-900 flex items-center gap-1"
                        >
                          <Trash2 size={16} />
                          削除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* QR Code Modal */}
        {selectedQRItem && (
          <QRCodeModal 
            item={selectedQRItem} 
            onClose={() => setSelectedQRItem(null)} 
          />
        )}

        {/* Delete Confirmation Modal */}
        {itemToDelete && (
          <DeleteConfirmModal
            item={itemToDelete}
            onConfirm={() => deleteItem(itemToDelete.item_id)}
            onCancel={() => setItemToDelete(null)}
          />
        )}
      </div>
    );
  };

  // Message Board Component
  const MessageBoard = () => {
    const [newMessage, setNewMessage] = useState('');
    const [userName, setUserName] = useState('');
    const [showHelp, setShowHelp] = useState(false);

    const handleSendMessage = async () => {
      if (newMessage.trim()) {
        await addMessage(selectedItem.item_id, newMessage.trim(), userName.trim() || '匿名');
        setNewMessage('');
        setUserName('');
      }
    };

    const handleQuickButton = async (color) => {
      const message = quickButtons[color];
      await addMessage(selectedItem.item_id, message, isAdmin ? '管理者' : '匿名', color);
    };

    return (
      <div className="min-h-screen bg-gray-100">
        <div className="bg-white shadow-sm">
          <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold">{selectedItem?.name}</h1>
              <p className="text-sm text-gray-600">ID: {selectedItem?.item_id}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowHelp(true)}
                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                title="使い方を見る"
              >
                <HelpCircle size={24} />
              </button>
              <button
                onClick={() => setCurrentPage(isAdmin ? 'dashboard' : 'mobile')}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              >
                戻る
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto p-4">
          {/* Quick Action Buttons */}
          <div className="bg-white p-4 rounded-lg shadow-md mb-4">
            <h3 className="text-lg font-bold mb-3">クイックアクション</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <button
                onClick={() => handleQuickButton('blue')}
                className="px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
              >
                {quickButtons.blue}
              </button>
              <button
                onClick={() => handleQuickButton('green')}
                className="px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm"
              >
                {quickButtons.green}
              </button>
              <button
                onClick={() => handleQuickButton('yellow')}
                className="px-4 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 text-sm"
              >
                {quickButtons.yellow}
              </button>
              <button
                onClick={() => handleQuickButton('red')}
                className="px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm"
              >
                {quickButtons.red}
              </button>
            </div>
          </div>

          {/* Message Form */}
          <div className="bg-white p-4 rounded-lg shadow-md mb-4">
            <div>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">ユーザー名</label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="匿名"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">メッセージ</label>
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg h-20"
                />
              </div>
              <button
                onClick={handleSendMessage}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
              >
                送信
              </button>
            </div>
          </div>

          {/* Messages List */}
          <div className="bg-white rounded-lg shadow-md">
            <div className="p-4 border-b">
              <h3 className="text-lg font-bold">メッセージ履歴</h3>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {messages.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  メッセージがありません
                </div>
              ) : (
                messages.map((message) => (
                  <div key={message.id} className="p-4 border-b last:border-b-0">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium text-sm">{message.user_name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">
                          {new Date(message.created_at).toLocaleString('ja-JP')}
                        </span>
                        {(isAdmin || message.user_name === '匿名') && (
                          <button
                            onClick={() => setMessageToDelete(message)}
                            className="text-red-500 hover:text-red-700 p-1"
                            title="メッセージを削除"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-gray-800">{message.message}</p>
                    {message.msg_type !== 'general' && (
                      <div className="mt-2">
                        <span className={`inline-block px-2 py-1 rounded text-xs text-white ${
                          message.msg_type === 'blue' ? 'bg-blue-500' :
                          message.msg_type === 'green' ? 'bg-green-500' :
                          message.msg_type === 'yellow' ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}>
                          ステータス更新
                        </span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Help Modal */}
        {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

        {/* Message Delete Confirmation Modal */}
        {messageToDelete && (
          <MessageDeleteConfirmModal
            message={messageToDelete}
            onConfirm={() => deleteMessage(messageToDelete.id)}
            onCancel={() => setMessageToDelete(null)}
          />
        )}
      </div>
    );
  };

  // Mobile Access Component
  const MobileAccess = () => {
    const [itemId, setItemId] = useState('');

    const handleItemIdSubmit = async () => {
      if (itemId.trim()) {
        try {
          const { data, error } = await supabase
            .from('items')
            .select('*')
            .eq('item_id', itemId.trim())
            .single();
          
          if (error) throw error;
          if (data) {
            setSelectedItem(data);
            loadMessages(data.item_id);
            setCurrentPage('messageboard');
          }
        } catch (error) {
          alert('製品IDが見つかりません');
        }
      }
    };

    return (
      <div className="min-h-screen bg-gray-100 p-4">
        <div className="max-w-md mx-auto">
          <div className="bg-white p-6 rounded-lg shadow-md text-center">
            <QrCode size={64} className="mx-auto mb-4 text-blue-500" />
            <h1 className="text-xl font-bold mb-4">製品アクセス</h1>
            <div>
              <input
                type="text"
                value={itemId}
                onChange={(e) => setItemId(e.target.value)}
                placeholder="製品IDを入力 (例: 20250101-01)"
                className="w-full px-3 py-2 border rounded-lg mb-4"
              />
              <button
                onClick={handleItemIdSubmit}
                className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600"
              >
                アクセス
              </button>
            </div>
            <div className="mt-4">
              <button
                onClick={() => setCurrentPage('login')}
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                管理者ログイン
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render appropriate page
  return (
    <>
      <Head>
        <title>DigitalMemoTag - Factory Management System</title>
        <meta name="description" content="Factory product tracking and messaging system" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      {currentPage === 'login' && <LoginPage />}
      {currentPage === 'dashboard' && <Dashboard />}
      {currentPage === 'messageboard' && <MessageBoard />}
      {currentPage === 'mobile' && <MobileAccess />}
      {!currentPage && <MobileAccess />}
    </>
  );
}