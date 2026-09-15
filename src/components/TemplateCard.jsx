import React from 'react';
import { Edit2, Trash2, Play, Copy } from 'lucide-react';

/**
 * Memoized template card component (Training 3.0 visual language).
 * Only re-renders if template data actually changes.
 *
 * Start semantics (unchanged): `onSelect` is the legacy start/select entry
 * used by SelectTemplateView. `onStart` is the explicit start entry used by
 * TemplatesView so the blueprint list offers PLAN → START without routing
 * through a second screen. When both are provided, `onStart` wins.
 */
export const TemplateCard = React.memo(({
  template,
  onSelect,
  onStart,
  onEdit,
  onDelete,
  onDuplicate
}) => {
  const exercises = template?.exercises ?? [];
  const totalSets = exercises.reduce((n, ex) => n + ((ex?.sets ?? []).length), 0);
  const plansCount = Array.isArray(template?.plans) ? template.plans.length : 0;
  const startHandler = onStart ?? onSelect;

  return (
    <div className="ui-surface-secondary p-4 text-left transition-all group ui-card-mount-anim ui-template-card-lift">
      <button
        onClick={() => startHandler && startHandler(template)}
        className="w-full text-left hover:opacity-90 transition rounded-lg"
        aria-label={startHandler ? `Start workout from ${template.name}` : template.name}
      >
        <h3 className="ui-card-title text-base truncate group-hover:accent-text transition">{template.name}</h3>
        <p className="ui-secondary mt-1">
          {exercises.length} exercise{exercises.length === 1 ? '' : 's'}
          {' · '}{totalSets} set{totalSets === 1 ? '' : 's'}
          {plansCount > 0 && ` · ${plansCount} plan${plansCount === 1 ? '' : 's'}`}
        </p>
        {exercises.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5" aria-hidden="true">
            {exercises.slice(0, 3).map((ex, i) => (
              <span key={`${template.id}-${ex.exerciseId ?? ex.name}-${i}`} className="ui-surface-sub text-[11px] px-2.5 py-1 font-semibold text-slate-300 truncate max-w-[140px]">
                {ex.name}
              </span>
            ))}
            {exercises.length > 3 && (
              <span className="text-[11px] text-slate-500 px-2 py-1 font-semibold">+{exercises.length - 3}</span>
            )}
          </div>
        )}
      </button>
      <div className="mt-3 flex gap-2">
        {startHandler && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              startHandler(template);
            }}
            className="ui-cta-primary flex-1 min-h-[44px] px-3 font-bold text-sm flex items-center justify-center gap-2 ui-press"
            title="Start workout from this template"
            aria-label={`Start workout from ${template.name}`}
          >
            <Play size={16} aria-hidden="true" />
            <span>Start</span>
          </button>
        )}
        {onEdit && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(template);
            }}
            className="ui-action-secondary min-w-[44px] min-h-[44px] flex items-center justify-center accent-text"
            title="Edit"
            aria-label={`Edit template ${template.name}`}
          >
            <Edit2 size={16} aria-hidden="true" />
          </button>
        )}
        {onDuplicate && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate(template);
            }}
            className="ui-action-secondary min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-300"
            title="Duplicate template"
            aria-label={`Duplicate template ${template.name}`}
          >
            <Copy size={16} aria-hidden="true" />
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(template.id);
            }}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-[12px] bg-red-500/10 border border-red-500/30 text-red-300 hover:bg-red-500/20 transition ui-press"
            title="Delete"
            aria-label={`Delete template ${template.name}`}
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Re-render when identity, name, order or set config changes (order-only
  // edits must repaint — length alone is not enough).
  if (prevProps.template.id !== nextProps.template.id) return false;
  if (prevProps.template.name !== nextProps.template.name) return false;
  const a = prevProps.template.exercises || [];
  const b = nextProps.template.exercises || [];
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if ((a[i]?.exerciseId ?? a[i]?.name) !== (b[i]?.exerciseId ?? b[i]?.name)) return false;
    if ((a[i]?.sets || []).length !== (b[i]?.sets || []).length) return false;
    if ((a[i]?.supersetId || null) !== (b[i]?.supersetId || null)) return false;
  }
  const pa = Array.isArray(prevProps.template.plans) ? prevProps.template.plans.length : 0;
  const pb = Array.isArray(nextProps.template.plans) ? nextProps.template.plans.length : 0;
  if (pa !== pb) return false;
  return true;
});

TemplateCard.displayName = 'TemplateCard';
