import { mapCategoryToMuscles } from '../domain/workouts';
import { isWorkSet } from '../domain/workoutExtensions';
import { getRecentWorkouts, getWeekStartKey } from '../utils/workoutSelectors';

const DEFAULT_OPTIONS = {
  weeksWindow: 12,
  minWeeksWithData: 4,
  musclesSource: 'exerciseDBFirst',
  exerciseMap: null
};

const resolveMuscles = (exercise, options) => {
  const exerciseMap = options.exerciseMap || {};
  const entry = exercise?.exerciseId != null ? exerciseMap[exercise.exerciseId] : null;

  if (options.musclesSource === 'exerciseDBFirst') {
    if (entry?.muscles?.length) return entry.muscles;
    if (exercise?.targetMuscles?.length) return exercise.targetMuscles;
    return mapCategoryToMuscles(exercise?.category);
  }

  if (exercise?.targetMuscles?.length) return exercise.targetMuscles;
  if (entry?.muscles?.length) return entry.muscles;
  return mapCategoryToMuscles(exercise?.category);
};

const average = (values) => {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const getTrend = (recentValues, previousValues) => {
  const recentAvg = average(recentValues);
  const previousAvg = average(previousValues);
  if (previousAvg <= 0 && recentAvg > 0) return 'up';
  if (previousAvg <= 0) return 'flat';
  if (recentAvg > previousAvg * 1.08) return 'up';
  if (recentAvg < previousAvg * 0.92) return 'down';
  return 'flat';
};

const getConfidence = (activeWeeks, minWeeksWithData) => {
  if (activeWeeks >= 8) return 'high';
  if (activeWeeks >= minWeeksWithData) return 'medium';
  return 'low';
};

export const computeVolumeLandmarks = (workouts = [], options = {}) => {
  const settings = { ...DEFAULT_OPTIONS, ...options };
  const referenceNow = options.now || new Date();
  const recentWorkouts = getRecentWorkouts(
    workouts,
    settings.weeksWindow * 7,
    referenceNow
  );

  const byMuscleWeek = new Map(); // muscle -> Map<weekKey, workSetCount>
  const allWeekKeys = new Set();

  for (let i = 0; i < recentWorkouts.length; i += 1) {
    const workout = recentWorkouts[i];
    const weekKey = getWeekStartKey(workout?.date);
    if (!weekKey) continue;
    allWeekKeys.add(weekKey);

    const exercises = workout?.exercises || [];
    for (let j = 0; j < exercises.length; j += 1) {
      const exercise = exercises[j];
      const sets = exercise?.sets || [];
      let workSetCount = 0;

      for (let k = 0; k < sets.length; k += 1) {
        if (isWorkSet(sets[k])) workSetCount += 1;
      }
      if (workSetCount === 0) continue;

      const muscles = resolveMuscles(exercise, settings);
      for (let m = 0; m < muscles.length; m += 1) {
        const muscle = muscles[m];
        if (!byMuscleWeek.has(muscle)) byMuscleWeek.set(muscle, new Map());
        const weekMap = byMuscleWeek.get(muscle);
        weekMap.set(weekKey, (weekMap.get(weekKey) || 0) + workSetCount);
      }
    }
  }

  const sortedWeekKeys = Array.from(allWeekKeys).sort();
  const byMuscle = {};

  byMuscleWeek.forEach((weekMap, muscle) => {
    const weeklySeries = sortedWeekKeys.map(weekKey => weekMap.get(weekKey) || 0);
    const activeSeries = weeklySeries.filter(value => value > 0);
    const base = average(activeSeries);

    const recentSlice = weeklySeries.slice(-4);
    const previousSlice = weeklySeries.slice(Math.max(0, weeklySeries.length - 8), Math.max(0, weeklySeries.length - 4));

    const target = Math.max(0, Math.round(base));
    const low = Math.max(0, Math.round(target * 0.8));
    const high = Math.max(target, Math.round(target * 1.2));

    byMuscle[muscle] = {
      low,
      target,
      high,
      recent: Math.round(average(recentSlice)),
      trend: getTrend(recentSlice, previousSlice),
      confidence: getConfidence(activeSeries.length, settings.minWeeksWithData)
    };
  });

  return {
    byMuscle,
    generatedAt: new Date(referenceNow).toISOString()
  };
};
