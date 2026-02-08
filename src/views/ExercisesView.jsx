import React from 'react';
import { Plus } from 'lucide-react';
import { ExerciseCard } from '../components/ExerciseCard';

export const ExercisesView = ({ exercisesDB, onAddExercise, onEditExercise, onDeleteExercise, onViewDetail }) => {
  return (
    <div className="min-h-screen bg-black text-white pb-24 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-b from-black to-black/80 border-b border-white/10 p-4 shrink-0 shadow-2xl sticky top-0 z-20">
        <h1 className="text-4xl font-black">EXERCISES</h1>
        <p className="text-xs text-slate-400 mt-2 font-semibold tracking-widest">YOUR EXERCISE LIBRARY</p>
      </div>

      <div className="p-4 grow overflow-y-auto flex flex-col">
        {/* Add Exercise Button */}
        <button
          onClick={onAddExercise}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 transition text-white rounded-xl p-4 mb-5 font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/50 ui-press"
        >
          <Plus size={20} /> Add Exercise
        </button>

        {/* Exercise List */}
        {exercisesDB.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-slate-400 text-sm font-semibold">No exercises yet</p>
              <p className="text-slate-600 text-xs mt-2">Create your first exercise to get started</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 flex-1">
            {exercisesDB.map(exercise => (
              <ExerciseCard
                key={exercise.id}
                exercise={exercise}
                onViewDetail={() => onViewDetail(exercise.id)}
                onEditExercise={onEditExercise}
                onDeleteExercise={onDeleteExercise}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};