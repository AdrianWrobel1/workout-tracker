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