import { describe, it, expect } from 'vitest';
import {
  DAY_MS, STAT_RANGES, workoutTime, filterWorkoutsByRange,
  resolveMusclesForExercise, muscleStats, levelsOf, MUSCLE_INTENSITY,
  intensityOfLevel, viewsForMuscle, muscleDetailFor, muscleTrend,
  overviewStats, volumeSeries, setsSeries, consistencyStats,
  strengthMovers, exerciseProgressInRange, exerciseVolumes
} from '../statistics';

const NOW = Date.UTC(2026, 5, 15, 12);
const iso = (ts) => new Date(ts).toISOString();
const set = (over = {}) => ({ kg: 100, reps: 5, completed: true, ...over });
const chestEx = (sets = [set()]) => ({ exerciseId: 'bench', name: 'Bench Press', category: 'Push', sets });
const backEx = (sets = [set()]) => ({ exerciseId: 'row', name: 'Row', category: 'Pull', sets });
const mk = (id, ageDays, exercises, extra = {}) => ({
  id, date: iso(NOW - ageDays * DAY_MS), duration: 60, exercises, ...extra
});
const DB = [
  { id: 'bench', name: 'Bench Press', category: 'Push', muscles: ['Chest', 'Triceps'] },
  { id: 'row', name: 'Row', category: 'Pull', muscles: ['Back', 'Biceps'] },
  { id: 'squat', name: 'Squat', category: 'Legs', muscles: ['Legs'] }
];
const mapOf = (db = DB) => new Map(db.map((e) => [e.id, e]));

describe('statistics range filter (A, J, K, L)', () => {
  const history = [mk('w1', 1, [chestEx()]), mk('w10', 10, [chestEx()]), mk('w40', 40, [chestEx()]), mk('w100', 100, [chestEx()])];
  it('exposes the 7D / 30D / 90D / ALL contract', () => {
    expect(STAT_RANGES).toEqual(['7days', '30days', '3months', 'all']);
  });
  it('cuts history to the active window, oldest first', () => {
    expect(filterWorkoutsByRange(history, '7days', NOW).map((w) => w.id)).toEqual(['w1']);
    expect(filterWorkoutsByRange(history, '30days', NOW).map((w) => w.id)).toEqual(['w10', 'w1']);
    expect(filterWorkoutsByRange(history, '3months', NOW).map((w) => w.id)).toEqual(['w40', 'w10', 'w1']);
    expect(filterWorkoutsByRange(history, 'all', NOW).map((w) => w.id)).toEqual(['w100', 'w40', 'w10', 'w1']);
  });
  it('excludes future and dateless workouts from every range including ALL', () => {
    const future = mk('future', -1, [chestEx()]);
    expect(filterWorkoutsByRange([...history, future], 'all', NOW).map((w) => w.id)).not.toContain('future');
    expect(filterWorkoutsByRange([{ id: 'x', exercises: [] }], 'all', NOW)).toEqual([]);
  });
  it('is deterministic and order-normalizing', () => {
    const shuffled = [history[2], history[0], history[3], history[1]];
    expect(filterWorkoutsByRange(shuffled, 'all', NOW)).toEqual(filterWorkoutsByRange(history, 'all', NOW));
  });
  it('handles empty history', () => {
    expect(filterWorkoutsByRange([], '30days', NOW)).toEqual([]);
    expect(filterWorkoutsByRange(null, '30days', NOW)).toEqual([]);
  });
});

