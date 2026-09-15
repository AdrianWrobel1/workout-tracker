import React, { useState } from 'react';
import {
  MUSCLE_INTENSITY, levelsOf, viewsForMuscle, muscleDetailFor, muscleTrend
} from '../analytics/statistics';
import { BODY_ARTWORK, FRONT_VB, BACK_VB } from './bodyArtwork';

/**
 * MuscleBodyMap — the Body Map presentation layer for Statistics 2.0.
 *
 * DATA FLOW (nothing computed from scratch here):
 *   canonical muscle aggregation (muscleStats in analytics/statistics.js,
 *   built on mapCategoryToMuscles + work sets)
 *     → intensity via levelsOf (relative balance scale, same window)
 *     → SVG regions below (axis name == region key, 1:1 identity)
 *     → visual state + textual detail panel.
 *
 * The geometry is adapted from the ORIGINAL upstream MuscleMap artwork by
 * Melih Colpan (MIT — see bodyArtwork.js for the license notice and the
 * axis-grouping documentation), converted directly from the upstream Swift
 * source. No openGym code is used anywhere in this file. Front/back is
 * presentation only: one axis state drives every region it maps to.
 *
 * Props:
 * - setsByMuscle: { Chest: n, ... } — the single visual source (required).
 * - stats: muscleStats() result for the detail panel (sets/volume/sessions).
 * - workouts + exercisesDB: the same list behind `stats`, for the trend.
 * - selected / onSelect: controlled selection (shared across views) or local.
 */
const BASE = '#333a45';
const STROKE = '#0b0b0c';

const fillFor = (level) => {
  if (level >= 4) return 'var(--accent)';
  if (level <= 0) return BASE;
  const pct = level === 1 ? 32 : level === 2 ? 56 : 78;
  return `color-mix(in srgb, var(--accent) ${pct}%, ${BASE})`;
};

// Artwork regions come from bodyArtwork.js (upstream-derived geometry grouped
// onto the axes below). AXIS CONTRACT (do not rename): Shoulders, Chest,
// Biceps, Core, Legs on front; Shoulders, Back, Triceps, Core, Legs on back.
// Inert paths (head, hair, neck, hands, feet, ankles) render as silhouette
// and never take intensity.
const Figure = ({ side, levels, selected, onPick }) => {
  const art = side === 'front' ? BODY_ARTWORK.front : BODY_ARTWORK.back;
  const vb = side === 'front' ? FRONT_VB : BACK_VB;
  const activate = (event, axis) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (event.key === ' ') event.preventDefault();
    onPick(axis);
  };
  return (
    <svg viewBox={vb} className="flex-1 min-w-0 w-full max-w-[210px] h-auto max-h-[320px]" role={onPick ? 'group' : 'img'} aria-label={`${side} view`}>
      {art.inert.map((d, i) => (
        <path key={`inert-${i}`} d={d} fill={BASE} opacity={0.55} stroke={STROKE} strokeWidth={4} strokeLinejoin="round" />
      ))}
      {Object.entries(art.regions).map(([axis, paths]) => (
        <g
          key={axis}
          role={onPick ? 'button' : undefined}
          tabIndex={onPick ? 0 : undefined}
          aria-label={onPick ? axis : undefined}
          aria-pressed={onPick ? selected === axis : undefined}
          onClick={onPick ? () => onPick(axis) : undefined}
          onKeyDown={onPick ? (event) => activate(event, axis) : undefined}
          style={onPick ? { cursor: 'pointer' } : undefined}
        >
          <title>{axis}</title>
          {paths.map((d, i) => (
            <path
              key={i}
              d={d}
              fill={fillFor(levels[axis] || 0)}
              stroke={selected === axis ? '#ffffff' : STROKE}
              strokeWidth={selected === axis ? 14 : 8}
              strokeLinejoin="round"
            />
          ))}
        </g>
      ))}
    </svg>
  );
};

