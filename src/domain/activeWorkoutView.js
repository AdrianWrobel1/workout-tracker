/**
 * Active Workout 2.0 — derived view helpers (pure, no React, no storage).
 *
 * These answer the execution questions "what set am I on?" and "what comes
 * next?" WITHOUT a second workout engine: every function reads the canonical
 * workout value (same shape `workoutActions` mutates immutably) and returns
 * derived numbers. Set semantics (`completed`, warmup vs work) are reused
 * from `workoutExtensions`; progression wording is reused from
 * `progressionCopy` templates via the adapter result — this module only maps
 * the engine state to a non-color badge (icon + word) so status never relies
 * on color alone.
 *
 * All functions are defensive: malformed / legacy / empty inputs yield safe
 * empty results, never throw.
 */

const asExercises = (workout) =>
  workout && Array.isArray(workout.exercises) ? workout.exercises : [];

const asSets = (exercise) =>
  exercise && Array.isArray(exercise.sets) ? exercise.sets : [];

/**
 * Index of the set the user should do next: the first incomplete set.
 * -1 when every set is complete, there are no sets, or input is malformed.
 */
export const getCurrentSetIndex = (exercise) => {
  const sets = asSets(exercise);
  for (let i = 0; i < sets.length; i += 1) {
    // Only an explicit completed:true counts as done — malformed entries
    // surface at their position instead of being silently skipped.
    if (sets[i]?.completed !== true) return i;
  }
  return -1;
};

/**
 * Per-exercise progress: { total, completed, remaining, currentSetNumber,
 * isComplete }. currentSetNumber is 1-based position of the current set
 * (null when complete/empty) so UI can render "Set 2 of 4".
 */
export const getExerciseProgress = (exercise) => {
  const sets = asSets(exercise);
  const total = sets.length;
  let completed = 0;
  for (const set of sets) {
    if (set && set.completed === true) completed += 1;
  }
  const current = getCurrentSetIndex(exercise);
  return {
    total,
    completed,
    remaining: Math.max(0, total - completed),
    currentSetNumber: current >= 0 ? current + 1 : null,
    isComplete: total > 0 && completed >= total,
  };
};

/**
 * Whole-workout progress: { totalSets, completedSets, totalExercises,
 * completedExercises, currentExerciseIndex, percent }.
 * currentExerciseIndex is the first exercise with remaining work (-1 when
 * everything is done or the workout is empty).
 */
export const getWorkoutProgress = (workout) => {
  const exercises = asExercises(workout);
  let totalSets = 0;
  let completedSets = 0;
  let completedExercises = 0;
  let currentExerciseIndex = -1;
  exercises.forEach((exercise, idx) => {
    const sets = asSets(exercise);
    totalSets += sets.length;
    let done = 0;
    for (const set of sets) {
      if (set && set.completed === true) {
        completedSets += 1;
        done += 1;
      }
    }
    const hasWork = sets.length > 0 && done >= sets.length;
    if (hasWork) {
      completedExercises += 1;
    } else if (currentExerciseIndex === -1 && sets.length > 0) {
      currentExerciseIndex = idx;
    }
  });
  return {
    totalSets,
    completedSets,
    totalExercises: exercises.length,
    completedExercises,
    currentExerciseIndex,
    percent: totalSets > 0 ? (completedSets / totalSets) * 100 : 0,
  };
};

/**
 * Next exercise after fromIndex that still has incomplete work.
 * Searches forward first, then wraps to the start (so "next" from the last
 * exercise finds remaining work earlier in the list). -1 when none.
 */
export const getNextPendingExercise = (workout, fromIndex) => {
  const exercises = asExercises(workout);
  if (exercises.length === 0) return -1;
  const start = Number.isInteger(fromIndex) ? fromIndex : -1;
  const hasRemaining = (exercise) => {
    const sets = asSets(exercise);
    if (sets.length === 0) return false;
    return sets.some((set) => !set || set.completed !== true);
  };
  for (let i = start + 1; i < exercises.length; i += 1) {
    if (hasRemaining(exercises[i])) return i;
  }
  for (let i = 0; i <= start && i < exercises.length; i += 1) {
    if (hasRemaining(exercises[i])) return i;
  }
  return -1;
};

/**
 * Idempotency guard for the finish-save path: true when a workout id is
 * already present in history (double-tap Save must not duplicate history).
 */
export const isWorkoutPersisted = (workouts, id) => {
  if (id === undefined || id === null) return false;
  if (!Array.isArray(workouts)) return false;
  return workouts.some((workout) => workout && workout.id === id);
};

/**
 * Non-color progression badge: { label, icon } derived from the canonical
 * engine state only. UI must render BOTH (never color alone) and must never
 * surface internal reason codes.
 */
export const describeProgressionState = (state) => {
  switch (state) {
    case 'UP':
      return { label: 'Up', icon: '▲' };
    case 'REP_UP':
      return { label: 'More reps', icon: '＋' };
    case 'HOLD':
      return { label: 'Hold', icon: '＝' };
    case 'STALL':
      return { label: 'Stall', icon: '◆' };
    case 'DELOAD':
      return { label: 'Deload', icon: '▼' };
    case 'NO_HISTORY':
      return { label: 'New', icon: '○' };
    case 'OFF':
      return { label: 'Off', icon: '–' };
    default:
      return { label: 'Hold', icon: '＝' };
  }
};
