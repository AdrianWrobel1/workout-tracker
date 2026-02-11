/**
 * Pad a number with leading zero
 */
const pad = (n) => String(n).padStart(2, '0');

/**
 * Get aggregated chart data based on date range and metric
 * Returns properly aggregated data points with consistent labeling
 * 
 * @param {object} params - { range, metric, workouts }
 * @returns {Array} Array of { label, value, workoutCount } objects
 */
export function getChartData({ range, metric, workouts = [] }) {
  console.log('getChartData called with:', { range, metric, workoutCount: workouts?.length });

  if (!workouts || workouts.length === 0) {
    console.warn('No workouts provided to getChartData');
    return [];
  }

  const now = new Date();
  
  // Filter workouts to be within range
  let startDate;
  switch (range) {
    case '1week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '1month':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '3months':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case '1year':
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  }

  console.log('Date range:', { startDate: startDate.toISOString(), now: now.toISOString() });

  // Aggregate workouts based on range
  let aggregatedData = [];

  if (range === '1week') {
    aggregatedData = aggregateByDay(workouts, startDate, now);
  } else if (range === '1month') {
    aggregatedData = aggregateByWeek(workouts, startDate, now);
  } else if (range === '3months') {
    aggregatedData = aggregateByMonth(workouts, startDate, now);
  } else if (range === '1year') {
    aggregatedData = aggregateByMonth(workouts, startDate, now);
  }

  // Transform to chart format
  const chartData = aggregatedData.map((item) => {
    const metricValue = metric === 'duration' 
      ? item.duration / 60 
      : metric === 'volume' 
      ? item.volume / 1000 
      : item.reps / 100;

    return {
      label: item.label,
      value: Math.max(0, Number(metricValue) || 0),
      rawValue: {
        duration: item.duration,
        volume: item.volume,
        reps: item.reps
      },
      workoutCount: item.workoutCount || 0
    };
  });

  // Debug logging
  if (aggregatedData.length > 0) {
    console.log('Chart Data Debug:', {
      range,
      metric,
      aggregatedDataLength: aggregatedData.length,
      chartDataLength: chartData.length,
      aggregatedData: aggregatedData.slice(0, 3),
      chartData: chartData.slice(0, 3)
    });
  }

  return chartData;
}

/**
 * Aggregate workouts by individual days (for 7-day view)
 */
function aggregateByDay(workouts, startDate, endDate) {
  const map = {};
  const days = 7;
  
  // Initialize all 7 days
  for (let i = 0; i < days; i++) {
    const d = new Date(endDate);
    d.setDate(d.getDate() - (days - 1 - i));
    const key = dateToISO(d);
    map[key] = {
      date: key,
      label: d.toLocaleDateString('en-US', { weekday: 'short' }),
      duration: 0,
      volume: 0,
      reps: 0,
      workoutCount: 0
    };
  }

  console.log('Aggregating by day:', { 
    workoutCount: workouts.length, 
    startDate: startDate.toISOString(), 
    endDate: endDate.toISOString(),
    initialMapSize: Object.keys(map).length 
  });

  // Add workout data
  workouts.forEach((w) => {
    try {
      const wDate = new Date(w.date);
      if (isNaN(wDate.getTime())) {
        console.warn('Invalid workout date:', w.date);
        return;
      }
      
      if (wDate >= startDate && wDate <= endDate) {
        const key = dateToISO(wDate);
        if (!map[key]) {
          map[key] = {
            date: key,
            label: wDate.toLocaleDateString('en-US', { weekday: 'short' }),
            duration: 0,
            volume: 0,
            reps: 0,
            workoutCount: 0
          };
        }
        console.log(`Matched workout to date ${key}:`, { duration: w.duration, exercises: w.exercises?.length });
        accumulateWorkout(map[key], w);
      } else {
        console.log(`Workout ${w.date} outside range [${startDate.toISOString()}, ${endDate.toISOString()}]`);
      }
    } catch (e) {
      console.error('Error processing workout:', w, e);
    }
  });

  const result = Object.values(map).sort((a, b) => new Date(a.date) - new Date(b.date));
  console.log('Aggregated by day result:', result);
  return result;
}

/**
 * Aggregate workouts by weeks (for 30-day or 3-month view)
 */
