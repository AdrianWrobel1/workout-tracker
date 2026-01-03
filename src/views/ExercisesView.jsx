import React from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';

export const ExercisesView = ({ exercisesDB, onAddExercise, onEditExercise, onDeleteExercise, onViewDetail }) => {
  return (
    <div className="min-h-screen bg-zinc-900 text-white pb-24 flex flex-col">
      <div className="bg-zinc-800 p-4 shrink-0 shadow-md z-10">
        <h1 className="text-2xl font-bold">Exercises</h1>
      </div>
      <div className="p-4 grow overflow-y-auto">
        <button
          onClick={onAddExercise}
          className="w-full bg-rose-500 hover:bg-rose-600 transition text-white rounded-xl p-4 mb-4 font-semibold flex items-center justify-center gap-2 shadow-lg shadow-rose-900/20"
        >
          <Plus size={20} /> Add Exercise
        </button>
        <div className="space-y-3">
          {exercisesDB.map(exercise => (
            <div
              key={exercise.id}
              onClick={() => onViewDetail(exercise.id)}
              className="bg-zinc-800 rounded-xl p-4 flex justify-between items-center cursor-pointer border border-zinc-800 hover:border-zinc-600 transition"
            >
              <div>
                <h3 className="font-semibold text-lg text-white">{exercise.name}</h3>
                <p className="text-xs text-zinc-400 uppercase font-bold tracking-wide mt-1">
                  {exercise.category || '—'} <span className="text-zinc-600">|</span> {exercise.muscles?.join(', ') || '—'}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); onEditExercise(exercise); }}
                  className="p-2 bg-zinc-700/50 hover:bg-zinc-700 rounded-lg text-blue-400 transition"
                >
                  <Edit2 size={18} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteExercise(exercise.id); }}
                  className="p-2 bg-zinc-700/50 hover:bg-zinc-700 rounded-lg text-red-400 transition"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
          {exercisesDB.length === 0 && <p className="text-zinc-500 text-center mt-6">Library is empty.</p>}
        </div>
      </div>
    </div>
  );
};