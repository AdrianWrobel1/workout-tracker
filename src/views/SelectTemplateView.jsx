import React from 'react';
import { X } from 'lucide-react';
import { TemplateCard } from '../components/TemplateCard';

export const SelectTemplateView = ({ templates, onClose, onSelectTemplate, onEditTemplate }) => {
  return (
    <div className="bg-black text-white">
      {/* Header */}
      <div className="bg-black/95 backdrop-blur border-b border-white/10 p-4 sticky top-0 z-20">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <button onClick={onClose} aria-label="Close start workout" className="p-2 hover:bg-white/10 rounded-lg transition min-w-[44px] min-h-[44px] flex items-center justify-center">
            <X size={20} aria-hidden="true" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="ui-micro">Blueprint → working copy</p>
            <h1 className="ui-display mt-0.5">Start workout</h1>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3 pb-16 max-w-2xl mx-auto">
        <p className="ui-secondary">Starting clones the template. Your live sets never edit the blueprint.</p>
        {/* Empty Workout Option */}
        <button
          onClick={() => onSelectTemplate({ id: 'empty', name: 'Empty Workout', exercises: [] })}
          className="ui-surface-interactive w-full p-5 text-left border-dashed ui-press"
          style={{ borderStyle: 'dashed' }}
        >
          <h3 className="ui-card-title">Empty Workout</h3>
          <p className="ui-secondary mt-1">Start from scratch</p>
        </button>

        {/* Template List */}
        {templates.length === 0 ? (
          <div className="ui-surface-secondary text-center py-12 px-4">
            <p className="ui-card-title">No templates yet</p>
            <p className="ui-secondary mt-1.5">Create a template to quickly start workouts</p>
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
