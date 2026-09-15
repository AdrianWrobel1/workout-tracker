import React from 'react';
import { Edit2, Trash2, Star } from 'lucide-react';

/**
 * Memoized exercise card component
 * Only re-renders if exercise data actually changes
 */
export const ExerciseCard = React.memo(({
  exercise,
  onViewDetail,
  onEditExercise,
  onDeleteExercise,
  onToggleFavorite
}) => {
  return (
    <div
      onClick={() => onViewDetail && onViewDetail(exercise.id)}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && onViewDetail) {
          e.preventDefault();
          onViewDetail(exercise.id);
        }
      }}
      role={onViewDetail ? 'button' : undefined}
      tabIndex={onViewDetail ? 0 : undefined}
      aria-label={onViewDetail ? `View details for ${exercise.name}` : undefined}
      className="ui-surface-secondary p-4 cursor-pointer hover:border-slate-500/40 transition-all group ui-card-mount-anim"
    >
      <div className="flex justify-between items-start gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="ui-card-title text-base truncate group-hover:accent-text transition">{exercise.name}</h3>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {exercise.category && (
              <span className="text-[11px] ui-active-pill px-2.5 py-1 font-bold">
                {exercise.category}
              </span>
            )}
            {exercise.muscles && exercise.muscles.length > 0 && (
              exercise.muscles.map((muscle) => (
                <span key={`${exercise.id}-${muscle}`} className="text-[11px] ui-surface-sub px-2.5 py-1 font-semibold text-slate-300">
                  {muscle}
                </span>
              ))
            )}
          </div>
        </div>
        <div className="flex gap-1.5 shrink-0">
          {onToggleFavorite && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(exercise.id); }}
              aria-label={exercise.isFavorite ? `Remove ${exercise.name} from favorites` : `Add ${exercise.name} to favorites`}
              aria-pressed={Boolean(exercise.isFavorite)}
              className={`min-w-[44px] min-h-[44px] flex items-center justify-center border rounded-[12px] transition ${exercise.isFavorite ? 'bg-yellow-500/15 border-yellow-500/40 text-yellow-300' : 'bg-slate-700/20 hover:bg-slate-700/30 border-slate-600/40 text-slate-400'}`}
              title={exercise.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Star size={16} fill={exercise.isFavorite ? 'currentColor' : 'none'} aria-hidden="true" />
            </button>
          )}
          {onEditExercise && (
            <button
              onClick={(e) => { e.stopPropagation(); onEditExercise(exercise); }}
              aria-label={`Edit ${exercise.name}`}
              className="ui-action-secondary min-w-[44px] min-h-[44px] flex items-center justify-center accent-text"
              title="Edit"
            >
              <Edit2 size={16} aria-hidden="true" />
            </button>
          )}
          {onDeleteExercise && (
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteExercise(exercise.id); }}
              aria-label={`Delete ${exercise.name}`}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-[12px] bg-red-500/10 border border-red-500/30 text-red-300/90 hover:bg-red-500/20 transition"
              title="Delete"
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Re-render only if exercise data changed
  return (
    prevProps.exercise.id === nextProps.exercise.id &&
    prevProps.exercise.name === nextProps.exercise.name &&
    prevProps.exercise.category === nextProps.exercise.category &&
    JSON.stringify(prevProps.exercise.muscles) === JSON.stringify(nextProps.exercise.muscles) &&
    prevProps.exercise.isFavorite === nextProps.exercise.isFavorite
  );
});

ExerciseCard.displayName = 'ExerciseCard';
