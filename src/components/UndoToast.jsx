import React, { useEffect } from 'react';

export const UndoToast = ({ deletedWorkout, onUndo, onDismiss, duration = 10000 }) => {
  useEffect(() => {
    if (!deletedWorkout) return;
    const t = setTimeout(() => {
      onDismiss && onDismiss();
    }, duration);
    return () => clearTimeout(t);
  }, [deletedWorkout, duration, onDismiss]);

  if (!deletedWorkout) return null;

  return (
    <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 max-w-xs bg-slate-800/95 border border-slate-700 text-white px-5 py-3 rounded-xl shadow-xl z-50 flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-bold">Workout deleted</p>
        <p className="text-xs text-slate-400">Undo within {Math.round(duration/1000)} seconds</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onUndo && onUndo()}
          className="px-4 py-2 bg-indigo-600 hover:opacity-90 rounded-lg text-white font-bold text-sm"
        >
          Undo
        </button>
      </div>
    </div>
  );
};
