import React from 'react';
import { ChevronRight } from 'lucide-react';
import { formatDate, formatMonth } from '../domain/calculations';

export const HistoryView = ({ workouts, onViewWorkoutDetail, onDeleteWorkout }) => {
  // Group workouts by month-year and build elements
  const groups = {};
  workouts.forEach(w => {
    const key = new Date(w.date).toISOString().slice(0,7); // YYYY-MM
    if (!groups[key]) groups[key] = [];
    groups[key].push(w);
  });

  const sortedKeys = Object.keys(groups).sort((a,b) => b.localeCompare(a));

  const groupElements = sortedKeys.map(key => (
    <div key={key}>
      <div className="px-3 py-2 bg-zinc-800/70 rounded-xl mb-3 font-semibold text-zinc-100">{formatMonth(key + '-01')}</div>
      <div className="space-y-3">
        {groups[key].map(workout => (
          <div key={workout.id} className="bg-zinc-800 rounded-2xl p-4 border border-zinc-800 hover:border-zinc-700 transition">
            <div className="flex justify-end mb-2">
              <button onClick={() => onDeleteWorkout && onDeleteWorkout(workout.id)} className="text-red-400 text-sm">Delete</button>
            </div>
            <div onClick={() => onViewWorkoutDetail(workout.date)} className="cursor-pointer">
              <div className="flex justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-lg">{workout.name}</h3>
                  <p className="text-xs text-zinc-400">
                    {formatDate(workout.date)} • {workout.duration || 0} min
                  </p>
                </div>
                <ChevronRight className="text-zinc-500" size={20} />
              </div>
              <div className="text-sm text-zinc-300">
                {workout.exercises?.slice(0, 2).map((ex, i) => (
                  <span key={i}>
                    {ex.name}
                    {i < 1 && workout.exercises.length > 1 ? ' • ' : ''}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  ));

  return (
    <div className="min-h-screen bg-zinc-900 text-white pb-24">
      <div className="bg-zinc-800 p-4 mb-6">
        <h1 className="text-2xl font-bold">History</h1>
      </div>
      <div className="p-6 space-y-4">
        {workouts.length === 0 ? (
          <p className="text-center text-zinc-400 mt-10">Brak treningów</p>
        ) : (
          groupElements
        )}
      </div>
    </div>
  );
};