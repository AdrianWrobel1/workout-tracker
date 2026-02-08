import React, { useRef } from 'react';
import { Trash2 } from 'lucide-react';

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
  const touchRefs = useRef({});
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
              onTouchStart={(e) => {
                const t = e.touches[0];
                touchRefs.current[i] = { startX: t.clientX, startY: t.clientY, longPress: false };
                // long-press timer
                touchRefs.current[i].timer = setTimeout(() => {
                  touchRefs.current[i].longPress = true;
                  if (onLongPressSet) onLongPressSet(exerciseIndex, i);
                }, 500);
              }}
              onTouchMove={(e) => {
                const t = e.touches[0];
                const data = touchRefs.current[i];
                if (!data) return;
                const dx = t.clientX - data.startX;
                const dy = t.clientY - data.startY;
                if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
                  // cancel long press if moving
                  if (data.timer) { clearTimeout(data.timer); data.timer = null; }
                }
              }}
              onTouchEnd={(e) => {
                const data = touchRefs.current[i];
                if (!data) return;
                if (data.timer) { clearTimeout(data.timer); data.timer = null; }
                if (data.longPress) return; // handled by long press
                const endX = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientX : data.startX;
                const dx = endX - data.startX;
                const threshold = 50; // swipe threshold
                if (dx > threshold) {
                  // swipe right -> add new set (copying last)
                  if (onAddSet) onAddSet(exerciseIndex);
                } else if (dx < -threshold) {
                  // swipe left -> delete this set
                  if (onDeleteSet) onDeleteSet(exerciseIndex, i);
                }
              }}
              className={`flex items-center gap-3 p-4 rounded-lg border transition-all ${
                set.warmup
                  ? 'bg-amber-500/10 border-amber-500/30'
                  : 'bg-slate-700/20 border-slate-600/30'
              } ${set.completed ? 'bg-emerald-500/10 border-emerald-500/30' : ''}`}
            >
              {/* Set Label */}
              <div className="font-black text-white min-w-[2rem]">{displayLabel}</div>

              {/* Weight Input */}
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">KG</label>
                <input
                  type="number"
                  value={set.kg ?? 0}
                  onChange={e => onUpdateSet(exerciseIndex, i, 'kg', Number(e.target.value))}
                  className="bg-slate-800/50 border border-slate-600/50 rounded-lg px-4 py-2 text-center text-sm font-bold w-full focus:border-blue-500 focus:outline-none transition"
                />
              </div>

              {/* Reps Input */}
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">REPS</label>
                <input
                  type="number"
                  value={set.reps ?? 0}
                  onChange={e => onUpdateSet(exerciseIndex, i, 'reps', Number(e.target.value))}
                  className="bg-slate-800/50 border border-slate-600/50 rounded-lg px-4 py-2 text-center text-sm font-bold w-full focus:border-blue-500 focus:outline-none transition"
                />
              </div>

              {/* Previous Set Reference */}
              {prev && (
                <div className="flex flex-col gap-1 min-w-[70px]">
                  <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">PREV</label>
                  <div className="text-xs font-bold text-slate-300 px-2.5 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-center">
                    {prev.kg}×{prev.reps}
                  </div>
                </div>
              )}

              {/* Complete Toggle */}
              <button
                onClick={() => {
                  // Haptic feedback
                  if (navigator.vibrate) {
                    navigator.vibrate(10);
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
