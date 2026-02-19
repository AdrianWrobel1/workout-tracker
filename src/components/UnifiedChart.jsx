import React, { useState, useMemo, useRef, useCallback } from 'react';
import { aggregateDaily, aggregateWeekly, aggregateMonthly, getNiceInterval } from '../domain/chartAggregation';
import { alignSeriesToCurrent, getClosestPointIndexFromX, getDateRangeForPeriod, getPreviousRange } from '../analytics/chartCompare';

/**
 * Unified Chart Component - mobile-first line chart for fitness data.
 * Heavy computations are memoized; scrub interaction updates only lightweight UI state.
 */
export const UnifiedChart = ({
  workouts = [],
  exerciseId = null,
  metric = 'weight', // 'weight' | 'volume' | 'reps' | 'frequency'
  timePeriod = '3months', // '7days' | '3months' | '1year'
  color = '#fb7185',
  unit = 'kg',
  userWeight = 0,
  exercisesDB = [],
  enableAdvancedInteractions = false
}) => {
  const [selectedPointIndex, setSelectedPointIndex] = useState(null);
  const [hoverIndex, setHoverIndex] = useState(null);
  const [scrubIndex, setScrubIndex] = useState(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [comparePrevious, setComparePrevious] = useState(false);
  const [activeSeries, setActiveSeries] = useState('current');
  const [annotations, setAnnotations] = useState({});
  const [noteDraft, setNoteDraft] = useState('');
  const [isEditingNote, setIsEditingNote] = useState(false);
  const svgRef = useRef(null);

  const width = 350;
  const height = 240;
  const leftPadding = 40;
  const rightPadding = 16;
  const topPadding = 16;
  const bottomPadding = 20;

  const periodRange = useMemo(() => getDateRangeForPeriod(timePeriod), [timePeriod]);

  const aggregateForPeriod = useCallback((filteredWorkouts) => {
    if (!filteredWorkouts || filteredWorkouts.length === 0) return [];

    if (timePeriod === '7days') {
      return aggregateDaily(filteredWorkouts, metric, exerciseId, userWeight, exercisesDB);
    }
    if (timePeriod === '30days' || timePeriod === '3months') {
      return aggregateWeekly(filteredWorkouts, metric, exerciseId, userWeight, exercisesDB);
    }

    const monthly = aggregateMonthly(filteredWorkouts, metric, exerciseId, userWeight, exercisesDB);
    return monthly.filter(item => {
      const date = new Date(item.date + 'T00:00:00');
      return [3, 6, 9, 12].includes(date.getMonth() + 1);
    });
  }, [timePeriod, metric, exerciseId, userWeight, exercisesDB]);

  const chartData = useMemo(() => {
    const filtered = (workouts || []).filter(workout => {
      const date = new Date(workout.date);
      return date >= periodRange.start && date <= periodRange.end;
    });
    return aggregateForPeriod(filtered);
  }, [workouts, periodRange, aggregateForPeriod]);

  const previousSeries = useMemo(() => {
    if (!enableAdvancedInteractions || !comparePrevious || chartData.length === 0) return [];

    const previousRange = getPreviousRange(periodRange);
    const filteredPrevious = (workouts || []).filter(workout => {
      const date = new Date(workout.date);
      return date >= previousRange.start && date <= previousRange.end;
    });

    const previousAggregated = aggregateForPeriod(filteredPrevious);
    return alignSeriesToCurrent(chartData, previousAggregated);
  }, [enableAdvancedInteractions, comparePrevious, chartData, workouts, periodRange, aggregateForPeriod]);

  const applyScrubFromEvent = useCallback((event) => {
    if (!svgRef.current || chartData.length <= 1) return;
    const rect = svgRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;

    const relativeX = ((event.clientX - rect.left) / rect.width) * width;
    const index = getClosestPointIndexFromX({
      x: relativeX,
      leftPadding,
      rightPadding,
      width,
      pointCount: chartData.length
    });
    setScrubIndex(index);
    setActiveSeries('current');
  }, [chartData.length]);

  if (!chartData || chartData.length < 2) {
    return (
      <div className="h-48 flex items-center justify-center text-slate-500 text-sm bg-slate-800/50 rounded-xl border border-dashed border-slate-700">
        Not enough data for a chart
      </div>
    );
  }

  const previousValues = (previousSeries || [])
    .filter(point => point.hasValue)
    .map(point => point.value);
  const allValues = previousValues.length > 0
    ? [...chartData.map(point => point.value), ...previousValues]
    : chartData.map(point => point.value);

  const maxVal = Math.max(...allValues);
  const minVal = Math.min(...allValues);
  const margin = (maxVal - minVal) * 0.05 || maxVal * 0.1 || 1;
  const scaledMin = Math.max(0, minVal - margin);
  const scaledMax = maxVal + margin;
  const range = scaledMax - scaledMin || 1;

  const generateYTicks = () => {
    const targetTicks = 4;
    const niceInterval = getNiceInterval(range, targetTicks);
    const tickMin = Math.floor(scaledMin / niceInterval) * niceInterval;
    const ticks = [];

    for (let i = tickMin; i <= scaledMax; i += niceInterval) {
      if (ticks.length <= 5) ticks.push(i);
    }

    return ticks.length > 0 ? ticks : [scaledMin, (scaledMin + scaledMax) / 2, scaledMax];
  };

  const yTicks = generateYTicks();
  const chartHeight = height - topPadding - bottomPadding;

  const pointsArr = chartData.map((item, index) => {
    const x = leftPadding + (index / (chartData.length - 1)) * (width - leftPadding - rightPadding);
    const y = topPadding + chartHeight - ((item.value - scaledMin) / range) * chartHeight;
    return { x, y, item };
  });
  const points = pointsArr.map(p => `${p.x},${p.y}`).join(' ');

  const previousPointsArr = previousSeries.map((item, index) => {
    const x = leftPadding + (index / (chartData.length - 1)) * (width - leftPadding - rightPadding);
    const y = topPadding + chartHeight - ((item.value - scaledMin) / range) * chartHeight;
    return { x, y, item };
  });
  const previousPoints = previousPointsArr.map(p => `${p.x},${p.y}`).join(' ');

  const activePointIndex = scrubIndex ?? selectedPointIndex ?? hoverIndex;
  const resolvedActiveSeries = comparePrevious ? activeSeries : 'current';
  const activePoint = activePointIndex !== null
    ? (
        resolvedActiveSeries === 'previous' && previousSeries[activePointIndex]?.hasValue
          ? previousPointsArr[activePointIndex]
          : pointsArr[activePointIndex]
      )
    : null;
  const activeCurrent = activePointIndex !== null ? chartData[activePointIndex] : null;
  const activePrevious = activePointIndex !== null ? previousSeries[activePointIndex] : null;
  const activeSeriesLabel = resolvedActiveSeries === 'previous' ? 'Previous' : 'Current';
  const activeNoteKey = activeCurrent?.date || null;
  const activeNote = activeNoteKey ? annotations[activeNoteKey] : '';

  const handlePointerDown = (event) => {
    if (!enableAdvancedInteractions) return;
    setIsScrubbing(true);
    setSelectedPointIndex(null);
    applyScrubFromEvent(event);
  };

  const handlePointerMove = (event) => {
    if (!enableAdvancedInteractions || !isScrubbing) return;
    applyScrubFromEvent(event);
  };

  const handlePointerEnd = () => {
    if (!enableAdvancedInteractions) return;
    setIsScrubbing(false);
  };

  const openNoteEditor = () => {
    setNoteDraft(activeNote || '');
    setIsEditingNote(true);
  };

  const saveNote = () => {
    if (!activeNoteKey) return;
    const trimmed = noteDraft.trim();
    setAnnotations(prev => {
      if (!trimmed) {
        const next = { ...prev };
        delete next[activeNoteKey];
        return next;
      }
      return { ...prev, [activeNoteKey]: trimmed };
    });
    setIsEditingNote(false);
  };

  const handleCurrentPointToggle = (index) => {
    setScrubIndex(null);
    setActiveSeries('current');
    setSelectedPointIndex(selectedPointIndex === index ? null : index);
  };

  const handlePreviousPointToggle = (index) => {
    setScrubIndex(null);
    setActiveSeries('previous');
    setSelectedPointIndex(selectedPointIndex === index ? null : index);
  };

  return (
    <div className="w-full overflow-hidden">
      {enableAdvancedInteractions && (
        <div className="flex items-center justify-between mb-2 px-1">
          <p className="text-[11px] text-slate-500 font-semibold tracking-wider">
            {isScrubbing ? 'Scrubbing' : 'Tap or drag on chart'}
          </p>
          <button
            onClick={() => setComparePrevious(prev => !prev)}
            className={`text-[11px] px-2 py-1 rounded-md border transition ${
              comparePrevious
                ? 'bg-blue-500/15 border-blue-500/30 text-blue-300'
                : 'bg-slate-800/40 border-slate-700/50 text-slate-400'
            }`}
          >
            Compare previous period
          </button>
        </div>
      )}

      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto touch-none"
      >
        {/* Horizontal grid lines at Y ticks */}
        {yTicks.map((tick, i) => {
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

        {/* Y-axis */}
        <line x1={leftPadding} y1={topPadding} x2={leftPadding} y2={height - bottomPadding} stroke="#475569" strokeWidth="0.5" opacity="0.5" />

        {/* Previous period overlay */}
        {comparePrevious && previousPoints && (
          <polyline
            fill="none"
            stroke="#94a3b8"
            strokeWidth="2"
            points={previousPoints}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="5,4"
            opacity="0.8"
          />
        )}

        {/* Main chart line */}
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="3"
          points={points}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Scrub overlay */}
        {enableAdvancedInteractions && (
          <rect
            x={leftPadding}
            y={topPadding}
            width={width - leftPadding - rightPadding}
            height={height - topPadding - bottomPadding}
            fill="transparent"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerLeave={handlePointerEnd}
          />
        )}

        {/* Previous period points (click/tap to show previous tooltip source) */}
        {comparePrevious && previousPointsArr.map((point, i) => {
          if (!point.item?.hasValue) return null;
          const isActive = activePointIndex === i && resolvedActiveSeries === 'previous';
          return (
            <g key={`previous-point-${i}`}>
              <circle
                cx={point.x}
                cy={point.y}
                r={isActive ? 5 : 3}
                fill="#0b0b0c"
                stroke="#94a3b8"
                strokeWidth="1.5"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => {
                  setHoverIndex(i);
                  setActiveSeries('previous');
                }}
                onMouseLeave={() => setHoverIndex(null)}
                onClick={() => handlePreviousPointToggle(i)}
              />
              <circle
                cx={point.x}
                cy={point.y}
                r="18"
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onClick={() => handlePreviousPointToggle(i)}
              />
            </g>
          );
        })}

        {/* Data points */}
        {pointsArr.map((point, i) => {
          const isActive = activePointIndex === i && resolvedActiveSeries === 'current';
          return (
            <g key={i}>
              <circle
                cx={point.x}
                cy={point.y}
                r={isActive ? 6 : 4}
                fill="#0b0b0c"
                stroke={color}
                strokeWidth="2"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => {
                  setHoverIndex(i);
                  setActiveSeries('current');
                }}
                onMouseLeave={() => setHoverIndex(null)}
                onClick={() => handleCurrentPointToggle(i)}
              />
              <circle
                cx={point.x}
                cy={point.y}
                r="22"
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onClick={() => handleCurrentPointToggle(i)}
              />
            </g>
          );
        })}

        {/* Active point marker line */}
        {activePoint && (
          <line
            x1={activePoint.x}
            y1={topPadding}
            x2={activePoint.x}
            y2={height - bottomPadding}
            stroke={resolvedActiveSeries === 'previous' ? '#94a3b8' : color}
            strokeWidth="1"
            strokeDasharray="3,3"
            opacity="0.35"
          />
        )}

        {/* Tooltip */}
        {activePoint && activeCurrent && (() => {
          const tooltipWidth = comparePrevious ? 176 : 138;
          const tooltipHeight = comparePrevious ? 56 : 30;
          const tx = Math.min(Math.max(activePoint.x + 8, leftPadding), width - rightPadding - tooltipWidth);
          const ty = activePoint.y - (tooltipHeight + 6) < topPadding ? activePoint.y + 8 : activePoint.y - (tooltipHeight + 6);

          return (
            <g>
              <rect x={tx} y={ty} width={tooltipWidth} height={tooltipHeight} rx={6} fill="#0f1720" stroke="#374151" />
              <text x={tx + 8} y={ty + 11} fontSize="10" fill="#cbd5e1" fontWeight="700">
                {activeCurrent.label} - {activeSeriesLabel}
              </text>
              <text x={tx + 8} y={ty + 25} fontSize="12" fill={color} fontWeight="bold">
                Current: {Math.round(activeCurrent.value)} {unit}
              </text>
              {comparePrevious && (
                <text x={tx + 8} y={ty + 39} fontSize="11" fill="#94a3b8" fontWeight="600">
                  Previous: {activePrevious?.hasValue ? `${Math.round(activePrevious.value)} ${unit}` : 'no data'}
                </text>
              )}
            </g>
          );
        })()}
      </svg>

      {/* Date range labels */}
      <div className="flex justify-between text-xs text-slate-500 mt-2 px-2">
        <span>{chartData[0].label}</span>
        <span>{chartData[chartData.length - 1].label}</span>
      </div>

      {/* In-memory annotations */}
      {enableAdvancedInteractions && activeCurrent && (
        <div className="mt-3 p-2 rounded-lg bg-slate-800/35 border border-slate-700/40">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-slate-400 font-semibold tracking-wider">Annotation ({activeCurrent.label})</p>
            {!isEditingNote && (
              <button
                onClick={openNoteEditor}
                className="text-[11px] px-2 py-1 rounded-md border border-slate-600/50 text-slate-300 hover:text-white hover:border-slate-500/70 transition"
              >
                {activeNote ? 'Edit note' : 'Add note'}
              </button>
            )}
          </div>

          {!isEditingNote && activeNote && (
            <p className="text-xs text-slate-200 mt-2">{activeNote}</p>
          )}

          {isEditingNote && (
            <div className="mt-2 flex gap-2">
              <input
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
                placeholder="e.g. plan change"
                className="flex-1 h-9 px-3 rounded-md bg-slate-900/70 border border-slate-700/60 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-slate-500"
              />
              <button
                onClick={saveNote}
                className="h-9 px-3 rounded-md bg-slate-700/70 hover:bg-slate-600/70 text-xs font-bold text-white transition"
              >
                Save
              </button>
              <button
                onClick={() => setIsEditingNote(false)}
                className="h-9 px-3 rounded-md border border-slate-700/70 hover:border-slate-500/70 text-xs font-bold text-slate-300 transition"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function formatYAxisLabel(value) {
  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
  if (Number.isInteger(value)) return value.toString();
  return value.toFixed(1);
}
