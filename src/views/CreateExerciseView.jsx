import React from 'react';
import { ChevronLeft, Save, X, Plus } from 'lucide-react';

export const CreateExerciseView = ({ exercise, onSave, onCancel, onChange }) => {
  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Header */}
      <div className="bg-gradient-to-b from-black to-black/80 border-b border-white/10 p-4 flex items-center justify-between sticky top-0 z-20 shadow-2xl">
        <button onClick={onCancel} className="p-2 hover:bg-white/10 rounded-lg transition">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-black">{exercise.id ? 'Edit' : 'Create'} Exercise</h1>
        <button onClick={onSave} className="p-2 hover:bg-green-500/20 rounded-lg transition text-green-400">
          <Save size={24} />
        </button>
      </div>

      <div className="p-4 space-y-5">
        {/* Name */}
        <div>
          <label className="block text-sm font-bold text-slate-300 mb-2 uppercase tracking-wider">Exercise Name</label>
          <input
            type="text"
            value={exercise.name}
            onChange={(e) => onChange({ ...exercise, name: e.target.value })}
            placeholder="e.g., Bench Press"
            className="w-full bg-slate-800/50 border border-slate-600/50 rounded-xl p-4 text-white text-lg font-bold focus:border-blue-500 focus:outline-none transition"
          />
        </div>

        {/* Category & Muscle Group */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2 uppercase tracking-wider">Category</label>
            <select
              value={exercise.category || 'Push'}
              onChange={(e) => onChange({ ...exercise, category: e.target.value })}
              className="w-full bg-slate-800/50 border border-slate-600/50 rounded-xl p-4 text-white font-bold focus:border-blue-500 focus:outline-none transition appearance-none"
            >
              {['Push', 'Pull', 'Legs', 'Full Body', 'Cardio', 'Other'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2 uppercase tracking-wider">Muscle Groups</label>
            <input
              type="text"
              value={exercise.muscles ? exercise.muscles.join(', ') : ''}
              onChange={(e) => onChange({
                ...exercise,
                muscles: e.target.value.split(',').map(s => s.trim()).filter(s => s)
              })}
              placeholder="Chest, Triceps..."
              className="w-full bg-slate-800/50 border border-slate-600/50 rounded-xl p-4 text-white font-bold text-sm focus:border-blue-500 focus:outline-none transition"
            />
          </div>
        </div>

        {/* Note */}
        <div>
          <label className="block text-sm font-bold text-slate-300 mb-2 uppercase tracking-wider">Form Cue / Note</label>
          <textarea
            value={exercise.note || ''}
            onChange={(e) => onChange({ ...exercise, note: e.target.value })}
            placeholder="E.g., 'Keep elbows high', 'Next time +2.5kg', 'Pause at bottom'..."
            className="w-full bg-slate-800/50 border border-slate-600/50 rounded-xl p-4 text-white text-sm focus:border-blue-500 focus:outline-none transition resize-none"
            rows="3"
          />
        </div>

        {/* Default Sets */}
        <div>
          <label className="block text-sm font-bold text-slate-300 mb-2 uppercase tracking-wider">Default Sets</label>
          <div className="space-y-2">
            {(exercise.defaultSets || [{ kg: 0, reps: 0 }]).map((set, i) => (
              <div key={`set-${i}-${set.kg}-${set.reps}`} className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-3 flex flex-wrap items-center gap-2 sm:flex-nowrap">
                <span className="text-slate-400 font-bold min-w-[30px]">{i + 1}.</span>
                <input
                  type="number"
                  value={set.kg}
                  onChange={(e) => {
                    const updated = { ...exercise };
                    updated.defaultSets[i].kg = parseInt(e.target.value) || 0;
                    onChange(updated);
                  }}
                  placeholder="kg"
                  className="w-20 sm:flex-1 bg-slate-700/50 border border-slate-600/50 rounded-lg p-2 text-white text-center font-bold text-sm focus:border-blue-500 focus:outline-none"
                />
                <span className="text-slate-400 font-bold">×</span>
                <input
                  type="number"
                  value={set.reps}
                  onChange={(e) => {
                    const updated = { ...exercise };
                    updated.defaultSets[i].reps = parseInt(e.target.value) || 0;
                    onChange(updated);
                  }}
                  placeholder="reps"
                  className="w-20 sm:flex-1 bg-slate-700/50 border border-slate-600/50 rounded-lg p-2 text-white text-center font-bold text-sm focus:border-blue-500 focus:outline-none"
                />
                <button
                  onClick={() => {
                    const updated = { ...exercise };
                    if (updated.defaultSets.length > 1) {
                      updated.defaultSets.splice(i, 1);
                      onChange(updated);
                    }
                  }}
                  className="text-red-400 hover:bg-red-500/10 rounded-lg p-2 transition flex-shrink-0"
                >
                  <X size={18} />
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
            className="w-full bg-blue-600/20 border border-blue-500/50 text-blue-300 font-bold rounded-lg p-3 mt-3 hover:bg-blue-600/30 transition flex items-center justify-center gap-2"
          >
            <Plus size={18} /> Add Set
          </button>
        </div>

        {/* Bodyweight Option */}
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
          <label className="inline-flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={!!exercise.usesBodyweight}
              onChange={(e) => onChange({ ...exercise, usesBodyweight: !!e.target.checked })}
              className="w-5 h-5 rounded-lg cursor-pointer accent-blue-500"
            />
            <span className="font-bold text-slate-200">Uses bodyweight (include profile weight in volume calculation)</span>
          </label>
        </div>
      </div>
    </div>
  );
};