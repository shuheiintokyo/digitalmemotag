import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { getItems, createItem, deleteItem, Item } from '../lib/api';
import QRCode from 'qrcode';

const AdminDashboard: React.FC = () => {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [qrCodes, setQrCodes] = useState<{ [key: string]: string }>({});
  const [selectedQRItem, setSelectedQRItem] = useState<Item | null>(null);
  const [itemToDelete, setItemToDelete] = useState<Item | null>(null);

  // Form state
  const [newItemName, setNewItemName] = useState('');
  const [newItemLocation, setNewItemLocation] = useState('');
  const [newItemUserEmail, setNewItemUserEmail] = useState('');  // ✅ NEW

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
        user_email: newItemUserEmail.trim() || undefined  // ✅ NEW
      });
      
      setNewItemName('');
      setNewItemLocation('');
      setNewItemUserEmail('');  // ✅ NEW
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              {/* ✅ NEW EMAIL FIELD */}
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">保管場所</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">担当者</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ステータス</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">QRコード</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      製品がありません。新しい製品を追加してください。
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {item.item_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.location}
                      </td>
                      {/* ✅ NEW EMAIL COLUMN */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.user_email ? (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                            📧 {item.user_email}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">未設定</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          item.status === 'Working' ? 'bg-blue-100 text-blue-800' :
                          item.status === 'Completed' ? 'bg-green-100 text-green-800' :
                          item.status === 'Delayed' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => setSelectedQRItem(item)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          QR表示
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button
                          onClick={() => handleViewMessages(item)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          メッセージ
                        </button>
                        <button
                          onClick={() => setItemToDelete(item)}
                          className="text-red-600 hover:text-red-900"
                        >
                          削除
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* QR Code Modal */}
      {selectedQRItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full">
            <div className="text-center">
              <h3 className="text-lg font-bold mb-4">{selectedQRItem.name}</h3>
              <p className="text-sm text-gray-600 mb-4">ID: {selectedQRItem.item_id}</p>
              {qrCodes[selectedQRItem.item_id] && (
                <div className="mb-4">
                  <img 
                    src={qrCodes[selectedQRItem.item_id]} 
                    alt="QR Code" 
                    className="mx-auto border rounded" 
                  />
                </div>
              )}
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => downloadQRCode(selectedQRItem.item_id, selectedQRItem.name)}
                  className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600"
                >
                  ダウンロード
                </button>
                <button
                  onClick={() => setSelectedQRItem(null)}
                  className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full">
            <div className="text-center">
              <h3 className="text-lg font-bold mb-4">削除確認</h3>
              <p className="text-sm text-gray-600 mb-2">以下の製品を削除してもよろしいですか？</p>
              <p className="text-sm font-medium mb-4">
                {itemToDelete.name} (ID: {itemToDelete.item_id})
              </p>
              <p className="text-xs text-red-600 mb-6">
                ※ この操作は取り消せません
              </p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={handleDeleteItem}
                  className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
                >
                  削除する
                </button>
                <button
                  onClick={() => setItemToDelete(null)}
                  className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;