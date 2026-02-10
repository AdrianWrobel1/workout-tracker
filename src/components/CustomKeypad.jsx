import React from 'react';
import { Delete, ChevronRight } from 'lucide-react';

/**
 * Custom numeric keypad for kg/reps/rpe input
 * Bottom sheet style - non-invasive, minimal UX
 */
export const CustomKeypad = ({
  value = '',
  onValueChange,
  onDone,
  onNext = null,
  label = '',
}) => {
  const handleNumClick = (num) => {
    const newValue = value + num;
    // Limit to reasonable values (3 digits max)
    if (newValue.length <= 3) {
      onValueChange(newValue);
    }
  };

  const handleBackspace = () => {
    onValueChange(value.slice(0, -1));
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 bg-slate-900/95 backdrop-blur-sm border-t border-slate-700/50 px-3 py-2 shadow-2xl animate-in slide-in-from-bottom-1 duration-200">
      {/* Compact Header with Value Display */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex-1 min-w-0">
          {label && <p className="text-xs text-slate-500 font-semibold">{label}</p>}
          <p className="text-xl font-black text-white">{value || '0'}</p>
        </div>
        <button
          onClick={onDone}
          className="px-3 py-1 bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600/50 text-slate-300 hover:text-white text-xs font-bold rounded transition-colors ml-2"
        >
          ✕
        </button>
      </div>

      {/* Compact Keypad Grid - 3 columns, minimal gaps */}
      <div className="grid grid-cols-4 gap-1">
        {/* 1-3 */}
        {[1, 2, 3].map((num) => (
          <button
            key={num}
            onClick={() => handleNumClick(num.toString())}
            className="bg-slate-800/60 hover:bg-slate-700/60 active:bg-slate-600/60 text-white font-bold py-2 rounded text-sm transition-colors"
          >
            {num}
          </button>
        ))}
        <button
          onClick={handleBackspace}
          className="bg-red-600/20 hover:bg-red-600/30 active:bg-red-600/40 text-red-400 border border-red-600/30 font-bold py-2 rounded text-xs transition-colors"
        >
          ⌫
        </button>

        {/* 4-6 */}
        {[4, 5, 6].map((num) => (
          <button
            key={num}
            onClick={() => handleNumClick(num.toString())}
            className="bg-slate-800/60 hover:bg-slate-700/60 active:bg-slate-600/60 text-white font-bold py-2 rounded text-sm transition-colors"
          >
            {num}
          </button>
        ))}
        {onNext && (
          <button
            onClick={onNext}
            className="bg-blue-600/60 hover:bg-blue-600/70 active:bg-blue-700/70 text-white font-bold py-2 rounded text-xs transition-colors row-span-2 flex items-center justify-center"
          >
            <span className="text-lg">→</span>
          </button>
        )}

        {/* 7-9 */}
        {[7, 8, 9].map((num) => (
          <button
            key={num}
            onClick={() => handleNumClick(num.toString())}
            className="bg-slate-800/60 hover:bg-slate-700/60 active:bg-slate-600/60 text-white font-bold py-2 rounded text-sm transition-colors"
          >
            {num}
          </button>
        ))}

        {/* 0 - spans 2 columns */}
        <button
          onClick={() => handleNumClick('0')}
          className="col-span-2 bg-slate-800/60 hover:bg-slate-700/60 active:bg-slate-600/60 text-white font-bold py-2 rounded text-sm transition-colors"
        >
          0
        </button>
      </div>
    </div>
  );
};

export default CustomKeypad;
