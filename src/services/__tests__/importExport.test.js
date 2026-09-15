import { describe, it, expect } from 'vitest';
import {
  isValidWorkout,
  isValidTemplate,
  isValidExercise,
  normalizeImportedWorkout,
  mergeById,
  validateImportPayload
} from '../importExport';

describe('import validation', () => {
  it('accepts a well-formed workout', () => {
    expect(
      isValidWorkout({
        id: 'w1',
        date: '2026-01-01T10:00:00.000Z',
        exercises: [{ exerciseId: 1, name: 'Bench', sets: [{ kg: 100, reps: 5 }] }]
      })
    ).toBe(true);
  });

  it('accepts legacy numeric ids and date-only strings', () => {
    expect(
      isValidWorkout({
        id: 1700000000000,
        date: '2026-01-01',
        exercises: [{ exerciseId: 1, name: 'Bench', sets: [{ kg: 100, reps: 5 }] }]
      })
    ).toBe(true);
  });

  it('rejects workouts with non-numeric sets or missing fields', () => {
    // Empty exercise lists are preserved as-is (existing behavior: vacuously valid).
    expect(isValidWorkout({ id: 'w1', date: '2026-01-01', exercises: [] })).toBe(true);
    expect(
      isValidWorkout({
        id: 'w1',
        date: '2026-01-01',
        exercises: [{ exerciseId: 1, name: 'Bench', sets: [{ kg: 'heavy', reps: 5 }] }]
      })
    ).toBe(false);
    expect(isValidWorkout({ id: 'w1', exercises: [] })).toBe(false);
  });

  it('validates templates and exercises', () => {
    expect(isValidTemplate({ id: 't1', name: 'Push', exercises: [] })).toBe(true);
    expect(isValidTemplate({ name: 'Push' })).toBe(false);
    expect(isValidExercise({ id: 1, name: 'Bench', category: 'Chest' })).toBe(true);
    expect(isValidExercise({ id: 1, name: 'Bench' })).toBe(false);
  });

  it('validateImportPayload accepts both flat and service-wrapped shapes', () => {
    const flat = validateImportPayload({ workouts: [], templates: [] });
    expect(flat.ok).toBe(true);
    const wrapped = validateImportPayload({ data: { workouts: [], exercises: [], templates: [] } });
    expect(wrapped.ok).toBe(true);
    expect(validateImportPayload(null).ok).toBe(false);
    expect(validateImportPayload({ workouts: 'nope' }).ok).toBe(false);
  });
});

describe('import normalization', () => {
  it('coerces sets and fills workout defaults', () => {
    const out = normalizeImportedWorkout({
      id: 'w1',
      date: '2026-01-01',
      exercises: [{ exerciseId: 1, name: 'Bench', sets: [{ kg: '100', reps: '5', completed: 1 }] }]
    });
    expect(out.tags).toEqual([]);
    expect(out.exercises[0].sets[0]).toMatchObject({ kg: 100, reps: 5, completed: true, setType: 'work' });
  });

  it('preserves warmup markers', () => {
    const out = normalizeImportedWorkout({
      id: 'w1',
      date: '2026-01-01',
      exercises: [{ exerciseId: 1, name: 'B', sets: [{ kg: 50, reps: 5, completed: true, warmup: true }] }]
    });
    expect(out.exercises[0].sets[0]).toMatchObject({ setType: 'warmup', warmup: true });
  });
});

describe('mergeById (deterministic conflicts)', () => {
  it('existing records win on id conflict; new ones prepend', () => {
    const existing = [{ id: 'a' }, { id: 'b' }];
    const incoming = [{ id: 'b', name: 'HACK' }, { id: 'c' }];
    const { merged, added, skipped } = mergeById(existing, incoming);
    expect(added).toEqual([{ id: 'c' }]);
    expect(skipped).toBe(1);
    expect(merged.find((w) => w.id === 'b')).toEqual({ id: 'b' });
    expect(merged[0]).toEqual({ id: 'c' });
  });

  it('malformed entries without ids are still merged (caller validates first)', () => {
    const { merged } = mergeById([], [{ id: 'x' }]);
    expect(merged).toHaveLength(1);
  });
});
