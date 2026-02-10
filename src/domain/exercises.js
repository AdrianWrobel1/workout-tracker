import { calculate1RM, calculateTotalVolume } from './calculations';

export const getExerciseHistory = (exerciseId, workouts) => {
  if (!exerciseId) return [];

  const relevantWorkouts = workouts
    .filter(w => w.exercises?.some(e => e.exerciseId === exerciseId))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  return relevantWorkouts.map(w => {
    const exData = w.exercises.find(e => e.exerciseId === exerciseId);
    // include all completed sets in history, but compute best 1RM excluding warmup sets
    const allCompleted = exData.sets.filter(s => s.completed).map(s => ({ ...s }));
    const nonWarmupSets = exData.sets.filter(s => s.completed && !s.warmup);
    const max1RM = nonWarmupSets.length ? Math.max(0, ...nonWarmupSets.map(s => calculate1RM(s.kg, s.reps))) : 0;

    return {
      date: w.date,
      workoutName: w.name,
      sets: allCompleted,
      max1RM
    };
  }).filter(item => item.sets.length > 0);
};

export const getExerciseRecords = (exerciseId, workouts) => {
  const history = getExerciseHistory(exerciseId, workouts);
  let best1RM = 0;
  let best1RMDate = null;
  let heaviestWeight = 0;
  let heaviestWeightDate = null;
  let bestSetVolume = 0;
  let bestSetVolumeDate = null;
  let maxReps = 0;
  let maxRepsDate = null;

  history.forEach(day => {
    if (day.max1RM > best1RM) { best1RM = day.max1RM; best1RMDate = day.date; }
    day.sets.forEach(s => {
      // ignore warmup sets for record calculations
      if (s.warmup) return;
      const kg = Number(s.kg) || 0;
      const reps = Number(s.reps) || 0;
      
      if (kg > heaviestWeight) { heaviestWeight = kg; heaviestWeightDate = day.date; }
      if (reps > maxReps) { maxReps = reps; maxRepsDate = day.date; }
      
      // Track best set volume (kg × reps as single best)
      const volume = kg * reps;
      if (volume > bestSetVolume) { bestSetVolume = volume; bestSetVolumeDate = day.date; }
    });
  });

  return { 
    best1RM, 
    best1RMDate, 
    heaviestWeight, 
    heaviestWeightDate, 
    bestSetVolume,
    bestSetVolumeDate,
    maxReps, 
    maxRepsDate 
  };
};

// Check if a single set achieves any records
export const checkSetRecords = (kg, reps, exerciseRecords, calculate1RM) => {
  if (!exerciseRecords || kg === 0 || reps === 0) {
    return { isBest1RM: false, isBestSetVolume: false, isHeaviestWeight: false };
  }
  
  const thisVolume = kg * reps;
  const this1RM = calculate1RM(kg, reps);
  
  return {
    isBest1RM: this1RM > (exerciseRecords.best1RM || 0),
    isBestSetVolume: thisVolume > (exerciseRecords.bestSetVolume || 0),
    isHeaviestWeight: kg > (exerciseRecords.heaviestWeight || 0)
  };
};

// Get last completed sets for auto-memory
export const getLastCompletedSets = (exerciseId, workouts) => {
  if (!exerciseId) return [];
  
  const relevantWorkouts = workouts
    .filter(w => w.exercises?.some(e => e.exerciseId === exerciseId))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  
  for (const w of relevantWorkouts) {
    const ex = w.exercises.find(e => e.exerciseId === exerciseId);
    if (!ex) continue;
    
    const completed = ex.sets.filter(s => s.completed && !s.warmup);
    if (completed.length > 0) {
      return completed;
    }
  }
  
  return [];
};

