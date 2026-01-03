import React from 'react';
import { ChevronLeft, Clock, FileText } from 'lucide-react';
import { formatDate, calculate1RM } from '../domain/calculations';

export const WorkoutDetailView = ({ selectedDate, workouts, onBack }) => {
  const dateWorkouts = workouts.filter(w => w.date === selectedDate);

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      <div className="bg-zinc-800 p-4 flex items-center gap-4 sticky top-0 z-10 shadow-md">
        <button onClick={onBack}>
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">{formatDate(selectedDate)}</h1>
      </div>
      <div className="p-6 space-y-4 pb-24">
        {dateWorkouts.map(workout => (
          <div key={workout.id} className="bg-zinc-800 rounded-2xl p-5 border border-zinc-700">
            <div className="flex justify-between mb-4 border-b border-zinc-700 pb-3">
              <div>
                <h2 className="text-2xl font-bold text-white">{workout.name}</h2>
                <p className="text-sm text-zinc-400 flex items-center gap-2 mt-1">
                  <Clock size={14} /> {workout.duration || 0} min
                </p>
              </div>
            </div>

            {workout.note && (
              <div className="mb-4 bg-zinc-900/50 p-3 rounded-lg text-sm text-zinc-300 italic flex gap-2">
                <FileText size={16} className="shrink-0 mt-0.5" />
                {workout.note}
              </div>
            )}

            {workout.exercises?.map((ex, i) => (
              <div key={i} className="mb-4 last:mb-0">
                <h3 className="text-lg font-semibold text-rose-400 mb-2">{ex.name}</h3>
                <div className="space-y-1.5 text-sm">
                  {ex.sets.map((set, j) => (
                    <div key={j} className="flex gap-3 text-zinc-300 items-center">
                      <div
                        className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold
                          ${set.completed ? 'bg-emerald-500/20 text-emerald-500' : 'bg-zinc-700 text-zinc-500'}`}
                      >
                        {j + 1}
                      </div>
                      <span className={set.completed ? 'text-white' : 'text-zinc-500'}>
                        {set.kg} kg × {set.reps}
                      </span>
                      {set.completed && (
                        <span className="text-xs text-zinc-500 ml-auto">
                          1RM: {calculate1RM(set.kg, set.reps)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};