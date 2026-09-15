/**
 * Coaching V2 — interpretation (EVIDENCE → candidate insights, unranked).
 *
 * Explicitly preserves FACT vs Interpretation vs Recommendation:
 *   FACT ........... evidence bundle values (measured, never invented)
 *   Interpretation . title/message (what the evidence appears to mean)
 *   Recommendation . recommendation field (what to do next, advisory only)
 *
 * Rules enforced here:
 * - No insight without evidence.sessions >= 2, unless confidence is LIMITED
 *   and the output is factual (single-session facts, never trends).
 * - No fabricated numbers: every number in title/message/evidence comes from
 *   the evidence bundle.
 * - Progression prescription is WRAPPED from resolveRecommendation (adapter),
 *   never recomputed (no increments/stall/deload/rep-step math here).
 * - Readiness language is load-proxy only (no CNS/overtraining/injury/medical).
 * - Titles are short + factual; messages are one concise evidence-linked
 *   sentence; no motivational filler.
 */

import { normalizePlateau, normalizeMover, normalizeLandmark } from './normalize';

export const INSIGHT_TYPES = [
  'progression',
  'stagnation',
  'volume',
  'balance',
  'consistency',
  'session',
  'next-workout',
  'recovery'
];

export const INSIGHT_CONFIDENCE = ['NONE', 'LIMITED', 'NORMAL', 'STRONG'];

export const REASON_CODES = [
  // Progression V1 passthrough (engine-owned)
  'NO_HISTORY',
  'PROGRESSION_OFF',
  'TARGET_NOT_MET',
  'TARGET_MET',
  'TOP_OF_RANGE',
  'HOLD',
  'STALL',
  'DELOAD',
  'INVALID_INPUT',
  // Coaching V2 interpretations (new, stable, minimal set)
  'STAGNATION_E1RM',
  'STAGNATION_VOLUME',
  'VOLUME_LOW',
  'VOLUME_HIGH',
  'BALANCE_PUSH_PULL',
  'BALANCE_CHEST_BACK',
  'BALANCE_QUAD_HAM',
  'CONSISTENCY_DROP',
  'CONSISTENCY_STABLE',
  'NEXT_WORKOUT_PRIORITY',
  'SESSION_PR',
  'SESSION_VOLUME_UP',
  'SESSION_VOLUME_DOWN',
  'RECOVERY_LOAD_HIGH',
  'RECOVERY_LOAD_LIGHT'
];

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const nowIso = (now) => {
  try {
    const ms = now instanceof Date ? now.getTime() : Number(now);
    return new Date(Number.isFinite(ms) ? ms : Date.now()).toISOString();
  } catch {
    return new Date().toISOString();
  }
};

const freshnessOf = (now) => ({ generatedAt: nowIso(now), validForSessions: 3 });

const displayName = (name, fallback) => {
  if (typeof name === 'string' && name.trim()) return name.trim();
  return fallback;
};

/**
 * Stagnation candidate from plateau evidence. Emits only when plateau
 * evidence is strong enough to surface (isPlateau true, >=3 exposures).
 * isPlateau === true alone never prescribes — this layer decides surfacing.
 */
export const interpretStagnation = (exerciseEvidence, { now = Date.now() } = {}) => {
  if (!exerciseEvidence) return null;
  const plateau = exerciseEvidence.plateau;
  if (!plateau || plateau.isPlateau !== true) return null;
  const sessions = num(plateau.exposuresChecked);
  if (!(sessions >= 3)) return null;

  const normalized = normalizePlateau(plateau, { exerciseId: exerciseEvidence.exerciseId });
  const stagnationType = plateau.stagnationType === 'volume' ? 'volume' : 'e1rm';
  const reasonCode = stagnationType === 'volume' ? 'STAGNATION_VOLUME' : 'STAGNATION_E1RM';
  const name = displayName(exerciseEvidence.latest?.workoutName, `Exercise ${String(exerciseEvidence.exerciseId)}`);
  // Resolve a human name from history entry? History rows carry workoutName,
  // not exercise name; prefer DB-derived name passed via muscles? Fall back.
  const titleName = displayName(exerciseEvidence.exerciseName, name);
  const stale = num(plateau.lastImprovementSessionsAgo);

  return {
    type: 'stagnation',
    scope: `exercise:${String(exerciseEvidence.exerciseId)}`,
    title: `${titleName} stalled for ${stale} sessions`,
    message: stagnationType === 'volume'
      ? `Best-set volume has not improved across ${sessions} exposures.`
      : `Estimated 1RM has not improved across ${sessions} exposures.`,
    reasonCode,
    evidence: {
      sessions,
      window: String(sessions),
      metric: stagnationType === 'volume' ? 'volume' : 'e1rm',
      baseline: stagnationType === 'volume' ? (plateau.volumeBaseline ?? null) : (plateau.e1rmBaseline ?? null),
      current: stagnationType === 'volume' ? (plateau.volumeCurrent ?? null) : (plateau.e1rmCurrent ?? null),
      deltaPct: normalized.magnitudePct,
      staleSessions: stale,
      stagnationType,
      sourceFns: ['getExerciseHistory', 'detectPlateau']
    },
    confidence: plateau.confidenceV2 && INSIGHT_CONFIDENCE.includes(plateau.confidenceV2) ? plateau.confidenceV2 : 'LIMITED',
    priority: 2,
    freshness: freshnessOf(now),
    source: 'coaching-v2',
    dedupKey: `stagnation:${String(exerciseEvidence.exerciseId)}`,
    surfaces: ['home', 'exercise']
  };
};

