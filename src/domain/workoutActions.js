/**
 * Canonical workout mutation layer (pure, immutable).
 *
 * UI → (App handlers: side effects, persistence, toasts) → THESE FUNCTIONS
 * → domain → persistence.
 *
 * Every function takes a workout value and returns a NEW workout value
 * without mutating the input. Unrelated exercises/sets keep their object
 * references so React can rely on referential equality.
 */
import { normalizeSetForStorage } from './workoutExtensions';
import { generateId, generateSupersetId } from './ids';
import { toPersistedTimestamp, diffMinutes } from './dates';

const assertWorkout = (workout) => {
  if (!workout || !Array.isArray(workout.exercises)) return false;
  return true;
};

const validExIndex = (workout, exIndex) =>
  assertWorkout(workout) &&
  Number.isInteger(exIndex) &&
  exIndex >= 0 &&
  exIndex < workout.exercises.length;

const validSetIndex = (workout, exIndex, setIndex) =>
  validExIndex(workout, exIndex) &&
  Array.isArray(workout.exercises[exIndex].sets) &&
  Number.isInteger(setIndex) &&
  setIndex >= 0 &&
  setIndex < workout.exercises[exIndex].sets.length;

/** Set a single field on one set (keypad edits, manual edits). */
export const updateSetField = (workout, exIndex, setIndex, field, value) => {
  if (!validSetIndex(workout, exIndex, setIndex) || typeof field !== 'string') return workout;
  return {
    ...workout,
    exercises: workout.exercises.map((ex, idx) => {
      if (idx !== exIndex) return ex;
      return {
        ...ex,
        sets: ex.sets.map((set, sidx) => (sidx !== setIndex ? set : { ...set, [field]: value }))
      };
    })
  };
};

/**
 * Toggle set completion with auto-fill from suggested values.
 * Pure: instead of toasting, returns { workout, toast } where toast is a
 * message for the UI when completion was refused.
 */
export const toggleSetCompletion = (workout, exIndex, setIndex) => {
  if (!validSetIndex(workout, exIndex, setIndex)) return { workout, toast: null };
  let toast = null;
  const next = {
    ...workout,
    exercises: workout.exercises.map((ex, idx) => {
      if (idx !== exIndex) return ex;
      return {
        ...ex,
        sets: ex.sets.map((set, sidx) => {
          if (sidx !== setIndex) return set;
          const newVal = !set.completed;
          let updatedSet = { ...set, completed: newVal };
          if (newVal && !set.completed) {
            const kg = Number(set.kg) || 0;
            const reps = Number(set.reps) || 0;
            const suggestedKg = Number(set.suggestedKg) || 0;
            const suggestedReps = Number(set.suggestedReps) || 0;
            if (kg === 0 && reps === 0 && suggestedKg === 0 && suggestedReps === 0) {
              toast = 'Please enter kg and reps';
              return set;
            }
            if (kg === 0 && reps === 0 && (suggestedKg > 0 || suggestedReps > 0)) {
              updatedSet.kg = suggestedKg;
              updatedSet.reps = suggestedReps;
            } else if (kg === 0 || reps === 0) {
              if (kg === 0) updatedSet.kg = suggestedKg;
              if (reps === 0) updatedSet.reps = suggestedReps;
            }
          }
          if (!newVal) {
            updatedSet = { ...updatedSet, isBest1RM: false, isBestSetVolume: false, isHeaviestWeight: false };
          }
          return updatedSet;
        })
      };
    })
  };
  return { workout: next, toast };
};

/** Append a copy of the last set (not completed, PR flags cleared). */
export const addSet = (workout, exIndex) => {
  if (!validExIndex(workout, exIndex)) return workout;
  return {
    ...workout,
    exercises: workout.exercises.map((ex, idx) => {
      if (idx !== exIndex) return ex;
      const lastSet = ex.sets?.length ? ex.sets[ex.sets.length - 1] : { kg: 0, reps: 0 };
      const nextSet = normalizeSetForStorage({
        ...lastSet,
        completed: false,
        isBest1RM: false,
        isBestSetVolume: false,
        isHeaviestWeight: false
      });
      return { ...ex, sets: [...(ex.sets || []), nextSet] };
    })
  };
};

