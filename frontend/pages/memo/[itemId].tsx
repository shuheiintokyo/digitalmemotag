import React from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import MemoBoard from '../../components/MemoBoard';

const MemoPage: React.FC = () => {
  const router = useRouter();
  const { itemId } = router.query;

  // Show loading while router is not ready
  if (!router.isReady || !itemId || typeof itemId !== 'string') {
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
    <>
      <Head>
        <title>メモボード - {itemId}</title>
        <meta name="description" content={`アイテム ${itemId} のメモボード`} />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </Head>
      
      <MemoBoard itemId={itemId} isDirectAccess={true} />
    </>
  );
};

export default MemoPage;