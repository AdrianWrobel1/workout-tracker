import { resolveAttribution, attributeAmount } from '../domain/muscles';
import { isWorkSet } from '../domain/workoutExtensions';
import { parseWorkoutDate, getWeekStartKey as getCanonicalWeekStartKey } from '../domain/dates';

const DEFAULT_OPTIONS = {
  weeksWindow: 12,
  minWeeksWithData: 4,
  // Legacy option, kept for caller compatibility: precedence is now always
  // the canonical one (stored V2 > knowledge base > legacy muscles >
  // workout targets > category > unknown). Any value is accepted, ignored.
  musclesSource: 'exerciseDBFirst',
  exerciseMap: null,
  exercisesDB: null,
};

const toExerciseMap = (options) => {
  if (options.exerciseMap instanceof Map) return options.exerciseMap;
  if (options.exerciseMap && typeof options.exerciseMap === 'object') {
    return new Map(Object.entries(options.exerciseMap));
  }
  if (Array.isArray(options.exercisesDB)) {
    return new Map(options.exercisesDB.map((ex) => [ex?.id, ex]));
  }
  return new Map();
};

/**
 * Canonical weighted attribution: { axis: weightedSetCount }. Unknown
 * exercises contribute nothing (never smeared).
 */
const resolveMuscles = (exercise, exerciseMap) => {
  const resolution = resolveAttribution(exercise, exerciseMap);
  return resolution.weights || {};
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

/** Canonical confidence (NONE/LIMITED/NORMAL/STRONG) for Coaching V2. */
const getConfidenceV2 = (activeWeeks, minWeeksWithData) => {
  if (activeWeeks >= 8) return 'STRONG';
  if (activeWeeks >= minWeeksWithData) return 'NORMAL';
  if (activeWeeks >= 2) return 'LIMITED';
  return 'NONE';
};

const resolveNowMs = (now) => {
  if (now instanceof Date) {
    const t = now.getTime();
    return Number.isFinite(t) ? t : Date.now();
  }
  if (typeof now === 'number' && Number.isFinite(now)) return now;
  const parsed = parseWorkoutDate(now);
  if (parsed) return parsed.getTime();
  return Date.now();
};

export const computeVolumeLandmarks = (workouts = [], options = {}) => {
  const settings = { ...DEFAULT_OPTIONS, ...options };
  const nowMs = resolveNowMs(options.now ?? new Date());
  // Local 12-week window with canonical date parsing (legacy date-only =
  // local midnight) and future exclusion. Replaces the UTC-based
  // utils/workoutSelectors range helper for this evidence feed.
  const windowMs = settings.weeksWindow * 7 * 24 * 60 * 60 * 1000;
  const startTs = nowMs - windowMs;
  const recentWorkouts = (Array.isArray(workouts) ? workouts : []).filter((w) => {
    const parsed = parseWorkoutDate(w?.date);
    if (!parsed) return false;
    const ts = parsed.getTime();
    return ts >= startTs && ts <= nowMs;
  });

  const byMuscleWeek = new Map(); // muscle -> Map<weekKey, weightedWorkSets>
  const allWeekKeys = new Set();
  const exerciseMap = toExerciseMap(settings);

  for (let i = 0; i < recentWorkouts.length; i += 1) {
    const workout = recentWorkouts[i];
    const weekKey = getCanonicalWeekStartKey(workout?.date);
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

      const weights = resolveMuscles(exercise, exerciseMap);
      const attributed = attributeAmount({ weights }, workSetCount);
      for (const muscle of Object.keys(attributed)) {
        const value = attributed[muscle];
        if (!(value > 0)) continue;
        if (!byMuscleWeek.has(muscle)) byMuscleWeek.set(muscle, new Map());
        const weekMap = byMuscleWeek.get(muscle);
        weekMap.set(weekKey, (weekMap.get(weekKey) || 0) + value);
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
      confidence: getConfidence(activeSeries.length, settings.minWeeksWithData),
      confidenceV2: getConfidenceV2(activeSeries.length, settings.minWeeksWithData),
      activeWeeks: activeSeries.length
    };
  });

  return {
    byMuscle,
    // Explicit unit: landmarks track WEIGHTED WORK SETS per week per axis
    // (primary 1.0 / secondary 0.5 via canonical attribution), NOT kg tonnage.
    // Coaching V2 must not compare these numbers to work-volume kg.
    unit: 'weighted-work-sets-per-week',
    volumeSemantics: 'weighted-work-sets',
    generatedAt: new Date(nowMs).toISOString()
  };
};