/**
 * Strength-mover candidate. A flat mover with >=3 sessions corroborates
 * stagnation (dedup merges it); a clear up/down mover surfaces on its own
 * only with >=2 sessions. Single-session movers never exist (movers require
 * >=2 estimable sessions by construction).
 */
export const interpretMover = (mover, { exerciseName = null, now = Date.now() } = {}) => {
  if (!mover || typeof mover !== 'object') return null;
  const sessions = num(mover.sessions);
  if (!(sessions >= 2)) return null;
  const normalized = normalizeMover(mover);
  if (normalized.direction === 'UNKNOWN') return null;
  const name = displayName(exerciseName, `Exercise ${String(mover.id)}`);

  // Flat movers are corroboration, not standalone alerts — emit so dedup can
  // merge them with plateau stagnation for the same exercise.
  if (normalized.direction === 'FLAT') {
    return {
      type: 'stagnation',
      scope: `exercise:${String(mover.id)}`,
      title: `${name} strength flat across ${sessions} sessions`,
      message: `Estimated 1RM is unchanged from ${mover.first} to ${mover.last} kg.`,
      reasonCode: 'STAGNATION_E1RM',
      evidence: {
        sessions,
        window: String(sessions),
        metric: 'e1rm',
        baseline: mover.first ?? null,
        current: mover.last ?? null,
        deltaPct: normalized.magnitudePct,
        sourceFns: ['strengthMovers']
      },
      confidence: normalized.confidence,
      priority: 3,
      freshness: freshnessOf(now),
      source: 'coaching-v2',
      dedupKey: `stagnation:${String(mover.id)}`,
      surfaces: ['home', 'exercise']
    };
  }

  const up = normalized.direction === 'UP';
  return {
    type: 'stagnation',
    scope: `exercise:${String(mover.id)}`,
    title: up ? `${name} strength up across ${sessions} sessions` : `${name} strength down across ${sessions} sessions`,
    message: up
      ? `Estimated 1RM rose from ${mover.first} to ${mover.last} kg.`
      : `Estimated 1RM fell from ${mover.first} to ${mover.last} kg.`,
    reasonCode: 'STAGNATION_E1RM',
    evidence: {
      sessions,
      window: String(sessions),
      metric: 'e1rm',
      baseline: mover.first ?? null,
      current: mover.last ?? null,
      deltaPct: normalized.magnitudePct,
      sourceFns: ['strengthMovers']
    },
    confidence: normalized.confidence,
    priority: up ? 3 : 2,
    freshness: freshnessOf(now),
    source: 'coaching-v2',
    dedupKey: `stagnation:${String(mover.id)}`,
    surfaces: ['home', 'exercise']
  };
};

/**
 * Progression wrapper: adapts (never recomputes) the V1 prescription into a
 * structured insight. Emits only STALL/DELOAD as interrupt-level signals;
 * UP/HOLD/REP_UP stay inside exercise guidance (no global noise).
 */
export const interpretProgression = (exerciseEvidence, { now = Date.now() } = {}) => {
  if (!exerciseEvidence) return null;
  const rec = exerciseEvidence.progression;
  if (!rec || rec.source !== 'progression' || !rec.prescription) return null;
  const state = rec.state;
  if (state !== 'STALL' && state !== 'DELOAD') return null;
  const sessions = num(rec.evidence?.sessionsConsidered ?? exerciseEvidence.sessions);
  const name = displayName(exerciseEvidence.exerciseName, `Exercise ${String(exerciseEvidence.exerciseId)}`);
  const reasonCode = state === 'DELOAD' ? 'DELOAD' : 'STALL';

  return {
    type: 'progression',
    scope: `exercise:${String(exerciseEvidence.exerciseId)}`,
    title: state === 'DELOAD' ? `${name} deload recommended` : `${name} stalled at ${rec.prescription.weight} kg`,
    message: state === 'DELOAD'
      ? `Repeated misses at the same load triggered a deload prescription.`
      : `No improvement for ${num(rec.evidence?.stallCount)} sessions at the same load.`,
    reasonCode,
    evidence: {
      sessions: sessions >= 2 ? sessions : 2,
      window: '6',
      metric: 'e1rm',
      baseline: rec.evidence?.anchorWeight ?? null,
      current: rec.evidence?.lastModalWeight ?? null,
      stallCount: num(rec.evidence?.stallCount),
      state,
      sourceFns: ['selectProgressionHistory', 'getNextPrescription', 'resolveRecommendation']
    },
    confidence: rec.confidence && INSIGHT_CONFIDENCE.includes(rec.confidence) ? rec.confidence : 'LIMITED',
    priority: 1,
    freshness: freshnessOf(now),
    recommendation: rec.prescriptionText || `${rec.prescription.weight} kg × ${rec.prescription.repsMin}`,
    source: 'progression-v1',
    dedupKey: `stagnation:${String(exerciseEvidence.exerciseId)}`,
    surfaces: ['home', 'exercise']
  };
};

