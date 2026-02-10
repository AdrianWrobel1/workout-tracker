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
      <div className="min-h-screen bg-black text-white pb-24">
        {/* Sticky Header */}
        <div className="sticky top-0 z-30 bg-gradient-to-b from-black to-black/80 border-b border-slate-700/50 px-4 py-3 flex justify-between items-center gap-3 shadow-lg">
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition text-slate-400 hover:text-white">
            <X size={24} />
          </button>
          <h1 className="text-xl font-black flex-1">Edit Template</h1>
          <button 
            onClick={onSave} 
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-lg transition shadow-lg shadow-emerald-600/30 ui-press"
          >
            Save
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Template Name */}
          <input
            type="text"
            value={editingTemplate.name}
            onChange={(e) => onChange({ ...editingTemplate, name: e.target.value })}
            placeholder="Template Name"
            className="w-full bg-slate-800/50 border border-slate-600/50 rounded-lg p-3 text-white font-black focus:border-blue-500 focus:outline-none transition"
          />

          {/* Exercises List */}
          <div className="space-y-3">
            {editingTemplate.exercises.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <p className="text-sm">No exercises yet</p>
              </div>
            ) : (
              editingTemplate.exercises.map((exercise, exIndex) => (
                <div 
                  key={exIndex} 
                  className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3 space-y-2"
                >
                  {/* Exercise Header */}
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-black text-white text-sm truncate">{exercise.name}</h3>
                      <p className="text-xs text-slate-500 mt-1">{exercise.category || 'Strength'}</p>
                    </div>
                    <button
                      onClick={() => {
                        const updated = { ...editingTemplate };
                        updated.exercises.splice(exIndex, 1);
                        onChange(updated);
                      }}
                      className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-600/20 rounded border border-slate-600/50 hover:border-red-500/30 transition flex-shrink-0"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Sets - Compact Layout */}
                  <div className="space-y-1.5 bg-slate-900/40 p-2 rounded">
                    {exercise.sets.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-2">No sets</p>
                    ) : (
                      exercise.sets.map((set, sIndex) => (
                        <div key={sIndex} className="flex gap-1.5 items-center text-xs">
                          <span className="text-slate-500 font-bold min-w-[1.5rem]">#{sIndex + 1}</span>
                          <input
                            type="number"
                            placeholder="kg"
                            value={set.kg ?? 0}
                            onChange={(e) => {
                              const updated = { ...editingTemplate };
                              updated.exercises[exIndex].sets[sIndex].kg = Number(e.target.value) || 0;
                              onChange(updated);
                            }}
                            className="w-12 bg-slate-800/60 border border-slate-600/50 rounded p-1 text-center text-white font-bold text-xs focus:border-blue-500 focus:outline-none"
                          />
                          <span className="text-slate-500">×</span>
                          <input
                            type="number"
                            placeholder="reps"
                            value={set.reps ?? 0}
                            onChange={(e) => {
                              const updated = { ...editingTemplate };
                              updated.exercises[exIndex].sets[sIndex].reps = Number(e.target.value) || 0;
                              onChange(updated);
                            }}
                            className="w-12 bg-slate-800/60 border border-slate-600/50 rounded p-1 text-center text-white font-bold text-xs focus:border-blue-500 focus:outline-none"
                          />
                          <button
                            onClick={() => {
                              const updated = { ...editingTemplate };
                              updated.exercises[exIndex].sets.splice(sIndex, 1);
                              onChange(updated);
                            }}
                            className="ml-auto p-1 text-slate-500 hover:text-red-400 hover:bg-red-600/20 rounded border border-slate-600/50 hover:border-red-500/30 transition"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add Set Button */}
                  <button
                    onClick={() => {
                      const updated = { ...editingTemplate };
                      updated.exercises[exIndex].sets.push({ kg: 0, reps: 0 });
                      onChange(updated);
                    }}
                    className="w-full py-1.5 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-600/10 border border-blue-600/30 rounded transition font-bold"
                  >
                    + Set
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Add Exercise Button */}
          <button 
            onClick={onAddExercise} 
            className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-lg p-3 font-bold text-sm shadow-lg shadow-blue-600/30 transition ui-press"
          >
            + Add Exercise
          </button>
        </div>
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