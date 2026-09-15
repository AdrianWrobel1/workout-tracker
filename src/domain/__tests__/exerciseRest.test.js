import { describe, it, expect } from 'vitest';
import {
  DEFAULT_REST_SEC,
  normalizeExerciseRestOverride,
  resolveRestDuration,
  resolveRestForWorkoutSet,
  sanitizeExerciseRestForStorage,
  createRestTimer,
  shouldAutoStartRest
} from '../restTimer';
import { toggleSetCompletion } from '../workoutActions';
import { normalizeImportedExercise } from '../../services/importExport';

const NOW = 1_700_000_000_000;

const makeWorkout = (set = { kg: 100, reps: 5, completed: false }, exerciseId = 1) => ({
  id: 'w1',
  name: 'Push',
  startTime: new Date('2026-01-01T10:00:00.000Z').toISOString(),
  exercises: [
    { exerciseId, name: 'Bench', category: 'Push', sets: [{ ...set }] }
  ]
});

const completeThroughRealPath = (workout, exIndex = 0, setIndex = 0, autoStartEnabled = true) => {
  const prevSet = workout.exercises[exIndex]?.sets?.[setIndex] ?? null;
  const { workout: next, toast } = toggleSetCompletion(workout, exIndex, setIndex);
  const nextSet = next.exercises[exIndex]?.sets?.[setIndex] ?? null;
  const should = shouldAutoStartRest({ prevSet, nextSet, toast, autoStartEnabled });
  return { prevSet, next, nextSet, toast, should };
};

describe('resolveRestDuration (exercise override → global → safe fallback)', () => {
  it('1. valid override wins over the global default', () => {
    expect(resolveRestDuration({ id: 1, restSec: 150 }, 90)).toBe(150);
  });

  it('2. missing override uses the normalized global rest', () => {
    expect(resolveRestDuration({ id: 1, name: 'Bench' }, 90)).toBe(90);
  });

  it('3. undefined override uses the global default', () => {
    expect(resolveRestDuration({ id: 1, restSec: undefined }, 90)).toBe(90);
  });

  it('4. null override uses the global default', () => {
    expect(resolveRestDuration({ id: 1, restSec: null }, 90)).toBe(90);
  });

  it('5. legacy numeric strings are accepted', () => {
    expect(resolveRestDuration({ id: 1, restSec: '150' }, 90)).toBe(150);
    expect(normalizeExerciseRestOverride('60')).toBe(60);
  });

  it('6. negative override is ignored', () => {
    expect(resolveRestDuration({ id: 1, restSec: -30 }, 90)).toBe(90);
  });

  it('7. zero is never a valid override (means "use global")', () => {
    expect(resolveRestDuration({ id: 1, restSec: 0 }, 90)).toBe(90);
    expect(normalizeExerciseRestOverride(0)).toBeUndefined();
  });

  it('8. NaN override is ignored', () => {
    expect(resolveRestDuration({ id: 1, restSec: NaN }, 90)).toBe(90);
  });

  it('9. non-numeric strings are ignored', () => {
    expect(resolveRestDuration({ id: 1, restSec: 'lots' }, 90)).toBe(90);
    expect(resolveRestDuration({ id: 1, restSec: {} }, 90)).toBe(90);
    expect(resolveRestDuration({ id: 1, restSec: true }, 90)).toBe(90);
  });

  it('10. values below the 15s minimum are ignored', () => {
    expect(resolveRestDuration({ id: 1, restSec: 5 }, 90)).toBe(90);
    expect(resolveRestDuration({ id: 1, restSec: 14 }, 90)).toBe(90);
  });

  it('11. values above the 600s maximum are ignored', () => {
    expect(resolveRestDuration({ id: 1, restSec: 601 }, 90)).toBe(90);
    expect(resolveRestDuration({ id: 1, restSec: 3600 }, 90)).toBe(90);
  });

  it('12. decimals round like the global normalizer', () => {
    expect(resolveRestDuration({ id: 1, restSec: 150.4 }, 90)).toBe(150);
    expect(resolveRestDuration({ id: 1, restSec: 150.6 }, 90)).toBe(151);
  });

  it('13. invalid global value falls back to the safe default', () => {
    for (const bad of [NaN, 'abc', 0, -5, 5, 3600, undefined, null]) {
      expect(resolveRestDuration({ id: 1 }, bad)).toBe(DEFAULT_REST_SEC);
    }
  });

  it('14. exercise override takes precedence over any valid global', () => {
    expect(resolveRestDuration({ id: 1, restSec: 150 }, 120)).toBe(150);
    expect(resolveRestDuration({ id: 1, restSec: 60 }, 180)).toBe(60);
  });

  it('15. fallback returns the normalized (not raw) global', () => {
    expect(resolveRestDuration({ id: 1 }, 120.6)).toBe(121);
    expect(resolveRestDuration(null, 120)).toBe(120);
    expect(resolveRestDuration(undefined, 120)).toBe(120);
  });

  it('16. neither value valid → safe fallback', () => {
    expect(resolveRestDuration({ restSec: 'junk' }, 'junk')).toBe(DEFAULT_REST_SEC);
    expect(resolveRestDuration(null, null)).toBe(DEFAULT_REST_SEC);
  });

  it('17. inputs are never mutated', () => {
    const exercise = Object.freeze({ id: 1, restSec: 150, name: 'Bench' });
    const before = JSON.stringify(exercise);
    resolveRestDuration(exercise, 90);
    expect(JSON.stringify(exercise)).toBe(before);
    const bare = Object.freeze({ id: 2 });
    resolveRestDuration(bare, 90);
    expect('restSec' in bare).toBe(false);
  });
});

