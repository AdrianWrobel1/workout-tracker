const DAY_MS = 24 * 60 * 60 * 1000;

export const toTimestamp = (dateValue) => {
  const ts = new Date(dateValue).getTime();
  return Number.isFinite(ts) ? ts : null;
};

export const getWeekStartKey = (dateValue) => {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  const normalized = new Date(date);
  const day = (normalized.getDay() + 6) % 7; // Monday = 0
  normalized.setDate(normalized.getDate() - day);
  normalized.setHours(0, 0, 0, 0);
  return normalized.toISOString().split('T')[0];
};

export const getWorkoutsInRange = (workouts = [], startDate, endDate) => {
  const startTs = toTimestamp(startDate);
  const endTs = toTimestamp(endDate);
  if (startTs === null || endTs === null) return [];

  return (workouts || []).filter(workout => {
    const ts = toTimestamp(workout?.date);
    return ts !== null && ts >= startTs && ts <= endTs;
  });
};

export const getRecentWorkouts = (workouts = [], days = 28, now = new Date()) => {
  const endTs = toTimestamp(now);
  if (endTs === null) return [];
  const startTs = endTs - (days * DAY_MS);

  return (workouts || []).filter(workout => {
    const ts = toTimestamp(workout?.date);
    return ts !== null && ts >= startTs && ts <= endTs;
  });
};

export const getTemplateWorkouts = (
  workouts = [],
  template,
  options = {}
) => {
  const strictTemplateIdMatch = options.strictTemplateIdMatch !== false;
  const templateId = template?.id ?? null;
  const blockId = template?.block?.blockId ?? null;

  return (workouts || []).filter(workout => {
    if (strictTemplateIdMatch && templateId !== null) {
      return workout?.templateId === templateId;
    }
    if (blockId && workout?.blockRef?.blockId) {
      return workout.blockRef.blockId === blockId;
    }
    return workout?.templateId === templateId || workout?.name === template?.name;
  });
};

export const createExerciseMap = (exercisesDB = []) => {
  const map = {};
  (exercisesDB || []).forEach(exercise => {
    if (exercise?.id != null) map[exercise.id] = exercise;
  });
  return map;
};

export const getExerciseKey = (exercise = {}) => {
  if (exercise.exerciseId != null) return `id:${exercise.exerciseId}`;
  if (exercise.id != null) return `id:${exercise.id}`;
  return `name:${exercise.name || 'unknown'}`;
};
