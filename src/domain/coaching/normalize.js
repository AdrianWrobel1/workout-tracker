/**
 * Coaching V2 — trend normalizer (thin seam, NOT a universal trend engine).
 *
 * Purpose: reconcile existing evidence (plateau staleness, strength movers,
 * exercise trend arrows, muscle trends, volume landmarks, recent-vs-prior
 * comparisons) into one common internal representation for the prioritizer —
 * without redefining any screen's chart logic.
 *
 * Shape:
 *   { direction: UP|FLAT|DOWN|STALE|UNKNOWN, magnitudePct, metric, confidence, evidence }
 *
 * Rules:
 * - Never mixes metrics: `metric` preserves what the evidence actually
 *   represents (strength | volume | frequency | mixed).
 * - No fabricated numbers: magnitudePct is null when baseline/current are
 *   unknown; deltaPct derives only from provided baseline/current.
 * - Deterministic: pure function of inputs, no wall-clock.
 */

export const TREND_DIRECTIONS = ['UP', 'FLAT', 'DOWN', 'STALE', 'UNKNOWN'];
export const TREND_METRICS = ['strength', 'volume', 'frequency', 'mixed'];
export const TREND_CONFIDENCE = ['NONE', 'LIMITED', 'NORMAL', 'STRONG'];

const numOrNull = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const confidenceWeight = (c) => {
  if (c === 'STRONG') return 3;
  if (c === 'NORMAL') return 2;
  if (c === 'LIMITED') return 1;
  return 0;
};

/**
 * Core normalizer: baseline vs current with explicit session count.
 * STALE is reserved for explicit stagnation evidence (no improvement across
 * N exposures) — not for small negative deltas (those are DOWN/FLAT).
 */
export const normalizeTrend = ({
  metric = 'mixed',
  baseline = null,
  current = null,
  sessions = 0,
  staleSessions = 0,
  staleThreshold = 3,
  sourceFns = []
} = {}) => {
  const safeMetric = TREND_METRICS.includes(metric) ? metric : 'mixed';
  const b = numOrNull(baseline);
  const c = numOrNull(current);
  const s = Number.isFinite(Number(sessions)) ? Math.max(0, Math.trunc(Number(sessions))) : 0;
  const stale = Number.isFinite(Number(staleSessions)) ? Math.max(0, Math.trunc(Number(staleSessions))) : 0;

  const evidence = { sessions: s, metric: safeMetric, baseline: b, current: current === undefined ? null : c, sourceFns: Array.isArray(sourceFns) ? [...sourceFns] : [] };

  if (!(s >= 2) || b === null || c === null) {
    return { direction: 'UNKNOWN', magnitudePct: null, metric: safeMetric, confidence: s <= 0 ? 'NONE' : 'LIMITED', evidence };
  }

  let magnitudePct = null;
  if (b !== 0) magnitudePct = Math.round(((c - b) / Math.abs(b)) * 100);
  else if (c !== 0) magnitudePct = 100;
  else magnitudePct = 0;

  // Explicit stagnation wins over small deltas when evidence qualifies.
  if (stale >= staleThreshold && Math.abs(magnitudePct) <= 8) {
    const confidence = s >= 8 && stale >= 5 ? 'STRONG' : s >= 5 && stale >= 3 ? 'NORMAL' : 'LIMITED';
    return { direction: 'STALE', magnitudePct, metric: safeMetric, confidence, evidence: { ...evidence, staleSessions: stale } };
  }

  let direction = 'FLAT';
  if (magnitudePct > 5) direction = 'UP';
  else if (magnitudePct < -5) direction = 'DOWN';

  let confidence = 'LIMITED';
  if (s >= 8) confidence = 'STRONG';
  else if (s >= 4) confidence = 'NORMAL';
  else if (s >= 2) confidence = 'LIMITED';

  return { direction, magnitudePct, metric: safeMetric, confidence, evidence: { ...evidence, deltaPct: magnitudePct } };
};

/**
 * Plateau → normalized strength/volume stagnation signal.
 * Preserves what plateau actually measured (e1rm vs volume vs both).
 */
