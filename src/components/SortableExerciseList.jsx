import React, { useRef, useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { GripVertical, MoreVertical, Link2, Edit2, Flame, Zap, Trash, Link, Minus } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ActiveWorkoutExerciseCard } from './ActiveWorkoutExerciseCard';
import { PlanGuidanceDisplay } from './PlanGuidanceDisplay';
import { getPreviousSets } from '../domain/workouts';
import { resolveRecommendation } from '../domain/progressionAdapter';
import { isWarmupSet } from '../domain/workoutExtensions';
import { getCurrentSetIndex, getExerciseProgress, describeProgressionState } from '../domain/activeWorkoutView';

/**
 * Single sortable exercise item
 */
function SortableExerciseItem({
  exercise,
  exIndex,
  workouts,
  activeWorkoutStartTime,
  templateLastSnapshot,
  menuOpenIndex,
  setMenuOpenIndex,
  onAddExerciseNote,
  onReplaceExercise,
  onDeleteExercise,
  onUpdateSet,
  onToggleSet,
  onAddSet,
  onAddNote,
  onDeleteSet,
  onToggleWarmup,
  onSetSetType,
  onAddWarmupSet,
  exercisesDB,
  deleteModeIndex,
  setDeleteModeIndex,
  warmupModeIndex,
  setWarmupModeIndex,
  onOpenKeypad,
  allExercises,
  onCreateSuperset,
  onRemoveSuperset,
  currentTemplate,
  currentPlan,
  onApplyRecommendation,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id: exercise.exerciseId + '-' + exIndex });

  const [showSupersetModal, setShowSupersetModal] = useState(false);
  const [exerciseSwapPulse, setExerciseSwapPulse] = useState(false);
  const [noteFocusPulse, setNoteFocusPulse] = useState(false);
  const [menuPosition, setMenuPosition] = useState(null);
  const menuRef = useRef(null);
  const menuButtonRef = useRef(null);
  const prevExerciseNameRef = useRef(exercise.name);

  const style = {
    transform: `${CSS.Transform.toString(transform)}${isDragging ? ' rotate(-1.25deg) scale(1.02)' : ''}`,
    transition,
    opacity: isDragging ? 0.9 : 1,
    zIndex: isDragging ? 100 : 'auto',
    boxShadow: isDragging ? '0 12px 26px rgba(37, 99, 235, 0.36)' : undefined,
  };

  useEffect(() => {
    if (prevExerciseNameRef.current !== exercise.name) {
      const start = setTimeout(() => setExerciseSwapPulse(true), 0);
      const timer = setTimeout(() => setExerciseSwapPulse(false), 320);
      prevExerciseNameRef.current = exercise.name;
      return () => {
        clearTimeout(start);
        clearTimeout(timer);
      };
    }
    prevExerciseNameRef.current = exercise.name;
    return undefined;
  }, [exercise.name]);

  // Generate consistent color for superset ID
  const getSupersetColor = (supersetId) => {
    if (!supersetId) return null;
    const colors = [
      { bg: 'bg-purple-500/20', border: 'border-purple-500', accent: 'text-purple-400' },
      { bg: 'bg-pink-500/20', border: 'border-pink-500', accent: 'text-pink-400' },
      { bg: 'bg-cyan-500/20', border: 'border-cyan-500', accent: 'text-cyan-400' },
      { bg: 'bg-indigo-500/20', border: 'border-indigo-500', accent: 'text-indigo-400' },
      { bg: 'bg-violet-500/20', border: 'border-violet-500', accent: 'text-violet-400' },
    ];
    const hash = supersetId.charCodeAt(0) + supersetId.charCodeAt(supersetId.length - 1);
    return colors[hash % colors.length];
  };

  const supersetColor = getSupersetColor(exercise.supersetId);

  const handleEditExerciseNote = () => {
    const exFromDB = exercisesDB?.find(e => e.id === exercise.exerciseId);
    const currentNote = exFromDB?.note || '';
    setNoteFocusPulse(true);
    setTimeout(() => {
      const newNote = prompt('Exercise note:', currentNote);
      if (newNote !== null) onAddExerciseNote(exIndex, newNote);
    }, 20);
    setTimeout(() => setNoteFocusPulse(false), 320);
  };

  const previousSets = getPreviousSets(exercise.exerciseId, workouts, activeWorkoutStartTime, templateLastSnapshot);

  // Progression recommendation (display only — never overwrites actuals).
  // Computed from persisted history + exercise policy via the canonical
  // adapter; null for OFF/legacy exercises (legacy placeholders unchanged).
  const recommendation = useMemo(() => {
    const dbExercise = exercisesDB?.find(e => e.id === exercise.exerciseId) || null;
    if (!dbExercise?.progression || dbExercise.progression.mode === 'off') return null;
    return resolveRecommendation({ exercise: dbExercise, workouts });
  }, [exercisesDB, exercise.exerciseId, workouts]);

  const hasEmptyPrescriptionSlot = (exercise.sets || []).some(
    s => s && !s.completed && !isWarmupSet(s) && (!(Number(s.kg) > 0) || !(Number(s.reps) > 0))
  );
  const showRecommendation = recommendation?.source === 'progression' && recommendation.prescription;
  const progressionBadge = showRecommendation ? describeProgressionState(recommendation.state) : null;

  // Derived execution position (pure read, never stored): which set is next
  // and how far through this exercise the user is.
  const currentSetIndex = getCurrentSetIndex(exercise);
  const exerciseProgress = getExerciseProgress(exercise);
  const nextSet = currentSetIndex >= 0 ? exercise.sets[currentSetIndex] : null;
  const nextSetHint = (() => {
    if (!nextSet) return null;
    if (Number(nextSet.kg) > 0 && Number(nextSet.reps) > 0) return `${nextSet.kg} kg × ${nextSet.reps}`;
    const suggestedKg = Number(nextSet.suggestedKg) || 0;
    const suggestedReps = Number(nextSet.suggestedReps) || 0;
    if (suggestedKg > 0 || suggestedReps > 0) return `suggested ${suggestedKg} kg × ${suggestedReps}`;
    const prevForNext = previousSets?.[currentSetIndex];
    if (prevForNext) return `last time ${prevForNext.kg} kg × ${prevForNext.reps}`;
    return null;
  })();
  
  // Auto-scroll on new set added
  const prevSetCountRef = useRef(exercise.sets.length);
  useEffect(() => {
    if (exercise.sets.length > prevSetCountRef.current) {
      // New set was added - scroll to the last set card
      setTimeout(() => {
        const lastSetCard = document.querySelector(`[data-exercise-index="${exIndex}"] [data-set-index="${exercise.sets.length - 1}"]`);
        if (lastSetCard) {
          lastSetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
    }
    prevSetCountRef.current = exercise.sets.length;
  }, [exercise.sets.length, exIndex]);

  useEffect(() => {
    const handleDocumentClick = (event) => {
      if (menuOpenIndex !== exIndex) return;
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpenIndex(null);
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, [menuOpenIndex, exIndex, setMenuOpenIndex]);

  useEffect(() => {
    if (menuOpenIndex !== exIndex) {
      return undefined;
    }

    const updateMenuPosition = () => {
      if (!menuButtonRef.current) return;

      const buttonRect = menuButtonRef.current.getBoundingClientRect();
      const menuWidth = 224;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const gap = 8;
      const top = Math.max(12, Math.min(viewportHeight - 12, buttonRect.bottom + gap));
      const left = Math.min(
        viewportWidth - menuWidth - 12,
        Math.max(12, buttonRect.right - menuWidth)
      );
      const maxHeight = Math.max(160, viewportHeight - top - 12);

      setMenuPosition({ top, left, width: menuWidth, maxHeight });
    };

    const rafId = window.requestAnimationFrame(updateMenuPosition);
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [menuOpenIndex, exIndex]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-exercise-index={exIndex}
      className={`relative ${menuOpenIndex === exIndex ? 'z-[60] shadow-2xl' : 'z-0'} ui-surface-secondary p-4 transition-all duration-200 ease-out ui-exercise-card-stagger ui-list-item-lift ui-active-exercise-card ${
        isDragging ? 'ui-drag-active ring-2 ring-blue-500/70' : ''
      } ${isOver ? 'bg-blue-500/15 border-blue-500/50 ring-2 ring-blue-500/30 scale-[1.01]' : ''} ${supersetColor ? `border-l-4 ${supersetColor.border}` : ''} ${exercise.supersetId ? 'ui-superset-active' : ''}` }
    >
      <div className="flex items-start justify-between mb-4 gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Drag Handle - always visible, easy to grab */}
          <button
            {...attributes}
            {...listeners}
            className="ui-drag-handle p-1 hover:bg-white/10 rounded-lg transition cursor-grab active:cursor-grabbing touch-none flex-shrink-0 mt-0.5"
            aria-label="Drag to reorder"
          >
            <GripVertical size={18} className="text-slate-500 hover:text-slate-300 transition" />
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {exercise.supersetId && (
                <div className={`p-1 rounded ${supersetColor.bg} flex-shrink-0`} aria-hidden="true">
                  <Link2 size={16} className={supersetColor.accent} />
                </div>
              )}
              <h3 className={`ui-card-title text-base truncate transition-all duration-200 ${exerciseSwapPulse ? 'ui-exercise-swap' : ''}`}>{exercise.name}</h3>
              <button
                onClick={handleEditExerciseNote}
                aria-label={`Edit note for ${exercise.name}`}
                className={`p-1.5 hover:bg-accent/20 rounded accent-text hover:opacity-80 transition flex-shrink-0 ui-note-focus-trigger min-w-[32px] min-h-[32px] flex items-center justify-center ${noteFocusPulse ? 'ui-note-focus-highlight' : ''}` }
                title="Edit exercise note"
              >
                <Edit2 size={13} aria-hidden="true" />
              </button>
            </div>
            <p className="ui-micro mt-1">{exercise.category}</p>
            {/* Execution position: answers "what set am I on / what comes
                next" with text, never color alone. */}
            <p className="ui-secondary mt-1 font-bold !text-slate-300" role="status">
              {exerciseProgress.total === 0 ? (
                <span>No sets yet — add one below</span>
              ) : exerciseProgress.isComplete ? (
                <span>All {exerciseProgress.total} sets done ✓</span>
              ) : (
                <span>
                  Set {exerciseProgress.currentSetNumber} of {exerciseProgress.total}
                  {nextSetHint ? <span className="text-slate-400 font-semibold"> · next: {nextSetHint}</span> : null}
                </span>
              )}
            </p>
            {currentPlan && (
              <div className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-bold text-blue-100 bg-blue-700/25 border border-blue-500/40 px-2 py-1 rounded-full">
                <span className="text-blue-300 tracking-wider">PLAN</span>
                <span className="truncate max-w-[160px]">{currentPlan.name}</span>
              </div>
            )}
            {(() => {
              const exFromDB = exercisesDB?.find(e => e.id === exercise.exerciseId);
              return exFromDB?.note && (
                <div className={`mt-2 text-xs accent-bg-light accent-border-light accent-text px-2 py-1 rounded ${noteFocusPulse ? 'ui-note-focus-highlight' : ''}`}>
                  {exFromDB.note}
                </div>
              );
            })()}
            {exercise.planNotes && currentTemplate && (
              <div className="mt-2 text-xs bg-blue-900/30 border border-blue-600/40 text-blue-200 px-2 py-1 rounded font-medium">
                <span className="font-bold tracking-wider text-[10px] text-blue-300">COACH NOTE · </span>{exercise.planNotes}
              </div>
            )}
          </div>
        </div>

        <div className="relative flex-shrink-0">
          <button
            ref={menuButtonRef}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setMenuOpenIndex(menuOpenIndex === exIndex ? null : exIndex);
            }}
            className="p-2 hover:bg-white/10 rounded-lg transition z-[50]"
          >
            <MoreVertical size={18} className="text-slate-400" />
          </button>
        </div>

          {menuOpenIndex === exIndex && typeof document !== 'undefined' && createPortal(
            <>
              <button
                type="button"
                aria-label="Close exercise menu"
                className="fixed inset-0 z-[110] bg-black/30"
                onClick={() => setMenuOpenIndex(null)}
              />
              <div
                ref={menuRef}
                className="fixed bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-[120] w-56 overflow-y-auto overflow-x-hidden ui-menu-pop"
                style={menuPosition ? { top: `${menuPosition.top}px`, left: `${menuPosition.left}px`, maxHeight: `${menuPosition.maxHeight}px` } : { visibility: 'hidden' }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Exercise Actions Section */}
                <div className="p-2">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-widest px-3 py-2">Exercise</div>
                  <button
                    onClick={() => {
                      onReplaceExercise(exIndex);
                      setMenuOpenIndex(null);
                    }}
                    className="flex items-center gap-3 w-full text-left px-3 py-2.5 text-sm hover:bg-slate-800 rounded-lg transition text-blue-400 font-medium"
                  >
                    <Edit2 size={16} className="flex-shrink-0" />
                    <span>Replace Exercise</span>
                  </button>
                </div>

                {/* Set Type Section */}
                <div className="border-t border-slate-700 p-2">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-widest px-3 py-2">Set Types</div>
                  <button
                    onClick={() => {
                      onAddWarmupSet(exIndex);
                      setMenuOpenIndex(null);
                    }}
                    className="flex items-center gap-3 w-full text-left px-3 py-2.5 text-sm hover:bg-slate-800 rounded-lg transition text-amber-400 font-medium"
                  >
                    <Flame size={16} className="flex-shrink-0" />
                    <span>Add Warmup Set</span>
                  </button>
                  <button
                    onClick={() => {
                      setWarmupModeIndex(warmupModeIndex === exIndex ? null : exIndex);
                      setMenuOpenIndex(null);
                    }}
                    className="flex items-center gap-3 w-full text-left px-3 py-2.5 text-sm hover:bg-slate-800 rounded-lg transition text-amber-300 font-medium"
                  >
                    <Zap size={16} className="flex-shrink-0" />
                    <span>Edit Set Types</span>
                  </button>
                </div>

                {/* Superset Section */}
                <div className="border-t border-slate-700 p-2">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-widest px-3 py-2">Superset</div>
                  {!exercise.supersetId && allExercises.length > 1 && (
                    <button
                      onClick={() => {
                        setShowSupersetModal(true);
                        setMenuOpenIndex(null);
                      }}
                      className="flex items-center gap-3 w-full text-left px-3 py-2.5 text-sm hover:bg-slate-800 rounded-lg transition text-purple-400 font-medium"
                    >
                      <Link size={16} className="flex-shrink-0" />
                      <span>Create Superset</span>
                    </button>
                  )}
                  {exercise.supersetId && (
                    <button
                      onClick={() => {
                        onRemoveSuperset(exIndex);
                        setMenuOpenIndex(null);
                      }}
                      className="flex items-center gap-3 w-full text-left px-3 py-2.5 text-sm hover:bg-slate-800 rounded-lg transition text-purple-300 font-medium"
                    >
                      <Minus size={16} className="flex-shrink-0" />
                      <span>Remove Superset</span>
                    </button>
                  )}
                </div>

                {/* Delete Section */}
                <div className="border-t border-slate-700 p-2">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-widest px-3 py-2">Delete</div>
                  <button
                    onClick={() => {
                      setDeleteModeIndex(deleteModeIndex === exIndex ? null : exIndex);
                      setMenuOpenIndex(null);
                    }}
                    className="flex items-center gap-3 w-full text-left px-3 py-2.5 text-sm hover:bg-red-500/20 rounded-lg transition text-red-400 font-medium mb-2"
                  >
                    <Trash size={16} className="flex-shrink-0" />
                    <span>Delete Sets</span>
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Delete this exercise?')) {
                        onDeleteExercise(exIndex);
                      }
                      setMenuOpenIndex(null);
                    }}
                    className="flex items-center gap-3 w-full text-left px-3 py-2.5 text-sm hover:bg-red-500/20 rounded-lg transition text-red-500 font-bold"
                  >
                    <Trash size={16} className="flex-shrink-0" />
                    <span>Delete Exercise</span>
                  </button>
                </div>
              </div>
            </>,
            document.body
          )}
          
          {/* Superset Modal */}
          {showSupersetModal && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setShowSupersetModal(false)}>
              <div className="bg-slate-900 w-full rounded-t-xl border border-slate-700 p-4 max-h-96 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-black text-white mb-4">Add to Superset</h3>
                <p className="text-xs text-slate-400 mb-4">Select another exercise to link:</p>
                
                <div className="space-y-2">
                  {allExercises.map((ex, idx) => {
                    if (idx === exIndex) return null; // Don't show current exercise
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          onCreateSuperset(exIndex, idx);
                          setShowSupersetModal(false);
                          setMenuOpenIndex(null);
                        }}
                        className="w-full text-left px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition"
                      >
                        <div className="font-bold text-white">{ex.name}</div>
                        <div className="text-xs text-slate-400">{ex.category}</div>
                      </button>
                    );
                  })}
                </div>
                
                <button
                  onClick={() => setShowSupersetModal(false)}
                  className="w-full mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 font-bold transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
      </div>

      {/* Delete mode - Toggle delete buttons on individual sets */}
      {deleteModeIndex === exIndex && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center justify-between gap-3 ui-delete-mode-attn">
          <div>
            <p className="text-sm font-bold text-red-400">🗑️ Delete mode active</p>
            <p className="text-xs text-red-300 mt-1">Tap trash button or swipe left to delete sets</p>
          </div>
          <button
            onClick={() => setDeleteModeIndex(null)}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded transition flex-shrink-0"
          >
            Done
          </button>
        </div>
      )}

      {/* Set type mode - slide/fade in-out panel */}
      <div
        className={`mb-4 overflow-hidden transition-all duration-200 ease-out ${
          warmupModeIndex === exIndex
            ? 'max-h-28 opacity-100 translate-y-0 ui-set-type-mode-in'
            : 'max-h-0 opacity-0 -translate-y-2 mb-0 pointer-events-none'
        }`}
      >
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-amber-400">Set type edit mode</p>
            <p className="text-xs text-amber-300 mt-1">Choose type directly per set from the selector</p>
          </div>
          <button
            onClick={() => setWarmupModeIndex(null)}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded transition flex-shrink-0"
          >
            Done
          </button>
        </div>
      </div>

      {/* Exercise Card */}
      {currentPlan && currentTemplate && (
        <div className="mb-2">
          <PlanGuidanceDisplay 
            template={currentTemplate}
            exercise={exercise}
            sets={exercise.sets || []}
            plan={currentPlan}
          />
        </div>
      )}
      {showRecommendation && (
        <div className="mb-2 ui-surface-sub !border-emerald-500/30 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-emerald-200">
              {progressionBadge && (
                <span
                  className="inline-flex items-center gap-1 mr-1.5 px-1.5 py-0.5 rounded-full border border-emerald-500/50 bg-emerald-600/20 text-emerald-100 text-[10px] font-black tracking-wide"
                  aria-label={`Progression status: ${progressionBadge.label}`}
                >
                  <span aria-hidden="true">{progressionBadge.icon}</span>
                  <span>{progressionBadge.label}</span>
                </span>
              )}
              Next target: {recommendation.prescriptionText}
            </p>
            {hasEmptyPrescriptionSlot && onApplyRecommendation && (
              <button
                type="button"
                onClick={() => onApplyRecommendation(exIndex)}
                className="shrink-0 px-3 py-1.5 min-h-[36px] rounded-lg bg-emerald-600/30 border border-emerald-500/50 text-emerald-100 text-xs font-black hover:bg-emerald-600/50 transition"
                aria-label={`Use recommended ${recommendation.prescriptionText}`}
              >
                Use
              </button>
            )}
          </div>
          <p className="ui-secondary !text-[11px] mt-0.5">Why: {recommendation.whyText}</p>
        </div>
      )}
      <ActiveWorkoutExerciseCard
        exercise={exercise}
        exerciseIndex={exIndex}
        previousSets={previousSets}
        currentSetIndex={currentSetIndex}
        onUpdateSet={onUpdateSet}
        onToggleSet={onToggleSet}
        onAddSet={onAddSet}
        onAddNote={onAddNote}
        onDeleteSet={onDeleteSet}
        onToggleWarmup={onToggleWarmup}
        onSetSetType={onSetSetType}
        deleteModeActive={deleteModeIndex === exIndex}
        warmupModeActive={warmupModeIndex === exIndex}
        onOpenKeypad={onOpenKeypad}
      />
    </div>
  );
}

