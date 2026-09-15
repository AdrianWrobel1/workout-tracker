import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TemplatesView } from '../TemplatesView';
import { TemplateCard } from '../../components/TemplateCard';
import { WorkoutCard } from '../../components/WorkoutCard';

const textOf = (html) => String(html).replace(/<!--[\s\S]*?-->/g, '');
const noop = () => {};

const template = {
  id: 't1', name: 'Push',
  exercises: [{ exerciseId: 1, name: 'Bench', category: 'Chest', planNotes: 'control', sets: [{ kg: 100, reps: 5, setType: 'work' }] }]
};

describe('FLOW A: builder renders list + editor', () => {
  it('list shows templates and create CTA', () => {
    const html = textOf(renderToString(
      <TemplatesView templates={[template]} editingTemplate={null} onClose={noop} onCreateNew={noop} onEdit={noop} onDelete={noop} onDuplicate={noop} onSave={noop} onChange={noop} onAddExercise={noop} />
    ));
    expect(html).toContain('Templates');
    expect(html).toContain('Push');
    expect(html).toContain('New template');
  });

  it('editor shows exercise config (sets/reps/warmup/type/notes/reorder)', () => {
    const html = textOf(renderToString(
      <TemplatesView templates={[template]} editingTemplate={template} exercisesDB={[]} onClose={noop} onCreateNew={noop} onEdit={noop} onDelete={noop} onDuplicate={noop} onSave={noop} onChange={noop} onAddExercise={noop} />
    ));
    for (const needle of ['Edit template', 'Bench', 'Template name', 'Session guidance', 'Target set 1', 'Target kg', 'Target reps', 'Warmup', 'Type', 'Add target set', 'Save Template', 'Move Bench up', 'Move Bench down']) {
      expect(html).toContain(needle);
    }
  });

  it('empty template + empty plan states are honest (no crash)', () => {
    const emptyList = textOf(renderToString(
      <TemplatesView templates={[]} editingTemplate={null} onClose={noop} onCreateNew={noop} onEdit={noop} onDelete={noop} onSave={noop} onChange={noop} onAddExercise={noop} />
    ));
    expect(emptyList).toContain('No templates yet');
    const emptyEditor = textOf(renderToString(
      <TemplatesView templates={[]} editingTemplate={{ name: 'T', exercises: [] }} onClose={noop} onCreateNew={noop} onEdit={noop} onDelete={noop} onSave={noop} onChange={noop} onAddExercise={noop} />
    ));
    expect(emptyEditor).toContain('No exercises yet');
  });

  it('stale exercise is flagged, not dropped', () => {
    const stale = { name: 'T', exercises: [{ exerciseId: 9999, name: 'Ghost', sets: [] }] };
    const html = textOf(renderToString(
      <TemplatesView templates={[]} editingTemplate={stale} exercisesDB={[{ id: 1, name: 'Bench' }]} onClose={noop} onCreateNew={noop} onEdit={noop} onDelete={noop} onSave={noop} onChange={noop} onAddExercise={noop} />
    ));
    expect(html).toContain('Ghost');
    expect(html).toContain('Missing from library');
  });
});

describe('FLOW B/C: template card offers start/edit/duplicate/delete with names', () => {
  it('card exposes accessible duplicate action', () => {
    const html = textOf(renderToString(
      <TemplateCard template={template} onEdit={noop} onDelete={noop} onDuplicate={noop} />
    ));
    expect(html).toContain('Push');
    expect(html).toContain('Duplicate template Push');
    expect(html).toContain('Edit template Push');
    expect(html).toContain('Delete template Push');
  });
});

describe('FLOW D: workout card uses canonical work volume', () => {
  it('warmup does not inflate the per-exercise row', () => {
    const workout = {
      id: 'w1', name: 'Push', date: '2026-09-12',
      exercises: [{
        exerciseId: 1, name: 'Bench', sets: [
          { kg: 100, reps: 5, completed: true, setType: 'work' },
          { kg: 50, reps: 5, completed: true, setType: 'warmup', warmup: true }
        ]
      }]
    };
    const html = textOf(renderToString(
      <WorkoutCard workout={workout} exercisesDB={[]} userWeight={null} />
    ));
    expect(html).toContain('Push');
    // work-only 500kg -> "500", warmup-inclusive would be 750
    expect(html).toContain('500');
    expect(html).not.toContain('750');
  });
});
