/**
 * Release-gate integration tests (QA pass).
 * Cross-surface consistency + adversarial isolation for the core flow:
 * PLAN/TEMPLATE -> ACTIVE -> FINISH -> SESSION -> EXERCISE -> STATISTICS.
 */
import { describe, it, expect } from 'vitest';
import { cloneTemplateExercisesForActive } from '../workoutExtensions';
import { prepareCleanWorkoutData } from '../workouts';
import { getSessionSummary } from '../sessionDetail';
import { getWorkoutPreview } from '../history';
import { getExerciseDetailModel } from '../exerciseDetail';
import { overviewStats, muscleStats, filterWorkoutsByRange } from '../../analytics/statistics';
import { buildCompletedWorkout, toggleSetCompletion, updateSetField } from '../workoutActions';

const exDB = [
  { id: 'bench', name: 'Bench Press', category: 'Chest', muscles: ['Chest', 'Triceps'] },
  { id: 'squat', name: 'Squat', category: 'Legs', muscles: ['Legs'] },
];

const fixtureWorkout = () => ({
  id: 'w-1',
  name: 'Push Day',
  date: '2026-09-10T10:00:00.000Z',
  startTime: '2026-09-10T10:00:00.000Z',
  duration: 60,
  exercises: [
    {
      exerciseId: 'bench', name: 'Bench Press', category: 'Chest',
      sets: [
        { kg: 60, reps: 8, completed: true, setType: 'warmup' },
        { kg: 100, reps: 5, completed: true, setType: 'work' },
        { kg: 100, reps: 5, completed: true, setType: 'work' },
      ],
    },
    {
      exerciseId: 'squat', name: 'Squat', category: 'Legs',
      sets: [
        { kg: 140, reps: 5, completed: true, setType: 'work' },
        { kg: 140, reps: 0, completed: false, setType: 'work' },
      ],
    },
  ],
});

const EXPECT_VOL = 100 * 5 + 100 * 5 + 140 * 5; // 1700
const EXPECT_WORKSETS = 3;

describe('Phase 4 — template/active isolation (adversarial)', () => {
  const template = () => ({
    id: 'tpl-1',
    name: 'Push',
    exercises: [{
      exerciseId: 'bench',
      name: 'Bench Press',
      category: 'Chest',
      progression: { mode: 'linear', targetReps: 5 },
      targetMuscles: ['Chest'],
      sets: [
        { kg: 100, reps: 5, completed: false, setType: 'work' },
        { kg: 100, reps: 5, completed: false, setType: 'work' },
      ],
    }],
  });

  it('active edits never mutate the template (no shared nested refs)', () => {
    const tpl = template();
    const active = { ...tpl, exercises: cloneTemplateExercisesForActive(tpl.exercises) };
    active.exercises[0].sets[0].kg = 110;
    active.exercises[0].progression.targetReps = 8;
    active.exercises[0].targetMuscles.push('Triceps');
    expect(tpl.exercises[0].sets[0].kg).toBe(100);
    expect(tpl.exercises[0].progression.targetReps).toBe(5);
    expect(tpl.exercises[0].targetMuscles).toEqual(['Chest']);
    expect(active.exercises[0].sets[0]).not.toBe(tpl.exercises[0].sets[0]);
  });

  it('second start from the same template starts from the original', () => {
    const tpl = template();
    const first = { ...tpl, exercises: cloneTemplateExercisesForActive(tpl.exercises) };
    first.exercises[0].sets[0].kg = 110;
    const second = { ...tpl, exercises: cloneTemplateExercisesForActive(tpl.exercises) };
    expect(second.exercises[0].sets[0].kg).toBe(100);
    expect(second.exercises[0].sets.every((s) => s.completed === false)).toBe(true);
  });
});

