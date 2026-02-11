/**
 * P5 FIX: Centralized chart aggregation functions
 * Deduplicates aggregation logic that was previously split between UnifiedChart.jsx and profileCharts.js
 * All metric aggregations (daily, weekly, monthly) now go through a single source of truth
 */

export const aggregateDaily = (workouts, metric, exerciseId, userWeight, exercisesDB) => {
  const days = {};
  
  workouts.forEach(w => {
    const date = new Date(w.date);
    const key = date.toISOString().split('T')[0]; // YYYY-MM-DD
    
    if (!days[key]) {
      days[key] = [];
    }
    
    // Extract metric from this workout
    (w.exercises || []).forEach(ex => {
      if (exerciseId && ex.exerciseId !== exerciseId) return; // Filter by exerciseId if specified
      
      const completed = (ex.sets || []).filter(s => s.completed && !s.warmup);
      
      completed.forEach(set => {
        const kg = Number(set.kg) || 0;
        const reps = Number(set.reps) || 0;
        
        if (kg === 0) return;
        
        const exDef = exercisesDB.find(e => e.id === ex.exerciseId) || {};
        const totalKg = kg + ((exDef.usesBodyweight && userWeight) ? Number(userWeight) : 0);
        
        if (metric === 'weight') {
          days[key].push(Math.round(totalKg * (1 + reps / 30))); // 1RM estimate
        } else if (metric === 'volume') {
          days[key].push(totalKg * reps);
        } else if (metric === 'reps') {
          days[key].push(reps);
        }
      });
    });
  });
  
  // Convert to array, sorted by date
  return Object.entries(days)
    .map(([date, values]) => {
      const value = values.length > 0 ? Math.max(...values) : 0; // For weight, take max; for volume, could sum
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
      weeks[key] = [];
    }
    
    (w.exercises || []).forEach(ex => {
      if (exerciseId && ex.exerciseId !== exerciseId) return;
      
      const completed = (ex.sets || []).filter(s => s.completed && !s.warmup);
      
      completed.forEach(set => {
        const kg = Number(set.kg) || 0;
        const reps = Number(set.reps) || 0;
        
        if (kg === 0) return;
        
        const exDef = exercisesDB.find(e => e.id === ex.exerciseId) || {};
        const totalKg = kg + ((exDef.usesBodyweight && userWeight) ? Number(userWeight) : 0);
        
        if (metric === 'weight') {
          weeks[key].push(Math.round(totalKg * (1 + reps / 30)));
        } else if (metric === 'volume') {
          weeks[key].push(totalKg * reps);
        } else if (metric === 'reps') {
          weeks[key].push(reps);
        }
      });
    });
  });
  
  return Object.entries(weeks)
    .map(([date, values]) => {
      const value = values.length > 0 
        ? (metric === 'volume' 
          ? Math.round(values.reduce((a, b) => a + b, 0)) // Sum for volume
          : Math.max(...values)) // Max for weight
        : 0;
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
      months[key] = [];
    }
    
    (w.exercises || []).forEach(ex => {
      if (exerciseId && ex.exerciseId !== exerciseId) return;
      
      const completed = (ex.sets || []).filter(s => s.completed && !s.warmup);
      
      completed.forEach(set => {
        const kg = Number(set.kg) || 0;
        const reps = Number(set.reps) || 0;
        
        if (kg === 0) return;
        
        const exDef = exercisesDB.find(e => e.id === ex.exerciseId) || {};
        const totalKg = kg + ((exDef.usesBodyweight && userWeight) ? Number(userWeight) : 0);
        
        if (metric === 'weight') {
          months[key].push(Math.round(totalKg * (1 + reps / 30)));
        } else if (metric === 'volume') {
          months[key].push(totalKg * reps);
        } else if (metric === 'reps') {
          months[key].push(reps);
        }
      });
    });
  });
  
  return Object.entries(months)
    .map(([date, values]) => {
      const value = values.length > 0
        ? (metric === 'volume'
          ? Math.round(values.reduce((a, b) => a + b, 0))
          : Math.max(...values))
        : 0;
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
