import { describe, it, expect } from 'vitest';
import {
  getHistoryModel,
  getWorkoutPreview,
  isPRWorkout,
  hasStoredPR,
  countStoredPRs,
  relativeDay,
  formatSessionDate,
  formatSessionTime,
  formatSessionDuration,
  formatCompactVolume,
} from '../history';

const NOW = new Date(2026, 8, 14, 12, 0, 0).getTime(); // local noon, Sep 14 2026

const bench = (sets) => ({
  exerciseId: 1,
  name: 'Bench Press',
  category: 'Chest',
  sets,
});
const work = (kg, reps, extra = {}) => ({ kg, reps, completed: true, setType: 'work', ...extra });
const warm = (kg, reps) => ({ kg, reps, completed: true, setType: 'warmup', warmup: true });

const mkWorkout = (over = {}) => ({
  id: 'w1',
  name: 'Chest Day',
  date: '2026-09-10',
  duration: 60,
  exercises: [bench([work(100, 5), work(100, 5)])],
  ...over,
});

describe('history list model', () => {
  it('orders newest first and groups by local month', () => {
    const model = getHistoryModel({
      workouts: [
        mkWorkout({ id: 'old', date: '2026-07-01' }),
        mkWorkout({ id: 'new', date: '2026-09-10' }),
        mkWorkout({ id: 'mid', date: '2026-08-05' }),
      ],
      now: NOW,
    });
    expect(model.items.map((i) => i.id)).toEqual(['new', 'mid', 'old']);
    expect(model.groups.map((g) => g.monthKey)).toEqual(['2026-09', '2026-08', '2026-07']);
    expect(model.total).toBe(3);
    expect(model.shown).toBe(3);
  });

  it('excludes future workouts but counts them honestly', () => {
    const model = getHistoryModel({
      workouts: [
        mkWorkout({ id: 'past', date: '2026-09-10' }),
        mkWorkout({ id: 'today', date: '2026-09-14' }),
        mkWorkout({ id: 'future', date: '2026-09-15' }),
      ],
      now: NOW,
    });
    expect(model.items.map((i) => i.id)).toEqual(['today', 'past']);
    expect(model.excludedFuture).toBe(1);
    expect(model.total).toBe(2);
  });

  it('keeps dateless/legacy workouts last instead of dropping them', () => {
    const model = getHistoryModel({
      workouts: [mkWorkout({ id: 'nodate', date: undefined }), mkWorkout({ id: 'ok', date: '2026-09-10' })],
      now: NOW,
    });
    expect(model.items.map((i) => i.id)).toEqual(['ok', 'nodate']);
    expect(model.items[1].validDate).toBe(false);
    expect(model.groups[model.groups.length - 1].monthKey).toBe('unknown');
  });

  it('handles empty history with zeros, never NaN', () => {
    const model = getHistoryModel({ workouts: [], now: NOW });
    expect(model).toMatchObject({ total: 0, shown: 0, excludedFuture: 0, heavyCutoff: 0 });
    expect(model.items).toEqual([]);
    expect(model.groups).toEqual([]);
  });

  it('finds sessions by workout name or exercise name (case-insensitive)', () => {
    const workouts = [
      mkWorkout({ id: 'a', name: 'Push Power' }),
      mkWorkout({ id: 'b', name: 'Legs', exercises: [{ exerciseId: 9, name: 'Squat', category: 'Legs', sets: [work(120, 5)] }] }),
    ];
    expect(getHistoryModel({ workouts, query: 'push', now: NOW }).items.map((i) => i.id)).toEqual(['a']);
    expect(getHistoryModel({ workouts, query: 'SQUAT', now: NOW }).items.map((i) => i.id)).toEqual(['b']);
    expect(getHistoryModel({ workouts, query: 'bench', now: NOW }).items.map((i) => i.id)).toEqual(['a']);
    expect(getHistoryModel({ workouts, query: 'nope', now: NOW }).items).toEqual([]);
  });

  it('filters by tags', () => {
    const workouts = [
      mkWorkout({ id: 'a', tags: ['#power'] }),
      mkWorkout({ id: 'b', tags: ['#cut'] }),
    ];
    const model = getHistoryModel({ workouts, tags: ['#power'], now: NOW });
    expect(model.items.map((i) => i.id)).toEqual(['a']);
  });

  it('PR filter matches stored flags without a records scan', () => {
    const pr = mkWorkout({
      id: 'pr',
      date: '2026-09-10',
      exercises: [bench([work(100, 5, { isBest1RM: true })])],
    });
    const plain = mkWorkout({
      id: 'plain',
      date: '2026-09-01',
      exercises: [bench([work(80, 5)])],
    });
    const model = getHistoryModel({ workouts: [pr, plain], filter: 'pr', now: NOW });
    expect(model.items.map((i) => i.id)).toEqual(['pr']);
  });

  it('heavy/light cutoffs use canonical work volume (warm-ups excluded)', () => {
    // heavy candidate: 200x5x3 = 3000 work volume; light: 20x10 = 200.
    // decoy: 5000kg of pure warm-up volume must NOT count as heavy.
    const heavy = mkWorkout({ id: 'heavy', date: '2026-09-12', exercises: [bench([work(200, 5), work(200, 5), work(200, 5)])] });
    const light = mkWorkout({ id: 'light', date: '2026-09-11', exercises: [bench([work(20, 10)])] });
    const decoy = mkWorkout({
      id: 'decoy', date: '2026-09-10',
      exercises: [bench([warm(500, 10), warm(500, 10)])],
    });
    const workouts = [heavy, light, decoy];
    const heavyIds = getHistoryModel({ workouts, filter: 'heavy', now: NOW }).items.map((i) => i.id);
    expect(heavyIds).toContain('heavy');
    expect(heavyIds).not.toContain('decoy');
    const lightIds = getHistoryModel({ workouts, filter: 'light', now: NOW }).items.map((i) => i.id);
    expect(lightIds).toContain('light');
    expect(lightIds).not.toContain('decoy');
  });

  it('falls back to all for unknown filter values', () => {
    const model = getHistoryModel({ workouts: [mkWorkout({})], filter: 'nonsense', now: NOW });
    expect(model.shown).toBe(1);
  });
});

