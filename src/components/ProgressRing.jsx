import React, { useMemo } from 'react';
import { calculateTotalVolume } from '../domain/calculations';

// Progress ring: last 7 days vs 4-8 week average
export const ProgressRing = ({ workouts = [] }) => {
  const data = useMemo(() => {
    const now = new Date();
    
    // Last 7 days volume
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last7Days = workouts.filter(w => new Date(w.date) >= sevenDaysAgo);
    const volume7d = last7Days.reduce((sum, w) => sum + (w.exercises || []).reduce((s, ex) => s + calculateTotalVolume(ex.sets || []), 0), 0);
    
    // 4-8 week average (28-56 days back, excluding last 7)
    const eightWeeksAgo = new Date(now.getTime() - 56 * 24 * 60 * 60 * 1000);
    const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
    const historicalRange = workouts.filter(w => {
      const d = new Date(w.date);
      return d >= eightWeeksAgo && d < fourWeeksAgo;
    });
    
    const historicalVol = historicalRange.reduce((sum, w) => sum + (w.exercises || []).reduce((s, ex) => s + calculateTotalVolume(ex.sets || []), 0), 0);
    const avgWeekly = historicalRange.length > 0 ? historicalVol / (historicalRange.length / 7) : 0;
    
    // Calculate percentage (capped at 150%)
    const percentage = avgWeekly > 0 ? Math.min((volume7d / avgWeekly) * 100, 150) : 0;
    
    return {
      volume7d: Math.round(volume7d / 1000) || 0, // in thousands for readability
      avgWeekly: Math.round(avgWeekly / 1000) || 0,
      percentage: Math.round(percentage)
    };
  }, [workouts]);
  
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (data.percentage / 100) * circumference;
  
  const getColor = (pct) => {
    if (pct >= 100) return '#10b981'; // emerald
    if (pct >= 80) return '#3b82f6'; // blue
    return '#f59e0b'; // amber
  };
  
  return (
    <div className="flex flex-col items-center">
      <svg width="120" height="120" viewBox="0 0 120 120" className="drop-shadow-lg">
        {/* Background circle */}
        <circle cx="60" cy="60" r="45" fill="none" stroke="#334155" strokeWidth="6" opacity="0.3" />
        
        {/* Progress circle */}
        <circle
          cx="60"
          cy="60"
          r="45"
          fill="none"
          stroke={getColor(data.percentage)}
          strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          transform="rotate(-90 60 60)"
        />
        
        {/* Center text */}
        <text x="60" y="58" textAnchor="middle" fontSize="24" fontWeight="bold" fill="white">
          {data.percentage}%
        </text>
        <text x="60" y="72" textAnchor="middle" fontSize="11" fill="#94a3b8">
          of avg
        </text>
      </svg>
      
      <div className="text-center mt-2">
        <p className="text-xs text-slate-400 font-semibold">WEEKLY VOLUME</p>
        <p className="text-sm font-black text-white">
          {data.volume7d}k <span className="text-slate-400 font-normal">/ {data.avgWeekly}k</span>
        </p>
      </div>
    </div>
  );
};
