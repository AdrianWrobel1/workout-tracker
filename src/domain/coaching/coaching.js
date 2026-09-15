/**
 * Coaching V2 — public seam (STRUCTURED COACHING OUTPUT).
 *
 * Flow: RAW TRAINING DATA → CANONICAL FACTS → EVIDENCE FEEDS → NORMALIZE →
 * INTERPRET → PRIORITIZE → STRUCTURED COACHING OUTPUT.
 *
 * This module is the only UI-facing coaching entry point. It never computes
 * training math itself: progression comes from resolveRecommendation,
 * muscles from resolveAttribution, volume from calculateSetVolume-family,
 * PRs from stored flags + getExerciseRecords / detectPRsInWorkout (pure),
 * history from sessionDetail/exerciseDetail/history selectors.
 *
 * All functions are pure, never mutate inputs, never persist. Freshness is
 * advisory ({ generatedAt, validForSessions }); coaching is derived state.
 */

import { getExerciseHistory, getExerciseRecords } from '../exercises';
import { calculate1RM } from '../calculations';
import { detectPRsInWorkout } from '../workouts';
import { resolveRecommendation } from '../progressionAdapter';
import { parseWorkoutDate } from '../dates';
import {
  collectExerciseEvidence,
  collectSessionEvidence,
  collectGlobalEvidence,
  excludeFutureWorkouts
} from './evidence';
import {
  interpretStagnation,
  interpretMover,
  interpretProgression,
  interpretLandmarks,
  interpretBalance,
  interpretConsistency,
  interpretReadiness
} from './interpret';
import { prioritizeInsights, splitHomeInsights, GLOBAL_CAP } from './prioritize';

export { GLOBAL_CAP };

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const resolveNowMs = (now) => {
  if (now instanceof Date) {
    const t = now.getTime();
    return Number.isFinite(t) ? t : Date.now();
  }
  if (typeof now === 'number' && Number.isFinite(now)) return now;
  return Date.now();
};

const exerciseNameOf = (exerciseId, exercisesDB, workouts) => {
  const db = (Array.isArray(exercisesDB) ? exercisesDB : []).find((e) => e && e.id === exerciseId);
  if (db && typeof db.name === 'string' && db.name.trim()) return db.name.trim();
  for (const w of Array.isArray(workouts) ? workouts : []) {
    for (const ex of w?.exercises || []) {
      if (ex?.exerciseId === exerciseId && typeof ex?.name === 'string' && ex.name.trim()) {
        return ex.name.trim();
      }
    }
  }
  return `Exercise ${String(exerciseId)}`;
};

