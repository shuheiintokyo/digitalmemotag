import React, { useState, useEffect } from 'react';
import { getItem, getMessages, createMessage, Item, Message } from '../lib/api';

interface MemoBoardProps {
  itemId: string;
  isDirectAccess?: boolean;
}

const SimpleMemoBoard: React.FC<MemoBoardProps> = ({ itemId, isDirectAccess = false }) => {
  const [item, setItem] = useState<Item | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [postLoading, setPostLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [userName, setUserName] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchData();
  }, [itemId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Use API functions instead of direct fetch
      const [itemData, messagesData] = await Promise.all([
        getItem(itemId),
        getMessages(itemId)
      ]);
      
      setItem(itemData);
      setMessages(messagesData);
      setError(null);
    } catch (err) {
      setError('データの取得に失敗しました');
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
      // Use API function instead of direct fetch
      await createMessage({
        item_id: itemId,
        message: message.trim(),
        user_name: userName.trim() || '匿名',
        msg_type: 'general'
      });
      
      setMessage('');
      setUserName('');
      await fetchData(); // Refresh messages
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
            <button
              type="submit"
              disabled={!message.trim() || postLoading}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {postLoading ? '投稿中...' : '📮 メッセージ投稿'}
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
            messages.map((msg, index) => (
              <div key={index} className="bg-white rounded-lg shadow-sm border p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">💬</span>
                    <span className="font-medium text-gray-900">{msg.user_name}</span>
                  </div>
                  <span className="text-xs text-gray-500">{msg.formatted_time}</span>
                </div>
                <p className="text-gray-700 leading-relaxed">{msg.message}</p>
              </div>
            ))
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

export default SimpleMemoBoard;