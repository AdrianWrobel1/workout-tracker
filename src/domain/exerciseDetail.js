/**
 * Exercise Detail 2.0 view-model — thin selectors over the canonical domain.
 *
 * REUSE > EXTEND > NEW: this file contains no new training logic.
 * Every number derives from exactly one canonical source:
 *
 *   per-exercise past ......... getExerciseHistory (domain/exercises)
 *   records / PR .............. getExerciseRecords (domain/exercises)
 *   trend ..................... getExerciseTrend (domain/exercises)
 *   chart context ............. getChartContext (domain/exercises)
 *   1RM ....................... calculate1RM (domain/calculations, Epley)
 *   set volume ................ calculateSetVolume (domain/calculations,
 *                               bodyweight-aware via usesBodyweight)
 *   next prescription ......... resolveRecommendation (domain/progressionAdapter,
 *                               i.e. Progression Engine V1 — consumed, never
 *                               reimplemented; legacy fallback preserved)
  *   muscle taxonomy ........... resolveAttribution (domain/muscles) —
  *                               the single resolver; no second taxonomy
 *   rest ...................... resolveRestDuration (domain/restTimer)
 *
 * What this file ADDS (and only this):
 *   1. a single composed model for the detail screen so JSX stays dumb
 *      (one getExerciseHistory scan per call; no duplicated history walks),
 *   2. exercise-level workload aggregates (exercise volume only — muscle
 *      attribution never contaminates these totals),
 *   3. pure navigation helpers for the Statistics → Detail → Back contract.
 *
 * Conventions:
 *   - 1RM / heaviest follow records semantics (base kg, warmups excluded).
 *     Volume is bodyweight-aware (effective kg) like Statistics.
 *   - Empty inputs yield zeros and nulls — never NaN/Infinity/undefined.
 *   - Never throws; worst case is a `found: false` model or nulls.
 */

import {
  getExerciseHistory,
  getExerciseRecords,
  getExerciseTrend,
  getChartContext,
} from './exercises';
import { calculate1RM, calculateSetVolume } from './calculations';
import { isWorkSet } from './workoutExtensions';
import { UNKNOWN_MUSCLE, resolveAttribution } from './muscles';
import { resolveRecommendation } from './progressionAdapter';
import {
  DEFAULT_REST_SEC,
  normalizeExerciseRestOverride,
  resolveRestDuration,
} from './restTimer';

export const RECENT_SESSION_LIMIT = 8;
export const DAY_MS = 24 * 60 * 60 * 1000;

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const round1 = (v) => Math.round((num(v) + Number.EPSILON) * 10) / 10;

const topSetOf = (workSets) => {
  let top = null;
  let topScore = -1;
  for (const s of workSets) {
    const kg = num(s?.kg);
    const reps = num(s?.reps);
    const score = calculate1RM(kg, reps) * 100000 + kg * reps;
    if (score > topScore) {
      topScore = score;
      top = { kg, reps };
    }
  }
  return top;
};

const sessionVolumeOf = (workSets, usesBodyweight, userWeight) =>
  round1(
    workSets.reduce(
      (sum, s) => sum + calculateSetVolume(s, { usesBodyweight, userWeight }),
      0
    )
  );

const toSessionRow = (item, usesBodyweight, userWeight) => {
  const completed = Array.isArray(item?.sets) ? item.sets : [];
  const work = completed.filter(isWorkSet);
  return {
    date: item?.date ?? null,
    workoutName: item?.workoutName ?? null,
    setsCount: completed.length,
    workSetsCount: work.length,
    topSet: topSetOf(work),
    max1RM: num(item?.max1RM),
    volume: sessionVolumeOf(work, usesBodyweight, userWeight),
    sets: completed,
  };
};

/**
 * Compose the full view-model for one exercise. Pure (reads inputs only).
 */
