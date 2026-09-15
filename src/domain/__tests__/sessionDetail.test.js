import { describe, it, expect } from 'vitest';
import {
  findWorkoutById,
  resolveSessionDuration,
  countSessionPRs,
  prExerciseNames,
  getSessionSummary,
  getSessionBestSet,
  getSessionTopVolumeExercise,
  getSessionExercises,
  getSessionMuscleStats,
  getSessionComparison,
  getSessionHighlights,
  buildSessionReturn,
  resolveSessionBackTarget,
} from '../sessionDetail';
import { getWorkoutPreview } from '../history';
import { muscleStats } from '../../analytics/statistics';

const EXERCISES_DB = [
  { id: 1, name: 'Bench Press', category: 'Chest', muscles: ['Chest'] },
  { id: 2, name: 'Barbell Row', category: 'Back', muscles: ['Back'] },
  { id: 3, name: 'Pull-Up', category: 'Back', muscles: ['Back'], usesBodyweight: true },
];

const work = (kg, reps, extra = {}) => ({ kg, reps, completed: true, setType: 'work', ...extra });
const warm = (kg, reps) => ({ kg, reps, completed: true, setType: 'warmup', warmup: true });
const planned = (kg, reps) => ({ kg, reps, completed: false, setType: 'work' });

const chestHeavy = {
  id: 'wA',
  name: 'Chest Day',
  date: '2026-09-10',
  duration: 60,
  exercises: [
    {
      exerciseId: 1, name: 'Bench Press', category: 'Chest',
      sets: [warm(60, 8), work(100, 5), work(100, 5), work(102.5, 5), planned(102.5, 5)],
    },
  ],
};

const backHeavy = {
  id: 'wB',
  name: 'Back Day',
  date: '2026-09-12',
  duration: 55,
  exercises: [
    {
      exerciseId: 2, name: 'Barbell Row', category: 'Back',
      sets: [work(80, 8), work(80, 8), work(85, 6)],
    },
    {
      exerciseId: 3, name: 'Pull-Up', category: 'Back',
      sets: [work(0, 10), work(0, 8)],
    },
  ],
};

describe('session summary (WHAT DID THIS SESSION CONTAIN?)', () => {
  it('computes canonical totals: work sets, reps, volume, completion', () => {
    const s = getSessionSummary(chestHeavy, { exercisesDB: EXERCISES_DB });
    expect(s.found).toBe(true);
    expect(s.exercisesCount).toBe(1);
    expect(s.workSets).toBe(3); // warm-up + planned excluded
    expect(s.completedSets).toBe(4); // warm-up included
    expect(s.plannedSets).toBe(4); // 3 completed work + 1 planned
    expect(s.totalReps).toBe(15);
    expect(s.workVolume).toBe(100 * 5 + 100 * 5 + 102.5 * 5);
    expect(s.durationMin).toBe(60);
    expect(s.completionPct).toBe(75);
    expect(s.density).toBe(Math.round(s.workVolume / 60));
    expect(s.hasWork).toBe(true);
  });

  it('is bodyweight-aware like Statistics (pull-ups add user weight)', () => {
    const s = getSessionSummary(backHeavy, { exercisesDB: EXERCISES_DB, userWeight: 80 });
    // rows: 80*8*2 + 85*6 = 1790; pull-ups: 80*10 + 80*8 = 1440
    expect(s.workVolume).toBe(1790 + 1440);
    expect(s.workSets).toBe(5);
  });

  it('returns a safe empty model for null/legacy input', () => {
    expect(getSessionSummary(null).found).toBe(false);
    const s = getSessionSummary({ id: 'legacy' }, { exercisesDB: EXERCISES_DB });
    expect(s).toMatchObject({
      found: true, exercisesCount: 0, workSets: 0, workVolume: 0,
      durationMin: null, completionPct: null, density: null, hasWork: false,
    });
  });

  it('zero-work session stays honestly empty', () => {
    const s = getSessionSummary(
      { id: 'x', date: '2026-09-01', exercises: [{ name: 'Bench', sets: [warm(60, 8)] }] },
      { exercisesDB: EXERCISES_DB }
    );
    expect(s.hasWork).toBe(false);
    expect(s.workVolume).toBe(0);
  });
});

