import React from 'react';
import { Delete, Check, ChevronRight } from 'lucide-react';

/**
 * Custom numeric keypad for kg/reps/rpe input
 * Appears at bottom of screen, replaces system keyboard
 */
export const CustomKeypad = ({
  value = '',
  onValueChange,
  onDone,
  onNext = null,
  label = '',
  showPlusMinus = false,
  onPlus = null,
  onMinus = null
}) => {
  const handleNumClick = (num) => {
    const newValue = value + num;
    // Limit to reasonable values (2-3 digits)
    if (newValue.length <= 3) {
      onValueChange(newValue);
    }
  };

  const handleBackspace = () => {
    onValueChange(value.slice(0, -1));
  };

  return (
    <div className="fixed inset-x-0 bottom-24 z-50 bg-gradient-to-t from-slate-950 to-slate-900 border-t border-slate-700 px-4 py-4 shadow-2xl animate-in slide-in-from-bottom-2">
      {/* Current Value Display */}
      <div className="mb-4">
        {label && <p className="text-xs text-slate-400 font-semibold tracking-widest mb-2">{label}</p>}
        <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-3 text-right">
          <p className="text-2xl font-black text-white">{value || '0'}</p>
        </div>
      </div>

      {/* Keypad Grid */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {/* Row 1: 1-3 */}
        {[1, 2, 3].map((num) => (
          <button
            key={num}
            onClick={() => handleNumClick(num.toString())}
            className="bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-white font-bold py-3 rounded-lg transition-colors text-lg"
          >
            {num}
          </button>
        ))}

        {/* Row 2: 4-6 */}
        {[4, 5, 6].map((num) => (
          <button
            key={num}
            onClick={() => handleNumClick(num.toString())}
            className="bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-white font-bold py-3 rounded-lg transition-colors text-lg"
          >
            {num}
          </button>
        ))}

        {/* Row 3: 7-9 */}
        {[7, 8, 9].map((num) => (
          <button
            key={num}
            onClick={() => handleNumClick(num.toString())}
            className="bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-white font-bold py-3 rounded-lg transition-colors text-lg"
          >
            {num}
          </button>
        ))}

        {/* Row 4: 0, Backspace, and action button */}
        <button
          onClick={() => handleNumClick('0')}
          className="col-span-1 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-white font-bold py-3 rounded-lg transition-colors text-lg"
        >
          0
        </button>

        <button
          onClick={handleBackspace}
          className="bg-red-600/30 hover:bg-red-600/40 active:bg-red-600/50 text-red-400 border border-red-600/40 font-bold py-3 rounded-lg transition-colors flex items-center justify-center"
        >
          <Delete size={18} />
        </button>

        {onNext ? (
          <button
            onClick={onNext}
            className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center"
          >
            <ChevronRight size={20} />
          </button>
        ) : (
          <button
            onClick={onDone}
            className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center"
          >
            <Check size={20} />
          </button>
        )}
      </div>

      {/* Plus/Minus buttons for RPE */}
      {showPlusMinus && (
        <div className="flex gap-2">
          <button
            onClick={onMinus}
            className="flex-1 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-white font-bold py-2 rounded-lg transition-colors"
          >
            −
          </button>
          <button
            onClick={onPlus}
            className="flex-1 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-white font-bold py-2 rounded-lg transition-colors"
          >
            +
          </button>
        </div>
      )}
    </div>
  );
};
