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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

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
      setMessages([...messagesData].reverse());
      setError(null);
    } catch (err) {
      setError('アイテムまたはメッセージの取得に失敗しました');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitMessage = async (e: React.FormEvent, shouldNotify: boolean = false) => {
    e.preventDefault();
    if (!message.trim()) return;

    setPostLoading(true);
    try {
      console.log('📤 Sending message with notification:', shouldNotify);
      
      await createMessage({
        item_id: itemId,
        message: message.trim(),
        user_name: userName.trim() || '匿名',
        msg_type: 'general',
        send_notification: shouldNotify
      });
      
      setMessage('');
      setShowOptions(false);
      await fetchData();
      
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      
      if (shouldNotify) {
        console.log('✅ Message sent with email notification');
      }
    } catch (err) {
      setError('メッセージの投稿に失敗しました');
      console.error('Error posting message:', err);
    } finally {
      setPostLoading(false);
    }
  };

  // Add this to your MemoBoard.tsx - just the handleProgressUpdate function

const handleProgressUpdate = async (newProgress: number) => {
  console.group('🔄 MemoBoard: handleProgressUpdate');
  console.log('Item ID:', itemId);
  console.log('New Progress:', newProgress);
  console.log('Current Item:', item);
  console.log('API Base URL:', process.env.NEXT_PUBLIC_API_URL || 'https://api.memotag.digital');
  
  try {
    console.log('📤 Calling updateItemProgress API...');
    const result = await updateItemProgress(itemId, newProgress);
    console.log('✅ API Response:', result);
    
    if (item) {
      const updatedItem = { ...item, progress: newProgress };
      console.log('🔄 Updating local state:', updatedItem);
      setItem(updatedItem);
    }
    
    console.log('✅ Progress updated successfully in MemoBoard');
  } catch (err: any) {
    console.error('❌ Failed to update progress in MemoBoard');
    console.error('Error object:', err);
    
    if (err.response) {
      console.error('Response data:', err.response.data);
      console.error('Response status:', err.response.status);
      console.error('Response headers:', err.response.headers);
    } else if (err.request) {
      console.error('No response received:', err.request);
    } else {
      console.error('Request setup error:', err.message);
    }
    
    setError('進捗の更新に失敗しました');
  } finally {
    console.groupEnd();
  }
};

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitMessage(e, false);
    }
  };

  const isAdminMessage = (msg: Message): boolean => {
    const adminNames = ['管理者', 'admin', 'Admin', 'Administrator'];
    return adminNames.indexOf(msg.user_name) !== -1;
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
    <div className="flex flex-col h-screen bg-gray-100 overflow-hidden">
      <div className="bg-white shadow-sm flex-shrink-0">
        <div className="max-w-2xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">🏷️ {item?.name}</h1>
              <p className="text-xs sm:text-sm text-gray-600 truncate">📍 {item?.location}</p>
            </div>
            {isAdmin && (
              <span className="bg-purple-100 text-purple-800 text-xs font-medium px-2 py-0.5 rounded ml-2 flex-shrink-0">
                管理者
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-3 sm:px-4 py-3 sm:py-4 space-y-4 sm:space-y-6">
          {item && item.total_pieces && item.total_pieces > 0 && (
            <ProgressSlider
              itemId={item.item_id}
              totalPieces={item.total_pieces}
              currentProgress={item.progress || 0}
              targetDate={item.target_date}
              onProgressUpdate={handleProgressUpdate}
            />
          )}

          <div className="space-y-3 pb-4">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h2 className="text-xs sm:text-sm font-medium text-gray-600">💬 {messages.length} 件のメッセージ</h2>
              <button
                onClick={fetchData}
                className="text-xs sm:text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                🔄 更新
              </button>
            </div>
            
            {messages.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-6 sm:p-8 text-center">
                <div className="text-gray-400 text-3xl sm:text-4xl mb-2">📭</div>
                <p className="text-sm sm:text-base text-gray-600">まだメッセージがありません</p>
                <p className="text-xs sm:text-sm text-gray-500">最初の投稿者になりましょう！</p>
              </div>
            ) : (
              messages.map((msg, index) => {
                const isFromAdmin = isAdminMessage(msg);
                
                return (
                  <div 
                    key={index} 
                    className={`flex ${isFromAdmin ? 'justify-start' : 'justify-end'}`}
                  >
                    <div className={`max-w-[85%] sm:max-w-[80%] ${isFromAdmin ? 'mr-auto' : 'ml-auto'}`}>
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

      <div className="bg-white border-t border-gray-200 shadow-lg flex-shrink-0 safe-bottom">
        <div className="max-w-2xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          {showOptions && !isAdmin && (
            <div className="mb-3 animate-slideDown">
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="お名前（任意）"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}

          <div className="flex items-end gap-2">
            {!isAdmin && (
              <button
                type="button"
                onClick={() => setShowOptions(!showOptions)}
                className="flex-shrink-0 w-9 h-9 sm:w-8 sm:h-8 rounded-full bg-gray-100 hover:bg-gray-200 active:bg-gray-300 flex items-center justify-center text-gray-600 transition-colors touch-manipulation"
                title="名前を入力"
              >
                {showOptions ? '✕' : '👤'}
              </button>
            )}

            <textarea
              ref={textareaRef}
              value={message}
              onChange={handleTextareaChange}
              onKeyPress={handleKeyPress}
              placeholder="メッセージを入力..."
              rows={1}
              className="flex-1 px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-full resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 max-h-32 overflow-y-auto"
              style={{ minHeight: '40px' }}
            />

            <button
              type="button"
              onClick={(e) => handleSubmitMessage(e, false)}
              disabled={!message.trim() || postLoading}
              className="flex-shrink-0 w-10 h-10 sm:w-10 sm:h-10 rounded-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors touch-manipulation"
              title="送信"
            >
              {postLoading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <span className="text-lg">➤</span>
              )}
            </button>

            {((isAdmin && item?.user_email) || !isAdmin) && (
              <button
                type="button"
                onClick={(e) => handleSubmitMessage(e, true)}
                disabled={!message.trim() || postLoading}
                className="flex-shrink-0 w-10 h-10 sm:w-10 sm:h-10 rounded-full bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors touch-manipulation"
                title={isAdmin ? "送信 + 担当者に通知" : "送信 + 管理者に通知"}
              >
                {postLoading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <span className="text-lg">📧</span>
                )}
              </button>
            )}
          </div>

          <div className="mt-2 text-xs text-gray-500 text-center hidden sm:block">
            <span className="inline-flex items-center gap-3">
              <span>➤ 投稿のみ</span>
              {((isAdmin && item?.user_email) || !isAdmin) && (
                <span>📧 投稿+メール自動通知</span>
              )}
              <span>• Enterで送信</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MemoBoard;