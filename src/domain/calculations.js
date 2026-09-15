/**
 * Pure calculation functions
 * No React dependencies
 *
 * CANONICAL SEMANTICS (see implementation report §5):
 * - A SET is { kg, reps, completed, setType } where setType defaults to
 *   'work' and 'warmup' marks non-counting preparation sets.
 * - COMPLETED SET: set.completed === true (any type, warmups included).
 * - WORK SET: completed AND type !== 'warmup' (see `isWorkSet` in
 *   workoutExtensions.js — the single predicate for "counts toward
 *   training output"). Variants 'drop'/'failure'/'tempo'/'pause' count as work.
 * - SET VOLUME: effectiveKg * reps, where effectiveKg adds userWeight for
 *   bodyweight exercises (usesBodyweight). Defaults to base kg.
 * - WORK VOLUME: sum of set volumes over work sets only. Canonical training
 *   output used by analytics, PRs, comparisons and Coach Lens.
 * - TOTAL COMPLETED VOLUME (`calculateTotalVolume`, legacy): sum over ALL
 *   completed sets including warmups. Kept for backward-compatible display
 *   surfaces (cards, history rows); do not use for analytics.
 * - 1RM: Epley estimate kg * (1 + reps/30), rounded; reps===1 returns kg.
 */
import { isWorkSet } from './workoutExtensions';

export const calculate1RM = (kg, reps) => {
  const kgNum = Number(kg) || 0;
  const repsNum = Number(reps) || 0;
  if (!kgNum || !repsNum) return 0;
  if (repsNum === 1) return kgNum;
  return Math.round(kgNum * (1 + repsNum / 30));
};

export const calculateTotalVolume = (sets) => {
  return sets
    .filter(s => s.completed)
    .reduce((sum, s) => sum + ((Number(s.kg) || 0) * (Number(s.reps) || 0)), 0);
};

/**
 * Effective load for a set. Adds userWeight when the exercise uses
 * bodyweight (e.g. pull-ups logged as added weight only).
 */
export const calculateEffectiveKg = (set, opts = {}) => {
  const baseKg = Number(set?.kg) || 0;
  const extra = opts.usesBodyweight ? (Number(opts.userWeight) || 0) : 0;
  return baseKg + extra;
};

/** Volume of a single set (effectiveKg * reps). No completion filtering. */
export const calculateSetVolume = (set, opts = {}) => {
  return calculateEffectiveKg(set, opts) * (Number(set?.reps) || 0);
};

/**
 * Canonical WORK VOLUME: sum over work sets (completed, non-warmup) only.
 * Pass { userWeight, usesBodyweightFor } or per-set resolution via callback.
 */
export const calculateWorkVolume = (sets, opts = {}) => {
  const list = Array.isArray(sets) ? sets : [];
  const resolveOpts = typeof opts.resolveOpts === 'function' ? opts.resolveOpts : null;
  return list.reduce((sum, s) => {
    if (!isWorkSet(s)) return sum;
    const o = resolveOpts ? resolveOpts(s) : opts;
    return sum + calculateSetVolume(s, o || {});
  }, 0);
};

/**
 * Canonical workout-level work volume. Resolves bodyweight per exercise
 * from exercisesDB when available.
 */
export const calculateWorkoutWorkVolume = (workout, exercisesDB = [], userWeight = null) => {
  let total = 0;
  for (const ex of workout?.exercises || []) {
    const exDef = Array.isArray(exercisesDB)
      ? exercisesDB.find(d => d && d.id === ex.exerciseId)
      : null;
    const usesBodyweight = Boolean(exDef?.usesBodyweight);
    for (const s of ex.sets || []) {
      if (!isWorkSet(s)) continue;
      total += calculateSetVolume(s, { usesBodyweight, userWeight });
    }
  }
  return total;
};

/** Count of work sets in a set list (completed, non-warmup). */
export const countWorkSets = (sets) => (Array.isArray(sets) ? sets : []).filter(isWorkSet).length;

/**
 * Canonical per-exercise WORK VOLUME (work sets only, bodyweight-aware).
 * Single source for per-exercise volume rows so cards, session detail and
 * history previews can never show two different volumes for one exercise.
 */
export const calculateExerciseWorkVolume = (exercise, opts = {}) => {
  const sets = Array.isArray(exercise?.sets) ? exercise.sets : [];
  const resolveOpts = typeof opts.resolveOpts === 'function' ? opts.resolveOpts : null;
  if (resolveOpts) return calculateWorkVolume(sets, { resolveOpts });
  return calculateWorkVolume(sets, opts);
};

export const formatDate = (dateStr) => {
  return new Date(dateStr).toLocaleDateString('pl-PL', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

export const formatMonth = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
};

export const formatLastSetDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  
  const daysAgo = Math.floor((today - date) / (1000 * 60 * 60 * 24));
  
  if (daysAgo === 0) return 'Today';
  if (daysAgo === 1) return 'Yesterday';
  if (daysAgo < 7) return `${daysAgo} days ago`;
  if (daysAgo < 30) {
    const weeks = Math.floor(daysAgo / 7);
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  }
  if (daysAgo < 365) {
    const months = Math.floor(daysAgo / 30);
    return `${months} month${months > 1 ? 's' : ''} ago`;
  }
  
  const years = Math.floor(daysAgo / 365);
  return `${years} year${years > 1 ? 's' : ''} ago`;
};

export const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};