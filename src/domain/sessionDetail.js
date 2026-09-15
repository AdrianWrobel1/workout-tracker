/**
 * Session Detail 2.0 view-model — thin selectors over the canonical domain.
 *
 * REUSE > EXTEND > NEW: this file contains no new training logic.
 * Every number derives from exactly one canonical source, named per function:
 *
 *   completed-set rule .......... isWorkSet (domain/workoutExtensions)
 *   1RM ......................... calculate1RM (domain/calculations, Epley)
 *   set / workout volume ........ calculateSetVolume /
 *                                 calculateWorkoutWorkVolume
 *                                 (domain/calculations, bodyweight-aware)
 *   muscle taxonomy ............. resolveMusclesForExercise via muscleStats
 *                                 (analytics/statistics) — the single
 *                                 aggregation; no second taxonomy
 *   comparison .................. compareWorkoutToPrevious (domain/workouts)
 *   anomalies / coach ........... detectAnomalies / generateCoachLens
 *                                 (domain/workouts) — consumed by the UI,
 *                                 never reimplemented here
 *   date semantics .............. parseWorkoutDate / getLocalDayKey /
 *                                 diffMinutes (domain/dates)
 *
 * What this file ADDS (and only this):
 *   1. a per-session summary (WHAT DID THIS SESSION CONTAIN?) so JSX stays
 *      dumb,
 *   2. per-exercise rows (compact facts + deep-link target, never a second
 *      Exercise Detail),
 *   3. session-scoped muscle stats — muscleStats([workout]) by construction,
 *      so one session can never leak into another (hard invariant),
 *   4. factual highlights (PRs, best set, top-volume lift, comparison delta)
 *      kept strictly separate from coach interpretation,
 *   5. pure navigation helpers for the History → Session → Exercise Detail
 *      → Back → Session contract (mirrors domain/exerciseDetail.js).
 *
 * SESSION VOLUME vs ATTRIBUTED MUSCLE VOLUME are kept separate by design:
 * session totals come from calculateWorkoutWorkVolume (physical tonnage);
 * per-muscle numbers come from muscleStats (attribution — one set can count
 * toward several muscles, so attributed sums may exceed the session total).
 *
 * Conventions: empty / legacy inputs yield zeros and nulls — never
 * NaN / Infinity / undefined. Missing names render as "Unknown exercise",
 * missing dates as null (UI shows an honest fallback).
 */

import { isWorkSet, resolveSetType } from './workoutExtensions';
import {
  calculate1RM,
  calculateSetVolume,
  calculateWorkoutWorkVolume,
  countWorkSets,
} from './calculations';
import { compareWorkoutToPrevious } from './workouts';
import { muscleStats, buildExerciseMap } from '../analytics/statistics';
import { parseWorkoutDate, getLocalDayKey } from './dates';

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const round1 = (v) => Math.round((num(v) + Number.EPSILON) * 10) / 10;

/** Find a workout by id (null-safe). */
export function findWorkoutById(workouts, id) {
  if (id == null) return null;
  return (Array.isArray(workouts) ? workouts : []).find((w) => w?.id === id) || null;
}

/**
 * Session duration in whole minutes. Prefers the stored duration (the
 * finish-time value in minutes); falls back to startTime → endTime for
 * legacy records; null when unknowable (UI renders '—', never a fake 0
 * dressed as measured data... except stored 0 stays 0).
 */
export function resolveSessionDuration(workout, now = new Date()) {
  const stored = Number(workout?.duration);
  if (Number.isFinite(stored) && stored >= 0) return Math.floor(stored);
  const start = parseWorkoutDate(workout?.startTime);
  if (!start) return null;
  const end = parseWorkoutDate(workout?.endTime) || (now instanceof Date ? now : new Date());
  if (!end || end < start) return null;
  return Math.max(0, Math.floor((end - start) / 60000));
}

/** Count of completed sets carrying at least one stored PR flag. */
export function countSessionPRs(workout) {
  let n = 0;
  for (const ex of workout?.exercises || []) {
    for (const s of ex?.sets || []) {
      if (s?.completed && (s.isBest1RM || s.isBestSetVolume || s.isHeaviestWeight)) {
        n += 1;
      }
    }
  }
  return n;
}

/** Names of exercises containing at least one flagged PR set. */
export function prExerciseNames(workout) {
  const names = [];
  for (const ex of workout?.exercises || []) {
    const hit = (ex?.sets || []).some(
      (s) => s?.completed && (s.isBest1RM || s.isBestSetVolume || s.isHeaviestWeight)
    );
    if (hit) names.push(ex?.name || 'Exercise');
  }
  return names;
}

/**
 * WHAT DID THIS SESSION CONTAIN? Headline facts for one workout.
 * Pure; safe on empty / legacy inputs.
 */