/**
 * Volume-landmark candidates (evidence feed, not UI). Emits LOW/HIGH only
 * when the landmark confidence is actionable (NORMAL/STRONG) to avoid
 * presenting twelve-week estimates as truth on thin data.
 */
export const interpretLandmarks = (landmarks, { now = Date.now() } = {}) => {
  if (!landmarks || typeof landmarks.byMuscle !== 'object') return [];
  const out = [];
  for (const [muscle, row] of Object.entries(landmarks.byMuscle)) {
    if (!row || typeof row !== 'object') continue;
    const conf = row.confidenceV2;
    if (conf !== 'NORMAL' && conf !== 'STRONG') continue;
    const normalized = normalizeLandmark(row, { muscle });
    const recent = num(row.recent);
    if (recent < num(row.low) && num(row.target) > 0) {
      out.push({
        type: 'volume',
        scope: `muscle:${muscle}`,
        title: `${muscle} volume below landmark`,
        message: `Recent ${recent} sets/wk is below the ${row.low}–${row.high} landmark range.`,
        reasonCode: 'VOLUME_LOW',
        evidence: {
          sessions: num(row.activeWeeks),
          window: '12w',
          metric: 'weighted-work-sets',
          baseline: row.target ?? null,
          current: recent,
          deltaPct: normalized.magnitudePct,
          trend: row.trend ?? null,
          sourceFns: ['computeVolumeLandmarks']
        },
        confidence: conf,
        priority: 3,
        freshness: freshnessOf(now),
        source: 'coaching-v2',
        dedupKey: `volume:${muscle}`,
        surfaces: ['home']
      });
    } else if (recent > num(row.high) && num(row.target) > 0) {
      out.push({
        type: 'volume',
        scope: `muscle:${muscle}`,
        title: `${muscle} volume above landmark`,
        message: `Recent ${recent} sets/wk is above the ${row.low}–${row.high} landmark range.`,
        reasonCode: 'VOLUME_HIGH',
        evidence: {
          sessions: num(row.activeWeeks),
          window: '12w',
          metric: 'weighted-work-sets',
          baseline: row.target ?? null,
          current: recent,
          deltaPct: normalized.magnitudePct,
          trend: row.trend ?? null,
          sourceFns: ['computeVolumeLandmarks']
        },
        confidence: conf,
        priority: 3,
        freshness: freshnessOf(now),
        source: 'coaching-v2',
        dedupKey: `volume:${muscle}`,
        surfaces: ['home']
      });
    }
  }
  return out;
};

const BALANCE_PAIRS = [
  { key: 'pushPull', reasonCode: 'BALANCE_PUSH_PULL', label: 'Push vs pull' },
  { key: 'chestBack', reasonCode: 'BALANCE_CHEST_BACK', label: 'Chest vs back' },
  { key: 'quadHam', reasonCode: 'BALANCE_QUAD_HAM', label: 'Quads vs hamstrings' }
];

/**
 * Balance candidates from the canonical muscleBalance scopes. Emits one
 * candidate per imbalanced pair; the prioritizer keeps the strongest (never
 * shows every imbalance). Uses the block scope (larger evidence base).
 */
