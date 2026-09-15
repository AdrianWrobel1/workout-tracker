import React from 'react';
import { ChevronLeft, Save, X, Plus } from 'lucide-react';
import { normalizeExerciseRestOverride, normalizeRestDuration, DEFAULT_REST_SEC, formatRestTime } from '../domain/restTimer';

const REST_PRESETS_SEC = [60, 90, 120, 150, 180];

const ProgressionNumberField = ({ id, label, value, step = '1', onPick, drop }) => (
  <div>
    <label className="ui-micro" htmlFor={id}>{label}</label>
    <input
      id={id}
      type="number"
      step={step}
      value={value ?? ''}
      placeholder="—"
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === '' || raw === null) {
          drop();
          return;
        }
        const n = Number(raw);
        if (!Number.isFinite(n)) {
          drop();
          return;
        }
        onPick(n);
      }}
      className="touch-input mt-1 w-full bg-slate-800/60 border border-slate-600/50 rounded-lg text-white text-center font-bold focus:border-accent focus:outline-none transition"
      aria-label={label}
    />
  </div>
);

export const CreateExerciseView = ({ exercise, onSave, onCancel, onChange, globalRestSec = DEFAULT_REST_SEC }) => {
  const normalizedGlobal = normalizeRestDuration(globalRestSec, DEFAULT_REST_SEC);
  const override = normalizeExerciseRestOverride(exercise.restSec);
  const effective = override ?? normalizedGlobal;
  const usingGlobal = override === undefined;

  const setOverride = (sec) => onChange({ ...exercise, restSec: sec });
  const clearOverride = () => {
    const next = { ...exercise };
    delete next.restSec;
    onChange(next);
  };
  return (
    <div className="bg-black text-white pb-16">
      {/* Header */}
      <div className="bg-black/95 backdrop-blur border-b border-white/10 p-3 flex items-center gap-2 sticky top-0 z-20">
        <button onClick={onCancel} aria-label="Back to exercises" className="p-2 hover:bg-white/10 rounded-lg transition min-w-[44px] min-h-[44px] flex items-center justify-center">
          <ChevronLeft size={24} aria-hidden="true" />
        </button>
        <h1 className="ui-section-title flex-1 truncate">{exercise.id ? 'Edit exercise' : 'New exercise'}</h1>
        <button onClick={onSave} aria-label={exercise.id ? 'Save exercise' : 'Create exercise'} className="ui-cta-primary px-4 min-h-[44px] font-bold text-sm flex items-center gap-1.5 ui-press">
          <Save size={16} aria-hidden="true" />
          <span>Save</span>
        </button>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {/* Name */}
        <section aria-label="Exercise name" className="ui-surface-secondary p-4">
          <p className="ui-micro">01 · Name</p>
          <label className="sr-only" htmlFor="exercise-name">Exercise name</label>
          <input
            id="exercise-name"
            type="text"
            value={exercise.name}
            onChange={(e) => onChange({ ...exercise, name: e.target.value })}
            placeholder="e.g., Bench Press"
            className="touch-input mt-2 w-full bg-slate-800/60 border border-slate-600/50 rounded-xl text-white text-lg font-bold focus:border-accent focus:outline-none transition"
          />
        </section>

        {/* Category & Muscle Group */}
        <section aria-label="Classification" className="ui-surface-secondary p-4">
          <p className="ui-micro">02 · Classification</p>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div>
              <label className="ui-micro" htmlFor="exercise-category">Category</label>
              <select
                id="exercise-category"
                value={exercise.category || 'Push'}
                onChange={(e) => onChange({ ...exercise, category: e.target.value })}
                className="touch-input mt-1 w-full bg-slate-800/60 border border-slate-600/50 rounded-xl text-white font-bold focus:border-accent focus:outline-none transition appearance-none"
              >
                {['Push', 'Pull', 'Legs', 'Full Body', 'Cardio', 'Other'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="ui-micro" htmlFor="exercise-muscles">Muscles</label>
              <input
                id="exercise-muscles"
                type="text"
                value={exercise.muscles ? exercise.muscles.join(', ') : ''}
                onChange={(e) => onChange({
                  ...exercise,
                  muscles: e.target.value.split(',').map(s => s.trim()).filter(s => s)
                })}
                placeholder="Chest, Triceps..."
                className="touch-input mt-1 w-full bg-slate-800/60 border border-slate-600/50 rounded-xl text-white font-bold text-sm focus:border-accent focus:outline-none transition"
              />
            </div>
          </div>
        </section>

        {/* Note */}
        <section aria-label="Form cue" className="ui-surface-secondary p-4">
          <p className="ui-micro">03 · Form cue</p>
          <label className="sr-only" htmlFor="exercise-note">Form cue or note</label>
          <textarea
            id="exercise-note"
            value={exercise.note || ''}
            onChange={(e) => onChange({ ...exercise, note: e.target.value })}
            placeholder="E.g., 'Keep elbows high', 'Pause at bottom'..."
            className="touch-input mt-2 w-full bg-slate-800/60 border border-slate-600/50 rounded-xl text-white text-sm focus:border-accent focus:outline-none transition resize-none"
            rows="3"
          />
        </section>

        {/* Default Sets */}
        <section aria-label="Default sets" className="ui-surface-secondary p-4">
          <div className="ui-section-head !mb-2">
            <p className="ui-micro">04 · Default sets</p>
            <p className="ui-secondary">{(exercise.defaultSets || []).length || 1} sets</p>
          </div>
          <div className="space-y-2">
            {(exercise.defaultSets || [{ kg: 0, reps: 0 }]).map((set, i) => (
              <div key={`set-${i}-${set.kg}-${set.reps}`} className="ui-surface-sub p-3 flex flex-wrap items-center gap-2 sm:flex-nowrap">
                <span className="ui-step-badge" aria-hidden="true">{i + 1}</span>
                <label className="sr-only" htmlFor={`def-kg-${i}`}>Default kg for set {i + 1}</label>
                <input
                  id={`def-kg-${i}`}
                  type="number"
                  value={set.kg}
                  onChange={(e) => {
                    const updated = { ...exercise };
                    updated.defaultSets[i].kg = parseInt(e.target.value) || 0;
                    onChange(updated);
                  }}
                  placeholder="kg"
                  className="touch-input w-20 sm:flex-1 bg-slate-800/60 border border-slate-600/50 rounded-lg text-white text-center font-bold text-sm focus:border-accent focus:outline-none"
                />
                <span className="text-slate-400 font-bold" aria-hidden="true">×</span>
                <label className="sr-only" htmlFor={`def-reps-${i}`}>Default reps for set {i + 1}</label>
                <input
                  id={`def-reps-${i}`}
                  type="number"
                  value={set.reps}
                  onChange={(e) => {
                    const updated = { ...exercise };
                    updated.defaultSets[i].reps = parseInt(e.target.value) || 0;
                    onChange(updated);
                  }}
                  placeholder="reps"
                  className="touch-input w-20 sm:flex-1 bg-slate-800/60 border border-slate-600/50 rounded-lg text-white text-center font-bold text-sm focus:border-accent focus:outline-none"
                />
                <button
                  onClick={() => {
                    const updated = { ...exercise };
                    if (updated.defaultSets.length > 1) {
                      updated.defaultSets.splice(i, 1);
                      onChange(updated);
                    }
                  }}
                  aria-label={`Remove default set ${i + 1}`}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center text-red-300/80 hover:text-red-200 hover:bg-red-500/10 rounded-lg transition flex-shrink-0"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => {
              const updated = { ...exercise };
              if (!updated.defaultSets) updated.defaultSets = [];
              const last = updated.defaultSets[updated.defaultSets.length - 1] || { kg: 0, reps: 0 };
              updated.defaultSets.push({ ...last });
              onChange(updated);
            }}
            className="ui-action-secondary w-full p-3 mt-3 font-bold text-sm transition flex items-center justify-center gap-2 min-h-[48px] ui-press"
          >
            <Plus size={18} aria-hidden="true" /> Add set
          </button>
        </section>

        {/* Bodyweight Option */}
        <section aria-label="Load options" className="ui-surface-secondary p-4">
          <p className="ui-micro">05 · Load</p>
          <label className="mt-2 flex items-center gap-3 cursor-pointer min-h-[44px]">
            <input
              type="checkbox"
              checked={!!exercise.usesBodyweight}
              onChange={(e) => onChange({ ...exercise, usesBodyweight: !!e.target.checked })}
              className="w-5 h-5 rounded-lg cursor-pointer accent-blue-500 shrink-0"
            />
            <span className="ui-body !text-[13px] font-bold">Include bodyweight in volume</span>
          </label>
        </section>

        {/* Progression — optional prescription policy (default OFF = legacy behavior) */}
        <section aria-label="Progression policy" className="ui-surface-secondary p-4">
          <p className="ui-micro">06 · Progression</p>
          <div className="mt-2 space-y-3">
            <label className="sr-only" htmlFor="exercise-progression">Progression policy</label>
            <select
              id="exercise-progression"
              value={exercise.progression?.mode || 'off'}
              onChange={(e) => {
                const mode = e.target.value;
                if (mode === 'off') {
                  const next = { ...exercise };
                  delete next.progression;
                  onChange(next);
                } else {
                  onChange({ ...exercise, progression: { ...(exercise.progression || {}), mode } });
                }
              }}
              className="touch-input w-full bg-slate-800/60 border border-slate-600/50 rounded-lg text-white font-bold focus:border-accent focus:outline-none transition appearance-none"
              aria-label="Progression policy"
            >
              <option value="off">Off (legacy suggestions)</option>
              <option value="linear">Linear (add weight on target)</option>
              <option value="double">Double progression (rep range, then weight)</option>
              <option value="reps">Rep progression (same weight, more reps)</option>
              <option value="deload">Deload (reduced load)</option>
            </select>
            {(exercise.progression?.mode === 'linear') && (
              <div className="grid grid-cols-2 gap-3">
                <ProgressionNumberField id="prog-target-reps" label="Target reps" value={exercise.progression?.targetReps} onPick={(v) => onChange({ ...exercise, progression: { ...exercise.progression, ...(v === undefined ? {} : { targetReps: v }) } })} drop={() => { const p = { ...exercise.progression }; delete p.targetReps; onChange({ ...exercise, progression: p }); }} />
                <ProgressionNumberField id="prog-inc" label="Increment (kg)" step="0.5" value={exercise.progression?.incrementKg} onPick={(v) => onChange({ ...exercise, progression: { ...exercise.progression, ...(v === undefined ? {} : { incrementKg: v }) } })} drop={() => { const p = { ...exercise.progression }; delete p.incrementKg; onChange({ ...exercise, progression: p }); }} />
              </div>
            )}
            {(exercise.progression?.mode === 'double' || exercise.progression?.mode === 'reps') && (
              <div className="grid grid-cols-3 gap-3">
                <ProgressionNumberField id="prog-min" label="Rep min" value={exercise.progression?.repMin} onPick={(v) => onChange({ ...exercise, progression: { ...exercise.progression, ...(v === undefined ? {} : { repMin: v }) } })} drop={() => { const p = { ...exercise.progression }; delete p.repMin; onChange({ ...exercise, progression: p }); }} />
                <ProgressionNumberField id="prog-max" label="Rep max" value={exercise.progression?.repMax} onPick={(v) => onChange({ ...exercise, progression: { ...exercise.progression, ...(v === undefined ? {} : { repMax: v }) } })} drop={() => { const p = { ...exercise.progression }; delete p.repMax; onChange({ ...exercise, progression: p }); }} />
                {exercise.progression?.mode === 'double'
                  ? <ProgressionNumberField id="prog-inc2" label="Increment (kg)" step="0.5" value={exercise.progression?.incrementKg} onPick={(v) => onChange({ ...exercise, progression: { ...exercise.progression, ...(v === undefined ? {} : { incrementKg: v }) } })} drop={() => { const p = { ...exercise.progression }; delete p.incrementKg; onChange({ ...exercise, progression: p }); }} />
                  : <ProgressionNumberField id="prog-step" label="Rep step" value={exercise.progression?.repStep} onPick={(v) => onChange({ ...exercise, progression: { ...exercise.progression, ...(v === undefined ? {} : { repStep: v }) } })} drop={() => { const p = { ...exercise.progression }; delete p.repStep; onChange({ ...exercise, progression: p }); }} />}
              </div>
            )}
            {exercise.progression?.mode === 'deload' && (
              <div className="grid grid-cols-2 gap-3">
                <ProgressionNumberField id="prog-dmin" label="Rep min" value={exercise.progression?.repMin} onPick={(v) => onChange({ ...exercise, progression: { ...exercise.progression, ...(v === undefined ? {} : { repMin: v }) } })} drop={() => { const p = { ...exercise.progression }; delete p.repMin; onChange({ ...exercise, progression: p }); }} />
                <ProgressionNumberField id="prog-df" label="Load factor (0.5–0.9)" step="0.05" value={exercise.progression?.deloadFactor} onPick={(v) => onChange({ ...exercise, progression: { ...exercise.progression, ...(v === undefined ? {} : { deloadFactor: v }) } })} drop={() => { const p = { ...exercise.progression }; delete p.deloadFactor; onChange({ ...exercise, progression: p }); }} />
              </div>
            )}
            <p className="ui-secondary !text-xs">
              Recommendations never overwrite logged sets. Without a policy this exercise keeps legacy suggestions.
            </p>
          </div>
        </section>

        {/* Rest — per-exercise default override (optional) */}
        <section aria-label="Rest default" className="ui-surface-secondary p-4">
          <p className="ui-micro">07 · Rest</p>
          <div className="mt-2" role="group" aria-label="Exercise rest default">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-2xl font-black text-white ui-metric" aria-live="polite">
                  {formatRestTime(effective)}
                </p>
                <p className="ui-secondary !text-xs mt-1">
                  {usingGlobal
                    ? `Global default (${formatRestTime(normalizedGlobal)})`
                    : 'Exercise override'}
                </p>
              </div>
              {!usingGlobal && (
                <button
                  type="button"
                  onClick={clearOverride}
                  className="ui-action-secondary shrink-0 px-4 py-3 text-sm font-bold"
                  aria-label="Use global default rest"
                >
                  Use global
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                onClick={() => setOverride(Math.max(15, effective - 15))}
                className="ui-action-secondary flex-1 py-3 font-black min-h-[48px] ui-press"
                aria-label="Decrease exercise rest by 15 seconds"
              >
                −15s
              </button>
              <button
                type="button"
                onClick={() => setOverride(Math.min(600, effective + 15))}
                className="ui-action-secondary flex-1 py-3 font-black min-h-[48px] ui-press"
                aria-label="Increase exercise rest by 15 seconds"
              >
                +15s
              </button>
            </div>
            <div className="grid grid-cols-5 gap-1.5 mt-2">
              {REST_PRESETS_SEC.map((preset) => (
                <button
                  type="button"
                  key={preset}
                  onClick={() => setOverride(preset)}
                  className={`py-2.5 min-h-[44px] rounded-lg text-xs font-bold border transition ui-press ${
                    override === preset
                      ? 'accent-bg text-white accent-border'
                      : 'bg-slate-800/50 border-slate-700/50 text-slate-300 hover:bg-slate-700/50'
                  }`}
                  aria-label={`Set exercise rest to ${formatRestTime(preset)}`}
                  aria-pressed={override === preset}
                >
                  {formatRestTime(preset)}
                </button>
              ))}
            </div>
            <p className="ui-secondary !text-xs mt-3">
              Without an override this exercise follows the global default (currently {formatRestTime(normalizedGlobal)}).
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};
