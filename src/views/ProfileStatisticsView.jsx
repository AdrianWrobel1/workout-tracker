import React, { useState, useMemo } from 'react';
import { ChevronRight, Trophy, User, Settings } from 'lucide-react';
import { MuscleBodyMap } from '../components/MuscleBodyMap';
import { SimpleLineChart } from '../components/SimpleLineChart';
import { WeekHeatmap } from '../components/WeekHeatmap';
import {
  AnalyticsHeader, AnalyticsSection, AnalyticsSubTitle, RangeSelector,
  BarRow, StatCell,
} from '../components/analyticsUI';
import { calculateReadiness, calculateMuscleBalance } from '../analytics';
import {
  STAT_RANGES, filterWorkoutsByRange, overviewStats, volumeSeries, setsSeries,
  muscleStats, consistencyStats, strengthMovers, exerciseVolumes
} from '../analytics/statistics';
import { getExerciseTrend } from '../domain/exercises';

// Map the Settings default range onto the Statistics global range.
// '1year' has no fixed window here — it maps to ALL (whole history).
const mapDefaultRange = (value) => {
  switch (value) {
    case '1week': return '7days';
    case '1month': return '30days';
    case '3months': return '3months';
    case '1year': return 'all';
    default: return STAT_RANGES.includes(value) ? value : '30days';
  }
};

const RANGE_LABEL = { '7days': '7D', '30days': '30D', '3months': '90D', all: 'ALL' };

const fmtInt = (n) => (Number.isFinite(Number(n)) ? Math.round(Number(n)).toLocaleString('en-US') : '0');
const fmtVol = (v) => `${(Number(v) / 1000).toFixed(1)}k`;

const EmptyNote = ({ children }) => (
  <p className="text-slate-500 text-sm">{children}</p>
);

/**
 * Statistics 2.0 — the central analytics hub.
 *
 * One global range (7D / 30D / 90D / ALL) drives every history-derived section
 * below: overview, body map, strength, volume, consistency numbers and the
 * exercise index. The deliberate exceptions, labelled in the UI:
 * - readiness & balance pairs are current-state models over the full history
 *   (cutting their input would corrupt the reading),
 * - the heatmap stays a 7-day anchor; ranged numbers sit beside it,
 * - exercise trend arrows use the canonical 4-week windows (domain/exercises).
 */