export const IntensityLegend = () => (
  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 justify-start mt-3" aria-label="Muscle intensity: from No data to Very high">
    {MUSCLE_INTENSITY.map((label, i) => (
      <span key={label} className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 font-semibold">
        <span
          aria-hidden="true"
          className="inline-block w-2.5 h-2.5 rounded-[3px]"
          style={{ background: fillFor(i) }}
        />
        {label}
      </span>
    ))}
  </div>
);

const fmt1 = (n) => {
  const r = Math.round(Number(n) * 10) / 10;
  return Number.isFinite(r) ? r.toLocaleString('en-US') : '0';
};

export const MuscleBodyMap = ({
  setsByMuscle = {},
  stats = null,
  workouts = null,
  exercisesDB = [],
  selected,
  onSelect
}) => {
  const [view, setView] = useState('both');
  const [internal, setInternal] = useState(null);
  // Controlled when `selected` is passed (Statistics shares one selection
  // across sections); otherwise local.
  const sel = selected !== undefined ? selected : internal;
  const pick = (axis) => {
    const next = sel === axis ? null : axis;
    if (selected === undefined) setInternal(next);
    if (onSelect) onSelect(next);
  };

  const levels = levelsOf(setsByMuscle);
  const detail = sel ? muscleDetailFor(sel, stats || { setsByMuscle }) : null;
  const trend = sel && workouts ? muscleTrend(workouts, sel, { exercisesDB }) : null;
  const empty = stats ? (stats.totalSets || 0) === 0 : Object.keys(setsByMuscle).length === 0;

  const viewBtn = (value, label) => (
    <button
      key={value}
      onClick={() => setView(value)}
      aria-pressed={view === value}
      className={`flex-1 min-h-[44px] px-3 text-xs font-bold rounded-lg transition-all ${
        view === value
          ? 'accent-bg text-white shadow-lg accent-shadow'
          : 'text-slate-400 hover:text-slate-300'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="flex gap-2 bg-slate-800/50 p-1 rounded-lg border border-slate-700/50 mb-3">
        {viewBtn('front', 'Front')}
        {viewBtn('both', 'Both')}
        {viewBtn('back', 'Back')}
      </div>

      <div className="flex gap-3 justify-center items-start max-w-md mx-auto w-full">
        {view !== 'back' && <Figure side="front" levels={levels} selected={sel} onPick={pick} />}
        {view !== 'front' && <Figure side="back" levels={levels} selected={sel} onPick={pick} />}
      </div>

      <IntensityLegend />

      {empty ? (
        <p className="text-slate-500 text-sm mt-3">No workouts in this period yet.</p>
      ) : detail ? (
        <div className="mt-3 pt-3 border-t border-slate-700/50" aria-live="polite">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-black text-white">{detail.axis}</h4>
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-slate-700/50 text-slate-300 font-bold">
              {detail.intensity}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2.5">
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-2">
              <p className="text-lg font-black text-white">{fmt1(detail.sets)}</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Sets</p>
            </div>
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-2">
              <p className="text-lg font-black text-white">{detail.volume ? `${Math.round(detail.volume).toLocaleString('en-US')} kg` : '—'}</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Attributed vol.</p>
            </div>
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-2">
              <p className="text-lg font-black text-white">{detail.sessions}</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Sessions</p>
            </div>
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-2">
              <p className="text-lg font-black text-white">{detail.share > 0 ? `${Math.round(detail.share * 100)}%` : '—'}</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Share of sets</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {!trend
              ? 'Not enough sessions for a trend.'
              : trend.direction === 'up'
                ? '↗ Trending up in this period.'
                : trend.direction === 'down'
                  ? '↘ Trending down in this period.'
                  : '→ Stable in this period.'}
          </p>
          <p className="text-xs text-slate-600 mt-1">
            {viewsForMuscle(detail.axis).length === 2
              ? 'Visible on the front and back views.'
              : viewsForMuscle(detail.axis)[0] === 'front'
                ? 'Visible on the front view.'
                : 'Visible on the back view.'}
          </p>
        </div>
      ) : (
        <p className="text-slate-500 text-sm mt-3">Tap a muscle to see its training.</p>
      )}
    </div>
  );
};

export default MuscleBodyMap;
