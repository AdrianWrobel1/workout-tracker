import React from 'react';
import { ChevronLeft, Save, X } from 'lucide-react';

export const CreateExerciseView = ({ exercise, onSave, onCancel, onChange }) => {
  return (
    <div className="min-h-screen bg-zinc-900 text-white pb-24">
      <div className="bg-zinc-800 p-4 flex items-center justify-between mb-6 shadow-md">
        <button onClick={onCancel}>
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">{exercise.id ? 'Edit' : 'Create'} Exercise</h1>
        <button onClick={onSave} className="text-emerald-400">
          <Save size={24} />
        </button>
      </div>
      <div className="p-6 space-y-6">
        <div>
          <label className="block text-sm text-zinc-400 mb-2">Name</label>
          <input
            type="text"
            value={exercise.name}
            onChange={(e) => onChange({ ...exercise, name: e.target.value })}
            placeholder="e.g., Bench Press"
            className="w-full bg-zinc-800 rounded-xl p-4 text-white border border-transparent focus:border-rose-500 outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Category</label>
            <select
              value={exercise.category || 'Push'}
              onChange={(e) => onChange({ ...exercise, category: e.target.value })}
              className="w-full bg-zinc-800 rounded-xl p-4 text-white border border-transparent focus:border-rose-500 outline-none appearance-none"
            >
              {['Push', 'Pull', 'Legs', 'Full Body', 'Cardio', 'Other'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Muscle Group</label>
            <input
              type="text"
              value={exercise.muscles ? exercise.muscles.join(', ') : ''}
              onChange={(e) => onChange({
                ...exercise,
                muscles: e.target.value.split(',').map(s => s.trim())
              })}
              placeholder="Chest, Triceps..."
              className="w-full bg-zinc-800 rounded-xl p-4 text-white border border-transparent focus:border-rose-500 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-2">Default Sets</label>
          <div className="space-y-2">
            {(exercise.defaultSets || [{ kg: 0, reps: 0 }]).map((set, i) => (
              <div key={i} className="grid grid-cols-[50px_1fr_1fr_40px] gap-2">
                <span className="text-zinc-400 flex items-center justify-center font-mono">{i + 1}</span>
                <input
                  type="number"
                  value={set.kg}
                  onChange={(e) => {
                    const updated = { ...exercise };
                    updated.defaultSets[i].kg = parseInt(e.target.value) || 0;
                    onChange(updated);
                  }}
                  placeholder="kg"
                  className="bg-zinc-700 rounded-lg p-3 text-white text-center"
                />
                <input
                  type="number"
                  value={set.reps}
                  onChange={(e) => {
                    const updated = { ...exercise };
                    updated.defaultSets[i].reps = parseInt(e.target.value) || 0;
                    onChange(updated);
                  }}
                  placeholder="reps"
                  className="bg-zinc-700 rounded-lg p-3 text-white text-center"
                />
                <button
                  onClick={() => {
                    const updated = { ...exercise };
                    if (updated.defaultSets.length > 1) {
                      updated.defaultSets.splice(i, 1);
                      onChange(updated);
                    }
                  }}
                  className="text-red-400 hover:bg-zinc-800 rounded p-1"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => {
              const updated = { ...exercise };
              if (!updated.defaultSets) updated.defaultSets = [];
              const last = updated.defaultSets[updated.defaultSets.length - 1] || { kg: 0, reps: 0 };
              updated.defaultSets.push({ ...last });
              onChange(updated);
            }}
            className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg p-3 text-sm mt-3 border border-dashed border-zinc-600"
          >
            + Add Set
          </button>
        </div>
      </div>
    </div>
  );
};