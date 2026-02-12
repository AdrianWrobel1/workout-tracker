import React, { useState, useMemo } from 'react';
import { aggregateDaily, aggregateWeekly, aggregateMonthly, getNiceInterval, formatDateShort, formatWeekStart, formatMonth } from '../domain/chartAggregation';

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
      case '30days':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
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
    } else if (timePeriod === '30days') {
      return aggregateWeekly(filtered, metric, exerciseId, userWeight, exercisesDB);
    } else if (timePeriod === '3months') {
      return aggregateWeekly(filtered, metric, exerciseId, userWeight, exercisesDB);
    } else {
      const monthly = aggregateMonthly(filtered, metric, exerciseId, userWeight, exercisesDB);
      // For yearly view, show only quarterly months (Mar, Jun, Sep, Dec)
      return monthly.filter(item => {
        const date = new Date(item.date + 'T00:00:00');
        return [3, 6, 9, 12].includes(date.getMonth() + 1);
      });
    }
  }, [workouts, exerciseId, metric, timePeriod, userWeight]); // FIXED: Removed exercisesDB - only needed for internal aggregation

  if (!chartData || chartData.length < 2) {
    return (
      <div className="h-48 flex items-center justify-center text-slate-500 text-sm bg-slate-800/50 rounded-xl border border-dashed border-slate-700">
        Not enough data for a chart
      </div>
    );
  }

  const height = 240;
  const width = 350;
  const leftPadding = 40;
  const rightPadding = 16;
  const topPadding = 16;
  const bottomPadding = 20;

  const maxVal = Math.max(...chartData.map(d => d.value));
  const minVal = Math.min(...chartData.map(d => d.value));
  
  // Dynamic scaling: add 5% margin below min and above max
  const margin = (maxVal - minVal) * 0.05 || maxVal * 0.1 || 1;
  const scaledMin = Math.max(0, minVal - margin);
  const scaledMax = maxVal + margin;
  const range = scaledMax - scaledMin || 1;

  // Generate nice Y-axis ticks (3-5 values)
  const generateYTicks = () => {
    const targetTicks = 4;
    const niceInterval = getNiceInterval(range, targetTicks);
    const tickMin = Math.floor(scaledMin / niceInterval) * niceInterval;
    const ticks = [];
    
    for (let i = tickMin; i <= scaledMax; i += niceInterval) {
      if (ticks.length <= 5) {
        ticks.push(i);
      }
    }
    
    return ticks.length > 0 ? ticks : [scaledMin, (scaledMin + scaledMax) / 2, scaledMax];
  };

  const yTicks = generateYTicks();

  const pointsArr = chartData.map((d, i) => {
    const x = leftPadding + (i / (chartData.length - 1)) * (width - leftPadding - rightPadding);
    const chartHeight = height - topPadding - bottomPadding;
    const y = topPadding + chartHeight - ((d.value - scaledMin) / range) * chartHeight;
    return { x, y, d };
  });
  
  const points = pointsArr.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        {/* Horizontal grid lines at Y ticks */}
        {yTicks.map((tick, i) => {
          const chartHeight = height - topPadding - bottomPadding;
          const y = topPadding + chartHeight - ((tick - scaledMin) / range) * chartHeight;
          return (
            <line
              key={`gridline-${i}`}
              x1={leftPadding}
              y1={y}
              x2={width - rightPadding}
              y2={y}
              stroke="#334155"
              strokeWidth="0.5"
              opacity="0.12"
              strokeDasharray="2,2"
            />
          );
        })}
        
        {/* Y-axis labels */}
        {yTicks.map((tick, i) => {
          const chartHeight = height - topPadding - bottomPadding;
          const y = topPadding + chartHeight - ((tick - scaledMin) / range) * chartHeight;
          return (
            <text
              key={`ylabel-${i}`}
              x={leftPadding - 6}
              y={y + 4}
              fontSize="11"
              fill="#94a3b8"
              textAnchor="end"
              dominantBaseline="middle"
            >
              {formatYAxisLabel(tick)}
            </text>
          );
        })}
        
        {/* Y-axis line */}
        <line x1={leftPadding} y1={topPadding} x2={leftPadding} y2={height - bottomPadding} stroke="#475569" strokeWidth="0.5" opacity="0.5" />
        
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
            {/* Chart data points - 4px radius with 24px invisible tap zone for mobile */}
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
            {/* Invisible larger tap zone for easier mobile interaction (24px radius) */}
            <circle
              cx={p.x}
              cy={p.y}
              r="24"
              fill="transparent"
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
          const tx = Math.min(Math.max(p.x + 6, leftPadding), width - rightPadding - tooltipWidth);
          const ty = p.y - 32 < topPadding ? p.y + 8 : p.y - 32;
          
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

// Format Y-axis label with unit
function formatYAxisLabel(value) {
  if (value >= 1000) {
    return (value / 1000).toFixed(0) + 'k';
  }
  if (Number.isInteger(value)) {
    return value.toString();
  }
  return value.toFixed(1);
}
