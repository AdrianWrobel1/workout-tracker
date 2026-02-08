import React from 'react';
import { calculateTotalVolume } from '../domain/calculations';

// Minimal sparkline for last 5 workouts (volume or duration)
export const MiniSparkline = ({ workouts = [], metric = 'volume' }) => {
  if (workouts.length === 0) return null;
  
  // Get last 5 workouts
  const last5 = workouts.slice(0, 5).reverse();
  
  // Calculate values
  const values = last5.map(w => {
    if (metric === 'volume') {
      return (w.exercises || []).reduce((sum, ex) => sum + calculateTotalVolume(ex.sets || []), 0);
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
};
