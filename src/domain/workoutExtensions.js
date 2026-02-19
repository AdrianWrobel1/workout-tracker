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
    targetMuscles: Array.isArray(exercise.targetMuscles) ? exercise.targetMuscles : undefined,
    sets: normalizeSetsForStorage(exercise.sets || [])
  };
};

export const getSetTimeWeight = (setType = 'work') => {
  if (setType === 'warmup') return 0.65;
  if (setType === 'drop' || setType === 'failure') return 1.2;
  if (setType === 'tempo' || setType === 'pause') return 1.35;
  return 1;
};