describe('canonical muscle resolution (D)', () => {
  it('prefers stored V2, then known-exercise data, then logged muscles, then category', () => {
    // 'Bench Press' is a known exercise: the canonical entry completes the
    // legacy row with the audited Shoulders synergist.
    expect(resolveMusclesForExercise({ exerciseId: 'bench', category: 'Legs' }, mapOf())).toEqual(['Chest', 'Triceps', 'Shoulders']);
    expect(resolveMusclesForExercise({ exerciseId: 'ghost', category: 'Push', targetMuscles: ['Back'] }, mapOf())).toEqual(['Back']);
    expect(resolveMusclesForExercise({ exerciseId: 'ghost', category: 'Push' }, mapOf())).toEqual(['Chest', 'Shoulders', 'Triceps']);
  });
  it('passes legacy muscles through untouched for unknown exercises', () => {
    const db = [{ id: 'custom', name: 'Zzz Custom Press', category: 'Push', muscles: ['Chest', 'Triceps'] }];
    const map = new Map(db.map((e) => [e.id, e]));
    expect(resolveMusclesForExercise({ exerciseId: 'custom', category: 'Push' }, map)).toEqual(['Chest', 'Triceps']);
  });
  it('normalizes free-text tokens through the single category map', () => {
    expect(resolveMusclesForExercise({ exerciseId: 'x', category: 'chest' }, mapOf())).toEqual(['Chest']);
    expect(resolveMusclesForExercise({ exerciseId: 'x', category: 'Conditioning' }, mapOf())).toEqual(['Other']);
  });
});

describe('overview + series (C, F, I, M, N)', () => {
  it('aggregates workouts/sets/volume/days/minutes', () => {
    const ws = [mk('a', 1, [chestEx([set(), set()]), backEx([set()])]), mk('b', 2, [chestEx([set()])])];
    expect(overviewStats(ws, { exercisesDB: DB })).toMatchObject({ workouts: 2, sets: 4, volume: 2000, activeDays: 2, minutes: 120 });
  });
  it('counts only completed non-warmup sets', () => {
    const ws = [mk('a', 1, [{ exerciseId: 'bench', category: 'Push', sets: [{ ...set(), completed: false }, set({ warmup: true, setType: 'warmup' }), set()] }])];
    const o = overviewStats(ws, { exercisesDB: DB });
    expect(o.sets).toBe(1);
    expect(o.volume).toBe(500);
  });
  it('adds bodyweight for bodyweight exercises', () => {
    const db = [{ id: 'dip', name: 'Dip', category: 'Push', muscles: ['Chest'], usesBodyweight: true }];
    const ws = [mk('a', 1, [{ exerciseId: 'dip', category: 'Push', sets: [set({ kg: 0, reps: 10 })] }])];
    expect(overviewStats(ws, { exercisesDB: db, userWeight: 80 }).volume).toBe(800);
  });
  it('returns zeros — never NaN — for empty history', () => {
    expect(overviewStats([])).toEqual({ workouts: 0, sets: 0, volume: 0, activeDays: 0, minutes: 0 });
    expect(volumeSeries([])).toEqual([]);
    expect(setsSeries([])).toEqual([]);
  });
  it('builds chronological per-workout series', () => {
    const ws = [mk('b', 1, [chestEx([set(), set()])]), mk('a', 5, [chestEx([set()])])];
    expect(volumeSeries(ws, { exercisesDB: DB }).map((p) => p.value)).toEqual([500, 1000]);
    expect(setsSeries(ws).map((p) => p.value)).toEqual([1, 2]);
  });
});