describe('rest auto-start integration through toggleSetCompletion', () => {
  const DB = [
    { id: 1, name: 'Bench Press', category: 'Push', restSec: 150 },
    { id: 2, name: 'Lateral Raise', category: 'Push', restSec: 60 },
    { id: 3, name: 'Squat', category: 'Legs' }
  ];

  const effectiveFor = (workout, exercisesDB = DB, globalRestSec = 90, exIndex = 0) =>
    resolveRestForWorkoutSet({ workout, exIndex, exercisesDB, globalRestSec });

  it('18. normal work set uses the exercise override', () => {
    const workout = makeWorkout();
    const { next, should, toast } = completeThroughRealPath(workout);
    expect(toast).toBeNull();
    expect(should).toBe(true);
    expect(effectiveFor(next)).toBe(150);
  });

  it('19. work set without override uses the global default', () => {
    const workout = makeWorkout({ kg: 100, reps: 5, completed: false }, 3);
    const { next, should } = completeThroughRealPath(workout);
    expect(should).toBe(true);
    expect(effectiveFor(next)).toBe(90);
  });

  it('20. warmup does not auto-start', () => {
    const workout = makeWorkout({ kg: 60, reps: 5, completed: false, setType: 'warmup' });
    const { should } = completeThroughRealPath(workout);
    expect(should).toBe(false);
  });

  it('21. rejected completion does not auto-start', () => {
    const workout = makeWorkout({ kg: 0, reps: 0, completed: false });
    const { should, toast } = completeThroughRealPath(workout);
    expect(toast).toBeTruthy();
    expect(should).toBe(false);
  });

  it('22. editing an already completed set does not restart rest', () => {
    const workout = makeWorkout({ kg: 100, reps: 5, completed: false });
    const { next } = completeThroughRealPath(workout);
    // Simulate an edit of the completed set: prev is completed → no transition.
    const prevSet = next.exercises[0].sets[0];
    const edited = {
      ...next,
      exercises: next.exercises.map((ex, i) =>
        i === 0
          ? { ...ex, sets: ex.sets.map((s, j) => (j === 0 ? { ...s, kg: 102.5 } : s)) }
          : ex
      )
    };
    const nextSet = edited.exercises[0].sets[0];
    expect(
      shouldAutoStartRest({ prevSet, nextSet, toast: null, autoStartEnabled: true })
    ).toBe(false);
  });

  it('23. un-completing a set does not restart rest', () => {
    const done = makeWorkout({ kg: 100, reps: 5, completed: true });
    const prevSet = done.exercises[0].sets[0];
    const { workout: next, toast } = toggleSetCompletion(done, 0, 0);
    expect(next.exercises[0].sets[0].completed).toBe(false);
    expect(
      shouldAutoStartRest({ prevSet, nextSet: next.exercises[0].sets[0], toast })
    ).toBe(false);
  });

  it('24. duplicate completion never starts another timer', () => {
    const done = makeWorkout({ kg: 100, reps: 5, completed: true });
    const prevSet = done.exercises[0].sets[0];
    // Toggling a completed set un-completes it; there is no false→true edge.
    const { workout: next, toast } = toggleSetCompletion(done, 0, 0);
    expect(
      shouldAutoStartRest({ prevSet, nextSet: next.exercises[0].sets[0], toast })
    ).toBe(false);
  });

  it('25. disabled auto-start never starts, even with an override', () => {
    const workout = makeWorkout();
    const { should } = completeThroughRealPath(workout, 0, 0, false);
    expect(should).toBe(false);
    // Resolution itself is unaffected by the toggle — only the start is gated.
    const { next } = completeThroughRealPath(workout);
    expect(effectiveFor(next)).toBe(150);
  });

  it('26. timer receives the resolved duration', () => {
    const workout = makeWorkout();
    const { next, should } = completeThroughRealPath(workout);
    expect(should).toBe(true);
    const timer = createRestTimer(effectiveFor(next), NOW, '0:0');
    expect(timer.totalSec).toBe(150);
    expect(timer.endsAt).toBe(NOW + 150 * 1000);
    const plain = makeWorkout({ kg: 100, reps: 5, completed: false }, 3);
    const done = completeThroughRealPath(plain);
    expect(createRestTimer(effectiveFor(done.next, DB, 120), NOW).totalSec).toBe(120);
  });

  it('27. workout object is unchanged by rest resolution', () => {
    const workout = makeWorkout();
    const { next } = completeThroughRealPath(workout);
    const snapshot = JSON.parse(JSON.stringify(next));
    const dbSnapshot = JSON.parse(JSON.stringify(DB));
    resolveRestForWorkoutSet({ workout: next, exIndex: 0, exercisesDB: DB, globalRestSec: 90 });
    expect(next).toEqual(snapshot);
    expect(DB).toEqual(dbSnapshot);
    expect(next).not.toHaveProperty('restTimer');
  });
});