export function getExerciseDetailModel({
  exerciseId = null,
  workouts = [],
  exercisesDB = [],
  userWeight = null,
  globalRestSec = DEFAULT_REST_SEC,
} = {}) {
  try {
    const db = Array.isArray(exercisesDB) ? exercisesDB : [];
    const historyWorkouts = Array.isArray(workouts) ? workouts : [];
    const def = db.find((e) => e && e.id === exerciseId) || null;
    if (exerciseId === null || exerciseId === undefined || !def) {
      return { found: false, exerciseId: exerciseId ?? null };
    }

    const usesBodyweight = def.usesBodyweight === true;
    const history = getExerciseHistory(exerciseId, historyWorkouts);
    const records = getExerciseRecords(exerciseId, historyWorkouts);
    const trend = getExerciseTrend(exerciseId, historyWorkouts);
    const chartContext = getChartContext(exerciseId, historyWorkouts);

    const sessionsCount = history.length;
    const hasHistory = sessionsCount > 0;

    const rows = history.map((item) => toSessionRow(item, usesBodyweight, userWeight));

    const latest = hasHistory ? rows[0] : null;

    const best1RM = num(records?.best1RM);
    const heaviestWeight = num(records?.heaviestWeight);
    const maxReps = num(records?.maxReps);
    const best = {
      best1RM,
      best1RMDate: records?.best1RMDate ?? null,
      heaviestWeight,
      heaviestWeightDate: records?.heaviestWeightDate ?? null,
      maxReps,
      maxRepsDate: records?.maxRepsDate ?? null,
      bestSetVolume: num(records?.bestSetVolume),
      bestSetVolumeDate: records?.bestSetVolumeDate ?? null,
    };
    const hasBest = best1RM > 0 || heaviestWeight > 0 || maxReps > 0;

    let recommendation = null;
    try {
      recommendation = resolveRecommendation({ exercise: def, workouts: historyWorkouts });
    } catch {
      recommendation = null;
    }
    const hasRecommendation =
      Boolean(recommendation) &&
      (num(recommendation.suggestedKg) > 0 || num(recommendation.suggestedReps) > 0);

    // Exercise-level workload: exercise volume only (completed work sets,
    // bodyweight-aware). Muscle attribution is a separate concept and is
    // deliberately not applied here.
    let totalVolume = 0;
    let totalSets = 0;
    let totalReps = 0;
    for (const row of rows) {
      totalVolume += num(row.volume);
      totalSets += num(row.workSetsCount);
      const completed = Array.isArray(row.sets) ? row.sets : [];
      for (const s of completed) {
        if (!isWorkSet(s)) continue;
        totalReps += num(s?.reps);
      }
    }
    totalVolume = round1(totalVolume);
    const avgVolume = hasHistory ? round1(totalVolume / sessionsCount) : 0;
    const perWeek = (() => {
      if (sessionsCount < 2) return sessionsCount === 1 ? 1 : 0;
      const times = rows
        .map((r) => new Date(r.date).getTime())
        .filter((t) => Number.isFinite(t));
      if (times.length < 2) return round1(sessionsCount);
      const spanDays = Math.max(1, (Math.max(...times) - Math.min(...times)) / DAY_MS + 1);
      return round1(sessionsCount / Math.max(1, spanDays / 7));
    })();

    // Muscle information: the single canonical resolution (same function
    // Statistics, Session, Balance and Landmarks use — no second taxonomy).
    // primary/secondary carry weights (1.0 / 0.5); detail refines the axes.
    const resolution = resolveAttribution(
      { exerciseId, name: def.name, category: def.category, targetMuscles: def.targetMuscles },
      new Map(db.map((e) => [e?.id, e]))
    );
    const tokens = resolution.axes.length > 0 ? resolution.axes : [UNKNOWN_MUSCLE];
    const muscles = {
      primary: resolution.primary,
      secondary: resolution.secondary,
      detail: resolution.detail,
      weights: resolution.weights,
      tokens,
      explicit: resolution.source !== 'category' && resolution.source !== 'unknown',
      source: resolution.source,
    };

    const effectiveRestSec = resolveRestDuration(def, globalRestSec);
    const rest = {
      effectiveSec: effectiveRestSec,
      isOverride: normalizeExerciseRestOverride(def?.restSec) !== undefined,
    };

    const displayedCategory =
      (typeof resolution.category === 'string' && resolution.category.trim()) ||
      (typeof def.category === 'string' && def.category.trim()) ||
      null;
    const category = displayedCategory || 'General';

    return {
      found: true,
      exerciseId,
      identity: {
        name: typeof def.name === 'string' && def.name.trim() ? def.name.trim() : 'Unnamed exercise',
        category,
        muscleLine: tokens.join(', '),
        progressionMode: def?.progression?.mode ?? 'off',
        usesBodyweight,
      },
      hasHistory,
      sessionsCount,
      latest,
      best,
      hasBest,
      trend,
      chartContext,
      recommendation,
      hasRecommendation,
      workload: {
        totalVolume,
        avgVolume,
        totalSets,
        totalReps,
        sessions: sessionsCount,
        perWeek,
      },
      muscles,
      rest,
      recentSessions: rows.slice(0, RECENT_SESSION_LIMIT),
      sessions: rows,
      hasMoreSessions: sessionsCount > RECENT_SESSION_LIMIT,
    };
  } catch {
    return { found: false, exerciseId: exerciseId ?? null };
  }
}

// --- navigation contract (pure; mirrors App.jsx behavior) -----------------

/** Where the detail Back button goes. Statistics deep-links return to
 *  Statistics; every other entry point keeps the legacy exercises list. */
export function resolveExerciseDetailBackTarget(returnTo) {
  if (returnTo && returnTo.view === 'profileStatistics') {
    return { view: 'profile', profileSubview: 'statistics' };
  }
  return { view: 'exercises' };
}

/** Return context stored when opening a workout from the detail screen. */
export function buildExerciseDetailReturn(exerciseId) {
  return { view: 'exerciseDetail', exerciseId };
}

/** Marker stored when Statistics opens the detail screen. */
export function buildStatisticsReturn() {
  return { view: 'profileStatistics' };
}
