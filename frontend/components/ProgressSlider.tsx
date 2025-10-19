import React, { useState, useEffect, useRef } from 'react';

interface ProgressSliderProps {
  itemId: string;
  totalPieces: number;
  currentProgress: number;
  targetDate?: string;
  onProgressUpdate?: (progress: number) => void;
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
  const sliderRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update local state when prop changes
  useEffect(() => {
    setProgress(currentProgress);
    setCompletedPieces(Math.round((currentProgress / 100) * totalPieces));
  }, [currentProgress, totalPieces]);

  // Auto-save after 3 seconds of inactivity
  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    if (!isDragging && progress !== currentProgress) {
      saveTimeoutRef.current = setTimeout(() => {
        saveProgress();
      }, 3000);
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [progress, isDragging, currentProgress]);

  const saveProgress = async () => {
    try {
      setIsSaving(true);
      if (onProgressUpdate) {
        await onProgressUpdate(progress);
      }
      console.log('✅ Progress saved to Appwrite:', progress);
    } catch (error) {
      console.error('❌ Failed to save progress:', error);
      alert('進捗の保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSliderStart = (e: React.MouseEvent | React.TouchEvent) => {
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
    
    setProgress(Math.round(percentage));
    setCompletedPieces(Math.round((percentage / 100) * totalPieces));
  };

  const handleSliderEnd = () => {
    setIsDragging(false);
  };

  const handlePiecesInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    if (inputValue === '') {
      setCompletedPieces(0);
      setProgress(0);
      return;
    }
    const value = parseInt(inputValue);
    if (isNaN(value)) return;
    const clampedValue = Math.max(0, Math.min(totalPieces, value));
    setCompletedPieces(clampedValue);
    const percentage = Math.round((clampedValue / totalPieces) * 100);
    setProgress(percentage);
  };

  const handlePercentageInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    if (inputValue === '') {
      setProgress(0);
      setCompletedPieces(0);
      return;
    }
    const value = parseInt(inputValue);
    if (isNaN(value)) return;
    const clampedValue = Math.max(0, Math.min(100, value));
    setProgress(clampedValue);
    setCompletedPieces(Math.round((clampedValue / 100) * totalPieces));
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
        {isSaving && (
          <span className="text-sm text-green-600 animate-pulse flex items-center gap-1">
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-green-600"></div>
            保存中...
          </span>
        )}
      </div>

      {/* Target Date Display */}
      {formattedTargetDate && (
        <div className="mb-4 text-sm text-gray-600">
          🎯 目標完了日: <span className="font-medium">{formattedTargetDate}</span>
        </div>
      )}

      {/* Progress Bar */}
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
          {/* Progress Fill */}
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
          
          {/* Draggable Handle */}
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

      {/* Input Controls */}
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

      {/* Progress Status */}
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

      {/* Auto-save indicator */}
      {progress !== currentProgress && !isDragging && (
        <div className="mt-3 text-xs text-gray-500 text-center">
          💾 3秒後に自動保存されます
        </div>
      )}
    </div>
  );
};

export default ProgressSlider;