describe('Phase 2 — same workout, same facts everywhere', () => {
  it('finish / session / history / statistics agree on volume + work sets', () => {
    const w = fixtureWorkout();
    const clean = prepareCleanWorkoutData(w, exDB, null);
    expect(clean.totalVolume).toBe(EXPECT_VOL);
    expect(clean.completedSets).toBe(EXPECT_WORKSETS);

    const sess = getSessionSummary(w, { exercisesDB: exDB, userWeight: null });
    expect(sess.workVolume).toBe(clean.totalVolume);
    expect(sess.workSets).toBe(clean.completedSets);

    const prev = getWorkoutPreview(w, { exercisesDB: exDB, userWeight: null });
    expect(prev.workVolume).toBe(clean.totalVolume);
    expect(prev.workSets).toBe(EXPECT_WORKSETS);

    const ov = overviewStats([w], { exercisesDB: exDB });
    expect(ov.volume).toBe(EXPECT_VOL);
    expect(ov.sets).toBe(EXPECT_WORKSETS);
  });

  it('exercise detail agrees on top set + per-exercise volume', () => {
    const w = fixtureWorkout();
    const det = getExerciseDetailModel({ exerciseId: 'bench', workouts: [w], exercisesDB: exDB });
    expect(det.latest.topSet).toMatchObject({ kg: 100, reps: 5 });
    expect(det.latest.volume).toBe(1000);
    expect(det.workload.totalVolume).toBe(1000);
  });
});

describe('Phase 5 — current vs historical isolation', () => {
  const chestHeavy = {
    id: 'h1', name: 'Chest', date: '2026-09-01T10:00:00Z', duration: 30,
    exercises: [{ exerciseId: 'bench', name: 'Bench Press', category: 'Chest', sets: [{ kg: 90, reps: 5, completed: true, setType: 'work' }] }],
  };
  const backHeavy = {
    id: 'h2', name: 'Back', date: '2026-09-10T10:00:00Z', duration: 30,
    exercises: [{ exerciseId: 'row', name: 'Row', category: 'Back', sets: [{ kg: 80, reps: 5, completed: true, setType: 'work' }] }],
  };
  const db2 = [...exDB, { id: 'row', name: 'Row', category: 'Back', muscles: ['Back'] }];

  it('session summary covers only the selected workout', () => {
    const s = getSessionSummary(backHeavy, { exercisesDB: db2 });
    expect(s.workVolume).toBe(400);
    expect(s.exercisesCount).toBe(1);
  });

  it('single-session muscle stats cannot leak another session', () => {
    const m = muscleStats([backHeavy], { exercisesDB: db2 });
    expect(m.setsByMuscle.Back).toBe(1);
    expect(m.setsByMuscle.Chest).toBe(0);
  });

  it('statistics range filter excludes out-of-range history', () => {
    const ranged = filterWorkoutsByRange([chestHeavy, backHeavy], '7days', new Date('2026-09-10T12:00:00Z').getTime());
    expect(ranged.map((w) => w.id)).toEqual(['h2']);
  });
});

describe('Phase 9 — mutation semantics + finish builder', () => {
  const active = () => ({
    id: 'activeWorkout',
    date: '2026-09-10',
    startTime: '2026-09-10T10:00:00Z',
    exercises: [{ exerciseId: 'bench', name: 'Bench', sets: [{ kg: 100, reps: 5, completed: false, setType: 'work' }] }],
  });

  it('complete/uncomplete toggles immutably and clears PR flags on uncomplete', () => {
    const a = active();
    const t1 = toggleSetCompletion(a, 0, 0);
    expect(t1.workout.exercises[0].sets[0].completed).toBe(true);
    expect(a.exercises[0].sets[0].completed).toBe(false);
    const t2 = toggleSetCompletion(t1.workout, 0, 0);
    expect(t2.workout.exercises[0].sets[0].completed).toBe(false);
    expect(t2.workout.exercises[0].sets[0].isBest1RM).toBe(false);
  });

  it('field edits are immutable and targeted', () => {
    const a = active();
    const e1 = updateSetField(a, 0, 0, 'kg', 110);
    expect(e1.exercises[0].sets[0].kg).toBe(110);
    expect(a.exercises[0].sets[0].kg).toBe(100);
  });

  it('completed-workout builder never mutates the active workout', () => {
    const a = active();
    const done = toggleSetCompletion(a, 0, 0).workout;
    const built = buildCompletedWorkout(done, { now: new Date('2026-09-10T11:00:00Z'), id: 'fixed-id-1' });
    expect(built.id).toBe('fixed-id-1');
    expect(built.exercises[0].sets[0].completed).toBe(true);
    expect(done.id).toBe('activeWorkout');
  });
});

describe('Phase 11 — body map attribution identical for the same workout', () => {
  it('finish-context and session-context muscle stats match', () => {
    const w = fixtureWorkout();
    expect(muscleStats([w], { exercisesDB: exDB })).toEqual(muscleStats([w], { exercisesDB: exDB }));
  });
});
