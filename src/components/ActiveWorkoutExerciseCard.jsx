import React, { useRef } from 'react';
import { Trash2, Medal } from 'lucide-react';

export const ActiveWorkoutExerciseCard = ({
  exercise,
  exerciseIndex,
  previousSets = [],
  onUpdateSet,
  onToggleSet,
  onAddSet,
  onDeleteSet,
  onToggleWarmup,
  deleteModeActive = false,
  warmupModeActive = false,
  // optional: called on long-press (exerciseIndex, setIndex)
  onLongPressSet
}) => {
  return (
    <div>
      <div className="space-y-2">
        {exercise.sets.map((set, i) => {
          const prev = previousSets && previousSets.length > i ? previousSets[i] : null;
          const nonWarmupBefore = exercise.sets.slice(0, i).filter(s => !s.warmup).length;
          const displayLabel = set.warmup ? '#0' : `#${nonWarmupBefore + 1}`;
          
          return (
            <div
              key={i}
              data-set-index={i}
              className={`flex items-center gap-3 p-4 rounded-lg border transition-all ${
                set.warmup
                  ? 'bg-amber-500/10 border-amber-500/30'
                  : 'bg-slate-700/20 border-slate-600/30'
              } ${set.completed ? 'bg-emerald-500/10 border-emerald-500/30' : ''} ${
                set.completed && (set.isBest1RM || set.isBestSetVolume || set.isHeaviestWeight) 
                  ? 'bg-yellow-500/30 border-yellow-500/50 ring-2 ring-yellow-500/30 animate-pr-bounce' 
                  : (set.isBest1RM || set.isBestSetVolume || set.isHeaviestWeight) 
                  ? 'bg-emerald-500/20 border-emerald-500/40' 
                  : ''
              }`}
            >
              {/* Medal Icon for PR Sets */}
              {(set.isBest1RM || set.isBestSetVolume || set.isHeaviestWeight) && (
                <div className="text-yellow-400 flex-shrink-0" title={
                  [
                    set.isHeaviestWeight && 'Heaviest Weight',
                    set.isBestSetVolume && 'Best Set Volume',
                    set.isBest1RM && 'Best 1RM'
                  ].filter(Boolean).join(', ')
                }>
                  <Medal size={20} />
                </div>
              )}

              {/* Set Label */}
              <div className="font-black text-white min-w-[2rem]">{displayLabel}</div>

              {/* Weight Input */}
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">KG</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={set.kg === 0 || set.kg === undefined || set.kg === "" ? "" : set.kg}
                  onChange={(e) => onUpdateSet(exerciseIndex, i, 'kg', Number(e.target.value) || 0)}
                  placeholder={set.suggestedKg ? `${set.suggestedKg}` : (prev?.kg ? `${prev.kg}` : '0')}
                  className={`bg-slate-800/50 border border-slate-600/50 rounded-lg px-4 py-2 text-center text-sm font-bold w-full focus:border-blue-500 focus:outline-none transition ${
                    (set.kg === 0 || set.kg === undefined || set.kg === "") && !set.completed ? 'text-slate-500 placeholder-slate-600' : 'text-white'
                  } ${set.completed ? 'text-white' : ''}`}
                />
              </div>

              {/* Reps Input */}
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">REPS</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={set.reps === 0 || set.reps === undefined || set.reps === "" ? "" : set.reps}
                  onChange={(e) => onUpdateSet(exerciseIndex, i, 'reps', Number(e.target.value) || 0)}
                  placeholder={set.suggestedReps ? `${set.suggestedReps}` : (prev?.reps ? `${prev.reps}` : '0')}
                  className={`bg-slate-800/50 border border-slate-600/50 rounded-lg px-4 py-2 text-center text-sm font-bold w-full focus:border-blue-500 focus:outline-none transition ${
                    (set.reps === 0 || set.reps === undefined || set.reps === "") && !set.completed ? 'text-slate-500 placeholder-slate-600' : 'text-white'
                  } ${set.completed ? 'text-white' : ''}`}
                />
              </div>

              {/* Previous Set Reference */}
              {prev && (
                <div className="flex flex-col gap-1 min-w-[70px]">
                  <label className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">PREV</label>
                  <div className="text-xs font-bold text-slate-400 px-2.5 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-center opacity-75">
                    {prev.kg}×{prev.reps}
                  </div>
                </div>
              )}

              {/* Complete Toggle */}
              <button
                onClick={() => {
                  // Haptic feedback
                  if (navigator.vibrate) {
                    navigator.vibrate([10, 5, 10]);
                  }
                  onToggleSet(exerciseIndex, i);
                }}
                className={`w-10 h-10 rounded-lg font-bold transition-all flex items-center justify-center border ${
                  set.completed
                    ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-600/50 scale-105'
                    : 'bg-slate-700/50 border-slate-600/50 text-slate-400 hover:bg-slate-600/50'
                } ui-press`}
              >
                {set.completed ? '✓' : '○'}
              </button>

              {/* Warmup Toggle */}
              {warmupModeActive && (
                <button
                  onClick={() => onToggleWarmup && onToggleWarmup(exerciseIndex, i)}
                  className={`w-10 h-10 rounded-lg font-bold text-xs transition-all border ${
                    set.warmup
                      ? 'bg-amber-600 border-amber-500 text-white shadow-lg shadow-amber-600/50'
                      : 'bg-slate-700/50 border-slate-600/50 text-slate-400 hover:bg-slate-600/50'
                  }`}
                >
                  W
                </button>
              )}

              {/* Delete Set */}
              {deleteModeActive && (
                <button
                  onClick={() => onDeleteSet && onDeleteSet(exerciseIndex, i)}
                  className="w-10 h-10 rounded-lg flex items-center justify-center bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          );
        })}

        {/* Add Set Button */}
        <button
          onClick={() => onAddSet(exerciseIndex)}
          className="w-full mt-3 py-2 font-bold text-sm border-2 border-dashed border-slate-600/50 hover:border-slate-500/50 text-slate-400 hover:text-slate-300 rounded-lg transition-all"
        >
          + Add set
        </button>
      </div>
    </div>
  );
};
