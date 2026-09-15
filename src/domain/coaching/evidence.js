/**
 * Coaching V2 — evidence collection (FACT layer only, no interpretation).
 *
 * Thin orchestration seam: gathers canonical facts + existing evidence feeds
 * into one bundle for normalize → interpret → prioritize. No new analytics,
 * no new taxonomy, no new volume math, no mutations. All functions pure.
 *
 * Canonical sources consumed (never reimplemented):
 *   history/exercise past .... getExerciseHistory / getExerciseRecords
 *   PRs ...................... detectPRsInWorkout semantics via stored flags
 *                              + getExerciseRecords (never bestKg/bestReps)
 *   session facts ............ sessionDetail.js selectors
 *   progression .............. resolveRecommendation (adapter only)
 *   readiness ................ calculateReadiness (with explicit now)
 *   plateau .................. detectPlateau (canonical volume, bodyweight-aware)
 *   balance .................. calculateMuscleBalance (canonical attribution)
 *   landmarks ................ computeVolumeLandmarks (evidence feed)
 *   consistency .............. consistencyStats + filterWorkoutsByRange
 *   strength movers .......... strengthMovers (range-filtered)
 *   muscle trend ............. muscleTrend
 *   dates .................... parseWorkoutDate / getLocalDayKey
 */

import { getExerciseHistory, getExerciseRecords, getExerciseTrend } from '../exercises';
import { resolveRecommendation } from '../progressionAdapter';
import { detectPlateau } from '../../analytics/plateau';
import { calculateReadiness } from '../../analytics/readiness';
import { calculateMuscleBalance } from '../../analytics/muscleBalance';
import { computeVolumeLandmarks } from '../../analytics/volumeLandmarks';
import {
  filterWorkoutsByRange,
  consistencyStats,
  strengthMovers,
  muscleTrend,
  MUSCLE_AXES
} from '../../analytics/statistics';
import {
  getSessionSummary,
  getSessionBestSet,
  getSessionTopVolumeExercise,
  getSessionComparison,
  getSessionHighlights
} from '../sessionDetail';
import { parseWorkoutDate } from '../dates';
import { resolveAttribution } from '../muscles';

export const COACHING_CONFIDENCE = ['NONE', 'LIMITED', 'NORMAL', 'STRONG'];

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
  const parsed = parseWorkoutDate(now);
  if (parsed) return parsed.getTime();
  return Date.now();
};

/**
 * Exclude future-dated workouts (a session dated tomorrow is not history).
 * Uses canonical parseWorkoutDate (legacy date-only = local midnight).
 */
export const excludeFutureWorkouts = (workouts, now) => {
  const nowMs = resolveNowMs(now ?? Date.now());
  return (Array.isArray(workouts) ? workouts : []).filter((w) => {
    const parsed = parseWorkoutDate(w?.date ?? w?.startTime);
    if (!parsed) return false;
    return parsed.getTime() <= nowMs;
  });
};

/**
 * Per-exercise evidence (FACTS only). Never throws; missing data → nulls.
 * Does NOT call suggestNextWeight / getLastCompletedSets directly — the only
 * progression source is resolveRecommendation (adapter).
 */
export const collectExerciseEvidence = ({
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
    const scoped = excludeFutureWorkouts(workouts, nowMs);
    const db = Array.isArray(exercisesDB) ? exercisesDB : [];
    const def = db.find((e) => e && e.id === exerciseId) || null;

    const history = getExerciseHistory(exerciseId, scoped);
    const records = getExerciseRecords(exerciseId, scoped);
    const plateau = detectPlateau(exerciseId, scoped, { exercisesDB: db, userWeight });
    let progression = null;
    try {
      progression = resolveRecommendation({
        exercise: def || { id: exerciseId },
        workouts: scoped,
        plan
      });
    } catch {
      progression = null;
    }
    let trendArrow = '→';
    try {
      trendArrow = getExerciseTrend(exerciseId, scoped, { now: nowMs });
    } catch {
      trendArrow = '→';
    }

    const sessions = history.length;
    const latest = sessions > 0 ? history[0] : null;
    const resolution = resolveAttribution(
      {
        exerciseId,
        name: def?.name ?? latest?.workoutName ?? null,
        category: def?.category ?? null,
        targetMuscles: def?.targetMuscles ?? null
      },
      new Map(db.map((e) => [e?.id, e]))
    );

    return {
      exerciseId,
      sessions,
      history,
      records,
      plateau,
      progression,
      trendArrow,
      latest,
      muscles: {
        primary: resolution.primary,
        secondary: resolution.secondary,
        detail: resolution.detail,
        weights: resolution.weights,
        source: resolution.source
      },
      usesBodyweight: def?.usesBodyweight === true
    };
  } catch {
    return null;
  }
};

