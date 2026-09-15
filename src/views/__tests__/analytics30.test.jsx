import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MuscleBodyMap } from '../../components/MuscleBodyMap';
import { ProfileStatisticsView } from '../ProfileStatisticsView';
import { ExerciseDetailView } from '../ExerciseDetailView';

// Analytics 3.0 render contracts: body-map region identity, statistics
// section presence (empty + full), exercise-detail Actual/Recommended split.
const EXERCISES_DB = [
  { id: 1, name: 'Bench Press', category: 'Chest', muscles: ['Chest'] },
];
const work = (kg, reps, extra = {}) => ({ kg, reps, completed: true, setType: 'work', ...extra });
const W = {
  id: 'w1', name: 'Chest Day', date: '2026-09-10', duration: 60,
  exercises: [{ exerciseId: 1, name: 'Bench Press', category: 'Chest', sets: [work(100, 5), work(100, 5)] }],
};

describe('analytics 3.0 render contracts', () => {
  it('body map renders organic paths, keeps region contract', () => {
    const html = renderToString(
      <MuscleBodyMap setsByMuscle={{ Chest: 4 }} stats={{ setsByMuscle: { Chest: 4 }, totalSets: 4 }} workouts={[W]} exercisesDB={EXERCISES_DB} />
    );
    for (const axis of ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Core', 'Legs']) {
      expect(html).toContain(axis);
    }
    expect(html).toContain('<path');
    expect(html).toContain('aria-pressed');
    expect(html).toContain('Front');
  });

  it('statistics renders hero + sections with empty and full history', () => {
    const empty = renderToString(
      <ProfileStatisticsView workouts={[]} exercisesDB={[]} onOpenProfile={() => {}} onOpenSettings={() => {}} />
    );
    expect(empty).toContain('STATISTICS');
    expect(empty).toContain('Total volume');
    expect(empty).toContain('Finish your first workout');
    const full = renderToString(
      <ProfileStatisticsView workouts={[W]} exercisesDB={EXERCISES_DB} onOpenProfile={() => {}} onOpenSettings={() => {}} onOpenExercise={() => {}} />
    );
    for (const needle of ['STATISTICS', 'Muscle Body Map', 'Strength', 'Volume', 'Balance', 'Consistency', 'Exercise Progress', 'Bench Press']) {
      expect(full).toContain(needle);
    }
  });

  it('exercise detail renders hero + actual vs recommended', () => {
    const html = renderToString(
      <ExerciseDetailView exerciseId={1} workouts={[W]} exercisesDB={EXERCISES_DB} onBack={() => {}} onOpenWorkout={() => {}} />
    );
    for (const needle of ['Bench Press', 'Latest performance', 'Actual', 'Best', 'Next session', 'Recommended', 'Progress', 'Recent sessions', 'Workload', 'Muscles']) {
      expect(html).toContain(needle);
    }
  });
});
