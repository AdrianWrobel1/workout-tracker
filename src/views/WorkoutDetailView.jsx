import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Clock, FileText, Medal, LayoutGrid, List, Dumbbell, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { calculate1RM } from '../domain/calculations';
import { resolveSetType } from '../domain/workoutExtensions';
import { formatSessionDuration, formatSessionDate, formatSessionTime } from '../domain/history';
import {
  findWorkoutById,
  getSessionSummary,
  getSessionExercises,
  getSessionMuscleStats,
  getSessionHighlights,
} from '../domain/sessionDetail';
import { relativeDay } from '../domain/history';
import { getLocalDayKey } from '../domain/dates';
import { MuscleBodyMap } from '../components/MuscleBodyMap';
import { PRBadge } from '../components/analyticsUI';
import SessionDebrief from '../components/SessionDebrief';
import TechniqueDetector from '../components/TechniqueDetector';

const SET_TYPE_META = {
  warmup: {
    label: 'WARM-UP',
    short: 'WU',
    full: 'Warm-up',
    card: 'bg-amber-500/10 border-amber-500/30',
    chip: 'bg-amber-600/25 border-amber-500/45 text-amber-200',
    compactLabel: 'text-amber-300'
  },
  work: {
    label: 'WORK',
    short: 'WK',
    full: 'Work',
    card: 'bg-slate-900/40 border-slate-700/50',
    chip: 'bg-slate-700/35 border-slate-600/50 text-slate-200',
    compactLabel: 'text-slate-400'
  },
  drop: {
    label: 'DROP',
    short: 'DR',
    full: 'Drop',
    card: 'bg-violet-500/10 border-violet-500/30',
    chip: 'bg-violet-600/25 border-violet-500/45 text-violet-200',
    compactLabel: 'text-violet-300'
  },
  failure: {
    label: 'FAILURE',
    short: 'FL',
    full: 'Failure',
    card: 'bg-rose-500/10 border-rose-500/30',
    chip: 'bg-rose-600/25 border-rose-500/45 text-rose-200',
    compactLabel: 'text-rose-300'
  },
  tempo: {
    label: 'TEMPO',
    short: 'TP',
    full: 'Tempo',
    card: 'bg-cyan-500/10 border-cyan-500/30',
    chip: 'bg-cyan-600/25 border-cyan-500/45 text-cyan-200',
    compactLabel: 'text-cyan-300'
  },
  pause: {
    label: 'PAUSE',
    short: 'PS',
    full: 'Pause',
    card: 'bg-indigo-500/10 border-indigo-500/30',
    chip: 'bg-indigo-600/25 border-indigo-500/45 text-indigo-200',
    compactLabel: 'text-indigo-300'
  }
};

const getSetTypeMeta = (set) => {
  const type = resolveSetType(set);
  return {
    type,
    ...(SET_TYPE_META[type] || SET_TYPE_META.work)
  };
};

const RELATIVE_LABEL = { today: 'Today', yesterday: 'Yesterday' };

const fmtInt = (n) => (Number.isFinite(Number(n)) ? Math.round(Number(n)).toLocaleString('en-US') : '0');

const SectionHeading = ({ children, hint }) => (
  <div className="mb-3">
    <h3 className="text-sm font-black text-slate-200 uppercase tracking-widest">{children}</h3>
    {hint && <p className="text-[11px] text-slate-500 font-semibold mt-1">{hint}</p>}
  </div>
);

/**
 * Session Detail 2.0 — deep understanding of ONE completed workout.
 *
 * Hierarchy: identity → summary → highlights → body map (this session only)
 * → exercise breakdown → workload → coach interpretation → notes/metadata.
 * Every number comes from domain/sessionDetail.js (canonical domain only);
 * JSX owns layout, never business logic.
 */
