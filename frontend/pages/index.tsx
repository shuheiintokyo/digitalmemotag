import React from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

const HomePage: React.FC = () => {
  const router = useRouter();

  return (
    <>
      <Head>
        <title>デジタルメモタグシステム</title>
      </Head>
      
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-4xl mx-auto px-4 py-12">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-4">
              📱 デジタルメモタグシステム
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 mb-8">
              QRコードで簡単アクセス・リアルタイム情報共有
            </p>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="text-3xl mb-4">📱</div>
              <h3 className="text-xl font-semibold mb-2">モバイル最適化</h3>
              <p className="text-gray-600">
                スマートフォンでQRコードをスキャンして、どこからでも簡単にメッセージを投稿・確認できます。
              </p>
            </div>
            
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="text-3xl mb-4">🖥️</div>
              <h3 className="text-xl font-semibold mb-2">デスクトップ管理</h3>
              <p className="text-gray-600">
                管理者はデスクトップで全体の状況を把握し、効率的にアイテムとメッセージを管理できます。
              </p>
            </div>
            
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="text-3xl mb-4">🔄</div>
              <h3 className="text-xl font-semibold mb-2">リアルタイム更新</h3>
              <p className="text-gray-600">
                メッセージやステータスの更新がリアルタイムで反映され、常に最新の情報を共有できます。
              </p>
            </div>
            
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="text-3xl mb-4">☁️</div>
              <h3 className="text-xl font-semibold mb-2">クラウド保存</h3>
              <p className="text-gray-600">
                すべてのデータはクラウドに安全に保存され、どのデバイスからでもアクセス可能です。
              </p>
            </div>
          </div>

          {/* Admin Login Button - Centered */}
          <div className="flex justify-center mb-12">
            <button
              onClick={() => router.push('/login')}
              className="bg-blue-600 text-white px-12 py-4 rounded-lg text-xl font-semibold hover:bg-blue-700 transition-colors shadow-lg"
            >
              🔐 管理者ログイン
            </button>
          </div>

          {/* How It Works */}
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-3xl font-bold text-center mb-8">使い方</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-4xl mb-4">1️⃣</div>
                <h4 className="text-lg font-semibold mb-2">機器にQRコード貼付</h4>
                <p className="text-gray-600">管理者がアイテムを登録してQRコードを生成・印刷</p>
              </div>
              
              <div className="text-center">
                <div className="text-4xl mb-4">2️⃣</div>
                <h4 className="text-lg font-semibold mb-2">QRコードスキャン</h4>
                <p className="text-gray-600">スマートフォンでQRコードを読み取ってアクセス</p>
              </div>
              
              <div className="text-center">
                <div className="text-4xl mb-4">3️⃣</div>
                <h4 className="text-lg font-semibold mb-2">メッセージ投稿</h4>
                <p className="text-gray-600">状況報告、問題報告、質問などを簡単投稿</p>
              </div>
              
              <div className="text-center">
                <div className="text-4xl mb-4">4️⃣</div>
                <h4 className="text-lg font-semibold mb-2">リアルタイム共有</h4>
                <p className="text-gray-600">管理者と現場で情報をリアルタイム共有</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-16 pt-8 border-t border-gray-200">
            <p className="text-gray-500">
              © 2025 デジタルメモタグシステム - FastAPI + Next.js + Appwrite
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default HomePage;