import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { WorkoutDetailView } from '../WorkoutDetailView';
import { HistoryView } from '../HistoryView';
import { DebriefsProvider } from '../../contexts/DebriefsContext';
import { MotivationProvider } from '../../contexts/MotivationContext';

const EXERCISES_DB = [
  { id: 1, name: 'Bench Press', category: 'Chest', muscles: ['Chest'] },
  { id: 2, name: 'Barbell Row', category: 'Back', muscles: ['Back'] },
];
const work = (kg, reps, extra = {}) => ({ kg, reps, completed: true, setType: 'work', ...extra });

const chestHeavy = {
  id: 'wA', name: 'Chest Day', date: '2026-09-10', duration: 60,
  exercises: [{ exerciseId: 1, name: 'Bench Press', category: 'Chest', sets: [work(100, 5), work(100, 5)] }],
};
const backHeavy = {
  id: 'wB', name: 'Back Day', date: '2026-09-12', duration: 55, tags: ['#power'], note: 'Felt strong',
  exercises: [{ exerciseId: 2, name: 'Barbell Row', category: 'Back', sets: [work(80, 8, { isBest1RM: true })] }],
};

const wrap = (node) => (
  <DebriefsProvider>
    <MotivationProvider>{node}</MotivationProvider>
  </DebriefsProvider>
);

// React SSR separates adjacent text nodes with comments — strip them so
// assertions read what the user reads.
const textOf = (html) => String(html).replace(/<!--[\s\S]*?-->/g, '');

describe('history → session render integration', () => {
  it('session detail renders the full hierarchy for one isolated session', () => {
    const html = textOf(renderToString(
      wrap(
        <WorkoutDetailView
          selectedDate="2026-09-12"
          selectedWorkoutId="wB"
          workouts={[chestHeavy, backHeavy]}
          exercisesDB={EXERCISES_DB}
          onBack={() => {}}
          onOpenExercise={() => {}}
        />
      )
    ));
    // identity + summary + highlights + map + breakdown + workload + coach + details
    // NOTE (UI 3.0 cohesion): session volume hero lives once in Summary;
    // Workload renders distribution only, never a second volume hero.
    for (const needle of [
      'Back Day', 'SESSION DETAIL', 'Summary', 'Highlights', 'What did I train?',
      'Barbell Row', 'Workload', 'Coach', 'Details', 'Felt strong', '#power',
    ]) {
      expect(html).toContain(needle);
    }
    // session isolation in the rendered output: no other session's exercises,
    // sets or muscle data may appear (the comparison may legitimately NAME
    // the previous session — that is a fact, not a data leak).
    expect(html).toContain('vs Chest Day');
    expect(html).not.toContain('Bench Press');
  });

  it('session detail legacy date mode renders every session of the day', () => {
    const html = textOf(renderToString(
      wrap(
        <WorkoutDetailView
          selectedDate="2026-09-12"
          workouts={[chestHeavy, backHeavy]}
          exercisesDB={EXERCISES_DB}
          onBack={() => {}}
        />
      )
    ));
    expect(html).toContain('Back Day');
  });

  it('session detail handles missing workout and empty session honestly', () => {
    const missing = textOf(renderToString(
      wrap(<WorkoutDetailView selectedDate="2026-09-12" selectedWorkoutId="nope" workouts={[chestHeavy]} exercisesDB={EXERCISES_DB} onBack={() => {}} />)
    ));
    expect(missing).toContain('Session not found');
    const empty = textOf(renderToString(
      wrap(
        <WorkoutDetailView
          selectedDate="2026-09-01"
          selectedWorkoutId="empty"
          workouts={[{ id: 'empty', name: 'Skipped Day', date: '2026-09-01', duration: 10, exercises: [] }]}
          exercisesDB={EXERCISES_DB}
          onBack={() => {}}
        />
      )
    ));
    expect(empty).toContain('Skipped Day');
  });

  it('history renders list, search and session preview', () => {
    const html = textOf(renderToString(
      <HistoryView
        workouts={[chestHeavy, backHeavy]}
        onViewWorkoutDetail={() => {}}
        onDeleteWorkout={() => {}}
        onEditWorkout={() => {}}
        exercisesDB={EXERCISES_DB}
        filter="all"
        onFilterChange={() => {}}
      />
    ));
    for (const needle of ['HISTORY', 'Chest Day', 'Back Day', 'Search workouts', 'work sets', '1.0k kg', '1 PR']) {
      expect(html).toContain(needle);
    }
  });
});
