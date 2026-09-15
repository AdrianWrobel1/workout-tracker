import React, { useMemo } from 'react';
import { ChevronRight, Trash2, Edit2, Medal } from 'lucide-react';
import { formatDate, calculateExerciseWorkVolume } from '../domain/calculations';
import {
  getWorkoutPreview,
  formatSessionDuration,
  formatCompactVolume,
} from '../domain/history';
import { PRBadge } from './analyticsUI';

const RELATIVE_LABEL = { today: 'Today', yesterday: 'Yesterday' };

/**
 * Memoized workout card component.
 * The summary line (duration · exercises · work sets · work volume) comes
 * from the canonical history preview (domain/history.js) — work sets and
 * work volume only; warm-ups never inflate the numbers.
 */
export const WorkoutCard = React.memo(({
  workout,
  onViewDetail,
  onDelete,
  onEdit,
  showActions = true,
  getRecordsFn = null,
  exercisesDB = [],
  userWeight = null,
  relative = null,
}) => {
  const preview = useMemo(
    () => getWorkoutPreview(workout, { exercisesDB, userWeight }),
    [workout, exercisesDB, userWeight]
  );
  const durationLabel = formatSessionDuration(preview.durationMin);

  const summaryBits = [];
  if (durationLabel) summaryBits.push(durationLabel);
  summaryBits.push(
    `${preview.exercisesCount} ${preview.exercisesCount === 1 ? 'exercise' : 'exercises'}`
  );
  summaryBits.push(
    `${preview.workSets} work ${preview.workSets === 1 ? 'set' : 'sets'}`
  );
  if (preview.workVolume > 0) {
    summaryBits.push(`${formatCompactVolume(preview.workVolume)} kg`);
  }

  return (
    <div className="ui-surface-secondary p-4 hover:border-slate-600/50 transition-all ui-card-mount-anim">
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest tabular-nums">
          {preview.validDate ? formatDate(workout.date) : 'Unknown date'}
          {relative && RELATIVE_LABEL[relative] && (
            <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider accent-bg-light accent-text accent-border-light">
              {RELATIVE_LABEL[relative]}
            </span>
          )}
        </p>
        {showActions && (
          <div className="flex gap-1 shrink-0 -mr-2 -mt-1">
            {onEdit && (
              <button
                onClick={() => onEdit(workout)}
                aria-label={`Edit ${workout.name || 'workout'}`}
                title="Edit"
                className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/5 transition"
              >
                <Edit2 size={14} />
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(workout.id)}
                aria-label={`Delete ${workout.name || 'workout'}`}
                title="Delete"
                className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      <div
        onClick={() => onViewDetail && onViewDetail(workout)}
        onKeyDown={(e) => {
          if (!onViewDetail) return;
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onViewDetail(workout); }
        }}
        role={onViewDetail ? 'button' : undefined}
        tabIndex={onViewDetail ? 0 : undefined}
        aria-label={onViewDetail ? `Open ${workout.name || 'workout'}, ${preview.validDate ? formatDate(workout.date) : 'unknown date'}` : undefined}
        className="cursor-pointer hover:opacity-90 transition rounded-lg"
      >
        <div className="flex justify-between items-center gap-3">
          <h3 className="font-black text-lg text-white truncate flex-1 min-w-0">{workout.name}</h3>
          <div className="flex items-center gap-2 shrink-0">
            {preview.prCount > 0 && <PRBadge count={preview.prCount} />}
            <ChevronRight className="text-slate-600" size={20} aria-hidden="true" />
          </div>
        </div>

        <p className="text-xs text-slate-400 font-semibold mt-1 tabular-nums" aria-label="Session summary">
          {summaryBits.join(' · ')}
        </p>

        {/* Exercises with volume and PR count */}
        <div className="space-y-1 mt-3">
          {workout.exercises?.slice(0, 4).map((ex, i) => {
            // CANONICAL: per-exercise WORK volume only (work sets, BW-aware) —
            // same semantics as the card header preview, never warmups.
            const def = Array.isArray(exercisesDB) ? exercisesDB.find(d => d && d.id === ex.exerciseId) : null;
            const volume = calculateExerciseWorkVolume(ex, {
              usesBodyweight: Boolean(def?.usesBodyweight),
              userWeight
            });
            const prCount = getRecordsFn && ex.exerciseId ? getRecordsFn(ex.exerciseId, ex).prCount || 0 : 0;

            return (
              <div key={`${workout.id}-${ex.exerciseId}-${i}`} className="flex items-center justify-between gap-2 text-xs bg-slate-800/40 px-2.5 py-1.5 rounded-lg font-semibold">
                <span className="truncate flex-1 text-slate-200">{ex.name}</span>
                <div className="flex items-center gap-2 ml-2 whitespace-nowrap tabular-nums">
                  {volume > 0 && <span className="text-slate-500">{(volume / 1000).toFixed(1)}k kg</span>}
                  {prCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-amber-400 font-bold">
                      <Medal size={11} aria-hidden="true" />
                      {prCount}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {workout.exercises && workout.exercises.length > 4 && (
            <div className="text-xs text-slate-500 px-2.5 py-1 font-semibold">
              +{workout.exercises.length - 4} more
            </div>
          )}
        </div>

        {/* Tags */}
        {workout.tags && workout.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {workout.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-2 py-1 rounded-full font-bold accent-bg-light accent-text accent-border-light"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

WorkoutCard.displayName = 'WorkoutCard';
