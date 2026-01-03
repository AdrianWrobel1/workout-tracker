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
        <h3 className="text-lg font-semibold mb-4">
          {months[date.getMonth()]} {date.getFullYear()}
        </h3>
        <div className="grid grid-cols-7 gap-2 mb-2 text-xs text-zinc-500">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <div key={i} className="text-center">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
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
                className={`h-10 rounded-full text-sm font-medium transition
                  ${isToday ? 'bg-rose-400 text-white' :
                    hasWorkout ? 'bg-zinc-700 text-white' :
                    'text-zinc-400 hover:bg-zinc-800'}`}
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
      <div className="bg-zinc-900 rounded-3xl p-6 max-w-md w-full max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between mb-6">
          <h2 className="text-xl font-bold">Select date</h2>
          <button onClick={onClose}><X /></button>
        </div>
        {renderMonth(0)}
        {renderMonth(1)}
      </div>
    </div>
  );
};