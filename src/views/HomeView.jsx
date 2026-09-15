import React, { useState, useMemo } from 'react';
import {
  Zap, ChevronRight, Calendar, LayoutTemplate, Plus, Flame,
  Trophy, Scale, Activity, X, Check
} from 'lucide-react';
import { getWeekWorkouts, getMonthWorkouts, getMonthLabel } from '../domain/workouts';
import { WeekHeatmap } from '../components/WeekHeatmap';
import { EliteCoachingCard } from '../components/EliteCoachingCard';
import { calculateTotalVolume, formatDate } from '../domain/calculations';
import { generateEliteCoaching } from '../domain/eliteCoachingEngine';
import { pickPrimaryInsightKey } from './homeInsights';

const toneChip = (tone) => {
  switch (tone) {
    case 'warn': return 'text-amber-300 border-amber-500/30 bg-amber-500/10';
    case 'bad': return 'text-rose-300 border-rose-500/30 bg-rose-500/10';
    case 'good': return 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10';
    case 'info': return 'text-sky-300 border-sky-500/30 bg-sky-500/10';
    default: return 'text-slate-300 border-slate-500/30 bg-slate-500/10';
  }
};

const getPairTone = (status) => {
  if (status === 'imbalanced') return 'text-rose-300 bg-rose-500/10 border-rose-500/30';
  if (status === 'slight') return 'text-amber-300 bg-amber-500/10 border-amber-500/30';
  return 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30';
};

const getPairLabel = (pair) => {
  if (!pair) return '-';
  if (!Number.isFinite(pair.ratio)) return `${pair.sideA} heavy`;
  return `${pair.ratio.toFixed(2)}x`;
};

const getPairSplit = (pair) => {
  const sideAValue = Number(pair?.sideAValue) || 0;
  const sideBValue = Number(pair?.sideBValue) || 0;
  const total = sideAValue + sideBValue;
  if (total <= 0) {
    return { sideAPct: 50, sideBPct: 50, sideAValue: 0, sideBValue: 0 };
  }
  return {
    sideAPct: (sideAValue / total) * 100,
    sideBPct: (sideBValue / total) * 100,
    sideAValue,
    sideBValue
  };
};

const readinessTone = (status) => {
  if (status === 'fatigue') return 'warn';
  if (status === 'low') return 'info';
  return 'good';
};

