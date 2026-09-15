import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CalendarPlus,
  Play,
  Pencil,
  Trash2,
  X,
  Check,
  LayoutTemplate,
  Plus,
  Dumbbell,
} from 'lucide-react';
import {
  isValidDayKey,
  todayLocalKey,
  getScheduledForDay,
  getCompletedPlansForDay,
  getCompletedForDay,
  resolveScheduledSource,
  summarizeScheduled,
  buildMonthDayIndex,
} from '../domain/scheduledWorkouts';
import { formatDate } from '../domain/calculations';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const pad2 = (n) => String(n).padStart(2, '0');
const toKey = (y, m, d) => `${y}-${pad2(m + 1)}-${pad2(d)}`;

/** Fixed 6-week grid (Sunday start) — stable height, real date math. */
const buildCells = (year, month) => {
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const cells = [];
  for (let i = firstDow - 1; i >= 0; i -= 1) {
    const d = daysInPrev - i;
    const dt = new Date(year, month - 1, d);
    cells.push({ key: toKey(dt.getFullYear(), dt.getMonth(), d), day: d, inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push({ key: toKey(year, month, d), day: d, inMonth: true });
  }
  let next = 1;
  while (cells.length < 42) {
    const dt = new Date(year, month + 1, next);
    cells.push({ key: toKey(dt.getFullYear(), dt.getMonth(), next), day: next, inMonth: false });
    next += 1;
  }
  return cells;
};

const shiftMonth = ({ y, m }, delta) => {
  const dt = new Date(y, m + delta, 1);
  return { y: dt.getFullYear(), m: dt.getMonth() };
};

const dayRelation = (key, todayKey) => {
  if (!isValidDayKey(key)) return null;
  if (key === todayKey) return 'Today';
  return key < todayKey ? 'Past' : 'Upcoming';
};

const sourceBadge = (source) => {
  if (source.kind === 'template') return { label: 'Template', cls: 'accent-bg-light accent-text accent-border-light' };
  if (source.kind === 'stale') return { label: 'Template deleted · snapshot kept', cls: 'bg-amber-500/10 border-amber-500/30 text-amber-300' };
  return { label: 'Custom', cls: 'bg-slate-700/40 border-slate-600/50 text-slate-300' };
};

const emptyDraft = (dateKey) => ({
  planId: null,
  name: '',
  dateKey,
  exercises: [],
  saveAsTemplate: false,
});

const toDraftExercise = (picked) => ({
  exerciseId: picked?.id ?? null,
  name: picked?.name || 'Exercise',
  category: picked?.category || 'Strength',
  sets: [{ kg: 0, reps: 0, setType: 'work', warmup: false }],
});

const draftFromPlan = (plan) => ({
  planId: plan.id,
  name: plan.name || '',
  dateKey: plan.dateKey,
  exercises: JSON.parse(JSON.stringify(plan.exercises || [])),
  saveAsTemplate: false,
});

/**
 * Planning Calendar 2.0 — PLAN → TRAIN → REVIEW launcher.
 *
 * A month grid with compact planned/completed markers plus a selected-day
 * panel. The calendar never renders analytics: planned rows show blueprint
 * counts (exercises · sets), completed rows link out to Session Detail.
 */
export const PlanningCalendarView = ({
  workouts = [],
  scheduledWorkouts = [],
  templates = [],
  exercisesDB = [],
  onBack,
  onViewSession,
  onStartPlan,
  onScheduleFromTemplate,
  onSaveCustomPlan,
  onDeletePlan,
  onRequestExercisePick,
  draftBackup = null,
  onConsumeDraftBackup,
}) => {
  const todayKey = useMemo(() => todayLocalKey(), []);
  const now = new Date();
  const [viewMonth, setViewMonth] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [selectedKey, setSelectedKey] = useState(todayKey);
  const [panel, setPanel] = useState('day'); // day | choose | templates | builder
  const [draft, setDraft] = useState(() => emptyDraft(todayKey));
  const [draftError, setDraftError] = useState('');

  // Draft backup: restores the in-progress plan after exercise-picker or
  // create-exercise navigation, appending a picked exercise exactly once.
  // Render-phase derived state (the documented pattern for "props changed →
  // adjust state"): mount initializers alone cannot cover picks that arrive
  // while mounted (selector modal overlays the calendar, no remount).
  const [appliedBackupToken, setAppliedBackupToken] = useState(null);
  if (draftBackup && draftBackup.token !== appliedBackupToken) {
    setAppliedBackupToken(draftBackup.token);
    const picked = draftBackup.pickedExercise;
    const base = draftBackup.draft ?? emptyDraft(selectedKey);
    setDraft(
      picked
        ? { ...base, exercises: [...(base.exercises || []), toDraftExercise(picked)] }
        : base
    );
    setPanel('builder');
    setDraftError('');
  }
  // Clearing the App-side backup is a parent-state sync — kept in an effect
  // so render stays pure. Runs once per token (guard above re-arms only on
  // a new token).
  useEffect(() => {
    if (draftBackup && typeof onConsumeDraftBackup === 'function') onConsumeDraftBackup();
  }, [draftBackup, onConsumeDraftBackup]);

  // Bounded single-pass lookup — the grid never scans history per cell.
  const dayIndex = useMemo(
    () => buildMonthDayIndex({ scheduled: scheduledWorkouts, workouts }),
    [scheduledWorkouts, workouts]
  );

  const cells = useMemo(() => buildCells(viewMonth.y, viewMonth.m), [viewMonth]);

  const planned = useMemo(
    () => getScheduledForDay(scheduledWorkouts, selectedKey),
    [scheduledWorkouts, selectedKey]
  );
  const fulfilled = useMemo(
    () => getCompletedPlansForDay(scheduledWorkouts, selectedKey),
    [scheduledWorkouts, selectedKey]
  );
  const completed = useMemo(
    () => getCompletedForDay(workouts, selectedKey),
    [workouts, selectedKey]
  );

  const dbById = useMemo(() => {
    const map = new Map();
    (exercisesDB || []).forEach((def) => {
      if (def?.id != null) map.set(def.id, def);
    });
    return map;
  }, [exercisesDB]);

  const selectDate = (key, inMonth) => {
    setSelectedKey(key);
    setPanel('day');
    setDraftError('');
    if (!inMonth) {
      const [y, m] = key.split('-').map(Number);
      setViewMonth({ y, m: m - 1 });
    }
  };

  const openBuilderForCreate = () => {
    setDraft(emptyDraft(selectedKey));
    setDraftError('');
    setPanel('builder');
  };

  const openBuilderForEdit = (plan) => {
    setDraft(draftFromPlan(plan));
    setDraftError('');
    setPanel('builder');
  };

  const handlePickExercise = () => {
    if (typeof onRequestExercisePick !== 'function') return;
    // Snapshot the in-progress draft so context survives navigation.
    let snapshot = null;
    try {
      snapshot = JSON.parse(JSON.stringify(draft));
    } catch {
      snapshot = { ...draft, exercises: [...(draft.exercises || [])] };
    }
    onRequestExercisePick(snapshot);
  };

  const updateDraftSet = (exIndex, setIndex, field, value) => {
    setDraft((prev) => ({
      ...prev,
      exercises: prev.exercises.map((ex, i) => {
        if (i !== exIndex) return ex;
        return {
          ...ex,
          sets: (ex.sets || []).map((s, j) => (j !== setIndex ? s : { ...s, [field]: value })),
        };
      }),
    }));
  };

  const addDraftSet = (exIndex) => {
    setDraft((prev) => ({
      ...prev,
      exercises: prev.exercises.map((ex, i) => {
        if (i !== exIndex) return ex;
        const sets = ex.sets || [];
        const last = sets.length > 0 ? sets[sets.length - 1] : { kg: 0, reps: 0 };
        return {
          ...ex,
          sets: [...sets, { kg: Number(last.kg) || 0, reps: Number(last.reps) || 0, setType: 'work', warmup: false }],
        };
      }),
    }));
  };

  const removeDraftSet = (exIndex, setIndex) => {
    setDraft((prev) => ({
      ...prev,
      exercises: prev.exercises.map((ex, i) => {
        if (i !== exIndex) return ex;
        return { ...ex, sets: (ex.sets || []).filter((_, j) => j !== setIndex) };
      }),
    }));
  };

  const removeDraftExercise = (exIndex) => {
    setDraft((prev) => ({
      ...prev,
      exercises: prev.exercises.filter((_, i) => i !== exIndex),
    }));
  };

  const handleSaveDraft = (saveAsTemplate) => {
    setDraftError('');
    if (!draft.name.trim()) {
      setDraftError('Give the workout a name first.');
      return;
    }
    if (!isValidDayKey(draft.dateKey)) {
      setDraftError('Pick a valid date.');
      return;
    }
    if (draft.exercises.length === 0) {
      setDraftError('Add at least one exercise.');
      return;
    }
    if (typeof onSaveCustomPlan !== 'function') return;
    const result = onSaveCustomPlan({
      planId: draft.planId,
      name: draft.name.trim(),
      dateKey: draft.dateKey,
      exercises: draft.exercises,
      saveAsTemplate,
    });
    if (result && result.ok === false) {
      setDraftError(result.error || 'Could not save. Try again.');
      return;
    }
    // Land on the saved date (a reschedule may target another month).
    setSelectedKey(draft.dateKey);
    const parts = String(draft.dateKey).split('-').map(Number);
    if (parts.length === 3 && parts.every(Number.isFinite)) {
      setViewMonth({ y: parts[0], m: parts[1] - 1 });
    }
    setPanel('day');
  };

  const relation = dayRelation(selectedKey, todayKey);
  const selectedLabel = (() => {
    try {
      const label = formatDate(selectedKey);
      return /invalid/i.test(String(label)) ? selectedKey : label;
    } catch {
      return selectedKey;
    }
  })();

  const monthStats = useMemo(() => {
    let p = 0;
    let c = 0;
    dayIndex.forEach((v, key) => {
      if (key.startsWith(`${viewMonth.y}-${pad2(viewMonth.m + 1)}`)) {
        if (v.planned > 0) p += 1;
        if (v.completed > 0) c += 1;
      }
    });
    return { plannedDays: p, trainedDays: c };
  }, [dayIndex, viewMonth]);

  const renderDayPanel = () => {
    if (panel === 'choose') {
      return (
        <div role="dialog" aria-modal="false" aria-label={`Plan a workout for ${selectedLabel}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="ui-card-title">Plan workout</h3>
            <button onClick={() => setPanel('day')} aria-label="Back to day" className="p-2 min-w-[44px] min-h-[44px] inline-flex items-center justify-center hover:bg-slate-800 rounded-lg transition text-slate-400">
              <X size={18} />
            </button>
          </div>
          <div className="space-y-2">
            <button
              onClick={() => setPanel('templates')}
              className="ui-surface-interactive w-full p-4 text-left flex items-center gap-3 min-h-[56px]"
            >
              <span className="w-10 h-10 rounded-xl accent-bg-light accent-border border flex items-center justify-center shrink-0" aria-hidden>
                <LayoutTemplate size={18} className="accent-text" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="ui-card-title block">Use template</span>
                <span className="ui-secondary block mt-0.5">Schedule a saved blueprint</span>
              </span>
            </button>
            <button
              onClick={openBuilderForCreate}
              className="ui-surface-interactive w-full p-4 text-left flex items-center gap-3 min-h-[56px]"
            >
              <span className="w-10 h-10 rounded-xl bg-slate-700/40 border border-slate-600/50 flex items-center justify-center shrink-0" aria-hidden>
                <Plus size={18} className="text-slate-200" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="ui-card-title block">Create new</span>
                <span className="ui-secondary block mt-0.5">Build a one-off plan for this date</span>
              </span>
            </button>
          </div>
        </div>
      );
    }

    if (panel === 'templates') {
      return (
        <div role="dialog" aria-modal="false" aria-label={`Choose a template for ${selectedLabel}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="ui-card-title">Choose template</h3>
            <button onClick={() => setPanel('choose')} aria-label="Back to plan options" className="p-2 min-w-[44px] min-h-[44px] inline-flex items-center justify-center hover:bg-slate-800 rounded-lg transition text-slate-400">
              <X size={18} />
            </button>
          </div>
          {(templates || []).length === 0 ? (
            <div className="ui-surface-sub p-4 text-center">
              <p className="ui-card-title">No templates yet</p>
              <p className="ui-secondary mt-1">Create one in Templates, or build a one-off plan instead.</p>
              <button onClick={openBuilderForCreate} className="ui-action-secondary mt-3 px-4 min-h-[44px] font-bold text-sm">
                Create new instead
              </button>
            </div>
          ) : (
            <ul className="space-y-2 max-h-[40dvh] overflow-y-auto">
              {(templates || []).map((t) => {
                const exCount = (t?.exercises || []).length;
                const setCount = (t?.exercises || []).reduce((n, ex) => n + ((ex?.sets || []).length), 0);
                return (
                  <li key={t.id} className="ui-surface-sub p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="ui-card-title truncate">{t.name || 'Untitled template'}</p>
                      <p className="ui-secondary mt-0.5">{exCount} exercise{exCount === 1 ? '' : 's'} · {setCount} set{setCount === 1 ? '' : 's'}</p>
                    </div>
                    <button
                      onClick={() => {
                        onScheduleFromTemplate && onScheduleFromTemplate(t.id, selectedKey);
                        setPanel('day');
                      }}
                      aria-label={`Schedule ${t.name} for ${selectedLabel}`}
                      className="ui-cta-primary px-4 min-h-[44px] font-bold text-sm shrink-0"
                    >
                      Schedule
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      );
    }

    if (panel === 'builder') {
      const isEdit = draft.planId != null;
      return (
        <div role="dialog" aria-modal="false" aria-label={isEdit ? `Edit planned workout ${draft.name}` : 'Create planned workout'}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="ui-card-title">{isEdit ? 'Edit plan' : 'New plan'}</h3>
            <button onClick={() => setPanel('day')} aria-label="Back to day without saving" className="p-2 min-w-[44px] min-h-[44px] inline-flex items-center justify-center hover:bg-slate-800 rounded-lg transition text-slate-400">
              <X size={18} />
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label htmlFor="plan-name" className="ui-micro">Workout name</label>
              <input
                id="plan-name"
                type="text"
                value={draft.name}
                onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Push A"
                maxLength={80}
                className="touch-input mt-1.5 w-full bg-slate-800/60 border border-slate-600/50 rounded-xl text-white font-bold focus:border-accent focus:outline-none placeholder:text-slate-600"
              />
            </div>
            <div>
              <label htmlFor="plan-date" className="ui-micro">{isEdit ? 'Date (reschedule)' : 'Date'}</label>
              <input
                id="plan-date"
                type="date"
                value={draft.dateKey}
                onChange={(e) => setDraft((p) => ({ ...p, dateKey: e.target.value }))}
                className="touch-input mt-1.5 w-full bg-slate-800/60 border border-slate-600/50 rounded-xl text-white font-bold focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <p className="ui-micro">Exercises · {(draft.exercises || []).length}</p>
                <button onClick={handlePickExercise} className="ui-action-secondary px-3 min-h-[44px] font-bold text-xs inline-flex items-center gap-1.5">
                  <Plus size={14} aria-hidden /> Add exercise
                </button>
              </div>
              {(draft.exercises || []).length === 0 ? (
                <p className="ui-secondary ui-surface-sub p-3 mt-2 text-center">No exercises yet — add the first one.</p>
              ) : (
                <ul className="space-y-2 mt-2">
                  {draft.exercises.map((ex, exIndex) => {
                    const stale = ex?.exerciseId != null && dbById.size > 0 && !dbById.has(ex.exerciseId);
                    return (
                      <li key={`${ex.exerciseId ?? ex.name}-${exIndex}`} className="ui-surface-sub p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="ui-card-title text-sm truncate">{ex.name || 'Exercise'}</p>
                            {stale && (
                              <p className="text-[11px] text-amber-300 font-semibold mt-0.5">Removed from library — targets kept safely.</p>
                            )}
                          </div>
                          <button
                            onClick={() => removeDraftExercise(exIndex)}
                            aria-label={`Remove ${ex.name} from plan`}
                            className="p-1.5 min-w-[36px] min-h-[36px] inline-flex items-center justify-center text-slate-500 hover:text-red-300 transition shrink-0"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                        <div className="space-y-1.5 mt-2">
                          {(ex.sets || []).map((s, setIndex) => (
                            <div key={setIndex} className="flex items-center gap-2">
                              <span className="ui-micro w-8 shrink-0">#{setIndex + 1}</span>
                              <label className="sr-only" htmlFor={`plan-kg-${exIndex}-${setIndex}`}>Target kg set {setIndex + 1} of {ex.name}</label>
                              <input
                                id={`plan-kg-${exIndex}-${setIndex}`}
                                type="number"
                                inputMode="decimal"
                                value={s.kg ?? 0}
                                onChange={(e) => updateDraftSet(exIndex, setIndex, 'kg', Number(e.target.value) || 0)}
                                className="w-full min-w-0 bg-slate-800/70 border border-slate-600/50 rounded-lg px-2 py-2 text-white text-sm font-bold focus:border-accent focus:outline-none min-h-[44px]"
                                placeholder="kg"
                              />
                              <span className="text-slate-500 text-xs font-bold shrink-0">×</span>
                              <label className="sr-only" htmlFor={`plan-reps-${exIndex}-${setIndex}`}>Target reps set {setIndex + 1} of {ex.name}</label>
                              <input
                                id={`plan-reps-${exIndex}-${setIndex}`}
                                type="number"
                                inputMode="decimal"
                                value={s.reps ?? 0}
                                onChange={(e) => updateDraftSet(exIndex, setIndex, 'reps', Number(e.target.value) || 0)}
                                className="w-full min-w-0 bg-slate-800/70 border border-slate-600/50 rounded-lg px-2 py-2 text-white text-sm font-bold focus:border-accent focus:outline-none min-h-[44px]"
                                placeholder="reps"
                              />
                              <button
                                onClick={() => removeDraftSet(exIndex, setIndex)}
                                aria-label={`Delete set ${setIndex + 1} of ${ex.name}`}
                                className="p-1.5 min-w-[36px] min-h-[36px] inline-flex items-center justify-center text-slate-500 hover:text-red-300 transition shrink-0"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                        <button onClick={() => addDraftSet(exIndex)} aria-label={`Add target set to ${ex.name}`} className="mt-2 text-xs font-bold accent-text min-h-[36px]">
                          + Add target set
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            {draftError && (
              <p role="alert" className="text-[13px] font-bold text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                {draftError}
              </p>
            )}
            {isEdit ? (
              <button onClick={() => handleSaveDraft(false)} className="ui-cta-primary w-full p-3 font-bold text-sm min-h-[48px]">
                Save changes
              </button>
            ) : (
              <div className="space-y-2">
                <button onClick={() => handleSaveDraft(false)} className="ui-cta-primary w-full p-3 font-bold text-sm min-h-[48px]">
                  Save to calendar only
                </button>
                <button onClick={() => handleSaveDraft(true)} className="ui-action-secondary w-full p-3 font-bold text-sm min-h-[48px]">
                  Save to calendar + save as template
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Default: day overview (launcher, not analytics).
    return (
      <div>
        {planned.length === 0 && completed.length === 0 && fulfilled.length === 0 ? (
          <div className="text-center py-2">
            <p className="ui-card-title">{relation === 'Today' ? 'Nothing planned today' : relation === 'Past' ? 'Nothing logged this day' : 'Rest day'}</p>
            <p className="ui-secondary mt-1">Plan a workout to see it here on the date.</p>
            <button
              onClick={() => setPanel('choose')}
              className="ui-cta-primary mt-3 px-5 min-h-[48px] font-bold text-sm inline-flex items-center gap-2"
            >
              <CalendarPlus size={16} aria-hidden /> Plan workout
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {planned.length > 0 && (
              <section aria-label={`Planned workouts for ${selectedLabel}`}>
                <p className="ui-micro mb-2">Planned · {planned.length}</p>
                <ul className="space-y-2">
                  {planned.map((plan) => {
                    const summary = summarizeScheduled(plan);
                    const badge = sourceBadge(resolveScheduledSource(plan, templates));
                    return (
                      <li key={plan.id} className="ui-surface-sub p-3.5 border-l-2 border-l-[var(--accent)]">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="ui-card-title truncate">{plan.name}</p>
                            <p className="ui-secondary mt-0.5">
                              {summary.exerciseCount} exercise{summary.exerciseCount === 1 ? '' : 's'} · {summary.setCount} set{summary.setCount === 1 ? '' : 's'}
                            </p>
                            <span className={`inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full border font-bold ${badge.cls}`}>
                              {badge.label}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => onStartPlan && onStartPlan(plan.id)}
                            aria-label={`Start planned workout ${plan.name}`}
                            className="ui-cta-primary flex-1 min-h-[44px] px-3 font-bold text-sm inline-flex items-center justify-center gap-1.5"
                          >
                            <Play size={15} aria-hidden /> Start
                          </button>
                          <button
                            onClick={() => openBuilderForEdit(plan)}
                            aria-label={`Edit planned workout ${plan.name}`}
                            className="ui-action-secondary min-w-[44px] min-h-[44px] inline-flex items-center justify-center"
                          >
                            <Pencil size={15} aria-hidden />
                          </button>
                          <button
                            onClick={() => onDeletePlan && onDeletePlan(plan.id)}
                            aria-label={`Delete planned workout ${plan.name}`}
                            className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-[12px] bg-red-500/10 border border-red-500/30 text-red-300"
                          >
                            <Trash2 size={15} aria-hidden />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <button
                  onClick={() => setPanel('choose')}
                  className="mt-2 w-full ui-action-secondary min-h-[44px] font-bold text-xs inline-flex items-center justify-center gap-1.5"
                >
                  <Plus size={14} aria-hidden /> Plan another
                </button>
              </section>
            )}

            {completed.length > 0 && (
              <section aria-label={`Completed sessions for ${selectedLabel}`}>
                <p className="ui-micro mb-2">Completed · {completed.length}</p>
                <ul className="space-y-2">
                  {completed.map((w) => {
                    const workSets = (w.exercises || []).reduce(
                      (n, ex) => n + (ex?.sets || []).filter((s) => s?.completed && !s?.warmup && s?.setType !== 'warmup').length,
                      0
                    );
                    return (
                      <li key={w.id} className="ui-surface-sub p-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0" aria-hidden>
                            <Check size={15} className="text-emerald-300" strokeWidth={3} />
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="ui-card-title text-sm truncate">{w.name || 'Workout'}</p>
                            <p className="ui-secondary mt-0.5 text-[12px]">
                              {(w.exercises || []).length} exercises · {workSets} work sets{w.duration ? ` · ${w.duration} min` : ''}
                            </p>
                          </div>
                          <button
                            onClick={() => onViewSession && onViewSession(w.id)}
                            aria-label={`View completed session ${w.name}`}
                            className="ui-action-secondary px-3 min-h-[44px] font-bold text-xs shrink-0"
                          >
                            View
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {fulfilled.length > 0 && (
              <section aria-label={`Fulfilled plans for ${selectedLabel}`}>
                <p className="ui-micro mb-2">Fulfilled plans · {fulfilled.length}</p>
                <ul className="space-y-2">
                  {fulfilled.map((plan) => (
                    <li key={plan.id} className="ui-surface-sub p-3 flex items-center gap-2.5">
                      <span className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0" aria-hidden>
                        <Check size={15} className="text-emerald-300" strokeWidth={3} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="ui-card-title text-sm truncate">{plan.name}</p>
                        <p className="ui-secondary mt-0.5 text-[12px]">Trained · plan fulfilled</p>
                      </div>
                      {plan.completedWorkoutId && (
                        <button
                          onClick={() => onViewSession && onViewSession(plan.completedWorkoutId)}
                          aria-label={`View session trained from ${plan.name}`}
                          className="ui-action-secondary px-3 min-h-[44px] font-bold text-xs shrink-0"
                        >
                          View
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-black text-white pb-16">
      <div className="bg-black/95 backdrop-blur border-b border-white/10 p-4 sticky top-0 z-20">
        <div className="flex items-center justify-between gap-2">
          <button onClick={onBack} aria-label="Back" className="p-2 min-w-[44px] min-h-[44px] inline-flex items-center justify-center hover:bg-white/10 rounded-lg transition shrink-0">
            <ChevronLeft size={22} />
          </button>
          <div className="min-w-0 text-center">
            <p className="ui-micro">Plan · Train · Review</p>
            <h1 className="ui-display mt-0.5">Calendar</h1>
          </div>
          <div className="w-[44px] shrink-0" aria-hidden />
        </div>
      </div>

      <div className="p-4 space-y-3 max-w-2xl mx-auto">
        <section aria-label="Month navigation" className="ui-surface-secondary p-3">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setViewMonth((v) => shiftMonth(v, -1))}
              aria-label={`Previous month, ${MONTH_NAMES[(viewMonth.m + 11) % 12]}`}
              className="p-2 min-w-[44px] min-h-[44px] inline-flex items-center justify-center hover:bg-slate-800 rounded-lg transition"
            >
              <ChevronLeft size={20} />
            </button>
            <h2 className="ui-section-title text-center flex-1 min-w-0 truncate" aria-live="polite">
              {MONTH_NAMES[viewMonth.m]} {viewMonth.y}
            </h2>
            <button
              onClick={() => setViewMonth((v) => shiftMonth(v, 1))}
              aria-label={`Next month, ${MONTH_NAMES[(viewMonth.m + 1) % 12]}`}
              className="p-2 min-w-[44px] min-h-[44px] inline-flex items-center justify-center hover:bg-slate-800 rounded-lg transition"
            >
              <ChevronRight size={20} />
            </button>
          </div>
          <div className="flex items-center justify-between mt-1">
            <p className="ui-secondary text-[12px]" aria-live="polite">
              {monthStats.plannedDays} planned · {monthStats.trainedDays} trained
            </p>
            <button
              onClick={() => {
                const t = new Date();
                setViewMonth({ y: t.getFullYear(), m: t.getMonth() });
                setSelectedKey(todayLocalKey(t));
                setPanel('day');
              }}
              className="text-[12px] font-bold accent-text min-h-[36px] px-2"
            >
              Today
            </button>
          </div>
        </section>

        <section aria-label="Calendar grid">
          <div className="grid grid-cols-7 gap-1 mb-1" aria-hidden="true">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <div key={i} className="text-center text-[11px] font-black text-slate-500 py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1" role="grid" aria-label={`${MONTH_NAMES[viewMonth.m]} ${viewMonth.y}`}>
            {cells.map((cell) => {
              const marks = dayIndex.get(cell.key) || { planned: 0, completed: 0 };
              const isToday = cell.key === todayKey;
              const isSelected = cell.key === selectedKey;
              const status =
                marks.planned > 0 && marks.completed > 0
                  ? 'planned and completed'
                  : marks.planned > 0
                    ? 'planned'
                    : marks.completed > 0
                      ? 'completed'
                      : 'no sessions';
              return (
                <button
                  key={cell.key}
                  role="gridcell"
                  onClick={() => selectDate(cell.key, cell.inMonth)}
                  aria-pressed={isSelected}
                  aria-current={isToday ? 'date' : undefined}
                  aria-label={`${cell.day} ${MONTH_NAMES[Number(cell.key.split('-')[1]) - 1]}, ${status}`}
                  className={`min-h-[48px] rounded-xl text-sm font-bold flex flex-col items-center justify-center gap-1 transition border ui-press ${
                    isSelected
                      ? 'accent-bg text-white border-transparent shadow-lg'
                      : isToday
                        ? 'bg-slate-800/70 border-slate-400/60 text-white'
                        : cell.inMonth
                          ? 'bg-slate-800/30 border-slate-700/30 text-slate-300 hover:bg-slate-800/60'
                          : 'bg-transparent border-transparent text-slate-600 hover:bg-slate-800/40'
                  }`}
                >
                  <span className="leading-none flex items-center gap-1">
                    {cell.day}
                    {marks.completed > 0 && (
                      <Check size={11} strokeWidth={4} className={isSelected ? 'text-white' : 'text-emerald-300'} aria-hidden="true" />
                    )}
                  </span>
                  <span className="flex items-center gap-1 h-1.5" aria-hidden="true">
                    {marks.planned > 0 && (
                      <span className={`w-1.5 h-1.5 rounded-full border ${isSelected ? 'border-white bg-transparent' : 'border-[var(--accent)] bg-[var(--accent)]/40'}`} />
                    )}
                    {marks.completed > 0 && (
                      <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-emerald-400'}`} />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-2 px-1" aria-hidden="true">
            <span className="flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full border border-[var(--accent)] bg-[var(--accent)]/40" /> Planned
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Completed
            </span>
          </div>
        </section>

        <section aria-label={`Details for ${selectedLabel}`} aria-live="polite" className="ui-surface-secondary p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="min-w-0">
              <h2 className="ui-section-title truncate">{selectedLabel}</h2>
              <p className="ui-secondary mt-0.5">{relation}</p>
            </div>
            {panel !== 'day' ? null : (planned.length > 0 || completed.length > 0 || fulfilled.length > 0) ? (
              <span className="text-[11px] px-2 py-1 rounded-full border font-bold border-slate-600/60 text-slate-300 shrink-0">
                {planned.length > 0 && completed.length > 0 ? 'Planned + done' : planned.length > 0 ? 'Planned' : 'Done'}
              </span>
            ) : (
              <span className="text-[11px] px-2 py-1 rounded-full border font-bold border-slate-700/60 text-slate-500 shrink-0">Empty</span>
            )}
          </div>
          {renderDayPanel()}
        </section>

        <section aria-label="How planning works" className="ui-surface-sub p-3.5 flex gap-2.5">
          <Dumbbell size={16} className="text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="ui-secondary text-[12px]">
            Plans are intentions — they never count toward history or stats until you train and save the session.
          </p>
        </section>
      </div>
    </div>
  );
};

export default PlanningCalendarView;
