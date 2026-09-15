import { calculateSetVolume } from '../domain/calculations';
import { isWorkSet } from '../domain/workoutExtensions';
import { parseWorkoutDate } from '../domain/dates';

const DAY_MS = 24 * 60 * 60 * 1000;
const RISK_TAGS = new Set(['#sleep-bad', '#stress', '#sick']);

/**
 * Canonical work-volume for one workout (work sets only, bodyweight-aware).
 * Uses calculateSetVolume so readiness can never silently mix warmup-inclusive,
 * work-only, raw-kg or effective-kg semantics. Without exercisesDB/userWeight
 * this reduces exactly to the legacy kg*reps sum (usesBodyweight=false).
 */
const getWorkoutVolume = (workout, exerciseMap, userWeight) => {
  let volume = 0;
  const exercises = workout?.exercises || [];

  for (let i = 0; i < exercises.length; i += 1) {
    const entry = exercises[i];
    const def = entry?.exerciseId != null && exerciseMap
      ? exerciseMap.get(entry.exerciseId)
      : null;
    const opts = { usesBodyweight: Boolean(def?.usesBodyweight), userWeight };
    const sets = entry?.sets || [];
    for (let j = 0; j < sets.length; j += 1) {
      const set = sets[j];
      if (!isWorkSet(set)) continue;
      volume += calculateSetVolume(set, opts);
    }
  }

  return volume;
};

const getPenaltyRate = (riskTagSessions) => {
  if (riskTagSessions <= 0) return 0;
  if (riskTagSessions === 1) return 0.05;
  return 0.1;
};

const getBaseScore = (ratio) => {
  if (!Number.isFinite(ratio) || ratio <= 0) return 45;
  if (ratio < 0.8) return Math.max(40, 75 - ((0.8 - ratio) * 40));
  if (ratio <= 1.2) return Math.max(70, 100 - (Math.abs(1 - ratio) * 120));
  return Math.max(35, 78 - ((ratio - 1.2) * 85));
};

const getStatus = (ratio) => {
  if (!Number.isFinite(ratio) || ratio <= 0) return 'low';
  if (ratio < 0.8) return 'low';
  if (ratio >= 1.3) return 'fatigue';
  return 'optimal';
};

const getSuggestion = (status, penaltyRate) => {
  if (status === 'fatigue') {
    return 'High recent load: keep intensity controlled today and trim accessory volume.';
  }
  if (status === 'low') {
    return 'Load is below baseline: good moment to push quality top sets.';
  }
  if (penaltyRate > 0) {
    return 'Load is in range, but recovery tags detected - use conservative progression today.';
  }
  return 'Readiness looks good: run planned training and progress one key lift.';
};

/**
 * Confidence from evidence depth (canonical NONE/LIMITED/NORMAL/STRONG).
 * Training-load proxy only: few sessions in the 28d baseline mean the ratio
 * is fragile, no matter how decisive the wording sounds.
 */
const getConfidence = (chronicSessions, acuteSessions) => {
  if (chronicSessions <= 0) return 'NONE';
  if (chronicSessions < 4 || acuteSessions <= 0) return 'LIMITED';
  if (chronicSessions >= 8) return 'STRONG';
  return 'NORMAL';
};

const resolveNowMs = (now) => {
  if (now instanceof Date) {
    const t = now.getTime();
    return Number.isFinite(t) ? t : Date.now();
  }
  if (typeof now === 'number' && Number.isFinite(now)) return now;
  if (typeof now === 'string' || typeof now === 'object') {
    const parsed = parseWorkoutDate(now);
    if (parsed) return parsed.getTime();
  }
  return Date.now();
};

/**
 * Training-load proxy (acute:chronic work volume), NOT a physiological or
 * medical measurement. Never emits CNS/overtraining/injury/recovery diagnoses;
 * suggestions speak only about recent volume and effort control.
 *
 * Deterministic when `now` is provided. Coaching V2 MUST pass `now`.
 *
 * Accepts either:
 *   calculateReadiness(workouts, { now, exercisesDB, userWeight })
 *   calculateReadiness({ workouts, now, exercisesDB, userWeight })
 * The legacy single-array call still works (now defaults to Date.now()).
 *
 * Volume is canonical work-effective kg (work sets only, bodyweight-aware).
 * Dates use parseWorkoutDate (legacy date-only strings = local midnight).
 * Future-dated workouts are excluded (not completed history).
 */
export const calculateReadiness = (workoutsOrInput = [], maybeOpts = {}) => {
  const isObjInput = workoutsOrInput && typeof workoutsOrInput === 'object' && !Array.isArray(workoutsOrInput) && !(workoutsOrInput instanceof Date);
  const workouts = Array.isArray(workoutsOrInput)
    ? workoutsOrInput
    : (Array.isArray(workoutsOrInput?.workouts) ? workoutsOrInput.workouts : []);
  const opts = isObjInput ? workoutsOrInput : (maybeOpts && typeof maybeOpts === 'object' ? maybeOpts : {});
  const now = resolveNowMs(opts.now ?? (isObjInput ? undefined : maybeOpts?.now));
  const userWeight = opts.userWeight ?? null;
  const exercisesDB = Array.isArray(opts.exercisesDB) ? opts.exercisesDB : [];
  const exerciseMap = new Map(exercisesDB.map((e) => [e?.id, e]));
  const acuteThreshold = now - (7 * DAY_MS);
  const chronicThreshold = now - (28 * DAY_MS);

  let acuteLoad = 0;
  let chronicTotalLoad = 0;
  let riskTagSessions = 0;
  let acuteSessions = 0;
  let chronicSessions = 0;

  for (let i = 0; i < workouts.length; i += 1) {
    const workout = workouts[i];
    const parsed = parseWorkoutDate(workout?.date);
    const timestamp = parsed ? parsed.getTime() : NaN;
    if (!Number.isFinite(timestamp) || timestamp < chronicThreshold || timestamp > now) continue;

    const volume = getWorkoutVolume(workout, exerciseMap, userWeight);
    chronicTotalLoad += volume;
    chronicSessions += 1;

    if (timestamp >= acuteThreshold) {
      acuteLoad += volume;
      acuteSessions += 1;
      const tags = workout?.tags || [];
      if (tags.some(tag => RISK_TAGS.has(tag))) {
        riskTagSessions += 1;
      }
    }
  }

  // Weekly-equivalent chronic load (28d average mapped to 7d horizon)
  const chronicLoad = chronicTotalLoad > 0 ? chronicTotalLoad / 4 : 0;
  const ratio = chronicLoad > 0 ? acuteLoad / chronicLoad : 0;

  const penaltyRate = getPenaltyRate(riskTagSessions);
  const baseScore = getBaseScore(ratio);
  const readinessScore = Math.round(baseScore * (1 - penaltyRate));
  const status = getStatus(ratio);
  const confidence = getConfidence(chronicSessions, acuteSessions);

  return {
    acuteLoad: Math.round(acuteLoad),
    chronicLoad: Math.round(chronicLoad),
    ratio: Number(ratio.toFixed(2)),
    status,
    suggestion: getSuggestion(status, penaltyRate),
    readinessScore,
    confidence,
    acuteSessions,
    chronicSessions,
    volumeSemantics: 'work-effective-kg',
    generatedAt: new Date(now).toISOString()
  };
};
