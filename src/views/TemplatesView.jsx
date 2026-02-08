import React from 'react';
import { X, Plus } from 'lucide-react';
import { TemplateCard } from '../components/TemplateCard';

export const TemplatesView = ({
  templates,
  editingTemplate,
  onClose,
  onCreateNew,
  onEdit,
  onDelete,
  onSave,
  onChange,
  onAddExercise
}) => {
  if (editingTemplate) {
    return (
      <div className="min-h-screen bg-black text-white p-4 pb-24">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 gap-4">
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition">
            <X size={20} />
          </button>
          <h1 className="text-2xl font-black flex-1">EDIT TEMPLATE</h1>
          <button onClick={onSave} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition shadow-lg shadow-emerald-600/30">
            Save
          </button>
        </div>

        {/* Template Name Input */}
        <input
          type="text"
          value={editingTemplate.name}
          onChange={(e) => onChange({ ...editingTemplate, name: e.target.value })}
          placeholder="Template Name"
          className="w-full bg-slate-800/50 border border-slate-600/50 rounded-xl p-4 text-white text-lg font-black mb-6 focus:border-blue-500 focus:outline-none transition"
        />

        {/* Exercises */}
        <div className="space-y-3 mb-6">
          {editingTemplate.exercises.map((exercise, exIndex) => (
            <div key={exIndex} className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-xl p-4 relative">
              <button
                onClick={() => {
                  const updated = { ...editingTemplate };
                  updated.exercises.splice(exIndex, 1);
                  onChange(updated);
                }}
                className="absolute top-3 right-3 p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-600/20 rounded-lg transition border border-slate-700/50 hover:border-red-500/30"
              >
                <X size={14} />
              </button>

              <h3 className="font-black text-white mb-1">{exercise.name}</h3>
              <div className="text-xs text-slate-400 font-semibold mb-3 uppercase tracking-wider">{exercise.sets.length} sets planned</div>

              <div className="space-y-2 mb-3">
                {exercise.sets.map((set, sIndex) => (
                  <div key={sIndex} className="flex gap-2">
                    <input
                      type="number"
                      placeholder="kg"
                      value={set.kg ?? 0}
                      onChange={(e) => {
                        const updated = { ...editingTemplate };
                        updated.exercises[exIndex].sets[sIndex].kg = Number(e.target.value) || 0;
                        onChange(updated);
                      }}
                      className="flex-1 bg-slate-800/50 border border-slate-600/50 rounded-lg p-2 text-sm text-center text-white font-bold focus:border-blue-500 focus:outline-none"
                    />
                    <input
                      type="number"
                      placeholder="reps"
                      value={set.reps ?? 0}
                      onChange={(e) => {
                        const updated = { ...editingTemplate };
                        updated.exercises[exIndex].sets[sIndex].reps = Number(e.target.value) || 0;
                        onChange(updated);
                      }}
                      className="flex-1 bg-slate-800/50 border border-slate-600/50 rounded-lg p-2 text-sm text-center text-white font-bold focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                ))}
              </div>
              <button
                onClick={() => {
                  const updated = { ...editingTemplate };
                  updated.exercises[exIndex].sets.push({ kg: 0, reps: 0 });
                  onChange(updated);
                }}
                className="text-xs font-bold text-blue-400 hover:text-blue-300 transition"
              >
                + Set
              </button>
            </div>
          ))}
        </div>

        {/* Add Exercise Button */}
        <button onClick={onAddExercise} className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-xl p-4 font-bold shadow-lg shadow-blue-600/50 transition ui-press">
          + Add Exercise
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Header */}
      <div className="bg-gradient-to-b from-black to-black/80 border-b border-white/10 p-4 sticky top-0 z-20 shadow-2xl">
        <div className="flex justify-between items-center gap-4">
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition">
            <X size={20} />
          </button>
          <h1 className="text-4xl font-black flex-1">TEMPLATES</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Create New Button */}
        <button
          onClick={onCreateNew}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-xl p-4 font-bold shadow-lg shadow-blue-600/50 transition ui-press flex items-center justify-center gap-2"
        >
          <Plus size={20} /> Create New
        </button>

        {/* Templates List */}
        {templates.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-400 text-sm font-semibold">No templates yet</p>
            <p className="text-slate-600 text-xs mt-2">Create a template to quickly start workouts</p>
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map(template => (
              <TemplateCard
                key={template.id}
                template={template}
                onSelect={null}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};