/**
 * Session evidence (FACTS only) via canonical sessionDetail selectors.
 */
export const collectSessionEvidence = ({
  session = null,
  allWorkouts = [],
  exercisesDB = [],
  userWeight = null
} = {}) => {
  try {
    if (!session || typeof session !== 'object') return null;
    const opts = { exercisesDB: Array.isArray(exercisesDB) ? exercisesDB : [], userWeight };
    const scoped = Array.isArray(allWorkouts) ? allWorkouts : [];
    return {
      sessionId: session?.id ?? null,
      summary: getSessionSummary(session, opts),
      bestSet: getSessionBestSet(session),
      topVolumeExercise: getSessionTopVolumeExercise(session, opts),
      comparison: getSessionComparison(session, scoped, opts),
      highlights: getSessionHighlights(session, scoped, opts)
    };
  } catch {
    return null;
  }
};

/**
 * Global evidence bundle for home / prioritizer input. Caller-scoped:
 * pass already-filtered lists when available; this function does one
 * range-filter pass (not one per UI component).
 */
export const collectGlobalEvidence = ({
  workouts = [],
  exercisesDB = [],
  userWeight = null,
  now = Date.now()
} = {}) => {
  try {
    const nowMs = resolveNowMs(now);
    const db = Array.isArray(exercisesDB) ? exercisesDB : [];
    const scoped = excludeFutureWorkouts(workouts, nowMs);

    let readiness = null;
    try {
      readiness = calculateReadiness(scoped, { now: nowMs, exercisesDB: db, userWeight });
    } catch {
      readiness = null;
    }
    let balance = null;
    try {
      balance = calculateMuscleBalance(scoped, db, { now: nowMs });
    } catch {
      balance = null;
    }
    let landmarks = null;
    try {
      landmarks = computeVolumeLandmarks(scoped, { now: nowMs, exercisesDB: db });
    } catch {
      landmarks = null;
    }

    const ranged7 = filterWorkoutsByRange(scoped, '7days', nowMs);
    const ranged30 = filterWorkoutsByRange(scoped, '30days', nowMs);
    const ranged90 = filterWorkoutsByRange(scoped, '3months', nowMs);
    let consistency7 = null;
    let consistency30 = null;
    try {
      consistency7 = consistencyStats(ranged7, '7days', nowMs);
    } catch {
      consistency7 = null;
    }
    try {
      consistency30 = consistencyStats(ranged30, '30days', nowMs);
    } catch {
      consistency30 = null;
    }
    let movers = [];
    try {
      movers = strengthMovers(ranged90, { topN: 5 }) || [];
    } catch {
      movers = [];
    }

    return {
      nowMs,
      totalWorkouts: scoped.length,
      readiness,
      balance,
      landmarks,
      consistency7,
      consistency30,
      movers,
      rangedCounts: { d7: ranged7.length, d30: ranged30.length, d90: ranged90.length }
    };
  } catch {
    return null;
  }
};

/**
 * Muscle-context evidence for one axis (uses canonical muscleTrend).
 */
export const collectMuscleEvidence = ({
  axis = null,
  workouts = [],
  exercisesDB = [],
  now = Date.now()
} = {}) => {
  try {
    if (!axis || !MUSCLE_AXES.includes(axis)) return null;
    const nowMs = resolveNowMs(now);
    const scoped = excludeFutureWorkouts(workouts, nowMs);
    const trend = muscleTrend(scoped, axis, { exercisesDB: Array.isArray(exercisesDB) ? exercisesDB : [] });
    return { axis, trend };
  } catch {
    return null;
  }
};
