import React from 'react';
import { Edit2, Trash2 } from 'lucide-react';

/**
 * Memoized exercise card component
 * Only re-renders if exercise data actually changes
 */
export const ExerciseCard = React.memo(({
  exercise,
  onViewDetail,
  onEditExercise,
  onDeleteExercise
}) => {
  return (
    <div
      onClick={() => onViewDetail && onViewDetail(exercise.id)}
      className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-xl p-4 cursor-pointer hover:from-slate-800/60 hover:to-slate-900/60 hover:border-slate-600/70 transition-all group ui-card-mount-anim"
    >
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-black text-lg text-white group-hover:text-blue-400 transition">{exercise.name}</h3>
          <div className="flex flex-wrap gap-2 mt-2">
            {exercise.category && (
              <span className="text-xs bg-blue-500/20 text-blue-400 px-2.5 py-1 rounded-full border border-blue-500/30 font-semibold">
                {exercise.category}
              </span>
            )}
            {exercise.muscles && exercise.muscles.length > 0 && (
              exercise.muscles.map((muscle) => (
                <span key={`${exercise.id}-${muscle}`} className="text-xs bg-slate-700/50 text-slate-300 px-2.5 py-1 rounded-full border border-slate-600/50 font-semibold">
                  {muscle}
                </span>
              ))
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {onEditExercise && (
            <button
              onClick={(e) => { e.stopPropagation(); onEditExercise(exercise); }}
              className="p-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg text-blue-400 transition"
              title="Edit"
            >
              <Edit2 size={16} />
            </button>
          )}
          {onDeleteExercise && (
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteExercise(exercise.id); }}
              className="p-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded-lg text-red-400 transition"
              title="Delete"
            >
              <Trash2 size={16} />
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
    JSON.stringify(prevProps.exercise.muscles) === JSON.stringify(nextProps.exercise.muscles)
  );
});

ExerciseCard.displayName = 'ExerciseCard';