describe('session duration', () => {
  it('prefers stored duration, falls back to start/end, else null', () => {
    expect(resolveSessionDuration({ duration: 45 })).toBe(45);
    expect(resolveSessionDuration({ duration: 45.9 })).toBe(45);
    expect(resolveSessionDuration({
      startTime: '2026-09-10T10:00:00.000Z',
      endTime: '2026-09-10T11:00:00.000Z',
    })).toBe(60);
    expect(resolveSessionDuration({})).toBeNull();
    expect(resolveSessionDuration(null)).toBeNull();
  });
});

describe('session PRs and best sets', () => {
  const prWorkout = {
    id: 'wP', date: '2026-09-12', duration: 30,
    exercises: [
      { exerciseId: 1, name: 'Bench Press', category: 'Chest', sets: [work(105, 5, { isBest1RM: true, isHeaviestWeight: true })] },
      { exerciseId: 2, name: 'Barbell Row', category: 'Back', sets: [work(80, 8)] },
    ],
  };

  it('counts flagged sets and names the exercises', () => {
    expect(countSessionPRs(prWorkout)).toBe(1);
    expect(prExerciseNames(prWorkout)).toEqual(['Bench Press']);
    expect(countSessionPRs(chestHeavy)).toBe(0);
  });

  it('picks the best set by estimated 1RM', () => {
    const best = getSessionBestSet(backHeavy);
    // 80x8 → 101; 85x6 → 102; pull-ups use base kg 0 → skipped
    expect(best).toMatchObject({ exerciseName: 'Barbell Row', kg: 85, reps: 6, estimated1RM: 102 });
    expect(getSessionBestSet({ exercises: [] })).toBeNull();
  });

  it('finds the top-volume exercise', () => {
    const top = getSessionTopVolumeExercise(backHeavy, { exercisesDB: EXERCISES_DB, userWeight: null });
    // rows: 1280+510=1790 without bodyweight; pull-ups 0 → row wins
    expect(top).toMatchObject({ exerciseName: 'Barbell Row', volume: 1790 });
  });
});

describe('exercise breakdown', () => {
  it('returns one compact row per exercise in workout order', () => {
    const rows = getSessionExercises(backHeavy, { exercisesDB: EXERCISES_DB, userWeight: 80 });
    expect(rows.map((r) => r.name)).toEqual(['Barbell Row', 'Pull-Up']);
    expect(rows[0]).toMatchObject({
      exerciseId: 2, workSets: 3, reps: 22, volume: 1790, canOpen: true, skipped: false,
    });
    expect(rows[0].bestSet).toMatchObject({ kg: 85, reps: 6 });
    expect(rows[1].volume).toBe(80 * 10 + 80 * 8);
  });

  it('keeps skipped work visible and blocks deep-links without an id', () => {
    const rows = getSessionExercises({
      id: 'x',
      exercises: [
        { name: 'Mystery Lift', sets: [planned(50, 5)] },
        { exerciseId: 1, name: 'Bench Press', category: 'Chest', sets: [work(100, 5)] },
      ],
    }, { exercisesDB: EXERCISES_DB });
    expect(rows[0]).toMatchObject({ name: 'Mystery Lift', category: 'General', canOpen: false, skipped: true, workSets: 0 });
    expect(rows[1].canOpen).toBe(true);
  });

  it('falls back for missing metadata instead of rendering undefined', () => {
    const rows = getSessionExercises({ id: 'x', exercises: [{ sets: [work(10, 10)] }] }, {});
    expect(rows[0].name).toBe('Unknown exercise');
    expect(rows).toHaveLength(1);
  });
});

