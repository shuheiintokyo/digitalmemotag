import React, { useState, useEffect } from 'react';
import { getItem, getMessages, createMessage, Message, Item } from '../lib/api';

interface MemoBoardProps {
  itemId: string;
  isDirectAccess?: boolean;
}

const MESSAGE_TYPE_EMOJIS = {
  'general': '💬',
  'issue': '⚠️',
  'fixed': '✅', 
  'question': '❓',
  'status_update': '🔄'
};

const MESSAGE_TYPE_COLORS = {
  'issue': 'bg-yellow-50 border-yellow-200',
  'question': 'bg-blue-50 border-blue-200',
  'fixed': 'bg-green-50 border-green-200',
  'status_update': 'bg-gray-50 border-gray-200',
  'general': 'bg-gray-50 border-gray-200'
};

const MemoBoard: React.FC<MemoBoardProps> = ({ itemId, isDirectAccess = false }) => {
  const [item, setItem] = useState<Item | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [postLoading, setPostLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [userName, setUserName] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('general');
  const [sendNotification, setSendNotification] = useState(false);  // ✅ NEW

  useEffect(() => {
    fetchData();
  }, [itemId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [itemData, messagesData] = await Promise.all([
        getItem(itemId),
        getMessages(itemId)
      ]);
      setItem(itemData);
      setMessages(messagesData);
      setError(null);
    } catch (err) {
      setError('アイテムまたはメッセージの取得に失敗しました');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setPostLoading(true);
    try {
      await createMessage({
        item_id: itemId,
        message: message.trim(),
        user_name: userName.trim() || '匿名',
        msg_type: messageType,
        send_notification: sendNotification  // ✅ NEW
      });
      
      setMessage('');
      setUserName('');
      setSendNotification(false);  // ✅ RESET
      await fetchData();
    } catch (err) {
      setError('メッセージの投稿に失敗しました');
      console.error('Error posting message:', err);
    } finally {
      setPostLoading(false);
    }
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

  if (error && !item) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full text-center">
          <div className="text-red-500 text-xl mb-4">❌</div>
          <h2 className="text-lg font-semibold mb-2">エラー</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={fetchData}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            再試行
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-md mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-gray-900">🏷️ {item?.name}</h1>
          <p className="text-gray-600 mt-1">📍 {item?.location}</p>
          {isDirectAccess && (
            <div className="mt-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                QRアクセス
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-6">
        {/* Message Form */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h2 className="text-lg font-semibold mb-4">💬 新しいメッセージ</h2>
          
          <form onSubmit={handleSubmitMessage} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                お名前（任意）
              </label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="匿名"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                種類
              </label>
              <select
                value={messageType}
                onChange={(e) => setMessageType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="general">一般</option>
                <option value="issue">問題</option>
                <option value="question">質問</option>
                <option value="fixed">修理済み</option>
                <option value="status_update">ステータス更新</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                メッセージ
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="メッセージ、指示、質問、更新情報をここに書いてください..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
            </div>

            {/* ✅ NEW CHECKBOX */}
            <div className="flex items-center bg-blue-50 p-3 rounded-lg border border-blue-200">
              <input
                type="checkbox"
                id="sendNotification"
                checked={sendNotification}
                onChange={(e) => setSendNotification(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="sendNotification" className="ml-2 text-sm font-medium text-gray-700">
                📧 管理者にメール通知を送信する
              </label>
            </div>

            <button
              type="submit"
              disabled={!message.trim() || postLoading}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {postLoading ? (
                <span className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  投稿中...
                </span>
              ) : (
                '📮 メッセージ投稿'
              )}
            </button>
          </form>
        </div>

        {/* Messages List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">📊 {messages.length} 件のメッセージ</h2>
          
          {messages.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-6 text-center">
              <div className="text-gray-400 text-4xl mb-2">📭</div>
              <p className="text-gray-600">まだメッセージがありません</p>
              <p className="text-gray-500 text-sm">最初の投稿者になりましょう！</p>
            </div>
          ) : (
            messages.map((msg, index) => {
              const emoji = MESSAGE_TYPE_EMOJIS[msg.msg_type as keyof typeof MESSAGE_TYPE_EMOJIS] || '💬';
              const colorClass = MESSAGE_TYPE_COLORS[msg.msg_type as keyof typeof MESSAGE_TYPE_COLORS] || 'bg-gray-50 border-gray-200';
              
              return (
                <div key={index} className={`bg-white rounded-lg shadow-sm border p-4 ${colorClass}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{emoji}</span>
                      <span className="font-medium text-gray-900">{msg.user_name}</span>
                    </div>
                    <span className="text-xs text-gray-500">{msg.formatted_time}</span>
                  </div>
                  <p className="text-gray-700 leading-relaxed">{msg.message}</p>
                </div>
              );
            })
          )}
        </div>

        {/* Refresh Button */}
        <button
          onClick={fetchData}
          className="w-full bg-gray-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-gray-700"
        >
          🔄 最新メッセージを取得
        </button>
      </div>
    </div>
  );
};

export default MemoBoard;