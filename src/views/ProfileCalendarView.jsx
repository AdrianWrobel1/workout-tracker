import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const ProfileCalendarView = ({
  workouts = [],
  onBack,
  onViewWorkoutDetail
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const pad = (n) => String(n).padStart(2, '0');
  const isoLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  // Get workouts for a specific date
  const getWorkoutForDate = (date) => {
    const dateStr = isoLocal(date);
    return workouts.find(w => w.date === dateStr);
  };

  // Get all workout dates in current month
  const getWorkoutDatesInMonth = () => {
    const dates = new Set();
    const monthWorkouts = workouts.filter(w => {
      const d = new Date(w.date);
      return d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear();
    });
    monthWorkouts.forEach(w => dates.add(w.date));
    return dates;
  };

  const workoutDates = getWorkoutDatesInMonth();

  // Calendar rendering
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

  const days = getDaysInMonth(currentDate);
  const monthEmpty = Array.from({ length: 42 - days.length }).fill(null);
  const allDays = [...days, ...monthEmpty];

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleDayClick = (day) => {
    if (day) {
      const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const dateStr = isoLocal(clickedDate);
      const workout = workouts.find(w => w.date === dateStr);
      if (workout && onViewWorkoutDetail) {
        onViewWorkoutDetail(dateStr);
      }
    }
  };

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Header */}
      <div className="bg-gradient-to-b from-black to-black/80 border-b border-white/10 p-4 sticky top-0 z-20 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg transition">
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-2xl font-black">Calendar</h1>
          <div className="w-9" />
        </div>
      </div>

      <div className="p-4">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={handlePrevMonth}
            className="p-2 hover:bg-slate-800 rounded-lg transition"
          >
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-xl font-black">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <button
            onClick={handleNextMonth}
            className="p-2 hover:bg-slate-800 rounded-lg transition"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-xl p-4">
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-2 mb-4">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-xs font-black text-slate-400 py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-2">
            {allDays.map((day, idx) => {
              if (!day) {
                return <div key={`empty-${idx}`} className="h-16" />;
              }

              const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
              const dateStr = isoLocal(clickedDate);
              const hasWorkout = workoutDates.has(dateStr);
              const isToday = isoLocal(new Date()) === dateStr;

              return (
                <button
                  key={day}
                  onClick={() => handleDayClick(day)}
                  className={`h-16 rounded-lg font-bold text-sm flex flex-col items-center justify-center transition-all relative ${
                    hasWorkout
                      ? 'bg-blue-600/20 border border-blue-500/50 hover:bg-blue-600/30 text-blue-300'
                      : isToday
                      ? 'bg-slate-700/50 border border-slate-600/50 hover:bg-slate-700/60 text-white'
                      : 'bg-slate-800/30 border border-slate-700/30 hover:bg-slate-800/50 text-slate-400'
                  }`}
                >
                  <span>{day}</span>
                  {hasWorkout && (
                    <div className="absolute bottom-1 w-1.5 h-1.5 bg-blue-400 rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Stats Section */}
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-xl p-4">
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Workouts</p>
            <p className="text-2xl font-black text-blue-400 mt-2">{workoutDates.size}</p>
            <p className="text-xs text-slate-500 mt-1">this month</p>
          </div>

          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-xl p-4">
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total</p>
            <p className="text-2xl font-black text-emerald-400 mt-2">{workouts.length}</p>
            <p className="text-xs text-slate-500 mt-1">all time</p>
          </div>
        </div>
      </div>
    </div>
  );
};
