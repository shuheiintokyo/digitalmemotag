import React, { useState, useEffect, useRef } from 'react';
import { getItem, getMessages, createMessage, updateItemProgress, Message, Item } from '../lib/api';
import ProgressSlider from './ProgressSlider';

interface MemoBoardProps {
  itemId: string;
  isDirectAccess?: boolean;
}

const MemoBoard: React.FC<MemoBoardProps> = ({ itemId, isDirectAccess = false }) => {
  const [item, setItem] = useState<Item | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [postLoading, setPostLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [userName, setUserName] = useState('');
  const [message, setMessage] = useState('');
  const [sendNotification, setSendNotification] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const authToken = localStorage.getItem('authToken');
    setIsAdmin(!!authToken);
    
    if (authToken) {
      setUserName('管理者');
    }
    
    fetchData();
  }, [itemId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [itemData, messagesData] = await Promise.all([
        getItem(itemId),
        getMessages(itemId)
      ]);
      setItem(itemData);
      // Reverse the messages so newest appear at bottom
      setMessages(messagesData.reverse());
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
        msg_type: 'general',
        send_notification: sendNotification
      });
      
      setMessage('');
      setSendNotification(false);
      setShowOptions(false);
      await fetchData();
      
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (err) {
      setError('メッセージの投稿に失敗しました');
      console.error('Error posting message:', err);
    } finally {
      setPostLoading(false);
    }
  };

  const handleProgressUpdate = async (newProgress: number) => {
    try {
      await updateItemProgress(itemId, newProgress);
      if (item) {
        setItem({ ...item, progress: newProgress });
      }
      console.log('Progress updated successfully:', newProgress);
    } catch (err) {
      console.error('Failed to update progress:', err);
      setError('進捗の更新に失敗しました');
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    // Auto-resize textarea
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitMessage(e);
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
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm">
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

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-4 space-y-6">
          {/* Progress Slider */}
          {item && item.total_pieces && item.total_pieces > 0 && (
            <ProgressSlider
              itemId={item.item_id}
              totalPieces={item.total_pieces}
              currentProgress={item.progress || 0}
              targetDate={item.target_date}
              onProgressUpdate={handleProgressUpdate}
            />
          )}

          {/* Messages Section */}
          <div className="space-y-3 pb-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-gray-600">💬 {messages.length} 件のメッセージ</h2>
              <button
                onClick={fetchData}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                🔄 更新
              </button>
            </div>
            
            {messages.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                <div className="text-gray-400 text-4xl mb-2">📭</div>
                <p className="text-gray-600">まだメッセージがありません</p>
                <p className="text-gray-500 text-sm">最初の投稿者になりましょう！</p>
              </div>
            ) : (
              messages.map((msg, index) => {
                const isFromAdmin = isAdminMessage(msg);
                
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
                        rounded-2xl p-3 shadow-sm
                        ${isFromAdmin 
                          ? 'bg-gray-100 border border-gray-300 rounded-tl-none' 
                          : 'bg-blue-500 text-white rounded-tr-none'
                        }
                      `}>
                        <p className={`text-sm leading-relaxed break-words whitespace-pre-wrap ${isFromAdmin ? 'text-gray-800' : 'text-white'}`}>
                          {msg.message}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Fixed Bottom Input Area - Like Twitter/Line */}
      <div className="bg-white border-t border-gray-200 shadow-lg">
        <div className="max-w-2xl mx-auto p-4">
          {/* Options Panel - Collapsible */}
          {showOptions && (
            <div className="mb-3 space-y-3 animate-slideDown">
              {!isAdmin && (
                <div>
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="お名前（任意）"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              )}

              {((isAdmin && item?.user_email) || !isAdmin) && (
                <label className="flex items-center gap-2 p-3 text-sm text-gray-700 cursor-pointer bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={sendNotification}
                    onChange={(e) => setSendNotification(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm">
                    {isAdmin 
                      ? `📧 担当者にメール通知 (${item?.user_email})`
                      : '📧 管理者にメール通知を送信'
                    }
                  </span>
                </label>
              )}
            </div>
          )}

          {/* Main Input Area */}
          <form onSubmit={handleSubmitMessage} className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => setShowOptions(!showOptions)}
              className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors"
            >
              {showOptions ? '✕' : '+'}
            </button>

            <textarea
              ref={textareaRef}
              value={message}
              onChange={handleTextareaChange}
              onKeyPress={handleKeyPress}
              placeholder="メッセージを入力... (Shift+Enterで改行)"
              rows={1}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-full resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 max-h-32 overflow-y-auto"
              style={{ minHeight: '40px' }}
            />

            <button
              type="submit"
              disabled={!message.trim() || postLoading}
              className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors"
            >
              {postLoading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <span className="text-lg">➤</span>
              )}
            </button>
          </form>

          {/* Helper text */}
          <div className="mt-2 text-xs text-gray-500 text-center">
            Enterで送信 • Shift+Enterで改行
          </div>
        </div>
      </div>
    </div>
  );
};

export default MemoBoard;