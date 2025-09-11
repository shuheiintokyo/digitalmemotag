import React, { useState, useEffect } from 'react';
import { getItems, getMessages, createItem, updateItemStatus, deleteItem, Item, Message, ItemCreate } from '../lib/api';

const STATUS_TRANSLATIONS = {
  "Working": "社内対応",
  "Needs Maintenance": "社外対応", 
  "Out of Order": "保留中"
};

const MESSAGE_TYPE_TRANSLATIONS = {
  "general": "一般",
  "issue": "問題",
  "fixed": "修理済み", 
  "question": "質問",
  "status_update": "ステータス更新"
};

const MESSAGE_TYPE_EMOJIS = {
  'general': '💬',
  'issue': '⚠️',
  'fixed': '✅',
  'question': '❓', 
  'status_update': '🔄'
};

const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'items' | 'messages' | 'qr'>('overview');
  const [items, setItems] = useState<Item[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [newItem, setNewItem] = useState<ItemCreate>({
    item_id: '',
    name: '',
    location: '',
    status: 'Working'
  });
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  // WebSocket connection for real-time admin updates
  const { isConnected, connectionStatus } = useWebSocket({
    url: '/ws/admin',
    onMessage: (message) => {
      if (message.type === 'new_message') {
        // Add new message to the list
        setMessages(prev => [message.data, ...prev]);
      } else if (message.type === 'status_update') {
        // Update item status in the list
        setItems(prev => prev.map(item => 
          item.item_id === message.data.item_id 
            ? { ...item, status: message.data.status }
            : item
        ));
      }
    },
    onConnect: () => {
      console.log('Admin connected to WebSocket');
    },
    onDisconnect: () => {
      console.log('Admin disconnected from WebSocket');
    }
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [itemsData, messagesData] = await Promise.all([
        getItems(),
        getMessages()
      ]);
      setItems(itemsData);
      setMessages(messagesData);
      setError(null);
    } catch (err) {
      setError('データの取得に失敗しました');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.item_id.trim() || !newItem.name.trim() || !newItem.location.trim()) return;

    try {
      await createItem(newItem);
      setNewItem({ item_id: '', name: '', location: '', status: 'Working' });
      setShowAddForm(false);
      await fetchData();
    } catch (err) {
      setError('アイテムの追加に失敗しました');
      console.error('Error creating item:', err);
    }
  };

  const handleUpdateStatus = async (itemId: string, status: string) => {
    try {
      await updateItemStatus(itemId, status);
      await fetchData();
    } catch (err) {
      setError('ステータスの更新に失敗しました');
      console.error('Error updating status:', err);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('このアイテムとすべてのメッセージを削除しますか？')) return;

    try {
      await deleteItem(itemId);
      await fetchData();
    } catch (err) {
      setError('アイテムの削除に失敗しました');
      console.error('Error deleting item:', err);
    }
  };

  const getQRCodeURL = (itemId: string) => {
    return `${window.location.origin}/memo/${itemId}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <h1 className="text-3xl font-bold text-gray-900">管理ダッシュボード</h1>
            <button
              onClick={() => {
                localStorage.removeItem('authToken');
                window.location.href = '/login';
              }}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
            >
              ログアウト
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {[
              { key: 'overview', label: '📊 概要', icon: '🏠' },
              { key: 'items', label: '📦 アイテム管理', icon: '📦' },
              { key: 'messages', label: '💬 メッセージ', icon: '💬' },
              { key: 'qr', label: '🏷️ QRコード', icon: '🏷️' }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
            {error}
            <button onClick={() => setError(null)} className="float-right font-bold">×</button>
          </div>
        )}

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-500">総アイテム数</h3>
                <p className="text-3xl font-bold text-blue-600">{items.length}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-500">総メッセージ数</h3>
                <p className="text-3xl font-bold text-green-600">{messages.length}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-500">問題報告</h3>
                <p className="text-3xl font-bold text-red-600">
                  {messages.filter(m => m.msg_type === 'issue').length}
                </p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-500">修理済み</h3>
                <p className="text-3xl font-bold text-green-600">
                  {messages.filter(m => m.msg_type === 'fixed').length}
                </p>
              </div>
            </div>

            {/* Recent Messages */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b">
                <h2 className="text-lg font-semibold">最近のメッセージ</h2>
              </div>
              <div className="p-6">
                {messages.slice(0, 10).map((msg, index) => {
                  const item = items.find(i => i.item_id === msg.item_id);
                  const emoji = MESSAGE_TYPE_EMOJIS[msg.msg_type as keyof typeof MESSAGE_TYPE_EMOJIS] || '💬';
                  
                  return (
                    <div key={index} className="flex items-start space-x-3 py-3 border-b last:border-b-0">
                      <span className="text-lg">{emoji}</span>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{msg.user_name}</span>
                          <span className="text-gray-500">→</span>
                          <span className="text-gray-700">{item?.name || '不明'}</span>
                          <span className="text-sm text-gray-400">{msg.formatted_time}</span>
                        </div>
                        <p className="text-gray-600 mt-1">{msg.message}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Items Tab */}
        {activeTab === 'items' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">アイテム管理</h2>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                ➕ 新しいアイテム
              </button>
            </div>

            {/* Add Item Form */}
            {showAddForm && (
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-4">新しいアイテムを追加</h3>
                <form onSubmit={handleCreateItem} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      アイテムID
                    </label>
                    <input
                      type="text"
                      value={newItem.item_id}
                      onChange={(e) => setNewItem({...newItem, item_id: e.target.value})}
                      placeholder="例: machine_001"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      アイテム名
                    </label>
                    <input
                      type="text"
                      value={newItem.name}
                      onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                      placeholder="例: 樹脂カバーA"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      場所
                    </label>
                    <input
                      type="text"
                      value={newItem.location}
                      onChange={(e) => setNewItem({...newItem, location: e.target.value})}
                      placeholder="例: 工場2階"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ステータス
                    </label>
                    <select
                      value={newItem.status}
                      onChange={(e) => setNewItem({...newItem, status: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="Working">Working</option>
                      <option value="Needs Maintenance">Needs Maintenance</option>
                      <option value="Out of Order">Out of Order</option>
                    </select>
                  </div>
                  <div className="md:col-span-2 flex space-x-3">
                    <button
                      type="submit"
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                    >
                      追加
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                    >
                      キャンセル
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Items List */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      アイテム
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      場所
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ステータス
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      メッセージ数
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {items.map((item) => {
                    const itemMessages = messages.filter(m => m.item_id === item.item_id);
                    const statusEmoji = {
                      "Working": "🟢",
                      "Needs Maintenance": "🟡", 
                      "Out of Order": "🔴"
                    }[item.status] || "⚪";

                    return (
                      <tr key={item.item_id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{item.name}</div>
                            <div className="text-sm text-gray-500">ID: {item.item_id}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.location}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <span className="mr-2">{statusEmoji}</span>
                            <select
                              value={item.status}
                              onChange={(e) => handleUpdateStatus(item.item_id, e.target.value)}
                              className="text-sm border-gray-300 rounded"
                            >
                              <option value="Working">Working</option>
                              <option value="Needs Maintenance">Needs Maintenance</option>
                              <option value="Out of Order">Out of Order</option>
                            </select>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {itemMessages.length}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => window.open(`/memo/${item.item_id}`, '_blank')}
                            className="text-blue-600 hover:text-blue-900 mr-3"
                          >
                            表示
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.item_id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            削除
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Messages Tab */}
        {activeTab === 'messages' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">全メッセージ</h2>
            
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">最新メッセージ</h3>
                  <button
                    onClick={fetchData}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                  >
                    🔄 更新
                  </button>
                </div>
              </div>
              
              <div className="divide-y divide-gray-200">
                {messages.map((msg, index) => {
                  const item = items.find(i => i.item_id === msg.item_id);
                  const emoji = MESSAGE_TYPE_EMOJIS[msg.msg_type as keyof typeof MESSAGE_TYPE_EMOJIS] || '💬';
                  const typeLabel = MESSAGE_TYPE_TRANSLATIONS[msg.msg_type as keyof typeof MESSAGE_TYPE_TRANSLATIONS] || msg.msg_type;
                  
                  return (
                    <div key={index} className="p-6 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <span className="text-xl">{emoji}</span>
                          <div>
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="font-medium text-gray-900">{msg.user_name}</span>
                              <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600">
                                {typeLabel}
                              </span>
                              <span className="text-gray-500">→</span>
                              <span className="text-gray-700">{item?.name || '不明なアイテム'}</span>
                            </div>
                            <p className="text-gray-600 leading-relaxed">{msg.message}</p>
                          </div>
                        </div>
                        <span className="text-sm text-gray-400 ml-4">{msg.formatted_time}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* QR Code Tab */}
        {activeTab === 'qr' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">QRコード生成</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map((item) => (
                <div key={item.item_id} className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-semibold mb-2">{item.name}</h3>
                  <p className="text-gray-600 mb-4">📍 {item.location}</p>
                  
                  <div className="space-y-3">
                    <div className="text-sm">
                      <span className="font-medium">URL:</span>
                      <div className="bg-gray-100 p-2 rounded text-xs break-all">
                        {getQRCodeURL(item.item_id)}
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(getQRCodeURL(item.item_id));
                          alert('URLをコピーしました');
                        }}
                        className="flex-1 bg-blue-600 text-white py-2 px-3 rounded text-sm hover:bg-blue-700"
                      >
                        URLコピー
                      </button>
                      <button
                        onClick={() => window.open(getQRCodeURL(item.item_id), '_blank')}
                        className="flex-1 bg-green-600 text-white py-2 px-3 rounded text-sm hover:bg-green-700"
                      >
                        テスト
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;