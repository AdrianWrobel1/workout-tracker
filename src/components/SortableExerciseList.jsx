import React from 'react';
import { GripVertical, MoreVertical } from 'lucide-react';
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
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: exercise.exerciseId + '-' + exIndex });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const previousSets = getPreviousSets(exercise.exerciseId, workouts, activeWorkoutStartTime);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-xl p-4 transition-all duration-200 ease-out ${
        isDragging ? 'ring-2 ring-blue-500 shadow-lg shadow-blue-500/20 scale-102' : ''
      }`}
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
            <h3 className="text-lg font-black text-white">{exercise.name}</h3>
            <p className="text-xs text-slate-400 mt-1 font-semibold">{exercise.category}</p>
            {exercise.exerciseNote && (
              <div className="mt-2 text-xs bg-amber-500/10 border border-amber-500/30 text-amber-400 px-2 py-1 rounded">
                {exercise.exerciseNote}
              </div>
            )}
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
            <div className="absolute right-0 mt-2 bg-slate-900 border border-slate-700 rounded-lg mb-4 overflow-hidden shadow-xl z-40">
              <button
                onClick={() => {
                  const note = prompt('Exercise note:', exercise.exerciseNote || '');
                  if (note !== null) onAddExerciseNote(exIndex, note);
                  setMenuOpenIndex(null);
                }}
                className="block w-full text-left px-4 py-2 text-sm hover:bg-slate-800 border-b border-slate-700 transition"
              >
                Edit Note
              </button>
              <button
                onClick={() => {
                  onReplaceExercise(exIndex);
                  setMenuOpenIndex(null);
                }}
                className="block w-full text-left px-4 py-2 text-sm hover:bg-slate-800 border-b border-slate-700 transition text-blue-400"
              >
                Replace
              </button>
              <button
                onClick={() => {
                  onAddWarmupSet(exIndex);
                  setMenuOpenIndex(null);
                }}
                className="block w-full text-left px-4 py-2 text-sm hover:bg-slate-800 border-b border-slate-700 transition text-amber-400"
              >
                Add Warmup
              </button>
              <button
                onClick={() => {
                  setWarmupModeIndex(warmupModeIndex === exIndex ? null : exIndex);
                  setMenuOpenIndex(null);
                }}
                className="block w-full text-left px-4 py-2 text-sm hover:bg-slate-800 border-b border-slate-700 transition"
              >
                Edit Warmup
              </button>
              <button
                onClick={() => {
                  if (confirm('Delete this exercise?')) {
                    onDeleteExercise(exIndex);
                  }
                  setMenuOpenIndex(null);
                }}
                className="block w-full text-left px-4 py-2 text-sm hover:bg-slate-800 transition text-red-400"
              >
                Delete Exercise
              </button>
              <button
                onClick={() => {
                  setDeleteModeIndex(deleteModeIndex === exIndex ? null : exIndex);
                  setMenuOpenIndex(null);
                }}
                className="block w-full text-left px-4 py-2 text-sm hover:bg-slate-800 transition text-red-500"
              >
                Delete Sets
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Delete mode - Toggle delete buttons on individual sets */}
      {deleteModeIndex === exIndex && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-sm font-bold text-red-400 mb-2">Delete mode active - tap trash button or swipe left to delete:</p>
          <button
            onClick={() => setDeleteModeIndex(null)}
            className="w-full px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold rounded transition"
          >
            Close delete mode
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
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
