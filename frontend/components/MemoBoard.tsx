import React, { useState, useEffect } from 'react';
import { getItem, getMessages, createMessage, Message, Item } from '../lib/api';
import ProgressSlider from './ProgressSlider';

interface MemoBoardProps {
  itemId: string;
  isDirectAccess?: boolean;
}

const MESSAGE_TYPE_EMOJIS: Record<string, string> = {
  'general': '💬',
  'issue': '⚠️',
  'fixed': '✅', 
  'question': '❓',
  'status_update': '🔄'
};

const MESSAGE_TYPE_COLORS: Record<string, string> = {
  'issue': 'border-yellow-400 bg-yellow-50',
  'question': 'border-blue-400 bg-blue-50',
  'fixed': 'border-green-400 bg-green-50',
  'status_update': 'border-gray-400 bg-gray-50',
  'general': 'border-gray-300 bg-white'
};

const MemoBoard: React.FC<MemoBoardProps> = ({ itemId, isDirectAccess = false }) => {
  const [item, setItem] = useState<Item | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [postLoading, setPostLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [userName, setUserName] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('general');
  const [sendNotification, setSendNotification] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const authToken = localStorage.getItem('authToken');
    setIsAdmin(!!authToken);
    
    if (authToken) {
      setUserName('管理者');
    }
    
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
        send_notification: sendNotification
      });
      
      setMessage('');
      if (!isAdmin) {
        setUserName('');
      }
      setSendNotification(false);
      await fetchData();
    } catch (err) {
      setError('メッセージの投稿に失敗しました');
      console.error('Error posting message:', err);
    } finally {
      setPostLoading(false);
    }
  };

  const handleProgressUpdate = async (newProgress: number) => {
    if (item) {
      setItem({ ...item, progress: newProgress });
      await fetchData();
    }
  };

  const isAdminMessage = (msg: Message): boolean => {
    return ['管理者', 'admin', 'Admin', 'Administrator'].includes(msg.user_name);
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
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">🏷️ {item?.name}</h1>
              <p className="text-sm text-gray-600">📍 {item?.location}</p>
            </div>
            {isAdmin && (
              <span className="bg-purple-100 text-purple-800 text-xs font-medium px-2.5 py-0.5 rounded">
                管理者
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {/* Progress Slider - Only show if item has total_pieces */}
        {item && item.total_pieces && item.total_pieces > 0 && (
          <div className="bg-white rounded-lg shadow-md p-4">
            <ProgressSlider
              itemId={item.item_id}
              totalPieces={item.total_pieces}
              currentProgress={item.progress || 0}
              onProgressUpdate={handleProgressUpdate}
            />
          </div>
        )}

        {/* Messages Section */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-gray-600 mb-4">💬 {messages.length} 件のメッセージ</h2>
          
          {messages.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <div className="text-gray-400 text-4xl mb-2">📭</div>
              <p className="text-gray-600">まだメッセージがありません</p>
              <p className="text-gray-500 text-sm">最初の投稿者になりましょう！</p>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isFromAdmin = isAdminMessage(msg);
              const emoji = MESSAGE_TYPE_EMOJIS[msg.msg_type] || '💬';
              const colorClass = MESSAGE_TYPE_COLORS[msg.msg_type] || 'border-gray-300 bg-white';
              
              return (
                <div 
                  key={index} 
                  className={`flex ${isFromAdmin ? 'justify-start' : 'justify-end'}`}
                >
                  <div className={`max-w-[80%] ${isFromAdmin ? 'mr-auto' : 'ml-auto'}`}>
                    <div className={`flex items-center gap-2 mb-1 ${isFromAdmin ? '' : 'flex-row-reverse'}`}>
                      <span className={`text-xs font-medium ${isFromAdmin ? 'text-purple-700' : 'text-blue-700'}`}>
                        {isFromAdmin ? '👔' : '👤'} {msg.user_name}
                      </span>
                      <span className="text-xs text-gray-400">{msg.formatted_time}</span>
                    </div>
                    
                    <div className={`
                      rounded-2xl p-3 shadow-sm border-2
                      ${isFromAdmin 
                        ? `${colorClass} rounded-tl-none` 
                        : 'bg-blue-500 text-white border-blue-500 rounded-tr-none'
                      }
                    `}>
                      <div className="flex items-start gap-2">
                        <span className="text-lg flex-shrink-0">{emoji}</span>
                        <p className={`text-sm leading-relaxed break-words ${isFromAdmin ? 'text-gray-800' : 'text-white'}`}>
                          {msg.message}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* New Message Form */}
        <div className="bg-white rounded-lg shadow-md p-4 sticky bottom-4">
          <h2 className="text-lg font-semibold mb-4">✍️ 新しいメッセージ</h2>
          
          <form onSubmit={handleSubmitMessage} className="space-y-3">
            {!isAdmin && (
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
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                種類
              </label>
              <select
                value={messageType}
                onChange={(e) => setMessageType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="general">💬 一般</option>
                <option value="issue">⚠️ 問題</option>
                <option value="question">❓ 質問</option>
                <option value="fixed">✅ 修理済み</option>
                <option value="status_update">🔄 ステータス更新</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                メッセージ
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="メッセージを入力..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
            </div>

            {((isAdmin && item?.user_email) || !isAdmin) && (
              <div className={`flex items-center p-3 rounded-lg border-2 ${
                isAdmin ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'
              }`}>
                <input
                  type="checkbox"
                  id="sendNotification"
                  checked={sendNotification}
                  onChange={(e) => setSendNotification(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="sendNotification" className="ml-2 text-sm font-medium text-gray-700">
                  {isAdmin 
                    ? `📧 担当者にメール通知 (${item?.user_email})`
                    : '📧 管理者にメール通知を送信する'
                  }
                </label>
              </div>
            )}

            {isAdmin && !item?.user_email && (
              <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-3">
                <p className="text-xs text-yellow-800">
                  ⚠️ この製品には担当者メールアドレスが登録されていません
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={!message.trim() || postLoading}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {postLoading ? (
                <span className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  送信中...
                </span>
              ) : (
                '📮 送信'
              )}
            </button>
          </form>
        </div>

        {/* Refresh Button */}
        <button
          onClick={fetchData}
          className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors"
        >
          🔄 最新メッセージを取得
        </button>
      </div>
    </div>
  );
};

export default MemoBoard;