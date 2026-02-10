import React from 'react';
import { ChevronRight, Trash2, Edit2, Medal } from 'lucide-react';
import { formatDate, calculateTotalVolume } from '../domain/calculations';

/**
 * Memoized workout card component
 * Only re-renders if props actually change, not when parent re-renders
 */
export const WorkoutCard = React.memo(({
  workout,
  onViewDetail,
  onDelete,
  onEdit,
  showActions = true,
  exercisesDB = [],
  getRecordsFn = null
}) => {
  return (
    <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-lg p-4 hover:from-slate-800/60 hover:to-slate-900/60 hover:border-slate-600/50 transition-all ui-card-mount-anim">
      <div className="flex justify-end gap-2 mb-3">
        {showActions && (
          <>
            {onEdit && (
              <button 
                onClick={() => onEdit(workout)}
                className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg text-blue-400 text-xs font-bold transition flex items-center gap-1"
              >
                <Edit2 size={12} /> Edit
              </button>
            )}
            {onDelete && (
              <button 
                onClick={() => onDelete(workout.id)}
                className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded-lg text-red-400 text-xs font-bold transition flex items-center gap-1"
              >
                <Trash2 size={12} /> Delete
              </button>
            )}
          </>
        )}
      </div>
      <div onClick={() => onViewDetail && onViewDetail(workout.date)} className="cursor-pointer hover:opacity-80 transition">
        <div className="flex justify-between items-start mb-3 gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-black text-lg text-white">{workout.name}</h3>
            <p className="text-xs text-slate-400 mt-1 font-semibold">
              {formatDate(workout.date)} • {workout.duration || 0} min
            </p>
          </div>
          <ChevronRight className="text-slate-600" size={20} />
        </div>
        
        {/* Exercises with volume and PR count */}
        <div className="space-y-1.5 mb-3">
          {workout.exercises?.slice(0, 4).map((ex, i) => {
            const volume = calculateTotalVolume(ex.sets || []);
            const prCount = getRecordsFn && ex.exerciseId ? getRecordsFn(ex.exerciseId, ex).prCount || 0 : 0;
            
            return (
              <div key={`${workout.id}-${ex.exerciseId}-${i}`} className="flex items-center justify-between text-xs bg-slate-700/30 text-slate-300 px-2.5 py-1.5 rounded-lg font-semibold">
                <span className="truncate flex-1">{ex.name}</span>
                <div className="flex items-center gap-2 ml-2 whitespace-nowrap">
                  {volume > 0 && <span className="text-slate-400">{(volume / 1000).toFixed(1)}k</span>}
                  {prCount > 0 && (
                    <span className="flex items-center gap-1 text-amber-400">
                      <Medal size={12} />
                      {prCount}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {workout.exercises && workout.exercises.length > 4 && (
            <div className="text-xs text-slate-500 px-2.5 py-1">
              +{workout.exercises.length - 4} more
            </div>
          )}
        </div>

        {/* Tags */}
        {workout.tags && workout.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {workout.tags.map(tag => (
              <span 
                key={tag}
                className="text-xs px-2 py-1 rounded-full font-bold bg-blue-600/20 text-blue-400 border border-blue-500/30"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if workout data actually changed
  // or if callbacks changed (which means parent re-rendered intentionally)
  return (
    prevProps.workout.id === nextProps.workout.id &&
    prevProps.workout.name === nextProps.workout.name &&
    prevProps.workout.date === nextProps.workout.date &&
    prevProps.workout.duration === nextProps.workout.duration &&
    prevProps.workout.exercises?.length === nextProps.workout.exercises?.length &&
    prevProps.showActions === nextProps.showActions
  );
});

WorkoutCard.displayName = 'WorkoutCard';