describe('muscle stats + intensity (E, G, H)', () => {
  it('attributes sets and volume through the canonical resolver', () => {
    const stats = muscleStats([mk('a', 1, [chestEx([set({ kg: 80, reps: 8 })])])], { exercisesDB: DB });
    // Weighted exposure: primary 1.0, secondaries 0.5 (no 100% duplication).
    // 'Bench Press' resolves canonically to Chest + Triceps + Shoulders.
    expect(stats.setsByMuscle.Chest).toBe(1);
    expect(stats.setsByMuscle.Triceps).toBe(0.5);
    expect(stats.setsByMuscle.Shoulders).toBe(0.5);
    expect(stats.volumeByMuscle.Chest).toBe(640);
    expect(stats.volumeByMuscle.Triceps).toBe(320);
    expect(stats.sessionsByMuscle.Chest).toBe(1);
    expect(stats.totalSets).toBe(1);
  });
  it('exposes deterministic intensity bands with text labels', () => {
    expect(MUSCLE_INTENSITY).toEqual(['No data', 'Low', 'Moderate', 'High', 'Very high']);
    expect([0, 1, 2, 3, 4, 9].map(intensityOfLevel)).toEqual(['No data', 'Low', 'Moderate', 'High', 'Very high', 'Very high']);
  });
  it('derives intensity from the relative scale (hardest = Very high)', () => {
    const stats = muscleStats([
      mk('a', 1, [chestEx([set(), set(), set(), set()])]),
      mk('b', 2, [backEx([set()])])
    ], { exercisesDB: DB });
    expect(levelsOf(stats.setsByMuscle).Chest).toBe(4);
    expect(muscleDetailFor('Chest', stats)).toMatchObject({ sets: 4, level: 4, intensity: 'Very high' });
  });
  it('keeps one axis state for front and back views', () => {
    expect(viewsForMuscle('Chest')).toEqual(['front']);
    expect(viewsForMuscle('Back')).toEqual(['back']);
    expect(viewsForMuscle('Legs')).toEqual(['front', 'back']);
    expect(viewsForMuscle('Shoulders')).toEqual(['front', 'back']);
    expect(viewsForMuscle('Biceps')).toEqual(['front']);
    expect(viewsForMuscle('Triceps')).toEqual(['back']);
    expect(viewsForMuscle('Core')).toEqual(['front', 'back']);
  });
  it('details carry sets, volume, sessions, share and state', () => {
    const stats = muscleStats([
      mk('a', 1, [chestEx([set(), set()]), backEx([set()])])
    ], { exercisesDB: DB });
    expect(muscleDetailFor('Chest', stats)).toMatchObject({ sets: 2, volume: 1000, sessions: 1 });
    expect(muscleDetailFor('Chest', stats).share).toBeCloseTo(2 / 3);
    expect(muscleDetailFor('Legs', stats)).toMatchObject({ sets: 0, volume: 0, sessions: 0, share: 0, level: 0, intensity: 'No data' });
  });
});

describe('current-workout isolation (B)', () => {
  it('a single-workout list sees only that workout', () => {
    const current = mk('now', 0.01, [backEx([set()])]);
    const stats = muscleStats([current], { exercisesDB: DB });
    expect(stats.setsByMuscle.Chest || 0).toBe(0);
    expect(stats.setsByMuscle.Back).toBe(1);
    expect(overviewStats([current]).workouts).toBe(1);
  });
});

describe('muscle trend (G)', () => {
  it('returns null below two training sessions', () => {
    expect(muscleTrend([], 'Chest', { exercisesDB: DB })).toBeNull();
    expect(muscleTrend([mk('a', 1, [chestEx()])], 'Chest', { exercisesDB: DB })).toBeNull();
  });
  it('compares older vs newer halves beyond a noise band', () => {
    const up = [1, 1, 4, 4].map((n, i) => mk('w' + i, 30 - i * 5, [chestEx(Array.from({ length: n }, () => set()))]));
    expect(muscleTrend(up, 'Chest', { exercisesDB: DB })?.direction).toBe('up');
    const flat = [2, 2, 2, 2].map((n, i) => mk('f' + i, 30 - i * 5, [chestEx(Array.from({ length: n }, () => set()))]));
    expect(muscleTrend(flat, 'Chest', { exercisesDB: DB })?.direction).toBe('flat');
  });
});

describe('consistency (N)', () => {
  it('reports sessions, active days and weekly rate', () => {
    const ws = [mk('a', 1, [chestEx()]), mk('b', 2, [chestEx()]), mk('c', 2, [chestEx()])];
    expect(consistencyStats(filterWorkoutsByRange(ws, '7days', NOW), '7days', NOW)).toMatchObject({ workouts: 3, activeDays: 2, perWeek: 3 });
  });
  it('handles empty history', () => {
    expect(consistencyStats([], '30days', NOW)).toMatchObject({ workouts: 0, activeDays: 0, perWeek: 0, coverage: 0 });
  });
});