describe('session muscle attribution', () => {
  it('matches the canonical Statistics aggregation for the same session', () => {
    const via = getSessionMuscleStats(backHeavy, { exercisesDB: EXERCISES_DB, userWeight: 80 });
    const canonical = muscleStats([backHeavy], { exercisesDB: EXERCISES_DB, userWeight: 80 });
    expect(via).toEqual(canonical);
  });

  it('CRITICAL ISOLATION: Workout B map shows Workout B only (no Chest from A)', () => {
    const history = [chestHeavy, backHeavy];
    const mapB = getSessionMuscleStats(backHeavy, { exercisesDB: EXERCISES_DB });
    const mapA = getSessionMuscleStats(chestHeavy, { exercisesDB: EXERCISES_DB });
    // B is back-heavy: Back>0, Chest must be exactly 0
    expect(mapB.setsByMuscle.Back).toBeGreaterThan(0);
    expect(mapB.setsByMuscle.Chest).toBe(0);
    expect(mapB.totalSets).toBe(5);
    // A is chest-heavy: mirror invariant
    expect(mapA.setsByMuscle.Chest).toBeGreaterThan(0);
    expect(mapA.setsByMuscle.Back).toBe(0);
    // Full-history aggregation differs from either single session (sanity)
    const both = muscleStats(history, { exercisesDB: EXERCISES_DB });
    expect(both.setsByMuscle.Chest).toBeGreaterThan(0);
    expect(both.setsByMuscle.Back).toBeGreaterThan(0);
    expect(mapB).not.toEqual(both);
  });
});

describe('session comparison', () => {
  it('compares against the previous session with canonical volumes', () => {
    const c = getSessionComparison(backHeavy, [chestHeavy, backHeavy], { exercisesDB: EXERCISES_DB });
    expect(c.hasPrevious).toBe(true);
    expect(c.previousId).toBe('wA');
    expect(c.previousName).toBe('Chest Day');
    expect(c.volumeCurrent).toBe(1790);
    expect(c.volumePrevious).toBe(100 * 5 + 100 * 5 + 102.5 * 5);
    expect(c.volumeDeltaPct).toBe(Math.round(((1790 - 1512.5) / 1512.5) * 100));
    expect(c.workSetsDelta).toBe(5 - 3);
    expect(c.durationDeltaMin).toBe(55 - 60);
    expect(['up', 'flat', 'down']).toContain(c.trend);
  });

  it('reports no previous for the first session and never picks itself/future', () => {
    expect(getSessionComparison(chestHeavy, [chestHeavy]).hasPrevious).toBe(false);
    const c = getSessionComparison(chestHeavy, [chestHeavy, backHeavy]);
    expect(c.hasPrevious).toBe(false); // backHeavy is in the future, not previous
  });
});

describe('session highlights', () => {
  it('collects facts, never invented insights', () => {
    const h = getSessionHighlights(backHeavy, [chestHeavy, backHeavy], { exercisesDB: EXERCISES_DB });
    expect(h.prCount).toBe(0);
    expect(h.prExercises).toEqual([]);
    expect(h.bestSet.exerciseName).toBe('Barbell Row');
    expect(h.topVolumeExercise.exerciseName).toBe('Barbell Row');
    expect(h.comparison.hasPrevious).toBe(true);
  });
});

describe('session navigation contract', () => {
  it('round-trips History → Session → Exercise → Back → Session', () => {
    const ret = buildSessionReturn({ date: '2026-09-12', workoutId: 'wB' });
    expect(ret).toEqual({ view: 'workoutDetail', date: '2026-09-12', workoutId: 'wB' });
    expect(resolveSessionBackTarget(ret)).toEqual({ view: 'workoutDetail', date: '2026-09-12', workoutId: 'wB' });
  });

  it('leaves non-session entries to their legacy behavior', () => {
    expect(resolveSessionBackTarget(null)).toBeNull();
    expect(resolveSessionBackTarget({ view: 'profileStatistics' })).toBeNull();
    expect(resolveSessionBackTarget({ view: 'exercises' })).toBeNull();
  });

  it('finds workouts by id, null-safe', () => {
    expect(findWorkoutById([chestHeavy, backHeavy], 'wB')).toBe(backHeavy);
    expect(findWorkoutById([chestHeavy], 'missing')).toBeNull();
    expect(findWorkoutById(null, 'wB')).toBeNull();
    expect(findWorkoutById([chestHeavy], null)).toBeNull();
  });
});

describe('cross-screen consistency', () => {
  it('history preview and session summary agree on one workout', () => {
    const preview = getWorkoutPreview(backHeavy, { exercisesDB: EXERCISES_DB, userWeight: 80 });
    const summary = getSessionSummary(backHeavy, { exercisesDB: EXERCISES_DB, userWeight: 80 });
    expect(preview.workVolume).toBe(summary.workVolume);
    expect(preview.workSets).toBe(summary.workSets);
    expect(preview.prCount).toBe(summary.prCount);
  });
});