export const ProfileStatisticsView = ({
  workouts = [],
  exercisesDB = [],
  userWeight,
  onOpenProfile,
  onOpenSettings,
  defaultStatsRange = '3months',
  onOpenExercise
}) => {
  const [range, setRange] = useState(() => mapDefaultRange(defaultStatsRange));
  // Frozen at mount: range cutoffs stay stable across re-renders (and satisfy
  // react-hooks/purity — no impure clock reads during render).
  const [now] = useState(() => Date.now());

  const ranged = useMemo(
    () => filterWorkoutsByRange(workouts, range, now),
    [workouts, range, now]
  );
  const overview = useMemo(
    () => overviewStats(ranged, { userWeight, exercisesDB }),
    [ranged, userWeight, exercisesDB]
  );
  const mStats = useMemo(
    () => muscleStats(ranged, { userWeight, exercisesDB }),
    [ranged, userWeight, exercisesDB]
  );
  const volPts = useMemo(
    () => volumeSeries(ranged, { userWeight, exercisesDB }),
    [ranged, userWeight, exercisesDB]
  );
  const setPts = useMemo(() => setsSeries(ranged), [ranged]);
  const consistency = useMemo(
    () => consistencyStats(ranged, range, now),
    [ranged, range, now]
  );
  const movers = useMemo(() => strengthMovers(ranged, { topN: 3 }), [ranged]);
  const topExercises = useMemo(
    () => exerciseVolumes(ranged, { userWeight, exercisesDB }).slice(0, 6),
    [ranged, userWeight, exercisesDB]
  );

  // Current-state models read the FULL history — documented exception.
  const readiness = useMemo(() => calculateReadiness(workouts), [workouts]);
  const balance = useMemo(() => calculateMuscleBalance(workouts, exercisesDB), [workouts, exercisesDB]);

  const rankedAxes = useMemo(() => {
    const worked = Object.entries(mStats.setsByMuscle)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);
    const missed = Object.entries(mStats.setsByMuscle)
      .filter(([, v]) => !(v > 0))
      .map(([axis]) => axis);
    return { worked, missed };
  }, [mStats]);
  const maxSets = rankedAxes.worked.length ? rankedAxes.worked[0][1] : 0;
  const avgPerWorkout = ranged.length ? Math.round((overview.volume / ranged.length) * 10) / 10 : 0;

  const balancePairs = balance ? [balance.week && balance.block ? balance.block : balance.week, balance.week] : [];
  const pairRows = [];
  for (const scope of balancePairs) {
    if (!scope) continue;
    for (const pair of [scope.pushPull, scope.chestBack, scope.quadHam]) {
      if (pair) pairRows.push({ scope: scope.label, ...pair });
    }
  }

  return (
    <div className="bg-black text-white pb-16">
      <AnalyticsHeader
        title="STATISTICS"
        eyebrow="WHAT YOU DID · HOW YOU PROGRESS"
        actions={(
          <>
            <button
              onClick={onOpenProfile}
              className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center hover:bg-white/10 rounded-lg transition text-slate-400 hover:text-white"
              aria-label="Profile"
              title="Profile"
            >
              <User size={20} />
            </button>
            <button
              onClick={onOpenSettings}
              className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center hover:bg-white/10 rounded-lg transition text-slate-400 hover:text-white"
              aria-label="Settings"
              title="Settings"
            >
              <Settings size={20} />
            </button>
          </>
        )}
      />

      <div className="p-4 space-y-5 max-w-3xl w-full mx-auto">
        {/* Hero — one range, one primary answer (volume), secondary context */}
        <section className="ui-surface-secondary p-4 sm:p-5">
          <RangeSelector
            value={range}
            onChange={setRange}
            label="Statistics range"
            options={STAT_RANGES.map((r) => ({ value: r, label: RANGE_LABEL[r] }))}
          />
          <div className="mt-5">
            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest">
              Total volume · {RANGE_LABEL[range]}
            </p>
            <p className="mt-1 text-5xl font-black accent-text tabular-nums leading-none">
              {overview.workouts ? fmtVol(overview.volume) : '—'}
              <span className="ml-2 text-sm font-semibold text-slate-500">kg</span>
            </p>
            <p className="text-xs text-slate-500 mt-2 font-semibold">
              {overview.workouts
                ? `${overview.workouts} ${overview.workouts === 1 ? 'workout' : 'workouts'} · avg ${fmtVol(avgPerWorkout)} kg per workout`
                : 'Log a workout to start your overview.'}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-700/50">
            <StatCell label="Workouts" value={overview.workouts ? fmtInt(overview.workouts) : '—'} />
            <StatCell label="Sets" value={overview.workouts ? fmtInt(overview.sets) : '—'} />
            <StatCell label="Active days" value={overview.workouts ? overview.activeDays : '—'} />
          </div>
        </section>

        {/* Muscle Body Map — the visual centerpiece */}
        <AnalyticsSection title="Muscle Body Map" hint={`By work sets · ${RANGE_LABEL[range]}`}>
          {ranged.length === 0 ? (
            <EmptyNote>Finish your first workout to see your training map here.</EmptyNote>
          ) : (
            <>
              <MuscleBodyMap
                setsByMuscle={mStats.setsByMuscle}
                stats={mStats}
                workouts={ranged}
                exercisesDB={exercisesDB}
              />
              {rankedAxes.worked.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-700/50 space-y-2.5">
                  <AnalyticsSubTitle>Top trained</AnalyticsSubTitle>
                  {rankedAxes.worked.slice(0, 4).map(([axis, sets]) => (
                    <BarRow
                      key={axis}
                      label={axis}
                      display={`${sets} sets`}
                      pct={maxSets > 0 ? (sets / maxSets) * 100 : 0}
                    />
                  ))}
                </div>
              )}
              {rankedAxes.missed.length > 0 && (
                <div className="mt-4">
                  <AnalyticsSubTitle>Not trained in this period</AnalyticsSubTitle>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {rankedAxes.missed.map((axis) => (
                      <span key={axis} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-orange-500/15 text-orange-300 border border-orange-500/30">
                        {axis}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </AnalyticsSection>

        {/* Strength — actual logged performance in range */}
        {ranged.length > 0 && (
          <AnalyticsSection title="Strength" hint="Estimated 1RM movers · actual performance, not prescriptions">
            {movers.length === 0 ? (
              <EmptyNote>Log the same lift twice in this period to see movers.</EmptyNote>
            ) : (
              <div className="space-y-2">
                {movers.map((m) => {
                  const exName = (exercisesDB.find((e) => e.id === m.id)?.name)
                    || (ranged.flatMap((w) => w.exercises || []).find((e) => e.exerciseId === m.id)?.name)
                    || String(m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => onOpenExercise && onOpenExercise(m.id)}
                      className="w-full flex items-center gap-3 bg-slate-800/40 hover:bg-slate-800/60 border border-slate-700/50 rounded-lg p-3 transition-all text-left min-h-[44px]"
                    >
                      <Trophy size={16} className="text-amber-400 shrink-0" aria-hidden="true" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-bold text-white truncate">{exName}</span>
                        <span className="block text-xs text-slate-500 font-semibold mt-0.5 tabular-nums">
                          {m.sessions} sessions · {fmtInt(m.first)} → {fmtInt(m.last)} kg
                        </span>
                      </span>
                      <span className={`text-sm font-black shrink-0 tabular-nums ${m.delta > 0 ? 'text-emerald-400' : m.delta < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                        {m.delta > 0 ? '+' : ''}{fmtInt(m.delta)}
                      </span>
                      <ChevronRight size={16} className="text-slate-600 shrink-0" aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            )}
          </AnalyticsSection>
        )}

        {/* Volume */}
        {ranged.length > 0 && (
          <AnalyticsSection title="Volume" hint="One point per workout — no bucketing assumptions">
            <AnalyticsSubTitle>Volume per workout</AnalyticsSubTitle>
            <div className="mt-2">
              <SimpleLineChart data={volPts} color="#3b82f6" unit="kg" />
            </div>
            <div className="mt-5 mb-2">
              <AnalyticsSubTitle>Sets per workout</AnalyticsSubTitle>
            </div>
            <SimpleLineChart data={setPts} color="#8b5cf6" unit="sets" />
            <p className="text-xs text-slate-500 mt-3 font-semibold tabular-nums">
              Total {fmtVol(overview.volume)} kg · avg {fmtVol(avgPerWorkout)} kg per workout
            </p>
            {ranged.length < 2 && (
              <p className="text-xs text-slate-500 mt-1 font-semibold">Log at least two workouts for a readable trend.</p>
            )}
          </AnalyticsSection>
        )}

        {/* Balance & readiness — current-state models over the FULL history */}
        <AnalyticsSection
          title="Balance & Readiness"
          hint="Current state from full history · estimates to guide training, not medical advice"
        >
          {readiness && (
            <div className="flex items-center gap-4 pb-4 mb-4 border-b border-slate-700/50">
              <p className="text-5xl font-black text-white tabular-nums leading-none">{readiness.readinessScore}</p>
              <div className="min-w-0">
                <p className="text-sm font-black text-white capitalize">{readiness.status}</p>
                <p className="text-xs text-slate-400 font-semibold mt-0.5">{readiness.suggestion}</p>
              </div>
            </div>
          )}
          {pairRows.length === 0 ? (
            <EmptyNote>Train opposing movement patterns to see balance pairs.</EmptyNote>
          ) : (
            <div className="space-y-3">
              {pairRows.map((pair, i) => (
                <div key={`${pair.scope}-${pair.sideA}-${i}`}>
                  <div className="flex justify-between items-center mb-1.5 gap-2">
                    <span className="text-sm font-bold text-white truncate">
                      {pair.sideA} <span className="text-slate-500 font-semibold">vs {pair.sideB}</span>
                    </span>
                    <span className={`text-[11px] font-bold uppercase tracking-wide shrink-0 ${
                      pair.status === 'balanced' ? 'text-emerald-400' : pair.status === 'slight' ? 'text-amber-300' : 'text-red-400'
                    }`}>
                      {pair.status === 'balanced' ? 'Balanced' : pair.status === 'slight' ? 'Slight gap' : 'Imbalanced'}
                    </span>
                  </div>
                  <div className="flex h-2 bg-slate-800/50 rounded-full overflow-hidden border border-slate-700/50">
                    <div className="h-full bg-blue-500/80" style={{ width: `${pair.sideAValue + pair.sideBValue > 0 ? Math.round((pair.sideAValue / (pair.sideAValue + pair.sideBValue)) * 100) : 50}%` }} />
                    <div className="h-full bg-purple-500/80 flex-1" />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 font-semibold tabular-nums">
                    {pair.sideAValue} vs {pair.sideBValue} sets · {pair.scope}
                  </p>
                </div>
              ))}
            </div>
          )}
        </AnalyticsSection>

        {/* Consistency */}
        <AnalyticsSection title="Consistency" hint="Last 7 days plus your range numbers">
          <WeekHeatmap workouts={workouts} />
          <div className="grid grid-cols-2 gap-2 mt-4">
            <StatCell label={`Active days · ${RANGE_LABEL[range]}`} value={consistency.activeDays} />
            <StatCell label="Per week" value={consistency.perWeek} />
          </div>
          {consistency.workouts === 0 && (
            <p className="text-slate-500 text-sm mt-3">No workouts in this period yet.</p>
          )}
        </AnalyticsSection>

        {/* Exercise progress index — full curves live in the detail screen */}
        <AnalyticsSection title="Exercise Progress" hint="Top by volume in range · tap for history, charts and records">
          {topExercises.length === 0 ? (
            <EmptyNote>Finish your first workout to see progress curves here.</EmptyNote>
          ) : (
            <div className="space-y-2">
              {topExercises.map((row) => {
                const trend = getExerciseTrend(row.id, workouts);
                return (
                  <button
                    key={row.id}
                    onClick={() => onOpenExercise && onOpenExercise(row.id)}
                    className="w-full flex items-center gap-3 bg-slate-800/40 hover:bg-slate-800/60 border border-slate-700/50 rounded-lg p-3 transition-all text-left min-h-[44px]"
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-bold text-white truncate">{row.name}</span>
                      <span className="block text-xs text-slate-500 font-semibold mt-0.5 tabular-nums">
                        {row.sessions} {row.sessions === 1 ? 'session' : 'sessions'} · best {fmtInt(row.bestKg)} × {row.bestReps} · {fmtVol(row.volume)} kg
                      </span>
                    </span>
                    <span
                      className={`text-lg font-black shrink-0 ${trend === '↑' ? 'text-emerald-400' : trend === '↓' ? 'text-red-400' : 'text-slate-500'}`}
                      title="4-week trend"
                      aria-label={`4-week trend ${trend === '↑' ? 'up' : trend === '↓' ? 'down' : 'flat'}`}
                    >
                      {trend}
                    </span>
                    <ChevronRight size={16} className="text-slate-600 shrink-0" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          )}
        </AnalyticsSection>
      </div>
    </div>
  );
};

export default ProfileStatisticsView;
