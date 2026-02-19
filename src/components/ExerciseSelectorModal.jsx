import React, { useMemo, useState } from 'react';
import { X, Plus, Search, ChevronRight } from 'lucide-react';

export const ExerciseSelectorModal = ({
  exercisesDB,
  onClose,
  onSelectExercise,
  onCreateNew,
  mode = 'activeWorkout'
}) => {
  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState('name'); // 'name' | 'muscle'

  const getPrimaryGroup = (exercise) => {
    const muscles = Array.isArray(exercise?.muscles) ? exercise.muscles.filter(Boolean) : [];
    return muscles[0] || exercise?.category || 'Other';
  };

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return (exercisesDB || [])
      .filter(e => (e?.name || '').toLowerCase().includes(query))
      .sort((a, b) => (a?.name || '').localeCompare(b?.name || ''));
  }, [exercisesDB, q]);

  const groupedByMuscle = useMemo(() => {
    if (sortBy !== 'muscle') return [];
    const groups = {};

    filtered.forEach((exercise) => {
      const group = getPrimaryGroup(exercise);
      if (!groups[group]) groups[group] = [];
      groups[group].push(exercise);
    });

    return Object.keys(groups)
      .sort((a, b) => a.localeCompare(b))
      .map(group => ({ group, items: groups[group] }));
  }, [filtered, sortBy]);

  const renderExerciseRow = (exercise) => (
    <button
      key={exercise.id}
      onClick={() => onSelectExercise(exercise)}
      className="w-full bg-slate-800/40 hover:bg-slate-800/60 border border-slate-700/50 hover:border-slate-600/50 rounded-lg p-4 text-left transition group"
    >
      <div className="flex justify-between items-center">
        <div className="flex-1 min-w-0">
          <div className="font-black text-white group-hover:text-blue-400 transition">{exercise.name}</div>
          <div className="text-xs text-slate-500 mt-1.5 font-semibold">
            {exercise.category || 'Other'} - {(exercise.muscles || []).join(', ') || 'General'}
          </div>
        </div>
        <ChevronRight size={18} className="text-slate-600 ml-3 shrink-0" />
      </div>
    </button>
  );

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-slate-900/95 to-black/95 border border-slate-700/50 rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl ui-modal-scale ui-fade-scale-anim">
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
          {mode === 'template' && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={() => setSortBy('name')}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition ${
                  sortBy === 'name'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800/50 border border-slate-700/50 text-slate-300 hover:text-white'
                }`}
              >
                Sort: A-Z
              </button>
              <button
                onClick={() => setSortBy('muscle')}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition ${
                  sortBy === 'muscle'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800/50 border border-slate-700/50 text-slate-300 hover:text-white'
                }`}
              >
                Sort: Muscle
              </button>
            </div>
          )}
        </div>

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
            ) : sortBy === 'muscle' ? (
              <div className="space-y-4">
                {groupedByMuscle.map(({ group, items }) => (
                  <div key={group}>
                    <p className="text-[11px] uppercase tracking-widest text-slate-500 font-bold mb-2">{group}</p>
                    <div className="space-y-2">
                      {items.map(renderExerciseRow)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              filtered.map(renderExerciseRow)
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