export const interpretBalance = (balance, { now = Date.now() } = {}) => {
  if (!balance || typeof balance !== 'object') return [];
  const scope = balance.block || balance.week;
  if (!scope) return [];
  const scopeLabel = scope.label || 'block';
  const out = [];
  for (const pair of BALANCE_PAIRS) {
    const p = scope[pair.key];
    if (!p || p.status !== 'imbalanced') continue;
    const a = num(p.sideAValue);
    const b = num(p.sideBValue);
    const total = a + b;
    const sessions = Math.max(2, Math.round(total));
    out.push({
      type: 'balance',
      scope: `muscle:${pair.key}`,
      title: `${pair.label} imbalanced (${p.sideA} ${a} vs ${p.sideB} ${b})`,
      message: `${p.sideA} exposure outweighs ${p.sideB} exposure in the ${scopeLabel.toLowerCase()}.`,
      reasonCode: pair.reasonCode,
      evidence: {
        sessions,
        window: scopeLabel,
        metric: 'weighted-work-sets',
        baseline: b,
        current: a,
        deltaPct: total > 0 ? Math.round((Math.abs(a - b) / total) * 100) : null,
        sideA: p.sideA,
        sideB: p.sideB,
        sideAValue: a,
        sideBValue: b,
        status: p.status,
        sourceFns: ['calculateMuscleBalance']
      },
      confidence: total >= 10 ? 'NORMAL' : 'LIMITED',
      priority: 2,
      freshness: freshnessOf(now),
      source: 'coaching-v2',
      dedupKey: `balance:${pair.key}`,
      surfaces: ['home']
    });
  }
  return out;
};

/**
 * Consistency candidate from statistics.consistencyStats (7d vs 30d).
 * No second consistency formula: compares the canonical per-week rates.
 */
export const interpretConsistency = ({ consistency7 = null, consistency30 = null } = {}, { now = Date.now() } = {}) => {
  if (!consistency7 || !consistency30) return null;
  const perWeek7 = num(consistency7.perWeek);
  const perWeek30 = num(consistency30.perWeek);
  const w7 = num(consistency7.workouts);
  if (!(num(consistency30.workouts) >= 2)) return null;
  if (!(perWeek30 > 0)) return null;
  // Drop: recent rate below half the baseline (with at least 2 baseline wks).
  if (perWeek7 < perWeek30 * 0.5) {
    return {
      type: 'consistency',
      scope: 'week',
      title: `Training frequency dropped (${perWeek7}/wk vs ${perWeek30}/wk)`,
      message: `Last 7 days show ${w7} workouts against a ${perWeek30}/wk baseline.`,
      reasonCode: 'CONSISTENCY_DROP',
      evidence: {
        sessions: num(consistency30.workouts),
        window: '30d-vs-7d',
        metric: 'frequency',
        baseline: perWeek30,
        current: perWeek7,
        deltaPct: Math.round(((perWeek7 - perWeek30) / perWeek30) * 100),
        sourceFns: ['filterWorkoutsByRange', 'consistencyStats']
      },
      confidence: num(consistency30.workouts) >= 6 ? 'NORMAL' : 'LIMITED',
      priority: 1,
      freshness: freshnessOf(now),
      source: 'coaching-v2',
      dedupKey: 'consistency:drop',
      surfaces: ['home']
    };
  }
  return null;
};

/**
 * Readiness candidate (load-proxy ONLY). Allowed phrasing speaks about recent
 * volume and effort control; medical/CNS/overtraining language is forbidden
 * (enforced by construction — templates below contain no such words).
 */
export const interpretReadiness = (readiness, { now = Date.now() } = {}) => {
  if (!readiness || typeof readiness !== 'object') return null;
  const conf = readiness.confidence;
  if (conf !== 'NORMAL' && conf !== 'STRONG' && conf !== 'LIMITED') return null;
  const sessions = num(readiness.chronicSessions);
  if (!(sessions >= 2) && conf !== 'LIMITED') return null;

  if (readiness.status === 'fatigue') {
    return {
      type: 'recovery',
      scope: 'week',
      title: 'Recent training volume is elevated',
      message: 'Recent training volume is elevated. Consider keeping today\u2019s effort controlled.',
      reasonCode: 'RECOVERY_LOAD_HIGH',
      evidence: {
        sessions,
        window: '28d-vs-7d',
        metric: 'volume',
        baseline: readiness.chronicLoad ?? null,
        current: readiness.acuteLoad ?? null,
        deltaPct: null,
        ratio: readiness.ratio ?? null,
        sourceFns: ['calculateReadiness']
      },
      confidence: conf,
      priority: 2,
      freshness: freshnessOf(now),
      source: 'coaching-v2',
      dedupKey: 'recovery:load',
      surfaces: ['home']
    };
  }
  if (readiness.status === 'low') {
    return {
      type: 'recovery',
      scope: 'week',
      title: 'Recent training volume is light',
      message: 'Recent training appears lighter than baseline. Quality top sets are an option.',
      reasonCode: 'RECOVERY_LOAD_LIGHT',
      evidence: {
        sessions,
        window: '28d-vs-7d',
        metric: 'volume',
        baseline: readiness.chronicLoad ?? null,
        current: readiness.acuteLoad ?? null,
        deltaPct: null,
        ratio: readiness.ratio ?? null,
        sourceFns: ['calculateReadiness']
      },
      confidence: conf,
      priority: 3,
      freshness: freshnessOf(now),
      source: 'coaching-v2',
      dedupKey: 'recovery:load',
      surfaces: ['home']
    };
  }
  return null;
};
