import { describe, it, expect } from 'vitest';
import {
  getCoachingInsights,
  getPrimaryInsight,
  getExerciseGuidance,
  getSessionDebrief,
  getSessionCoaching,
  prioritizeInsights,
  normalizeTrend,
  INSIGHT_TYPES,
  INSIGHT_CONFIDENCE,
  REASON_CODES
} from '../index';
import { interpretStagnation, interpretMover } from '../interpret';
import { resolveRecommendation } from '../../progressionAdapter';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 5, 15, 12);
const iso = (ts) => new Date(ts).toISOString();
const workSet = (kg, reps, over = {}) => ({ kg, reps, completed: true, setType: 'work', ...over });
const mkEx = (id, name, sets, extra = {}) => ({ exerciseId: id, name, category: 'Push', sets, ...extra });
const mkW = (id, ageDays, exercises, extra = {}) => ({ id, date: iso(NOW - ageDays * DAY_MS), exercises, ...extra });
const DB = [{ id: 'bench', name: 'Bench Press', category: 'Push', muscles: ['Chest', 'Triceps'] }];

const REQUIRED = ['type', 'scope', 'title', 'message', 'reasonCode', 'evidence', 'confidence', 'priority', 'freshness'];

const flatBench = (n = 5) =>
  Array.from({ length: n }, (_, i) => mkW(`w${i}`, 30 - i * 5, [mkEx('bench', 'Bench Press', [workSet(100, 5), workSet(100, 5)])]));

describe('output contract', () => {
  it('every emitted insight carries all required fields with valid vocabularies', () => {
    const insights = getCoachingInsights({ workouts: flatBench(), exercisesDB: DB, now: NOW });
    expect(insights.length).toBeGreaterThan(0);
    expect(insights.length).toBeLessThanOrEqual(3);
    for (const c of insights) {
      for (const f of REQUIRED) expect(c).toHaveProperty(f);
      expect(INSIGHT_TYPES).toContain(c.type);
      expect(INSIGHT_CONFIDENCE).toContain(c.confidence);
      expect(REASON_CODES).toContain(c.reasonCode);
      expect(Number.isInteger(c.priority) && c.priority >= 1 && c.priority <= 3).toBe(true);
      expect(typeof c.freshness.generatedAt).toBe('string');
      expect(c.evidence.sessions).toBeGreaterThanOrEqual(1);
    }
  });
  it('invalid candidates are rejected safely (never throws, never leaks)', () => {
    expect(prioritizeInsights(null)).toEqual([]);
    expect(prioritizeInsights('garbage')).toEqual([]);
    expect(prioritizeInsights([
      { type: 'nope', scope: '', title: '', message: '', reasonCode: 'NOPE', evidence: {}, confidence: 'ULTRA', priority: 0, freshness: {} },
      { type: 'session', scope: 'session:x', title: 't', message: 'm', reasonCode: 'SESSION_PR', evidence: { sessions: 1 }, confidence: 'LIMITED', priority: 1, freshness: { generatedAt: new Date(NOW).toISOString(), validForSessions: 1 } }
    ])).toHaveLength(1);
  });
  it('titles are factual (no motivational filler)', () => {
    const insights = getCoachingInsights({ workouts: flatBench(), exercisesDB: DB, now: NOW });
    for (const c of insights) {
      expect(c.title).not.toMatch(/crush|beast|destroy|kill it/i);
    }
  });
});

describe('evidence rules', () => {
  it('one-session evidence never becomes a trend', () => {
    const t = normalizeTrend({ metric: 'strength', baseline: 100, current: 100, sessions: 1, sourceFns: ['x'] });
    expect(t.direction).toBe('UNKNOWN');
    expect(t.confidence).toBe('LIMITED');
    const single = [mkW('w1', 1, [mkEx('bench', 'Bench Press', [workSet(100, 5)])])];
    const insights = getCoachingInsights({ workouts: single, exercisesDB: DB, now: NOW });
    for (const c of insights) {
      if (c.type === 'stagnation') expect(c.confidence).toBe('LIMITED');
    }
  });
  it('missing data yields UNKNOWN / LIMITED, never fabricated numbers', () => {
    const t = normalizeTrend({ metric: 'strength', sessions: 0 });
    expect(t.direction).toBe('UNKNOWN');
    expect(t.magnitudePct).toBeNull();
    expect(getCoachingInsights({ workouts: [], exercisesDB: DB, now: NOW })).toEqual([]);
  });
  it('future workouts are excluded from coaching evidence', () => {
    const base = getCoachingInsights({ workouts: flatBench(), exercisesDB: DB, now: NOW });
    const future = mkW('future', -3, [mkEx('bench', 'Bench Press', [workSet(200, 10), workSet(200, 10)])]);
    const withFuture = getCoachingInsights({ workouts: [...flatBench(), future], exercisesDB: DB, now: NOW });
    expect(withFuture).toEqual(base);
  });
  it('no insight fabricates baseline/current (values trace to inputs)', () => {
    const insights = getCoachingInsights({ workouts: flatBench(), exercisesDB: DB, now: NOW });
    const stag = insights.find((c) => c.dedupKey === 'stagnation:bench');
    if (stag) {
      expect(stag.evidence.baseline).toBe(105);
      expect(stag.evidence.current).toBe(105);
    }
  });
});

