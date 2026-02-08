/**
 * Workout-related domain logic
 */

export const getPreviousSets = (exerciseId, workouts, excludeStartTime = null) => {
  if (!exerciseId) return [];

  const relevantWorkouts = workouts
    .filter(w => {
      if (excludeStartTime && w.startTime === excludeStartTime) return false;
      return w.exercises?.some(ex => ex.exerciseId === exerciseId);
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  for (const w of relevantWorkouts) {
    const ex = w.exercises.find(e => e.exerciseId === exerciseId);
    if (!ex) continue;

    // Return an array aligned to set indices; value present only when that set was completed
    const aligned = ex.sets.map(s => (s.completed && !s.warmup) ? { kg: s.kg, reps: s.reps } : null);
    // If there is at least one completed set, return this aligned array
    if (aligned.some(a => a !== null)) return aligned;
  }

  return [];
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
      if (s.completed && !s.warmup) {
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
        if (s.completed && !s.warmup) {
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

// Map category names to actual muscle groups
export const mapCategoryToMuscles = (category) => {
  if (!category) return ['Other'];
  
  const cat = category.toLowerCase().trim();
  
  // Multi-muscle categories
  if (cat.includes('push')) return ['Chest', 'Shoulders', 'Arms'];
  if (cat.includes('pull')) return ['Back', 'Arms'];
  if (cat.includes('legs') || cat.includes('leg')) return ['Legs'];
  if (cat.includes('chest') || cat.includes('pec')) return ['Chest'];
  if (cat.includes('back') || cat.includes('lat')) return ['Back'];
  if (cat.includes('shoulder') || cat.includes('delt')) return ['Shoulders'];
  if (cat.includes('arms') || cat.includes('arm') || cat.includes('bicep') || cat.includes('tricep')) return ['Arms'];
  if (cat.includes('core') || cat.includes('abs') || cat.includes('ab')) return ['Core'];
  
  return ['Other'];
};

// Calculate muscle distribution for radar - includes ALL sets regardless of completed status
export const calculateMuscleDistribution = (workout, exercisesDB = []) => {
  const muscleVolumes = {
    'Chest': 0,
    'Back': 0,
    'Legs': 0,
    'Shoulders': 0,
    'Arms': 0,
    'Core': 0
  };
  
  const axes = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'];
  
  (workout.exercises || []).forEach(ex => {
    const exDef = exercisesDB.find(e => e.id === ex.exerciseId) || {};
    
    // Determine muscles for this exercise
    let muscles = [];
    if (exDef.muscles && exDef.muscles.length > 0) {
      muscles = exDef.muscles;
    } else {
      muscles = mapCategoryToMuscles(ex.category);
    }
    
    // Calculate volume for this exercise (ALL sets, not just completed)
    let exVolume = 0;
    (ex.sets || []).forEach(s => {
      const kg = Number(s.kg) || 0;
      const reps = Number(s.reps) || 0;
      exVolume += kg * reps;
    });
    
    // Ensure minimum volume (1) so radar is never empty
    if (exVolume === 0 && (ex.sets || []).length > 0) {
      exVolume = 1;
    }
    
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
 * Returns an object with exerciseId => PR status (1RM, weight, or reps)
 */
export const detectPRsInWorkout = (completedWorkout, previousWorkouts) => {
  if (!completedWorkout?.exercises) return {};

  const { calculate1RM } = require('./calculations');
  const { getExerciseRecords } = require('./exercises');

  const prStatus = {};

  completedWorkout.exercises.forEach(ex => {
    if (!ex.exerciseId) return;

    // Get previous records for this exercise
    const previousRecords = getExerciseRecords(ex.exerciseId, previousWorkouts);
    const prevBest1RM = previousRecords.best1RM || 0;
    const prevMaxWeight = previousRecords.maxWeight || 0;
    const prevMaxReps = previousRecords.maxReps || 0;

    // Check all completed sets (excluding warmups)
    let hasReps1RMPR = false;
    let hasWeightPR = false;
    let hasRepsPR = false;

    (ex.sets || []).forEach(set => {
      if (!set.completed || set.warmup) return;

      const kg = Number(set.kg) || 0;
      const reps = Number(set.reps) || 0;

      if (kg === 0 || reps === 0) return;

      const this1RM = calculate1RM(kg, reps);

      // Check for PR types
      if (this1RM > prevBest1RM) hasReps1RMPR = true;
      if (kg > prevMaxWeight) hasWeightPR = true;
      if (reps > prevMaxReps) hasRepsPR = true;
    });

    // Determine primary PR type (1RM > weight > reps)
    if (hasReps1RMPR) {
      prStatus[ex.exerciseId] = '1RM';
    } else if (hasWeightPR) {
      prStatus[ex.exerciseId] = 'weight';
    } else if (hasRepsPR) {
      prStatus[ex.exerciseId] = 'reps';
    }
  });

  return prStatus;
};
