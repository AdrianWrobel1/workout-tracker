import { calculate1RM, calculateTotalVolume } from './calculations';

export const getExerciseHistory = (exerciseId, workouts) => {
  if (!exerciseId) return [];

  const relevantWorkouts = workouts
    .filter(w => w.exercises?.some(e => e.exerciseId === exerciseId))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  return relevantWorkouts.map(w => {
    const exData = w.exercises.find(e => e.exerciseId === exerciseId);
    const max1RM = Math.max(0, ...exData.sets.map(s => calculate1RM(s.kg, s.reps)));

    return {
      date: w.date,
      workoutName: w.name,
      sets: exData.sets.filter(s => s.completed),
      max1RM
    };
  }).filter(item => item.sets.length > 0);
};

export const getExerciseRecords = (exerciseId, workouts) => {
  const history = getExerciseHistory(exerciseId, workouts);
  let best1RM = 0;
  let best1RMDate = null;
  let maxWeight = 0;
  let maxWeightDate = null;
  let maxReps = 0;
  let maxRepsDate = null;

  history.forEach(day => {
    if (day.max1RM > best1RM) { best1RM = day.max1RM; best1RMDate = day.date; }
    day.sets.forEach(s => {
      if (s.kg > maxWeight) { maxWeight = s.kg; maxWeightDate = day.date; }
      if (s.reps > maxReps) { maxReps = s.reps; maxRepsDate = day.date; }
    });
  });

  return { best1RM, best1RMDate, maxWeight, maxWeightDate, maxReps, maxRepsDate };
};