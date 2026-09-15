import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { PlanningCalendarView } from '../PlanningCalendarView';
import { todayLocalKey } from '../../domain/scheduledWorkouts';

const textOf = (html) => String(html).replace(/<!--[\s\S]*?-->/g, '');

const tpl = {
  id: 'tpl-push-a',
  name: 'Push A',
  exercises: [
    { exerciseId: 'e1', name: 'Bench', category: 'Chest', sets: [{ kg: 100, reps: 5, setType: 'work' }] },
  ],
};

const planOn = (dateKey, over = {}) => ({
  id: `plan-${dateKey}`,
  dateKey,
  name: 'Push A',
  templateId: 'tpl-push-a',
  templateName: 'Push A',
  exercises: tpl.exercises,
  status: 'planned',
  completedWorkoutId: null,
  createdAt: `${dateKey}T00:00:00.000Z`,
  updatedAt: `${dateKey}T00:00:00.000Z`,
  ...over,
});

const workoutOn = (dateKey, over = {}) => ({
  id: `w-${dateKey}`,
  name: 'Push A',
  date: `${dateKey}T18:00:00.000Z`,
  duration: 60,
  exercises: [
    { exerciseId: 'e1', name: 'Bench', category: 'Chest', sets: [{ kg: 100, reps: 5, completed: true, setType: 'work' }] },
  ],
  ...over,
});

const baseProps = (over = {}) => ({
  workouts: [],
  scheduledWorkouts: [],
  templates: [tpl],
  exercisesDB: [{ id: 'e1', name: 'Bench', category: 'Chest' }],
  onBack: vi.fn(),
  onViewSession: vi.fn(),
  onStartPlan: vi.fn(),
  onScheduleFromTemplate: vi.fn(),
  onSaveCustomPlan: vi.fn(),
  onDeletePlan: vi.fn(),
  onRequestExercisePick: vi.fn(),
  ...over,
});

describe('planning calendar view (SSR smoke)', () => {
  it('renders the current month with navigation + today affordance', () => {
    const now = new Date();
    const monthName = now.toLocaleString('en-US', { month: 'long' });
    const html = textOf(renderToString(<PlanningCalendarView {...baseProps()} />));
    expect(html).toContain(monthName);
    expect(html).toContain(String(now.getFullYear()));
    expect(html).toContain('Previous month');
    expect(html).toContain('Next month');
    expect(html).toContain('Today');
  });

  it('selects today by default and explains planning semantics', () => {
    const html = textOf(renderToString(<PlanningCalendarView {...baseProps()} />));
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('never count toward history or stats');
  });

  it('empty day offers a planning entry point (never "No session found")', () => {
    const html = textOf(renderToString(<PlanningCalendarView {...baseProps()} />));
    expect(html).toContain('Plan workout');
    expect(html).not.toContain('No session found');
  });

  it('planned day shows the snapshot with start/edit affordances', () => {
    const today = todayLocalKey();
    const html = textOf(renderToString(
      <PlanningCalendarView {...baseProps({ scheduledWorkouts: [planOn(today)] })} />
    ));
    expect(html).toContain('Planned · 1');
    expect(html).toContain('Push A');
    expect(html).toContain('1 exercise');
    expect(html).toContain('Start planned workout Push A');
    expect(html).toContain('Edit planned workout Push A');
    expect(html).toContain('Delete planned workout Push A');
  });

  it('completed day links out to session detail without duplicating analytics', () => {
    const today = todayLocalKey();
    const html = textOf(renderToString(
      <PlanningCalendarView {...baseProps({ workouts: [workoutOn(today)] })} />
    ));
    expect(html).toContain('Completed · 1');
    expect(html).toContain('View completed session Push A');
    expect(html).not.toContain('No session found');
  });

  it('planned + completed day keeps both sections separated', () => {
    const today = todayLocalKey();
    const html = textOf(renderToString(
      <PlanningCalendarView
        {...baseProps({ scheduledWorkouts: [planOn(today)], workouts: [workoutOn(today)] })}
      />
    ));
    expect(html).toContain('Planned + done');
    expect(html).toContain('Planned · 1');
    expect(html).toContain('Completed · 1');
  });

  it('marks cells with planned/completed status for assistive tech', () => {
    const today = todayLocalKey();
    const html = textOf(renderToString(
      <PlanningCalendarView
        {...baseProps({ scheduledWorkouts: [planOn(today)], workouts: [workoutOn(today)] })}
      />
    ));
    expect(html).toContain('planned and completed');
  });
});
