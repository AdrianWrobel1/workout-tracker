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
    <div className="min-h-screen bg-zinc-900 text-white pb-24">
      <div className="bg-zinc-800 p-4 sticky top-0 z-10 shadow-lg flex items-center gap-4">
        <button onClick={onBack}>
          <ChevronLeft size={24} />
        </button>
        <div>
          <h1 className="text-2xl font-bold">{monthEmoji} {getMonthLabel(monthOffset)}</h1>
          <p className="text-xs text-zinc-400">{monthWorkouts.length} workouts</p>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {monthWorkouts.length === 0 && (
          <div className="text-center text-zinc-500 mt-10">No workouts this month</div>
        )}

        {monthWorkouts.map(workout => (
          <div
            key={workout.id}
            className="bg-zinc-800 rounded-xl p-4 border border-zinc-700 hover:bg-zinc-700/50 transition"
          >
            <div className="flex justify-between items-start mb-2">
              <div
                onClick={() => onViewWorkoutDetail(workout.date)}
                className="flex-1 cursor-pointer"
              >
                <h3 className="text-lg font-bold text-rose-400">{workout.name}</h3>
                <p className="text-sm text-zinc-400 mb-2">
                  {new Date(workout.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </p>
              </div>
              <button
                onClick={() => onDeleteWorkout(workout.id)}
                className="p-2 text-red-400 hover:bg-red-900/20 rounded-lg transition"
              >
                <Trash2 size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-zinc-900 p-2 rounded">
                <span className="text-zinc-400">Duration:</span>
                <span className="text-white ml-2 font-bold">{workout.duration || 0} min</span>
              </div>
              <div className="bg-zinc-900 p-2 rounded">
                <span className="text-zinc-400">Exercises:</span>
                <span className="text-white ml-2 font-bold">{workout.exercises?.length || 0}</span>
              </div>
            </div>

            {workout.note && (
              <div className="mt-3 bg-amber-900/20 p-2 rounded text-xs text-amber-300">
                {workout.note}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