/** Prepend a warmup copy of the first set. */
export const addWarmupSet = (workout, exIndex) => {
  if (!validExIndex(workout, exIndex)) return workout;
  return {
    ...workout,
    exercises: workout.exercises.map((ex, idx) => {
      if (idx !== exIndex) return ex;
      const firstSet = ex.sets?.[0] || { kg: 0, reps: 0 };
      const warmupSet = normalizeSetForStorage(
        { ...firstSet, completed: false, isBest1RM: false, isBestSetVolume: false, isHeaviestWeight: false },
        'warmup'
      );
      return { ...ex, sets: [warmupSet, ...(ex.sets || [])] };
    })
  };
};

/** Remove one set by index. */
export const deleteSet = (workout, exIndex, setIndex) => {
  if (!validSetIndex(workout, exIndex, setIndex)) return workout;
  return {
    ...workout,
    exercises: workout.exercises.map((ex, idx) => {
      if (idx !== exIndex) return ex;
      return { ...ex, sets: ex.sets.filter((_, sidx) => sidx !== setIndex) };
    })
  };
};

/** Set explicit set type (warmup/work/drop/...) with normalization. */
export const setSetType = (workout, exIndex, setIndex, nextType) => {
  if (!validSetIndex(workout, exIndex, setIndex) || !nextType) return workout;
  return {
    ...workout,
    exercises: workout.exercises.map((ex, idx) => {
      if (idx !== exIndex) return ex;
      return {
        ...ex,
        sets: ex.sets.map((set, sidx) => (sidx !== setIndex ? set : normalizeSetForStorage(set, nextType)))
      };
    })
  };
};

/** Remove an exercise; clears orphaned superset links. */
export const deleteExercise = (workout, exIndex) => {
  if (!validExIndex(workout, exIndex)) return workout;
  const deletedSupersetId = workout.exercises[exIndex]?.supersetId;
  let exercises = workout.exercises.filter((_, idx) => idx !== exIndex);
  if (deletedSupersetId) {
    exercises = exercises.map((ex) =>
      ex.supersetId === deletedSupersetId ? { ...ex, supersetId: null } : ex
    );
  }
  return { ...workout, exercises };
};

/** Replace exercise order (expects a reordered array of the same items). */
export const reorderExercises = (workout, newOrder) => {
  if (!assertWorkout(workout) || !Array.isArray(newOrder)) return workout;
  return { ...workout, exercises: [...newOrder] };
};

/** Link two exercises into a new superset. */
export const createSuperset = (workout, exIndex1, exIndex2, supersetId = generateSupersetId()) => {
  if (!validExIndex(workout, exIndex1) || !validExIndex(workout, exIndex2)) return workout;
  if (exIndex1 === exIndex2) return workout;
  return {
    ...workout,
    exercises: workout.exercises.map((ex, idx) =>
      idx === exIndex1 || idx === exIndex2 ? { ...ex, supersetId } : ex
    )
  };
};

/** Remove all links of the superset containing exIndex. */
export const removeSuperset = (workout, exIndex) => {
  if (!validExIndex(workout, exIndex)) return workout;
  const supersetId = workout.exercises[exIndex]?.supersetId;
  if (!supersetId) return workout;
  return {
    ...workout,
    exercises: workout.exercises.map((ex) =>
      ex.supersetId === supersetId ? { ...ex, supersetId: null } : ex
    )
  };
};

/**
 * Build the canonical durable completed workout from an active workout.
 * Deep-clones (safe to pass into mutating PR detection), assigns a new id,
 * full ISO date, duration minutes and empty tags. Never mutates input.
 */
export const buildCompletedWorkout = (activeWorkout, opts = {}) => {
  if (!activeWorkout) return null;
  const now = opts.now instanceof Date ? opts.now : new Date();
  const id = opts.id || generateId();
  const clone = JSON.parse(JSON.stringify(activeWorkout));
  clone.id = id;
  clone.date = toPersistedTimestamp(now);
  clone.tags = Array.isArray(opts.tags) ? [...opts.tags] : [];
  if (clone.duration == null || opts.recomputeDuration !== false) {
    clone.duration = clone.startTime ? diffMinutes(clone.startTime, now) : Number(clone.duration) || 0;
  }
  return clone;
};
