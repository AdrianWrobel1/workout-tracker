import React from 'react';
import { X } from 'lucide-react';

export const SelectTemplateView = ({ templates, onClose, onSelectTemplate, onEditTemplate }) => {
  return (
    <div className="min-h-screen bg-zinc-900 text-white p-6">
      <div className="flex items-center justify-between mb-8">
        <button onClick={onClose} className="p-2 bg-zinc-800 rounded-full">
          <X size={24} />
        </button>
        <h1 className="text-2xl font-bold">Start Workout</h1>
        <div className="w-10"></div>
      </div>

      <div className="space-y-4">
        <button
          onClick={() => onSelectTemplate({ id: 'empty', name: 'Empty Workout', exercises: [] })}
          className="w-full bg-zinc-800 border border-zinc-700 p-5 rounded-2xl text-left hover:bg-zinc-700 transition"
        >
          <h3 className="font-bold text-lg text-white">Empty Workout</h3>
          <p className="text-sm text-zinc-500">Start from scratch</p>
        </button>

        {templates.map(template => (
          <div
            key={template.id}
            className="w-full bg-zinc-800 p-5 rounded-2xl text-left border border-zinc-800 flex items-start justify-between hover:bg-zinc-700 transition group"
          >
            <button
              onClick={() => onSelectTemplate(template)}
              className="flex-1 text-left"
            >
              <h3 className="font-bold text-lg text-rose-400 mb-1">{template.name}</h3>
              <p className="text-sm text-zinc-400">{template.exercises.length} exercises</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {template.exercises.slice(0, 3).map((ex, i) => (
                  <span key={i} className="text-[10px] bg-zinc-900 px-2 py-1 rounded text-zinc-500">
                    {ex.name}
                  </span>
                ))}
                {template.exercises.length > 3 && <span className="text-[10px] text-zinc-600 px-1">...</span>}
              </div>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditTemplate && onEditTemplate(template);
              }}
              className="ml-4 p-2 bg-zinc-700 rounded-lg text-sm text-zinc-300 hover:bg-zinc-600"
            >
              Edit
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};