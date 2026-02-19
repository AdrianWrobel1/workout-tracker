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
      <div className="min-h-screen bg-black text-white pb-32">
        <div className="sticky top-0 z-30 bg-gradient-to-b from-black to-black/90 border-b border-slate-700/50 px-4 py-3 flex items-center gap-3 shadow-lg">
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition text-slate-400 hover:text-white">
            <X size={22} />
          </button>
          <h1 className="text-lg sm:text-xl font-black flex-1 truncate">Edit Template</h1>
          <button
            onClick={onSave}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-lg transition shadow-lg shadow-emerald-600/30 ui-press"
          >
            Save
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-slate-900/40 border border-slate-700/50 rounded-xl p-4">
            <label className="text-xs text-slate-400 font-semibold tracking-widest uppercase">Template Name</label>
            <input
              type="text"
              value={editingTemplate.name}
              onChange={(e) => onChange({ ...editingTemplate, name: e.target.value })}
              placeholder="Template Name"
              className="touch-input mt-2 w-full bg-slate-800/60 border border-slate-600/50 rounded-xl text-white font-bold focus:border-accent focus:outline-none focus:accent-ring transition"
            />
          </div>

          <div className="space-y-3">
            {editingTemplate.exercises.length === 0 ? (
              <div className="text-center py-10 text-slate-400 border border-dashed border-slate-700/60 rounded-xl bg-slate-900/30">
                <p className="text-sm font-semibold">No exercises yet</p>
                <p className="text-xs text-slate-500 mt-1">Add your first exercise to build this template</p>
              </div>
            ) : (
              editingTemplate.exercises.map((exercise, exIndex) => (
                <div
                  key={exIndex}
                  className="bg-slate-900/45 border border-slate-700/50 rounded-xl p-4 space-y-3"
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-black text-white text-base truncate">{exercise.name}</h3>
                      <p className="text-xs text-slate-500 mt-1">{exercise.category || 'Strength'}</p>
                    </div>
                    <button
                      onClick={() => {
                        const updated = { ...editingTemplate };
                        updated.exercises.splice(exIndex, 1);
                        onChange(updated);
                      }}
                      className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-600/20 rounded-lg border border-slate-600/50 hover:border-red-500/30 transition flex-shrink-0"
                      title="Delete exercise"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {(exercise.sets || []).length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-3 bg-slate-900/50 rounded-lg border border-slate-700/40">
                        No sets
                      </p>
                    ) : (
                      (exercise.sets || []).map((set, sIndex) => (
                        <div key={sIndex} className="bg-slate-900/60 border border-slate-700/50 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-slate-400 font-bold">SET #{sIndex + 1}</span>
                            <button
                              onClick={() => {
                                const updated = { ...editingTemplate };
                                updated.exercises[exIndex].sets.splice(sIndex, 1);
                                onChange(updated);
                              }}
                              className="p-1 text-red-400 hover:text-red-300 transition"
                            >
                              <X size={14} />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="text-[11px] text-slate-500 font-semibold">
                              KG
                              <input
                                type="number"
                                inputMode="decimal"
                                placeholder="0"
                                value={set.kg ?? 0}
                                onChange={(e) => {
                                  const updated = { ...editingTemplate };
                                  updated.exercises[exIndex].sets[sIndex].kg = Number(e.target.value) || 0;
                                  onChange(updated);
                                }}
                                className="touch-input mt-1 w-full bg-slate-800/70 border border-slate-600/50 rounded-lg text-white font-bold focus:border-accent focus:outline-none"
                              />
                            </label>
                            <label className="text-[11px] text-slate-500 font-semibold">
                              REPS
                              <input
                                type="number"
                                inputMode="decimal"
                                placeholder="0"
                                value={set.reps ?? 0}
                                onChange={(e) => {
                                  const updated = { ...editingTemplate };
                                  updated.exercises[exIndex].sets[sIndex].reps = Number(e.target.value) || 0;
                                  onChange(updated);
                                }}
                                className="touch-input mt-1 w-full bg-slate-800/70 border border-slate-600/50 rounded-lg text-white font-bold focus:border-accent focus:outline-none"
                              />
                            </label>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <button
                    onClick={() => {
                      const updated = { ...editingTemplate };
                      updated.exercises[exIndex].sets.push({ kg: 0, reps: 0 });
                      onChange(updated);
                    }}
                    className="w-full py-2.5 text-xs accent-text hover:opacity-80 hover:accent-bg-light accent-border-light rounded-lg transition font-bold"
                  >
                    + Add Set
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-gradient-to-t from-black via-black/95 to-transparent border-t border-slate-800/60">
          <div className="w-full max-w-2xl mx-auto flex flex-col sm:flex-row gap-2">
            <button
              onClick={onAddExercise}
              className="flex-1 accent-bg hover:opacity-90 text-white rounded-lg p-3 font-bold text-sm shadow-lg shadow-accent/30 transition ui-press"
            >
              + Add Exercise
            </button>
            <button
              onClick={onSave}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg p-3 font-bold text-sm transition shadow-lg shadow-emerald-600/30"
            >
              Save Template
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      <div className="bg-gradient-to-b from-black to-black/80 border-b border-white/10 p-4 sticky top-0 z-20 shadow-2xl">
        <div className="flex justify-between items-center gap-4">
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition">
            <X size={20} />
          </button>
          <h1 className="text-4xl font-black flex-1">TEMPLATES</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <button
          onClick={onCreateNew}
          className="w-full bg-gradient-accent hover:opacity-90 text-white rounded-xl p-4 font-bold shadow-lg transition ui-press flex items-center justify-center gap-2"
          style={{ boxShadow: `0 10px 25px -5px var(--accent)` }}
        >
          <Plus size={20} /> Create New
        </button>

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
