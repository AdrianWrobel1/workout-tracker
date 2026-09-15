/**
 * Rest timer domain logic (pure, timestamp-based, no React).
 *
 * The canonical timer state is an end timestamp, never a ticking counter:
 *
 *   { active, startedAt, endsAt, totalSec, source }
 *
 * `remaining = endsAt - now` is derived on read, so background throttling,
 * long frame delays and tab visibility changes cannot cause drift. A 1s
 * interval may repaint the display, but it is never the source of truth.
 *
 * This module never touches workout data — the timer is transient UI state.
 */
import { isWorkSet } from './workoutExtensions';

export const DEFAULT_REST_SEC = 90;
export const REST_ADJUST_STEP_SEC = 15;
export const MIN_REST_DURATION_SEC = 15;
export const MAX_REST_DURATION_SEC = 600;

/** Clamp a user-configured default duration to a safe value. */
export const normalizeRestDuration = (value, fallback = DEFAULT_REST_SEC) => {
  const sec = Math.round(Number(value));
  if (!Number.isFinite(sec)) return fallback;
  if (sec < MIN_REST_DURATION_SEC || sec > MAX_REST_DURATION_SEC) return fallback;
  return sec;
};

/**
 * Create a rest timer. Returns null when the duration cannot produce a
 * timer (missing / non-positive / non-finite) so callers stay honest:
 * no zero-length timers, no special-casing at call sites.
 */
export const createRestTimer = (durationSec, now = Date.now(), source = null) => {
  const totalSec = Math.round(Number(durationSec));
  const at = Number(now);
  if (!Number.isFinite(totalSec) || totalSec <= 0) return null;
  if (!Number.isFinite(at)) return null;
  return {
    active: true,
    startedAt: at,
    endsAt: at + totalSec * 1000,
    totalSec,
    source: source ?? null
  };
};

/** Whole seconds remaining, never negative. Null timer => 0. */
export const getRemainingSec = (timer, now = Date.now()) => {
  if (!timer || timer.active !== true) return 0;
  const endsAt = Number(timer.endsAt);
  const at = Number(now);
  if (!Number.isFinite(endsAt) || !Number.isFinite(at)) return 0;
  return Math.max(0, Math.ceil((endsAt - at) / 1000));
};

/** True only for a live timer whose end time has passed. */
export const isRestComplete = (timer, now = Date.now()) =>
  Boolean(timer && timer.active === true) && getRemainingSec(timer, now) <= 0;

/**
 * Shift the end timestamp by deltaSec (+15 / -15).
 * Returns null when the adjustment consumes all remaining time —
 * taking off more than is left means "I'm ready now", i.e. a skip —
 * which keeps negative durations out of the UI and progress bar.
 */
export const addRestSeconds = (timer, deltaSec, now = Date.now()) => {
  if (!timer || timer.active !== true) return timer ?? null;
  const delta = Math.round(Number(deltaSec));
  if (!Number.isFinite(delta) || delta === 0) return timer;
  const remaining = getRemainingSec(timer, now);
  if (remaining + delta <= 0) return null;
  return {
    ...timer,
    endsAt: Number(timer.endsAt) + delta * 1000,
    totalSec: Math.max(1, (Number(timer.totalSec) || 0) + delta)
  };
};

/** Canonical skipped state: there is simply no timer. */
export const skipRestTimer = () => null;

/** MM:SS display value. */
export const formatRestTime = (totalSeconds) => {
  const sec = Math.max(0, Math.round(Number(totalSeconds)) || 0);
  const mins = Math.floor(sec / 60);
  const secs = sec % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

/**
 * Decide whether a toggleSetCompletion result should auto-start rest.
 *
 * Uses the existing `isWorkSet` semantics (completed + not warmup), so
 * work/drop/failure/tempo/pause sets rest and warmups do not — with no
 * second classification concept. Rejected completions (toast set) and
 * un-completions / edits (no false->true transition) never start rest.
 */
export const shouldAutoStartRest = ({ prevSet, nextSet, toast, autoStartEnabled = true }) => {
  if (autoStartEnabled !== true) return false;
  if (toast) return false;
  if (!prevSet || !nextSet) return false;
  if (prevSet.completed) return false;
  if (!nextSet.completed) return false;
  return isWorkSet(nextSet);
};

/**
 * Per-exercise default rest override (`exercise.restSec`, optional seconds).
 *
 * Absent/null/undefined means "use global default" — never store 0, -1 or
 * 9999 as a sentinel. Malformed values are ignored (treated as absent), so
 * an otherwise valid exercise is never rejected because of its override.
 * Uses the same 15–600s range as `normalizeRestDuration`.
 *
 * Returns a valid duration, or `undefined` when no usable override exists.
 * Pure: never mutates its input.
 */
export const normalizeExerciseRestOverride = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return undefined;
  const sec = Math.round(Number(value));
  if (!Number.isFinite(sec)) return undefined;
  if (sec < MIN_REST_DURATION_SEC || sec > MAX_REST_DURATION_SEC) return undefined;
  return sec;
};

/**
 * Effective rest duration for an exercise:
 *
 *   EXERCISE OVERRIDE → GLOBAL DEFAULT → SAFE FALLBACK
 *
 * Pure: never mutates either input. Never throws — unknown/malformed
 * exercises fall back to the normalized global value.
 */
export const resolveRestDuration = (exercise, globalRestSec) => {
  const normalizedGlobal = normalizeRestDuration(globalRestSec, DEFAULT_REST_SEC);
  const override = normalizeExerciseRestOverride(exercise?.restSec);
  return override ?? normalizedGlobal;
};

/**
 * Resolve the effective rest for a set completion inside an active workout.
 *
 *   workout exercise entry → exerciseId → exercisesDB lookup → override?
 *
 * Unknown/deleted exercises, missing entries and malformed overrides all
 * fall back to the normalized global value, so rest resolution can never
 * break set completion. Pure except for no side effects at all: reads only,
 * never mutates the workout or the exercise database.
 *
 * Returns the effective duration in seconds (always a safe number).
 */
export const resolveRestForWorkoutSet = ({ workout, exIndex, exercisesDB, globalRestSec }) => {
  const normalizedGlobal = normalizeRestDuration(globalRestSec, DEFAULT_REST_SEC);
  try {
    const entry = workout?.exercises?.[exIndex];
    const exerciseId = entry?.exerciseId;
    if (exerciseId === undefined || exerciseId === null) return normalizedGlobal;
    const db = Array.isArray(exercisesDB) ? exercisesDB : [];
    const exercise = db.find((e) => e?.id === exerciseId) ?? null;
    return resolveRestDuration(exercise, normalizedGlobal);
  } catch {
    return normalizedGlobal;
  }
};

/**
 * Strip/validate the optional `restSec` override for storage.
 *
 * Valid override → `{ ...exercise, restSec }` (rounded number).
 * Absent or malformed → copy WITHOUT the property (global inheritance).
 * Pure: always returns a new object, never mutates the input.
 */
export const sanitizeExerciseRestForStorage = (exercise) => {
  if (!exercise || typeof exercise !== 'object') return exercise;
  const override = normalizeExerciseRestOverride(exercise.restSec);
  if (override === undefined) {
    if (!('restSec' in exercise)) return exercise;
    const { restSec: _dropped, ...rest } = exercise;
    return rest;
  }
  if (exercise.restSec === override) return exercise;
  return { ...exercise, restSec: override };
};
