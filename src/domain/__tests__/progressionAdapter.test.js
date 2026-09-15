import { describe, it, expect } from 'vitest';
import { resolveRecommendation } from '../progressionAdapter';
import { sanitizeProgressionForStorage } from '../progression';
import { formatProgressionWhy, formatPrescription } from '../progressionCopy';
import { normalizeImportedExercise } from '../../services/importExport';

const W = (id, date, sets) => ({ id, date, exercises: [{ exerciseId: 1, name: 'Bench', sets }] });
const done = (kg, reps) => ({ kg, reps, completed: true, setType: 'work' });

describe('adapter precedence + legacy', () => {
  it('no policy configured → legacy behavior (last values as hints)', () => {
    const r = resolveRecommendation({
      exercise: { id: 1, name: 'Bench' },
      workouts: [W('w1', '2026-01-01', [done(100, 5)])]
    });
    expect(r.source).toMatch(/legacy/);
    expect(r.suggestedKg).toBe(100);
    expect(r.suggestedReps).toBe(5);
  });

  it('explicit OFF → legacy behavior, engine never consulted', () => {
    const r = resolveRecommendation({
      exercise: { id: 1, progression: { mode: 'off' } },
      workouts: [W('w1', '2026-01-01', [done(100, 12), done(100, 12)])]
    });
    expect(r.source).toMatch(/legacy/);
  });

  it('ramp history without policy keeps the old ramp suggestion', () => {
    const r = resolveRecommendation({
      exercise: { id: 1 },
      workouts: [W('w1', '2026-01-01', [done(90, 5), done(100, 5)])]
    });
    expect(r.source).toBe('legacy');
    expect(r.suggestedKg).toBeGreaterThan(100);
  });

  it('enabled DOUBLE policy → canonical engine recommendation with reason', () => {
    const r = resolveRecommendation({
      exercise: { id: 1, progression: { mode: 'double', repMin: 8, repMax: 12, incrementKg: 2.5 } },
      workouts: [W('w1', '2026-01-01', [done(100, 12), done(100, 12)])]
    });
    expect(r.source).toBe('progression');
    expect(r.suggestedKg).toBe(102.5);
    expect(r.suggestedReps).toBe(8);
    expect(r.state).toBe('UP');
    expect(r.reasonCode).toBe('TOP_OF_RANGE');
    expect(r.whyText).toContain('top of the range');
    expect(r.prescriptionText).toBe('102.5 kg × 8');
  });

  it('progression recommendation degrades to legacy when engine has no prescription', () => {
    const r = resolveRecommendation({
      exercise: { id: 1, progression: { mode: 'linear', targetReps: 5 } },
      workouts: []
    });
    expect(r).toBeNull();
  });

  it('missing exercise id → null, never throws', () => {
    expect(resolveRecommendation({ exercise: {}, workouts: [] })).toBeNull();
    expect(resolveRecommendation()).toBeNull();
    expect(resolveRecommendation({ exercise: { id: 1 }, workouts: null })).toBeNull();
  });

  it('plan reference flows into the engine (template context)', () => {
    const r = resolveRecommendation({
      exercise: { id: 1, progression: { mode: 'linear', targetReps: 5 } },
      workouts: [W('w1', '2026-01-01', [done(100, 5)])],
      plan: { weight: 100, repMin: 5, repMax: 5, sets: 3 }
    });
    expect(r.source).toBe('progression');
    expect(r.suggestedKg).toBe(102.5);
  });
});

describe('copy + formatting', () => {
  it('recommendation language avoids authority phrasing', () => {
    const r = resolveRecommendation({
      exercise: { id: 1, progression: { mode: 'double', repMin: 8, repMax: 12 } },
      workouts: [W('w1', '2026-01-01', [done(100, 12), done(100, 12)])]
    });
    expect(r.whyText).not.toMatch(/you should|your body needs/i);
    expect(formatProgressionWhy(null)).toBe('No recommendation available.');
    expect(formatPrescription(null)).toBeNull();
    expect(formatPrescription({ weight: 100, repsMin: 8, repsMax: 12 })).toBe('100 kg × 8–12');
  });
});

describe('persistence + import/export compatibility', () => {
  it('valid progression config survives import normalization', () => {
    const out = normalizeImportedExercise({
      id: 'e1', name: 'Bench', category: 'Push',
      progression: { mode: 'double', repMin: 8, repMax: 12, incrementKg: 2.5 }
    });
    expect(out.progression).toMatchObject({ mode: 'double', repMin: 8, repMax: 12 });
  });

  it('malformed progression is dropped without invalidating the exercise', () => {
    const out = normalizeImportedExercise({ id: 'e1', name: 'Bench', category: 'Push', progression: { mode: 'beast', repMin: -5 } });
    expect(out).not.toHaveProperty('progression');
    expect(out.name).toBe('Bench');
  });

  it('legacy exercises without progression stay valid and behavior-identical', () => {
    const out = normalizeImportedExercise({ id: 1, name: 'Bench', category: 'Push' });
    expect(out).not.toHaveProperty('progression');
    const rec = resolveRecommendation({ exercise: out, workouts: [W('w1', '2026-01-01', [done(80, 8)])] });
    expect(rec.source).toMatch(/legacy/);
    expect(rec.suggestedKg).toBe(80);
  });

  it('sanitize never mutates and preserves unrelated fields', () => {
    const ex = Object.freeze({ id: 1, name: 'B', usesBodyweight: true, progression: { mode: 'linear', targetReps: 5 } });
    const out = sanitizeProgressionForStorage(ex);
    expect(out.progression).toMatchObject({ mode: 'linear', targetReps: 5 });
    expect(out.usesBodyweight).toBe(true);
  });
});