export function getSessionSummary(workout, { exercisesDB = [], userWeight = null } = {}) {
  if (!workout || typeof workout !== 'object') {
    return {
      found: false,
      exercisesCount: 0,
      plannedSets: 0,
      completedSets: 0,
      workSets: 0,
      totalReps: 0,
      workVolume: 0,
      durationMin: null,
      prCount: 0,
      completionPct: null,
      density: null,
      hasWork: false,
    };
  }
  let plannedSets = 0;
  let completedSets = 0;
  let totalReps = 0;
  for (const ex of workout.exercises || []) {
    for (const s of ex?.sets || []) {
      if (resolveSetType(s) !== 'warmup') plannedSets += 1;
      if (s?.completed) completedSets += 1;
      if (!isWorkSet(s)) continue;
      totalReps += num(s?.reps);
    }
  }
  const workSets = countWorkSets(
    (workout.exercises || []).flatMap((ex) => ex?.sets || [])
  );
  const workVolume = round1(calculateWorkoutWorkVolume(workout, exercisesDB, userWeight));
  const durationMin = resolveSessionDuration(workout);
  const prCount = countSessionPRs(workout);
  const completionPct =
    plannedSets > 0 ? Math.round((workSets / plannedSets) * 100) : null;
  const density =
    durationMin != null && durationMin > 0 ? Math.round(workVolume / durationMin) : null;

  return {
    found: true,
    exercisesCount: (workout.exercises || []).length,
    plannedSets,
    completedSets,
    workSets,
    totalReps,
    workVolume,
    durationMin,
    prCount,
    completionPct,
    density,
    hasWork: workSets > 0,
  };
}

/** Best work set of the session by estimated 1RM (fact, not praise). */
export function getSessionBestSet(workout) {
  let best = null;
  for (const ex of workout?.exercises || []) {
    for (const s of ex?.sets || []) {
      if (!isWorkSet(s)) continue;
      const kg = num(s?.kg);
      const reps = num(s?.reps);
      if (!(kg > 0 && reps > 0)) continue;
      const estimated1RM = calculate1RM(kg, reps);
      if (!best || estimated1RM > best.estimated1RM) {
        best = {
          exerciseId: ex?.exerciseId ?? null,
          exerciseName: ex?.name || 'Exercise',
          kg,
          reps,
          estimated1RM,
        };
      }
    }
  }
  return best;
}

/** Highest-work-volume exercise of the session (bodyweight-aware). */
export function getSessionTopVolumeExercise(workout, { exercisesDB = [], userWeight = null } = {}) {
  const exerciseMap = buildExerciseMap(exercisesDB);
  let winner = null;
  for (const ex of workout?.exercises || []) {
    const def = ex?.exerciseId != null ? exerciseMap.get(ex.exerciseId) : null;
    const o = { usesBodyweight: Boolean(def?.usesBodyweight), userWeight };
    let vol = 0;
    for (const s of ex?.sets || []) {
      if (!isWorkSet(s)) continue;
      vol += calculateSetVolume(s, o);
    }
    if (!(vol > 0)) continue;
    if (!winner || vol > winner.volume) {
      winner = {
        exerciseId: ex?.exerciseId ?? null,
        exerciseName: ex?.name || def?.name || 'Exercise',
        volume: round1(vol),
      };
    }
  }
  return winner;
}

/**
 * Compact per-exercise facts for the breakdown. One row per logged exercise
 * (workout order preserved — the session narrative is not re-sorted).
 * Exercises with zero completed sets are included with workSets 0 so skipped
 * work stays visible instead of silently vanishing.
 */
export function getSessionExercises(workout, { exercisesDB = [], userWeight = null } = {}) {
  const exerciseMap = buildExerciseMap(exercisesDB);
  const rows = [];
  (workout?.exercises || []).forEach((ex, index) => {
    const def = ex?.exerciseId != null ? exerciseMap.get(ex.exerciseId) : null;
    const o = { usesBodyweight: Boolean(def?.usesBodyweight), userWeight };
    let planned = 0;
    let completed = 0;
    let workSets = 0;
    let reps = 0;
    let volume = 0;
    let bestSet = null;
    let hasPR = false;
    for (const s of ex?.sets || []) {
      if (resolveSetType(s) !== 'warmup') planned += 1;
      if (s?.completed) completed += 1;
      if (s?.completed && (s.isBest1RM || s.isBestSetVolume || s.isHeaviestWeight)) {
        hasPR = true;
      }
      if (!isWorkSet(s)) continue;
      workSets += 1;
      reps += num(s?.reps);
      volume += calculateSetVolume(s, o);
      const kg = num(s?.kg);
      const rp = num(s?.reps);
      if (kg > 0 && rp > 0) {
        const oneRM = calculate1RM(kg, rp);
        if (!bestSet || oneRM > bestSet.oneRM) bestSet = { kg, reps: rp, oneRM };
      }
    }
    rows.push({
      key: ex?.exerciseId ?? `index-${index}`,
      exerciseId: ex?.exerciseId ?? null,
      name: ex?.name || def?.name || 'Unknown exercise',
      category: ex?.category || def?.category || 'General',
      planned,
      completed,
      workSets,
      reps,
      volume: round1(volume),
      bestSet,
      hasPR,
      canOpen: ex?.exerciseId != null,
      skipped: completed === 0,
    });
  });
  return rows;
}