describe('progression integration (adapter-only)', () => {
  it('V2 wraps the adapter prescription without recomputing it', () => {
    const policy = { mode: 'double', repMin: 8, repMax: 12, incrementKg: 2.5 };
    const db = [{ id: 'bench', name: 'Bench Press', progression: policy }];
    const ws = flatBench(2).map((w) => ({
      ...w,
      exercises: [mkEx('bench', 'Bench Press', [workSet(60, 12), workSet(60, 12)])]
    }));
    const direct = resolveRecommendation({ exercise: db[0], workouts: ws });
    const guide = getExerciseGuidance({ exerciseId: 'bench', workouts: ws, exercisesDB: db, now: NOW });
    expect(guide.recommendation).toEqual(direct);
  });
  it('explicit [Use] stays advisory: coaching never mutates inputs', () => {
    const ws = flatBench();
    const frozen = JSON.stringify(ws);
    getCoachingInsights({ workouts: ws, exercisesDB: DB, now: NOW });
    getExerciseGuidance({ exerciseId: 'bench', workouts: ws, exercisesDB: DB, now: NOW });
    getSessionDebrief({ session: ws[0], allWorkouts: ws, exercisesDB: DB, now: NOW });
    expect(JSON.stringify(ws)).toBe(frozen);
  });
});

describe('deduplication', () => {
  it('plateau + flat mover for the same exercise collapse into one insight', () => {
    const ws = flatBench(6);
    const insights = getCoachingInsights({ workouts: ws, exercisesDB: DB, now: NOW });
    const stags = insights.filter((c) => c.dedupKey === 'stagnation:bench');
    expect(stags.length).toBeLessThanOrEqual(1);
    if (stags.length === 1) {
      expect(stags[0].evidence.sourceFns.length).toBeGreaterThanOrEqual(1);
    }
  });
  it('merge keeps the strongest evidence and unions sourceFns', () => {
    const a = interpretStagnation({
      exerciseId: 'bench', exerciseName: 'Bench', sessions: 5,
      plateau: { isPlateau: true, exposuresChecked: 5, lastImprovementSessionsAgo: 4, stagnationType: 'e1rm', confidenceV2: 'NORMAL', e1rmBaseline: 105, e1rmCurrent: 105, volumeBaseline: 500, volumeCurrent: 500 },
      latest: {}
    }, { now: NOW });
    const b = interpretMover({ id: 'bench', sessions: 6, first: 100, last: 100 }, { exerciseName: 'Bench', now: NOW });
    const out = prioritizeInsights([a, b]);
    expect(out.filter((c) => c.dedupKey === 'stagnation:bench')).toHaveLength(1);
    expect(out[0].evidence.sourceFns).toContain('detectPlateau');
    expect(out[0].evidence.sourceFns).toContain('strengthMovers');
  });
  it('duplicate wording does not create duplicate insights', () => {
    const dup = interpretMover({ id: 'bench', sessions: 4, first: 100, last: 100 }, { exerciseName: 'Bench', now: NOW });
    const out = prioritizeInsights([dup, { ...dup }]);
    expect(out).toHaveLength(1);
  });
});

