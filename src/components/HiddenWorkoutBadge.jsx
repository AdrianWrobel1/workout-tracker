import React from 'react';
import { createPortal } from 'react-dom';

export const HiddenWorkoutBadge = ({ workoutName, onRestore }) => {
  const content = (
    <div className="fixed left-0 right-0 bottom-28 flex justify-center pointer-events-none z-40">
      <div
        onClick={onRestore}
        className="pointer-events-auto bg-white/6 backdrop-blur-sm px-4 py-3 rounded-lg border border-white/10 text-white text-sm font-semibold cursor-pointer min-w-[200px] max-w-[90%] sm:max-w-[320px] ui-badge-restore-trigger ui-badge-center-mount"
        title="Restore active workout"
        role="button"
        aria-label="Restore active workout"
      >
        <span className="text-xs block opacity-80">Active</span>
        <span className="block truncate max-w-[220px]">{workoutName || 'Workout'}</span>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') return createPortal(content, document.body);
  return content;
};
