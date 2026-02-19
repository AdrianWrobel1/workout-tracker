/**
 * P5 FIX: Centralized chart aggregation functions
 * Deduplicates aggregation logic that was previously split between UnifiedChart.jsx and profileCharts.js
 * All metric aggregations (daily, weekly, monthly) now go through a single source of truth
 */
import { isWorkSet } from './workoutExtensions';

export const aggregateDaily = (workouts, metric, exerciseId, userWeight, exercisesDB) => {
  const days = {};
  
  workouts.forEach(w => {
    const date = new Date(w.date);
    const key = date.toISOString().split('T')[0]; // YYYY-MM-DD
    
    if (!days[key]) {
      days[key] = { values: [], workoutCount: 0, totalDuration: 0 };
    }
    
    // Count this workout once per day
    days[key].workoutCount += 1;
    
    // Accumulate duration for 'duration' metric
    if (metric === 'duration') {
      days[key].totalDuration += (w.duration || 0);
    }
    
    // Extract metric from this workout
    (w.exercises || []).forEach(ex => {
      if (exerciseId && ex.exerciseId !== exerciseId) return; // Filter by exerciseId if specified
      
      const completed = (ex.sets || []).filter(s => isWorkSet(s));
      
      completed.forEach(set => {
        const kg = Number(set.kg) || 0;
        const reps = Number(set.reps) || 0;
        
        if (kg === 0) return;
        
        const exDef = exercisesDB.find(e => e.id === ex.exerciseId) || {};
        const totalKg = kg + ((exDef.usesBodyweight && userWeight) ? Number(userWeight) : 0);
        
        if (metric === 'weight') {
          days[key].values.push(Math.round(totalKg * (1 + reps / 30))); // 1RM estimate
        } else if (metric === 'volume') {
          days[key].values.push(totalKg * reps);
        } else if (metric === 'reps') {
          days[key].values.push(reps);
        }
      });
    });
  });
  
  // Convert to array, sorted by date
  return Object.entries(days)
    .map(([date, data]) => {
      let value = 0;
      if (metric === 'duration') {
        value = Math.round(data.totalDuration / 60); // Convert minutes to hours
      } else if (metric === 'workouts') {
        value = data.workoutCount; // Count of workouts
      } else {
        value = data.values.length > 0 ? Math.max(...data.values) : 0; // For weight, take max; for volume, could sum
      }
      return {
        label: formatDateShort(date),
        value,
        date
      };
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));
};

export const aggregateWeekly = (workouts, metric, exerciseId, userWeight, exercisesDB) => {
  const weeks = {};
  
  workouts.forEach(w => {
    const date = new Date(w.date);
    const weekStart = getWeekStart(date);
    const key = weekStart.toISOString().split('T')[0];
    
    if (!weeks[key]) {
      weeks[key] = { values: [], workoutCount: 0, totalDuration: 0 };
    }
    
    // Count this workout once per week
    weeks[key].workoutCount += 1;
    
    // Accumulate duration for 'duration' metric
    if (metric === 'duration') {
      weeks[key].totalDuration += (w.duration || 0);
    }
    
    (w.exercises || []).forEach(ex => {
      if (exerciseId && ex.exerciseId !== exerciseId) return;
      
      const completed = (ex.sets || []).filter(s => isWorkSet(s));
      
      completed.forEach(set => {
        const kg = Number(set.kg) || 0;
        const reps = Number(set.reps) || 0;
        
        if (kg === 0) return;
        
        const exDef = exercisesDB.find(e => e.id === ex.exerciseId) || {};
        const totalKg = kg + ((exDef.usesBodyweight && userWeight) ? Number(userWeight) : 0);
        
        if (metric === 'weight') {
          weeks[key].values.push(Math.round(totalKg * (1 + reps / 30)));
        } else if (metric === 'volume') {
          weeks[key].values.push(totalKg * reps);
        } else if (metric === 'reps') {
          weeks[key].values.push(reps);
        }
      });
    });
  });
  
  return Object.entries(weeks)
    .map(([date, data]) => {
      let value = 0;
      if (metric === 'duration') {
        value = Math.round(data.totalDuration / 60); // Convert minutes to hours
      } else if (metric === 'workouts') {
        value = data.workoutCount; // Count of workouts
      } else {
        value = data.values.length > 0 
          ? (metric === 'volume' 
            ? Math.round(data.values.reduce((a, b) => a + b, 0)) // Sum for volume
            : Math.max(...data.values)) // Max for weight
          : 0;
      }
      return {
        label: formatWeekStart(date),
        value,
        date
      };
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));
};

export const aggregateMonthly = (workouts, metric, exerciseId, userWeight, exercisesDB) => {
  const months = {};
  
  workouts.forEach(w => {
    const date = new Date(w.date);
    const key = date.toISOString().slice(0, 7); // YYYY-MM
    
    if (!months[key]) {
      months[key] = { values: [], workoutCount: 0, totalDuration: 0 };
    }
    
    // Count this workout once per month
    months[key].workoutCount += 1;
    
    // Accumulate duration for 'duration' metric
    if (metric === 'duration') {
      months[key].totalDuration += (w.duration || 0);
    }
    
    (w.exercises || []).forEach(ex => {
      if (exerciseId && ex.exerciseId !== exerciseId) return;
      
      const completed = (ex.sets || []).filter(s => isWorkSet(s));
      
      completed.forEach(set => {
        const kg = Number(set.kg) || 0;
        const reps = Number(set.reps) || 0;
        
        if (kg === 0) return;
        
        const exDef = exercisesDB.find(e => e.id === ex.exerciseId) || {};
        const totalKg = kg + ((exDef.usesBodyweight && userWeight) ? Number(userWeight) : 0);
        
        if (metric === 'weight') {
          months[key].values.push(Math.round(totalKg * (1 + reps / 30)));
        } else if (metric === 'volume') {
          months[key].values.push(totalKg * reps);
        } else if (metric === 'reps') {
          months[key].values.push(reps);
        }
      });
    });
  });
  
  return Object.entries(months)
    .map(([date, data]) => {
      let value = 0;
      if (metric === 'duration') {
        value = Math.round(data.totalDuration / 60); // Convert minutes to hours
      } else if (metric === 'workouts') {
        value = data.workoutCount; // Count of workouts
      } else {
        value = data.values.length > 0
          ? (metric === 'volume'
            ? Math.round(data.values.reduce((a, b) => a + b, 0))
            : Math.max(...data.values))
          : 0;
      }
      return {
        label: formatMonth(date + '-01'),
        value,
        date
      };
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));
};

// Utility functions
export const getWeekStart = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
};

export const formatDateShort = (dateStr) => {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const formatWeekStart = (dateStr) => {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const formatMonth = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short' });
};

export const getNiceInterval = (range, targetTicks) => {
  const roughInterval = range / (targetTicks - 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughInterval)));
  const normalized = roughInterval / magnitude;
  
  let niceFraction;
  if (normalized < 1.5) niceFraction = 1;
  else if (normalized < 3) niceFraction = 2;
  else if (normalized < 7) niceFraction = 5;
  else niceFraction = 10;
  
  return niceFraction * magnitude;
};
