import React, { useState } from 'react';
import { X, Plus, ChevronUp, ChevronDown, ClipboardList } from 'lucide-react';
import { TemplateCard } from '../components/TemplateCard';
import { TemplatePlansEditor } from '../components/TemplatePlansEditor';
import { SET_TYPES, resolveSetType } from '../domain/workoutExtensions';

// TEMPLATE = reusable blueprint (targets/config only, never actuals).
// Rest/progression resolve from the exercise library + global settings at
// START time (DB-owned by design) — the builder intentionally edits only
// blueprint fields: name, exercise order, sets/order, kg/reps targets,
// warmup + set type, planNotes, superset links (preserved, edited in Active).

export const TemplatesView = ({
  templates,
  editingTemplate,
  exercisesDB = [],
  onClose,
  onCreateNew,
  onEdit,
  onDelete,
  onDuplicate,
  onStart,
  onSave,
  onChange,
  onAddExercise
}) => {
  const [showPlansEditor, setShowPlansEditor] = useState(false);

  const handleSavePlans = (updatedTemplate) => {
    onChange(updatedTemplate);
    setShowPlansEditor(false);
  };

  // --- immutable blueprint updates (never splice/mutate nested state) ---
  const removeExercise = (exIndex) => {
    onChange({
      ...editingTemplate,
      exercises: (editingTemplate.exercises || []).filter((_, i) => i !== exIndex)
    });
  };

  const moveExercise = (exIndex, delta) => {
    const list = [...(editingTemplate.exercises || [])];
    const to = exIndex + delta;
    if (to < 0 || to >= list.length) return;
    const [item] = list.splice(exIndex, 1);
    list.splice(to, 0, item);
    onChange({ ...editingTemplate, exercises: list });
  };

  const setPlanNotes = (exIndex, value) => {
    onChange({
      ...editingTemplate,
      exercises: (editingTemplate.exercises || []).map((ex, i) =>
        i === exIndex ? { ...ex, planNotes: value } : ex
      )
    });
  };

  const removeSet = (exIndex, sIndex) => {
    onChange({
      ...editingTemplate,
      exercises: (editingTemplate.exercises || []).map((ex, i) =>
        i === exIndex
          ? { ...ex, sets: (ex.sets || []).filter((_, si) => si !== sIndex) }
          : ex
      )
    });
  };

  const setSetField = (exIndex, sIndex, field, value) => {
    onChange({
      ...editingTemplate,
      exercises: (editingTemplate.exercises || []).map((ex, i) =>
        i === exIndex
          ? {
              ...ex,
              sets: (ex.sets || []).map((s, si) =>
                si === sIndex ? { ...s, [field]: value } : s
              )
            }
          : ex
      )
    });
  };

  const setSetWarmup = (exIndex, sIndex, warmup) => {
    onChange({
      ...editingTemplate,
      exercises: (editingTemplate.exercises || []).map((ex, i) =>
        i === exIndex
          ? {
              ...ex,
              sets: (ex.sets || []).map((s, si) =>
                si === sIndex
                  ? { ...s, warmup, setType: warmup ? 'warmup' : (resolveSetType(s) === 'warmup' ? 'work' : (s.setType || 'work')) }
                  : s
              )
            }
          : ex
      )
    });
  };

  const setSetType = (exIndex, sIndex, nextType) => {
    if (!SET_TYPES.includes(nextType)) return;
    onChange({
      ...editingTemplate,
      exercises: (editingTemplate.exercises || []).map((ex, i) =>
        i === exIndex
          ? {
              ...ex,
              sets: (ex.sets || []).map((s, si) =>
                si === sIndex
                  ? { ...s, setType: nextType, warmup: nextType === 'warmup' }
                  : s
              )
            }
          : ex
      )
    });
  };

  const addSet = (exIndex) => {
    onChange({
      ...editingTemplate,
      exercises: (editingTemplate.exercises || []).map((ex, i) => {
        if (i !== exIndex) return ex;
        const sets = ex.sets || [];
        const lastSet = sets.length > 0 ? sets[sets.length - 1] : null;
        // Copy target values (kg/reps/type) — never completed/PR/hint flags.
        const newSet = lastSet
          ? {
              kg: Number(lastSet.kg) || 0,
              reps: Number(lastSet.reps) || 0,
              warmup: Boolean(lastSet.warmup),
              setType: lastSet.setType || (lastSet.warmup ? 'warmup' : 'work'),
              rir: lastSet.rir ?? null,
              tempo: lastSet.tempo ?? null,
              pauseSec: lastSet.pauseSec ?? null
            }
          : { kg: 0, reps: 0, warmup: false, setType: 'work' };
        return { ...ex, sets: [...sets, newSet] };
      })
    });
  };

  const isStaleExercise = (exercise) => {
    if (exercise?.exerciseId == null) return false;
    if (!Array.isArray(exercisesDB) || exercisesDB.length === 0) return false;
    return !exercisesDB.some(d => d && d.id === exercise.exerciseId);
  };

  if (editingTemplate) {
    const plansCount = Array.isArray(editingTemplate.plans) ? editingTemplate.plans.length : 0;
    return (
      <div className="bg-black text-white pb-32">
        <div className="sticky top-0 z-30 bg-black/95 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center gap-2 shadow-lg">
          <button onClick={onClose} aria-label="Close template editor" className="p-2 hover:bg-white/10 rounded-lg transition text-slate-400 hover:text-white min-w-[44px] min-h-[44px] flex items-center justify-center">
            <X size={22} aria-hidden="true" />
          </button>
          <h1 className="ui-section-title flex-1 truncate">Edit template</h1>
          <button
            onClick={() => setShowPlansEditor(true)}
            className="ui-action-secondary px-3 min-h-[44px] font-bold text-sm flex items-center gap-1.5"
            title="Edit training plans"
            aria-label={`Edit training plans for this template${plansCount > 0 ? `, ${plansCount} plans` : ''}`}
          >
            <ClipboardList size={15} aria-hidden="true" />
            <span>Plans{plansCount > 0 ? ` · ${plansCount}` : ''}</span>
          </button>
          <button
            onClick={onSave}
            aria-label="Save template"
            className="ui-cta-primary px-4 min-h-[44px] font-bold text-sm ui-press"
          >
            Save
          </button>
        </div>

        <div className="p-4 space-y-5 max-w-2xl mx-auto">
          <section aria-label="Template name" className="ui-surface-secondary p-4">
            <p className="ui-micro">01 · Name</p>
            <label className="sr-only" htmlFor="template-name">Template name</label>
            <input
              id="template-name"
              type="text"
              value={editingTemplate.name}
              onChange={(e) => onChange({ ...editingTemplate, name: e.target.value })}
              placeholder="Template Name"
              aria-label="Template name"
              className="touch-input mt-2 w-full bg-slate-800/60 border border-slate-600/50 rounded-xl text-white font-bold focus:border-accent focus:outline-none focus:accent-ring transition"
            />
          </section>

          <section aria-label="Template exercises" className="space-y-3">
            <div className="ui-section-head">
              <p className="ui-micro">02 · Exercises · order</p>
              <p className="ui-secondary">{(editingTemplate.exercises || []).length} total</p>
            </div>
            {editingTemplate.exercises.length === 0 ? (
              <div className="ui-surface-secondary text-center py-10 px-4">
                <p className="ui-card-title">No exercises yet</p>
                <p className="ui-secondary mt-1">Add your first exercise to build this blueprint</p>
              </div>
            ) : (
              editingTemplate.exercises.map((exercise, exIndex) => (
                <section
                  key={`${exercise.exerciseId ?? exercise.name}-${exIndex}`}
                  aria-label={`Template exercise ${exIndex + 1}: ${exercise.name}`}
                  className="ui-surface-secondary p-4 space-y-3"
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      <span className="ui-step-badge mt-0.5 shrink-0" aria-hidden="true">{exIndex + 1}</span>
                      <div className="flex-1 min-w-0">
                        <h3 className="ui-card-title text-base truncate">{exercise.name}</h3>
                        <p className="ui-secondary mt-0.5">{exercise.category || 'Strength'} · {(exercise.sets || []).length} target set{(exercise.sets || []).length === 1 ? '' : 's'}</p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {exercise.supersetId && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-purple-600/20 border border-purple-500/30 text-purple-300">
                              Superset pair
                            </span>
                          )}
                          {isStaleExercise(exercise) && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-600/20 border border-amber-500/30 text-amber-300">
                              Missing from library — kept safely
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => moveExercise(exIndex, -1)}
                        disabled={exIndex === 0}
                        aria-label={`Move ${exercise.name} up`}
                        className="ui-action-secondary min-w-[44px] min-h-[44px] flex items-center justify-center disabled:opacity-30"
                      >
                        <ChevronUp size={16} aria-hidden="true" />
                      </button>
                      <button
                        onClick={() => moveExercise(exIndex, 1)}
                        disabled={exIndex === (editingTemplate.exercises || []).length - 1}
                        aria-label={`Move ${exercise.name} down`}
                        className="ui-action-secondary min-w-[44px] min-h-[44px] flex items-center justify-center disabled:opacity-30"
                      >
                        <ChevronDown size={16} aria-hidden="true" />
                      </button>
                      <button
                        onClick={() => removeExercise(exIndex)}
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-[12px] text-slate-500 hover:text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition"
                        title="Delete exercise"
                        aria-label={`Delete ${exercise.name} from template`}
                      >
                        <X size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {/* Exercise-specific training guidance */}
                  <div className="ui-surface-sub p-2.5">
                    <label className="ui-secondary font-semibold" htmlFor={`plan-notes-${exIndex}`}>
                      Session guidance
                      <input
                        id={`plan-notes-${exIndex}`}
                        type="text"
                        value={exercise.planNotes || ''}
                        onChange={(e) => setPlanNotes(exIndex, e.target.value)}
                        placeholder="e.g. explosive tempo, focus on control"
                        maxLength={80}
                        aria-label={`Session guidance for ${exercise.name}`}
                        className="touch-input mt-1.5 w-full bg-slate-700/50 border border-slate-600/30 rounded-lg text-white text-sm placeholder-slate-500 focus:border-blue-500 outline-none"
                      />
                    </label>
                  </div>
                  <div className="space-y-2">
                    <p className="ui-micro">Target sets · intended, not logged</p>
                    {(exercise.sets || []).length === 0 ? (
                      <p className="ui-secondary text-center py-3 ui-surface-sub">
                        No sets
                      </p>
                    ) : (
                      (exercise.sets || []).map((set, sIndex) => (
                        <div key={sIndex} className="ui-surface-sub p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="ui-micro !text-slate-400">
                              Target set {sIndex + 1}
                              {resolveSetType(set) !== 'work' && (
                                <span className="ml-2 px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-300 normal-case tracking-normal">
                                  {resolveSetType(set)}
                                </span>
                              )}
                            </span>
                            <button
                              onClick={() => removeSet(exIndex, sIndex)}
                              aria-label={`Delete target set ${sIndex + 1} of ${exercise.name}`}
                              className="p-1 text-red-400/80 hover:text-red-300 transition min-w-[32px] min-h-[32px] flex items-center justify-center"
                            >
                              <X size={14} aria-hidden="true" />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="ui-micro !text-slate-500" htmlFor={`kg-${exIndex}-${sIndex}`}>
                              Target kg
                              <input
                                id={`kg-${exIndex}-${sIndex}`}
                                type="number"
                                inputMode="decimal"
                                placeholder="0"
                                value={set.kg ?? 0}
                                onChange={(e) => setSetField(exIndex, sIndex, 'kg', Number(e.target.value) || 0)}
                                aria-label={`Target kg for set ${sIndex + 1} of ${exercise.name}`}
                                className="touch-input mt-1 w-full bg-slate-800/70 border border-slate-600/50 rounded-lg text-white font-bold focus:border-accent focus:outline-none"
                              />
                            </label>
                            <label className="ui-micro !text-slate-500" htmlFor={`reps-${exIndex}-${sIndex}`}>
                              Target reps
                              <input
                                id={`reps-${exIndex}-${sIndex}`}
                                type="number"
                                inputMode="decimal"
                                placeholder="0"
                                value={set.reps ?? 0}
                                onChange={(e) => setSetField(exIndex, sIndex, 'reps', Number(e.target.value) || 0)}
                                aria-label={`Target reps for set ${sIndex + 1} of ${exercise.name}`}
                                className="touch-input mt-1 w-full bg-slate-800/70 border border-slate-600/50 rounded-lg text-white font-bold focus:border-accent focus:outline-none"
                              />
                            </label>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <label className="flex items-center gap-2 ui-secondary font-semibold cursor-pointer min-h-[44px]">
                              <input
                                type="checkbox"
                                checked={resolveSetType(set) === 'warmup'}
                                onChange={(e) => setSetWarmup(exIndex, sIndex, e.target.checked)}
                                aria-label={`Warmup set ${sIndex + 1} of ${exercise.name}`}
                                className="w-4 h-4 rounded border-slate-600/50 accent-blue-600"
                              />
                              Warmup
                            </label>
                            <label className="ui-micro !text-slate-500" htmlFor={`settype-${exIndex}-${sIndex}`}>
                              Type
                              <select
                                id={`settype-${exIndex}-${sIndex}`}
                                value={resolveSetType(set)}
                                onChange={(e) => setSetType(exIndex, sIndex, e.target.value)}
                                aria-label={`Set type for set ${sIndex + 1} of ${exercise.name}`}
                                className="mt-1 w-full bg-slate-800/70 border border-slate-600/50 rounded-lg text-white text-xs font-bold focus:border-accent focus:outline-none min-h-[44px] px-2"
                              >
                                {SET_TYPES.map(t => (
                                  <option key={t} value={t}>{t}</option>
                                ))}
                              </select>
                            </label>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <button
                    onClick={() => addSet(exIndex)}
                    aria-label={`Add target set to ${exercise.name}`}
                    className="ui-action-secondary w-full py-2.5 text-xs accent-text font-bold min-h-[44px] ui-press"
                  >
                    + Add target set
                  </button>
                </section>
              ))
            )}
          </section>
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-gradient-to-t from-black via-black/95 to-transparent border-t border-white/10">
          <div className="w-full max-w-2xl mx-auto flex flex-col sm:flex-row gap-2">
            <button
              onClick={onAddExercise}
              aria-label="Add exercise to template"
              className="ui-action-secondary flex-1 p-3 font-bold text-sm ui-press min-h-[48px]"
            >
              + Add Exercise
            </button>
            <button
              onClick={onSave}
              aria-label="Save template"
              className="ui-cta-primary flex-1 p-3 font-bold text-sm ui-press min-h-[48px]"
            >
              Save Template
            </button>
          </div>
        </div>

        {showPlansEditor && (
          <TemplatePlansEditor
            template={editingTemplate}
            onClose={() => setShowPlansEditor(false)}
            onSave={handleSavePlans}
          />
        )}
      </div>
    );
  }

  return (
    <div className="bg-black text-white pb-16">
      <div className="bg-black/95 backdrop-blur border-b border-white/10 p-4 sticky top-0 z-20">
        <div className="flex justify-between items-center gap-3 max-w-2xl mx-auto">
          <button onClick={onClose} aria-label="Close templates" className="p-2 hover:bg-white/10 rounded-lg transition min-w-[44px] min-h-[44px] flex items-center justify-center">
            <X size={20} aria-hidden="true" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="ui-micro">Plan · Prepare · Reuse</p>
            <h1 className="ui-display mt-0.5">Templates</h1>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3 max-w-2xl mx-auto">
        <p className="ui-secondary">Blueprints, not live workouts. Starting creates a working copy — the template stays untouched.</p>
        <button
          onClick={onCreateNew}
          aria-label="Create new template"
          className="ui-cta-primary w-full p-4 font-bold flex items-center justify-center gap-2 min-h-[52px] ui-press"
        >
          <Plus size={20} aria-hidden="true" /> New template
        </button>

        {templates.length === 0 ? (
          <div className="ui-surface-secondary text-center py-12 px-6">
            <p className="ui-card-title">No templates yet</p>
            <p className="ui-secondary mt-1.5">Create a blueprint to start workouts in one tap</p>
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map(template => (
              <TemplateCard
                key={template.id}
                template={template}
                onSelect={null}
                onStart={onStart}
                onEdit={onEdit}
                onDelete={onDelete}
                onDuplicate={onDuplicate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
