import React from 'react';

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
  warmupModeActive = false
}) => {
  return (
    <div className="bg-zinc-800 rounded-2xl p-4 mb-4 border border-zinc-700 shadow-sm">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-bold text-lg leading-tight">{exercise.name}</h3>
          {exercise.category && <div className="text-xs text-zinc-400">{exercise.category}</div>}
        </div>

        <div />
      </div>

      <div className="space-y-3">
        {exercise.sets.map((set, i) => {
          const prev = previousSets && previousSets.length > i ? previousSets[i] : null;
          // compute display index: warmup sets show #0, non-warmup are numbered sequentially
          const nonWarmupBefore = exercise.sets.slice(0, i).filter(s => !s.warmup).length;
          const displayLabel = set.warmup ? '#0' : `#${nonWarmupBefore + 1}`;
          return (
            <div key={i} className={`flex items-center gap-3 ${set.warmup ? 'bg-amber-900/20 p-2 rounded' : ''}`}>
              <div className="w-6 text-sm text-zinc-400">{displayLabel}</div>

              <input
                className="w-20 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-center text-sm"
                type="number"
                value={set.kg ?? 0}
                onChange={e => onUpdateSet(exerciseIndex, i, 'kg', Number(e.target.value))}
                aria-label={`Set ${i+1} weight`}
              />

              <input
                className="w-16 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-center text-sm"
                type="number"
                value={set.reps ?? 0}
                onChange={e => onUpdateSet(exerciseIndex, i, 'reps', Number(e.target.value))}
                aria-label={`Set ${i+1} reps`}
              />

              {/* Previous set badge placed between reps and toggle */}
              <div className="text-[12px] text-zinc-400 px-2 py-1 rounded bg-zinc-900/40">
                {prev ? `${prev.kg}kg × ${prev.reps}` : ''}
              </div>

              <button
                onClick={() => onToggleSet(exerciseIndex, i)}
                className={`ml-auto w-9 h-9 flex items-center justify-center rounded-lg border ${set.completed ? 'bg-emerald-600 border-emerald-700 text-white' : 'bg-transparent border-zinc-700 text-zinc-400'}`}
                aria-label={`Toggle set ${i+1}`}
              >
                {set.completed ? '✓' : '○'}
              </button>
              {warmupModeActive && (
                <button
                  onClick={() => onToggleWarmup && onToggleWarmup(exerciseIndex, i)}
                  className={`ml-2 w-9 h-9 flex items-center justify-center rounded-lg border ${set.warmup ? 'bg-amber-500 border-amber-600 text-black' : 'bg-transparent border-zinc-700 text-zinc-400'}`}
                  title="Toggle Warmup"
                >
                  W
                </button>
              )}
              {deleteModeActive && (
                <button
                  onClick={() => { if (confirm('Delete this set?')) onDeleteSet && onDeleteSet(exerciseIndex, i); }}
                  className="ml-2 w-9 h-9 flex items-center justify-center rounded-lg border bg-transparent border-zinc-700 text-zinc-400"
                  title="Delete set"
                >
                  🗑
                </button>
              )}
            </div>
          );
        })}

        <div className="pt-2">
          <button
            onClick={() => onAddSet(exerciseIndex)}
            className="text-sm font-semibold text-zinc-300 bg-zinc-900/40 px-3 py-2 rounded-lg border border-dashed border-zinc-700 hover:bg-zinc-900/60"
          >
            + Add set
          </button>
        </div>
      </div>
    </div>
  );
};
