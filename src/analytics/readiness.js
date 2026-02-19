import { isWorkSet } from '../domain/workoutExtensions';

const DAY_MS = 24 * 60 * 60 * 1000;
const RISK_TAGS = new Set(['#sleep-bad', '#stress', '#sick']);

const getWorkoutVolume = (workout) => {
  let volume = 0;
  const exercises = workout?.exercises || [];

  for (let i = 0; i < exercises.length; i += 1) {
    const sets = exercises[i]?.sets || [];
    for (let j = 0; j < sets.length; j += 1) {
      const set = sets[j];
      if (!isWorkSet(set)) continue;
      volume += (Number(set.kg) || 0) * (Number(set.reps) || 0);
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

export const calculateReadiness = (workouts = []) => {
  const now = Date.now();
  const acuteThreshold = now - (7 * DAY_MS);
  const chronicThreshold = now - (28 * DAY_MS);

  let acuteLoad = 0;
  let chronicTotalLoad = 0;
  let riskTagSessions = 0;

  for (let i = 0; i < workouts.length; i += 1) {
    const workout = workouts[i];
    const timestamp = new Date(workout?.date).getTime();
    if (!Number.isFinite(timestamp) || timestamp < chronicThreshold || timestamp > now) continue;

    const volume = getWorkoutVolume(workout);
    chronicTotalLoad += volume;

    if (timestamp >= acuteThreshold) {
      acuteLoad += volume;
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

  return {
    acuteLoad: Math.round(acuteLoad),
    chronicLoad: Math.round(chronicLoad),
    ratio: Number(ratio.toFixed(2)),
    status,
    suggestion: getSuggestion(status, penaltyRate),
    readinessScore
  };
};
