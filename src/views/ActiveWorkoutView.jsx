import React, { useState, useMemo, useRef } from 'react';
import { X, Plus, FileText, ChevronDown, GripVertical, Trash2, MoreVertical } from 'lucide-react';
import {ActiveWorkoutExerciseCard} from '../components/ActiveWorkoutExerciseCard';
import { formatDate, formatTime } from '../domain/calculations';
import { getPreviousSets } from '../domain/workouts';

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
  onAddWarmupSet
}) => {
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [menuOpenIndex, setMenuOpenIndex] = useState(null);
  const [reordering, setReordering] = useState(false);
  const containerRef = useRef(null);
  const itemRefs = useRef([]);
  const [deleteModeIndex, setDeleteModeIndex] = useState(null);
  const [warmupModeIndex, setWarmupModeIndex] = useState(null);
  const [selectedSwapIndex, setSelectedSwapIndex] = useState(null);

  // Calculate progress: completed sets / total sets
  const totalSets = useMemo(() => {
    return activeWorkout.exercises.reduce((sum, ex) => sum + (ex.sets?.length || 0), 0);
  }, [activeWorkout]);

  const completedSets = useMemo(() => {
    return activeWorkout.exercises.reduce((sum, ex) => sum + (ex.sets?.filter(s => s.completed).length || 0), 0);
  }, [activeWorkout]);

  const progressPercent = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;

  // Drag handlers (desktop)
  const handleDragStart = (index) => { if (reordering) setDraggedIndex(index); };
  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = (index) => {
    if (reordering && draggedIndex !== null && draggedIndex !== index) {
      const newExercises = [...activeWorkout.exercises];
      const [moved] = newExercises.splice(draggedIndex, 1);
      newExercises.splice(index, 0, moved);
      onReorderExercises(newExercises);
    }
    setDraggedIndex(null);
  };

  // Touch-based reordering (mobile)
  const handleTouchStart = (index) => (e) => {
    if (reordering) {
      setDraggedIndex(index);
      // initialize refs array
      itemRefs.current = itemRefs.current.slice(0, activeWorkout.exercises.length);
    }
  };

  const handleTouchMove = (e) => {
    if (!reordering || draggedIndex === null) return;
    const touch = e.touches[0];
    if (!touch) return;
    const y = touch.clientY;

    // find which index is under touch
    let targetIndex = null;
    for (let i = 0; i < itemRefs.current.length; i++) {
      const el = itemRefs.current[i];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (y >= rect.top && y <= rect.bottom) {
        targetIndex = i;
        break;
      }
    }

    if (targetIndex !== null && targetIndex !== draggedIndex) {
      const newExercises = [...activeWorkout.exercises];
      const [moved] = newExercises.splice(draggedIndex, 1);
      newExercises.splice(targetIndex, 0, moved);
      onReorderExercises(newExercises);
      setDraggedIndex(targetIndex);
    }
  };

  const handleTouchEnd = () => setDraggedIndex(null);

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

          <div className="flex items-center">
            <button
              onClick={onCancel}
              className="p-2 hover:bg-red-500/10 rounded-lg transition-colors hover:text-red-400"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Workout Title */}
        {/* Progress Info */}
        <div className="space-y-2.5">
          <div className="flex items-baseline justify-between">
            <p className="text-xs text-slate-400 font-semibold tracking-widest">PROGRESS</p>
            <p className="text-sm font-bold text-white">{completedSets} / {totalSets} Sets</p>
          </div>
            <div className="w-full h-2 bg-slate-800/50 rounded-full overflow-hidden border border-white/10">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-200 ease-out"
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
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4">
        {reordering && (
          <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center justify-between">
            <p className="text-sm font-bold text-emerald-400">Reordering mode</p>
            <button
              onClick={() => setReordering(false)}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded transition"
            >
              Done
            </button>
          </div>
        )}

        <div className="space-y-3">
          {activeWorkout.exercises.map((exercise, exIndex) => {
            const previousSets = getPreviousSets(exercise.exerciseId, workouts, activeWorkout.startTime);

            return (
              <div
                key={exIndex}
                ref={el => itemRefs.current[exIndex] = el}
                draggable={reordering}
                onDragStart={() => handleDragStart(exIndex)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(exIndex)}
                onTouchStart={handleTouchStart(exIndex)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onClick={(e) => {
                  if (selectedSwapIndex !== null) {
                    e.stopPropagation();
                    if (selectedSwapIndex === exIndex) {
                      setSelectedSwapIndex(null);
                      return;
                    }
                    const newExercises = [...activeWorkout.exercises];
                    const tmp = newExercises[selectedSwapIndex];
                    newExercises[selectedSwapIndex] = newExercises[exIndex];
                    newExercises[exIndex] = tmp;
                    onReorderExercises(newExercises);
                    setSelectedSwapIndex(null);
                  }
                }}
                className={`bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-xl p-4 transition-all duration-200 ease-out ${
                  reordering ? 'opacity-70 border-dashed border-2 border-blue-500' : ''
                } ${selectedSwapIndex === exIndex ? 'ring-2 ring-emerald-500' : ''}`}
              >
                <div className="flex items-start justify-between mb-4 gap-3">
                  <div className="flex-1 min-w-0">
                    {reordering && (
                      <GripVertical size={18} className="text-slate-500 mb-2 cursor-move" />
                    )}
                    <div>
                      <h3 className="text-lg font-black text-white">{exercise.name}</h3>
                      <p className="text-xs text-slate-400 mt-1 font-semibold">{exercise.category}</p>
                    </div>
                    {exercise.exerciseNote && (
                      <div className="mt-2 text-xs bg-amber-500/10 border border-amber-500/30 text-amber-400 px-2 py-1 rounded">
                        {exercise.exerciseNote}
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenuOpenIndex(menuOpenIndex === exIndex ? null : exIndex); }}
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
                            setReordering(true);
                            setMenuOpenIndex(null);
                          }}
                          className="block w-full text-left px-4 py-2 text-sm hover:bg-slate-800 border-b border-slate-700 transition"
                        >
                          Reorder
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
                            setDeleteModeIndex(deleteModeIndex === exIndex ? null : exIndex);
                            setMenuOpenIndex(null);
                          }}
                          className="block w-full text-left px-4 py-2 text-sm hover:bg-slate-800 transition text-red-400"
                        >
                          Delete Set
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {!reordering && (
                  <ActiveWorkoutExerciseCard
                    exercise={exercise}
                    exerciseIndex={exIndex}
                    onUpdateSet={onUpdateSet}
                    onToggleSet={onToggleSet}
                    onAddSet={onAddSet}
                    onDeleteSet={onDeleteSet}
                    onToggleWarmup={onToggleWarmup}
                    deleteModeActive={deleteModeIndex === exIndex}
                    warmupModeActive={warmupModeIndex === exIndex}
                    previousSets={previousSets}
                  />
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={onAddExercise}
          className="w-full mt-4 py-4 border-2 border-dashed border-slate-700 hover:border-slate-600 rounded-xl text-slate-400 hover:text-slate-300 font-bold transition-colors flex flex-col items-center gap-2"
        >
          <Plus size={24} />
          <span className="text-sm">Add Exercise</span>
        </button>
      </div>
    </div>
  );
};