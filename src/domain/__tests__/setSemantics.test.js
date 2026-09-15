import { describe, it, expect } from 'vitest';
import { isWorkSet, isWarmupSet, resolveSetType, normalizeSetForStorage } from '../workoutExtensions';
import {
  updateSetField,
  toggleSetCompletion,
  addSet,
  addWarmupSet,
  deleteSet,
  setSetType,
  deleteExercise,
  reorderExercises,
  createSuperset,
  removeSuperset,
  buildCompletedWorkout
} from '../workoutActions';

const makeWorkout = () => ({
  id: 'w1',
  name: 'Push',
  startTime: new Date('2026-01-01T10:00:00.000Z').toISOString(),
  exercises: [
    {
      exerciseId: 1,
      name: 'Bench',
      category: 'Chest',
      sets: [
        { kg: 100, reps: 5, completed: true },
        { kg: 100, reps: 5, completed: false }
      ]
    },
    {
      exerciseId: 2,
      name: 'Squat',
      category: 'Legs',
      sets: [{ kg: 120, reps: 5, completed: true, warmup: true }]
    }
  ]
});

describe('set classification (canonical predicate)', () => {
  it('work set = completed + non-warmup', () => {
    expect(isWorkSet({ kg: 100, reps: 5, completed: true })).toBe(true);
    expect(isWorkSet({ kg: 100, reps: 5, completed: false })).toBe(false);
    expect(isWorkSet({ kg: 100, reps: 5, completed: true, warmup: true })).toBe(false);
    expect(isWorkSet({ kg: 100, reps: 5, completed: true, setType: 'warmup' })).toBe(false);
  });

  it('drop/failure/tempo variants count as work when completed', () => {
    for (const setType of ['work', 'drop', 'failure', 'tempo', 'pause']) {
      expect(isWorkSet({ kg: 50, reps: 8, completed: true, setType })).toBe(true);
    }
    expect(isWarmupSet({ setType: 'warmup', completed: true })).toBe(true);
  });

  it('legacy warmup boolean resolves to warmup type', () => {
    expect(resolveSetType({ warmup: true })).toBe('warmup');
    expect(resolveSetType({})).toBe('work');
    expect(normalizeSetForStorage({ kg: 60, reps: 5 }, 'warmup')).toMatchObject({
      setType: 'warmup',
      warmup: true
    });
  });
});