describe('strength movers + ranged exercise progress', () => {
  it('finds movers only with two estimable sessions in range', () => {
    const ws = [
      mk('a', 10, [{ exerciseId: 'bench', category: 'Push', sets: [set({ kg: 80, reps: 8 })] }]),
      mk('b', 1, [{ exerciseId: 'bench', category: 'Push', sets: [set({ kg: 90, reps: 8 })] }]),
      mk('c', 1, [{ exerciseId: 'row', category: 'Pull', sets: [set({ kg: 50, reps: 8 })] }])
    ];
    const movers = strengthMovers(ws, { topN: 5 });
    expect(movers.map((m) => m.id)).toEqual(['bench']);
    expect(movers[0].delta).toBeGreaterThan(0);
  });
  it('cuts exercise progress to the range but keeps the all-time record', () => {
    const ws = [
      mk('old', 100, [{ exerciseId: 'bench', category: 'Push', sets: [set({ kg: 100, reps: 5 })] }]),
      mk('new', 2, [{ exerciseId: 'bench', category: 'Push', sets: [set({ kg: 80, reps: 5 })] }])
    ];
    const p = exerciseProgressInRange(ws, 'bench', '30days', NOW);
    expect(p.total).toBe(1);
    expect(p.best).toBeGreaterThan(0);
    expect(p.allTimeBest).toBeGreaterThanOrEqual(p.best);
    expect(p.totalAllTime).toBe(2);
    expect(exerciseProgressInRange(ws, 'bench', 'all', NOW).total).toBe(2);
  });
});

describe('large history sanity (O)', () => {
  it('aggregates 500 workouts with finite numbers in reasonable time', () => {
    const ws = Array.from({ length: 500 }, (_, i) => mk('w' + i, i % 400, [
      chestEx([set({ kg: 60 + (i % 80), reps: 5 + (i % 6) })]),
      backEx([set({ kg: 50, reps: 8 })])
    ]));
    const t0 = Date.now();
    const ranged = filterWorkoutsByRange(ws, 'all', NOW);
    const o = overviewStats(ranged, { exercisesDB: DB });
    const stats = muscleStats(ranged, { exercisesDB: DB });
    expect(ranged).toHaveLength(500);
    expect(Number.isFinite(o.volume) && Number.isFinite(o.sets)).toBe(true);
    expect(Object.values(stats.setsByMuscle).every(Number.isFinite)).toBe(true);
    expect(Date.now() - t0).toBeLessThan(5000);
  });
});

describe('exercise volumes index', () => {
  it('ranks by attributed work volume with sessions and best set', () => {
    const ws = [
      mk('a', 1, [chestEx([set({ kg: 80, reps: 8 }), set({ kg: 80, reps: 8 })]), backEx([set({ kg: 50, reps: 10 })])]),
      mk('b', 2, [chestEx([set({ kg: 70, reps: 10 })])])
    ];
    const rows = exerciseVolumes(ws, { exercisesDB: DB });
    expect(rows.map((r) => r.id)).toEqual(['bench', 'row']);
    expect(rows[0]).toMatchObject({ sessions: 2, bestKg: 70, bestReps: 10 });
    expect(rows[0].volume).toBe(80 * 8 * 2 + 70 * 10);
  });
  it('skips exercises without id and returns [] for empty history', () => {
    expect(exerciseVolumes([])).toEqual([]);
    expect(exerciseVolumes([mk('a', 1, [{ category: 'Push', sets: [set()] }])])).toEqual([]);
  });
});

describe('workoutTime', () => {
  it('parses dates and rejects garbage', () => {
    expect(Number.isFinite(workoutTime({ date: iso(NOW) }))).toBe(true);
    expect(workoutTime(null)).toBeNaN();
  });
});
