import React, { useState, useRef } from 'react';
import { Trash2, Medal } from 'lucide-react';
import { isWarmupSet, resolveSetType } from '../domain/workoutExtensions';

/**
 * OPTIMIZED: Memoized exercise card for active workouts
 * Only re-renders if exercise data or critical handlers change
 */
export const ActiveWorkoutExerciseCard = React.memo(({
  exercise,
  exerciseIndex,
  previousSets = [],
  onUpdateSet,
  onToggleSet,
  onAddSet,
  onDeleteSet,
  onSetSetType,
  deleteModeActive = false,
  warmupModeActive = false,
}) => {
  const [swipedIndex, setSwipedIndex] = useState(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  
  const handleTouchMove = (e, setIndex) => {
    if (!touchStartX.current) return;
    
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const dx = currentX - touchStartX.current;
    const dy = currentY - touchStartY.current;
    
    // Only handle horizontal swipe, not vertical scroll
    if (Math.abs(dy) > Math.abs(dx)) return;
    
    // Swipe left to reveal delete
    if (dx < -30) {
      setSwipedIndex(setIndex);
    } else if (dx > 10) {
      setSwipedIndex(null);
    }
  };
  
  const handleTouchEnd = () => {
    touchStartX.current = 0;
    touchStartY.current = 0;
  };
  
  const setTypeTone = (set) => {
    const type = resolveSetType(set);
    if (type === 'warmup') return 'bg-amber-600 border-amber-500 text-white shadow-lg shadow-amber-600/50';
    if (type === 'drop') return 'bg-violet-600/80 border-violet-500 text-white';
    if (type === 'failure') return 'bg-rose-600/80 border-rose-500 text-white';
    if (type === 'tempo') return 'bg-cyan-600/80 border-cyan-500 text-white';
    if (type === 'pause') return 'bg-indigo-600/80 border-indigo-500 text-white';
    return 'bg-slate-700/50 border-slate-600/50 text-slate-300';
  };

  const setTypeCardTone = (set) => {
    const type = resolveSetType(set);
    if (type === 'warmup') return 'bg-amber-500/10 border-amber-500/30';
    if (type === 'drop') return 'bg-violet-500/10 border-violet-500/30';
    if (type === 'failure') return 'bg-rose-500/10 border-rose-500/30';
    if (type === 'tempo') return 'bg-cyan-500/10 border-cyan-500/30';
    if (type === 'pause') return 'bg-indigo-500/10 border-indigo-500/30';
    return 'bg-slate-700/20 border-slate-600/30';
  };

  const completedTone = (set) => {
    if (!set?.completed) return '';
    const type = resolveSetType(set);
    if (type === 'work') return 'bg-emerald-500/10 border-emerald-500/30';
    // Keep set-type color for non-work sets when completed
    return 'ring-1 ring-white/5';
  };

  return (
    <div>
      <div className="space-y-2">
        {exercise.sets.map((set, i) => {
          const prev = previousSets && previousSets.length > i ? previousSets[i] : null;
          const nonWarmupBefore = exercise.sets.slice(0, i).filter(s => !isWarmupSet(s)).length;
          const displayLabel = isWarmupSet(set) ? '#0' : `#${nonWarmupBefore + 1}`;
          const isSwipped = swipedIndex === i;
          const isPRSet = Boolean(set.completed && (set.isBest1RM || set.isBestSetVolume || set.isHeaviestWeight));
          
          return (
            <div
              key={i}
              className="relative overflow-hidden rounded-lg"
              onTouchStart={(e) => handleTouchStart(e)}
              onTouchMove={(e) => handleTouchMove(e, i)}
              onTouchEnd={handleTouchEnd}
            >
              {/* Delete button background (revealed on swipe) */}
              {isSwipped && (
                <button
                  onClick={() => {
                    onDeleteSet(exerciseIndex, i);
                    setSwipedIndex(null);
                  }}
                  className="absolute inset-0 bg-red-500 flex items-center justify-center text-white font-bold px-4 z-0"
                >
                  <Trash2 size={20} />
                </button>
              )}
              
              {/* Set card (slides on swipe) */}
              <div
                className={`flex items-center gap-3 p-4 rounded-lg border transition-transform duration-300 ease-out relative z-10 ${
                  isSwipped ? '-translate-x-full' : ''
                } ${setTypeCardTone(set)} ${completedTone(set)} ${
                isPRSet
                  ? 'bg-yellow-500/30 border-yellow-500/50 ring-2 ring-yellow-500/30' 
                  : (set.isBest1RM || set.isBestSetVolume || set.isHeaviestWeight) 
                  ? 'bg-emerald-500/20 border-emerald-500/40' 
                  : ''
              } ${isPRSet ? 'ui-set-done-pr' : set.completed ? 'ui-set-done' : 'ui-set-planned'}`}
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
                  className={`bg-slate-800/50 border border-slate-600/50 rounded-lg px-4 py-2 text-center text-sm font-bold w-full focus:border-accent focus:outline-none focus:accent-ring transition ${
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
                  className={`bg-slate-800/50 border border-slate-600/50 rounded-lg px-4 py-2 text-center text-sm font-bold w-full focus:border-accent focus:outline-none focus:accent-ring transition ${
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

              {/* Set Type Selector */}
              {warmupModeActive && (
                <select
                  value={resolveSetType(set)}
                  onChange={(event) => onSetSetType && onSetSetType(exerciseIndex, i, event.target.value)}
                  className={`min-w-20 h-10 px-2 rounded-lg font-bold text-[10px] tracking-wide transition-all border bg-slate-900/70 focus:outline-none ${setTypeTone(set)}`}
                >
                  <option value="work">Work</option>
                  <option value="warmup">Warm-up</option>
                  <option value="drop">Drop</option>
                  <option value="failure">Failure</option>
                  <option value="tempo">Tempo</option>
                  <option value="pause">Pause</option>
                </select>
              )}

              {/* Delete Set - OLD MODE (kept for backward compatibility if deleteModeActive is passed) */}
              {deleteModeActive && !isSwipped && (
                <button
                  onClick={() => onDeleteSet && onDeleteSet(exerciseIndex, i)}
                  className="w-10 h-10 rounded-lg flex items-center justify-center bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition"
                >
                  <Trash2 size={16} />
                </button>
              )}
              </div>
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
});

ActiveWorkoutExerciseCard.displayName = 'ActiveWorkoutExerciseCard';