/* --- Quick Insights 3.0: one primary signal + up to 3 supporting rows --- */
const QuickInsightsSection = ({ workouts, readiness, muscleBalance, masteryData, anomalyDetection }) => {
  const [detailModal, setDetailModal] = useState(null); // 'readiness' | 'balance' | 'coaching' | null

  const coaching = useMemo(
    () => generateEliteCoaching(workouts, readiness, masteryData, anomalyDetection),
    [workouts, readiness, masteryData, anomalyDetection]
  );

  // PRs logged this week (existing prStatus shape, unchanged logic)
  const thisWeekPRs = useMemo(() => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const prs = [];
    (workouts || []).forEach(w => {
      const wDate = new Date(w.date);
      if (wDate >= weekStart) {
        Object.entries(w.prStatus || {}).forEach(([, status]) => {
          if (status.recordsPerSet && typeof status.recordsPerSet === 'object') {
            Object.entries(status.recordsPerSet).forEach(([setIdx, records]) => {
              if (Array.isArray(records) && records.length > 0) {
                prs.push({ exerciseName: status.exerciseName, recordTypes: records, setIndex: setIdx });
              }
            });
          }
        });
      }
    });
    return prs;
  }, [workouts]);

  // 12-week consistency (existing logic, reused — not a new engine)
  const consistencyData = useMemo(() => {
    const now = new Date();
    const weeksData = new Map();

    (workouts || []).forEach(w => {
      const wDate = new Date(w.date);
      const normalized = new Date(wDate);
      const day = (normalized.getDay() + 6) % 7; // Monday = 0
      normalized.setDate(normalized.getDate() - day);
      normalized.setHours(0, 0, 0, 0);
      const weekKey = normalized.toISOString().split('T')[0];
      weeksData.set(weekKey, true);
    });

    let count = 0;
    for (let i = 0; i < 12; i++) {
      const weekEnd = new Date(now);
      weekEnd.setDate(now.getDate() - (i * 7));
      weekEnd.setHours(0, 0, 0, 0);
      const normalized = new Date(weekEnd);
      const day = (normalized.getDay() + 6) % 7;
      normalized.setDate(normalized.getDate() - day);
      normalized.setHours(0, 0, 0, 0);
      const weekKey = normalized.toISOString().split('T')[0];
      if (weeksData.has(weekKey)) count += 1;
    }

    return { activeWeeks: count, totalWeeks: 12, consistency: Math.round((count / 12) * 100) };
  }, [workouts]);

  // This week vs last week volume (Monday-based weeks, existing volume math).
  // Cheaper than the old 12-week chart scan: two bounded range filters.
  const volumeSignal = useMemo(() => {
    const startOfWeek = (d) => {
      const copy = new Date(d);
      copy.setHours(0, 0, 0, 0);
      const day = (copy.getDay() + 6) % 7;
      copy.setDate(copy.getDate() - day);
      return copy;
    };
    const sumRange = (from, to) => (workouts || [])
      .filter(w => {
        const wDate = new Date(w.date);
        return wDate >= from && wDate <= to;
      })
      .reduce((sum, w) => sum + (w.exercises || []).reduce(
        (exSum, ex) => exSum + calculateTotalVolume(ex.sets || []), 0
      ), 0);

    const now = new Date();
    const thisMonday = startOfWeek(now);
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(thisMonday.getDate() - 7);
    const lastSunday = new Date(thisMonday);
    lastSunday.setDate(thisMonday.getDate() - 1);

    const thisVol = Math.round(sumRange(thisMonday, now));
    const lastVol = Math.round(sumRange(lastMonday, lastSunday));

    let why;
    if (lastVol > 0) {
      const pct = Math.round(((thisVol - lastVol) / lastVol) * 100);
      why = pct === 0 ? 'Even with last week' : `${pct > 0 ? '+' : ''}${pct}% vs last week`;
    } else if (thisVol > 0) {
      why = 'First logged week in range';
    } else {
      why = 'No volume logged yet';
    }
    return { thisVol, why };
  }, [workouts]);

  const pairs = [
    { key: 'pushPull', label: 'Push / Pull' },
    { key: 'chestBack', label: 'Chest / Back' },
    { key: 'quadHam', label: 'Quads / Ham' }
  ];
  const imbalancedPair = pairs.find(p => muscleBalance?.week?.[p.key]?.status === 'imbalanced');
  const pushPull = muscleBalance?.week?.pushPull;

  const readinessStatus = readiness?.status || null;
  const weekPRCount = thisWeekPRs.length;

  // All candidate signals, built from data the app already computes.
  const signals = {
    readiness: {
      key: 'readiness',
      kind: 'data',
      eyebrow: 'Recovery signal',
      title: readinessStatus === 'fatigue' ? 'Fatigue is elevated' : readinessStatus === 'low' ? 'Ease back in' : 'Ready to train',
      metric: `${readiness?.readinessScore ?? 0}`,
      metricSuffix: '/ 100',
      why: readiness?.suggestion || 'Train as planned.',
      tone: readinessTone(readinessStatus),
      chip: readinessStatus || 'no data',
      modal: 'readiness'
    },
    balance: {
      key: 'balance',
      kind: 'data',
      eyebrow: 'Muscle balance',
      title: imbalancedPair ? `${imbalancedPair.label} needs attention` : 'Balance looks even',
      metric: pushPull ? getPairLabel(pushPull) : '-',
      metricSuffix: 'push/pull',
      why: imbalancedPair
        ? `One side is pulling ahead — favor the weaker side next session.`
        : 'Push, pull and legs are within a healthy range.',
      tone: imbalancedPair ? 'bad' : 'good',
      chip: imbalancedPair ? 'imbalanced' : 'balanced',
      modal: 'balance'
    },
    records: {
      key: 'records',
      kind: 'data',
      eyebrow: 'Strength progression',
      title: weekPRCount === 1 ? '1 personal record this week' : `${weekPRCount} personal records this week`,
      metric: `${weekPRCount}`,
      metricSuffix: weekPRCount === 1 ? 'PR' : 'PRs',
      why: thisWeekPRs.slice(0, 2).map(pr => pr.exerciseName).join(' · ') || 'Keep showing up — records follow consistency.',
      tone: 'good',
      chip: 'this week',
      modal: null
    },
    consistency: {
      key: 'consistency',
      kind: 'data',
      eyebrow: 'Consistency',
      title: `${consistencyData.activeWeeks} of the last 12 weeks active`,
      metric: `${consistencyData.consistency}`,
      metricSuffix: '%',
      why: 'One session every week beats sporadic intensity.',
      tone: 'info',
      chip: '12-week',
      modal: null
    },
    volume: {
      key: 'volume',
      kind: 'data',
      eyebrow: 'Weekly volume',
      title: `${volumeSignal.thisVol.toLocaleString()} kg lifted this week`,
      metric: null,
      metricSuffix: null,
      why: volumeSignal.why,
      tone: 'neutral',
      chip: 'volume',
      modal: null
    },
    coaching: {
      key: 'coaching',
      kind: 'interpretation',
      eyebrow: 'Coaching signal · interpretation, not data',
      title: coaching?.trainingZone ? `${coaching.trainingZone} focus` : 'No coaching signal yet',
      metric: null,
      metricSuffix: null,
      why: coaching?.trainingZone
        ? `${coaching.repRange || '—'} reps · ${coaching.sets || '—'} sets${coaching.rirTarget ? ` · RIR ${coaching.rirTarget}` : ''}`
        : 'Log a session to unlock guidance.',
      tone: 'neutral',
      chip: 'AI',
      modal: 'coaching'
    }
  };

  const primaryKey = pickPrimaryInsightKey({
    hasHistory: (workouts || []).length > 0,
    readinessStatus,
    hasImbalance: Boolean(imbalancedPair),
    weekPRCount
  });
  const primary = primaryKey ? signals[primaryKey] : null;
  const supportingOrder = ['records', 'consistency', 'volume', 'balance', 'readiness', 'coaching'];
  const supporting = supportingOrder.filter(k => k !== primaryKey).slice(0, 3).map(k => signals[k]);
  const showsInterpretation = primaryKey === 'coaching' || supporting.some(s => s.key === 'coaching');

  const balanceRows = [
    { key: 'pushPull', label: 'Push / Pull' },
    { key: 'chestBack', label: 'Chest / Back' },
    { key: 'quadHam', label: 'Quads / Ham' }
  ];
  const readinessRatio = Number(readiness?.ratio) || 0;
  const readinessRatioMarker = Math.max(0, Math.min(100, (readinessRatio / 1.8) * 100));
  const readinessLoadMax = Math.max(1, Number(readiness?.acuteLoad) || 0, Number(readiness?.chronicLoad) || 0);

  return (
    <div>
      {primary && (
        <article aria-label={`Primary insight: ${primary.title}`} className="ui-surface-secondary p-4 ui-card-mount-anim">
          <span className="block h-1 w-12 accent-bg rounded-full mb-3" aria-hidden="true" />
          <div className="flex items-center justify-between gap-2">
            <p className="ui-micro">{primary.eyebrow}</p>
            <span className={`text-[11px] px-2 py-0.5 rounded-full border font-bold ${toneChip(primary.tone)}`}>
              {primary.chip}
            </span>
          </div>
          <div className="flex items-end justify-between gap-3 mt-2">
            <h3 className="ui-section-title leading-snug flex-1 min-w-0">{primary.title}</h3>
            {primary.metric && (
              <p className="ui-metric text-2xl leading-none whitespace-nowrap">
                {primary.metric}
                {primary.metricSuffix && <span className="text-[11px] font-semibold text-slate-400 ml-1">{primary.metricSuffix}</span>}
              </p>
            )}
          </div>
          <p className="ui-secondary mt-1.5">{primary.why}</p>
          {primary.modal && (
            <button
              onClick={() => setDetailModal(primary.modal)}
              className="mt-3 inline-flex items-center gap-1 text-[13px] font-bold accent-text hover:opacity-80 transition"
              aria-label={`Show details: ${primary.title}`}
            >
              Details <ChevronRight size={15} aria-hidden />
            </button>
          )}
        </article>
      )}

      <ul className="mt-2 space-y-2" aria-label="Supporting signals">
        {supporting.map((signal) => (
          <li key={signal.key} className="ui-surface-interactive px-3.5 py-3 flex items-center gap-3">
            <span className={`w-1.5 self-stretch rounded-full shrink-0 ${signal.tone === 'bad' ? 'bg-rose-400/70' : signal.tone === 'warn' ? 'bg-amber-400/70' : signal.tone === 'good' ? 'bg-emerald-400/70' : signal.tone === 'info' ? 'bg-sky-400/70' : 'bg-slate-500/50'}`} aria-hidden />
            <div className="flex-1 min-w-0">
              <p className="ui-card-title truncate">{signal.title}</p>
              <p className="ui-secondary truncate mt-0.5">{signal.why}</p>
            </div>
            {signal.modal ? (
              <button
                onClick={() => setDetailModal(signal.modal)}
                className="shrink-0 text-[12px] font-bold accent-text hover:opacity-80 transition min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
                aria-label={`Show details: ${signal.title}`}
              >
                <ChevronRight size={16} aria-hidden />
              </button>
            ) : signal.metric ? (
              <p className="ui-metric text-lg leading-none shrink-0" aria-hidden>
                {signal.metric}
                {signal.metricSuffix && <span className="text-[11px] font-semibold text-slate-400 ml-0.5">{signal.metricSuffix}</span>}
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      {showsInterpretation && (
        <p className="ui-secondary mt-2.5 text-[12px]">Coaching is a heuristic suggestion based on your history — not medical advice.</p>
      )}

      {/* Readiness detail (existing data, existing suggestion copy) */}
      {detailModal === 'readiness' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 ui-backdrop-in" onClick={() => setDetailModal(null)}>
          <div className="ui-surface-secondary p-5 max-w-sm w-full ui-sheet-rise-anim" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Readiness details">
            <div className="flex items-center justify-between mb-4">
              <h2 className="ui-section-title">Readiness details</h2>
              <button onClick={() => setDetailModal(null)} className="p-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center hover:bg-slate-800 rounded-lg transition" aria-label="Close readiness details">
                <X size={18} className="text-slate-400" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="ui-surface-sub p-3">
                <div className="flex items-center justify-between">
                  <p className="ui-micro">Score</p>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full border font-bold ${toneChip(readinessTone(readinessStatus))}`}>
                    {readinessStatus || 'no data'}
                  </span>
                </div>
                <p className="ui-metric text-xl mt-1">{readiness?.readinessScore ?? 0}<span className="text-xs font-semibold text-slate-400"> / 100</span></p>
              </div>

              <div className="ui-surface-sub p-3">
                <p className="ui-micro mb-2">Load ratio zones</p>
                <div className="relative h-2 rounded-full overflow-hidden border border-slate-700/60" role="img" aria-label={`Current load ratio ${readinessRatio.toFixed(2)}`}>
                  <div className="absolute inset-y-0 left-0 w-[44%] bg-sky-500/35" />
                  <div className="absolute inset-y-0 left-[44%] w-[22%] bg-emerald-500/35" />
                  <div className="absolute inset-y-0 right-0 w-[34%] bg-amber-500/35" />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white border border-slate-900 shadow ui-marker-spring"
                    style={{ left: `calc(${readinessRatioMarker}% - 5px)` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 mt-1.5">
                  <span>Under 0.8</span>
                  <span>0.8–1.2</span>
                  <span>Over 1.3</span>
                </div>
                <p className="text-[11px] text-slate-300 mt-2">Current ratio: <span className="font-bold text-white">{readinessRatio.toFixed(2)}</span></p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="ui-surface-sub p-2.5">
                  <p className="ui-micro">Acute (7d)</p>
                  <p className="text-sm font-bold text-white mt-0.5">{readiness?.acuteLoad ?? 0}</p>
                  <div className="h-1.5 bg-slate-700/70 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-sky-400 ui-meter-fill-anim" style={{ width: `${Math.round(((Number(readiness?.acuteLoad) || 0) / readinessLoadMax) * 100)}%` }} />
                  </div>
                </div>
                <div className="ui-surface-sub p-2.5">
                  <p className="ui-micro">Chronic (28d)</p>
                  <p className="text-sm font-bold text-white mt-0.5">{readiness?.chronicLoad ?? 0}</p>
                  <div className="h-1.5 bg-slate-700/70 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-emerald-400 ui-meter-fill-anim" style={{ width: `${Math.round(((Number(readiness?.chronicLoad) || 0) / readinessLoadMax) * 100)}%` }} />
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-300">{readiness?.suggestion || 'No readiness data available yet.'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Balance detail (existing pair data) */}
      {detailModal === 'balance' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 ui-backdrop-in" onClick={() => setDetailModal(null)}>
          <div className="ui-surface-secondary p-5 max-w-sm w-full ui-sheet-rise-anim max-h-[80dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Muscle balance details">
            <div className="flex items-center justify-between mb-4">
              <h2 className="ui-section-title">Muscle balance</h2>
              <button onClick={() => setDetailModal(null)} className="p-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center hover:bg-slate-800 rounded-lg transition" aria-label="Close muscle balance details">
                <X size={18} className="text-slate-400" />
              </button>
            </div>
            <div className="space-y-2.5">
              <div className="ui-surface-sub p-3 text-xs">
                <p className="text-slate-300">Week score: <span className="font-bold text-white">{muscleBalance?.week?.score ?? 0}</span></p>
                <p className="text-slate-400 mt-0.5">Block score: <span className="font-bold text-white">{muscleBalance?.block?.score ?? 0}</span></p>
              </div>
              {balanceRows.map((row) => {
                const week = muscleBalance?.week?.[row.key];
                const block = muscleBalance?.block?.[row.key];
                const weekSplit = getPairSplit(week);
                const blockSplit = getPairSplit(block);
                return (
                  <div key={row.key} className="ui-surface-sub p-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[13px] font-semibold text-slate-200">{row.label}</p>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border font-bold ${getPairTone(week?.status || 'balanced')}`}>
                        {week?.status || 'balanced'}
                      </span>
                    </div>

                    <div className="space-y-2 mt-2">
                      <div>
                        <p className="ui-micro mb-1">Week</p>
                        <div className="h-2 rounded-full overflow-hidden border border-slate-700/60 bg-slate-900/60 flex">
                          <div className="h-full bg-cyan-400/70 ui-meter-fill-anim" style={{ width: `${weekSplit.sideAPct}%` }} />
                          <div className="h-full bg-violet-400/70 ui-meter-fill-anim" style={{ width: `${weekSplit.sideBPct}%` }} />
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 tabular-nums">
                          {week?.sideA || 'A'} {weekSplit.sideAValue} vs {week?.sideB || 'B'} {weekSplit.sideBValue} sets
                        </p>
                      </div>

                      <div>
                        <p className="ui-micro mb-1">Block</p>
                        <div className="h-2 rounded-full overflow-hidden border border-slate-700/60 bg-slate-900/60 flex">
                          <div className="h-full bg-cyan-400/60 ui-meter-fill-anim" style={{ width: `${blockSplit.sideAPct}%` }} />
                          <div className="h-full bg-violet-400/60 ui-meter-fill-anim" style={{ width: `${blockSplit.sideBPct}%` }} />
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 tabular-nums">
                          {block?.sideA || 'A'} {blockSplit.sideAValue} vs {block?.sideB || 'B'} {blockSplit.sideBValue} sets
                        </p>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-400 mt-2">
                      Ratio: <span className="text-slate-200 font-semibold">{getPairLabel(week)}</span>
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Coaching detail: interpretation, explicitly labelled */}
      {detailModal === 'coaching' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto ui-backdrop-in" onClick={() => setDetailModal(null)}>
          <div className="ui-surface-secondary p-5 max-w-md w-full my-8 ui-sheet-rise-anim" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Coaching details">
            <div className="flex items-center justify-between mb-1">
              <h2 className="ui-section-title">Today's coaching</h2>
              <button onClick={() => setDetailModal(null)} className="p-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center hover:bg-slate-800 rounded-lg transition" aria-label="Close coaching details">
                <X size={18} className="text-slate-400" />
              </button>
            </div>
            <p className="ui-secondary text-[12px] mb-4">Interpretation of your training data — a heuristic suggestion, not medical advice.</p>
            <EliteCoachingCard
              readiness={readiness}
              masteryData={masteryData}
              anomalyDetection={anomalyDetection}
            />

            <div className="mt-4 ui-surface-sub p-3">
              <p className="text-xs text-slate-200 font-semibold mb-2">Use as a plan summary</p>
              <p className="text-[11px] text-slate-400 mb-3">
                Copy this prescription into exercise notes or mirror it in Template Plans.
              </p>
              <button
                onClick={() => {
                  const summary = `AI Coaching: ${coaching.trainingZone} • ${coaching.intensity} • ${coaching.repRange} reps • ${coaching.sets} sets • RIR ${coaching.rirTarget}`;
                  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                    navigator.clipboard.writeText(summary);
                  }
                }}
                className="w-full px-3 py-2 min-h-[44px] accent-bg hover:opacity-90 rounded-lg text-xs font-bold text-white transition"
              >
                Copy Plan Summary
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* --- Upcoming plans preview: a launcher into the planning calendar --- */
const UpcomingPlansCard = ({ plans, onOpenCalendar }) => {
  if (!Array.isArray(plans) || plans.length === 0) return null;
  const [first, ...rest] = plans;
  let dateLabel = first?.dateKey || '';
  try {
    const formatted = formatDate(first?.dateKey);
    if (formatted && !/invalid/i.test(String(formatted))) dateLabel = formatted;
  } catch {
    // keep raw day key
  }
  return (
    <section aria-label="Upcoming plans" className="px-4 ui-section">
      <button
        onClick={onOpenCalendar}
        aria-label={rest.length > 0
          ? `Open calendar, next planned workout ${first?.name}, ${dateLabel}, plus ${rest.length} more`
          : `Open calendar, next planned workout ${first?.name}, ${dateLabel}`}
        className="ui-surface-interactive w-full p-3.5 flex items-center gap-3 text-left"
      >
        <span className="w-10 h-10 rounded-xl accent-bg-light accent-border border flex items-center justify-center shrink-0" aria-hidden>
          <Calendar size={17} className="accent-text" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="ui-micro block">Upcoming plan</span>
          <span className="ui-card-title block truncate mt-0.5">{first?.name || 'Planned workout'} · {dateLabel}</span>
          {rest.length > 0 && (
            <span className="ui-secondary block mt-0.5">+{rest.length} more planned</span>
          )}
        </span>
        <ChevronRight size={18} className="shrink-0 text-slate-500" aria-hidden />
      </button>
    </section>
  );
};

export const HomeView = ({
  workouts,
  weeklyGoal,
  readiness,
  muscleBalance,
  masteryData,
  anomalyDetection,
  trainingNotes,
  onTrainingNotesChange,
  onStartWorkout,
  onManageTemplates,
  onOpenCalendar,
  onViewHistory,
  onViewWorkoutDetail,
  onOpenMonthlyProgress,
  upcomingPlans = []
}) => {
  const [notesInput, setNotesInput] = useState(trainingNotes || '');
  const [notesExpanded, setNotesExpanded] = useState(false);

  // Sync input when trainingNotes prop changes
  React.useEffect(() => {
    setNotesInput(trainingNotes || '');
  }, [trainingNotes]);

  const weekWorkouts = getWeekWorkouts(workouts);
  const safeWeeklyGoal = Math.max(Number(weeklyGoal) || 1, 1);
  const getMonthWorkoutsCount = (offset) => getMonthWorkouts(workouts, offset).length;
  const weekProgress = Math.min((weekWorkouts.length / safeWeeklyGoal) * 100, 100);
  const hasHistory = (workouts || []).length > 0;
  const targetComplete = weekWorkouts.length >= safeWeeklyGoal;

  const weekStreak = useMemo(() => {
    if (!workouts?.length) return 0;

    const weekKeys = new Set();
    const getWeekStartKey = (dateValue) => {
      const date = new Date(dateValue);
      const normalized = new Date(date);
      const day = (normalized.getDay() + 6) % 7; // Monday = 0
      normalized.setDate(normalized.getDate() - day);
      normalized.setHours(0, 0, 0, 0);
      return normalized.toISOString().split('T')[0];
    };

    workouts.forEach(workout => {
      if (workout?.date) {
        weekKeys.add(getWeekStartKey(workout.date));
      }
    });

    let streak = 0;
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);

    while (true) {
      const key = getWeekStartKey(cursor);
      if (!weekKeys.has(key)) break;
      streak += 1;
      cursor.setDate(cursor.getDate() - 7);
    }

    return streak;
  }, [workouts]);

  const recentWorkouts = useMemo(() => {
    return (workouts || [])
      .filter((workout) => workout && workout.id !== 'activeWorkout' && workout.date)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 4);
  }, [workouts]);

  return (
    <div className="bg-black text-white pb-16">
      {/* 1 — CURRENT TRAINING CONTEXT: progress toward this week's objective */}
      <header className="px-4 pt-6">
        {hasHistory ? (
          <div className="ui-surface-secondary p-4 sm:p-5 shadow-xl ring-1 ring-white/25">
            <span className="block h-1 w-14 accent-bg rounded-full mb-3" aria-hidden="true" />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="ui-micro">This week</p>
                <h1 className="text-[28px] leading-tight font-black tracking-tight mt-1 text-white">Keep moving</h1>
              </div>
              {weekStreak > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold whitespace-nowrap shrink-0 tabular-nums">
                  <Flame size={13} aria-hidden />
                  {weekStreak}-week streak
                </div>
              )}
            </div>

            <div className="mt-3 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="ui-micro">Weekly target</p>
                <p className="ui-metric text-[28px] leading-none tabular-nums mt-1">
                  {weekWorkouts.length}
                  <span className="text-slate-400 text-lg font-bold"> / {safeWeeklyGoal}</span>
                </p>
                <p className="ui-secondary mt-1">
                  {targetComplete ? 'Weekly target complete — nice work.' : `${safeWeeklyGoal - weekWorkouts.length} more to hit your target.`}
                </p>
              </div>
              <div
                className={`min-w-[84px] h-16 px-3 rounded-2xl flex items-center justify-center shrink-0 border shadow-lg tabular-nums ${targetComplete ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-200' : 'accent-bg-light accent-border border text-white'}`}
                aria-hidden="true"
              >
                <span className="ui-metric text-2xl leading-none">{Math.round(weekProgress)}%</span>
              </div>
            </div>

            <div
              className="mt-3 h-2 rounded-full bg-slate-800 border border-slate-700/40 overflow-hidden"
              role="progressbar"
              aria-label="Weekly workout progress"
              aria-valuenow={weekWorkouts.length}
              aria-valuemin={0}
              aria-valuemax={safeWeeklyGoal}
            >
              <div
                className={`h-full rounded-full transition-all duration-200 ${targetComplete ? 'bg-emerald-400' : 'accent-bg'}`}
                style={{ width: `${weekProgress}%` }}
              />
            </div>

            <div className="mt-3">
              <WeekHeatmap workouts={workouts} />
            </div>
          </div>
        ) : (
          <div className="ui-surface-secondary p-5">
            <p className="ui-micro">Welcome</p>
            <h1 className="ui-display mt-1">Your training starts here</h1>
            <p className="ui-secondary mt-2">Pick a template, log your first session, and this space becomes your training briefing.</p>
          </div>
        )}
      </header>

      {/* 2 — NEXT ACTION: the dominant, unmistakable entry into training */}
      <section aria-label="Start training" className="px-4 ui-section">
        <button
          onClick={onStartWorkout}
          aria-label="Start new workout"
          className="ui-cta-primary w-full min-h-[56px] px-4 py-3.5 flex items-center gap-3 text-left"
        >
          <span className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0" aria-hidden>
            <Zap size={22} strokeWidth={2.4} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[16px] font-extrabold leading-tight">Start workout</span>
            <span className="block text-[12px] font-medium text-white/75 leading-tight mt-0.5">Choose a template and lift</span>
          </span>
          <ChevronRight size={20} className="shrink-0 text-white/80" aria-hidden />
        </button>
      </section>

      {hasHistory ? (
        <>
          {/* 3 — TEMPLATES + CALENDAR: library and schedule entry points */}
          <section aria-label="Templates and calendar" className="px-4 ui-section">
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={onManageTemplates}
                className="ui-action-secondary min-h-[48px] px-3 py-2.5 flex items-center justify-center gap-2 text-[13px] font-bold"
              >
                <LayoutTemplate size={17} aria-hidden />
                Templates
              </button>
              <button
                onClick={onOpenCalendar}
                className="ui-action-secondary min-h-[48px] px-3 py-2.5 flex items-center justify-center gap-2 text-[13px] font-bold"
              >
                <Calendar size={17} aria-hidden />
                Calendar
              </button>
            </div>
          </section>

          <UpcomingPlansCard plans={upcomingPlans} onOpenCalendar={onOpenCalendar} />

          {/* 4 — TRAINING NOTES: subordinate, after templates/calendar */}
          <section aria-labelledby="notes-heading" className="px-4 ui-section">
            <div className="ui-section-head">
              <div>
                <p className="ui-micro">Training notes</p>
                <h2 id="notes-heading" className="sr-only">Training notes</h2>
              </div>
            </div>
            {!notesExpanded && !notesInput ? (
              <button
                onClick={() => setNotesExpanded(true)}
                className="ui-action-secondary w-full min-h-[48px] px-3.5 py-3 flex items-center gap-2.5 text-left"
                aria-label="Add training notes"
                aria-expanded="false"
              >
                <Plus size={16} className="text-slate-400 shrink-0" aria-hidden />
                <span className="ui-secondary">Jot down cues, reminders, recovery notes…</span>
              </button>
            ) : (
              <div className="ui-surface-sub p-3">
                <label htmlFor="home-training-notes" className="sr-only">Training notes</label>
                <textarea
                  id="home-training-notes"
                  value={notesInput}
                  autoFocus={notesExpanded && !notesInput}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    setNotesInput(nextValue);
                    onTrainingNotesChange(nextValue);
                  }}
                  placeholder="Cues, reminders, recovery notes…"
                  rows={notesInput ? 4 : 2}
                  className="w-full bg-transparent text-slate-200 text-sm font-medium placeholder-slate-500 focus:outline-none resize-y leading-relaxed whitespace-pre-wrap"
                />
                <div className="flex justify-end mt-1">
                  <button
                    onClick={() => setNotesExpanded(false)}
                    className="text-[12px] font-bold text-slate-400 hover:text-white transition min-h-[44px] px-2"
                    aria-expanded="true"
                  >
                    Collapse
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* 5 — QUICK INSIGHT: what matters right now */}
          <section aria-labelledby="qi-heading" className="px-4 ui-section">
            <div className="ui-section-head">
              <div>
                <p className="ui-micro">Quick insights</p>
                <h2 id="qi-heading" className="ui-section-title mt-1">What matters now</h2>
              </div>
            </div>
            <QuickInsightsSection workouts={workouts} readiness={readiness} muscleBalance={muscleBalance} masteryData={masteryData} anomalyDetection={anomalyDetection} />
          </section>

          {/* 6 — RECENT WORK: concise previews, not nested cards */}
          <section aria-labelledby="recent-heading" className="px-4 ui-section">
            <div className="ui-section-head">
              <div>
                <p className="ui-micro">Recent</p>
                <h2 id="recent-heading" className="ui-section-title mt-1">Last sessions</h2>
              </div>
              <button
                onClick={onViewHistory}
                className="accent-text hover:opacity-80 text-[13px] font-bold transition inline-flex items-center gap-1.5 min-h-[44px]"
                aria-label={`View all workout history, ${recentWorkouts.length} recent sessions shown`}
              >
                <span>View all</span>
                <span className="text-[11px] px-1.5 py-0.5 rounded-full border border-slate-600/60 text-slate-300">{recentWorkouts.length}</span>
              </button>
            </div>

            {recentWorkouts.length === 0 ? (
              <div className="ui-surface-sub p-4">
                <p className="ui-secondary">No saved workouts yet — your sessions will appear here.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {recentWorkouts.map((workout) => (
                  <li key={workout.id}>
                    <button
                      onClick={() => onViewWorkoutDetail(workout.date)}
                      aria-label={`Open workout ${workout.name}, ${formatDate(workout.date)}`}
                      className="ui-surface-interactive w-full p-3.5 flex items-center gap-3 text-left"
                    >
                      <span className="w-10 h-10 rounded-xl accent-bg-light accent-border border flex items-center justify-center shrink-0" aria-hidden>
                        <Check size={16} className="accent-text" strokeWidth={3} />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="ui-card-title block truncate">{workout.name}</span>
                        <span className="ui-secondary block mt-0.5">{formatDate(workout.date)}</span>
                      </span>
                      <span className="text-right shrink-0" aria-hidden>
                        <span className="ui-metric text-[15px] block">{workout.exercises?.length || 0} ex</span>
                        <span className="ui-secondary text-[12px] block">{workout.duration || 0} min</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="monthly-heading" className="px-4 ui-section">
            <div className="ui-section-head">
              <div>
                <p className="ui-micro">Monthly stats</p>
                <h2 id="monthly-heading" className="sr-only">Monthly stats</h2>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => onOpenMonthlyProgress(0)}
                className="ui-surface-interactive p-3.5 text-left"
                aria-label={`Open this month progress, ${getMonthWorkoutsCount(0)} workouts`}
              >
                <p className="ui-micro">This month</p>
                <p className="ui-metric text-2xl mt-1">{getMonthWorkoutsCount(0)}</p>
                <p className="ui-secondary text-[12px] mt-0.5">workouts</p>
              </button>
              <button
                onClick={() => onOpenMonthlyProgress(-1)}
                className="ui-surface-interactive p-3.5 text-left"
                aria-label={`Open last month progress, ${getMonthWorkoutsCount(-1)} workouts`}
              >
                <p className="ui-micro">{getMonthLabel(-1).slice(0, 3)}</p>
                <p className="ui-metric text-2xl mt-1">{getMonthWorkoutsCount(-1)}</p>
                <p className="ui-secondary text-[12px] mt-0.5">workouts</p>
              </button>
            </div>
          </section>
        </>
      ) : (
        <>
          <section aria-label="Templates and calendar" className="px-4 ui-section">
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={onManageTemplates}
                className="ui-action-secondary min-h-[48px] px-3 py-2.5 flex items-center justify-center gap-2 text-[13px] font-bold"
              >
                <LayoutTemplate size={17} aria-hidden />
                Templates
              </button>
              <button
                onClick={onOpenCalendar}
                className="ui-action-secondary min-h-[48px] px-3 py-2.5 flex items-center justify-center gap-2 text-[13px] font-bold"
              >
                <Calendar size={17} aria-hidden />
                Calendar
              </button>
            </div>
          </section>
          <UpcomingPlansCard plans={upcomingPlans} onOpenCalendar={onOpenCalendar} />
          <section aria-label="Getting started" className="px-4 ui-section">
            <div className="ui-surface-sub p-4">
              <p className="ui-secondary">Insights, history and stats will appear here after your first workout.</p>
            </div>
            <div className="grid grid-cols-3 gap-2.5 mt-2.5" aria-hidden>
              <div className="ui-surface-sub p-3 flex flex-col items-center gap-1.5">
                <Activity size={18} className="text-slate-500" />
                <span className="text-[11px] font-bold text-slate-500">Track</span>
              </div>
              <div className="ui-surface-sub p-3 flex flex-col items-center gap-1.5">
                <Trophy size={18} className="text-slate-500" />
                <span className="text-[11px] font-bold text-slate-500">Progress</span>
              </div>
              <div className="ui-surface-sub p-3 flex flex-col items-center gap-1.5">
                <Scale size={18} className="text-slate-500" />
                <span className="text-[11px] font-bold text-slate-500">Balance</span>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
};
