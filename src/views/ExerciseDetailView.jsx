import React, { useState, useMemo } from 'react';
import { ChevronLeft, Trophy, Medal } from 'lucide-react';
import { UnifiedChart } from '../components/UnifiedChart';
import { VirtualList } from '../components/VirtualList';
import { AnalyticsTitle, RangeSelector, ActualPill, RecommendedPill } from '../components/analyticsUI';
import { formatLastSetDate } from '../domain/calculations';
import { detectPlateau } from '../analytics/plateau';
import { formatRestTime } from '../domain/restTimer';
import { getExerciseDetailModel } from '../domain/exerciseDetail';

const ENABLE_PLATEAU_ALERT = true;

const STATE_BADGE = {
  UP: { label: 'Progress', classes: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  REP_UP: { label: 'More reps', classes: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  HOLD: { label: 'Hold', classes: 'bg-slate-500/15 text-slate-300 border-slate-500/30' },
  STALL: { label: 'Stalled', classes: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  DELOAD: { label: 'Deload', classes: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
  NO_HISTORY: { label: 'No history', classes: 'bg-slate-500/15 text-slate-400 border-slate-700/50' },
};

const fmtInt = (n) => (Number.isFinite(Number(n)) ? Math.round(Number(n)).toLocaleString('en-US') : '—');
const fmtVol = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v)).toLocaleString('en-US') : '—');
const fmtDate = (d) => {
  if (!d) return '—';
  const t = new Date(d);
  if (Number.isNaN(t.getTime())) return '—';
  return t.toLocaleDateString('en-US', { day: 'numeric', month: 'short', weekday: 'short' });
};

const SectionTitle = AnalyticsTitle;

const SessionRow = ({ session, onOpenWorkout }) => (
  <div className="ui-surface-sub rounded-xl p-3">
    <div className="flex justify-between items-baseline gap-2 mb-2 min-w-0">
      <button
        onClick={() => onOpenWorkout && onOpenWorkout(session.date)}
        className="font-black accent-text text-sm truncate hover:opacity-80 focus-visible:outline-2 focus-visible:outline-blue-400 rounded min-h-[44px] inline-flex items-center"
        aria-label={`Open workout ${session.date}`}
      >
        {fmtDate(session.date)}
      </button>
      <span className="text-[13px] text-slate-400 font-bold shrink-0 tabular-nums">
        1RM <span className="text-slate-200">{session.max1RM > 0 ? `${fmtInt(session.max1RM)} kg` : '—'}</span>
      </span>
    </div>
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-slate-400 font-semibold mb-2 tabular-nums">
      <span>{session.workSetsCount} {session.workSetsCount === 1 ? 'set' : 'sets'}</span>
      {session.topSet && (
        <span className="text-slate-200">
          Top {fmtInt(session.topSet.kg)}×{fmtInt(session.topSet.reps)}
        </span>
      )}
      <span>{fmtVol(session.volume)} kg</span>
    </div>
    <div className="flex flex-wrap gap-1.5">
      {session.sets.map((set, idx) => {
        const flagged = set.isBest1RM || set.isBestSetVolume || set.isHeaviestWeight;
        return (
          <button
            key={`${session.date}-${set.kg}-${set.reps}-${idx}`}
            onClick={() => onOpenWorkout && onOpenWorkout(session.date)}
            className={`px-2.5 min-h-[44px] rounded-lg text-[13px] border transition flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-blue-400 ${
              flagged
                ? 'bg-amber-500/20 border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-slate-900/50 hover:bg-slate-700/60 border-slate-700/50 hover:border-slate-600/50'
            }`}
            title={
              flagged
                ? [
                    set.isHeaviestWeight && 'Heaviest Weight',
                    set.isBestSetVolume && 'Best Set Volume',
                    set.isBest1RM && 'Best 1RM',
                  ]
                    .filter(Boolean)
                    .join(', ')
                : ''
            }
            aria-label={flagged ? `${set.kg} by ${set.reps}, personal record` : `${set.kg} by ${set.reps}`}
          >
            {flagged && <Medal size={12} className="text-amber-400" aria-hidden="true" />}
            <span className="font-black text-white">{set.kg}</span>
            <span className="text-slate-500">×</span>
            <span className="text-slate-300">{set.reps}</span>
          </button>
        );
      })}
    </div>
  </div>
);

const ExerciseDetailViewInner = ({
  exerciseId,
  workouts,
  exercisesDB,
  onBack,
  onOpenWorkout,
  userWeight,
  globalRestSec,
}) => {
  const [chartPeriod, setChartPeriod] = useState('3months');
  const [showAll, setShowAll] = useState(false);

  const model = useMemo(
    () =>
      getExerciseDetailModel({ exerciseId, workouts, exercisesDB, userWeight, globalRestSec }),
    [exerciseId, workouts, exercisesDB, userWeight, globalRestSec]
  );
  const plateau = useMemo(() => detectPlateau(exerciseId, workouts), [exerciseId, workouts]);

  if (!model || model.found !== true) {
    return (
      <div className="bg-black text-white flex flex-col min-h-dvh overflow-x-hidden">
        <div className="p-4 flex items-center gap-3 border-b border-white/10">
          <button
            onClick={onBack}
            className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center hover:bg-white/10 rounded-lg transition focus-visible:outline-2 focus-visible:outline-blue-400"
            aria-label="Back"
          >
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-xl font-black">Exercise not found</h1>
        </div>
        <p className="p-4 text-sm text-slate-400">
          This exercise is no longer in your library. Your logged history is kept with past workouts.
        </p>
      </div>
    );
  }

  const rec = model.hasRecommendation ? model.recommendation : null;
  const badge = rec ? STATE_BADGE[rec.state] || STATE_BADGE.HOLD : null;
  const sessionsToShow = showAll ? model.sessions : model.recentSessions;
  const useVirtualList = showAll && sessionsToShow.length > 100;

  return (
    <div className="bg-black text-white flex flex-col min-h-dvh overflow-x-hidden">
      {/* Header — compact identity hero: who, what matters, latest + best */}
      <div className="bg-black/95 backdrop-blur border-b border-white/10 p-4 sticky top-0 z-20 shadow-2xl">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center hover:bg-white/10 rounded-lg transition shrink-0 focus-visible:outline-2 focus-visible:outline-blue-400"
            aria-label="Back"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black leading-tight truncate">{model.identity.name}</h1>
            <p className="text-xs text-slate-400 mt-0.5 font-semibold truncate">
              {model.identity.category} • {model.identity.muscleLine || 'General'}
            </p>
            {(model.hasBest || model.latest?.topSet) && (
              <p className="text-[12px] text-slate-500 mt-0.5 font-semibold tabular-nums truncate">
                {model.hasBest && model.best.best1RM > 0 ? `Best ${fmtInt(model.best.best1RM)} kg` : ''}
                {model.hasBest && model.best.best1RM > 0 && model.latest?.topSet ? ' · ' : ''}
                {model.latest?.topSet ? `Latest ${fmtInt(model.latest.topSet.kg)}×${fmtInt(model.latest.topSet.reps)}` : ''}
              </p>
            )}
            <p className="text-[12px] text-slate-500 mt-0.5 font-semibold">
              Rest {formatRestTime(model.rest.effectiveSec)}
              {model.rest.isOverride ? ' · exercise override' : ' · global default'}
              {model.identity.usesBodyweight ? ' · includes bodyweight' : ''}
            </p>
          </div>
        </div>
      </div>

      {ENABLE_PLATEAU_ALERT && plateau?.isPlateau && (
        <div className="px-4 py-3 border-b border-amber-500/20 bg-amber-500/10" role="status">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-black tracking-wider text-amber-300 uppercase">
              Plateau Risk ({plateau.confidence})
            </p>
            <span className="text-[11px] font-semibold text-amber-200">
              {plateau.lastImprovementSessionsAgo} sessions without improvement
            </span>
          </div>
          <p className="text-xs text-amber-100/90 mt-1">
            Stagnation: {plateau.stagnationType} • exposures checked: {plateau.exposuresChecked}
          </p>
        </div>
      )}

      <div className="p-4 space-y-5 grow pb-16 max-w-3xl w-full mx-auto">
        {/* ACTUAL — latest performance */}
        <section aria-labelledby="ed-latest">
          <div className="flex items-center gap-2 mb-2">
            <SectionTitle id="ed-latest" hint="Most recent logged session — what you actually did">
              Latest performance
            </SectionTitle>
            <ActualPill />
          </div>
          {!model.latest ? (
            <p className="text-sm text-slate-400 ui-surface-sub rounded-xl p-4">
              No sessions logged for this exercise yet. Log a workout to see your latest performance here.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div className="ui-surface-sub rounded-xl p-3 text-center min-w-0">
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mb-1">Last top set</p>
                <p className="text-lg font-black text-white tabular-nums">
                  {model.latest.topSet ? `${fmtInt(model.latest.topSet.kg)}×${fmtInt(model.latest.topSet.reps)}` : '—'}
                </p>
                <p className="text-[12px] text-slate-500 font-semibold mt-0.5">{fmtDate(model.latest.date)}</p>
              </div>
              <div className="ui-surface-sub rounded-xl p-3 text-center min-w-0">
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mb-1">Last 1RM</p>
                <p className="text-lg font-black text-white tabular-nums">
                  {model.latest.max1RM > 0 ? `${fmtInt(model.latest.max1RM)} kg` : '—'}
                </p>
                <p className="text-[12px] text-slate-500 font-semibold mt-0.5">estimated</p>
              </div>
              <div className="ui-surface-sub rounded-xl p-3 text-center min-w-0">
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mb-1">Last sets</p>
                <p className="text-lg font-black text-white tabular-nums">{fmtInt(model.latest.workSetsCount)}</p>
                <p className="text-[12px] text-slate-500 font-semibold mt-0.5">work sets</p>
              </div>
              <div className="ui-surface-sub rounded-xl p-3 text-center min-w-0">
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mb-1">Last volume</p>
                <p className="text-lg font-black text-white tabular-nums">{fmtVol(model.latest.volume)} kg</p>
                <p className="text-[12px] text-slate-500 font-semibold mt-0.5">this exercise</p>
              </div>
            </div>
          )}
        </section>

        {/* BEST / PR */}
        <section aria-labelledby="ed-best">
          <SectionTitle id="ed-best" hint="All-time records — same PR rules as everywhere else">
            Best
          </SectionTitle>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="col-span-2 bg-amber-500/10 border border-amber-500/30 rounded-xl flex flex-col items-center justify-center text-center p-4">
              <Trophy className="text-amber-400 mb-2" size={28} aria-hidden="true" />
              <div className="text-3xl font-black text-white tabular-nums">
                {model.hasBest && model.best.best1RM > 0 ? fmtInt(model.best.best1RM) : '—'}{' '}
                <span className="text-base font-normal text-slate-400">kg</span>
              </div>
              <div className="text-[11px] text-amber-300 font-black uppercase tracking-wider mt-1">
                All-time best 1RM
              </div>
              {model.best.best1RMDate && (
                <div className="text-[12px] text-slate-500 mt-1.5 font-semibold">
                  Set {formatLastSetDate(model.best.best1RMDate)}
                </div>
              )}
            </div>
            <div className="ui-surface-sub rounded-xl p-3 text-center min-w-0">
              <div className="text-[11px] text-slate-400 uppercase font-black tracking-widest mb-1">Max weight</div>
              <div className="text-2xl font-black text-white truncate tabular-nums">
                {model.hasBest && model.best.heaviestWeight > 0 ? fmtInt(model.best.heaviestWeight) : '—'}{' '}
                <span className="text-xs font-normal text-slate-500">kg</span>
              </div>
              {model.best.heaviestWeightDate && (
                <div className="text-[12px] text-slate-500 mt-1 font-semibold">
                  {formatLastSetDate(model.best.heaviestWeightDate)}
                </div>
              )}
            </div>
            <div className="ui-surface-sub rounded-xl p-3 text-center min-w-0">
              <div className="text-[11px] text-slate-400 uppercase font-black tracking-widest mb-1">Max reps</div>
              <div className="text-2xl font-black text-white truncate tabular-nums">
                {model.hasBest && model.best.maxReps > 0 ? fmtInt(model.best.maxReps) : '—'}{' '}
                <span className="text-xs font-normal text-slate-500">reps</span>
              </div>
              {model.best.maxRepsDate && (
                <div className="text-[12px] text-slate-500 mt-1 font-semibold">
                  {formatLastSetDate(model.best.maxRepsDate)}
                </div>
              )}
            </div>
          </div>
          {!model.hasBest && (
            <p className="text-xs text-slate-500 mt-2 font-semibold">
              No records yet — they appear after your first logged work sets.
            </p>
          )}
        </section>

        {/* RECOMMENDED — next prescription (Progression Engine V1, consumed) */}
        <section aria-labelledby="ed-next" aria-live="polite">
          <div className="flex items-center gap-2 mb-2">
            <SectionTitle id="ed-next" hint="Suggested starting point for the next session — not yet achieved">
              Next session
            </SectionTitle>
            <RecommendedPill />
          </div>
          {!rec ? (
            <p className="text-sm text-slate-400 ui-surface-sub rounded-xl p-4">
              No recommendation available
              {!model.hasHistory
                ? ' — log at least one session first.'
                : ' — this exercise uses legacy suggestions from your last session.'}
            </p>
          ) : (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 flex-wrap">
                {badge && (
                  <span
                    className={`text-[11px] font-black uppercase tracking-widest px-2 py-1 rounded-full border ${badge.classes}`}
                  >
                    {badge.label}
                  </span>
                )}
                {rec.source && rec.source !== 'progression' && (
                  <span className="text-[12px] text-slate-400 font-semibold">Based on your last session</span>
                )}
              </div>
              <p className="text-2xl font-black text-white mt-2">
                {rec.prescriptionText || `${fmtInt(rec.suggestedKg)} kg × ${fmtInt(rec.suggestedReps)}`}
              </p>
              {rec.prescription?.sets ? (
                <p className="text-xs text-slate-400 font-semibold mt-0.5">× {rec.prescription.sets} sets</p>
              ) : null}
              {rec.whyText && <p className="text-sm text-slate-300 mt-2">{rec.whyText}</p>}
            </div>
          )}
        </section>

        {/* HOW AM I PROGRESSING — single highest-signal chart */}
        <section aria-labelledby="ed-progress">
          <SectionTitle id="ed-progress" hint={model.chartContext || 'Estimated 1RM over time'}>
            Progress
          </SectionTitle>
          <div className="mt-2 mb-3">
            <RangeSelector
              value={chartPeriod}
              onChange={setChartPeriod}
              label="Chart period"
              options={[
                { value: '7days', label: '7D' },
                { value: '30days', label: '30D' },
                { value: '3months', label: '3M' },
                { value: '1year', label: '1Y' },
              ]}
            />
          </div>
          <div
            className="ui-surface-sub rounded-xl p-3"
            role="img"
            aria-label={`Estimated 1RM progress chart for ${model.identity.name}. ${model.chartContext || ''}`}
          >
            <UnifiedChart
              workouts={workouts}
              exerciseId={exerciseId}
              metric="weight"
              timePeriod={chartPeriod}
              color="#3b82f6"
              unit="kg"
              userWeight={userWeight}
              exercisesDB={exercisesDB}
              enableAdvancedInteractions={false}
            />
          </div>
        </section>

        {/* WHAT HAVE I DONE — recent actual sessions */}
        <section aria-labelledby="ed-sessions">
          <SectionTitle
            id="ed-sessions"
            hint={`Actual logged sessions${model.sessionsCount ? ` · ${model.sessionsCount} total` : ''}`}
          >
            Recent sessions
          </SectionTitle>
          {!model.hasHistory ? (
            <p className="text-sm text-slate-400 ui-surface-sub rounded-xl p-4 mt-2">
              No history yet — your sessions will appear here after your first workout with this exercise.
            </p>
          ) : (
            <div className="space-y-2 mt-2">
              {useVirtualList ? (
                <VirtualList
                  items={sessionsToShow}
                  itemHeight={200}
                  overscan={5}
                  renderItem={(session) => (
                    <div key={session.date} className="pb-2">
                      <SessionRow session={session} onOpenWorkout={onOpenWorkout} />
                    </div>
                  )}
                />
              ) : (
                sessionsToShow.map((session) => (
                  <SessionRow key={session.date} session={session} onOpenWorkout={onOpenWorkout} />
                ))
              )}
              {model.hasMoreSessions && !showAll && (
                <button
                  onClick={() => setShowAll(true)}
                  aria-expanded="false"
                  className="ui-action-secondary w-full py-3 min-h-[48px] rounded-xl text-sm font-bold hover:opacity-90 transition focus-visible:outline-2 focus-visible:outline-blue-400"
                >
                  Show all {model.sessionsCount} sessions
                </button>
              )}
              {showAll && (
                <button
                  onClick={() => setShowAll(false)}
                  aria-expanded="true"
                  className="ui-action-secondary w-full py-3 min-h-[48px] rounded-xl text-sm font-bold hover:opacity-90 transition focus-visible:outline-2 focus-visible:outline-blue-400"
                >
                  Show fewer
                </button>
              )}
            </div>
          )}
        </section>

        {/* EXERCISE WORKLOAD — exercise volume only */}
        <section aria-labelledby="ed-workload">
          <SectionTitle id="ed-workload" hint="This exercise only — no muscle attribution mixed in">
            Workload
          </SectionTitle>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="ui-surface-sub rounded-xl p-3 text-center min-w-0">
              <p className="text-lg font-black text-white tabular-nums">
                {model.hasHistory ? fmtVol(model.workload.totalVolume) : '—'}
              </p>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mt-1">Total kg</p>
            </div>
            <div className="ui-surface-sub rounded-xl p-3 text-center min-w-0">
              <p className="text-lg font-black text-white tabular-nums">
                {model.hasHistory ? fmtVol(model.workload.avgVolume) : '—'}
              </p>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mt-1">Avg / session</p>
            </div>
            <div className="ui-surface-sub rounded-xl p-3 text-center min-w-0">
              <p className="text-lg font-black text-white tabular-nums">{model.hasHistory ? fmtInt(model.workload.totalSets) : '—'}</p>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mt-1">Work sets</p>
            </div>
            <div className="ui-surface-sub rounded-xl p-3 text-center min-w-0">
              <p className="text-lg font-black text-white tabular-nums">
                {model.hasHistory ? `${model.workload.sessions} ×` : '—'}
              </p>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mt-1">
                Sessions{model.hasHistory && model.workload.perWeek > 0 ? ` · ${model.workload.perWeek}/wk` : ''}
              </p>
            </div>
          </div>
        </section>

        {/* MUSCLE INFORMATION — canonical taxonomy only */}
        <section aria-labelledby="ed-muscles">
          <SectionTitle
            id="ed-muscles"
            hint={model.muscles.explicit ? 'From this exercise' : 'From its category — edit the exercise to refine'}
          >
            Muscles
          </SectionTitle>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30">
              {model.muscles.primary}
              <span className="sr-only"> (primary)</span>
            </span>
            {model.muscles.secondary.map((m) => (
              <span
                key={m}
                className="text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-700/50 text-slate-300 border border-slate-600/50"
              >
                {m}
              </span>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export const ExerciseDetailView = React.memo(ExerciseDetailViewInner);
