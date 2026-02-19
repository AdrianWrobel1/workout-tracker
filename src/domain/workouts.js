/**
 * Workout-related domain logic
 */
import { isWorkSet } from './workoutExtensions';

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
  
  let trend = '→';
  if (currentVol > prevVol * 1.05) trend = '↑';
  else if (currentVol < prevVol * 0.95) trend = '↓';
  
  return { trend, prevVolume: prevVol, currentVolume: currentVol };
};

// Generate session feedback text
export const generateSessionFeedback = (volume, sets, trend) => {
  const volumeLevel = volume > 10000 ? 'crushing' : volume > 5000 ? 'solid' : volume > 2000 ? 'decent' : 'light';
  const setsLevel = sets > 20 ? 'epic' : sets > 12 ? 'good' : sets > 6 ? 'balanced' : 'quick';
  
  const texts = {
    crushing: {
      epic: '💪 Beast mode activated',
      good: '🔥 Solid work ethic',
      balanced: '⚡ Quality volume',
      quick: '🎯 Intense focus'
    },
    solid: {
      epic: '🏋️ Great grind',
      good: '✅ Solid session',
      balanced: '💯 Perfect balance',
      quick: '⚙️ Efficient'
    },
    decent: {
      epic: '👍 Nice effort',
      good: '🎯 On point',
      balanced: '✨ Consistent',
      quick: '🚀 Quick one'
    },
    light: {
      epic: '🌱 Building',
      good: '📈 Getting going',
      balanced: '🌟 Getting warmed',
      quick: '💫 Starter session'
    }
  };
  
  const text = texts[volumeLevel]?.[setsLevel] || '💪 Keep moving';
  const trendIcon = trend === '↑' ? ' 🚀' : trend === '↓' ? ' ⚠️' : '';
  
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
 * Returns one practical keep/improve/focus suggestion.
 */
export const generateCoachLens = (
  currentWorkout,
  allWorkouts = [],
  comparison = null,
  prStatus = {}
) => {
  if (!currentWorkout) {
    return {
      keep: 'No workout data yet.',
      improve: 'No slowdown pattern detected.',
      focus: 'Complete one full session to unlock Coach Lens.'
    };
  }

  const effectiveComparison = comparison || compareWorkoutToPrevious(currentWorkout, allWorkouts);
  const previousWorkout = getPreviousWorkout(currentWorkout, allWorkouts);
  const regressedExercise = findMostRegressedExercise(currentWorkout, previousWorkout);
  const prCount = Object.keys(prStatus || {}).length;
  const topSet = getBestSetByEstimated1RM(currentWorkout);
  const currentVolume = getCompletedVolume(currentWorkout);
  const prevVolume = Number(effectiveComparison?.prevVolume) || 0;
  const deltaPct = prevVolume > 0 ? Math.round(((currentVolume - prevVolume) / prevVolume) * 100) : 0;

  let keep = 'Keep your main lift setup and tempo consistent next session.';
  if (prCount > 0 && topSet?.exerciseName) {
    keep = `Keep ${topSet.exerciseName} as your opener; today's top set quality was high.`;
  } else if (deltaPct >= 5) {
    keep = `Keep this session density; total volume is up ${Math.abs(deltaPct)}% vs previous session.`;
  }

  let improve = 'No clear weak point this session.';
  if (deltaPct <= -5) {
    improve = `Volume dropped ${Math.abs(deltaPct)}% vs previous session.`;
  } else if (regressedExercise?.exerciseName) {
    improve = `${regressedExercise.exerciseName} underperformed versus your last exposure.`;
  }

  let focus = 'Next session focus: add +1 rep on the first work set of one priority lift.';
  if (regressedExercise?.exerciseName) {
    focus = `Next session focus: recover ${regressedExercise.exerciseName} first set quality before adding load.`;
  } else if (topSet?.exerciseName) {
    focus = `Next session focus: repeat ${topSet.exerciseName} top set, then add +2.5 kg only if reps stay clean.`;
  }

  return { keep, improve, focus };
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