const SessionArticle = ({
  workout,
  allWorkouts,
  exercisesDB,
  userWeight,
  isCompact,
  onOpenExercise,
  single,
  now,
  sessionKey,
}) => {
  const summary = useMemo(
    () => getSessionSummary(workout, { exercisesDB, userWeight }),
    [workout, exercisesDB, userWeight]
  );
  const rows = useMemo(
    () => getSessionExercises(workout, { exercisesDB, userWeight }),
    [workout, exercisesDB, userWeight]
  );
  // Isolation by construction: single-element list — Workout B's map can
  // never contain Workout A data. Same component + same aggregation as
  // Statistics 2.0, scoped to this session.
  const muscle = useMemo(
    () => getSessionMuscleStats(workout, { exercisesDB, userWeight }),
    [workout, exercisesDB, userWeight]
  );
  const highlights = useMemo(
    () => getSessionHighlights(workout, allWorkouts, { exercisesDB, userWeight }),
    [workout, allWorkouts, exercisesDB, userWeight]
  );

  const durationLabel = formatSessionDuration(summary.durationMin) || '—';
  const dateLabel = formatSessionDate(workout.date) || 'Unknown date';
  const relative = relativeDay(workout.date, now);
  const maxRowVolume = Math.max(0, ...rows.map(r => r.volume));
  const exerciseByKey = useMemo(() => {
    const map = new Map();
    (workout?.exercises || []).forEach((ex, index) => {
      map.set(ex?.exerciseId ?? `index-${index}`, ex);
    });
    return map;
  }, [workout]);
  const dbById = useMemo(() => {
    const map = new Map();
    (exercisesDB || []).forEach((def) => {
      if (def?.id != null) map.set(def.id, def);
    });
    return map;
  }, [exercisesDB]);
  const comparison = highlights.comparison;
  const TrendIcon = !comparison.hasPrevious || comparison.trend === 'flat'
    ? Minus
    : comparison.trend === 'up' ? TrendingUp : TrendingDown;

  return (
    <article
      aria-labelledby={`session-${sessionKey}-title`}
      className={isCompact ? 'bg-slate-800/40 border border-slate-700/50 rounded p-2 ui-layout-morph' : 'ui-surface-secondary p-5 ui-card-mount-anim ui-layout-morph'}
    >
      {/* 1. Session identity — a historical session reads as history, never as a live workout */}
      <header className={isCompact ? 'mb-1.5 pb-1.5 border-b border-slate-700/30' : 'mb-4'}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {single ? (
              <p className="text-xs text-slate-500 font-semibold mb-1">Completed session</p>
            ) : null}
            <h2 id={`session-${sessionKey}-title`} className={isCompact ? 'text-base font-black text-white truncate' : 'text-2xl font-black text-white leading-tight'}>{workout.name || 'Untitled workout'}</h2>
            <p className="text-xs text-slate-400 mt-1 font-semibold">
              {dateLabel}
              {relative && RELATIVE_LABEL[relative] ? ` · ${RELATIVE_LABEL[relative]}` : ''}
            </p>
          </div>
          {summary.prCount > 0 && (
            <PRBadge count={summary.prCount} />
          )}
        </div>

        {!isCompact && (
          <div className="flex flex-wrap gap-2 mt-3 text-[11px] font-bold">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/60 border border-slate-700/50 text-slate-300">
              <Clock size={12} className="text-slate-500" aria-hidden="true" />
              {durationLabel}
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/60 border border-slate-700/50 text-slate-300">
              <Dumbbell size={12} className="text-slate-500" aria-hidden="true" />
              {summary.workSets}/{summary.plannedSets} work sets
              {summary.completionPct != null ? ` · ${summary.completionPct}%` : ''}
            </span>
            {summary.density != null && (
              <span className="px-2.5 py-1 rounded-full bg-slate-800/60 border border-slate-700/50 text-slate-300">
                {fmtInt(summary.density)} kg/min
              </span>
            )}
          </div>
        )}
        {isCompact && (
          <p className="text-xs text-slate-500 mt-1 font-semibold">
            <Clock size={12} className="inline mr-1" aria-hidden="true" />{durationLabel} · {summary.workSets} work sets
          </p>
        )}
      </header>

      {!isCompact && <div className="mb-4 pb-4 border-b border-slate-700/50" />}

      {!summary.hasWork ? (
        <div className="rounded-xl border ui-surface-sub p-4 text-sm text-slate-400" role="status">
          <p className="font-bold text-slate-200">No completed work sets in this session.</p>
          <p className="text-[13px] mt-1">Warm-up sets and skipped work don&apos;t count toward training output. Totals below stay at zero rather than guessing.</p>
        </div>
      ) : (
        <>
          {/* 2. Session summary — volume leads, the rest supports.
              Single dominant presentation of session facts: hero + one
              subordinate line. PRs live in the header + Highlights. */}
          {!isCompact && (
            <section aria-label="Session summary">
              <SectionHeading>Summary</SectionHeading>
              <div className="ui-surface-sub rounded-xl p-4">
                <div className="flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Session volume</p>
                    <p className="mt-1 text-4xl font-black accent-text tabular-nums leading-none">
                      {fmtInt(summary.workVolume)}
                      <span className="ml-1.5 text-sm font-semibold text-slate-500">kg</span>
                    </p>
                  </div>
                </div>
                <p className="text-[13px] text-slate-400 font-semibold mt-2 tabular-nums">
                  {fmtInt(summary.exercisesCount)} exercises · {fmtInt(summary.workSets)} sets · {fmtInt(summary.totalReps)} reps
                  {summary.density != null ? ` · ${fmtInt(summary.density)} kg/min` : ''}
                </p>
              </div>
            </section>
          )}

          {/* 3. Performance highlights — facts from THIS session only */}
          {!isCompact && (
            <section aria-label="Performance highlights" className="mt-5">
              <SectionHeading hint="Facts from this session — not a verdict on your training.">Highlights</SectionHeading>
              <ul className="space-y-2 text-sm">
                {summary.prCount > 0 && (
                  <li className="flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                    <Medal size={16} className="text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                    <span className="text-slate-200">
                      <strong className="font-bold">{summary.prCount} new PR{summary.prCount === 1 ? '' : 's'}</strong>
                      {highlights.prExercises.length > 0 && (
                        <span className="text-slate-400"> — {highlights.prExercises.join(', ')}</span>
                      )}
                    </span>
                  </li>
                )}
                {highlights.bestSet && (
                  <li className="flex items-start gap-2.5 bg-slate-800/40 border border-slate-700/50 rounded-lg p-3">
                    <Dumbbell size={16} className="text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
                    <span className="text-slate-300">
                      Best set: <strong className="text-white font-bold">{highlights.bestSet.exerciseName} — {highlights.bestSet.kg} kg × {highlights.bestSet.reps}</strong>
                      <span className="text-slate-500"> (est. 1RM {highlights.bestSet.estimated1RM} kg)</span>
                    </span>
                  </li>
                )}
                {highlights.topVolumeExercise && (
                  <li className="flex items-start gap-2.5 bg-slate-800/40 border border-slate-700/50 rounded-lg p-3">
                    <TrendingUp size={16} className="text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
                    <span className="text-slate-300">
                      Most productive lift: <strong className="text-white font-bold">{highlights.topVolumeExercise.exerciseName}</strong>
                      <span className="text-slate-500"> ({fmtInt(highlights.topVolumeExercise.volume)} kg)</span>
                    </span>
                  </li>
                )}
                {comparison.hasPrevious ? (
                  <li className="flex items-start gap-2.5 bg-slate-800/40 border border-slate-700/50 rounded-lg p-3">
                    <TrendIcon size={16} className="text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
                    <span className="text-slate-300">
                      vs {comparison.previousName}
                      {comparison.volumeDeltaPct != null && (
                        <> — volume <strong className="text-white font-bold">{comparison.volumeDeltaPct > 0 ? '+' : ''}{comparison.volumeDeltaPct}%</strong></>
                      )}
                      <span className="text-slate-500">
                        {' '}({fmtInt(comparison.volumePrevious)} → {fmtInt(comparison.volumeCurrent)} kg
                        {comparison.workSetsDelta !== 0 && (
                          <>, sets {comparison.workSetsDelta > 0 ? '+' : ''}{comparison.workSetsDelta}</>
                        )}
                        {comparison.durationDeltaMin != null && comparison.durationDeltaMin !== 0 && (
                          <>, {comparison.durationDeltaMin > 0 ? '+' : ''}{comparison.durationDeltaMin} min</>
                        )}
                        )
                      </span>
                    </span>
                  </li>
                ) : (allWorkouts || []).length > 1 ? (
                  <li className="text-xs text-slate-500">No earlier session found for comparison.</li>
                ) : null}
                {summary.prCount === 0 && !highlights.bestSet && (
                  <li className="text-xs text-slate-500">Steady session — no new records.</li>
                )}
              </ul>
            </section>
          )}

          {/* 4. Muscle Body Map — CURRENT SESSION ONLY */}
          {!isCompact && (
            <section aria-label="Muscles trained" className="mt-5 ui-surface-sub rounded-xl p-4">
              <SectionHeading hint="This session only · sets counted per muscle.">What did I train?</SectionHeading>
              {muscle.totalSets > 0 ? (
                <MuscleBodyMap
                  setsByMuscle={muscle.setsByMuscle}
                  stats={muscle}
                  workouts={[workout]}
                  exercisesDB={exercisesDB}
                />
              ) : (
                <p className="text-slate-500 text-sm">No muscle data for this session.</p>
              )}
            </section>
          )}
        </>
      )}

      {/* 5. Exercise breakdown — compact facts, depth lives in Exercise Detail */}
      <section aria-label="Exercises" className={isCompact ? 'mt-1 space-y-1' : 'mt-5'}>
        {!isCompact && <SectionHeading hint="Tap an exercise for its full history, charts and records.">Exercises</SectionHeading>}
        <div className={isCompact ? 'space-y-1' : 'space-y-2.5'}>
          {rows.length === 0 && (
            <p className="text-slate-500 text-sm">No exercises logged in this session.</p>
          )}
          {rows.map((row) => (
            <div key={row.key} className={isCompact ? 'bg-slate-900/30 rounded p-1.5' : 'bg-slate-800/40 border border-slate-700/50 rounded-lg p-3.5'}>
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <h4 className={isCompact ? 'text-xs font-black text-white truncate' : 'text-sm font-black text-white truncate'}>{row.name}</h4>
                    {row.hasPR && <Medal size={isCompact ? 12 : 14} className="text-amber-400 shrink-0" aria-label="Personal record in this exercise" />}
                  </div>
                  {!isCompact && (
                    <p className="text-[11px] text-slate-500 mt-0.5 font-semibold">
                      {row.category}
                      {row.bestSet ? ` · best ${row.bestSet.kg} × ${row.bestSet.reps}` : ''}
                      {` · ${fmtInt(row.volume)} kg`}
                    </p>
                  )}
                  {!isCompact && row.exerciseId != null && dbById.get(row.exerciseId)?.note && (
                    <p className="mt-1.5 text-[11px] accent-bg-light accent-border-light accent-text px-2 py-1 rounded">
                      {dbById.get(row.exerciseId).note}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-[11px] font-bold text-slate-400">
                  {row.workSets}/{row.planned} sets
                </span>
                {row.canOpen && onOpenExercise && !isCompact && (
                  <button
                    onClick={() => onOpenExercise(row.exerciseId)}
                    aria-label={`Open ${row.name} in Exercise Detail`}
                    className="shrink-0 inline-flex items-center gap-1 text-[12px] font-bold px-2.5 min-h-[44px] rounded-lg ui-action-secondary transition"
                  >
                    Details <ChevronRight size={12} aria-hidden="true" />
                  </button>
                )}
              </div>

              {row.skipped && !isCompact ? (
                <p className="text-[11px] text-slate-500 mt-2 italic">No completed sets — planned work was skipped.</p>
              ) : (
                <div className={isCompact ? 'mt-1 space-y-0.5' : 'mt-2.5 space-y-2'}>
                  {(exerciseByKey.get(row.key)?.sets || [])
                    ?.filter(s => s.completed)
                    .map((set, j, completedSets) => {
                      const typeMeta = getSetTypeMeta(set);
                      let workPosition = 0;
                      for (let idx = 0; idx <= j; idx += 1) {
                        if (resolveSetType(completedSets[idx]) !== 'warmup') workPosition += 1;
                      }
                      const setLabel = typeMeta.type === 'warmup' ? 'WU' : `#${workPosition}`;
                      return (
                        <div
                          key={`${row.key}-${j}-${set.kg}-${set.reps}`}
                           className={isCompact ? 'flex items-center gap-1.5 text-xs px-1 py-0.5 rounded' : `flex items-center gap-3 p-2 rounded-lg border transition-all ${typeMeta.card} ${set.isBest1RM || set.isBestSetVolume || set.isHeaviestWeight ? 'bg-amber-500/20 border-amber-500/40' : ''}`}
                        >
                          {isCompact ? (
                            <>
                              <span className={`font-bold ${typeMeta.compactLabel}`}>{setLabel}</span>
                              <span className="text-white font-bold">{set.kg}</span>
                              <span className="text-slate-500">x</span>
                              <span className="text-white">{set.reps}</span>
                              {(set.isBest1RM || set.isBestSetVolume || set.isHeaviestWeight) && (
                                <Medal size={10} className="text-amber-400 ml-auto" aria-hidden="true" />
                              )}
                            </>
                          ) : (
                            <>
                              {(set.isBest1RM || set.isBestSetVolume || set.isHeaviestWeight) && typeMeta.type !== 'warmup' && (
                                <div className="text-amber-400" title={
                                  [
                                    set.isHeaviestWeight && 'Heaviest Weight',
                                    set.isBestSetVolume && 'Best Set Volume',
                                    set.isBest1RM && 'Best 1RM'
                                  ].filter(Boolean).join(', ')
                                }>
                                  <Medal size={16} />
                                </div>
                              )}
                              {typeMeta.type !== 'work' && (
                                <div className={`w-[92px] min-w-[92px] text-center px-2 py-0.5 rounded border text-[11px] font-black tracking-wide ${typeMeta.chip}`}>
                                  {typeMeta.label}
                                </div>
                              )}
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black min-w-[2rem] ${typeMeta.type === 'warmup' ? 'bg-amber-600/20 text-amber-300 border border-amber-500/35' : 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'}`}>
                                {setLabel}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-white">
                                  {set.kg} <span className="text-slate-400 font-normal">kg</span> x {set.reps}
                                </p>
                                {(set.rir != null || set.tempo || set.pauseSec) && (
                                  <p className="text-[11px] text-slate-400 mt-0.5">
                                    {set.rir != null ? `RIR ${set.rir}` : null}
                                    {set.rir != null && (set.tempo || set.pauseSec) ? ' | ' : null}
                                    {set.tempo ? `Tempo ${set.tempo}` : null}
                                    {set.tempo && set.pauseSec ? ' | ' : null}
                                    {set.pauseSec ? `Pause ${set.pauseSec}s` : null}
                                  </p>
                                )}
                              </div>
                              <div className="text-right min-w-fit hidden min-[380px]:block">
                                <p className="text-xs text-slate-400 font-semibold">1RM</p>
                                <p className="text-sm font-black accent-text tabular-nums">
                                  {calculate1RM(set.kg, set.reps)} kg
                                </p>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 6. Workload — distribution only. Totals already live in Summary. */}
      {!isCompact && summary.hasWork && (
        <section aria-label="Workload" className="mt-5">
          <SectionHeading hint="Share of session volume per exercise. Muscle attribution above can total more — one set can train several muscles.">
            Workload
          </SectionHeading>
          <div className="ui-surface-sub rounded-xl p-4">
            <div className="space-y-2">
              {rows.filter(r => r.volume > 0).map((row) => (
                <div key={`vol-${row.key}`} className="flex items-center gap-3">
                  <span className="text-[13px] font-bold text-slate-300 w-28 sm:w-40 shrink-0 truncate">{row.name}</span>
                  <div className="flex-1 h-2 bg-slate-900/60 rounded-full overflow-hidden border border-slate-700/50">
                    <div
                      className="h-full accent-bg rounded-full"
                      style={{ width: `${maxRowVolume > 0 ? Math.round((row.volume / maxRowVolume) * 100) : 0}%` }}
                    />
                  </div>
                  <span className="text-[12px] font-semibold text-slate-400 w-16 text-right shrink-0 tabular-nums">{fmtInt(row.volume)} kg</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Workout tags + note — preserved metadata */}
      {!isCompact && workout.tags && workout.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-5" aria-label="Workout tags">
          {workout.tags.map(tag => (
            <span
              key={tag}
              className="text-xs px-2.5 py-1 rounded-full font-bold accent-bg-light accent-text accent-border-light"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {!isCompact && workout.note && (
        <div className="mt-4 bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-lg text-sm text-amber-200 italic flex gap-3">
          <FileText size={16} className="shrink-0 mt-0.5 text-amber-400" aria-hidden="true" />
          <span>{workout.note}</span>
        </div>
      )}

      {/* 7. Coach / contextual insights — reused engines, labelled as interpretation */}
      {!isCompact && (
        <section aria-label="Coach insights" className="mt-5 pt-4 border-t border-slate-700/50">
          <SectionHeading hint="Interpretation from your history — estimates to guide training, not measurements.">
            Coach
          </SectionHeading>
          <div className="mt-1 pt-1">
            <TechniqueDetector workout={workout} allWorkouts={allWorkouts} />
          </div>
          <div className="mt-4">
            <SessionDebrief workout={workout} allWorkouts={allWorkouts} exercisesDB={exercisesDB} />
          </div>
        </section>
      )}

      {/* 8. Notes / metadata — source and timestamps */}
      {!isCompact && (
        <section aria-label="Session details" className="mt-5 pt-4 border-t border-slate-700/50">
          <SectionHeading>Details</SectionHeading>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[13px]">
            <div className="ui-surface-sub rounded-lg p-3">
              <dt className="text-slate-500 font-bold uppercase tracking-wider text-[11px]">Logged</dt>
              <dd className="text-slate-300 font-semibold mt-1">{dateLabel}{(() => { const t = formatSessionTime(workout.startTime); return t ? ` · ${t}` : ''; })()}</dd>
            </div>
            <div className="ui-surface-sub rounded-lg p-3">
              <dt className="text-slate-500 font-bold uppercase tracking-wider text-[11px]">Duration</dt>
              <dd className="text-slate-300 font-semibold mt-1">{durationLabel}</dd>
            </div>
            {(workout.templateId || workout.templateSnapshot?.name) && (
              <div className="ui-surface-sub rounded-lg p-3">
                <dt className="text-slate-500 font-bold uppercase tracking-wider text-[11px]">From template</dt>
                <dd className="text-slate-300 font-semibold mt-1 truncate">{workout.templateSnapshot?.name || workout.templateId}</dd>
              </div>
            )}
          </dl>
        </section>
      )}
    </article>
  );
};

export const WorkoutDetailView = ({
  selectedDate,
  selectedWorkoutId = null,
  workouts,
  onBack,
  exercisesDB = [],
  userWeight = null,
  onOpenExercise = null,
}) => {
  // State for compact/normal view - reads and writes to localStorage
  const [isCompact, setIsCompact] = useState(() => {
    try {
      const saved = localStorage.getItem('workoutDetailCompactView');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });
  // Frozen at mount: "today" cutoffs stay stable across re-renders (and
  // satisfy react-hooks/purity — no impure clock reads during render).
  const [now] = useState(() => Date.now());

  // Save to localStorage whenever isCompact changes
  useEffect(() => {
    try {
      localStorage.setItem('workoutDetailCompactView', JSON.stringify(isCompact));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }, [isCompact]);

  const { sessions, notFound } = useMemo(() => {
    const list = Array.isArray(workouts) ? workouts : [];
    if (selectedWorkoutId != null) {
      const found = findWorkoutById(list, selectedWorkoutId);
      return { sessions: found ? [found] : [], notFound: !found };
    }
    // Day-key match (canonical): completed workouts persist full ISO
    // timestamps while callers pass local `YYYY-MM-DD` day keys — an exact
    // string match would wrongly render "No session found". Legacy
    // date-only strings still match exactly as before.
    return {
      sessions: list.filter((w) => {
        if (!w) return false;
        if (w.date === selectedDate) return true;
        const key = getLocalDayKey(w.date ?? w.startTime);
        return key != null && key === selectedDate;
      }),
      notFound: false,
    };
  }, [workouts, selectedDate, selectedWorkoutId]);

  const titleDate = sessions.length === 1 && sessions[0]?.date ? sessions[0].date : selectedDate;
  const titleDateLabel = formatSessionDate(titleDate);
  const titleRelative = titleDate ? relativeDay(titleDate, now) : null;
  const singleName = sessions.length === 1 ? sessions[0]?.name : null;

  return (
    <div className="bg-black text-white pb-16 flex flex-col min-h-0">
      {/* Header — WHEN first. The session name lives in the article below,
          so a single session never shows its name twice. */}
      <div className="bg-black/95 backdrop-blur border-b border-white/10 p-4 flex items-center justify-between gap-4 sticky top-0 z-20 shadow-2xl">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onBack} aria-label="Back" className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center hover:bg-white/10 rounded-lg transition shrink-0">
            <ChevronLeft size={24} />
          </button>
          <div className="min-w-0">
            <p className="text-xs text-slate-400 font-semibold tracking-widest">SESSION DETAIL</p>
            <h1 className="text-2xl font-black truncate">
              {titleDateLabel || 'Session'}
              {titleRelative && RELATIVE_LABEL[titleRelative] && (
                <span className="ml-2 align-middle text-[11px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider accent-bg-light accent-text accent-border-light">
                  {RELATIVE_LABEL[titleRelative]}
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-500 font-semibold mt-0.5 truncate">
              {singleName || (sessions.length > 1 ? `${sessions.length} sessions` : '')}
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsCompact(!isCompact)}
          aria-pressed={isCompact}
          aria-label={isCompact ? 'Normal view' : 'Compact view'}
          title={isCompact ? 'Normal view' : 'Compact view'}
          className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center hover:bg-white/10 rounded-lg transition text-slate-400 hover:text-white ui-press shrink-0"
        >
          {isCompact ? <List size={20} /> : <LayoutGrid size={20} />}
        </button>
      </div>

      <div className={`flex-1 overflow-y-auto transition-all duration-250 ease-out ${isCompact ? 'p-2 space-y-1.5' : 'p-4 space-y-4 max-w-3xl w-full mx-auto'}`}>
        {notFound ? (
          <div className="text-center py-12" role="status">
            <p className="text-slate-300 text-sm font-bold">Session not found.</p>
            <p className="text-slate-500 text-xs mt-2">It may have been deleted. Go back to try another session.</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12" role="status">
            <p className="text-slate-300 text-sm font-bold">No session found for this date.</p>
            <p className="text-slate-500 text-xs mt-2">The workout may have been deleted or moved.</p>
          </div>
        ) : (
          sessions.map((workout, index) => {
            const sessionKey = workout.id ?? `${workout.date ?? 'nodate'}-${index}`;
            return (
            <SessionArticle
              key={sessionKey}
              sessionKey={sessionKey}
              workout={workout}
              allWorkouts={workouts}
              exercisesDB={exercisesDB}
              userWeight={userWeight}
              isCompact={isCompact}
              onOpenExercise={onOpenExercise}
              single={sessions.length === 1}
              now={now}
            />
            );
          }))
        }
      </div>
    </div>
  );
};
