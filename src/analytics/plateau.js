import { calculate1RM } from '../domain/calculations';
import { getExerciseHistory } from '../domain/exercises';
import { isWorkSet } from '../domain/workoutExtensions';

const DEFAULT_OPTIONS = {
  minStagnationExposures: 3
};

const getSessionBestE1RM = (session) => {
  const sets = session?.sets || [];
  let best = 0;

  for (let i = 0; i < sets.length; i += 1) {
    const set = sets[i];
    if (!isWorkSet(set)) continue;
    const e1rm = calculate1RM(set.kg, set.reps);
    if (e1rm > best) best = e1rm;
  }

  return best;
};

const getSessionBestSetVolume = (session) => {
  const sets = session?.sets || [];
  let best = 0;

  for (let i = 0; i < sets.length; i += 1) {
    const set = sets[i];
    if (!isWorkSet(set)) continue;
    const volume = (Number(set.kg) || 0) * (Number(set.reps) || 0);
    if (volume > best) best = volume;
  }

  return best;
};

const sessionsSinceLastImprovement = (series) => {
  if (!Array.isArray(series) || series.length === 0) return 0;

  let runningBest = -Infinity;
  let lastImprovementIndex = -1;

  for (let i = 0; i < series.length; i += 1) {
    const value = Number(series[i]) || 0;
    if (value > runningBest) {
      runningBest = value;
      lastImprovementIndex = i;
    }
  }

  if (lastImprovementIndex === -1) return series.length;
  return Math.max(0, (series.length - 1) - lastImprovementIndex);
};

const getConfidence = (isPlateau, exposuresChecked, staleSessions) => {
  if (exposuresChecked < 3) return 'low';
  if (!isPlateau) return exposuresChecked >= 6 ? 'medium' : 'low';
  if (exposuresChecked >= 8 && staleSessions >= 5) return 'high';
  if (exposuresChecked >= 5 && staleSessions >= 3) return 'medium';
  return 'low';
};

export const detectPlateau = (exerciseId, workouts = [], options = {}) => {
  const settings = { ...DEFAULT_OPTIONS, ...options };

  if (!exerciseId) {
    return {
      isPlateau: false,
      exposuresChecked: 0,
      lastImprovementSessionsAgo: 0,
      stagnationType: 'both',
      confidence: 'low'
    };
  }

  const historyDesc = getExerciseHistory(exerciseId, workouts);
  if (!historyDesc || historyDesc.length === 0) {
    return {
      isPlateau: false,
      exposuresChecked: 0,
      lastImprovementSessionsAgo: 0,
      stagnationType: 'both',
      confidence: 'low'
    };
  }

  const historyAsc = [...historyDesc].reverse(); // oldest -> newest
  const e1rmSeries = historyAsc.map(getSessionBestE1RM);
  const volumeSeries = historyAsc.map(getSessionBestSetVolume);

  const e1rmStale = sessionsSinceLastImprovement(e1rmSeries);
  const volumeStale = sessionsSinceLastImprovement(volumeSeries);
  const exposuresChecked = historyAsc.length;

  const e1rmPlateau = e1rmStale >= settings.minStagnationExposures;
  const volumePlateau = volumeStale >= settings.minStagnationExposures;
  const isPlateau = e1rmPlateau && volumePlateau;

  let stagnationType = 'both';
  if (e1rmPlateau && !volumePlateau) stagnationType = 'e1rm';
  else if (!e1rmPlateau && volumePlateau) stagnationType = 'volume';
  else if (!e1rmPlateau && !volumePlateau) stagnationType = e1rmStale >= volumeStale ? 'e1rm' : 'volume';

  const lastImprovementSessionsAgo =
    stagnationType === 'both'
      ? Math.min(e1rmStale, volumeStale)
      : (stagnationType === 'e1rm' ? e1rmStale : volumeStale);

  return {
    isPlateau,
    exposuresChecked,
    lastImprovementSessionsAgo,
    stagnationType,
    confidence: getConfidence(isPlateau, exposuresChecked, lastImprovementSessionsAgo)
  };
};
