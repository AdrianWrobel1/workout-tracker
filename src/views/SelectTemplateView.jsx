import React from 'react';
import { X } from 'lucide-react';
import { TemplateCard } from '../components/TemplateCard';

export const SelectTemplateView = ({ templates, onClose, onSelectTemplate, onEditTemplate }) => {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="bg-gradient-to-b from-black to-black/80 border-b border-white/10 p-4 sticky top-0 z-20 shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition">
            <X size={20} />
          </button>
          <h1 className="text-3xl font-black flex-1">START WORKOUT</h1>
        </div>
      </div>

      <div className="p-4 space-y-3 pb-24">
        {/* Empty Workout Option */}
        <button
          onClick={() => onSelectTemplate({ id: 'empty', name: 'Empty Workout', exercises: [] })}
          className="w-full bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-2 border-dashed border-slate-700/50 hover:border-slate-600/50 p-5 rounded-xl text-left transition-all group ui-fade-scale-anim"
        >
          <h3 className="font-black text-lg text-slate-300 group-hover:text-blue-400 transition">Empty Workout</h3>
          <p className="text-sm text-slate-500 mt-1">Start from scratch</p>
        </button>

        {/* Template List */}
        {templates.length === 0 ? (
          <div className="text-center py-12 px-4">
            <p className="text-slate-400 text-sm font-semibold">No templates yet</p>
            <p className="text-slate-600 text-xs mt-2">Create a template to quickly start workouts</p>
          </div>
        ) : (
          templates.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              onSelect={onSelectTemplate}
              onEdit={onEditTemplate}
              onDelete={null}
            />
          ))
        )}
      </div>
    </div>
  );
};