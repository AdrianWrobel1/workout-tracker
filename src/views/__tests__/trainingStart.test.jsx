import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TemplateCard } from '../../components/TemplateCard';
import { TemplatesView } from '../TemplatesView';

const noop = () => {};
const textOf = (html) => String(html).replace(/<!--[\s\S]*?-->/g, '');

const template = {
  id: 't1',
  name: 'Push',
  exercises: [{ exerciseId: 1, name: 'Bench', category: 'Chest', sets: [{ kg: 100, reps: 5, setType: 'work' }] }],
  plans: [{ id: 'p1', name: 'Heavy', intensityLevel: 'high', percentageRange: { min: 80, max: 90 }, repRange: '5-8' }]
};

describe('Training 3.0: template → active start action', () => {
  it('card offers an explicit Start entry when onStart is provided', () => {
    const html = textOf(renderToString(
      <TemplateCard template={template} onStart={noop} onEdit={noop} onDelete={noop} onDuplicate={noop} />
    ));
    expect(html).toContain('Start workout from Push');
    expect(html).toContain('>Start<');
  });

  it('card falls back to legacy onSelect start entry', () => {
    const html = textOf(renderToString(
      <TemplateCard template={template} onSelect={noop} onEdit={noop} />
    ));
    expect(html).toContain('Start workout from Push');
  });

  it('card renders no Start entry when no start handler is given (edit-only contexts)', () => {
    const html = textOf(renderToString(
      <TemplateCard template={template} onEdit={noop} onDelete={noop} onDuplicate={noop} />
    ));
    expect(html).not.toContain('Start workout from Push');
    expect(html).toContain('Edit template Push');
  });

  it('template list surfaces plan count and start action (PLAN → START)', () => {
    const html = textOf(renderToString(
      <TemplatesView
        templates={[template]}
        editingTemplate={null}
        onClose={noop}
        onCreateNew={noop}
        onEdit={noop}
        onDelete={noop}
        onDuplicate={noop}
        onStart={noop}
        onSave={noop}
        onChange={noop}
        onAddExercise={noop}
      />
    ));
    expect(html).toContain('1 plan');
    expect(html).toContain('Start workout from Push');
    expect(html).toContain('working copy');
  });
});
