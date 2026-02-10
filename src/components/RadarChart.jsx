import React from 'react';

/**
 * RadarChart - Spider/Radar Chart for muscle distribution
 * 
 * @param {Object} data - Object with muscle groups as keys and values 0-1
 *   Example: { Back: 0.8, Legs: 1.0, Chest: 0.5, Arms: 0.3, Core: 0.6, Shoulders: 0.7 }
 * @param {number} size - Chart size in pixels (default: 220)
 * @param {string} fillColor - Fill color with opacity (default: '#fb718590')
 * @param {string} strokeColor - Stroke color (default: '#fb7185')
 */
export const RadarChart = ({ 
  data = {}, 
  size = 220, 
  fillColor = '#fb718590', 
  strokeColor = '#fb7185' 
}) => {
  // Define muscle groups in order (clockwise from top)
  const groups = ['Chest', 'Back', 'Legs', 'Shoulders', 'Biceps', 'Triceps', 'Core'];
  
  // Center point
  const center = size / 2;
  
  // Maximum radius for the chart (leaving space for labels)
  const maxRadius = center * 0.65;
  
  // Get normalized values (0-1) for each group
  const values = groups.map(g => data[g] || 0);
  
  // Calculate points for the polygon
  const calculatePoint = (value, index) => {
    const angle = (index / groups.length) * Math.PI * 2 - Math.PI / 2;
    const radius = value * maxRadius;
    const x = center + Math.cos(angle) * radius;
    const y = center + Math.sin(angle) * radius;
    return { x, y };
  };
  
  // Create polygon points string
  const polygonPoints = values
    .map((value, i) => {
      const point = calculatePoint(value, i);
      return `${point.x},${point.y}`;
    })
    .join(' ');
  
  // Calculate label positions (slightly outside the chart, with more padding for longer labels)
  const getLabelPosition = (index) => {
    const angle = (index / groups.length) * Math.PI * 2 - Math.PI / 2;
    // Increased label radius to accommodate longer muscle names
    const labelRadius = center * 1.35;
    const x = center + Math.cos(angle) * labelRadius;
    const y = center + Math.sin(angle) * labelRadius;
    
    // Determine text anchor based on position
    let textAnchor = 'middle';
    let dx = 0;
    let dy = 0;
    
    // Adjust positioning based on quadrant
    if (Math.abs(Math.cos(angle)) > 0.3) {
      textAnchor = Math.cos(angle) > 0 ? 'start' : 'end';
      dx = Math.cos(angle) > 0 ? 8 : -8; // Increased offset for left/right positions
    }
    
    if (Math.sin(angle) > 0.3) {
      dy = 8; // Increased offset downward
    } else if (Math.sin(angle) < -0.3) {
      dy = -8; // Increased offset upward
    }
    
    return { x, y, textAnchor, dx, dy };
  };

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Background circles (grid) */}
      {[0.25, 0.5, 0.75, 1].map((scale, i) => (
        <circle
          key={`circle-${i}`}
          cx={center}
          cy={center}
          r={maxRadius * scale}
          fill="none"
          stroke="#27272a"
          strokeWidth="1"
        />
      ))}
      
      {/* Axis lines */}
      {groups.map((group, i) => {
        const angle = (i / groups.length) * Math.PI * 2 - Math.PI / 2;
        const endX = center + Math.cos(angle) * maxRadius;
        const endY = center + Math.sin(angle) * maxRadius;
        
        return (
          <line
            key={`axis-${i}`}
            x1={center}
            y1={center}
            x2={endX}
            y2={endY}
            stroke="#27272a"
            strokeWidth="1"
          />
        );
      })}
      
      {/* Data polygon */}
      <polygon
        points={polygonPoints}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      
      {/* Data points (circles at each vertex) */}
      {values.map((value, i) => {
        const point = calculatePoint(value, i);
        return (
          <circle
            key={`point-${i}`}
            cx={point.x}
            cy={point.y}
            r="4"
            fill={strokeColor}
            stroke="#18181b"
            strokeWidth="2"
          />
        );
      })}
      
      {/* Labels */}
      {groups.map((group, i) => {
        const pos = getLabelPosition(i);
        const value = values[i];
        
        // Responsive font size: smaller on mobile
        const fontSize = size < 240 ? 10 : 12;
        const percentFontSize = size < 240 ? 8 : 10;
        
        return (
          <g key={`label-${i}`}>
            <text
              x={pos.x + pos.dx}
              y={pos.y + pos.dy}
              fontSize={fontSize}
              fontWeight="600"
              fill="#e4e4e7"
              textAnchor={pos.textAnchor}
              dominantBaseline="middle"
            >
              {group}
            </text>
            {/* Show percentage below label if value > 0 */}
            {value > 0 && (
              <text
                x={pos.x + pos.dx}
                y={pos.y + pos.dy + 12}
                fontSize={percentFontSize}
                fill="#71717a"
                textAnchor={pos.textAnchor}
                dominantBaseline="middle"
              >
                {Math.round(value * 100)}%
              </text>
            )}
          </g>
        );
      })}
      
      {/* Center dot */}
      <circle
        cx={center}
        cy={center}
        r="3"
        fill="#52525b"
      />
    </svg>
  );
};

// Example usage:
// <RadarChart 
//   data={{ 
//     Back: 0.8, 
//     Legs: 1.0, 
//     Chest: 0.5, 
//     Arms: 0.3, 
//     Core: 0.6, 
//     Shoulders: 0.7 
//   }} 
//   size={220}
// />