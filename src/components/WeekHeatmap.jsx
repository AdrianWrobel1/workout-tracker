import React, { useMemo, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { calculateTotalVolume } from '../domain/calculations';

// Minimal 7-dot heatmap for last 7 days (today included) with day labels
export const WeekHeatmap = ({ workouts = [] }) => {
  const [showMonthModal, setShowMonthModal] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);

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

  const dayLabels = useMemo(() => {
    return days.map(d => {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return dayNames[d.getDay()];
    });
  }, [days]);

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

  // Month calendar data with modal
  const monthData = useMemo(() => {
    const target = new Date();
    target.setMonth(target.getMonth() + monthOffset);
    const year = target.getFullYear();
    const month = target.getMonth();

    // Build map
    const map = {};
    workouts.forEach(w => {
      const dateStr = (w.date || '').toString();
      if (!dateStr) return;
      const wDate = new Date(dateStr);
      if (wDate.getMonth() === month && wDate.getFullYear() === year) {
        const vol = (w.exercises || []).reduce((sum, ex) => {
          return sum + calculateTotalVolume(ex.sets || []);
        }, 0);
        map[wDate.getDate()] = (map[wDate.getDate()] || 0) + vol;
      }
    });

    // Days in month
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();

    return { month, year, daysInMonth, firstDay, map };
  }, [monthOffset, workouts]);

  const monthStr = new Date(monthData.year, monthData.month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <>
      {/* Week heatmap with day labels */}
      <div className="mt-4">
        {/* Day labels */}
        <div className="flex items-center gap-2 justify-center mb-2" aria-hidden>
          {dayLabels.map((label, i) => (
            <div key={i} className="w-3.5 sm:w-4 text-[9px] text-slate-500 font-bold text-center">
              {label}
            </div>
          ))}
        </div>

        {/* Clickable heatmap */}
        <div className="flex items-center gap-2 justify-center cursor-pointer" onClick={() => setShowMonthModal(true)}>
          {volumes.map((v, i) => (
            <div
              key={i}
              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full ${getColor(v)} transition-all duration-200 ease-out hover:scale-110`}
              title={`${days[i].toDateString()}: ${v > 0 ? v + ' volume' : 'rest day'}`}
            />
          ))}
        </div>
        <p className="text-xs text-slate-500 text-center mt-1">Click to see full month</p>
      </div>

      {/* Month calendar modal */}
      {showMonthModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 max-w-sm w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">{monthStr}</h2>
              <button
                onClick={() => setShowMonthModal(false)}
                className="p-1 hover:bg-slate-800 rounded transition"
              >
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            {/* Month navigation */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setMonthOffset(monthOffset - 1)}
                className="p-1 hover:bg-slate-800 rounded transition"
              >
                <ChevronLeft size={18} className="text-slate-400" />
              </button>
              <button
                onClick={() => setMonthOffset(0)}
                className="text-xs px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded transition"
              >
                Today
              </button>
              <button
                onClick={() => setMonthOffset(monthOffset + 1)}
                className="p-1 hover:bg-slate-800 rounded transition"
              >
                <ChevronRight size={18} className="text-slate-400" />
              </button>
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {/* Day headers */}
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                <div key={d} className="text-[10px] font-bold text-slate-500 py-1">
                  {d}
                </div>
              ))}

              {/* Empty cells before month starts */}
              {Array(monthData.firstDay).fill(null).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}

              {/* Days */}
              {Array(monthData.daysInMonth).fill(null).map((_, i) => {
                const day = i + 1;
                const vol = monthData.map[day] || 0;
                const isToday = new Date().getDate() === day && new Date().getMonth() === monthData.month && new Date().getFullYear() === monthData.year;

                return (
                  <div
                    key={day}
                    className={`w-full aspect-square flex items-center justify-center text-xs font-bold rounded transition ${
                      vol > 0 ? getColor(vol) : 'bg-slate-800/30'
                    } ${isToday ? 'ring-2 ring-blue-400' : ''}`}
                    title={vol > 0 ? `${vol} volume` : 'rest'}
                  >
                    {day}
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-slate-400 text-center mt-4">
              {monthData.map[new Date().getDate()] || 0 > 0
                ? `${monthData.map[new Date().getDate()] || 0} volume today`
                : 'No workout today'}
            </p>
          </div>
        </div>
      )}
    </>
  );
};
