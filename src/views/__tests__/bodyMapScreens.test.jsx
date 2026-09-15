import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ProfileStatisticsView } from '../ProfileStatisticsView';
import { WorkoutDetailView } from '../WorkoutDetailView';
import { DebriefsProvider } from '../../contexts/DebriefsContext';
import { MotivationProvider } from '../../contexts/MotivationContext';
import { MuscleBodyMap } from '../../components/MuscleBodyMap';
import { muscleStats } from '../../analytics/statistics';

const EXERCISES_DB = [
  { id: 1, name: 'Bench Press', category: 'Chest', muscles: ['Chest'] },
  { id: 2, name: 'Deadlift', category: 'Back', muscles: ['Back'] },
];
const work = (kg, reps, extra = {}) => ({ kg, reps, completed: true, setType: 'work', ...extra });
const W = {
  id: 'w1', name: 'Full Session', date: '2026-09-10', duration: 60,
  exercises: [
    { exerciseId: 1, name: 'Bench Press', category: 'Chest', sets: [work(100, 5)] },
    { exerciseId: 2, name: 'Deadlift', category: 'Back', sets: [work(150, 5)] },
  ],
};
const VB = '0 95 727 1280';

describe('body map screens render the shared Body Map artwork', () => {
  it('Statistics renders the adapted Body Map', () => {
    const html = renderToString(
      <ProfileStatisticsView workouts={[W]} exercisesDB={EXERCISES_DB} onOpenProfile={() => {}} onOpenSettings={() => {}} onOpenExercise={() => {}} />
    );
    expect(html).toContain('Muscle Body Map');
    expect(html).toContain(VB);
  });

  it('Session Detail renders the adapted Body Map', () => {
    const html = renderToString(
      <DebriefsProvider>
        <MotivationProvider>
          <WorkoutDetailView selectedDate="2026-09-10" workouts={[W]} onBack={() => {}} exercisesDB={EXERCISES_DB} />
        </MotivationProvider>
      </DebriefsProvider>
    );
    expect(html).toContain('What did I train?');
    expect(html).toContain(VB);
  });

  it('Finish Summary data flow renders the adapted Body Map', () => {
    // Same call App.jsx makes for pendingSummary.completedWorkout.
    const finishStats = muscleStats([W], { userWeight: null, exercisesDB: EXERCISES_DB });
    expect(finishStats.totalSets).toBeGreaterThan(0);
    const html = renderToString(
      <MuscleBodyMap
        setsByMuscle={finishStats.setsByMuscle}
        stats={finishStats}
        workouts={[W]}
        exercisesDB={EXERCISES_DB}
      />
    );
    expect(html).toContain(VB);
    expect(html).toContain('Chest');
    expect(html).toContain('Back');
  });
});
