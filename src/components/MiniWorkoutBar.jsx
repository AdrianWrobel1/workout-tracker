import React from 'react';
import { ChevronUp, Clock } from 'lucide-react';

export const MiniWorkoutBar = ({ workoutName, timer, onMaximize }) => {
  
  const formatTime = (seconds) => {
    if (!seconds && seconds !== 0) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      onClick={onMaximize}
      className="fixed bottom-[72px] left-3 right-3 z-30 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 border border-blue-400/50 rounded-lg p-4 shadow-2xl shadow-blue-600/50 flex justify-between items-center cursor-pointer animate-in slide-in-from-bottom-4 fade-in duration-200 transition-all ease-out group"
    >
      <div className="flex flex-col">
        <span className="text-xs text-blue-100 font-black uppercase tracking-widest">Active Workout</span>
        <span className="text-white font-black text-sm truncate max-w-[200px]">{workoutName || "Workout"}</span>
      </div>

        <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 bg-white/20 px-4 py-2 rounded-lg border border-white/30">
          <Clock size={14} className="text-white animate-pulse" />
          <span className="font-mono text-sm font-bold text-white">{formatTime(timer)}</span>
        </div>
        <button className="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition">
          <ChevronUp size={18} />
        </button>
      </div>
    </div>
  );
};