import React from 'react';
import { ChevronUp, Clock } from 'lucide-react';

export const MiniWorkoutBar = ({ workoutName, timer, onMaximize }) => {
  
  // Wbudowana funkcja formatowania czasu (żeby uniknąć błędów importu)
  const formatTime = (seconds) => {
    if (!seconds && seconds !== 0) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      onClick={onMaximize}
      className="fixed bottom-[70px] left-2 right-2 z-30 bg-zinc-800 border border-zinc-700 rounded-xl p-3 shadow-2xl shadow-black flex justify-between items-center cursor-pointer animate-in slide-in-from-bottom-4 fade-in duration-300"
    >
      <div className="flex flex-col">
        <span className="text-xs text-rose-400 font-bold uppercase tracking-wider">Active Workout</span>
        <span className="text-white font-semibold text-sm truncate max-w-[200px]">{workoutName || "Trening"}</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 bg-zinc-900 px-2 py-1 rounded-lg">
          <Clock size={14} className="text-zinc-400 animate-pulse" />
          <span className="font-mono text-sm font-bold text-white">{formatTime(timer)}</span>
        </div>
        <button className="p-1.5 bg-zinc-700 rounded-full text-white hover:bg-zinc-600 transition">
          <ChevronUp size={20} />
        </button>
      </div>
    </div>
  );
};