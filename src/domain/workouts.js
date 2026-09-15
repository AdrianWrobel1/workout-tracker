/**
 * Workout-related domain logic
 */
import { isWorkSet, resolveSetType } from './workoutExtensions';
import { calculate1RM as canonical1RM, calculateSetVolume, calculateWorkoutWorkVolume } from './calculations';
import {
  MUSCLE_AXES,
  categoryToAxes,
  resolveAttribution,
  attributeAmount,
} from './muscles';

/**
 * Get previous sets from template's last workout snapshot (for prev/suggestions per template).
 * Template.lastWorkoutSnapshot = { date, exercises: [{ exerciseId, name, sets: [{ kg, reps }] }] }.
 */
export const getPreviousSetsFromTemplate = (template, exerciseId) => {
  if (!exerciseId || !template?.lastWorkoutSnapshot?.exercises) return [];
  const ex = template.lastWorkoutSnapshot.exercises.find(e => e.exerciseId === exerciseId);
  if (!ex?.sets?.length) return [];
  const aligned = ex.sets.map(s => (s.kg != null || s.reps != null) ? { kg: Number(s.kg) || 0, reps: Number(s.reps) || 0 } : null);
  if (aligned.some(a => a !== null)) return aligned;
  return [];
};

/**
 * Get previous sets for an exercise. If templateLastSnapshot is provided (from template.lastWorkoutSnapshot),
 * use that first (prev per template); otherwise use global workout history.
 */
