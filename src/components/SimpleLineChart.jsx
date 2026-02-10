import React, { useState } from 'react';

export const SimpleLineChart = ({ data, color = "#fb7185", unit = 'kg', onPointClick }) => {
  const [hoverIndex, setHoverIndex] = useState(null);

  if (!data || data.length < 2) {
    return (
      <div className="h-48 flex items-center justify-center text-zinc-500 text-sm bg-zinc-800/50 rounded-xl border border-dashed border-zinc-700">
        Not enough data for a chart
      </div>
    );
  }

  const height = 200;
  const width = 350;
  const padding = 20;

  const maxVal = Math.max(...data.map(d => d.value));
  const minVal = Math.min(...data.map(d => d.value));
  const range = maxVal - minVal || 1;

  const pointsArr = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((d.value - minVal) / range) * (height - 2 * padding);
    return { x, y, d };
  });
  const points = pointsArr.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <div className="w-full overflow-hidden animate-chart-fade-in">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#3f3f46" strokeDasharray="4" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#3f3f46" />
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="3"
          points={points}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {pointsArr.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r={hoverIndex === i ? 6 : 4}
              fill="#0b0b0c"
              stroke={color}
              strokeWidth="2"
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
              onClick={() => onPointClick && onPointClick(i, p.d)}
            />
          </g>
        ))}

        {/* Tooltip removed per user request */}
      </svg>
      <div className="flex justify-between text-xs text-zinc-500 mt-2 px-2">
        <span>{data[0].date}</span>
        <span>{data[data.length - 1].date}</span>
      </div>
    </div>
  );
};