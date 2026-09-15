import { describe, it, expect } from 'vitest';
import { resolveRecommendation } from '../progressionAdapter';

const W = (id, date, sets) => ({ id, date, exercises: [{ exerciseId: 1, name: 'Bench', sets }] });
const done = (kg, reps) => ({ kg, reps, completed: true, setType: 'work' });
const POLICY = { mode: 'double', repMin: 8, repMax: 12, incrementKg: 2.5 };

describe('templatePrevious precedence (single chain in adapter)', () => {
  const history = [W('w1', '2026-01-01', [done(100, 12), done(100, 12)])];
  it('template memory outranks the progression engine (documented order)', () => {
    const r = resolveRecommendation({
      exercise: { id: 1, progression: POLICY },
      workouts: history,
      templatePrevious: { sets: [{ kg: 90, reps: 8 }], lastDate: '2026-02-01' }
    });
    expect(r.source).toBe('template-memory');
    expect(r.suggestedKg).toBe(90);
  });
  it('bare array templatePrevious is accepted', () => {
    const r = resolveRecommendation({
      exercise: { id: 1, progression: POLICY },
      workouts: history,
      templatePrevious: [{ kg: 90, reps: 8 }, { kg: 95, reps: 8 }]
    });
    expect(r.source).toBe('template-memory');
  });
  it('without template memory the engine still wins (unchanged)', () => {
    const r = resolveRecommendation({ exercise: { id: 1, progression: POLICY }, workouts: history });
    expect(r.source).toBe('progression');
    expect(r.suggestedKg).toBe(102.5);
  });
  it('off-mode falls back to template memory before global history', () => {
    const r = resolveRecommendation({
      exercise: { id: 1, progression: { mode: 'off' } },
      workouts: history,
      templatePrevious: { sets: [{ kg: 77, reps: 7 }] }
    });
    expect(r.source).toBe('template-memory');
    expect(r.suggestedKg).toBe(77);
  });
  it('malformed templatePrevious is ignored safely', () => {
    const r = resolveRecommendation({
      exercise: { id: 1, progression: POLICY },
      workouts: history,
      templatePrevious: { sets: 'garbage' }
    });
    expect(r.source).toBe('progression');
    expect(resolveRecommendation({
      exercise: { id: 1, progression: POLICY },
      workouts: history,
      templatePrevious: null
    }).source).toBe('progression');
  });
  it('empty templatePrevious sets do not shadow the engine', () => {
    const r = resolveRecommendation({
      exercise: { id: 1, progression: POLICY },
      workouts: history,
      templatePrevious: { sets: [] }
    });
    expect(r.source).toBe('progression');
  });
});
