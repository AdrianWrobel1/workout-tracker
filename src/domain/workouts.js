/**
 * Workout-related domain logic
 */
import { isWorkSet, resolveSetType } from './workoutExtensions';

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
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1);
  weekStart.setHours(0, 0, 0, 0);
  return workouts.filter(w => new Date(w.date) >= weekStart);
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
export const prepareCleanWorkoutData = (workout, exercisesDB = []) => {
  let totalVolume = 0;
  let completedSets = 0;
  const volumePerMuscle = {};
  
  (workout.exercises || []).forEach(ex => {
    const exDef = exercisesDB.find(e => e.id === ex.exerciseId);
    const muscles = (exDef?.muscles && exDef.muscles.length > 0) ? exDef.muscles : [ex.category || 'Other'];
    
    (ex.sets || []).forEach(s => {
      if (isWorkSet(s)) {
        const kg = Number(s.kg) || 0;
        const reps = Number(s.reps) || 0;
        const volume = kg * reps;
        totalVolume += volume;
        completedSets += 1;
        
        muscles.forEach(muscle => {
          volumePerMuscle[muscle] = (volumePerMuscle[muscle] || 0) + volume;
        });
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
export const compareWorkoutToPrevious = (currentWorkout, allWorkouts) => {
  const filtered = allWorkouts.filter(w => new Date(w.date) < new Date(currentWorkout.date)).sort((a, b) => new Date(b.date) - new Date(a.date));
  if (filtered.length === 0) return null;
  
  const prevWorkout = filtered[0];
  
  // Calculate volume for both
  const getVolume = (w) => {
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
      const estimated1RM = Math.round(kg * (1 + reps / 30));
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

// Map category names to actual muscle groups
export const mapCategoryToMuscles = (category) => {
  if (!category) return ['Other'];
  
  const cat = category.toLowerCase().trim();
  
  // Multi-muscle categories
  if (cat.includes('push')) return ['Chest', 'Shoulders', 'Triceps'];
  if (cat.includes('pull')) return ['Back', 'Biceps'];
  if (cat.includes('legs') || cat.includes('leg')) return ['Legs'];
  if (cat.includes('chest') || cat.includes('pec')) return ['Chest'];
  if (cat.includes('back') || cat.includes('lat')) return ['Back'];
  if (cat.includes('shoulder') || cat.includes('delt')) return ['Shoulders'];
  if (cat.includes('bicep')) return ['Biceps'];
  if (cat.includes('tricep') || cat.includes('trice')) return ['Triceps'];
  if (cat.includes('cores') || cat.includes('abs') || cat.includes('ab')) return ['Core'];
  
  return ['Other'];
};

// Calculate muscle distribution for radar - includes COMPLETED sets only
export const calculateMuscleDistribution = (workout, exercisesDB = []) => {
  const muscleVolumes = {
    'Chest': 0,
    'Back': 0,
    'Legs': 0,
    'Shoulders': 0,
    'Biceps': 0,
    'Triceps': 0,
    'Core': 0
  };
  
  const axes = ['Chest', 'Back', 'Legs', 'Shoulders', 'Biceps', 'Triceps', 'Core'];
  
  (workout.exercises || []).forEach(ex => {
    const exDef = exercisesDB.find(e => e.id === ex.exerciseId) || {};
    
    // Determine muscles for this exercise
    let muscles = [];
    if (exDef.muscles && exDef.muscles.length > 0) {
      muscles = exDef.muscles;
    } else {
      muscles = mapCategoryToMuscles(ex.category);
    }
    
    // Calculate volume for this exercise (completed sets only, exclude warmups)
    let exVolume = 0;
    (ex.sets || []).forEach(s => {
      if (isWorkSet(s)) {
        const kg = Number(s.kg) || 0;
        const reps = Number(s.reps) || 0;
        exVolume += kg * reps;
      }
    });
    
    // Add volume to each mapped muscle
    // Filter to valid axes only
    const validMuscles = muscles.filter(m => axes.includes(m));
    
    if (validMuscles.length > 0) {
      // If we have valid muscles, distribute to them
      validMuscles.forEach(muscle => {
        muscleVolumes[muscle] += exVolume;
      });
    } else if (muscles.length > 0) {
      // Fallback: if muscles array has items but none are valid (e.g., 'Other'),
      // distribute evenly across all axes to ensure radar always has data
      const distribution = exVolume / axes.length;
      axes.forEach(axis => {
        muscleVolumes[axis] += distribution;
      });
    }
  });
  
  // Normalize to 0-1 range
  const max = Math.max(...Object.values(muscleVolumes), 1);
  const normalized = {};
  axes.forEach(axis => {
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