describe('workout preview (WHAT/HOW MUCH)', () => {
  it('counts work sets only: warm-ups and incomplete sets excluded', () => {
    const p = getWorkoutPreview(
      mkWorkout({
        exercises: [bench([warm(60, 8), work(100, 5), { kg: 110, reps: 3, completed: false, setType: 'work' }])],
      }),
      { now: NOW }
    );
    expect(p.workSets).toBe(1);
    expect(p.completedSets).toBe(2);
    expect(p.workVolume).toBe(500);
    expect(p.totalReps).toBe(5);
    expect(p.exercisesCount).toBe(1);
  });

  it('counts drop/failure variants as work', () => {
    const p = getWorkoutPreview(
      mkWorkout({ exercises: [bench([work(80, 8, { setType: 'drop' }), work(70, 10, { setType: 'failure' })])] }),
      { now: NOW }
    );
    expect(p.workSets).toBe(2);
    expect(p.workVolume).toBe(80 * 8 + 70 * 10);
  });

  it('reads stored PR flags', () => {
    const w = mkWorkout({ exercises: [bench([work(100, 5, { isHeaviestWeight: true }), work(90, 8)])] });
    expect(hasStoredPR(w)).toBe(true);
    expect(countStoredPRs(w)).toBe(1);
    expect(hasStoredPR(mkWorkout({}))).toBe(false);
  });

  it('isPRWorkout falls back to records for legacy workouts without flags', () => {
    const first = mkWorkout({ id: 'first', date: '2026-09-01' });
    const second = mkWorkout({ id: 'second', date: '2026-09-10' });
    // second matches the all-time best (set by itself) → PR happened here
    expect(isPRWorkout(second, [first, second], () => null)).toBe(true);
  });

  it('never renders broken dates: unknown date, safe duration', () => {
    const p = getWorkoutPreview({ id: 'x', name: '  ', exercises: null }, { now: NOW });
    expect(p.validDate).toBe(false);
    expect(p.dayKey).toBeNull();
    expect(p.name).toBe('Untitled workout');
    expect(p.workVolume).toBe(0);
    expect(p.durationMin).toBeNull();
  });

  it('uses local day keys (never UTC slicing)', () => {
    const p = getWorkoutPreview(mkWorkout({ date: '2026-01-01' }), { now: NOW });
    expect(p.monthKey).toBe('2026-01');
    expect(p.dayKey).toBe('2026-01-01');
  });
});

describe('history helpers', () => {
  it('relativeDay labels only today/yesterday', () => {
    expect(relativeDay('2026-09-14', NOW)).toBe('today');
    expect(relativeDay('2026-09-13', NOW)).toBe('yesterday');
    expect(relativeDay('2026-09-12', NOW)).toBeNull();
    expect(relativeDay('2026-09-15', NOW)).toBeNull();
    expect(relativeDay(null, NOW)).toBeNull();
    expect(relativeDay('garbage', NOW)).toBeNull();
  });

  it('formatSessionDate/Time never render Invalid Date', () => {
    expect(formatSessionDate('2026-09-10')).toBeTruthy();
    expect(formatSessionDate('garbage')).toBeNull();
    expect(formatSessionDate(null)).toBeNull();
    expect(formatSessionDate(undefined)).toBeNull();
    expect(formatSessionTime('2026-09-10T10:00:00.000Z')).toMatch(/\d/);
    expect(formatSessionTime('garbage')).toBeNull();
  });

  it('formatSessionDuration never fakes a value', () => {
    expect(formatSessionDuration(null)).toBeNull();
    expect(formatSessionDuration(NaN)).toBeNull();
    expect(formatSessionDuration(-5)).toBeNull();
    expect(formatSessionDuration(0)).toBe('0 min');
    expect(formatSessionDuration(45)).toBe('45 min');
    expect(formatSessionDuration(60)).toBe('1h 00m');
    expect(formatSessionDuration(125)).toBe('2h 05m');
  });

  it('formatCompactVolume never returns NaN', () => {
    expect(formatCompactVolume(0)).toBe('0');
    expect(formatCompactVolume(850)).toBe('850');
    expect(formatCompactVolume(12450)).toBe('12.4k');
    expect(formatCompactVolume(null)).toBe('0');
    expect(formatCompactVolume(undefined)).toBe('0');
  });
});
