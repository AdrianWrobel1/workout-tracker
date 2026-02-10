import React, { useState, useMemo } from 'react';

/**
 * Unified Chart Component - Mobile-first line chart for all fitness data
 * 
 * Handles time aggregation automatically:
 * - 7 days: daily points (7 max)
 * - 3 months: weekly aggregates (8-9 points)
 * - 1 year: monthly aggregates (12 points)
 * 
 * @param {Array} workouts - All workout data
 * @param {string} exerciseId - Which exercise to show (data filtered by exerciseId)
 * @param {string} metric - 'weight' (1RM), 'volume', 'reps', etc.
 * @param {string} timePeriod - '7days', '3months', '1year'
 * @param {string} color - Hex color for line/points
 * @param {string} unit - Display unit (kg, lbs, reps, etc.)
 * @param {number} userWeight - For bodyweight exercise calculations
 */
export const UnifiedChart = ({
  workouts = [],
  exerciseId = null,
  metric = 'weight', // 'weight' | 'volume' | 'reps' | 'frequency'
  timePeriod = '3months', // '7days' | '3months' | '1year'
  color = '#fb7185',
  unit = 'kg',
  userWeight = 0,
  exercisesDB = []
}) => {
  const [selectedPointIndex, setSelectedPointIndex] = useState(null);
  const [hoverIndex, setHoverIndex] = useState(null);

  // Get date range based on period
  const getDateRange = (period) => {
    const now = new Date();
    let start;
    
    switch (period) {
      case '7days':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '3months':
        start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1year':
        start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    }
    
    return { start, end: now };
  };

  // Aggregate data based on time period
  const chartData = useMemo(() => {
    const { start, end } = getDateRange(timePeriod);
    const filtered = (workouts || []).filter(w => {
      const wDate = new Date(w.date);
      return wDate >= start && wDate <= end;
    });

    if (filtered.length === 0) return [];

    // Extract time buckets based on period
    if (timePeriod === '7days') {
      return aggregateDaily(filtered, metric, exerciseId, userWeight, exercisesDB);
    } else if (timePeriod === '3months') {
      return aggregateWeekly(filtered, metric, exerciseId, userWeight, exercisesDB);
    } else {
      return aggregateMonthly(filtered, metric, exerciseId, userWeight, exercisesDB);
    }
  }, [workouts, exerciseId, metric, timePeriod, userWeight, exercisesDB]);

  if (!chartData || chartData.length < 2) {
    return (
      <div className="h-48 flex items-center justify-center text-slate-500 text-sm bg-slate-800/50 rounded-xl border border-dashed border-slate-700">
        Not enough data for a chart
      </div>
    );
  }

  const height = 200;
  const width = 350;
  const padding = 20;

  const maxVal = Math.max(...chartData.map(d => d.value));
  const minVal = Math.min(...chartData.map(d => d.value));
  const range = maxVal - minVal || 1;

  const pointsArr = chartData.map((d, i) => {
    const x = padding + (i / (chartData.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((d.value - minVal) / range) * (height - 2 * padding);
    return { x, y, d };
  });
  
  const points = pointsArr.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        {/* Grid lines */}
        <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#3f3f46" strokeDasharray="4" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#3f3f46" />
        
        {/* Chart line */}
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="3"
          points={points}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Data points */}
        {pointsArr.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r={hoverIndex === i || selectedPointIndex === i ? 6 : 4}
              fill="#0b0b0c"
              stroke={color}
              strokeWidth="2"
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
              onClick={() => setSelectedPointIndex(selectedPointIndex === i ? null : i)}
            />
          </g>
        ))}

        {/* Tooltip on click */}
        {selectedPointIndex !== null && (() => {
          const p = pointsArr[selectedPointIndex];
          const item = chartData[selectedPointIndex];
          const tooltipWidth = 110;
          const tx = Math.min(Math.max(p.x + 6, padding), width - padding - tooltipWidth);
          const ty = p.y - 32 < padding ? p.y + 8 : p.y - 32;
          
          return (
            <g>
              <rect x={tx} y={ty} width={tooltipWidth} height={26} rx={6} fill="#0f1720" stroke="#374151" />
              <text x={tx + 8} y={ty + 9} fontSize="11" fill="#f8fafc">{item.label}</text>
              <text x={tx + 8} y={ty + 20} fontSize="12" fill={color} fontWeight="bold">
                {Math.round(item.value)} {unit}
              </text>
            </g>
          );
        })()}
      </svg>
      
      {/* Date range labels */}
      <div className="flex justify-between text-xs text-slate-500 mt-2 px-2">
        <span>{chartData[0].label}</span>
        <span>{chartData[chartData.length - 1].label}</span>
      </div>
    </div>
  );
};

// ============ Aggregation Functions ============

function aggregateDaily(workouts, metric, exerciseId, userWeight, exercisesDB) {
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
}

function aggregateWeekly(workouts, metric, exerciseId, userWeight, exercisesDB) {
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
        label: `W${getWeekNumber(new Date(date))}`,
        value,
        date
      };
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function aggregateMonthly(workouts, metric, exerciseId, userWeight, exercisesDB) {
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
}

// ============ Utility Functions ============

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
  return new Date(d.setDate(diff));
}

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function formatDateShort(dateStr) {
  const [year, month, day] = dateStr.split('-');
  return `${month}/${day}`;
}

function formatMonth(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}