describe('exercise lookup safety', () => {
  const DB = [{ id: 1, name: 'Bench', category: 'Push', restSec: 150 }];

  it('unknown / deleted exercises fall back to global', () => {
    const workout = makeWorkout({ kg: 100, reps: 5, completed: true }, 999);
    expect(resolveRestForWorkoutSet({ workout, exIndex: 0, exercisesDB: DB, globalRestSec: 90 })).toBe(90);
  });

  it('missing exerciseId falls back to global', () => {
    const workout = { exercises: [{ name: 'Mystery', sets: [] }] };
    expect(resolveRestForWorkoutSet({ workout, exIndex: 0, exercisesDB: DB, globalRestSec: 90 })).toBe(90);
  });

  it('out-of-range index and missing db never throw', () => {
    const workout = makeWorkout({ kg: 100, reps: 5, completed: true });
    expect(resolveRestForWorkoutSet({ workout, exIndex: 7, exercisesDB: DB, globalRestSec: 90 })).toBe(90);
    expect(resolveRestForWorkoutSet({ workout, exIndex: 0, exercisesDB: null, globalRestSec: 90 })).toBe(90);
    expect(resolveRestForWorkoutSet({ workout: null, exIndex: 0, exercisesDB: DB, globalRestSec: 90 })).toBe(90);
  });

  it('malformed override in db is ignored, workout continues', () => {
    const badDB = [{ id: 1, name: 'Bench', category: 'Push', restSec: 'junk' }];
    const workout = makeWorkout({ kg: 100, reps: 5, completed: true });
    expect(resolveRestForWorkoutSet({ workout, exIndex: 0, exercisesDB: badDB, globalRestSec: 90 })).toBe(90);
  });
});

