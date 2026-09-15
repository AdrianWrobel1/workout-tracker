import React, { useEffect, useMemo, useState, useContext } from 'react';
import { X, Plus, ChevronDown, Check, ChevronUp, Timer, ClipboardList } from 'lucide-react';
import { SortableExerciseList } from '../components/SortableExerciseList';
import { SessionTimelineStrip } from '../components/SessionTimelineStrip';
import { PlanGuidanceDisplay } from '../components/PlanGuidanceDisplay';
import { TemplatesContext } from '../contexts/TemplatesContext';
import { useRestTimer } from '../contexts/RestTimerContext';
import { useSettings } from '../contexts/SettingsContext';
import { formatRestTime } from '../domain/restTimer';
import { formatTime } from '../domain/calculations';
import { getWorkoutProgress } from '../domain/activeWorkoutView';

export const ActiveWorkoutView = ({
  activeWorkout,
  workouts,
  workoutTimer,
  readiness,
  autosaveStatus,
  exercisesDB,
  onCancel,
  onFinish,
  onMinimize,
  onUpdateSet,
  onToggleSet,
  onAddSet,
  onAddExercise,
  onAddNote,
  onAddExerciseNote,
  onDeleteExercise,
  onReorderExercises,
  onReplaceExercise,
  onDeleteSet,
  onToggleWarmup,
  onSetSetType,
  onAddWarmupSet,
  onApplyRecommendation,
  onOpenKeypad,
  onCreateSuperset,
  onRemoveSuperset,
}) => {
  const [menuOpenIndex, setMenuOpenIndex] = useState(null);
  const [deleteModeIndex, setDeleteModeIndex] = useState(null);
  const [warmupModeIndex, setWarmupModeIndex] = useState(null);
  const [progressViewMode, setProgressViewMode] = useState('bar'); // 'bar' | 'timeline'
  const [finishTapPulse, setFinishTapPulse] = useState(false);
  const [showPlanSelector, setShowPlanSelector] = useState(false);

  const { templates, getActivePlan, selectPlanForTemplate } = useContext(TemplatesContext);
  const { timer: restTimer, finished: restFinished, startRest } = useRestTimer();
  const { restDurationSec } = useSettings();
  const templateId = activeWorkout?.templateId ?? null;
  const currentTemplate = templates?.find(t => t.id === templateId) ?? null;
  const currentPlan = getActivePlan?.(templateId) ?? null;

  const progressStats = useMemo(() => {
    const derived = getWorkoutProgress(activeWorkout);
    return {
      totalSets: derived.totalSets,
      completedSets: derived.completedSets,
      progressPercent: derived.percent,
      totalExercises: derived.totalExercises,
      completedExercises: derived.completedExercises,
      currentExerciseIndex: derived.currentExerciseIndex,
    };
  }, [activeWorkout]);

  const exercises = activeWorkout?.exercises ?? [];

  const isWorkoutLockedIn = progressStats.totalSets > 0 && progressStats.completedSets >= progressStats.totalSets;

  useEffect(() => {
    if (!finishTapPulse) return undefined;
    const timer = setTimeout(() => setFinishTapPulse(false), 320);
    return () => clearTimeout(timer);
  }, [finishTapPulse]);

  const autosaveLabel = useMemo(() => {
    if (!autosaveStatus || autosaveStatus.state === 'idle') return '';
    if (autosaveStatus.state === 'saving') return 'Saving...';
    if (autosaveStatus.state === 'error') return 'Error';
    if (autosaveStatus.state === 'saved') {
      const savedAt = autosaveStatus.savedAt ? new Date(autosaveStatus.savedAt) : null;
      if (!savedAt || Number.isNaN(savedAt.getTime())) return 'Saved';
      const hh = String(savedAt.getHours()).padStart(2, '0');
      const mm = String(savedAt.getMinutes()).padStart(2, '0');
      return `Saved ${hh}:${mm}`;
    }
    return '';
  }, [autosaveStatus]);

  const autosaveClass = useMemo(() => {
    if (!autosaveStatus) return 'text-slate-500';
    if (autosaveStatus.state === 'saving') return 'text-slate-300';
    if (autosaveStatus.state === 'saved') return 'text-emerald-300';
    if (autosaveStatus.state === 'error') return 'text-red-300';
    return 'text-slate-500';
  }, [autosaveStatus]);

  const autosaveMotionClass = useMemo(() => {
    if (!autosaveStatus) return '';
    if (autosaveStatus.state === 'saving') return 'ui-autosave-saving';
    if (autosaveStatus.state === 'saved') return 'ui-autosave-saved';
    if (autosaveStatus.state === 'error') return 'ui-autosave-error';
    return '';
  }, [autosaveStatus]);

  const readinessBadge = useMemo(() => {
    if (!readiness) return null;
    if (readiness.status === 'fatigue') return { label: 'Fatigue', className: 'text-amber-300 border-amber-500/30 bg-amber-500/10' };
    if (readiness.status === 'low') return { label: 'Low readiness', className: 'text-sky-300 border-sky-500/30 bg-sky-500/10' };
    return { label: 'Ready', className: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' };
  }, [readiness]);

  const readinessStatusKey = readiness?.status || 'none';

  const handleFinishPress = () => {
    if (isWorkoutLockedIn) setFinishTapPulse(true);
    onFinish();
  };

  const showRestAction = !restTimer && !restFinished;

  return (
    <div className="bg-black text-white pb-16 flex flex-col">
      {/* Compact execution header: identity + time + progress stay visible,
          everything else is tightened so the first exercise starts higher. */}
      <div className="sticky top-0 z-30 bg-black/95 backdrop-blur border-b border-white/10 px-3 pt-2.5 pb-2.5 shadow-2xl">
        <div className="flex items-center gap-1.5">
          <button
            onClick={onMinimize}
            aria-label="Minimize workout"
            className="p-2 hover:bg-white/10 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <ChevronDown size={20} className="text-slate-400" aria-hidden="true" />
          </button>

          <div className="flex-1 min-w-0 text-center">
            <h1 className="text-sm font-black text-white truncate" title={activeWorkout?.name || 'Workout'}>
              {activeWorkout?.name || 'Workout'}
            </h1>
            <p className="mt-0.5 text-xs font-bold text-slate-300 ui-metric" role="timer" aria-label={`Elapsed time ${formatTime(workoutTimer)}`}>
              {formatTime(workoutTimer)}
              <span className="ml-2 font-semibold text-slate-500">
                {progressStats.totalExercises > 0 && progressStats.currentExerciseIndex >= 0
                  ? `Ex ${progressStats.currentExerciseIndex + 1}/${progressStats.totalExercises} · `
                  : ''}
                {progressStats.completedSets}/{progressStats.totalSets} sets
              </span>
            </p>
          </div>

          <button
            onClick={onCancel}
            aria-label="Cancel workout"
            className="p-2 hover:bg-red-500/10 rounded-lg transition-colors hover:text-red-400 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {(autosaveLabel || readinessBadge) && (
          <div className="mt-1.5 flex items-center justify-center gap-1.5">
            {autosaveLabel && (
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-slate-700/70 bg-slate-900/65 overflow-hidden ${autosaveMotionClass}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  autosaveStatus?.state === 'saved'
                    ? 'bg-emerald-300'
                    : autosaveStatus?.state === 'error'
                    ? 'bg-red-300'
                    : 'bg-slate-300'
                }`} aria-hidden="true" />
                <span className={`text-[10px] font-semibold tracking-wide ${autosaveClass}`}>
                  {autosaveLabel}
                </span>
                {autosaveStatus?.state === 'saved' && (
                  <Check size={11} className="text-emerald-300" aria-hidden="true" />
                )}
              </span>
            )}
            {readinessBadge && (
              <span
                key={readinessStatusKey}
                className={`text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full border ui-readiness-morph ${readinessBadge.className}`}
              >
                {readinessBadge.label}
              </span>
            )}
          </div>
        )}

        {/* Plan Selector */}
        {currentTemplate?.plans && currentTemplate.plans.length > 0 && (
          <div className="relative mt-2">
            <button
              onClick={() => setShowPlanSelector(!showPlanSelector)}
              aria-expanded={showPlanSelector}
              className="w-full px-2.5 py-2 min-h-[44px] bg-slate-800/50 border border-slate-700/50 rounded-lg flex items-center justify-between hover:bg-slate-800 transition text-xs font-bold text-white"
            >
              <span className="flex items-center gap-1.5 min-w-0">
                <ClipboardList size={13} className="text-blue-300 shrink-0" aria-hidden="true" />
                <span className="text-slate-500 font-semibold">PLAN</span>
                <span className="truncate">{currentPlan?.name || 'Select plan'}</span>
                {currentPlan && (
                  <span className="text-[10px] text-slate-400 font-semibold shrink-0">{currentPlan.percentageRange.min}-{currentPlan.percentageRange.max}%</span>
                )}
              </span>
              <ChevronUp size={15} aria-hidden="true" className={`transition-transform shrink-0 ${showPlanSelector ? 'rotate-180' : 'rotate-0'}`} />
            </button>

            {showPlanSelector && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-lg z-40 max-h-60 overflow-y-auto">
                <button
                  onClick={() => {
                    selectPlanForTemplate?.(activeWorkout?.templateId, null);
                    setShowPlanSelector(false);
                  }}
                  className={`w-full px-3 py-2.5 min-h-[44px] text-left text-sm font-semibold border-b border-slate-700/30 ${currentPlan === null ? 'bg-blue-600/20 text-blue-100' : 'text-slate-300 hover:bg-slate-800/50'}`}
                >
                  No plan
                </button>
                {currentTemplate.plans.map(plan => (
                  <button
                    key={plan.id}
                    onClick={() => {
                      selectPlanForTemplate?.(activeWorkout?.templateId, plan);
                      setShowPlanSelector(false);
                    }}
                    className={`w-full px-3 py-2.5 min-h-[44px] text-left text-sm font-semibold border-b border-slate-700/30 last:border-b-0 transition ${
                      currentPlan?.id === plan.id
                        ? 'bg-blue-600/20 text-blue-100'
                        : 'text-slate-300 hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">{plan.name}</span>
                      <span className="text-[10px] text-slate-400 shrink-0">{plan.percentageRange.min}-{plan.percentageRange.max}%</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-2 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="ui-micro">Progress</p>
            <div className="flex items-center bg-slate-900/70 border border-slate-700/70 rounded-md overflow-hidden" role="group" aria-label="Progress view">
              <button
                onClick={() => setProgressViewMode('bar')}
                aria-pressed={progressViewMode === 'bar'}
                className={`px-2.5 py-1.5 min-h-[44px] text-[11px] font-bold transition ${
                  progressViewMode === 'bar' ? 'bg-slate-700 text-white' : 'text-slate-400'
                }`}
              >
                Bar
              </button>
              <button
                onClick={() => setProgressViewMode('timeline')}
                aria-pressed={progressViewMode === 'timeline'}
                className={`px-2.5 py-1.5 min-h-[44px] text-[11px] font-bold transition ${
                  progressViewMode === 'timeline' ? 'bg-slate-700 text-white' : 'text-slate-400'
                }`}
              >
                Timeline
              </button>
            </div>
          </div>
          <div className="relative min-h-[12px]">
            <div
              className={`ui-view-crossfade ${
                progressViewMode === 'bar'
                  ? 'opacity-100 scale-100 relative'
                  : 'opacity-0 scale-[0.985] absolute inset-0 pointer-events-none'
              }`}
            >
              <div className="w-full h-1.5 bg-slate-800/50 rounded-full overflow-hidden border border-white/10" role="progressbar" aria-label="Workout progress" aria-valuemin={0} aria-valuemax={progressStats.totalSets} aria-valuenow={progressStats.completedSets}>
                <div
                  className={`h-full accent-bg transition-all duration-200 ease-out ${isWorkoutLockedIn ? 'ui-progress-done-flash' : ''}`}
                  style={{ width: `${progressStats.progressPercent}%` }}
                />
              </div>
            </div>

            <div
              className={`ui-view-crossfade ${
                progressViewMode === 'timeline'
                  ? 'opacity-100 scale-100 relative'
                  : 'opacity-0 scale-[0.985] absolute inset-0 pointer-events-none'
              }`}
            >
              <SessionTimelineStrip activeWorkout={activeWorkout} />
            </div>
          </div>

          {/* Exercise jump nav: text-labeled chips (never color-only) that
              scroll to the exercise card. Preserves all entered work — it is
              a scroll only, never a state change. */}
          {exercises.length > 1 && (
            <nav aria-label="Jump to exercise" className="flex gap-1.5 overflow-x-auto pt-1 pb-0.5 -mx-0.5 px-0.5">
              {exercises.map((ex, idx) => {
                const sets = ex?.sets ?? [];
                const done = sets.length > 0 && sets.every(s => s?.completed === true);
                const isCurrent = idx === progressStats.currentExerciseIndex;
                return (
                  <button
                    key={`${ex?.exerciseId ?? 'ex'}-${idx}`}
                    type="button"
                    onClick={() => {
                      const el = document.querySelector(`[data-exercise-index="${idx}"]`);
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    aria-label={`Jump to exercise ${idx + 1} of ${exercises.length}: ${ex?.name ?? 'Exercise'}${done ? ', completed' : isCurrent ? ', current' : ''}`}
                    aria-current={isCurrent ? 'true' : undefined}
                    className={`shrink-0 min-h-[44px] px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition ui-press ${
                      done
                        ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200'
                        : isCurrent
                        ? 'border-sky-400/60 bg-sky-500/10 text-sky-100'
                        : 'border-slate-700/70 bg-slate-900/60 text-slate-300'
                    }`}
                  >
                    {idx + 1}. {(ex?.name ?? 'Exercise').length > 14 ? `${(ex?.name ?? '').slice(0, 13)}…` : (ex?.name ?? 'Exercise')}
                    {done ? ' ✓' : ''}
                  </button>
                );
              })}
            </nav>
          )}
        </div>

        <div className="mt-2 flex gap-2">
          <button
            onClick={handleFinishPress}
            className={`ui-finish-primary flex-1 py-2.5 min-h-[48px] font-bold text-sm ui-press ${isWorkoutLockedIn ? 'ui-finish-ready' : ''} ${finishTapPulse ? 'ui-finish-click-bounce' : ''}`}
          >
            Finish Workout
          </button>
          {showRestAction && (
            <button
              onClick={() => startRest(restDurationSec, 'manual')}
              className="ui-action-secondary px-3 min-h-[48px] text-slate-200 text-xs font-bold flex items-center gap-1.5 ui-press shrink-0"
              aria-label={`Start rest timer for ${formatRestTime(restDurationSec)}`}
            >
              <Timer size={15} aria-hidden="true" />
              <span>{formatRestTime(restDurationSec)}</span>
            </button>
          )}
        </div>
      </div>

      {exercises.length === 0 && (
        <div className="ui-surface-secondary mx-3 mt-3 p-4" role="status">
          <p className="ui-card-title">No exercises yet</p>
          <p className="ui-secondary mt-1">Add your first exercise below to start logging sets.</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 pt-3 pb-4 max-w-2xl mx-auto w-full">
        <SortableExerciseList
          exercises={activeWorkout.exercises}
          workouts={workouts}
          activeWorkoutStartTime={activeWorkout.startTime}
          templateLastSnapshot={currentTemplate?.lastWorkoutSnapshot ?? null}
          menuOpenIndex={menuOpenIndex}
          setMenuOpenIndex={setMenuOpenIndex}
          onReorderExercises={onReorderExercises}
          onAddExerciseNote={onAddExerciseNote}
          onReplaceExercise={onReplaceExercise}
          onDeleteExercise={onDeleteExercise}
          onUpdateSet={onUpdateSet}
          onToggleSet={onToggleSet}
          onAddSet={onAddSet}
          onAddNote={onAddNote}
          onDeleteSet={onDeleteSet}
          onToggleWarmup={onToggleWarmup}
          onSetSetType={onSetSetType}
          onAddWarmupSet={onAddWarmupSet}
          onApplyRecommendation={onApplyRecommendation}
          exercisesDB={exercisesDB}
          deleteModeIndex={deleteModeIndex}
          setDeleteModeIndex={setDeleteModeIndex}
          warmupModeIndex={warmupModeIndex}
          setWarmupModeIndex={setWarmupModeIndex}
          onOpenKeypad={onOpenKeypad}
          onCreateSuperset={onCreateSuperset}
          onRemoveSuperset={onRemoveSuperset}
          currentTemplate={currentTemplate}
          currentPlan={currentPlan}
        />

        <button
          onClick={onAddExercise}
          className="ui-action-secondary w-full mt-4 py-3 min-h-[52px] font-bold transition-colors flex flex-col items-center gap-1 ui-press"
          style={{ borderStyle: 'dashed' }}
        >
          <Plus size={22} aria-hidden="true" />
          <span className="text-sm">Add Exercise</span>
        </button>
      </div>
    </div>
  );
};
