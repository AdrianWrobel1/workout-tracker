import React, { useState, useMemo, useRef, useEffect } from 'react';
import { X, Plus, FileText, ChevronDown } from 'lucide-react';
import { SortableExerciseList } from '../components/SortableExerciseList';
import { formatDate, formatTime } from '../domain/calculations';

export const ActiveWorkoutView = ({
  activeWorkout,
  workouts,
  workoutTimer,
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
  onAddWarmupSet,
  onOpenKeypad,
  onCreateSuperset,
  onRemoveSuperset,
}) => {
  const [menuOpenIndex, setMenuOpenIndex] = useState(null);
  const [deleteModeIndex, setDeleteModeIndex] = useState(null);
  const [warmupModeIndex, setWarmupModeIndex] = useState(null);

  // OPTIMIZED: Use refs instead of expensive reduce() on every set edit
  // Recalculate only when exercise count changes, not on every set edit keystroke
  const totalSetCountRef = useRef(0);
  const completedSetCountRef = useRef(0);

  useEffect(() => {
    totalSetCountRef.current = activeWorkout.exercises.reduce(
      (sum, ex) => sum + (ex.sets?.length || 0), 
      0
    );
    completedSetCountRef.current = activeWorkout.exercises.reduce(
      (sum, ex) => sum + (ex.sets?.filter(s => s.completed).length || 0), 
      0
    );
  }, [activeWorkout.exercises.length]); // Only depend on exercise count

  const progressPercent = totalSetCountRef.current > 0 ? (completedSetCountRef.current / totalSetCountRef.current) * 100 : 0;



  return (
    <div className="min-h-screen bg-black text-white pb-24 flex flex-col">
      {/* Sticky Header - Workout Info & Timer */}
      <div className="sticky top-0 z-30 bg-gradient-to-b from-black to-black/80 border-b border-white/10 px-4 pt-4 pb-4 shadow-2xl">
        {/* Top Action Row */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onMinimize}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <ChevronDown size={20} className="text-slate-400" />
          </button>

          <div className="text-center flex-1">
            <p className="text-xs text-slate-500 font-semibold tracking-widest mb-1">ELAPSED TIME</p>
            <div className="text-sm font-black">{formatTime(workoutTimer)}</div>
          </div>

          <button
            onClick={onCancel}
            className="p-2 hover:bg-red-500/10 rounded-lg transition-colors hover:text-red-400"
          >
            <X size={20} />
          </button>
        </div>

        {/* Workout Title */}
        {/* Progress Info */}
        <div className="space-y-2.5">
          <div className="flex items-baseline justify-between">
            <p className="text-xs text-slate-400 font-semibold tracking-widest">PROGRESS</p>
            <p className="text-sm font-bold text-white">{completedSetCountRef.current} / {totalSetCountRef.current} Sets</p>
          </div>
            <div className="w-full h-2 bg-slate-800/50 rounded-full overflow-hidden border border-white/10">
            <div
              className="h-full bg-gradient-to-r from-accent to-accent transition-all duration-200 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Finish Button */}
        <button
          onClick={onFinish}
          className="w-full mt-4 py-3 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold rounded-xl transition-all duration-200 ease-out shadow-lg shadow-emerald-900/50 ui-press"
        >
          Finish Workout
        </button>
      </div>

      {/* Exercises Scroll Area */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 pt-3 sm:pt-4 pb-4">
        <SortableExerciseList
          exercises={activeWorkout.exercises}
          workouts={workouts}
          activeWorkoutStartTime={activeWorkout.startTime}
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
          onAddWarmupSet={onAddWarmupSet}
          exercisesDB={exercisesDB}
          deleteModeIndex={deleteModeIndex}
          setDeleteModeIndex={setDeleteModeIndex}
          warmupModeIndex={warmupModeIndex}
          setWarmupModeIndex={setWarmupModeIndex}
          onOpenKeypad={onOpenKeypad}
          onCreateSuperset={onCreateSuperset}
          onRemoveSuperset={onRemoveSuperset}
        />

        <button
          onClick={onAddExercise}
          className="w-full mt-4 py-3 sm:py-4 border-2 border-dashed border-slate-700 hover:border-slate-600 rounded-xl text-slate-400 hover:text-slate-300 font-bold transition-colors flex flex-col items-center gap-2"
        >
          <Plus size={24} />
          <span className="text-sm">Add Exercise</span>
        </button>
      </div>
    </div>
  );
};