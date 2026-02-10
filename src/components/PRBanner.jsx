import { Medal } from 'lucide-react';
import { useEffect, useState } from 'react';

// Map record type to display label
const recordTypeLabel = {
  best1RM: 'Best 1RM',
  bestSetVolume: 'Best Set Volume',
  heaviestWeight: 'Heaviest Weight'
};

// Display order priority (Heaviest Weight → Best Set Volume → Best 1RM)
const recordTypePriority = {
  heaviestWeight: 0,
  bestSetVolume: 1,
  best1RM: 2
};

export const PRBanner = ({ prData, isVisible, onAutoClose }) => {
  const [displayedRecord, setDisplayedRecord] = useState(null);
  const [recordQueue, setRecordQueue] = useState([]);
  const [isAnimating, setIsAnimating] = useState(false);

  // When new PR data arrives, create queue in priority order
  useEffect(() => {
    if (!prData || !isVisible) {
      setRecordQueue([]);
      setDisplayedRecord(null);
      return;
    }

    // Build queue from all record types in priority order
    const queue = [];
    if (prData.recordTypes) {
      const sorted = [...prData.recordTypes].sort(
        (a, b) => recordTypePriority[a] - recordTypePriority[b]
      );
      sorted.forEach(recordType => {
        queue.push({
          exerciseName: prData.exerciseName,
          recordType,
          label: recordTypeLabel[recordType]
        });
      });
    }

    setRecordQueue(queue);
    if (queue.length > 0) {
      showNextRecord(queue);
    }
  }, [prData, isVisible]);

  const showNextRecord = (queue) => {
    if (queue.length === 0) {
      setDisplayedRecord(null);
      onAutoClose?.();
      return;
    }

    setIsAnimating(false);
    const currentRecord = queue[0];
    setDisplayedRecord(currentRecord);

    // Trigger animation start
    setTimeout(() => setIsAnimating(true), 50);

    // Move to next record after display time (1000ms: 100ms fade-in + 900ms hold)
    const displayTime = 1200;
    const timer = setTimeout(() => {
      const remaining = queue.slice(1);
      setRecordQueue(remaining);
      if (remaining.length > 0) {
        showNextRecord(remaining);
      } else {
        onAutoClose?.();
      }
    }, displayTime);

    return () => clearTimeout(timer);
  };

  if (!displayedRecord || !isVisible) {
    return null;
  }

  return (
    <div
      className={`
        fixed bottom-20 left-4 right-4 z-50
        bg-gradient-to-r from-emerald-600 to-emerald-500
        rounded-lg shadow-lg p-4
        flex items-center gap-3
        transform transition-all duration-700 ease-out
        ${isAnimating ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}
      `}
    >
      <Medal className="w-6 h-6 text-yellow-300 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-white text-sm">
          {displayedRecord.exerciseName}
        </div>
        <div className="text-emerald-100 text-xs font-medium">
          {displayedRecord.label}
        </div>
      </div>
    </div>
  );
};

export default PRBanner;
