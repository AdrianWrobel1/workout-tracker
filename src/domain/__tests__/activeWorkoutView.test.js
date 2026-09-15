import { describe, it, expect } from 'vitest';
import {
  getCurrentSetIndex,
  getExerciseProgress,
  getWorkoutProgress,
  getNextPendingExercise,
  isWorkoutPersisted,
  describeProgressionState,
} from '../activeWorkoutView.js';

/**
 * Active Workout 2.0 derived view helpers: pure reads over the canonical
 * workout shape. No engine duplication — these only locate "what set am I
 * on / what comes next" and guard the finish-save path.
 */

const set = (overrides = {}) => ({ kg: 100, reps: 5, completed: false, setType: 'work', ...overrides });

describe('getCurrentSetIndex', () => {
  it('points at the first incomplete set', () => {
    expect(getCurrentSetIndex({ sets: [set({ completed: true }), set(), set()] })).toBe(1);
  });

  it('returns -1 when everything is done, empty, or malformed', () => {
    expect(getCurrentSetIndex({ sets: [set({ completed: true })] })).toBe(-1);
    expect(getCurrentSetIndex({ sets: [] })).toBe(-1);
    expect(getCurrentSetIndex(null)).toBe(-1);
    expect(getCurrentSetIndex({})).toBe(-1);
    expect(getCurrentSetIndex({ sets: null })).toBe(-1);
  });

  it('skips malformed set entries instead of crashing', () => {
    expect(getCurrentSetIndex({ sets: [null, set({ completed: true }), undefined] })).toBe(0);
  });
});

describe('getExerciseProgress', () => {
  it('reports Set X of Y for "what set am I on"', () => {
    expect(getExerciseProgress({ sets: [set({ completed: true }), set(), set()] })).toMatchObject({
      total: 3,
      completed: 1,
      remaining: 2,
      currentSetNumber: 2,
      isComplete: false,
    });
  });

  it('marks complete only when every set is complete', () => {
    expect(getExerciseProgress({ sets: [set({ completed: true })] }).isComplete).toBe(true);
    expect(getExerciseProgress({ sets: [] }).isComplete).toBe(false);
    expect(getExerciseProgress(null)).toMatchObject({ total: 0, completed: 0, currentSetNumber: null });
  });
});

describe('getWorkoutProgress', () => {
  const workout = {
    exercises: [
      { name: 'A', sets: [set({ completed: true }), set({ completed: true })] },
      { name: 'B', sets: [set({ completed: true }), set()] },
      { name: 'C', sets: [] },
    ],
  };

  it('counts sets and finished exercises, locates the current exercise', () => {
    expect(getWorkoutProgress(workout)).toMatchObject({
      totalSets: 4,
      completedSets: 3,
      totalExercises: 3,
      completedExercises: 1,
      currentExerciseIndex: 1,
    });
  });

  it('is safe on empty / malformed workouts (no crash, no fake precision)', () => {
    expect(getWorkoutProgress(null)).toMatchObject({ totalSets: 0, completedSets: 0, percent: 0, currentExerciseIndex: -1 });
    expect(getWorkoutProgress({ exercises: [] }).currentExerciseIndex).toBe(-1);
    expect(getWorkoutProgress({})).toMatchObject({ totalSets: 0 });
  });
});

describe('getNextPendingExercise', () => {
  const workout = {
    exercises: [
      { name: 'A', sets: [set({ completed: true })] },
      { name: 'B', sets: [set()] },
      { name: 'C', sets: [set()] },
    ],
  };

  it('finds the next exercise with remaining work', () => {
    expect(getNextPendingExercise(workout, 0)).toBe(1);
    expect(getNextPendingExercise(workout, 1)).toBe(2);
  });

  it('wraps to earlier exercises and returns -1 when nothing remains', () => {
    expect(getNextPendingExercise(workout, 2)).toBe(1);
    const done = { exercises: [{ sets: [set({ completed: true })] }] };
    expect(getNextPendingExercise(done, 0)).toBe(-1);
    expect(getNextPendingExercise(null, 0)).toBe(-1);
  });
});

describe('isWorkoutPersisted (finish-save idempotency)', () => {
  it('detects an already-saved id so double Save cannot duplicate history', () => {
    const history = [{ id: 'w1' }, { id: 'w2' }];
    expect(isWorkoutPersisted(history, 'w1')).toBe(true);
    expect(isWorkoutPersisted(history, 'w9')).toBe(false);
    expect(isWorkoutPersisted([], 'w1')).toBe(false);
    expect(isWorkoutPersisted(null, 'w1')).toBe(false);
  });
});

describe('describeProgressionState (never color-only, never reason codes)', () => {
  it.each([
    ['UP', 'Up'],
    ['REP_UP', 'More reps'],
    ['HOLD', 'Hold'],
    ['STALL', 'Stall'],
    ['DELOAD', 'Deload'],
  ])('maps %s to a human label with an icon', (state, label) => {
    const badge = describeProgressionState(state);
    expect(badge.label).toBe(label);
    expect(typeof badge.icon).toBe('string');
    expect(badge.icon.length).toBeGreaterThan(0);
  });

  it('falls back safely for unknown states', () => {
    expect(describeProgressionState('SOMETHING_NEW').label).toBeTruthy();
  });
});