const topExerciseIds = (workouts, nowMs, cap = 20) => {
  const counts = new Map();
  const scoped = excludeFutureWorkouts(workouts, nowMs);
  const cutoff = nowMs - 90 * 24 * 60 * 60 * 1000;
  for (const w of scoped) {
    let ts = NaN;
    try {
      const parsed = parseWorkoutDate(w?.date ?? w?.startTime);
      ts = parsed ? parsed.getTime() : NaN;
    } catch {
      ts = NaN;
    }
    if (!Number.isFinite(ts) || ts < cutoff) continue;
    for (const ex of w?.exercises || []) {
      if (ex?.exerciseId === null || ex?.exerciseId === undefined) continue;
      const hasWork = (ex?.sets || []).some((s) => s?.completed === true);
      if (!hasWork) continue;
      counts.set(ex.exerciseId, (counts.get(ex.exerciseId) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
    .slice(0, cap)
    .map(([id]) => id);
};

/**
 * Global coaching insights (home + generic surfaces): ≤3 prioritized,
 * deduplicated, deterministic. Thin: one evidence pass, no per-component
 * full-history rescans by callers.
 */
export const getCoachingInsights = ({
  workouts = [],
  exercisesDB = [],
  userWeight = null,
  now = Date.now()
} = {}) => {
  try {
    const nowMs = resolveNowMs(now);
    const db = Array.isArray(exercisesDB) ? exercisesDB : [];
    const global = collectGlobalEvidence({ workouts, exercisesDB: db, userWeight, now: nowMs });
    if (!global) return [];

    const candidates = [];

    // Per-exercise signals (stagnation + progression wrappers).
    const ids = topExerciseIds(workouts, nowMs);
    const scoped = excludeFutureWorkouts(workouts, nowMs);
    for (const id of ids) {
      const ev = collectExerciseEvidence({ exerciseId: id, workouts: scoped, exercisesDB: db, userWeight, now: nowMs });
      if (!ev) continue;
      const named = { ...ev, exerciseName: exerciseNameOf(id, db, scoped) };
      const stag = interpretStagnation(named, { now: nowMs });
      if (stag) candidates.push(stag);
      const prog = interpretProgression(named, { now: nowMs });
      if (prog) candidates.push(prog);
    }

    // Strength movers corroborate or surface movers (dedup merges flats).
    for (const mover of global.movers || []) {
      const item = interpretMover(mover, { exerciseName: exerciseNameOf(mover.id, db, scoped), now: nowMs });
      if (item) candidates.push(item);
    }

    // Muscle / volume / consistency / load-proxy signals.
    for (const item of interpretLandmarks(global.landmarks, { now: nowMs })) candidates.push(item);
    for (const item of interpretBalance(global.balance, { now: nowMs })) candidates.push(item);
    const cons = interpretConsistency({ consistency7: global.consistency7, consistency30: global.consistency30 }, { now: nowMs });
    if (cons) candidates.push(cons);
    const rec = interpretReadiness(global.readiness, { now: nowMs });
    if (rec) candidates.push(rec);

    return prioritizeInsights(candidates, { limit: GLOBAL_CAP });
  } catch {
    return [];
  }
};

/**
 * Home priority: one primary + ≤2 secondary from the SAME prioritized list.
 * No separate Home engine — identical ranking and cap as everywhere else.
 */
export const getPrimaryInsight = ({
  workouts = [],
  exercisesDB = [],
  userWeight = null,
  now = Date.now()
} = {}) => {
  const prioritized = getCoachingInsights({ workouts, exercisesDB, userWeight, now });
  return splitHomeInsights(prioritized);
};

/**
 * Pure, non-mutating PR detection for a session: stored flags first
 * (canonical stored PR semantics), records comparison for unflagged
 * sessions, and the canonical detector run on a CLONE (it flags sets
 * in place — inputs are never mutated by coaching).
 */
const detectSessionPRsPure = (session, allWorkouts) => {
  const names = [];
  let count = 0;
  try {
    for (const ex of session?.exercises || []) {
      const hit = (ex?.sets || []).some(
        (s) => s?.completed && (s.isBest1RM || s.isBestSetVolume || s.isHeaviestWeight)
      );
      if (hit) {
        count += (ex?.sets || []).filter(
          (s) => s?.completed && (s.isBest1RM || s.isBestSetVolume || s.isHeaviestWeight)
        ).length;
        names.push(ex?.name || 'Exercise');
      }
    }
    if (count > 0) return { count, names };
  } catch {
    // fall through to detector
  }
  try {
    const clone = JSON.parse(JSON.stringify(session));
    const previous = (Array.isArray(allWorkouts) ? allWorkouts : []).filter((w) => w?.id !== session?.id);
    const found = detectPRsInWorkout(clone, previous, calculate1RM, getExerciseRecords) || {};
    const keys = Object.keys(found);
    const detectedNames = keys.map((k) => found[k]?.exerciseName || 'Exercise');
    const detectedCount = keys.reduce((n, k) => n + (found[k]?.recordTypes?.length || 0), 0);
    return { count: detectedCount, names: detectedNames };
  } catch {
    return { count, names };
  }
};

/**
 * Exercise guidance for future UI integration (structured, not copy):
 * { recommendation (adapter only), insights (prioritized, exercise-scoped),
 *   actual (latest measured performance), evidence }.
 */
export const getExerciseGuidance = ({
  exerciseId = null,
  workouts = [],
  exercisesDB = [],
  userWeight = null,
  now = Date.now(),
  plan = null
} = {}) => {
  try {
    if (exerciseId === null || exerciseId === undefined) return null;
    const nowMs = resolveNowMs(now);
    const db = Array.isArray(exercisesDB) ? exercisesDB : [];
    const scoped = excludeFutureWorkouts(workouts, nowMs);
    const ev = collectExerciseEvidence({ exerciseId, workouts: scoped, exercisesDB: db, userWeight, now: nowMs, plan });
    if (!ev) return null;
    const name = exerciseNameOf(exerciseId, db, scoped);
    const named = { ...ev, exerciseName: name };

    const candidates = [];
    const prog = interpretProgression(named, { now: nowMs });
    if (prog) candidates.push(prog);
    const stag = interpretStagnation(named, { now: nowMs });
    if (stag) candidates.push(stag);
    const insights = prioritizeInsights(candidates, { limit: GLOBAL_CAP, surface: 'exercise' });

    const history = getExerciseHistory(exerciseId, scoped);
    const latest = history.length > 0 ? history[0] : null;
    const actual = latest
      ? { date: latest.date ?? null, topSet: null, max1RM: num(latest.max1RM), setsCount: (latest.sets || []).length }
      : null;
    if (latest && Array.isArray(latest.sets)) {
      let top = null;
      for (const s of latest.sets) {
        if (!s || s.completed !== true) continue;
        const kg = num(s.kg);
        const reps = num(s.reps);
        if (!(kg > 0 && reps > 0)) continue;
        const e1rm = calculate1RM(kg, reps);
        if (!top || e1rm > top.e1rm) top = { kg, reps, e1rm };
      }
      if (actual) actual.topSet = top;
    }

    return {
      exerciseId,
      exerciseName: name,
      recommendation: ev.progression,
      insights,
      actual,
      evidence: {
        sessions: ev.sessions,
        plateau: ev.plateau,
        trendArrow: ev.trendArrow,
        muscles: ev.muscles,
        sourceFns: ['getExerciseHistory', 'getExerciseRecords', 'detectPlateau', 'resolveRecommendation']
      },
      freshness: { generatedAt: new Date(nowMs).toISOString(), validForSessions: 3 }
    };
  } catch {
    return null;
  }
};

/**
 * Session debrief: small prioritized set from canonical session facts + PRs
 * + trend + workload, with balance/readiness only when relevant. Never an
 * essay. Each headline traces back to evidence (see insights).
 */
export const getSessionDebrief = ({
  session = null,
  allWorkouts = [],
  exercisesDB = [],
  userWeight = null,
  now = Date.now()
} = {}) => {
  try {
    if (!session || typeof session !== 'object') return null;
    const nowMs = resolveNowMs(now);
    const db = Array.isArray(exercisesDB) ? exercisesDB : [];
    const scoped = Array.isArray(allWorkouts) ? allWorkouts : [];
    const sev = collectSessionEvidence({ session, allWorkouts: scoped, exercisesDB: db, userWeight });
    if (!sev) return null;

    const prs = detectSessionPRsPure(session, scoped);
    const summary = sev.summary || {};
    const comparison = sev.comparison || {};
    const highlights = sev.highlights || {};

    const candidates = [];
    const fresh = { generatedAt: new Date(nowMs).toISOString(), validForSessions: 1 };

    // FACT: session win — PRs first (canonical stored/detected semantics).
    if (prs.count > 0) {
      candidates.push({
        type: 'session',
        scope: session?.id != null ? `session:${String(session.id)}` : 'session:current',
        title: `New PR${prs.count === 1 ? '' : 's'} in this session`,
        message: `You set ${prs.count} new personal record${prs.count === 1 ? '' : 's'}${prs.names.length ? ` (${prs.names.slice(0, 2).join(', ')})` : ''}.`,
        reasonCode: 'SESSION_PR',
        evidence: { sessions: 1, window: '1', metric: 'e1rm', baseline: null, current: null, deltaPct: null, prCount: prs.count, sourceFns: ['getExerciseRecords', 'detectPRsInWorkout'] },
        confidence: 'LIMITED',
        priority: 1,
        freshness: fresh,
        source: 'coaching-v2',
        dedupKey: 'session:win',
        surfaces: ['session']
      });
    } else if (comparison.hasPrevious === true && num(comparison.volumeDeltaPct) > 5) {
      candidates.push({
        type: 'session',
        scope: session?.id != null ? `session:${String(session.id)}` : 'session:current',
        title: `Volume up ${num(comparison.volumeDeltaPct)}% vs previous session`,
        message: `Work volume rose from ${num(comparison.volumePrevious)} to ${num(comparison.volumeCurrent)} kg.`,
        reasonCode: 'SESSION_VOLUME_UP',
        evidence: { sessions: 2, window: '2', metric: 'volume', baseline: comparison.volumePrevious ?? null, current: comparison.volumeCurrent ?? null, deltaPct: num(comparison.volumeDeltaPct), sourceFns: ['getSessionComparison', 'calculateWorkoutWorkVolume'] },
        confidence: 'LIMITED',
        priority: 2,
        freshness: fresh,
        source: 'coaching-v2',
        dedupKey: 'session:win',
        surfaces: ['session']
      });
    } else if (highlights.bestSet) {
      const b = highlights.bestSet;
      candidates.push({
        type: 'session',
        scope: session?.id != null ? `session:${String(session.id)}` : 'session:current',
        title: `Best set: ${b.exerciseName} ${b.kg} kg × ${b.reps}`,
        message: `Top work set reached an estimated 1RM of ${b.estimated1RM} kg.`,
        reasonCode: 'SESSION_PR',
        evidence: { sessions: 1, window: '1', metric: 'e1rm', baseline: null, current: b.estimated1RM ?? null, deltaPct: null, sourceFns: ['getSessionBestSet', 'calculate1RM'] },
        confidence: 'LIMITED',
        priority: 2,
        freshness: fresh,
        source: 'coaching-v2',
        dedupKey: 'session:win',
        surfaces: ['session']
      });
    }

    // FACT: slowdown vs previous comparable session.
    if (comparison.hasPrevious === true && num(comparison.volumeDeltaPct) < -5) {
      candidates.push({
        type: 'session',
        scope: session?.id != null ? `session:${String(session.id)}` : 'session:current',
        title: `Volume down ${Math.abs(num(comparison.volumeDeltaPct))}% vs previous session`,
        message: `Work volume fell from ${num(comparison.volumePrevious)} to ${num(comparison.volumeCurrent)} kg.`,
        reasonCode: 'SESSION_VOLUME_DOWN',
        evidence: { sessions: 2, window: '2', metric: 'volume', baseline: comparison.volumePrevious ?? null, current: comparison.volumeCurrent ?? null, deltaPct: num(comparison.volumeDeltaPct), sourceFns: ['getSessionComparison', 'calculateWorkoutWorkVolume'] },
        confidence: 'LIMITED',
        priority: 2,
        freshness: fresh,
        source: 'coaching-v2',
        dedupKey: 'session:slowdown',
        surfaces: ['session']
      });
    }

    // NEXT ACTION: single progression-derived step for the top-volume lift.
    // V2 consumes the adapter only — never suggestNextWeight / getLastCompletedSets.
    const topEx = sev.topVolumeExercise;
    if (topEx && topEx.exerciseId !== null && topEx.exerciseId !== undefined) {
      const def = db.find((e) => e && e.id === topEx.exerciseId) || { id: topEx.exerciseId };
      let rec = null;
      try {
        rec = resolveRecommendation({ exercise: def, workouts: scoped });
      } catch {
        rec = null;
      }
      if (rec && rec.prescription && (rec.source === 'progression')) {
        candidates.push({
          type: 'next-workout',
          scope: `exercise:${String(topEx.exerciseId)}`,
          title: `Next: ${topEx.exerciseName} ${rec.prescriptionText || `${rec.suggestedKg} kg × ${rec.suggestedReps}`}`,
          message: rec.whyText || 'Progression prescription for the most productive lift.',
          reasonCode: rec.reasonCode && ['STALL', 'DELOAD', 'TARGET_MET', 'TOP_OF_RANGE', 'TARGET_NOT_MET', 'HOLD'].includes(rec.reasonCode) ? rec.reasonCode : 'NEXT_WORKOUT_PRIORITY',
          evidence: { sessions: num(rec.evidence?.sessionsConsidered) || 1, window: '6', metric: 'e1rm', baseline: rec.evidence?.anchorWeight ?? null, current: rec.evidence?.lastModalWeight ?? null, deltaPct: null, sourceFns: ['resolveRecommendation'] },
          confidence: rec.confidence || 'LIMITED',
          priority: 2,
          freshness: fresh,
          recommendation: rec.prescriptionText || null,
          source: 'progression-v1',
          dedupKey: `next:${String(topEx.exerciseId)}`,
          surfaces: ['session']
        });
      }
    }

    const insights = prioritizeInsights(candidates, { limit: GLOBAL_CAP, surface: 'session' });
    const byKey = new Map(insights.map((i) => [i.dedupKey, i]));
    const win = byKey.get('session:win') || null;
    const slowdown = byKey.get('session:slowdown') || null;
    const next = [...byKey.values()].find((i) => i.type === 'next-workout') || null;
    const focus = slowdown || next || (insights.length > 0 ? insights[insights.length - 1] : null);

    return {
      sessionId: session?.id ?? null,
      summary: {
        workSets: num(summary.workSets),
        workVolume: num(summary.workVolume),
        prCount: prs.count,
        hasWork: summary.hasWork === true
      },
      insights,
      win: win ? win.message : (summary.hasWork ? `Completed ${num(summary.workSets)} work sets.` : 'No work sets completed.'),
      slowdown: slowdown ? slowdown.message : 'No major slowdown detected versus your previous session.',
      focus: focus ? focus.message : 'Repeat the main lifts and hold technique quality.',
      next: next ? next.message : 'Next session: repeat current loads and target the top of the rep range.',
      freshness: fresh
    };
  } catch {
    return null;
  }
};

/**
 * Session coaching wording entry point (structured V2 wording system).
 * Consumes canonical session facts; centralized replacement for the three
 * duplicated session wording systems (Coach Lens copy, post-workout
 * insights, finish feedback). Returns { win, slowdown, focus, next } —
 * each traceable to evidence via the sibling debrief insights.
 */
export const getSessionCoaching = (args) => {
  const debrief = getSessionDebrief(args);
  if (!debrief) {
    return {
      win: 'No workout data available.',
      slowdown: 'No slowdown signal detected.',
      focus: 'Complete one full session to unlock coaching.',
      next: 'Run one more session to unlock actionable insights.'
    };
  }
  return { win: debrief.win, slowdown: debrief.slowdown, focus: debrief.focus, next: debrief.next };
};