describe('immutable workout actions', () => {
  it('updateSetField returns new refs along path, keeps siblings', () => {
    const before = makeWorkout();
    const after = updateSetField(before, 0, 1, 'kg', 105);
    expect(after).not.toBe(before);
    expect(after.exercises[0]).not.toBe(before.exercises[0]);
    expect(after.exercises[0].sets[1]).toMatchObject({ kg: 105 });
    expect(after.exercises[1]).toBe(before.exercises[1]);
    // input untouched
    expect(before.exercises[0].sets[1].kg).toBe(100);
  });

  it('toggleSetCompletion refuses empty sets with a toast, no state change', () => {
    const w = {
      exercises: [{ exerciseId: 1, name: 'X', sets: [{ kg: 0, reps: 0, completed: false }] }]
    };
    const { workout, toast } = toggleSetCompletion(w, 0, 0);
    expect(toast).toMatch(/kg and reps/);
    expect(workout.exercises[0].sets[0].completed).toBe(false);
  });

  it('toggle completion auto-fills suggested values', () => {
    const w = {
      exercises: [{ exerciseId: 1, name: 'X', sets: [{ kg: 0, reps: 0, completed: false, suggestedKg: 60, suggestedReps: 8 }] }]
    };
    const { workout, toast } = toggleSetCompletion(w, 0, 0);
    expect(toast).toBeNull();
    expect(workout.exercises[0].sets[0]).toMatchObject({ kg: 60, reps: 8, completed: true });
  });

  it('uncompleting clears PR flags', () => {
    const w = {
      exercises: [{ exerciseId: 1, name: 'X', sets: [{ kg: 100, reps: 5, completed: true, isBest1RM: true }] }]
    };
    const { workout } = toggleSetCompletion(w, 0, 0);
    expect(workout.exercises[0].sets[0]).toMatchObject({ completed: false, isBest1RM: false });
  });

  it('addSet appends normalized copy without mutating input', () => {
    const before = makeWorkout();
    const after = addSet(before, 0);
    expect(after.exercises[0].sets).toHaveLength(3);
    expect(after.exercises[0].sets[2]).toMatchObject({ kg: 100, reps: 5, completed: false });
    expect(before.exercises[0].sets).toHaveLength(2);
  });

  it('addWarmupSet prepends a warmup set', () => {
    const before = makeWorkout();
    const after = addWarmupSet(before, 0);
    expect(after.exercises[0].sets).toHaveLength(3);
    expect(isWarmupSet(after.exercises[0].sets[0])).toBe(true);
    expect(before.exercises[0].sets).toHaveLength(2);
  });

  it('deleteSet removes by index only', () => {
    const after = deleteSet(makeWorkout(), 0, 0);
    expect(after.exercises[0].sets).toHaveLength(1);
    expect(after.exercises[0].sets[0]).toMatchObject({ completed: false });
  });

  it('setSetType toggles warmup<->work via normalization', () => {
    const after = setSetType(makeWorkout(), 1, 0, 'work');
    expect(isWorkSet({ ...after.exercises[1].sets[0], completed: true })).toBe(true);
  });

  it('deleteExercise removes and clears orphaned superset links', () => {
    const w = {
      exercises: [
        { name: 'A', supersetId: 's1', sets: [] },
        { name: 'B', supersetId: 's1', sets: [] },
        { name: 'C', sets: [] }
      ]
    };
    const after = deleteExercise(w, 0);
    expect(after.exercises).toHaveLength(2);
    expect(after.exercises[0].supersetId).toBeNull();
    expect(w.exercises).toHaveLength(3); // input untouched
  });

  it('reorderExercises replaces array without mutating input', () => {
    const before = makeWorkout();
    const reversed = [...before.exercises].reverse();
    const after = reorderExercises(before, reversed);
    expect(after.exercises[0].name).toBe('Squat');
    expect(before.exercises[0].name).toBe('Bench');
  });

  it('createSuperset links two exercises with a fresh id', () => {
    const after = createSuperset(makeWorkout(), 0, 1);
    expect(after.exercises[0].supersetId).toBeTruthy();
    expect(after.exercises[0].supersetId).toBe(after.exercises[1].supersetId);
  });

  it('removeSuperset clears the whole group', () => {
    const linked = createSuperset(makeWorkout(), 0, 1, 's9');
    const after = removeSuperset(linked, 0);
    expect(after.exercises[0].supersetId).toBeNull();
    expect(after.exercises[1].supersetId).toBeNull();
  });

  it('guards return input for out-of-range indexes', () => {
    const before = makeWorkout();
    expect(deleteSet(before, 9, 0)).toBe(before);
    expect(deleteSet(before, 0, 9)).toBe(before);
    expect(updateSetField(before, 0, 9, 'kg', 1)).toBe(before);
  });
});

describe('buildCompletedWorkout (durable finish input)', () => {
  it('deep-clones, assigns id/date/tags/duration without mutating input', () => {
    const active = makeWorkout();
    const now = new Date('2026-01-01T11:30:00.000Z');
    const done = buildCompletedWorkout(active, { now, id: 'new-id', tags: ['#power'] });
    expect(done.id).toBe('new-id');
    expect(done.date).toBe('2026-01-01T11:30:00.000Z');
    expect(done.tags).toEqual(['#power']);
    expect(done.duration).toBe(90);
    // deep clone: nested objects are new
    expect(done.exercises[0]).not.toBe(active.exercises[0]);
    expect(done.exercises[0].sets[0]).not.toBe(active.exercises[0].sets[0]);
    expect(active.id).toBe('w1');
  });
});
