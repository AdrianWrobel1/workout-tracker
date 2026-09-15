import { describe, it, expect } from 'vitest';
import { calculateReadiness } from '../readiness';
import { detectPlateau } from '../plateau';
import { calculateMuscleBalance } from '../muscleBalance';
import { computeVolumeLandmarks } from '../volumeLandmarks';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 5, 15, 12);
const iso = (ts) => new Date(ts).toISOString();
const workSet = (kg, reps, over = {}) => ({ kg, reps, completed: true, setType: 'work', ...over });
const warmup = (kg, reps) => ({ kg, reps, completed: true, setType: 'warmup' });
const mkWorkout = (id, ageDays, sets, extra = {}) => ({
  id,
  date: iso(NOW - ageDays * DAY_MS),
  exercises: [{ exerciseId: 'bench', name: 'Bench Press', category: 'Push', sets }],
  ...extra
});

const BANNED = [/cns/i, /overtrain/i, /injur/i, /\bnervous system\b/i, /recovery diagnosis/i, /medical/i];

describe('readiness determinism + time hardening', () => {
  const ws = [mkWorkout('a', 1, [workSet(100, 5)]), mkWorkout('b', 10, [workSet(80, 8)])];
  it('is deterministic for the same explicit now', () => {
    const r1 = calculateReadiness(ws, { now: NOW });
    const r2 = calculateReadiness(ws, { now: NOW });
    expect(r1).toEqual(r2);
  });
  it('accepts the object form { workouts, now }', () => {
    const a = calculateReadiness(ws, { now: NOW });
    const b = calculateReadiness({ workouts: ws, now: NOW });
    expect(b).toEqual(a);
  });
  it('changes with wall-clock only when now is omitted (V2 must pass now)', () => {
    const a = calculateReadiness(ws, { now: NOW });
    const b = calculateReadiness(ws, { now: NOW + 60 * DAY_MS });
    expect(a).not.toEqual(b);
  });
  it('excludes future workouts', () => {
    const future = mkWorkout('f', -2, [workSet(500, 10)]);
    const base = calculateReadiness(ws, { now: NOW });
    const withFuture = calculateReadiness([...ws, future], { now: NOW });
    expect(withFuture).toEqual(base);
  });
  it('uses canonical local date parsing for legacy date-only strings', () => {
    const legacy = [{ id: 'l', date: '2026-06-10', exercises: [{ exerciseId: 'bench', sets: [workSet(100, 5)] }] }];
    const r = calculateReadiness(legacy, { now: NOW });
    expect(r.chronicSessions).toBe(1);
  });
});

describe('readiness canonical volume + confidence', () => {
  it('excludes warmups (work sets only)', () => {
    const onlyWarm = [mkWorkout('w', 1, [warmup(200, 10)])];
    const r = calculateReadiness(onlyWarm, { now: NOW });
    expect(r.acuteLoad).toBe(0);
    expect(r.status).toBe('low');
  });
  it('is bodyweight-aware for usesBodyweight exercises', () => {
    const db = [{ id: 'bench', name: 'Pull Up', usesBodyweight: true }];
    const ws = [mkWorkout('a', 1, [workSet(0, 10)]), mkWorkout('b', 2, [workSet(0, 10)])];
    const without = calculateReadiness(ws, { now: NOW });
    const withBw = calculateReadiness(ws, { now: NOW, exercisesDB: db, userWeight: 80 });
    expect(without.acuteLoad).toBe(0);
    expect(withBw.acuteLoad).toBe(1600);
  });
  it('elevated volume yields fatigue with load-proxy wording', () => {
    const heavy = [mkWorkout('a', 1, [workSet(200, 10), workSet(200, 10)]), mkWorkout('b', 20, [workSet(40, 5)])];
    const r = calculateReadiness(heavy, { now: NOW });
    expect(r.status).toBe('fatigue');
    expect(r.suggestion).toMatch(/load/i);
    for (const rx of BANNED) expect(r.suggestion).not.toMatch(rx);
  });
  it('light volume yields low status without medical claims', () => {
    const r = calculateReadiness([], { now: NOW });
    expect(r.status).toBe('low');
    expect(r.confidence).toBe('NONE');
    for (const rx of BANNED) expect(r.suggestion).not.toMatch(rx);
  });
  it('confidence reflects evidence depth', () => {
    expect(calculateReadiness([], { now: NOW }).confidence).toBe('NONE');
    const few = [mkWorkout('a', 1, [workSet(100, 5)])];
    expect(calculateReadiness(few, { now: NOW }).confidence).toBe('LIMITED');
    const many = Array.from({ length: 9 }, (_, i) => mkWorkout(`w${i}`, 2 + i * 3, [workSet(100, 5)]));
    expect(calculateReadiness(many, { now: NOW }).confidence).toBe('STRONG');
  });
  it('preserves the legacy score/status/suggestion contract and adds fields', () => {
    const r = calculateReadiness([mkWorkout('a', 1, [workSet(100, 5)])], { now: NOW });
    expect(r).toHaveProperty('acuteLoad');
    expect(r).toHaveProperty('chronicLoad');
    expect(r).toHaveProperty('ratio');
    expect(r).toHaveProperty('status');
    expect(r).toHaveProperty('suggestion');
    expect(r).toHaveProperty('readinessScore');
    expect(r).toHaveProperty('confidence');
    expect(r).toHaveProperty('volumeSemantics', 'work-effective-kg');
    expect(['NONE', 'LIMITED', 'NORMAL', 'STRONG']).toContain(r.confidence);
  });
});

