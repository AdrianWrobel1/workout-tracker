import { describe, it, expect } from 'vitest';
import {
  detectPRsInWorkout,
  buildLastWorkoutSnapshot,
  compareWorkoutToPrevious,
  prepareCleanWorkoutData
} from '../workouts';
import { getExerciseRecords } from '../exercises';
import { calculate1RM } from '../calculations';

const prevWorkouts = [
  {
    id: 'w0',
    date: '2026-01-01T10:00:00.000Z',
    exercises: [
      {
        exerciseId: 1,
        name: 'Bench',
        sets: [{ kg: 100, reps: 5, completed: true }]
      }
    ]
  }
];

describe('PR detection (3 independent types)', () => {
  it('skips first-time exercises (baseline only, no PR)', () => {
    const current = {
      id: 'w1',
      date: '2026-01-08T10:00:00.000Z',
      exercises: [{ exerciseId: 99, name: 'New Lift', sets: [{ kg: 200, reps: 5, completed: true }] }]
    };
    expect(detectPRsInWorkout(current, [], calculate1RM, getExerciseRecords)).toEqual({});
  });

  it('detects best1RM when Epley estimate exceeds history', () => {
    const current = {
      id: 'w1',
      date: '2026-01-08T10:00:00.000Z',
      exercises: [{ exerciseId: 1, name: 'Bench', sets: [{ kg: 110, reps: 5, completed: true }] }]
    };
    const prs = detectPRsInWorkout(current, prevWorkouts, calculate1RM, getExerciseRecords);
    expect(prs[1].recordTypes).toContain('best1RM');
  });

  it('ignores warmup sets for PRs', () => {
    const current = {
      id: 'w1',
      date: '2026-01-08T10:00:00.000Z',
      exercises: [{ exerciseId: 1, name: 'Bench', sets: [{ kg: 500, reps: 5, completed: true, warmup: true }] }]
    };
    expect(detectPRsInWorkout(current, prevWorkouts, calculate1RM, getExerciseRecords)).toEqual({});
  });

  it('ignores incomplete and zero sets', () => {
    const current = {
      id: 'w1',
      date: '2026-01-08T10:00:00.000Z',
      exercises: [
        { exerciseId: 1, name: 'Bench', sets: [{ kg: 500, reps: 5, completed: false }, { kg: 0, reps: 0, completed: true }] }
      ]
    };
    expect(detectPRsInWorkout(current, prevWorkouts, calculate1RM, getExerciseRecords)).toEqual({});
  });

  it('detects heaviest weight independently of 1RM', () => {
    // 102.5x1 beats heaviest (100) but its 1RM (103) loses to history 100x5 (117)
    const current = {
      id: 'w1',
      date: '2026-01-08T10:00:00.000Z',
      exercises: [{ exerciseId: 1, name: 'Bench', sets: [{ kg: 102.5, reps: 1, completed: true }] }]
    };
    const prs = detectPRsInWorkout(current, prevWorkouts, calculate1RM, getExerciseRecords);
    expect(prs[1].recordTypes).toContain('heaviestWeight');
    expect(prs[1].recordTypes).not.toContain('best1RM');
  });
});

describe('buildLastWorkoutSnapshot (template prev)', () => {
  it('keeps completed non-warmup sets only', () => {
    const snapshot = buildLastWorkoutSnapshot({
      date: '2026-01-08T10:00:00.000Z',
      exercises: [
        {
          exerciseId: 1,
          name: 'Bench',
          sets: [
            { kg: 100, reps: 5, completed: true },
            { kg: 50, reps: 5, completed: true, warmup: true },
            { kg: 90, reps: 5, completed: false }
          ]
        },
        { exerciseId: 2, name: 'Empty', sets: [{ kg: 10, reps: 1, completed: false }] }
      ]
    });
    expect(snapshot.exercises).toHaveLength(1);
    expect(snapshot.exercises[0].sets).toEqual([{ kg: 100, reps: 5 }]);
  });
});

describe('compareWorkoutToPrevious', () => {
  it('compares work volume with a 5% deadband', () => {
    const mk = (vol) => ({
      date: '2026-01-08T10:00:00.000Z',
      exercises: [{ sets: [{ kg: vol, reps: 1, completed: true }] }]
    });
    expect(compareWorkoutToPrevious(mk(110), [{ ...mk(100), date: '2026-01-01T10:00:00.000Z' }]).trend).toBe('up');
    expect(compareWorkoutToPrevious(mk(50), [{ ...mk(100), date: '2026-01-01T10:00:00.000Z' }]).trend).toBe('down');
    expect(compareWorkoutToPrevious(mk(102), [{ ...mk(100), date: '2026-01-01T10:00:00.000Z' }]).trend).toBe('flat');
  });

  it('returns null with no history', () => {
    expect(compareWorkoutToPrevious({ date: '2026-01-08T10:00:00.000Z', exercises: [] }, [])).toBeNull();
  });
});

describe('prepareCleanWorkoutData', () => {
  it('counts work sets and volume, warmups excluded', () => {
    const clean = prepareCleanWorkoutData(
      {
        exercises: [
          { exerciseId: 1, category: 'Chest', sets: [{ kg: 100, reps: 5, completed: true }, { kg: 50, reps: 5, completed: true, warmup: true }] }
        ]
      },
      []
    );
    expect(clean.totalVolume).toBe(500);
    expect(clean.completedSets).toBe(1);
  });
});
