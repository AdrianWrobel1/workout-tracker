import React, { useState } from 'react';
import { X, Plus, Search, ChevronRight } from 'lucide-react';

export const ExerciseSelectorModal = ({
  exercisesDB,
  onClose,
  onSelectExercise,
  onCreateNew
}) => {
  const [q, setQ] = useState('');
  const filtered = exercisesDB.filter(e =>
    e.name.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl border border-zinc-800">
        <div className="p-4 border-b border-zinc-800 shrink-0">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-xl text-white">Select Exercise</h2>
            <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400">
              <X size={20} />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-3.5 text-zinc-500" size={18} />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search exercise..."
              className="w-full bg-zinc-800 rounded-xl pl-10 p-3 text-white focus:ring-2 focus:ring-rose-500 outline-none"
            />
          </div>
        </div>

        <div className="p-4 overflow-y-auto grow">
          <button
            onClick={onCreateNew}
            className="w-full bg-rose-500 hover:bg-rose-600 transition text-white rounded-xl p-4 mb-4 font-semibold flex items-center justify-center gap-2 shadow-lg shadow-rose-900/20"
          >
            <Plus size={20} /> Create New Exercise
          </button>

          <div className="space-y-2">
            {filtered.map(ex => (
              <button
                key={ex.id}
                onClick={() => onSelectExercise(ex)}
                className="w-full bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-800 rounded-xl p-4 text-left transition group"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-semibold text-white group-hover:text-rose-400 transition">{ex.name}</div>
                    <div className="text-xs text-zinc-500 mt-1">
                      {ex.category || 'Other'} • {ex.muscles?.join(', ') || 'General'}
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-zinc-600" />
                </div>
              </button>
            ))}
            {filtered.length === 0 && <p className="text-zinc-500 text-center mt-8">No exercises found.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};