/**
 * Sortable exercise list with dnd-kit
 * Handles drag & drop reordering with smooth animations
 */
export function SortableExerciseList({
  exercises,
  workouts,
  activeWorkoutStartTime,
  templateLastSnapshot = null,
  menuOpenIndex,
  setMenuOpenIndex,
  onReorderExercises,
  onAddExerciseNote,
  onReplaceExercise,
  onDeleteExercise,
  onUpdateSet,
  onToggleSet,
  onAddSet,
  onAddNote,
  onDeleteSet,
  onToggleWarmup,
  onSetSetType,
  onAddWarmupSet,
  exercisesDB,
  deleteModeIndex,
  setDeleteModeIndex,
  warmupModeIndex,
  setWarmupModeIndex,
  onOpenKeypad,
  onCreateSuperset,
  onRemoveSuperset,
  currentTemplate,
  currentPlan,
  onApplyRecommendation,
}) {
  // Configure sensors: PointerSensor (desktop), TouchSensor (mobile)
  // Delay touch sensor activation to prevent accidental triggers
  const sensors = useSensors(
    useSensor(PointerSensor, {
      distance: 8,
    }),
    useSensor(TouchSensor, {
      delay: 500, // 500ms long-press to start drag (safe during scroll)
      tolerance: 8,
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const activeIndex = exercises.findIndex(
        (ex) => ex.exerciseId + '-' + exercises.indexOf(ex) === active.id
      );
      const overIndex = exercises.findIndex(
        (ex) => ex.exerciseId + '-' + exercises.indexOf(ex) === over.id
      );

      if (activeIndex >= 0 && overIndex >= 0) {
        const newExercises = arrayMove(exercises, activeIndex, overIndex);
        onReorderExercises(newExercises);
      }
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={exercises.map((ex, idx) => ex.exerciseId + '-' + idx)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-3 ui-exercises-list-enter">
          {exercises.map((exercise, exIndex) => (
            <SortableExerciseItem
              key={exercise.exerciseId + '-' + exIndex}
              exercise={exercise}
              exIndex={exIndex}
              workouts={workouts}
              activeWorkoutStartTime={activeWorkoutStartTime}
              templateLastSnapshot={templateLastSnapshot}
              menuOpenIndex={menuOpenIndex}
              setMenuOpenIndex={setMenuOpenIndex}
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
              exercisesDB={exercisesDB}
              deleteModeIndex={deleteModeIndex}
              setDeleteModeIndex={setDeleteModeIndex}
              warmupModeIndex={warmupModeIndex}
              setWarmupModeIndex={setWarmupModeIndex}
              onOpenKeypad={onOpenKeypad}
              allExercises={exercises}
              onCreateSuperset={onCreateSuperset}
              onRemoveSuperset={onRemoveSuperset}
              currentTemplate={currentTemplate}
              currentPlan={currentPlan}
              onApplyRecommendation={onApplyRecommendation}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
