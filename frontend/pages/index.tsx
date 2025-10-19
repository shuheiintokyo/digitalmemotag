import React from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

const HomePage: React.FC = () => {
  const router = useRouter();

  return (
    <>
      <Head>
        <title>デジタルメモタグシステム</title>
        <meta name="description" content="QRコードベースのメモタグシステム" />
      </Head>
      
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
        <div className="text-center">
          {/* Logo/Title */}
          <div className="mb-12">
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-4">
              📱
            </h1>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
              デジタルメモタグシステム
            </h2>
            <p className="text-lg text-gray-600">
              QRコードで簡単アクセス
            </p>
          </div>

          {/* Login Button */}
          <button
            onClick={() => router.push('/login')}
            className="bg-blue-600 text-white px-12 py-4 rounded-lg text-xl font-semibold hover:bg-blue-700 transition-colors shadow-lg transform hover:scale-105 transition-transform"
          >
            🔐 管理者ログイン
          </button>
        </div>
      </div>
    </>
  );
};

export default HomePage;