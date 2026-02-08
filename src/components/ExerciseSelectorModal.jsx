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
      <div className="bg-gradient-to-br from-slate-900/95 to-black/95 border border-slate-700/50 rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl ui-modal-scale ui-fade-scale-anim">
        {/* Header */}
        <div className="p-4 border-b border-slate-700/50 shrink-0">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-black text-2xl text-white">SELECT EXERCISE</h2>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition text-slate-400">
              <X size={20} />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-3.5 text-slate-500" size={18} />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search exercise..."
              className="w-full bg-slate-800/50 border border-slate-600/50 rounded-lg pl-12 pr-4 py-2 text-white font-semibold focus:border-blue-500 focus:outline-none transition placeholder:text-slate-600"
            />
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto grow space-y-3">
          <button
            onClick={onCreateNew}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-lg p-4 font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/50 transition ui-press"
          >
            <Plus size={18} /> Create New
          </button>

          <div className="space-y-2 mt-4">
            {filtered.length === 0 ? (
              <div className="text-center text-slate-500 py-8 text-sm font-semibold">
                No exercises found
              </div>
            ) : (
              filtered.map(ex => (
                <button
                  key={ex.id}
                  onClick={() => onSelectExercise(ex)}
                  className="w-full bg-slate-800/40 hover:bg-slate-800/60 border border-slate-700/50 hover:border-slate-600/50 rounded-lg p-4 text-left transition group"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex-1 min-w-0">
                      <div className="font-black text-white group-hover:text-blue-400 transition">{ex.name}</div>
                      <div className="text-xs text-slate-500 mt-1.5 font-semibold">
                        {ex.category || 'Other'} • {ex.muscles?.join(', ') || 'General'}
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-slate-600 ml-3 shrink-0" />
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};