import React from 'react';
import { Edit2, Trash2, Play } from 'lucide-react';

/**
 * Memoized template card component
 * Only re-renders if template data actually changes
 */
export const TemplateCard = React.memo(({
  template,
  onSelect,
  onEdit,
  onDelete
}) => {
  return (
    <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 hover:from-slate-800/60 hover:to-slate-900/60 hover:border-slate-600/50 p-4 rounded-xl text-left flex items-start justify-between transition-all group ui-card-mount-anim">
      <button
        onClick={() => onSelect && onSelect(template)}
        className="flex-1 text-left hover:opacity-80 transition"
      >
        <h3 className="font-black text-lg text-white group-hover:text-blue-400 transition mb-1">{template.name}</h3>
        <p className="text-xs text-slate-500 font-semibold">{template.exercises.length} exercises</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {template.exercises.slice(0, 3).map((ex, i) => (
            <span key={`${template.id}-${ex.exerciseId}-${i}`} className="text-[11px] bg-slate-800/60 px-2.5 py-1 rounded-full text-slate-400 font-semibold">
              {ex.name}
            </span>
          ))}
          {template.exercises.length > 3 && (
            <span className="text-[11px] text-slate-600 px-2.5 py-1 font-semibold">+{template.exercises.length - 3}</span>
          )}
        </div>
      </button>
      <div className="flex gap-2 ml-3">
        {onSelect && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect(template);
            }}
            className="p-2 bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 rounded-lg text-green-400 transition"
            title="Use Template"
          >
            <Play size={16} />
          </button>
        )}
        {onEdit && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(template);
            }}
            className="p-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg text-blue-400 transition"
            title="Edit"
          >
            <Edit2 size={16} />
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(template.id);
            }}
            className="p-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded-lg text-red-400 transition"
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Re-render only if template data changed
  return (
    prevProps.template.id === nextProps.template.id &&
    prevProps.template.name === nextProps.template.name &&
    prevProps.template.exercises?.length === nextProps.template.exercises?.length
  );
});

TemplateCard.displayName = 'TemplateCard';
