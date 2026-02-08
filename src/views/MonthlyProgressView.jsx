import React from 'react';
import { ChevronLeft, Trash2 } from 'lucide-react';
import { formatDate } from '../domain/calculations';
import { getMonthLabel } from '../domain/workouts';

export const MonthlyProgressView = ({
  workouts,
  monthOffset,
  onBack,
  onViewWorkoutDetail,
  onDeleteWorkout
}) => {
  const target = new Date();
  target.setMonth(target.getMonth() + monthOffset);
  const month = target.getMonth();
  const year = target.getFullYear();

  const monthWorkouts = workouts.filter(w => {
    const d = new Date(w.date);
    return d.getMonth() === month && d.getFullYear() === year;
  });

  const monthEmoji = {
    0: '❄️', 1: '❄️', 2: '🌱', 3: '🌱', 4: '🌞', 5: '🌞',
    6: '☀️', 7: '☀️', 8: '🍂', 9: '🍂', 10: '🍁', 11: '❄️'
  }[month] || '🏋️';

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Header */}
      <div className="bg-gradient-to-b from-black to-black/80 border-b border-white/10 p-4 sticky top-0 z-20 shadow-2xl flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg transition">
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-black">{monthEmoji} {getMonthLabel(monthOffset)}</h1>
          <p className="text-xs text-slate-400 mt-1 font-semibold">{monthWorkouts.length} workouts this month</p>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {monthWorkouts.length === 0 ? (
          <div className="text-center text-slate-500 mt-12">
            <p className="text-sm font-semibold">No workouts this month</p>
          </div>
        ) : (
          monthWorkouts.map(workout => (
            <div
              key={workout.id}
              className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-lg p-4 hover:from-slate-800/60 hover:to-slate-900/60 hover:border-slate-600/50 transition-all ui-card-mount-anim"
            >
              <div className="flex justify-between items-start gap-3 mb-3">
                <button
                  onClick={() => onViewWorkoutDetail(workout.date)}
                  className="flex-1 text-left hover:opacity-80 transition"
                >
                  <h3 className="text-lg font-black text-white">{workout.name}</h3>
                  <p className="text-xs text-slate-400 mt-1 font-semibold">
                    {new Date(workout.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </p>
                </button>
                <button
                  onClick={() => onDeleteWorkout(workout.id)}
                  className="p-2 text-red-400 hover:bg-red-600/20 hover:border hover:border-red-500/30 rounded-lg transition"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-slate-800/40 border border-slate-700/50 p-2 rounded-lg">
                  <span className="text-xs text-slate-500 font-bold">Duration</span>
                  <div className="text-sm font-black text-white mt-1">{workout.duration || 0} <span className="text-xs font-normal text-slate-400">min</span></div>
                </div>
                <div className="bg-slate-800/40 border border-slate-700/50 p-2 rounded-lg">
                  <span className="text-xs text-slate-500 font-bold">Exercises</span>
                  <div className="text-sm font-black text-white mt-1">{workout.exercises?.length || 0}</div>
                </div>
              </div>

              {/* Note */}
              {workout.note && (
                <div className="mt-3 bg-amber-500/10 border border-amber-500/30 p-2 rounded-lg text-xs text-amber-200 font-semibold">
                  {workout.note}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
