import React, { useState, useMemo } from 'react';
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
  onReplaceExercise
}) => {
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [menuOpenIndex, setMenuOpenIndex] = useState(null);
  const [reordering, setReordering] = useState(false);

  // Calculate progress: completed sets / total sets
  const totalSets = useMemo(() => {
    return activeWorkout.exercises.reduce((sum, ex) => sum + (ex.sets?.length || 0), 0);
  }, [activeWorkout]);

  const completedSets = useMemo(() => {
    return activeWorkout.exercises.reduce((sum, ex) => sum + (ex.sets?.filter(s => s.completed).length || 0), 0);
  }, [activeWorkout]);

  const progressPercent = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;

  // Drag handlers
  const handleDragStart = (index) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (index) => {
    if (draggedIndex !== null && draggedIndex !== index) {
      const newExercises = [...activeWorkout.exercises];
      const [moved] = newExercises.splice(draggedIndex, 1);
      newExercises.splice(index, 0, moved);
      onReorderExercises(newExercises);
    }
    setDraggedIndex(null);
  };

  return (
    <div className="min-h-screen bg-zinc-900 text-white pb-32 flex flex-col">
      <div className="bg-zinc-800 p-4 sticky top-0 z-20 shadow-xl border-b border-zinc-700">
        <div className="flex justify-between items-center mb-2">
          <div className="flex gap-2">
            <button
              onClick={onMinimize}
              className="p-2 bg-zinc-700/50 hover:bg-zinc-700 rounded-full transition"
            >
              <ChevronDown size={20} />
            </button>
            <button
              onClick={onCancel}
              className="p-2 text-zinc-400 hover:text-red-400 transition"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex flex-col items-center">
            <span className="text-xs text-zinc-400 uppercase tracking-widest">Time</span>
            <span className="text-xl font-mono font-bold text-white">
              {formatTime(workoutTimer)}
            </span>
          </div>

          <button
            onClick={onFinish}
            className="bg-emerald-500 hover:bg-emerald-600 px-4 py-1.5 rounded-lg font-bold text-sm"
          >
            Finish
          </button>
        </div>

        <div className="flex justify-between items-end mb-3">
          <div>
            <h1 className="text-xl font-bold truncate max-w-[200px]">{activeWorkout.name}</h1>
            <p className="text-xs text-zinc-400">{formatDate(activeWorkout.date)}</p>
          </div>
          <button
            onClick={onAddNote}
            className={`p-2 rounded-lg ${activeWorkout.note ? 'text-amber-400 bg-amber-900/20' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <FileText size={20} />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-zinc-700 rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-rose-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="text-xs text-zinc-400 mt-1 text-center">
          {completedSets} / {totalSets} sets
        </div>
      </div>

      <div className="p-4 grow overflow-y-auto">
        {reordering && (
          <button
            onClick={() => setReordering(false)}
            className="w-full mb-4 bg-emerald-600 text-white py-2 rounded-lg font-bold"
          >
            Done Reordering
          </button>
        )}

        {activeWorkout.exercises.map((exercise, exIndex) => {
          const previousSets = getPreviousSets(exercise.exerciseId, workouts, activeWorkout.startTime);

          return (
            <div
              key={exIndex}
              draggable={reordering}
              onDragStart={() => handleDragStart(exIndex)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(exIndex)}
              className={`mb-4 ${reordering ? 'opacity-70 border-2 border-dashed border-rose-500 rounded-xl p-2' : ''}`}
            >
              <div className="flex items-center gap-2 mb-2">
                {reordering && (
                  <GripVertical size={18} className="text-zinc-500 cursor-move" />
                )}

                <div className="flex-1">
                  <div className="font-bold">{exercise.name}</div>
                  <div className="text-xs text-zinc-400">{exercise.category}</div>
                  {exercise.exerciseNote && (
                    <div className="text-xs text-amber-400 mt-1 bg-amber-900/20 p-2 rounded">
                      {exercise.exerciseNote}
                    </div>
                  )}
                </div>

                <div className="flex gap-1">
                  {!reordering && (
                    <button
                      onClick={() => setMenuOpenIndex(menuOpenIndex === exIndex ? null : exIndex)}
                      className="p-2 text-zinc-400 hover:text-zinc-300"
                    >
                      <MoreVertical size={18} />
                    </button>
                  )}
                </div>
              </div>

              {/* 3-dot menu */}
              {menuOpenIndex === exIndex && !reordering && (
                <div className="bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg z-30 mb-2">
                  <button
                    onClick={() => {
                      const note = prompt('Exercise note:', exercise.exerciseNote || '');
                      if (note !== null) onAddExerciseNote(exIndex, note);
                      setMenuOpenIndex(null);
                    }}
                    className="block w-full text-left px-4 py-2 text-sm hover:bg-zinc-700"
                  >
                    Edit Note
                  </button>
                  <button
                    onClick={() => {
                      setReordering(true);
                      setMenuOpenIndex(null);
                    }}
                    className="block w-full text-left px-4 py-2 text-sm hover:bg-zinc-700"
                  >
                    Reorder
                  </button>
                  <button
                    onClick={() => {
                      onReplaceExercise(exIndex);
                      setMenuOpenIndex(null);
                    }}
                    className="block w-full text-left px-4 py-2 text-sm hover:bg-zinc-700 text-blue-400"
                  >
                    Replace
                  </button>
                  <button
                    onClick={() => {
                      onDeleteExercise(exIndex);
                      setMenuOpenIndex(null);
                    }}
                    className="block w-full text-left px-4 py-2 text-sm hover:bg-zinc-700 text-red-400"
                  >
                    Delete
                  </button>
                </div>
              )}

              {!reordering && (
                <ActiveWorkoutExerciseCard
                  exercise={exercise}
                  exerciseIndex={exIndex}
                  onUpdateSet={onUpdateSet}
                  onToggleSet={onToggleSet}
                  onAddSet={onAddSet}
                  previousSets={previousSets}
                />
              )}
            </div>
          );
        })}

        <button
          onClick={onAddExercise}
          className="w-full py-4 border-2 border-dashed border-zinc-700 rounded-2xl text-zinc-500 font-bold hover:bg-zinc-800 hover:border-zinc-500 transition flex flex-col items-center gap-2"
        >
          <Plus size={24} />
          <span>Add Exercise</span>
        </button>
      </div>
    </div>
  );
};