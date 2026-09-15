import { calculate1RM, calculateEffectiveKg, calculateSetVolume } from '../domain/calculations';
import { getExerciseHistory } from '../domain/exercises';
import { isWorkSet } from '../domain/workoutExtensions';

const DEFAULT_OPTIONS = {
  minStagnationExposures: 3
};

const getSessionBestE1RM = (session, volOpts = {}) => {
  const sets = session?.sets || [];
  let best = 0;

  for (let i = 0; i < sets.length; i += 1) {
    const set = sets[i];
    if (!isWorkSet(set)) continue;
    // Bodyweight-aware where canonical calculator supports it: effective kg
    // (base + userWeight for usesBodyweight) drives the estimate. Without
    // bodyweight context this reduces exactly to calculate1RM(kg, reps).
    const effectiveKg = calculateEffectiveKg(set, volOpts);
    const e1rm = calculate1RM(effectiveKg, set.reps);
    if (e1rm > best) best = e1rm;
  }

  return best;
};

const getSessionBestSetVolume = (session, volOpts = {}) => {
  const sets = session?.sets || [];
  let best = 0;

  for (let i = 0; i < sets.length; i += 1) {
    const set = sets[i];
    if (!isWorkSet(set)) continue;
    // Canonical work-effective volume (warmups excluded by isWorkSet).
    const volume = calculateSetVolume(set, volOpts);
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

/**
 * Canonical confidence (NONE/LIMITED/NORMAL/STRONG) for Coaching V2.
 * Legacy `confidence` (low/medium/high) is preserved for existing UI.
 */
const getConfidenceV2 = (isPlateau, exposuresChecked, staleSessions) => {
  if (exposuresChecked < 2) return 'NONE';
  if (exposuresChecked < 3) return 'LIMITED';
  if (!isPlateau) return exposuresChecked >= 6 ? 'NORMAL' : 'LIMITED';
  if (exposuresChecked >= 8 && staleSessions >= 5) return 'STRONG';
  if (exposuresChecked >= 5 && staleSessions >= 3) return 'NORMAL';
  return 'LIMITED';
};

const emptyResult = () => ({
  isPlateau: false,
  exposuresChecked: 0,
  lastImprovementSessionsAgo: 0,
  stagnationType: 'both',
  confidence: 'low',
  confidenceV2: 'NONE',
  e1rmBaseline: 0,
  e1rmCurrent: 0,
  volumeBaseline: 0,
  volumeCurrent: 0,
  volumeSemantics: 'work-effective-kg'
});

export const detectPlateau = (exerciseId, workouts = [], options = {}) => {
  const settings = { ...DEFAULT_OPTIONS, ...options };

  if (!exerciseId) {
    return emptyResult();
  }

  const historyDesc = getExerciseHistory(exerciseId, workouts);
  if (!historyDesc || historyDesc.length === 0) {
    return emptyResult();
  }

  // Bodyweight-aware volume opts for this exercise (canonical calculator).
  // Without exercisesDB/userWeight this reduces exactly to legacy kg*reps.
  const exercisesDB = Array.isArray(settings.exercisesDB) ? settings.exercisesDB : [];
  const userWeight = settings.userWeight ?? null;
  const dbDef = exercisesDB.find((e) => e && e.id === exerciseId) || null;
  const volOpts = { usesBodyweight: Boolean(dbDef?.usesBodyweight), userWeight };

  const historyAsc = [...historyDesc].reverse(); // oldest -> newest
  const e1rmSeries = historyAsc.map((s) => getSessionBestE1RM(s, volOpts));
  const volumeSeries = historyAsc.map((s) => getSessionBestSetVolume(s, volOpts));

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

  const confidence = getConfidence(isPlateau, exposuresChecked, lastImprovementSessionsAgo);
  return {
    isPlateau,
    exposuresChecked,
    lastImprovementSessionsAgo,
    stagnationType,
    confidence,
    confidenceV2: getConfidenceV2(isPlateau, exposuresChecked, lastImprovementSessionsAgo),
    e1rmBaseline: e1rmSeries.length ? Math.max(...e1rmSeries) : 0,
    e1rmCurrent: e1rmSeries.length ? e1rmSeries[e1rmSeries.length - 1] : 0,
    volumeBaseline: volumeSeries.length ? Math.max(...volumeSeries) : 0,
    volumeCurrent: volumeSeries.length ? volumeSeries[volumeSeries.length - 1] : 0,
    volumeSemantics: 'work-effective-kg'
  };
};