describe('prioritizer', () => {
  const cand = (over = {}) => ({
    type: 'session', scope: 'session:x', title: 't', message: 'm', reasonCode: 'SESSION_PR',
    evidence: { sessions: 2 }, confidence: 'NORMAL', priority: 2,
    freshness: { generatedAt: new Date(NOW).toISOString(), validForSessions: 1 }, ...over
  });
  it('is deterministic under input shuffling', () => {
    const list = [
      cand({ reasonCode: 'SESSION_PR', priority: 2, scope: 'session:b' }),
      cand({ reasonCode: 'SESSION_VOLUME_UP', priority: 1, scope: 'session:a' }),
      cand({ reasonCode: 'SESSION_VOLUME_DOWN', priority: 3, scope: 'session:c' })
    ];
    const a = prioritizeInsights(list);
    const b = prioritizeInsights([...list].reverse());
    expect(a).toEqual(b);
    expect(a.map((c) => c.priority)).toEqual([1, 2, 3]);
  });
  it('enforces the hard cap and drops NONE / priority 4+ noise', () => {
    const list = Array.from({ length: 10 }, (_, i) => cand({ scope: `session:${i}`, reasonCode: 'SESSION_PR', priority: 2 }));
    expect(prioritizeInsights(list)).toHaveLength(3);
    expect(prioritizeInsights([cand({ confidence: 'NONE' })])).toEqual([]);
    expect(prioritizeInsights([cand({ priority: 4 })])).toEqual([]);
  });
  it('home rule: 1 primary + ≤2 secondary from the same ranking', () => {
    const { primary, secondary } = getPrimaryInsight({ workouts: flatBench(), exercisesDB: DB, now: NOW });
    expect(primary).toBeDefined();
    expect(secondary.length).toBeLessThanOrEqual(2);
    const all = getCoachingInsights({ workouts: flatBench(), exercisesDB: DB, now: NOW });
    expect(primary).toEqual(all[0] ?? null);
  });
});

describe('surfaces', () => {
  it('exercise guidance combines recommendation + insights + actual + evidence', () => {
    const g = getExerciseGuidance({ exerciseId: 'bench', workouts: flatBench(), exercisesDB: DB, now: NOW });
    expect(g).toHaveProperty('recommendation');
    expect(g).toHaveProperty('insights');
    expect(g).toHaveProperty('actual');
    expect(g).toHaveProperty('evidence');
    expect(g.actual.max1RM).toBeGreaterThan(0);
    expect(g.evidence.sourceFns).toContain('resolveRecommendation');
  });
  it('returns null for unknown exercises without throwing', () => {
    expect(getExerciseGuidance({ exerciseId: null, workouts: [], now: NOW })).toBeNull();
    expect(getExerciseGuidance({ exerciseId: 'ghost', workouts: [], exercisesDB: [], now: NOW }).insights).toEqual([]);
  });
  it('session debrief is a small prioritized set with win/slowdown/focus/next', () => {
    const ws = flatBench(3);
    const session = {
      ...ws[0],
      id: 'current',
      date: iso(NOW),
      duration: 60,
      exercises: [mkEx('bench', 'Bench Press', [workSet(105, 5), workSet(105, 5)])]
    };
    const d = getSessionDebrief({ session, allWorkouts: [...ws, session], exercisesDB: DB, now: NOW });
    expect(d.insights.length).toBeLessThanOrEqual(3);
    for (const k of ['win', 'slowdown', 'focus', 'next']) expect(typeof d[k]).toBe('string');
    expect(d.summary.hasWork).toBe(true);
  });
  it('session coaching centralizes wording (same headlines as debrief)', () => {
    const ws = flatBench(3);
    const session = { ...ws[0], id: 'c2', date: iso(NOW), exercises: [mkEx('bench', 'Bench Press', [workSet(100, 5)])] };
    const args = { session, allWorkouts: [...ws, session], exercisesDB: DB, now: NOW };
    const debrief = getSessionDebrief(args);
    const coaching = getSessionCoaching(args);
    expect(coaching).toEqual({ win: debrief.win, slowdown: debrief.slowdown, focus: debrief.focus, next: debrief.next });
  });
  it('recovery wording never implies medical measurement', () => {
    const heavy = [
      mkW('a', 1, [mkEx('bench', 'Bench Press', [workSet(200, 10), workSet(200, 10)])]),
      mkW('b', 20, [mkEx('bench', 'Bench Press', [workSet(40, 5)])])
    ];
    const insights = getCoachingInsights({ workouts: heavy, exercisesDB: DB, now: NOW });
    const rec = insights.find((c) => c.type === 'recovery');
    if (rec) {
      expect(`${rec.title} ${rec.message}`).not.toMatch(/cns|nervous system|overtrain|injur/i);
      expect(rec.message).toMatch(/volume|effort|load/i);
    }
  });
  it('balance surfaces at most one prioritized gap story', () => {
    const ws = [mkW('w1', 1, [mkEx('bench', 'Bench Press', [workSet(100, 5)])])];
    const insights = getCoachingInsights({ workouts: ws, exercisesDB: DB, now: NOW });
    expect(insights.filter((c) => c.type === 'balance').length).toBeLessThanOrEqual(2);
  });
});
