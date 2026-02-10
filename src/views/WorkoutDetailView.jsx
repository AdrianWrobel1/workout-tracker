import React from 'react';
import { ChevronLeft, Clock, FileText } from 'lucide-react';
import { formatDate, calculate1RM } from '../domain/calculations';

export const WorkoutDetailView = ({ selectedDate, workouts, onBack, exercisesDB = [] }) => {
  const dateWorkouts = workouts.filter(w => w.date === selectedDate);

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Header */}
      <div className="bg-gradient-to-b from-black to-black/80 border-b border-white/10 p-4 flex items-center gap-4 sticky top-0 z-20 shadow-2xl">
        <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg transition">
          <ChevronLeft size={24} />
        </button>
        <div>
          <p className="text-xs text-slate-400 font-semibold tracking-widest">WORKOUT DETAILS</p>
          <h1 className="text-2xl font-black">{formatDate(selectedDate)}</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {dateWorkouts.map(workout => (
          <div key={workout.id} className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-xl p-5 ui-card-mount-anim">
            {/* Workout Header */}
            <div className="flex justify-between items-start gap-4 mb-4 pb-4 border-b border-slate-700/50">
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-black text-white">{workout.name}</h2>
                <p className="text-sm text-slate-400 flex items-center gap-2 mt-2 font-semibold">
                  <Clock size={14} /> {workout.duration || 0} min
                </p>
              </div>
            </div>

            {/* Workout Tags */}
            {workout.tags && workout.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {workout.tags.map(tag => (
                  <span 
                    key={tag}
                    className="text-xs px-2.5 py-1 rounded-full font-bold bg-blue-600/20 text-blue-400 border border-blue-500/30"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Workout Note */}
            {workout.note && (
              <div className="mb-4 bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-lg text-sm text-amber-200 italic flex gap-3">
                <FileText size={16} className="shrink-0 mt-0.5 text-amber-400" />
                <span>{workout.note}</span>
              </div>
            )}

            {/* Exercises */}
            <div className="space-y-4">
              {workout.exercises?.map((ex, i) => {
                const completedSets = (ex.sets || []).filter(s => s.completed);
                if (completedSets.length === 0) return null;
                
                return (
                  <div key={ex.exerciseId || `ex-${i}`} className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4">
                    <div className="mb-3">
                      <h3 className="text-lg font-black text-white">{ex.name}</h3>
                      <p className="text-xs text-slate-400 mt-1 font-semibold">{ex.category}</p>
                      {(() => {
                        const exFromDB = exercisesDB?.find(e => e.id === ex.exerciseId);
                        return exFromDB?.note && (
                          <div className="mt-2 text-xs bg-blue-500/10 border border-blue-500/30 text-blue-300 px-2 py-1 rounded">
                            {exFromDB.note}
                          </div>
                        );
                      })()}
                    </div>
                    <div className="space-y-2.5">
                      {completedSets.map((set, j) => (
                        <div key={`${ex.exerciseId}-${j}-${set.kg}-${set.reps}`} className={`flex items-center gap-3 p-2 rounded-lg border transition-all ${
                          set.warmup 
                            ? 'bg-amber-500/10 border-amber-500/30' 
                            : 'bg-slate-900/40 border-slate-700/50'
                        }`}>
                          {set.warmup && (
                            <div className="px-2 py-0.5 bg-amber-600/30 border border-amber-500/50 rounded text-xs font-bold text-amber-300">
                              WARMUP
                            </div>
                          )}
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black min-w-[2rem] ${
                            set.warmup
                              ? 'bg-amber-600/20 text-amber-400 border border-amber-500/30'
                              : 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                          }`}>
                            {set.warmup ? '◐' : `#${j + 1}`}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-white">
                              {set.kg} <span className="text-slate-400 font-normal">kg</span> × {set.reps}
                            </p>
                          </div>
                          <div className="text-right min-w-fit">
                            <p className="text-xs text-slate-400 font-semibold">1RM</p>
                            <p className="text-sm font-black text-blue-400">
                              {calculate1RM(set.kg, set.reps)} kg
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};