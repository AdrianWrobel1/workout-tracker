import React from 'react';
import { X, Plus, Edit2, Trash2 } from 'lucide-react';

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
      <div className="min-h-screen bg-zinc-900 text-white p-6 pb-24">
        <div className="flex justify-between mb-6 items-center">
          <button onClick={onClose} className="p-2 bg-zinc-800 rounded-full">
            <X size={20} />
          </button>
          <h1 className="text-xl font-bold">Edit Template</h1>
          <button onClick={onSave} className="text-emerald-400 font-bold">Save</button>
        </div>

        <input
          type="text"
          value={editingTemplate.name}
          onChange={(e) => onChange({ ...editingTemplate, name: e.target.value })}
          placeholder="Template Name"
          className="w-full bg-zinc-800 rounded-xl p-4 text-white text-xl mb-6 font-bold border border-transparent focus:border-rose-500 outline-none"
        />

        <div className="space-y-4 mb-8">
          {editingTemplate.exercises.map((exercise, exIndex) => (
            <div key={exIndex} className="bg-zinc-800 rounded-xl p-4 border border-zinc-700 relative">
              <button
                onClick={() => {
                  const updated = { ...editingTemplate };
                  updated.exercises.splice(exIndex, 1);
                  onChange(updated);
                }}
                className="absolute top-2 right-2 text-zinc-600 hover:text-red-400"
              >
                <X size={16} />
              </button>

              <h3 className="font-bold text-white mb-2">{exercise.name}</h3>
              <div className="text-xs text-zinc-500 mb-3">{exercise.sets.length} sets planned</div>

              <div className="space-y-2">
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
                      className="w-full bg-zinc-900 rounded p-2 text-sm text-center"
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
                      className="w-full bg-zinc-900 rounded p-2 text-sm text-center"
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
                className="text-xs text-rose-400 mt-2 font-bold"
              >
                + Set
              </button>
            </div>
          ))}
        </div>

        <button onClick={onAddExercise} className="w-full bg-blue-600 text-white rounded-xl p-4 font-semibold shadow-lg shadow-blue-900/20">
          + Add Exercise
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-900 text-white p-6 pb-24">
      <div className="flex justify-between mb-6">
        <button onClick={onClose}>
          <X size={28} />
        </button>
        <h1 className="text-2xl font-bold">Templates</h1>
        <div className="w-7"></div>
      </div>
      <button
        onClick={onCreateNew}
        className="w-full bg-rose-500 text-white rounded-xl p-4 font-semibold mb-6 shadow-lg shadow-rose-900/20"
      >
        <Plus className="inline mr-2" size={20} /> Create New
      </button>
      <div className="space-y-4">
        {templates.map(template => (
          <div key={template.id} className="bg-zinc-800 rounded-xl p-4 flex justify-between items-center border border-zinc-800">
            <div>
              <h3 className="font-semibold text-lg">{template.name}</h3>
              <p className="text-sm text-zinc-400">{template.exercises.length} exercises</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => onEdit(template)} className="p-2 bg-zinc-700 rounded-lg text-blue-400">
                <Edit2 size={18} />
              </button>
              <button onClick={() => onDelete(template.id)} className="p-2 bg-zinc-700 rounded-lg text-red-400">
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};