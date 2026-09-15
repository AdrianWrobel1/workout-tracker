export const SET_TYPES = ['warmup', 'work', 'drop', 'failure', 'tempo', 'pause'];

const VALID_SET_TYPES = new Set(SET_TYPES);

export const resolveSetType = (set) => {
  if (!set || typeof set !== 'object') return 'work';
  if (set.setType && VALID_SET_TYPES.has(set.setType)) return set.setType;
  return set.warmup ? 'warmup' : 'work';
};

export const isWarmupSet = (set) => resolveSetType(set) === 'warmup';

export const isWorkSet = (set) => Boolean(set?.completed) && !isWarmupSet(set);

export const normalizeSetForStorage = (set = {}, fallbackType = null) => {
  const resolvedType = VALID_SET_TYPES.has(fallbackType)
    ? fallbackType
    : resolveSetType(set);
  const warmup = resolvedType === 'warmup';

  return {
    ...set,
    setType: resolvedType,
    warmup,
    rir: set.rir ?? null,
    tempo: set.tempo ?? null,
    pauseSec: set.pauseSec ?? null
  };
};

export const normalizeSetsForStorage = (sets = [], fallbackType = null) => {
  return (sets || []).map(set => normalizeSetForStorage(set, fallbackType));
};

export const normalizeWorkoutExerciseForStorage = (exercise = {}) => {
  return {
    ...exercise,
    priority: exercise.priority ?? 3,
    nonNegotiable: exercise.nonNegotiable ?? false,
    estimatedSetSec: exercise.estimatedSetSec ?? null,
    // ISOLATION: copy the array — never share the template's reference.
    targetMuscles: Array.isArray(exercise.targetMuscles) ? [...exercise.targetMuscles] : undefined,
    // ISOLATION: copy nested config objects so template ↔ active never alias.
    progression: exercise.progression && typeof exercise.progression === 'object'
      ? { ...exercise.progression }
      : exercise.progression,
    sets: normalizeSetsForStorage(exercise.sets || [])
  };
};

/**
 * Deep-clone template exercises for TEMPLATE → CLONE → ACTIVE WORKOUT.
 * JSON round-trip is intentional: templates are JSON-serializable (IndexedDB)
 * and every nested structure (sets, targetMuscles, progression/rest config,
 * planNotes, superset links) must become an independent working copy.
 * Falls back to a structural per-level copy when serialization fails.
 */
export const cloneTemplateExercisesForActive = (exercises = []) => {
  const list = Array.isArray(exercises) ? exercises : [];
  try {
    return JSON.parse(JSON.stringify(list));
  } catch {
    return list.map((exercise) => ({
      ...exercise,
      targetMuscles: Array.isArray(exercise.targetMuscles) ? [...exercise.targetMuscles] : exercise.targetMuscles,
      progression: exercise?.progression && typeof exercise.progression === 'object'
        ? { ...exercise.progression }
        : exercise?.progression,
      sets: Array.isArray(exercise?.sets) ? exercise.sets.map((set) => ({ ...set })) : []
    }));
  }
};

/**
 * Duplicate a whole template as an independent blueprint.
 * New id, "(Copy)" suffix, execution memory cleared (snapshots are history,
 * not blueprint). Deep-cloned so nested arrays/objects never alias.
 */
export const duplicateTemplate = (template, generateIdFn) => {
  if (!template || typeof template !== 'object') return null;
  let clone;
  try {
    clone = JSON.parse(JSON.stringify(template));
  } catch {
    clone = { ...template, exercises: cloneTemplateExercisesForActive(template.exercises) };
  }
  const newId = typeof generateIdFn === 'function' ? generateIdFn() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  clone.id = newId;
  const baseName = typeof clone.name === 'string' && clone.name.trim() ? clone.name.trim() : 'Template';
  clone.name = `${baseName} (Copy)`;
  clone.lastWorkoutSnapshot = null;
  clone.templatePrevious = {};
  return clone;
};

export const getSetTimeWeight = (setType = 'work') => {
  if (setType === 'warmup') return 0.65;
  if (setType === 'drop' || setType === 'failure') return 1.2;
  if (setType === 'tempo' || setType === 'pause') return 1.35;
  return 1;
};
