import { ChevronUp, Clock, X } from 'lucide-react';
import React, { useState } from 'react';

export const MiniWorkoutBar = ({ workoutName, timer, onMaximize, onHide }) => {
  const [isHiding, setIsHiding] = useState(false);

  const formatTime = (seconds) => {
    if (!seconds && seconds !== 0) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleHide = (e) => {
    e.stopPropagation();
    // apply a slightly longer delay so CSS/animation can settle and avoid transient horizontal shifts
    setIsHiding(true);
    setTimeout(() => {
      onHide?.();
      setIsHiding(false);
    }, 380);
  };

  return (
    <div
      onClick={onMaximize}
      className={`active-workout-bar bg-gradient-accent hover:opacity-90 border border-accent/50 p-3.5 flex justify-between items-center cursor-pointer ui-miniworkout-enter ui-mini-bar-spring ui-mini-bar-shimmer transition-opacity transition-transform ease-out group backdrop-blur-sm ${isHiding ? 'opacity-80' : ''}`}
      role="button"
      aria-label="Mini active workout bar"
    >
      <div className="flex flex-col min-w-0">
        <span className="text-xs text-white/90 font-black uppercase tracking-widest">Active Workout</span>
        <span className="text-white font-black text-sm truncate max-w-[200px]">{workoutName || 'Workout'}</span>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1.5 rounded-lg border border-white/30">
          <Clock size={13} className="text-white animate-pulse" />
          <span className="font-mono text-sm font-bold text-white">{formatTime(timer)}</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleHide}
            className="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition ui-mini-expand-spring"
            title="Hide active workout bar"
            aria-label="Hide active workout bar"
          >
            <X size={14} />
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); onMaximize?.(); }}
            className="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition ui-mini-expand-spring"
            title="Open active workout"
            aria-label="Open active workout"
          >
            <ChevronUp size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