describe('plateau hardening', () => {
  const flatWorkouts = (kg, reps, n, startAge = 30) =>
    Array.from({ length: n }, (_, i) => ({
      id: `w${i}`,
      date: iso(NOW - (startAge - i * 5) * DAY_MS),
      name: `W${i}`,
      exercises: [{ exerciseId: 'bench', name: 'Bench', sets: [workSet(kg, reps), workSet(kg, reps)] }]
    }));
  it('detects a known plateau (flat e1rm + flat volume)', () => {
    const r = detectPlateau('bench', flatWorkouts(100, 5, 5));
    expect(r.isPlateau).toBe(true);
    expect(r.exposuresChecked).toBe(5);
    expect(r.confidenceV2).toMatch(/LIMITED|NORMAL|STRONG/);
    expect(r.volumeSemantics).toBe('work-effective-kg');
  });
  it('does not flag improving history', () => {
    const ws = [100, 102.5, 105, 107.5, 110].map((kg, i) => ({
      id: `w${i}`,
      date: iso(NOW - (30 - i * 5) * DAY_MS),
      name: `W${i}`,
      exercises: [{ exerciseId: 'bench', name: 'Bench', sets: [workSet(kg, 5)] }]
    }));
    expect(detectPlateau('bench', ws).isPlateau).toBe(false);
  });
  it('is bodyweight-aware (kg=0 + userWeight counts)', () => {
    const db = [{ id: 'bench', name: 'Pull Up', usesBodyweight: true }];
    const ws = flatWorkouts(0, 8, 5);
    const without = detectPlateau('bench', ws);
    const withBw = detectPlateau('bench', ws, { exercisesDB: db, userWeight: 80 });
    expect(without.volumeCurrent).toBe(0);
    expect(withBw.volumeCurrent).toBe(640);
    expect(withBw.e1rmCurrent).toBeGreaterThan(0);
  });
  it('insufficient history never plateaus', () => {
    expect(detectPlateau('bench', []).isPlateau).toBe(false);
    expect(detectPlateau('bench', flatWorkouts(100, 5, 1)).isPlateau).toBe(false);
    expect(detectPlateau('bench', flatWorkouts(100, 5, 2)).isPlateau).toBe(false);
    expect(detectPlateau(null, flatWorkouts(100, 5, 5)).isPlateau).toBe(false);
  });
  it('preserves legacy shape and adds canonical confidence', () => {
    const r = detectPlateau('bench', flatWorkouts(100, 5, 4));
    expect(r).toHaveProperty('isPlateau');
    expect(r).toHaveProperty('exposuresChecked');
    expect(r).toHaveProperty('lastImprovementSessionsAgo');
    expect(r).toHaveProperty('stagnationType');
    expect(r).toHaveProperty('confidence');
    expect(['low', 'medium', 'high']).toContain(r.confidence);
    expect(['NONE', 'LIMITED', 'NORMAL', 'STRONG']).toContain(r.confidenceV2);
  });
  it('exposes real baseline/current numbers (no fabrication)', () => {
    const r = detectPlateau('bench', flatWorkouts(100, 5, 4));
    expect(r.e1rmBaseline).toBeGreaterThan(0);
    expect(r.e1rmCurrent).toBeLessThanOrEqual(r.e1rmBaseline);
  });
});