export const normalizePlateau = (plateau, { exerciseId = null } = {}) => {
  if (!plateau || typeof plateau !== 'object') {
    return { direction: 'UNKNOWN', magnitudePct: null, metric: 'strength', confidence: 'NONE', evidence: { sessions: 0, metric: 'strength', sourceFns: ['detectPlateau'] } };
  }
  const sessions = numOrNull(plateau.exposuresChecked) ?? 0;
  const stale = numOrNull(plateau.lastImprovementSessionsAgo) ?? 0;
  const metric = plateau.stagnationType === 'volume' ? 'volume' : 'strength';
  const baseline = plateau.stagnationType === 'volume' ? (plateau.volumeBaseline ?? null) : (plateau.e1rmBaseline ?? null);
  const current = plateau.stagnationType === 'volume' ? (plateau.volumeCurrent ?? null) : (plateau.e1rmCurrent ?? null);
  const out = normalizeTrend({
    metric,
    baseline,
    current,
    sessions,
    staleSessions: stale,
    staleThreshold: 3,
    sourceFns: ['getExerciseHistory', 'detectPlateau']
  });
  return { ...out, evidence: { ...out.evidence, exerciseId, stagnationType: plateau.stagnationType ?? 'both', isPlateau: plateau.isPlateau === true } };
};

/**
 * Strength mover (statistics.strengthMovers row) → normalized strength signal.
 */
export const normalizeMover = (mover) => {
  if (!mover || typeof mover !== 'object') {
    return { direction: 'UNKNOWN', magnitudePct: null, metric: 'strength', confidence: 'NONE', evidence: { sessions: 0, metric: 'strength', sourceFns: ['strengthMovers'] } };
  }
  return normalizeTrend({
    metric: 'strength',
    baseline: mover.first ?? null,
    current: mover.last ?? null,
    sessions: mover.sessions ?? 0,
    sourceFns: ['strengthMovers']
  });
};

/**
 * Volume landmark row → normalized volume signal for one muscle axis.
 * Landmarks track weighted work SETS (not kg) — metric stays 'volume' with
 * unit preserved in evidence so V2 never compares them to kg tonnage.
 */
export const normalizeLandmark = (row, { muscle = null } = {}) => {
  if (!row || typeof row !== 'object') {
    return { direction: 'UNKNOWN', magnitudePct: null, metric: 'volume', confidence: 'NONE', evidence: { sessions: 0, metric: 'volume', sourceFns: ['computeVolumeLandmarks'] } };
  }
  const trend = row.trend;
  const direction = trend === 'up' ? 'UP' : trend === 'down' ? 'DOWN' : trend === 'flat' ? 'FLAT' : 'UNKNOWN';
  const conf = row.confidenceV2 && TREND_CONFIDENCE.includes(row.confidenceV2) ? row.confidenceV2 : 'LIMITED';
  const baseline = numOrNull(row.target);
  const current = numOrNull(row.recent);
  let magnitudePct = null;
  if (baseline !== null && current !== null && baseline !== 0) magnitudePct = Math.round(((current - baseline) / Math.abs(baseline)) * 100);
  return {
    direction,
    magnitudePct,
    metric: 'volume',
    confidence: conf,
    evidence: {
      sessions: numOrNull(row.activeWeeks) ?? 0,
      metric: 'volume',
      unit: 'weighted-work-sets-per-week',
      muscle,
      baseline,
      current,
      sourceFns: ['computeVolumeLandmarks']
    }
  };
};

/**
 * Recent-vs-prior session comparison → normalized mixed signal.
 */
export const normalizeComparison = (comparison) => {
  if (!comparison || comparison.hasPrevious !== true) {
    return { direction: 'UNKNOWN', magnitudePct: null, metric: 'mixed', confidence: 'NONE', evidence: { sessions: 0, metric: 'mixed', sourceFns: ['getSessionComparison'] } };
  }
  const delta = numOrNull(comparison.volumeDeltaPct);
  if (delta === null) {
    return { direction: 'UNKNOWN', magnitudePct: null, metric: 'mixed', confidence: 'LIMITED', evidence: { sessions: 2, metric: 'mixed', sourceFns: ['getSessionComparison', 'compareWorkoutToPrevious'] } };
  }
  return normalizeTrend({
    metric: 'mixed',
    baseline: 100,
    current: 100 + delta,
    sessions: 2,
    sourceFns: ['getSessionComparison', 'compareWorkoutToPrevious']
  });
};

export const __private = { confidenceWeight };
