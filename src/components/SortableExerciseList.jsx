import React, { useRef, useEffect, useState } from 'react';
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
import { getPreviousSets } from '../domain/workouts';

/**
 * Single sortable exercise item
 */
function SortableExerciseItem({
  exercise,
  exIndex,
  workouts,
  activeWorkoutStartTime,
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
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: exercise.exerciseId + '-' + exIndex });

  const [showSupersetModal, setShowSupersetModal] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

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
  const otherSupersetExercises = exercise.supersetId 
    ? allExercises.filter((ex, idx) => ex.supersetId === exercise.supersetId && idx !== exIndex)
    : [];

  const previousSets = getPreviousSets(exercise.exerciseId, workouts, activeWorkoutStartTime);
  
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-exercise-index={exIndex}
      className={`bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-xl p-4 transition-all duration-200 ease-out ${
        isDragging ? 'ring-2 ring-blue-500 shadow-lg shadow-blue-500/20 scale-102' : ''
      } ${supersetColor ? `border-l-4 ${supersetColor.border}` : ''}`}
    >
      <div className="flex items-start justify-between mb-4 gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Drag Handle - always visible, easy to grab */}
          <button
            {...attributes}
            {...listeners}
            className="p-1 hover:bg-white/10 rounded-lg transition cursor-grab active:cursor-grabbing touch-none flex-shrink-0 mt-0.5"
            aria-label="Drag to reorder"
          >
            <GripVertical size={18} className="text-slate-500 hover:text-slate-300 transition" />
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {exercise.supersetId && (
                <div className={`p-1 rounded ${supersetColor.bg} flex-shrink-0`}>
                  <Link2 size={16} className={supersetColor.accent} />
                </div>
              )}
              <h3 className="text-lg font-black text-white">{exercise.name}</h3>
              <button
                onClick={() => {
                  const exFromDB = exercisesDB?.find(e => e.id === exercise.exerciseId);
                  const currentNote = exFromDB?.note || '';
                  const newNote = prompt('Exercise note:', currentNote);
                  if (newNote !== null) onAddExerciseNote(exIndex, newNote);
                }}
                className="p-1 hover:bg-accent/20 rounded accent-text hover:opacity-80 transition flex-shrink-0"
                title="Edit exercise note"
              >
                📝
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-1 font-semibold">{exercise.category}</p>
            {(() => {
              const exFromDB = exercisesDB?.find(e => e.id === exercise.exerciseId);
              return exFromDB?.note && (
                <div className="mt-2 text-xs accent-bg-light accent-border-light accent-text px-2 py-1 rounded">
                  {exFromDB.note}
                </div>
              );
            })()}
          </div>
        </div>

        <div className="relative flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpenIndex(menuOpenIndex === exIndex ? null : exIndex);
            }}
            className="p-2 hover:bg-white/10 rounded-lg transition"
          >
            <MoreVertical size={18} className="text-slate-400" />
          </button>

          {menuOpenIndex === exIndex && (
            <div className="absolute right-0 mt-2 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-40 w-56 overflow-hidden">
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
              
              {/* Warmup Section */}
              <div className="border-t border-slate-700 p-2">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest px-3 py-2">Warmup</div>
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
                  <span>Edit Warmup Sets</span>
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
      </div>

      {/* Delete mode - Toggle delete buttons on individual sets */}
      {deleteModeIndex === exIndex && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center justify-between gap-3">
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

      {/* Warmup mode - Toggle warmup on individual sets */}
      {warmupModeIndex === exIndex && (
        <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-amber-400">🔥 Warmup edit mode</p>
            <p className="text-xs text-amber-300 mt-1">Toggle warmup sets or swipe to delete</p>
          </div>
          <button
            onClick={() => setWarmupModeIndex(null)}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded transition flex-shrink-0"
          >
            Done
          </button>
        </div>
      )}

      {/* Exercise Card */}
      <ActiveWorkoutExerciseCard
        exercise={exercise}
        exerciseIndex={exIndex}
        previousSets={previousSets}
        onUpdateSet={onUpdateSet}
        onToggleSet={onToggleSet}
        onAddSet={onAddSet}
        onAddNote={onAddNote}
        onDeleteSet={onDeleteSet}
        onToggleWarmup={onToggleWarmup}
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
  onAddWarmupSet,
  exercisesDB,
  deleteModeIndex,
  setDeleteModeIndex,
  warmupModeIndex,
  setWarmupModeIndex,
  onOpenKeypad,
  onCreateSuperset,
  onRemoveSuperset,
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
        <div className="space-y-3">
          {exercises.map((exercise, exIndex) => (
            <SortableExerciseItem
              key={exercise.exerciseId + '-' + exIndex}
              exercise={exercise}
              exIndex={exIndex}
              workouts={workouts}
              activeWorkoutStartTime={activeWorkoutStartTime}
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
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