describe('muscle balance evidence', () => {
  const DB = [
    { id: 'bench', name: 'Bench Press', category: 'Push', muscles: ['Chest', 'Triceps'] },
    { id: 'row', name: 'Barbell Row', category: 'Pull', muscles: ['Back'] }
  ];
  const benchOnly = [{ id: 'w', date: iso(NOW - 1 * DAY_MS), exercises: [{ exerciseId: 'bench', name: 'Bench Press', category: 'Push', sets: [workSet(100, 5)] }] }];
  it('uses canonical attribution (bench = push via KB)', () => {
    const b = calculateMuscleBalance(benchOnly, DB, { now: NOW });
    expect(b.week.pushPull.sideAValue).toBeGreaterThan(0);
    expect(b.week.pushPull.sideBValue).toBe(0);
  });
  it('reports balanced when both sides trained', () => {
    const ws = [{
      id: 'w', date: iso(NOW - 1 * DAY_MS),
      exercises: [
        { exerciseId: 'bench', name: 'Bench Press', category: 'Push', sets: [workSet(100, 5)] },
        { exerciseId: 'row', name: 'Barbell Row', category: 'Pull', sets: [workSet(100, 5)] }
      ]
    }];
    // push: Chest 1 + Tri .5 + Sho .5 = 2; pull: Back 1 (+Bi .5 if KB has it) — chestBack 1v1 balanced
    const b = calculateMuscleBalance(ws, DB, { now: NOW });
    expect(b.week.chestBack.status).toBe('balanced');
  });
  it('flags strong imbalance honestly', () => {
    const b = calculateMuscleBalance(benchOnly, DB, { now: NOW });
    expect(['slight', 'imbalanced']).toContain(b.week.pushPull.status);
  });
  it('is deterministic and excludes future sessions', () => {
    const future = [{ id: 'f', date: iso(NOW + 5 * DAY_MS), exercises: [{ exerciseId: 'row', name: 'Barbell Row', category: 'Pull', sets: [workSet(100, 5)] }] }];
    const a = calculateMuscleBalance(benchOnly, DB, { now: NOW });
    const b = calculateMuscleBalance([...benchOnly, ...future], DB, { now: NOW });
    expect(b).toEqual(a);
    expect(calculateMuscleBalance(benchOnly, DB, { now: NOW })).toEqual(calculateMuscleBalance(benchOnly, DB, { now: NOW }));
  });
});

describe('volume landmarks evidence feed', () => {
  const DB = [{ id: 'bench', name: 'Bench Press', category: 'Push', muscles: ['Chest'] }];
  const sixWeeks = Array.from({ length: 6 }, (_, i) => ({
    id: `w${i}`,
    date: iso(NOW - (i * 7 + 1) * DAY_MS),
    exercises: [{ exerciseId: 'bench', name: 'Bench Press', category: 'Push', sets: [workSet(80, 8)] }]
  }));
  it('returns empty byMuscle for insufficient history', () => {
    const r = computeVolumeLandmarks([], { now: NOW });
    expect(r.byMuscle).toEqual({});
    expect(r.unit).toBe('weighted-work-sets-per-week');
  });
  it('exposes low/target/high/recent/trend/confidence per muscle', () => {
    const r = computeVolumeLandmarks(sixWeeks, { now: NOW, exercisesDB: DB });
    const chest = r.byMuscle.Chest;
    expect(chest).toBeDefined();
    for (const k of ['low', 'target', 'high', 'recent', 'trend', 'confidence']) expect(chest).toHaveProperty(k);
    expect(chest.target).toBe(1);
    expect(['NONE', 'LIMITED', 'NORMAL', 'STRONG']).toContain(chest.confidenceV2);
    expect(r.volumeSemantics).toBe('weighted-work-sets');
  });
  it('detects trend direction', () => {
    const declining = [
      ...Array.from({ length: 4 }, (_, i) => ({
        id: `old${i}`, date: iso(NOW - (70 - i * 7) * DAY_MS),
        exercises: [{ exerciseId: 'bench', name: 'Bench Press', category: 'Push', sets: [workSet(80, 8), workSet(80, 8), workSet(80, 8), workSet(80, 8)] }]
      })),
      ...Array.from({ length: 2 }, (_, i) => ({
        id: `new${i}`, date: iso(NOW - (14 - i * 7) * DAY_MS),
        exercises: [{ exerciseId: 'bench', name: 'Bench Press', category: 'Push', sets: [workSet(80, 8)] }]
      }))
    ];
    const r = computeVolumeLandmarks(declining, { now: NOW, exercisesDB: DB });
    expect(r.byMuscle.Chest.trend).toBe('down');
  });
  it('is deterministic and excludes future workouts', () => {
    const future = [{ id: 'f', date: iso(NOW + 3 * DAY_MS), exercises: [{ exerciseId: 'bench', name: 'Bench Press', category: 'Push', sets: [workSet(80, 8)] }] }];
    const a = computeVolumeLandmarks(sixWeeks, { now: NOW, exercisesDB: DB });
    expect(computeVolumeLandmarks([...sixWeeks, ...future], { now: NOW, exercisesDB: DB })).toEqual(a);
    expect(computeVolumeLandmarks(sixWeeks, { now: NOW, exercisesDB: DB })).toEqual(a);
  });
});
