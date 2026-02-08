import React, { useMemo } from 'react';
import { calculateTotalVolume } from '../domain/calculations';

// Minimal 7-dot heatmap for last 7 days (today included)
export const WeekHeatmap = ({ workouts = [] }) => {
  const days = useMemo(() => {
    const today = new Date();
    const arr = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      d.setHours(0, 0, 0, 0);
      arr.push(d);
    }
    return arr;
  }, []);

  const volumes = useMemo(() => {
    // map date string (yyyy-mm-dd) to total volume (completed sets)
    const map = {};
    workouts.forEach(w => {
      const dateStr = (w.date || '').toString();
      if (!dateStr) return;
      // compute workout volume by summing exercise volumes
      const vol = (w.exercises || []).reduce((sum, ex) => {
        return sum + calculateTotalVolume(ex.sets || []);
      }, 0);
      map[dateStr] = (map[dateStr] || 0) + vol;
    });

    return days.map(d => {
      const key = d.toISOString().split('T')[0];
      return map[key] || 0;
    });
  }, [workouts, days]);

  const max = Math.max(...volumes, 0);

  const getColor = (v) => {
    if (!v) return 'bg-slate-700/20';
    const ratio = max > 0 ? v / max : 0;
    if (ratio > 0.75) return 'bg-blue-400';
    if (ratio > 0.5) return 'bg-blue-500';
    if (ratio > 0.25) return 'bg-blue-600';
    return 'bg-blue-700/80';
  };

  return (
    <div className="flex items-center gap-2 justify-center mt-4" aria-hidden>
      {volumes.map((v, i) => (
        <div
          key={i}
          className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full ${getColor(v)} transition-colors duration-200 ease-out`}
        />
      ))}
    </div>
  );
};
