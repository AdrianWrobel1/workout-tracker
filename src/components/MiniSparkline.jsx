import React from 'react';
import { calculateTotalVolume } from '../domain/calculations';

/**
 * Memoized sparkline - only re-renders if first 5 workouts actually changed
 * Prevents unnecessary recalculation on parent state changes
 * Custom comparison ensures stability across renders
 */
export const MiniSparkline = React.memo(
  ({ workouts = [], metric = 'volume' }) => {
    if (workouts.length === 0) return null;
    
    // Get last 5 workouts
    const last5 = workouts.slice(0, 5).reverse();
    
    // Calculate values
    const values = last5.map(w => {
      if (metric === 'volume') {
        return (w.exercises || []).reduce(
          (sum, ex) => sum + calculateTotalVolume(ex.sets || []), 
          0
        );
      } else {
        return w.duration || 0;
      }
    });
    
    if (values.length === 0) return null;
    
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = max - min || 1;
    
    // Normalize to 0-1
    const normalized = values.map(v => (v - min) / range);
    
    // Create SVG path
    const width = 120;
    const height = 30;
    const padding = 2;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    
    const points = normalized.map((v, i) => {
      const x = padding + (i / (normalized.length - 1 || 1)) * chartWidth;
      const y = height - padding - v * chartHeight;
      return `${x},${y}`;
    }).join(' ');
    
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="opacity-75 animate-chart-fade-in">
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
          className="text-blue-400"
        />
      </svg>
    );
  },
  // Custom comparison: only re-render if first 5 workouts actually changed ID or metric
  (prevProps, nextProps) => {
    const prevLast5 = prevProps.workouts.slice(0, 5);
    const nextLast5 = nextProps.workouts.slice(0, 5);
    
    // Return true if props are equal (DON'T re-render), false if different (DO re-render)
    return (
      prevLast5.length === nextLast5.length &&
      prevLast5.every((w, i) => w.id === nextLast5[i]?.id) &&
      prevProps.metric === nextProps.metric
    );
  }
);

MiniSparkline.displayName = 'MiniSparkline';