export const getPreviousSets = (exerciseId, workouts, excludeStartTime = null, templateLastSnapshot = null) => {
  if (!exerciseId) return [];

  // Prefer template's last workout (prev per template: Pull A vs Pull B)
  if (templateLastSnapshot?.exercises) {
    const ex = templateLastSnapshot.exercises.find(e => e.exerciseId === exerciseId);
    if (ex?.sets?.length) {
      const aligned = ex.sets.map(s => (s.kg != null || s.reps != null) ? { kg: Number(s.kg) || 0, reps: Number(s.reps) || 0 } : null);
      if (aligned.some(a => a !== null)) return aligned;
    }
  }

  const relevantWorkouts = workouts
    .filter(w => {
      if (excludeStartTime && w.startTime === excludeStartTime) return false;
      return w.exercises?.some(ex => ex.exerciseId === exerciseId);
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  for (const w of relevantWorkouts) {
    const ex = w.exercises.find(e => e.exerciseId === exerciseId);
    if (!ex) continue;

    const aligned = ex.sets.map(s => (isWorkSet(s)) ? { kg: s.kg, reps: s.reps } : null);
    if (aligned.some(a => a !== null)) return aligned;
  }

  return [];
};

/**
 * Build snapshot of completed sets for template.lastWorkoutSnapshot (prev per template).
 * Only completed, non-warmup sets; used to suggest weights next time this template is run.
 */
export const buildLastWorkoutSnapshot = (completedWorkout) => {
  if (!completedWorkout?.exercises) return null;
  return {
    date: completedWorkout.date,
    exercises: (completedWorkout.exercises || [])
      .map(ex => ({
        exerciseId: ex.exerciseId,
        name: ex.name,
        sets: (ex.sets || []).filter(s => isWorkSet(s)).map(s => ({ kg: Number(s.kg) || 0, reps: Number(s.reps) || 0 }))
      }))
      .filter(ex => ex.sets.length > 0)
  };
};

export const getWeekWorkouts = (workouts) => {
  const now = new Date();
  // calculate start of current ISO week (Monday) in local time
  const weekStart = new Date(now);
  const day = (now.getDay() + 6) % 7; // Monday=0, Sunday=6
  weekStart.setDate(now.getDate() - day);
  weekStart.setHours(0, 0, 0, 0);

  return workouts.filter(w => {
    // prefer date string but fall back to startTime
    const d = w.date ? new Date(w.date) : (w.startTime ? new Date(w.startTime) : null);
    if (!d) return false;
    return d >= weekStart;
  });
};

export const getMonthWorkouts = (workouts, monthOffset = 0) => {
  const target = new Date();
  target.setMonth(target.getMonth() + monthOffset);
  const month = target.getMonth();
  const year = target.getFullYear();

  return workouts.filter(w => {
    const d = new Date(w.date);
    return d.getMonth() === month && d.getFullYear() === year;
  });
};

export const getMonthLabel = (offset = 0) => {
  const date = new Date();
  date.setMonth(date.getMonth() + offset);
  return date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
};

// Prepare clean workout data for summary (without UI)
// CANONICAL: work-sets only, bodyweight-aware (same as Session/History/Stats).
// Total delegates to calculateWorkoutWorkVolume so Finish can never diverge
// from Session Detail for the same workout. userWeight defaults to null to
// preserve legacy base-kg behavior when bodyweight context is unavailable.
export const prepareCleanWorkoutData = (workout, exercisesDB = [], userWeight = null) => {
  const totalVolume = calculateWorkoutWorkVolume(workout, exercisesDB, userWeight);
  let completedSets = 0;
  // Stable 7-axis shape (missing = 0, never undefined); unknown → nothing.
  const volumePerMuscle = Object.fromEntries(MUSCLE_AXES.map((axis) => [axis, 0]));
  const exerciseMap = new Map((Array.isArray(exercisesDB) ? exercisesDB : []).map((e) => [e?.id, e]));

  (workout.exercises || []).forEach(ex => {
    const exDef = exerciseMap.get(ex.exerciseId) || {};
    const usesBodyweight = Boolean(exDef?.usesBodyweight);
    // Canonical attribution (weighted exposure per axis; unknown → nothing).
    // Raw category strings never leak in as muscle keys anymore.
    const resolution = resolveAttribution(ex, exerciseMap);

    (ex.sets || []).forEach(s => {
      if (isWorkSet(s)) {
        const volume = calculateSetVolume(s, { usesBodyweight, userWeight });
        completedSets += 1;

        const attributed = attributeAmount(resolution, volume);
        for (const [muscle, value] of Object.entries(attributed)) {
          volumePerMuscle[muscle] = (volumePerMuscle[muscle] || 0) + value;
        }
      }
    });
  });
  
  // Use calculated muscle distribution for radar
  const radarData = calculateMuscleDistribution(workout, exercisesDB);
  
  return {
    totalVolume,
    completedSets,
    volumePerMuscle,
    radarData
  };
};

// Compare workout to previous workout
// CANONICAL: optional { exercisesDB, userWeight } makes the comparison
// bodyweight-aware (same as Session/History/Stats). Omitted → legacy base-kg
// for backward compatibility (existing callers/tests with 2 args unchanged).
export const compareWorkoutToPrevious = (currentWorkout, allWorkouts, opts = {}) => {
  const filtered = allWorkouts.filter(w => new Date(w.date) < new Date(currentWorkout.date)).sort((a, b) => new Date(b.date) - new Date(a.date));
  if (filtered.length === 0) return null;

  const prevWorkout = filtered[0];
  const exercisesDB = Array.isArray(opts?.exercisesDB) ? opts.exercisesDB : null;
  const userWeight = opts?.userWeight ?? null;

  // Calculate volume for both
  const getVolume = (w) => {
    if (exercisesDB) return calculateWorkoutWorkVolume(w, exercisesDB, userWeight);
    let vol = 0;
    (w.exercises || []).forEach(ex => {
      (ex.sets || []).forEach(s => {
        if (isWorkSet(s)) {
          vol += (Number(s.kg) || 0) * (Number(s.reps) || 0);
        }
      });
    });
    return vol;
  };
  
  const currentVol = getVolume(currentWorkout);
  const prevVol = getVolume(prevWorkout);
  
  let trend = 'flat';
  if (currentVol > prevVol * 1.05) trend = 'up';
  else if (currentVol < prevVol * 0.95) trend = 'down';
  
  return { trend, prevVolume: prevVol, currentVolume: currentVol };
};

// Generate session feedback text
export const generateSessionFeedback = (volume, sets, trend) => {
  const volumeLevel = volume > 10000 ? 'crushing' : volume > 5000 ? 'solid' : volume > 2000 ? 'decent' : 'light';
  const setsLevel = sets > 20 ? 'epic' : sets > 12 ? 'good' : sets > 6 ? 'balanced' : 'quick';

  const texts = {
    crushing: {
      epic: '\u{1F4AA} Beast mode activated',
      good: '\u{1F525} Solid work ethic',
      balanced: '\u26A1 Quality volume',
      quick: '\u{1F3AF} Intense focus'
    },
    solid: {
      epic: '\u{1F3CB} Great grind',
      good: '\u2705 Solid session',
      balanced: '\u{1F4AF} Perfect balance',
      quick: '\u2699 Efficient'
    },
    decent: {
      epic: '\u{1F44D} Nice effort',
      good: '\u{1F3AF} On point',
      balanced: '\u2728 Consistent',
      quick: '\u{1F680} Quick one'
    },
    light: {
      epic: '\u{1F331} Building',
      good: '\u{1F4C8} Getting going',
      balanced: '\u{1F31F} Getting warmed',
      quick: '\u{1F4AB} Starter session'
    }
  };

  const text = texts[volumeLevel]?.[setsLevel] || '\u{1F4AA} Keep moving';
  const trendIcon = trend === 'up' ? ' \u{1F680}' : trend === 'down' ? ' \u26A0\uFE0F' : '';

  return text + trendIcon;
};

const getCompletedVolume = (workout) => {
  let volume = 0;
  (workout?.exercises || []).forEach(ex => {
    (ex.sets || []).forEach(set => {
      if (!isWorkSet(set)) return;
      volume += (Number(set.kg) || 0) * (Number(set.reps) || 0);
    });
  });
  return volume;
};

const getPreviousWorkout = (currentWorkout, allWorkouts = []) => {
  if (!currentWorkout?.date) return null;
  const currentDate = new Date(currentWorkout.date);
  const filtered = (allWorkouts || [])
    .filter(w => new Date(w.date) < currentDate)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  return filtered[0] || null;
};

const getBestSetByEstimated1RM = (workout) => {
  let best = null;
  (workout?.exercises || []).forEach(ex => {
    (ex.sets || []).forEach(set => {
      if (!isWorkSet(set)) return;
      const kg = Number(set.kg) || 0;
      const reps = Number(set.reps) || 0;
      if (kg <= 0 || reps <= 0) return;
      const estimated1RM = canonical1RM(kg, reps);
      if (!best || estimated1RM > best.estimated1RM) {
        best = {
          exerciseId: ex.exerciseId || null,
          exerciseName: ex.name || 'Exercise',
          estimated1RM,
          kg,
          reps
        };
      }
    });
  });
  return best;
};

const getExerciseWorkVolume = (exercise) => {
  return (exercise?.sets || []).reduce((sum, set) => {
    if (!isWorkSet(set)) return sum;
    return sum + (Number(set.kg) || 0) * (Number(set.reps) || 0);
  }, 0);
};
const getPlannedWorkSets = (workout) => {
  let count = 0;
  (workout?.exercises || []).forEach((exercise) => {
    (exercise?.sets || []).forEach((set) => {
      if (resolveSetType(set) !== 'warmup') count += 1;
    });
  });
  return count;
};

const getCompletedWorkSetsCount = (workout) => {
  let count = 0;
  (workout?.exercises || []).forEach((exercise) => {
    (exercise?.sets || []).forEach((set) => {
      if (isWorkSet(set)) count += 1;
    });
  });
  return count;
};

const getTopVolumeExercise = (workout) => {
  let winner = null;
  (workout?.exercises || []).forEach((exercise) => {
    const volume = getExerciseWorkVolume(exercise);
    if (volume <= 0) return;
    if (!winner || volume > winner.volume) {
      winner = {
        exerciseName: exercise?.name || 'Exercise',
        volume
      };
    }
  });
  return winner;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const findMostRegressedExercise = (currentWorkout, previousWorkout) => {
  if (!currentWorkout?.exercises?.length || !previousWorkout?.exercises?.length) return null;

  const prevByKey = new Map();
  (previousWorkout.exercises || []).forEach(ex => {
    const key = ex.exerciseId || ex.name;
    if (!key) return;
    prevByKey.set(key, ex);
  });

  let regressed = null;

  (currentWorkout.exercises || []).forEach(ex => {
    const key = ex.exerciseId || ex.name;
    if (!key || !prevByKey.has(key)) return;

    const prevEx = prevByKey.get(key);
    const prevVolume = getExerciseWorkVolume(prevEx);
    const currentVolume = getExerciseWorkVolume(ex);
    if (prevVolume <= 0) return;

    const deltaRatio = (currentVolume - prevVolume) / prevVolume;
    if (deltaRatio < -0.1 && (!regressed || deltaRatio < regressed.deltaRatio)) {
      regressed = {
        exerciseName: ex.name || 'Exercise',
        deltaRatio,
        currentVolume,
        prevVolume
      };
    }
  });

  return regressed;
};

const calculateActionCertainty = (currentWorkout, allWorkouts = []) => {
  const exerciseMap = new Map();
  (currentWorkout?.exercises || []).forEach((exercise, index) => {
    const exerciseId = exercise?.exerciseId;
    if (!exerciseId || exerciseMap.has(exerciseId)) return;
    exerciseMap.set(exerciseId, exercise?.name || `Exercise ${index + 1}`);
  });

  const exerciseIds = [...exerciseMap.keys()];

  if (exerciseIds.length === 0) {
    return {
      level: 'low',
      score: 22,
      label: 'Low evidence',
      reason: 'No tracked exercise history available for this session.',
      exposures: {
        trackedExercises: 0,
        average: 0,
        min: 0,
        max: 0,
        total: 0
      },
      decay: {
        staleExercises: 0,
        averageMultiplier: 1
      },
      perExercise: []
    };
  }

  const parseWorkoutDate = (workout) => {
    const dateString = workout?.date
      || (workout?.startTime ? new Date(workout.startTime).toISOString().split('T')[0] : null);
    if (!dateString) return null;
    const parsed = new Date(`${dateString}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  };

  const getDecayMultiplier = (daysSinceLastExposure) => {
    if (!Number.isFinite(daysSinceLastExposure)) return 0.74;
    if (daysSinceLastExposure <= 10) return 1;
    if (daysSinceLastExposure <= 21) return 0.94;
    if (daysSinceLastExposure <= 35) return 0.87;
    if (daysSinceLastExposure <= 56) return 0.8;
    return 0.72;
  };

  const resolveLevel = (score) => {
    if (score >= 74) return 'high';
    if (score >= 46) return 'medium';
    return 'low';
  };

  const target = new Set(exerciseIds);
  const counts = new Map(exerciseIds.map(id => [id, 0]));
  const lastExposureById = new Map(exerciseIds.map(id => [id, null]));
  const currentDate = parseWorkoutDate(currentWorkout) || new Date();

  (allWorkouts || []).forEach((workout) => {
    if (!workout?.exercises?.length) return;
    if (currentWorkout?.id && workout.id === currentWorkout.id) return;
    if (currentWorkout?.startTime && workout.startTime && workout.startTime === currentWorkout.startTime) return;

    const workoutDate = parseWorkoutDate(workout);
    if (!workoutDate || workoutDate >= currentDate) return;

    const seenInWorkout = new Set();
    (workout.exercises || []).forEach((exercise) => {
      const exId = exercise?.exerciseId;
      if (!exId || !target.has(exId) || seenInWorkout.has(exId)) return;
      if ((exercise?.sets || []).some(set => isWorkSet(set))) {
        counts.set(exId, (counts.get(exId) || 0) + 1);
        seenInWorkout.add(exId);

        const previousDate = lastExposureById.get(exId);
        if (!previousDate || workoutDate > previousDate) {
          lastExposureById.set(exId, workoutDate);
        }
      }
    });
  });

  const perExercise = exerciseIds.map((exerciseId) => {
    const exposures = counts.get(exerciseId) || 0;
    const lastExposureDate = lastExposureById.get(exerciseId);
    const daysSinceLastExposure = lastExposureDate
      ? Math.max(0, Math.floor((currentDate.getTime() - lastExposureDate.getTime()) / 86400000))
      : null;
    const decayMultiplier = getDecayMultiplier(daysSinceLastExposure);

    const baseScore = clamp(
      Math.round(24 + (Math.min(exposures, 12) * 6.5) + (exposures >= 6 ? 6 : 0)),
      20,
      96
    );
    const score = clamp(Math.round(baseScore * decayMultiplier), 15, 96);
    const level = resolveLevel(score);

    let reason = 'Reliable enough to drive progression decisions.';
    if (exposures === 0) {
      reason = 'No prior exposure. Confidence is low.';
    } else if (!Number.isFinite(daysSinceLastExposure)) {
      reason = 'History found, but recency could not be resolved.';
    } else if (daysSinceLastExposure > 35) {
      reason = `Stale exposure (${daysSinceLastExposure}d gap) lowers confidence.`;
    } else if (daysSinceLastExposure > 21) {
      reason = `Moderate decay applied (${daysSinceLastExposure}d since last exposure).`;
    }

    return {
      exerciseId,
      exerciseName: exerciseMap.get(exerciseId) || 'Exercise',
      exposures,
      lastExposureDays: daysSinceLastExposure,
      decayMultiplier: Math.round(decayMultiplier * 100) / 100,
      score,
      level,
      reason
    };
  });

  const exposureValues = perExercise.map(item => item.exposures);
  const total = exposureValues.reduce((sum, value) => sum + value, 0);
  const average = exposureValues.length > 0 ? total / exposureValues.length : 0;
  const min = exposureValues.length > 0 ? Math.min(...exposureValues) : 0;
  const max = exposureValues.length > 0 ? Math.max(...exposureValues) : 0;

  const staleExercises = perExercise.filter(item => Number.isFinite(item.lastExposureDays) && item.lastExposureDays > 21).length;
  const averageMultiplier = perExercise.length > 0
    ? perExercise.reduce((sum, item) => sum + (item.decayMultiplier || 1), 0) / perExercise.length
    : 1;
  const avgPerExerciseScore = perExercise.length > 0
    ? perExercise.reduce((sum, item) => sum + item.score, 0) / perExercise.length
    : 22;

  let score = Math.round(
    (avgPerExerciseScore * 0.78)
    + (average * 5)
    + (Math.min(min, 4) * 2)
    + (staleExercises === 0 ? 6 : 0)
    - (staleExercises * 3)
  );
  if (min === 0) score -= 8;
  score = clamp(score, 18, 96);

  const level = resolveLevel(score);
  const label = level === 'high' ? 'High evidence' : level === 'medium' ? 'Medium evidence' : 'Low evidence';

  let reason = 'Recommendations are based on limited exposure history.';
  if (level === 'high') {
    reason = staleExercises > 0
      ? `Strong data coverage, with light decay on ${staleExercises} exercise${staleExercises === 1 ? '' : 's'}.`
      : 'Recommendations are backed by deep and recent exposure history.';
  } else if (level === 'medium') {
    reason = staleExercises > 0
      ? `Directionally reliable, but confidence decays on ${staleExercises} stale exposure${staleExercises === 1 ? '' : 's'}.`
      : 'Recommendations are directionally reliable with moderate history.';
  }

  return {
    level,
    score,
    label,
    reason,
    exposures: {
      trackedExercises: exposureValues.length,
      average: Math.round(average * 10) / 10,
      min,
      max,
      total
    },
    decay: {
      staleExercises,
      averageMultiplier: Math.round(averageMultiplier * 100) / 100
    },
    perExercise
  };
};

/**
 * Deterministic post-workout insight card.
 * Returns exactly three short sentences:
 * 1) what went well, 2) what slowed down, 3) what to change next.
 */
export const generatePostWorkoutInsights = (
  currentWorkout,
  allWorkouts = [],
  comparison = null,
  prStatus = {},
  getExerciseRecords = null
) => {
  if (!currentWorkout) {
    return {
      win: 'No workout data available.',
      slowdown: 'No slowdown signal detected.',
      next: 'Run one more session to unlock actionable insights.'
    };
  }

  const effectiveComparison = comparison || compareWorkoutToPrevious(currentWorkout, allWorkouts);
  const previousWorkout = getPreviousWorkout(currentWorkout, allWorkouts);
  const currentVolume = getCompletedVolume(currentWorkout);
  const prevVolume = effectiveComparison?.prevVolume || 0;
  const volumeDelta = currentVolume - prevVolume;
  const volumeDeltaPercent = prevVolume > 0 ? Math.round((volumeDelta / prevVolume) * 100) : 0;

  const prCount = Object.keys(prStatus || {}).length;
  const topSet = getBestSetByEstimated1RM(currentWorkout);

  let win = `Completed ${currentVolume.toLocaleString()} total volume.`;
  if (prCount > 0) {
    win = `Hit ${prCount} new ${prCount === 1 ? 'PR' : 'PRs'} in this session.`;
  } else if (topSet && typeof getExerciseRecords === 'function' && topSet.exerciseId) {
    const previousRecords = getExerciseRecords(topSet.exerciseId, allWorkouts);
    const previousBest = Number(previousRecords?.best1RM) || 0;
    if (topSet.estimated1RM > previousBest) {
      win = `${topSet.exerciseName}: estimated 1RM up to ${topSet.estimated1RM} kg (${topSet.kg} x ${topSet.reps}).`;
    }
  } else if (effectiveComparison && volumeDeltaPercent > 5) {
    win = `Volume increased by ${Math.abs(volumeDeltaPercent)}% vs previous session.`;
  }

  const regressedExercise = findMostRegressedExercise(currentWorkout, previousWorkout);
  let slowdown = 'No major slowdown detected versus your previous session.';
  if (effectiveComparison && volumeDeltaPercent < -5) {
    slowdown = `Total volume dropped by ${Math.abs(volumeDeltaPercent)}% vs previous session.`;
  } else if (regressedExercise) {
    slowdown = `${regressedExercise.exerciseName} volume was lower than last time.`;
  }

  let next = 'Next session: repeat the main lifts and add a small load (+2.5 kg) where reps stay clean.';
  if (effectiveComparison && volumeDeltaPercent < -5) {
    next = 'Next session: keep current load, trim 1 accessory set, and focus on matching last session volume.';
  } else if (regressedExercise) {
    next = `Next session: keep ${regressedExercise.exerciseName} load stable and aim for +1-2 reps on the first work set.`;
  } else if (prCount > 0) {
    next = 'Next session: keep the same opener and progress only one top set to lock in today\'s PR pace.';
  }

  return { win, slowdown, next };
};

/**
 * Coach Lens card (offline, deterministic).
 * Expanded structure with actionable next-session planning while keeping
 * keep/improve/focus compatibility for existing UI.
 */
export const generateCoachLens = (
  currentWorkout,
  allWorkouts = [],
  comparison = null,
  prStatus = {}
) => {
  if (!currentWorkout) {
    return {
      headline: 'Not enough data yet.',
      status: 'build',
      confidence: 'low',
      scores: {
        progression: 0,
        execution: 0,
        fatigueRisk: 0
      },
      scoreLegend: {
        progression: 'Output trend vs your previous exposure and PR momentum.',
        execution: 'How much planned work was completed with usable density.',
        fatigueRisk: 'Probability of next-session drop from load, duration, and slowdown signals.'
      },
      snapshot: {
        volume: 0,
        volumeDeltaPct: 0,
        completedWorkSets: 0,
        plannedWorkSets: 0,
        completionPct: 0,
        density: 0,
        prCount: 0
      },
      highlights: ['No workout data yet.'],
      risks: ['No slowdown pattern detected.'],
      nextSessionPlan: ['Complete one full session to unlock Coach Lens.'],
      keep: 'No workout data yet.',
      improve: 'No slowdown pattern detected.',
      focus: 'Complete one full session to unlock Coach Lens.',
      actionCertainty: {
        level: 'low',
        score: 22,
        label: 'Low evidence',
        reason: 'No tracked exercise history available for this session.',
        exposures: { trackedExercises: 0, average: 0, min: 0, max: 0, total: 0 },
        decay: { staleExercises: 0, averageMultiplier: 1 },
        perExercise: []
      }
    };
  }

  const effectiveComparison = comparison || compareWorkoutToPrevious(currentWorkout, allWorkouts);
  const previousWorkout = getPreviousWorkout(currentWorkout, allWorkouts);
  const regressedExercise = findMostRegressedExercise(currentWorkout, previousWorkout);
  const topSet = getBestSetByEstimated1RM(currentWorkout);
  const topVolumeExercise = getTopVolumeExercise(currentWorkout);

  const currentVolume = getCompletedVolume(currentWorkout);
  const prevVolume = Number(effectiveComparison?.prevVolume) || 0;
  const deltaPct = prevVolume > 0 ? Math.round(((currentVolume - prevVolume) / prevVolume) * 100) : 0;

  const plannedWorkSets = getPlannedWorkSets(currentWorkout);
  const completedWorkSets = getCompletedWorkSetsCount(currentWorkout);
  const completionPct = plannedWorkSets > 0 ? Math.round((completedWorkSets / plannedWorkSets) * 100) : 100;

  const durationMin = Math.max(1, Number(currentWorkout?.duration) || 0);
  const density = Math.round(currentVolume / durationMin);
  const prCount = Object.keys(prStatus || {}).length;

  const progressionScore = clamp(
    50 + (deltaPct >= 0 ? Math.min(deltaPct, 18) : Math.max(deltaPct, -18)) + prCount * 10 - (regressedExercise ? 8 : 0),
    0,
    100
  );
  const executionScore = clamp(
    Math.round((completionPct * 0.78) + Math.min(22, density / 25)),
    0,
    100
  );
  const fatigueRiskScore = clamp(
    15 + (deltaPct > 18 ? 22 : 0) + (completionPct < 70 ? 14 : 0) + (durationMin > 95 ? 10 : 0) + (regressedExercise ? 8 : 0) - (prCount > 0 ? 6 : 0),
    0,
    100
  );

  let status = 'steady';
  if (fatigueRiskScore >= 62) {
    status = 'recover';
  } else if (progressionScore >= 72 && fatigueRiskScore <= 42) {
    status = 'push';
  }

  let confidence = 'low';
  if (allWorkouts.length >= 10) confidence = 'high';
  else if (allWorkouts.length >= 4) confidence = 'medium';
  const actionCertainty = calculateActionCertainty(currentWorkout, allWorkouts);

  const highlights = [];
  if (prCount > 0) highlights.push(`Hit ${prCount} new ${prCount === 1 ? 'PR' : 'PRs'} this session.`);
  if (deltaPct >= 6) highlights.push(`Total work volume is up ${Math.abs(deltaPct)}% vs previous session.`);
  if (completionPct >= 90) highlights.push(`Execution quality: ${completedWorkSets}/${plannedWorkSets} planned work sets completed.`);
  if (topSet?.exerciseName) highlights.push(`Top set quality: ${topSet.exerciseName} at ${topSet.kg} kg x ${topSet.reps} reps.`);
  if (topVolumeExercise?.exerciseName) highlights.push(`Most productive lift: ${topVolumeExercise.exerciseName} (${topVolumeExercise.volume.toLocaleString()} volume).`);
  if (highlights.length === 0) highlights.push('Session completed with stable baseline output.');

  const risks = [];
  if (deltaPct <= -6) risks.push(`Volume dropped ${Math.abs(deltaPct)}% vs previous session.`);
  if (completionPct < 75) risks.push(`Only ${completedWorkSets}/${plannedWorkSets} work sets were completed.`);
  if (regressedExercise?.exerciseName) {
    risks.push(`${regressedExercise.exerciseName} underperformed versus your last exposure.`);
  }
  if (durationMin > 95 && completionPct < 85) {
    risks.push('Session ran long with reduced completion quality.');
  }
  if (risks.length === 0) risks.push('No critical slowdown signals detected.');

  const nextSessionPlan = [];
  if (status === 'push') {
    nextSessionPlan.push('Progress only one top set by +2.5 kg, keep all other loads unchanged.');
  } else if (status === 'recover') {
    nextSessionPlan.push('Keep compound loads stable and target cleaner reps before adding weight.');
  } else {
    nextSessionPlan.push('Repeat current loads and add +1 rep on the first two work sets.');
  }

  if (deltaPct > 15) {
    nextSessionPlan.push('Trim one accessory work set to protect quality and recovery.');
  } else if (deltaPct <= -6) {
    nextSessionPlan.push('Rebuild previous session volume first (within +/-5%).');
  } else {
    nextSessionPlan.push('Keep total work-set count in the same range as this session.');
  }

  if (regressedExercise?.exerciseName) {
    nextSessionPlan.push(`Open next session with ${regressedExercise.exerciseName} and match first-set output.`);
  } else if (topSet?.exerciseName) {
    nextSessionPlan.push(`Anchor progression on ${topSet.exerciseName}; only progress if reps stay clean.`);
  } else {
    nextSessionPlan.push('Pick one priority exercise and lock in its first work set quality.');
  }

  const headline = status === 'push'
    ? 'High momentum session. Push selectively next workout.'
    : status === 'recover'
    ? 'Fatigue signal detected. Stabilize quality next workout.'
    : 'Steady session quality. Build with controlled progression.';

  const keep = highlights[0] || 'Keep main lift setup consistent.';
  const improve = risks[0] || 'No clear weak point this session.';
  const focus = nextSessionPlan[0] || 'Add +1 rep on one priority lift next session.';

  return {
    headline,
    status,
    confidence,
    scores: {
      progression: progressionScore,
      execution: executionScore,
      fatigueRisk: fatigueRiskScore
    },
    scoreLegend: {
      progression: 'Output trend vs your previous exposure and PR momentum.',
      execution: 'How much planned work was completed with usable density.',
      fatigueRisk: 'Probability of next-session drop from load, duration, and slowdown signals.'
    },
    snapshot: {
      volume: currentVolume,
      volumeDeltaPct: deltaPct,
      completedWorkSets,
      plannedWorkSets,
      completionPct,
      density,
      prCount
    },
    highlights,
    risks,
    nextSessionPlan,
    keep,
    improve,
    focus,
    actionCertainty
  };
};

// Map category names to actual muscle groups.
// Thin compat wrapper over the canonical taxonomy (domain/muscles):
// same contract as before, with the Core fix ('Core' → Core, not Other).
export const mapCategoryToMuscles = (category) => categoryToAxes(category);

// Calculate muscle distribution for radar - includes COMPLETED sets only.
// Canonical weighted exposure per axis (primary 1.0, secondary 0.5).
// Unknown exercises are excluded honestly — never smeared across all axes.
export const calculateMuscleDistribution = (workout, exercisesDB = []) => {
  const muscleVolumes = Object.fromEntries(MUSCLE_AXES.map((axis) => [axis, 0]));

  const exerciseMap = new Map((Array.isArray(exercisesDB) ? exercisesDB : []).map((e) => [e?.id, e]));

  (workout.exercises || []).forEach(ex => {
    // Canonical attribution for this exercise (no screen-specific logic).
    const resolution = resolveAttribution(ex, exerciseMap);

    // Calculate volume for this exercise (completed sets only, exclude warmups)
    let exVolume = 0;
    (ex.sets || []).forEach(s => {
      if (isWorkSet(s)) {
        const kg = Number(s.kg) || 0;
        const reps = Number(s.reps) || 0;
        exVolume += kg * reps;
      }
    });

    // Attribute weighted volume to each resolved muscle (unknown → nothing).
    const attributed = attributeAmount(resolution, exVolume);
    for (const [muscle, value] of Object.entries(attributed)) {
      if (muscleVolumes[muscle] !== undefined) muscleVolumes[muscle] += value;
    }
  });

  // Normalize to 0-1 range
  const max = Math.max(...Object.values(muscleVolumes), 1);
  const normalized = {};
  MUSCLE_AXES.forEach(axis => {
    normalized[axis] = muscleVolumes[axis] / max;
  });

  return normalized;
};

/**
 * Detect PRs (Personal Records) in a completed workout
 * Tracks 3 independent record types per set: Best 1RM, Best Set Volume, Heaviest Weight
 * Only detects on 2nd+ workout for each exercise (skip if first time)
 * Returns: { exerciseId: { recordTypes: ['best1RM', 'bestSetVolume', 'heaviestWeight'], exerciseName: string } }
 * Note: Needs calculate1RM and getExerciseRecords passed as parameters to avoid circular imports
 */
export const detectPRsInWorkout = (completedWorkout, previousWorkouts, calculate1RM, getExerciseRecords) => {
  if (!completedWorkout?.exercises) return {};

  const prDetected = {};

  completedWorkout.exercises.forEach(ex => {
    if (!ex.exerciseId) return;

    // Get historical records (only from PREVIOUS workouts, not current)
    const previousRecords = getExerciseRecords(ex.exerciseId, previousWorkouts);
    
    // Skip PR detection if exercise never done before (first time = baseline only)
    if (!previousRecords.best1RM && !previousRecords.heaviestWeight && !previousRecords.bestSetVolume) {
      return;
    }

    const recordTypesThisExercise = new Set();
    const recordTypesPerSet = {};

    // Check all completed sets (excluding warmups)
    (ex.sets || []).forEach((set, setIndex) => {
      if (!isWorkSet(set)) return;

      const kg = Number(set.kg) || 0;
      const reps = Number(set.reps) || 0;

      if (kg === 0 || reps === 0) return;

      const this1RM = calculate1RM(kg, reps);
      const thisVolume = kg * reps;

      const recordsThisSet = [];

      // Check for 3 independent record types
      if (this1RM > (previousRecords.best1RM || 0)) {
        recordsThisSet.push('best1RM');
        recordTypesThisExercise.add('best1RM');
        set.isBest1RM = true;
      }
      
      if (thisVolume > (previousRecords.bestSetVolume || 0)) {
        recordsThisSet.push('bestSetVolume');
        recordTypesThisExercise.add('bestSetVolume');
        set.isBestSetVolume = true;
      }
      
      if (kg > (previousRecords.heaviestWeight || 0)) {
        recordsThisSet.push('heaviestWeight');
        recordTypesThisExercise.add('heaviestWeight');
        set.isHeaviestWeight = true;
      }

      if (recordsThisSet.length > 0) {
        recordTypesPerSet[setIndex] = recordsThisSet;
      }
    });

    // Only add to prDetected if records were found
    if (recordTypesThisExercise.size > 0) {
      prDetected[ex.exerciseId] = {
        exerciseName: ex.name,
        recordTypes: Array.from(recordTypesThisExercise),
        recordsPerSet: recordTypesPerSet
      };
    }
  });

  return prDetected;
};

/**
 * Anomaly Detection
 * Detects unusual patterns in current workout vs historical baseline
 * Returns: { anomalies: [...], severity: 'none'|'low'|'medium'|'high', flags: [...] }
 */
export const detectAnomalies = (currentWorkout, allWorkouts = []) => {
  const anomalies = [];
  const flags = [];

  if (!currentWorkout) {
    return { anomalies: [], severity: 'none', flags: [] };
  }

  if (allWorkouts.length < 3) {
    return { anomalies: [], severity: 'none', flags: ['Insufficient history for anomaly detection.'] };
  }

  // Get baseline stats from last 8 workouts
  const recentWorkouts = allWorkouts.slice(-8);
  
  const getVolume = (w) => {
    let vol = 0;
    (w.exercises || []).forEach(ex => {
      (ex.sets || []).forEach(s => {
        if (isWorkSet(s)) vol += (Number(s.kg) || 0) * (Number(s.reps) || 0);
      });
    });
    return vol;
  };

  const getDuration = (w) => Number(w.duration) || 0;
  const getSetCount = (w) => {
    let count = 0;
    (w.exercises || []).forEach(ex => {
      (ex.sets || []).forEach(s => {
        if (isWorkSet(s)) count += 1;
      });
    });
    return count;
  };

  const recentVolumes = recentWorkouts.map(getVolume);
  const recentDurations = recentWorkouts.map(getDuration);
  const recentSetCounts = recentWorkouts.map(getSetCount);

  const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
  const avgDuration = recentDurations.reduce((a, b) => a + b, 0) / recentDurations.length;
  const avgSetCount = recentSetCounts.reduce((a, b) => a + b, 0) / recentSetCounts.length;

  const stdDevVolume = Math.sqrt(recentVolumes.reduce((sum, v) => sum + Math.pow(v - avgVolume, 2), 0) / recentVolumes.length);
  const stdDevDuration = Math.sqrt(recentDurations.reduce((sum, d) => sum + Math.pow(d - avgDuration, 2), 0) / recentDurations.length);
  
  const currentVolume = getVolume(currentWorkout);
  const currentDuration = getDuration(currentWorkout);
  const currentSetCount = getSetCount(currentWorkout);

  // Detect volume anomalies (>2 std dev)
  if (stdDevVolume > 0) {
    const volumeZScore = Math.abs((currentVolume - avgVolume) / stdDevVolume);
    if (volumeZScore > 2) {
      anomalies.push({
        type: 'volume',
        current: currentVolume,
        expected: Math.round(avgVolume),
        severity: volumeZScore > 3 ? 'high' : 'medium',
        message: currentVolume > avgVolume 
          ? `Volume spike: ${Math.round((currentVolume - avgVolume) / avgVolume * 100)}% above baseline`
          : `Volume drop: ${Math.round((avgVolume - currentVolume) / avgVolume * 100)}% below baseline`
      });
    }
  }

  // Detect duration anomalies
  if (stdDevDuration > 0) {
    const durationZScore = Math.abs((currentDuration - avgDuration) / stdDevDuration);
    if (durationZScore > 2.2) {
      anomalies.push({
        type: 'duration',
        current: currentDuration,
        expected: Math.round(avgDuration),
        severity: durationZScore > 3 ? 'high' : 'medium',
        message: currentDuration > avgDuration
          ? `Session ran ${Math.round(currentDuration - avgDuration)} min longer than usual`
          : `Session ended ${Math.round(avgDuration - currentDuration)} min early`
      });
    }
  }

  // Detect incomplete sessions (< 50% planned sets)
  const plannedSets = getPlannedWorkSets(currentWorkout);
  if (plannedSets > 0 && currentSetCount < plannedSets * 0.5) {
    anomalies.push({
      type: 'incomplete',
      current: currentSetCount,
      expected: plannedSets,
      severity: 'medium',
      message: `Only ${currentSetCount}/${plannedSets} planned work sets completed`
    });
  }

  // Calculate overall severity
  const highCount = anomalies.filter(a => a.severity === 'high').length;
  const mediumCount = anomalies.filter(a => a.severity === 'medium').length;

  let severity = 'none';
  if (highCount > 0) severity = 'high';
  else if (mediumCount > 1) severity = 'medium';
  else if (mediumCount > 0) severity = 'low';

  // Generate flags
  if (severity === 'high') {
    flags.push('⚠️ Session shows significant deviation from your baseline.');
  } else if (severity === 'medium') {
    flags.push('📊 Some metrics are outside typical range.');
  }

  if (currentSetCount === 0) {
    flags.push('⚡ No completed sets recorded.');
  }

  return { anomalies, severity, flags };
};

/**
 * Extract key performance metrics from current + historical workouts
 * Returns: { progressMetrics, densityTrend, tempoAnalysis, volumeProgression }
 */
export const extractKeyMetrics = (currentWorkout, allWorkouts = [], exercisesDB = []) => {
  const getVolume = (w) => {
    let vol = 0;
    (w.exercises || []).forEach(ex => {
      (ex.sets || []).forEach(s => {
        if (isWorkSet(s)) vol += (Number(s.kg) || 0) * (Number(s.reps) || 0);
      });
    });
    return vol;
  };

  // RM Progress: compare top 1RM from this session vs previous
  let progressMetrics = {
    topEstimated1RM: 0,
    previousMax1RM: 0,
    rmGain: 0,
    rmTrend: 'flat'
  };

  if (currentWorkout) {
    let max1RM = 0;
    (currentWorkout.exercises || []).forEach(ex => {
      (ex.sets || []).forEach(s => {
        if (isWorkSet(s)) {
          const kg = Number(s.kg) || 0;
          const reps = Number(s.reps) || 0;
          const est1RM = canonical1RM(kg, reps);
          if (est1RM > max1RM) max1RM = est1RM;
        }
      });
    });
    progressMetrics.topEstimated1RM = max1RM;

    // Compare to previous
    if (allWorkouts.length > 0) {
      let prevMax1RM = 0;
      const prevWorkout = allWorkouts
        .filter(w => new Date(w.date) < new Date(currentWorkout.date))
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
      
      if (prevWorkout) {
        (prevWorkout.exercises || []).forEach(ex => {
          (ex.sets || []).forEach(s => {
            if (isWorkSet(s)) {
              const kg = Number(s.kg) || 0;
              const reps = Number(s.reps) || 0;
              const est1RM = canonical1RM(kg, reps);
              if (est1RM > prevMax1RM) prevMax1RM = est1RM;
            }
          });
        });
        progressMetrics.previousMax1RM = prevMax1RM;
        progressMetrics.rmGain = max1RM - prevMax1RM;
        progressMetrics.rmTrend = max1RM > prevMax1RM * 1.01 ? 'up' : max1RM < prevMax1RM * 0.99 ? 'down' : 'flat';
      }
    }
  }

  // Density Trend: volume per minute over last 4 sessions
  const densityTrend = { current: 0, trend: 'stable', last4: [] };
  if (currentWorkout) {
    const currentDensity = currentWorkout.duration > 0 
      ? getVolume(currentWorkout) / currentWorkout.duration 
      : 0;
    densityTrend.current = Math.round(currentDensity);

    const last4 = [currentWorkout, ...allWorkouts.slice(-3)];
    const densities = last4.map(w => w.duration > 0 ? getVolume(w) / w.duration : 0);
    densityTrend.last4 = densities.map(d => Math.round(d));

    if (densities.length > 1) {
      const trend = densities[0] > densities[densities.length - 1] * 1.05 ? 'improving' : 
                    densities[0] < densities[densities.length - 1] * 0.95 ? 'declining' : 'stable';
      densityTrend.trend = trend;
    }
  }

  // Volume Progression: trend over last 6 sessions
  const volumeProgression = { current: 0, trend: 'steady', last6: [] };
  if (currentWorkout) {
    volumeProgression.current = getVolume(currentWorkout);
    const last6 = [currentWorkout, ...allWorkouts.slice(-5)];
    volumeProgression.last6 = last6.map(w => getVolume(w));

    if (last6.length > 1) {
      const startVol = last6[last6.length - 1];
      const endVol = last6[0];
      if (startVol > 0) {
        const change = (endVol - startVol) / startVol;
        volumeProgression.trend = change > 0.08 ? 'climbing' : change < -0.08 ? 'declining' : 'steady';
      }
    }
  }

  // Tempo Analysis: avg reps per completed set as proxy for tempo
  const tempoAnalysis = { avgRepsPerSet: 0, distribution: { low: 0, mid: 0, high: 0 } };
  if (currentWorkout && currentWorkout.exercises) {
    let totalReps = 0;
    let setCount = 0;
    const repsList = [];

    currentWorkout.exercises.forEach(ex => {
      (ex.sets || []).forEach(s => {
        if (isWorkSet(s)) {
          const reps = Number(s.reps) || 0;
          if (reps > 0) {
            totalReps += reps;
            setCount += 1;
            repsList.push(reps);
          }
        }
      });
    });

    if (setCount > 0) {
      tempoAnalysis.avgRepsPerSet = Math.round(totalReps / setCount);
      // Distribution: low (1-5), mid (6-12), high (13+)
      repsList.forEach(r => {
        if (r <= 5) tempoAnalysis.distribution.low += 1;
        else if (r <= 12) tempoAnalysis.distribution.mid += 1;
        else tempoAnalysis.distribution.high += 1;
      });
    }
  }

  return { progressMetrics, densityTrend, tempoAnalysis, volumeProgression };
};

/**
 * Mastery Hierarchy: assigns user to level based on aggregate stats
 * Returns: { level: 1-5, title, description, nextMilestone, progress }
 */
export const calculateMasteryLevel = (allWorkouts = [], totalWorkoutTime = 0) => {
  const levels = [
    { level: 1, title: 'Awakening', description: 'Building baseline consistency', threshold: 0 },
    { level: 2, title: 'Developing', description: 'Establishing movement patterns', threshold: 5 },
    { level: 3, title: 'Proficient', description: 'Demonstrating progressive strength', threshold: 20 },
    { level: 4, title: 'Advanced', description: 'Strategic programming mastery', threshold: 50 },
    { level: 5, title: 'Elite', description: 'Championship-caliber execution', threshold: 100 }
  ];

  let points = 0;
  
  // Points for workout count
  points += Math.min(allWorkouts.length, 100);
  
  // Points for consistency (workouts in last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentWorkouts = allWorkouts.filter(w => new Date(w.date) >= thirtyDaysAgo);
  points += Math.min(recentWorkouts.length * 5, 30);

  // Points for total volume lifetime
  let totalVolume = 0;
  allWorkouts.forEach(w => {
    (w.exercises || []).forEach(ex => {
      (ex.sets || []).forEach(s => {
        if (isWorkSet(s)) totalVolume += (Number(s.kg) || 0) * (Number(s.reps) || 0);
      });
    });
  });
  points += Math.min(Math.floor(totalVolume / 50000), 40);

  // Determine current level
  let currentLevel = levels[0];
  for (const levelDef of levels) {
    if (points >= levelDef.threshold) {
      currentLevel = levelDef;
    } else {
      break;
    }
  }

  // Calculate progress to next level
  const nextLevel = levels.find(l => l.level === currentLevel.level + 1) || currentLevel;
  const progressToNext = ((points - currentLevel.threshold) / (nextLevel.threshold - currentLevel.threshold)) * 100;

  return {
    level: currentLevel.level,
    title: currentLevel.title,
    description: currentLevel.description,
    points: Math.round(points),
    nextMilestone: `${nextLevel.title} (${nextLevel.threshold} pts)`,
    progress: Math.round(Math.min(progressToNext, 100))
  };
};

/**
 * Momentum Calculator: rolling streak + engagement metric
 * Returns: { currentStreak, streakDays, momentumScore, motivationTier }
 */
export const calculateMomentum = (allWorkouts = []) => {
  let currentStreak = 0;
  let streakDays = 0;

  if (allWorkouts.length === 0) {
    return { currentStreak: 0, streakDays: 0, momentumScore: 0, motivationTier: 'starting' };
  }

  const sortedByDate = [...allWorkouts].sort((a, b) => new Date(b.date) - new Date(a.date));
  let lastDate = null;

  for (const w of sortedByDate) {
    const workoutDate = new Date(w.date);
    workoutDate.setHours(0, 0, 0, 0);

    if (!lastDate) {
      lastDate = new Date(workoutDate);
      currentStreak = 1;
      streakDays = 0;
    } else {
      const daysDiff = Math.floor((lastDate - workoutDate) / (1000 * 60 * 60 * 24));
      if (daysDiff === 1) {
        currentStreak += 1;
        streakDays = daysDiff;
        lastDate = new Date(workoutDate);
      } else if (daysDiff === 0) {
        // Same day, skip
        continue;
      } else {
        break;
      }
    }
  }

  // Momentum score: streak exponential + recent activity
  const momentumScore = Math.round(Math.min(currentStreak * (1 + currentStreak / 10), 100));
  
  let motivationTier = 'starting';
  if (currentStreak >= 3) motivationTier = 'building';
  if (currentStreak >= 7) motivationTier = 'rolling';
  if (currentStreak >= 14) motivationTier = 'unstoppable';
  if (currentStreak >= 30) motivationTier = 'legendary';

  return { currentStreak, streakDays, momentumScore, motivationTier };
};