// Detect ramp and suggest next weight
export const suggestNextWeight = (sets) => {
  if (!sets || sets.length < 2) return null;
  
  const validSets = sets
    .filter(s => s && !s.warmup)
    .map(s => ({ kg: Number(s.kg) || 0, reps: Number(s.reps) || 0 }));
  
  if (validSets.length < 2) return null;
  
  // Check if ramp (increasing weight)
  let isRamp = true;
  for (let i = 1; i < validSets.length; i++) {
    if (validSets[i].kg <= validSets[i - 1].kg) {
      isRamp = false;
      break;
    }
  }
  
  if (!isRamp) return null;
  
  const lastSet = validSets[validSets.length - 1];
  const prevSet = validSets[validSets.length - 2];
  const diff = lastSet.kg - prevSet.kg;
  
  let increment = diff > 0 ? diff : 5;
  if (increment < 2.5) increment = 2.5;
  
  return {
    suggestedKg: lastSet.kg + increment,
    suggestedReps: lastSet.reps
  };
};

// --- INTERPRETATIVE LAYER: Trends & Insights ---

// Get last single set for an exercise (most recent completed non-warmup)
export const getLastSet = (exerciseId, workouts) => {
  const sets = getLastCompletedSets(exerciseId, workouts);
  if (sets.length === 0) return null;
  const last = sets[sets.length - 1]; // last in the array is most recent
  return { kg: Number(last.kg) || 0, reps: Number(last.reps) || 0 };
};

// Compute exercise trend: ↑ progres, → stagnacja, ↓ regres (over last 4 weeks)
export const getExerciseTrend = (exerciseId, workouts) => {
  const history = getExerciseHistory(exerciseId, workouts);
  if (history.length < 2) return '→'; // not enough data
  
  const now = new Date();
  const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
  
  // Split into recent and older
  const recent = history.filter(h => new Date(h.date) >= fourWeeksAgo);
  const older = history.filter(h => new Date(h.date) < fourWeeksAgo);
  
  if (recent.length === 0) return '→';
  
  const getMax1RM = (items) => Math.max(...items.map(h => h.max1RM || 0), 0);
  const getVolume = (items) => items.reduce((sum, h) => sum + (h.sets || []).reduce((s, set) => s + ((Number(set.kg) || 0) * (Number(set.reps) || 0)), 0), 0);
  
  const recentMax1RM = getMax1RM(recent);
  const recentVol = getVolume(recent);
  const olderMax1RM = getMax1RM(older);
  const olderVol = getVolume(older);
  
  // Weighted: 70% 1RM, 30% volume
  const recentScore = recentMax1RM * 0.7 + (recentVol > 0 ? 100 : 0) * 0.3;
  const olderScore = olderMax1RM * 0.7 + (olderVol > 0 ? 100 : 0) * 0.3;
  
  if (recentScore > olderScore * 1.05) return '↑';
  if (recentScore < olderScore * 0.95) return '↓';
  return '→';
};

// Generate 1-line chart context (used above chart title)
export const getChartContext = (exerciseId, workouts) => {
  const history = getExerciseHistory(exerciseId, workouts);
  if (history.length === 0) return 'No data yet';
  
  const records = getExerciseRecords(exerciseId, workouts);
  const trend = getExerciseTrend(exerciseId, workouts);
  
  const now = new Date();
  const threeWeeksAgo = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000);
  const recentHistory = history.filter(h => new Date(h.date) >= threeWeeksAgo);
  
  const getVol = (items) => items.reduce((sum, h) => sum + (h.sets || []).reduce((s, set) => s + ((Number(set.kg) || 0) * (Number(set.reps) || 0)), 0), 0);
  
  const recentVol = getVol(recentHistory);
  const olderVol = getVol(history.filter(h => new Date(h.date) < threeWeeksAgo));
  
  // Generate insight
  if (trend === '↑') {
    return recentVol > olderVol ? 'Strength & volume up' : 'Strength improving';
  } else if (trend === '↓') {
    return recentVol < olderVol ? 'Strength & volume down' : 'Strength declining';
  } else {
    return recentVol > olderVol ? 'Volume stable, trending up' : 'Steady & stable';
  }
};

// Compare workout to another (for overlay signals)
export const compareToWorkout = (workout, otherWorkout) => {
  const getVolume = (w) => (w.exercises || []).reduce((sum, ex) => sum + calculateTotalVolume(ex.sets || []), 0);
  const vol1 = getVolume(workout);
  const vol2 = getVolume(otherWorkout);
  
  if (vol1 > vol2 * 1.1) return 'better';
  if (vol1 < vol2 * 0.9) return 'worse';
  return 'similar';
};