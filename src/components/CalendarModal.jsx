import React, { useState } from 'react';
import { X } from 'lucide-react';

export const CalendarModal = ({ workouts, onClose, onSelectDate }) => {
  const [currentMonth] = useState(new Date());
  const pad = (n) => String(n).padStart(2, '0');
  const isoLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const today = isoLocal(new Date());
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= lastDate; d++) days.push(d);
    return days;
  };

  const renderMonth = (offset = 0) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1);

    return (
      <div className="mb-8" key={offset}>
        <h3 className="text-lg font-black mb-4">
          {months[date.getMonth()]} {date.getFullYear()}
        </h3>
        <div className="grid grid-cols-7 gap-1 mb-3 text-xs text-slate-500 font-bold">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
            <div key={i} className="text-center py-2">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {getDaysInMonth(date).map((day, i) => {
            if (!day) return <div key={i} />;
            const dateObj = new Date(date.getFullYear(), date.getMonth(), day);
            const dateStr = isoLocal(dateObj);
            const isToday = dateStr === today;
            const hasWorkout = workouts.some(w => w.date === dateStr);

            return (
              <button
                key={i}
                onClick={() => { onSelectDate(dateStr); onClose(); }}
                className={`h-10 rounded-lg text-sm font-bold transition ${
                  isToday
                    ? 'bg-gradient-to-br from-accent to-accent text-white shadow-lg shadow-accent/50'
                    : hasWorkout
                    ? 'bg-gradient-to-br from-accent/60 to-accent/60 border border-accent/30 text-white hover:from-accent/80 hover:to-accent/80'
                    : 'text-slate-500 hover:bg-slate-800/50 hover:text-slate-400'
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-slate-900/95 to-black/95 border border-slate-700/50 rounded-2xl p-6 max-w-md w-full max-h-[85vh] overflow-y-auto shadow-2xl ui-modal-scale ui-fade-scale-anim">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-700/50">
          <h2 className="text-2xl font-black">SELECT DATE</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition text-slate-400">
            <X size={20} />
          </button>
        </div>
        {renderMonth(0)}
        {renderMonth(1)}
      </div>
    </div>
  );
};