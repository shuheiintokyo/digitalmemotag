import { useState, useEffect, useRef } from 'react';

interface ProgressSliderProps {
  itemId: string;
  totalPieces: number;
  currentProgress: number;
  targetDate?: string;
  onProgressUpdate?: (progress: number) => Promise<void>;
}

const ProgressSlider: React.FC<ProgressSliderProps> = ({ 
  itemId, 
  totalPieces, 
  currentProgress = 0,
  targetDate,
  onProgressUpdate 
}) => {
  const [progress, setProgress] = useState(currentProgress);
  const [completedPieces, setCompletedPieces] = useState(Math.round((currentProgress / 100) * totalPieces));
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 🔍 DEBUG: Log when component mounts and props change
  useEffect(() => {
    console.group('🎯 ProgressSlider Component');
    console.log('Item ID:', itemId);
    console.log('Total Pieces:', totalPieces);
    console.log('Current Progress (from props):', currentProgress);
    console.log('Target Date:', targetDate);
    console.groupEnd();
  }, [itemId, totalPieces, currentProgress, targetDate]);

  // Update local state when prop changes
  useEffect(() => {
    console.log('📥 Progress prop changed:', {
      oldProgress: progress,
      newProgress: currentProgress,
      willUpdate: progress !== currentProgress
    });
    
    setProgress(currentProgress);
    setCompletedPieces(Math.round((currentProgress / 100) * totalPieces));
    setHasUnsavedChanges(false);
    setSaveError(null);
  }, [currentProgress, totalPieces]);

  // Auto-save after 3 seconds of inactivity
  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    if (!isDragging && progress !== currentProgress && hasUnsavedChanges) {
      console.log('⏰ Auto-save scheduled in 3 seconds...', {
        currentProgress: progress,
        savedProgress: currentProgress,
        difference: progress - currentProgress
      });
      
      saveTimeoutRef.current = setTimeout(() => {
        console.log('🤖 Auto-save triggered!');
        saveProgress();
      }, 3000);
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, isDragging, currentProgress, hasUnsavedChanges]);

  const saveProgress = async () => {
    console.group('💾 SAVE PROGRESS');
    console.log('Item ID:', itemId);
    console.log('Progress to save:', progress);
    console.log('Previous progress:', currentProgress);
    
    try {
      setIsSaving(true);
      setSaveSuccess(false);
      setSaveError(null);
      
      const isAdmin = typeof window !== 'undefined' ? !!localStorage.getItem('authToken') : false;
      console.log('👤 User type:', isAdmin ? 'Admin' : 'Regular User');
      console.log('🔐 Auth token exists:', !!localStorage.getItem('authToken'));
      
      if (onProgressUpdate) {
        console.log('📤 Calling onProgressUpdate callback...');
        await onProgressUpdate(progress);
        console.log('✅ onProgressUpdate completed successfully');
      } else {
        console.warn('⚠️ No onProgressUpdate callback provided!');
      }
      
      setHasUnsavedChanges(false);
      setSaveSuccess(true);
      console.log('✅ Progress saved successfully!');
      
      setTimeout(() => {
        setSaveSuccess(false);
      }, 2000);
    } catch (error: any) {
      console.error('❌ Failed to save progress');
      console.error('Error object:', error);
      
      if (error.response) {
        console.error('Server response:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          headers: error.response.headers
        });
      } else if (error.request) {
        console.error('No response received:', error.request);
      } else {
        console.error('Request setup error:', error.message);
      }
      
      let errorMessage = '進捗の保存に失敗しました。';
      
      if (error.response) {
        if (error.response.status === 401) {
          errorMessage = '認証エラー: ページを再読み込みしてください。';
        } else if (error.response.status === 400) {
          errorMessage = `エラー: ${error.response.data.detail || '無効な進捗値です。'}`;
        } else if (error.response.status === 404) {
          errorMessage = 'アイテムが見つかりません。';
        } else if (error.response.status >= 500) {
          errorMessage = 'サーバーエラーが発生しました。しばらく待ってから再試行してください。';
        }
      } else if (error.request) {
        errorMessage = 'サーバーに接続できません。ネットワーク接続を確認してください。';
      }
      
      setSaveError(errorMessage);
      setHasUnsavedChanges(true);
      
      setTimeout(() => {
        setSaveError(null);
      }, 5000);
    } finally {
      setIsSaving(false);
      console.groupEnd();
    }
  };

  const handleSliderStart = (e: React.MouseEvent | React.TouchEvent) => {
    console.log('🖱️ Slider interaction started');
    setIsDragging(true);
    handleSliderMove(e);
  };

  const handleSliderMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging && e.type !== 'mousedown' && e.type !== 'touchstart') return;
    
    if (!sliderRef.current) return;

    const rect = sliderRef.current.getBoundingClientRect();
    let clientX: number;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
    } else {
      clientX = e.clientX;
    }

    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    const roundedPercentage = Math.round(percentage);
    
    if (roundedPercentage !== progress) {
      console.log('🎚️ Slider moved:', {
        from: progress,
        to: roundedPercentage,
        pieces: Math.round((roundedPercentage / 100) * totalPieces)
      });
    }
    
    setProgress(roundedPercentage);
    setCompletedPieces(Math.round((roundedPercentage / 100) * totalPieces));
    setHasUnsavedChanges(true);
    setSaveError(null);
  };

  const handleSliderEnd = () => {
    console.log('🖱️ Slider interaction ended at', progress, '%');
    setIsDragging(false);
  };

  const handlePiecesInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    if (inputValue === '') {
      console.log('📝 Pieces input cleared');
      setCompletedPieces(0);
      setProgress(0);
      setHasUnsavedChanges(true);
      setSaveError(null);
      return;
    }
    const value = parseInt(inputValue);
    if (isNaN(value)) return;
    const clampedValue = Math.max(0, Math.min(totalPieces, value));
    const percentage = Math.round((clampedValue / totalPieces) * 100);
    
    console.log('📝 Pieces input changed:', {
      pieces: clampedValue,
      percentage: percentage
    });
    
    setCompletedPieces(clampedValue);
    setProgress(percentage);
    setHasUnsavedChanges(true);
    setSaveError(null);
  };

  const handlePercentageInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    if (inputValue === '') {
      console.log('📝 Percentage input cleared');
      setProgress(0);
      setCompletedPieces(0);
      setHasUnsavedChanges(true);
      setSaveError(null);
      return;
    }
    const value = parseInt(inputValue);
    if (isNaN(value)) return;
    const clampedValue = Math.max(0, Math.min(100, value));
    
    console.log('📝 Percentage input changed:', {
      percentage: clampedValue,
      pieces: Math.round((clampedValue / 100) * totalPieces)
    });
    
    setProgress(clampedValue);
    setCompletedPieces(Math.round((clampedValue / 100) * totalPieces));
    setHasUnsavedChanges(true);
    setSaveError(null);
  };

  // Global mouse/touch move and up events
  useEffect(() => {
    const handleGlobalMove = (e: MouseEvent | TouchEvent) => {
      if (isDragging) {
        handleSliderMove(e as any);
      }
    };

    const handleGlobalEnd = () => {
      if (isDragging) {
        setIsDragging(false);
      }
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleGlobalMove);
      document.addEventListener('mouseup', handleGlobalEnd);
      document.addEventListener('touchmove', handleGlobalMove);
      document.addEventListener('touchend', handleGlobalEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMove);
      document.removeEventListener('mouseup', handleGlobalEnd);
      document.removeEventListener('touchmove', handleGlobalMove);
      document.removeEventListener('touchend', handleGlobalEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging]);

  // Format target date
  const formatTargetDate = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('ja-JP', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch {
      return dateStr;
    }
  };

  const formattedTargetDate = formatTargetDate(targetDate);

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-semibold">📊 進捗状況</h3>
        <div className="flex items-center gap-2">
          {isSaving && (
            <span className="text-sm text-blue-600 animate-pulse flex items-center gap-1">
              <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></span>
              保存中...
            </span>
          )}
          {saveSuccess && !saveError && (
            <span className="text-sm text-green-600 flex items-center gap-1 animate-fadeIn">
              ✅ 保存完了
            </span>
          )}
          {hasUnsavedChanges && !isSaving && !saveSuccess && !saveError && (
            <span className="text-sm text-orange-600 flex items-center gap-1">
              ⚠️ 未保存
            </span>
          )}
          
          <button
            onClick={saveProgress}
            disabled={!hasUnsavedChanges || isSaving}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              hasUnsavedChanges && !isSaving
                ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            💾 保存
          </button>
        </div>
      </div>

      {saveError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-2">
            <span className="text-red-500 text-lg">⚠️</span>
            <div className="flex-1">
              <p className="text-sm text-red-700 font-medium">エラー</p>
              <p className="text-sm text-red-600 mt-1">{saveError}</p>
            </div>
          </div>
        </div>
      )}

      {formattedTargetDate && (
        <div className="mb-4 text-sm text-gray-600">
          🎯 目標完了日: <span className="font-medium">{formattedTargetDate}</span>
        </div>
      )}

      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>0%</span>
          <span className="font-bold text-lg text-blue-600">{progress}%</span>
          <span>100%</span>
        </div>
        
        <div 
          ref={sliderRef}
          className="relative h-12 bg-gray-200 rounded-full cursor-pointer select-none"
          onMouseDown={handleSliderStart}
          onTouchStart={handleSliderStart}
        >
          <div 
            className={`absolute top-0 left-0 h-full rounded-full transition-all duration-150 ${
              progress === 100 ? 'bg-gradient-to-r from-green-400 to-green-600' :
              progress >= 75 ? 'bg-gradient-to-r from-blue-400 to-blue-600' :
              progress >= 50 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' :
              progress >= 25 ? 'bg-gradient-to-r from-orange-400 to-orange-600' :
              'bg-gradient-to-r from-red-400 to-red-600'
            }`}
            style={{ width: `${progress}%` }}
          />
          
          <div
            className={`absolute top-1/2 transform -translate-y-1/2 w-8 h-8 bg-white border-4 rounded-full shadow-lg transition-transform ${
              isDragging ? 'scale-125' : 'hover:scale-110'
            } ${
              progress === 100 ? 'border-green-500' :
              progress >= 75 ? 'border-blue-500' :
              progress >= 50 ? 'border-yellow-500' :
              progress >= 25 ? 'border-orange-500' :
              'border-red-500'
            }`}
            style={{ left: `calc(${progress}% - 16px)` }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={`w-2 h-2 rounded-full ${
                progress === 100 ? 'bg-green-500' :
                progress >= 75 ? 'bg-blue-500' :
                progress >= 50 ? 'bg-yellow-500' :
                progress >= 25 ? 'bg-orange-500' :
                'bg-red-500'
              }`} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            完了数 / 総数
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="number"
              min="0"
              max={totalPieces}
              value={completedPieces}
              onChange={handlePiecesInput}
              className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <span className="text-gray-600">/ {totalPieces} pcs</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            進捗率
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="number"
              min="0"
              max="100"
              value={progress}
              onChange={handlePercentageInput}
              className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <span className="text-gray-600">%</span>
          </div>
        </div>
      </div>

      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">ステータス:</span>
          <span className={`font-semibold text-sm ${
            progress === 100 ? 'text-green-600' : 
            progress >= 75 ? 'text-blue-600' : 
            progress >= 50 ? 'text-yellow-600' : 
            progress >= 25 ? 'text-orange-600' : 
            'text-red-600'
          }`}>
            {progress === 100 ? '✅ 完了' : 
             progress >= 75 ? '🔵 順調' : 
             progress >= 50 ? '🟡 進行中' : 
             progress >= 25 ? '🟠 遅延気味' : 
             '🔴 要確認'}
          </span>
        </div>
      </div>

      {hasUnsavedChanges && !isDragging && !isSaving && !saveError && (
        <div className="mt-3 text-xs text-gray-500 text-center">
          ⏰ 3秒後に自動保存されます（または「保存」ボタンをクリック）
        </div>
      )}

      {/* Always show debug info for troubleshooting */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-xs">
        <div className="font-bold text-blue-800 mb-2">🔍 Debug Info:</div>
        <div className="space-y-1 text-blue-700">
          <div>Item ID: <span className="font-mono">{itemId}</span></div>
          <div>Progress (local): <span className="font-mono">{progress}%</span></div>
          <div>Progress (from props): <span className="font-mono">{currentProgress}%</span></div>
          <div>Total Pieces: <span className="font-mono">{totalPieces}</span></div>
          <div>Completed Pieces: <span className="font-mono">{completedPieces}</span></div>
          <div>Has Auth Token: <span className="font-mono">{typeof window !== 'undefined' && localStorage.getItem('authToken') ? 'Yes (Admin)' : 'No (User)'}</span></div>
          <div>Has Unsaved Changes: <span className="font-mono">{hasUnsavedChanges ? 'Yes' : 'No'}</span></div>
          <div>Is Dragging: <span className="font-mono">{isDragging ? 'Yes' : 'No'}</span></div>
          <div>onProgressUpdate callback: <span className="font-mono">{onProgressUpdate ? 'Provided ✓' : 'Missing ✗'}</span></div>
        </div>
      </div>
    </div>
  );
};

export default ProgressSlider;