function aggregateByWeek(workouts, startDate, endDate) {
  const map = {};
  
  // Add all workouts
  workouts.forEach((w) => {
    try {
      const wDate = new Date(w.date);
      if (isNaN(wDate.getTime())) return; // Skip invalid dates
      
      if (wDate >= startDate && wDate <= endDate) {
        const weekStart = getWeekStart(wDate);
        const weekStartISO = dateToISO(weekStart);
        const weekNum = getWeekNumber(wDate);
        
        if (!map[weekStartISO]) {
          map[weekStartISO] = {
            date: weekStartISO,
            weekStart: weekStart,
            weekNum: weekNum,
            label: formatWeekLabel(weekStartISO),
            duration: 0,
            volume: 0,
            reps: 0,
            workoutCount: 0
          };
        }
        accumulateWorkout(map[weekStartISO], w);
      }
    } catch (e) {
      console.error('Error processing workout:', w, e);
    }
  });

  // Fill in empty weeks
  const currentWeekStart = getWeekStart(endDate);
  let checkDate = new Date(startDate);
  
  while (checkDate <= endDate) {
    const weekStart = getWeekStart(checkDate);
    const weekStartISO = dateToISO(weekStart);
    const weekNum = getWeekNumber(checkDate);
    
    if (!map[weekStartISO]) {
      map[weekStartISO] = {
        date: weekStartISO,
        weekStart: weekStart,
        weekNum: weekNum,
        label: formatWeekLabel(weekStartISO),
        duration: 0,
        volume: 0,
        reps: 0,
        workoutCount: 0
      };
    }
    
    checkDate.setDate(checkDate.getDate() + 7);
  }

  return Object.values(map).sort((a, b) => new Date(a.date) - new Date(b.date)).slice(-6);
}

/**
 * Aggregate workouts by months (for 3-month or yearly view)
 */
function aggregateByMonth(workouts, startDate, endDate) {
  const map = {};
  
  // Add all workouts
  workouts.forEach((w) => {
    try {
      const wDate = new Date(w.date);
      if (isNaN(wDate.getTime())) return; // Skip invalid dates
      
      if (wDate >= startDate && wDate <= endDate) {
        const monthKey = wDate.getFullYear() + '-' + pad(wDate.getMonth() + 1);
        
        if (!map[monthKey]) {
          map[monthKey] = {
            date: monthKey,
            label: wDate.toLocaleDateString('en-US', { month: 'short' }),
            duration: 0,
            volume: 0,
            reps: 0,
            workoutCount: 0
          };
        }
        accumulateWorkout(map[monthKey], w);
      }
    } catch (e) {
      console.error('Error processing workout:', w, e);
    }
  });

  // Fill in empty months
  let checkDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  
  while (checkDate <= endDate) {
    const monthKey = checkDate.getFullYear() + '-' + pad(checkDate.getMonth() + 1);
    
    if (!map[monthKey]) {
      map[monthKey] = {
        date: monthKey,
        label: checkDate.toLocaleDateString('en-US', { month: 'short' }),
        duration: 0,
        volume: 0,
        reps: 0,
        workoutCount: 0
      };
    }
    
    checkDate.setMonth(checkDate.getMonth() + 1);
  }

  return Object.values(map).sort((a, b) => {
    const [yA, mA] = a.date.split('-').map(Number);
    const [yB, mB] = b.date.split('-').map(Number);
    return yA !== yB ? yA - yB : mA - mB;
  });
}

/**
 * Accumulate workout metrics
 */
function accumulateWorkout(target, workout) {
  if (!target || !workout) return;
  
  target.duration += Number(workout.duration) || 0;
  target.workoutCount = (target.workoutCount || 0) + 1;

  if (workout.exercises && Array.isArray(workout.exercises)) {
    workout.exercises.forEach((exercise) => {
      if (exercise && exercise.sets && Array.isArray(exercise.sets)) {
        exercise.sets.forEach((set) => {
          if (set && set.completed) {
            const kg = Number(set.kg) || 0;
            const reps = Number(set.reps) || 0;
            target.volume += (kg * reps);
            target.reps += reps;
          }
        });
      }
    });
  }
}

/**
 * Convert date to ISO format (YYYY-MM-DD)
 */
function dateToISO(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Get the start of the week (Monday) for a given date
 */
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d;
}

/**
 * Get ISO week number for a date
 */
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Format week label with date
 */
function formatWeekLabel(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Format value for tooltip
 */
export function getChartTooltip(value, metric) {
  const unit = metric === 'duration' ? 'h' : metric === 'volume' ? 'k' : '';
  return `${value.toFixed(1)}${unit}`;
}
