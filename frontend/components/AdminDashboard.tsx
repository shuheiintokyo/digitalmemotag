import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { getItems, createItem, deleteItem, Item } from '../lib/api';
import QRCode from 'qrcode';
import ProgressSlider from './ProgressSlider';

const AdminDashboard: React.FC = () => {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [qrCodes, setQrCodes] = useState<{ [key: string]: string }>({});
  const [selectedQRItem, setSelectedQRItem] = useState<Item | null>(null);
  const [itemToDelete, setItemToDelete] = useState<Item | null>(null);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  // Form state
  const [newItemName, setNewItemName] = useState('');
  const [newItemLocation, setNewItemLocation] = useState('');
  const [newItemUserEmail, setNewItemUserEmail] = useState('');
  const [newItemTotalPieces, setNewItemTotalPieces] = useState<string>('');
  const [newItemTargetDate, setNewItemTargetDate] = useState('');

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const data = await getItems();
      setItems(data);
      
      // Generate QR codes for all items
      data.forEach(item => {
        generateQRCode(item.item_id);
      });
    } catch (error) {
      console.error('Error fetching items:', error);
      alert('アイテムの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const generateQRCode = async (itemId: string) => {
    try {
      const url = `${window.location.origin}/memo/${itemId}`;
      const qrCodeDataURL = await QRCode.toDataURL(url, {
        width: 256,
        margin: 2,
      });
      setQrCodes(prev => ({ ...prev, [itemId]: qrCodeDataURL }));
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  };

  const downloadQRCode = (itemId: string, itemName: string) => {
    const qrCodeDataURL = qrCodes[itemId];
    if (qrCodeDataURL) {
      const link = document.createElement('a');
      link.download = `QR_${itemId}_${itemName}.png`;
      link.href = qrCodeDataURL;
      link.click();
    }
  };

  const generateItemId = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    
    const todayPrefix = `${year}${month}${day}`;
    const todayItems = items.filter(item => item.item_id.startsWith(todayPrefix));
    const nextSequence = String(todayItems.length + 1).padStart(2, '0');
    
    return `${todayPrefix}-${nextSequence}`;
  };

  const handleAddItem = async () => {
    if (!newItemName.trim()) {
      alert('製品名を入力してください');
      return;
    }

    try {
      const itemId = generateItemId();
      await createItem({
        item_id: itemId,
        name: newItemName.trim(),
        location: newItemLocation.trim() || '',
        status: 'Working',
        user_email: newItemUserEmail.trim() || undefined,
        total_pieces: newItemTotalPieces ? parseInt(newItemTotalPieces) : undefined,
        target_date: newItemTargetDate || undefined,
        progress: 0
      });
      
      setNewItemName('');
      setNewItemLocation('');
      setNewItemUserEmail('');
      setNewItemTotalPieces('');
      setNewItemTargetDate('');
      setShowAddForm(false);
      await fetchItems();
      alert('製品を追加しました');
    } catch (error) {
      console.error('Error adding item:', error);
      alert('製品の追加に失敗しました');
    }
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete) return;

    try {
      await deleteItem(itemToDelete.item_id);
      await fetchItems();
      setItemToDelete(null);
      alert('製品を削除しました');
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('削除に失敗しました');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    router.push('/login');
  };

  const handleViewMessages = (item: Item) => {
    router.push(`/memo/${item.item_id}`);
  };

  const handleProgressUpdate = async (itemId: string, progress: number) => {
    // Update the local state
    setItems(prevItems => 
      prevItems.map(item => 
        item.item_id === itemId 
          ? { ...item, progress } 
          : item
      )
    );
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
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">管理ダッシュボード</h1>
            <p className="text-sm text-gray-600">デジタルメモタグシステム</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
          >
            ログアウト
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Add Item Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
          >
            + 新しい製品タグを作成
          </button>
        </div>

        {/* Add Item Form */}
        {showAddForm && (
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <h3 className="text-lg font-bold mb-4">新製品追加</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">製品名 *</label>
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="製品名を入力"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">保管場所</label>
                <input
                  type="text"
                  value={newItemLocation}
                  onChange={(e) => setNewItemLocation(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="保管場所を入力"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">担当者メールアドレス</label>
                <input
                  type="email"
                  value={newItemUserEmail}
                  onChange={(e) => setNewItemUserEmail(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="example@email.com"
                />
                <p className="text-xs text-gray-500 mt-1">メール通知を受け取る担当者のアドレス</p>
              </div>
              {/* NEW FIELDS */}
              <div>
                <label className="block text-sm font-medium mb-2">総数量（オプション）</label>
                <input
                  type="number"
                  value={newItemTotalPieces}
                  onChange={(e) => setNewItemTotalPieces(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="例: 100"
                  min="1"
                />
                <p className="text-xs text-gray-500 mt-1">進捗管理用の総数量</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">目標完了日（オプション）</label>
                <input
                  type="date"
                  value={newItemTargetDate}
                  onChange={(e) => setNewItemTargetDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  min={new Date().toISOString().split('T')[0]}
                />
                <p className="text-xs text-gray-500 mt-1">プロジェクトの目標完了日</p>
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
        )}

        {/* Items Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">製品名</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">進捗</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">保管場所</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">目標日</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      製品がありません。新しい製品を追加してください。
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <React.Fragment key={item.id}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.item_id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {item.total_pieces ? (
                            <div className="flex items-center">
                              <div className="w-24 bg-gray-200 rounded-full h-2 mr-2">
                                <div 
                                  className="bg-blue-500 h-2 rounded-full" 
                                  style={{ width: `${item.progress || 0}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium">{item.progress || 0}%</span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">未設定</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.location}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.target_date ? new Date(item.target_date).toLocaleDateString('ja-JP') : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          <button
                            onClick={() => setExpandedItem(expandedItem === item.item_id ? null : item.item_id)}
                            className="text-purple-600 hover:text-purple-900"
                          >
                            {expandedItem === item.item_id ? '閉じる' : '詳細'}
                          </button>
                          <button
                            onClick={() => handleViewMessages(item)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            メッセージ
                          </button>
                          <button
                            onClick={() => setSelectedQRItem(item)}
                            className="text-green-600 hover:text-green-900"
                          >
                            QR
                          </button>
                          <button
                            onClick={() => setItemToDelete(item)}
                            className="text-red-600 hover:text-red-900"
                          >
                            削除
                          </button>
                        </td>
                      </tr>
                      {/* Expanded Progress Slider */}
                      {expandedItem === item.item_id && item.total_pieces && (
                        <tr>
                          <td colSpan={6} className="px-6 py-4 bg-gray-50">