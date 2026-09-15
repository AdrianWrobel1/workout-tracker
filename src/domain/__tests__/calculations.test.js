import { describe, it, expect } from 'vitest';
import {
  calculate1RM,
  calculateTotalVolume,
  calculateSetVolume,
  calculateEffectiveKg,
  calculateWorkVolume,
  calculateWorkoutWorkVolume,
  countWorkSets
} from '../calculations';

describe('calculate1RM (Epley, canonical owner)', () => {
  it('returns 0 for empty input', () => {
    expect(calculate1RM(0, 5)).toBe(0);
    expect(calculate1RM(100, 0)).toBe(0);
    expect(calculate1RM(null, null)).toBe(0);
  });

  it('single rep returns the weight itself', () => {
    expect(calculate1RM(100, 1)).toBe(100);
  });

  it('estimates via kg * (1 + reps/30), rounded', () => {
    expect(calculate1RM(100, 5)).toBe(Math.round(100 * (1 + 5 / 30)));
    expect(calculate1RM(80, 8)).toBe(Math.round(80 * (1 + 8 / 30)));
  });

  it('coerces string numbers', () => {
    expect(calculate1RM('100', '5')).toBe(calculate1RM(100, 5));
  });
});

describe('volume semantics (explicit split)', () => {
  const sets = [
    { kg: 100, reps: 5, completed: true }, // work: 500
    { kg: 50, reps: 10, completed: true, warmup: true }, // warmup: 500
    { kg: 100, reps: 5, completed: false } // planned: 500 (not counted anywhere)
  ];

  it('legacy total volume includes warmups (display surfaces)', () => {
    expect(calculateTotalVolume(sets)).toBe(1000);
  });

  it('canonical work volume excludes warmups and incomplete sets', () => {
    expect(calculateWorkVolume(sets)).toBe(500);
  });

  it('countWorkSets counts only completed non-warmup', () => {
    expect(countWorkSets(sets)).toBe(1);
  });

  it('set volume uses effective kg with bodyweight option', () => {
    expect(calculateSetVolume({ kg: 0, reps: 10 })).toBe(0);
    expect(calculateSetVolume({ kg: 0, reps: 10 }, { usesBodyweight: true, userWeight: 80 })).toBe(800);
    expect(calculateEffectiveKg({ kg: 20 }, { usesBodyweight: true, userWeight: 80 })).toBe(100);
    expect(calculateEffectiveKg({ kg: 20 }, {})).toBe(20);
  });
});

describe('calculateWorkoutWorkVolume', () => {
  it('sums work sets across exercises, resolving bodyweight from DB', () => {
    const workout = {
      exercises: [
        { exerciseId: 1, sets: [{ kg: 100, reps: 5, completed: true }] },
        { exerciseId: 2, sets: [{ kg: 0, reps: 10, completed: true }] },
        { exerciseId: 3, sets: [{ kg: 60, reps: 5, completed: true, warmup: true }] }
      ]
    };
    const db = [{ id: 2, usesBodyweight: true }];
    expect(calculateWorkoutWorkVolume(workout, db, 80)).toBe(500 + 800);
  });

  it('handles missing exercisesDB gracefully', () => {
    const workout = { exercises: [{ sets: [{ kg: 10, reps: 10, completed: true }] }] };
    expect(calculateWorkoutWorkVolume(workout)).toBe(100);
  });
});