/**
 * Session-scoped muscle attribution. The single-element list is the whole
 * point: muscleStats([workout]) cannot see any other session, so the Body
 * Map for Workout B can never show Workout A data (hard invariant).
 */
export function getSessionMuscleStats(workout, { exercisesDB = [], userWeight = null } = {}) {
  return muscleStats(workout ? [workout] : [], { userWeight, exercisesDB });
}

const previousWorkoutBefore = (workout, allWorkouts) => {
  const current = parseWorkoutDate(workout?.date ?? workout?.startTime);
  if (!current) return null;
  const currentTime = current.getTime();
  let prev = null;
  let prevTime = -Infinity;
  for (const w of Array.isArray(allWorkouts) ? allWorkouts : []) {
    if (workout?.id != null && w?.id === workout.id) continue;
    if (
      workout?.startTime != null &&
      w?.startTime != null &&
      w.startTime === workout.startTime
    ) {
      continue;
    }
    const t = parseWorkoutDate(w?.date ?? w?.startTime);
    if (!t) continue;
    const ms = t.getTime();
    if (ms < currentTime && ms > prevTime) {
      prev = w;
      prevTime = ms;
    }
  }
  return prev;
};

/**
 * Session comparison against the previous comparable session (fact only:
 * deltas, no scores). Trend reuses compareWorkoutToPrevious; displayed
 * numbers use the same canonical work volume as the session summary so one
 * workout can never show two different volumes on one screen.
 */
export function getSessionComparison(
  workout,
  allWorkouts,
  { exercisesDB = [], userWeight = null } = {}
) {
  const prev = previousWorkoutBefore(workout, allWorkouts);
  if (!prev) return { hasPrevious: false };
  const trend = compareWorkoutToPrevious(workout, allWorkouts)?.trend || 'flat';
  const volumeCurrent = round1(calculateWorkoutWorkVolume(workout, exercisesDB, userWeight));
  const volumePrevious = round1(calculateWorkoutWorkVolume(prev, exercisesDB, userWeight));
  const volumeDeltaPct =
    volumePrevious > 0 ? Math.round(((volumeCurrent - volumePrevious) / volumePrevious) * 100) : null;
  const setsOf = (w) =>
    (w?.exercises || []).reduce((n, ex) => n + countWorkSets(ex?.sets), 0);
  const workSetsCurrent = setsOf(workout);
  const workSetsPrevious = setsOf(prev);
  const durationCurrent = resolveSessionDuration(workout);
  const durationPrevious = resolveSessionDuration(prev);
  return {
    hasPrevious: true,
    previousId: prev?.id ?? null,
    previousDate: prev?.date ?? null,
    previousDayKey: getLocalDayKey(prev?.date ?? prev?.startTime),
    previousName:
      typeof prev?.name === 'string' && prev.name.trim() ? prev.name.trim() : 'Previous session',
    trend,
    volumeCurrent,
    volumePrevious,
    volumeDeltaPct,
    workSetsCurrent,
    workSetsPrevious,
    workSetsDelta: workSetsCurrent - workSetsPrevious,
    durationCurrent,
    durationPrevious,
    durationDeltaMin:
      durationCurrent != null && durationPrevious != null
        ? durationCurrent - durationPrevious
        : null,
  };
}

/**
 * Factual highlights for THIS session: PRs, best set, most productive lift,
 * comparison delta. No invented insights, no celebration of normal sets —
 * each entry is either present (with data) or absent (null).
 */
export function getSessionHighlights(
  workout,
  allWorkouts,
  { exercisesDB = [], userWeight = null } = {}
) {
  const opts = { exercisesDB, userWeight };
  return {
    prCount: countSessionPRs(workout),
    prExercises: prExerciseNames(workout),
    bestSet: getSessionBestSet(workout),
    topVolumeExercise: getSessionTopVolumeExercise(workout, opts),
    comparison: getSessionComparison(workout, allWorkouts, opts),
  };
}

// --- navigation contract (pure; mirrors domain/exerciseDetail.js) ---------

/**
 * Return context stored when opening an exercise from a session, so
 * Exercise Detail → Back lands on the same session (not the list root).
 */
export function buildSessionReturn({ date = null, workoutId = null } = {}) {
  return { view: 'workoutDetail', date, workoutId };
}

/**
 * Where Exercise Detail's Back button goes when it was opened from a
 * session. Returns null for non-session entries (caller keeps its legacy
 * behavior: Statistics → Statistics, otherwise the exercises list).
 */
export function resolveSessionBackTarget(returnTo) {
  if (returnTo && returnTo.view === 'workoutDetail') {
    return {
      view: 'workoutDetail',
      date: returnTo.date ?? null,
      workoutId: returnTo.workoutId ?? null,
    };
  }
  return null;
}