describe('global setting interaction', () => {
  it('no override → global changes affect future timers', () => {
    const plain = { id: 3, name: 'Squat', category: 'Legs' };
    expect(resolveRestDuration(plain, 90)).toBe(90);
    expect(resolveRestDuration(plain, 120)).toBe(120);
  });

  it('override present → global changes do not affect that exercise', () => {
    const ex = { id: 1, restSec: 150 };
    expect(resolveRestDuration(ex, 90)).toBe(150);
    expect(resolveRestDuration(ex, 120)).toBe(150);
  });

  it('cleared override (absent) → inherits global again', () => {
    // Clearing = removing the key entirely (what the editor writes on reset).
    const withOverride = { id: 1, name: 'Bench', category: 'Push', restSec: 150 };
    const { restSec: _dropped, ...cleared } = withOverride;
    void _dropped;
    expect(cleared).not.toHaveProperty('restSec');
    expect(resolveRestDuration(cleared, 120)).toBe(120);
    // Sanitizing an already-absent record is a no-op (stays absent).
    expect(sanitizeExerciseRestForStorage(cleared)).not.toHaveProperty('restSec');
  });
});

describe('storage sanitization + import compatibility', () => {
  it('valid override survives sanitization as a rounded number', () => {
    expect(
      sanitizeExerciseRestForStorage({ id: 1, name: 'B', category: 'Push', restSec: 150 })
    ).toMatchObject({ restSec: 150 });
    expect(
      sanitizeExerciseRestForStorage({ id: 1, name: 'B', category: 'Push', restSec: '120' })
    ).toMatchObject({ restSec: 120 });
  });

  it('absent override stays absent (no magic values written)', () => {
    const ex = { id: 1, name: 'B', category: 'Push' };
    const out = sanitizeExerciseRestForStorage(ex);
    expect(out).not.toHaveProperty('restSec');
    expect(ex).not.toHaveProperty('restSec');
  });

  it('malformed override is dropped, exercise stays usable', () => {
    for (const bad of [0, -5, NaN, 'lots', 5, 9999, null, undefined]) {
      const out = sanitizeExerciseRestForStorage({ id: 1, name: 'B', category: 'Push', restSec: bad });
      expect(out).not.toHaveProperty('restSec');
    }
  });

  it('sanitization never mutates the input', () => {
    const ex = Object.freeze({ id: 1, name: 'B', category: 'Push', restSec: 150 });
    sanitizeExerciseRestForStorage(ex);
    expect(ex.restSec).toBe(150);
  });

  it('import preserves valid overrides and ignores invalid ones', () => {
    expect(
      normalizeImportedExercise({ id: 'e1', name: 'Bench', category: 'Push', restSec: 150 })
    ).toMatchObject({ restSec: 150 });
    expect(
      normalizeImportedExercise({ id: 'e2', name: 'Row', category: 'Pull' })
    ).not.toHaveProperty('restSec');
    expect(
      normalizeImportedExercise({ id: 'e3', name: 'Curl', category: 'Pull', restSec: 'junk' })
    ).not.toHaveProperty('restSec');
    expect(
      normalizeImportedExercise({ id: 'e4', name: 'Old', category: 'Push', restSec: null })
    ).not.toHaveProperty('restSec');
  });

  it('export shape keeps the override on the exercise record only', () => {
    const exercise = sanitizeExerciseRestForStorage({ id: 1, name: 'Bench', category: 'Push', restSec: 150 });
    const exported = JSON.parse(JSON.stringify({ exercisesDB: [exercise] }));
    expect(exported.exercisesDB[0]).toMatchObject({ restSec: 150 });
    // Historical set records never carry the preference.
    const setRecord = { kg: 100, reps: 5, completed: true, setType: 'work' };
    expect(setRecord).not.toHaveProperty('restSec');
  });
});
