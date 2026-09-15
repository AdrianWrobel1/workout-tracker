import React, { useState } from 'react';
import { Rocket, Pause, BarChart3, Check, AlertTriangle, Target, TriangleAlert } from 'lucide-react';
import { generateCoachLens, generatePostWorkoutInsights, detectAnomalies, extractKeyMetrics } from '../domain/workouts';
import { useDebriefs } from '../contexts/DebriefsContext';
import { useMotivation } from '../contexts/MotivationContext';

const STATUS_META = {
  push: { Icon: Rocket, classes: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' },
  recover: { Icon: Pause, classes: 'bg-amber-500/10 border-amber-500/30 text-amber-300' },
  steady: { Icon: BarChart3, classes: 'bg-sky-500/10 border-sky-500/30 text-sky-300' },
};

const SEVERITY_META = {
  high: 'bg-red-500/10 border-red-500/30 text-red-200',
  medium: 'bg-amber-500/10 border-amber-500/30 text-amber-200',
  low: 'bg-sky-500/10 border-sky-500/30 text-sky-200',
};

/**
 * SessionDebrief — Coach INTERPRETATION only.
 *
 * Raw session facts (volume, completion, density, sets, deltas) already live in
 * Session Summary / Highlights / Workload above. This component deliberately
 * does NOT repeat them: it renders verdict + guidance + optional details.
 */
export default function SessionDebrief({ workout, allWorkouts, exercisesDB }) {
  const { createDebrief } = useDebriefs();
  const { addRewardPoints } = useMotivation();
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [showMetrics, setShowMetrics] = useState(false);

  if (!workout) {
    return (
      <div className="p-4 ui-surface-sub rounded-xl text-center">
        <p className="text-slate-400 text-sm font-semibold">No workout data available</p>
      </div>
    );
  }

  const coachLens = generateCoachLens(workout, allWorkouts || []);
  const insights = generatePostWorkoutInsights(workout, allWorkouts || []);
  const anomalies = detectAnomalies(workout, allWorkouts || []);
  const metrics = extractKeyMetrics(workout, allWorkouts || [], exercisesDB || []);

  const handleSaveDebrief = () => {
    if (notes.trim()) {
      createDebrief(workout.id || `workout_${workout.startTime}`, notes, metrics);
      addRewardPoints(25);
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 2000);
    }
  };

  const statusMeta = STATUS_META[coachLens.status] || STATUS_META.steady;
  const StatusIcon = statusMeta.Icon;

  return (
    <div className="w-full space-y-3">
      {/* Verdict — the only headline interpretation on this screen */}
      <div className={`p-4 rounded-xl border ${statusMeta.classes}`}>
        <div className="flex items-center gap-2.5">
          <StatusIcon size={20} aria-hidden="true" className="shrink-0" />
          <h3 className="font-bold text-[15px] text-white leading-snug">{coachLens.headline}</h3>
        </div>
        <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-2">
          {coachLens.confidence} confidence · interpretation, not measurement
        </p>
      </div>

      {/* Guidance — what went well / improve / focus. New context only. */}
      <div className="p-4 ui-surface-sub rounded-xl space-y-3">
        <h4 className="text-sm font-black text-slate-200 uppercase tracking-widest">Session guidance</h4>
        <ul className="space-y-2.5">
          <li className="flex gap-2.5 items-start">
            <Check size={16} className="text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-200">What went well</p>
              <p className="text-[13px] text-slate-400 mt-0.5 leading-relaxed">{coachLens.keep}</p>
            </div>
          </li>
          <li className="flex gap-2.5 items-start">
            <AlertTriangle size={16} className="text-amber-300 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-200">Room to improve</p>
              <p className="text-[13px] text-slate-400 mt-0.5 leading-relaxed">{coachLens.improve}</p>
            </div>
          </li>
          <li className="flex gap-2.5 items-start">
            <Target size={16} className="text-sky-300 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-200">Next session focus</p>
              <p className="text-[13px] text-slate-400 mt-0.5 leading-relaxed">{coachLens.focus}</p>
            </div>
          </li>
        </ul>
        {Array.isArray(insights) && insights.length > 0 && (
          <p className="text-[12px] text-slate-500 font-semibold pt-1 border-t border-slate-700/40">
            {insights.length} supporting signal{insights.length === 1 ? '' : 's'} from your history.
          </p>
        )}
      </div>

      {/* Anomalies — only when the engine actually flags something */}
      {anomalies.severity !== 'none' && (
        <div className={`p-4 rounded-xl border ${SEVERITY_META[anomalies.severity] || SEVERITY_META.low}`}>
          <div className="flex gap-2.5 items-start">
            <TriangleAlert size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-bold text-sm text-white">Worth a look</p>
              <ul className="text-[13px] space-y-1 mt-2 text-slate-300">
                {anomalies.anomalies.map((anom, idx) => (
                  <li key={idx}>• {anom.message}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Qualitative notes — the only input on this screen */}
      <div className="p-4 ui-surface-sub rounded-xl">
        <label htmlFor="session-debrief-notes" className="block text-sm font-bold text-slate-200 mb-2">
          How did this session feel?
        </label>
        <textarea
          id="session-debrief-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Energy level, focus, pain, technique quality, mind state..."
          className="w-full p-3 bg-slate-900/60 border border-slate-700/50 rounded-xl text-sm text-slate-200 placeholder:text-slate-500 resize-none h-20 focus:outline-none focus:border-slate-500"
        />
        <button
          onClick={handleSaveDebrief}
          disabled={!notes.trim() || submitted}
          className={`w-full mt-3 py-2.5 min-h-[44px] rounded-xl font-bold text-sm transition focus-visible:outline-2 focus-visible:outline-blue-400 ${
            submitted
              ? 'bg-emerald-600 text-white'
              : notes.trim()
              ? 'accent-bg text-white hover:opacity-90'
              : 'bg-slate-800/60 text-slate-500 cursor-not-allowed border border-slate-700/50'
          }`}
        >
          {submitted ? 'Debrief saved' : 'Save debrief notes'}
        </button>
      </div>

      {/* Optional details — collapsed by default, never competes with Summary */}
      <div className="text-center">
        <button
          onClick={() => setShowMetrics(!showMetrics)}
          aria-expanded={showMetrics}
          className="text-[13px] text-slate-400 hover:text-white underline underline-offset-4 min-h-[44px] px-3 font-semibold"
        >
          {showMetrics ? 'Hide' : 'Show'} advanced metrics
        </button>
      </div>

      {showMetrics && (
        <div className="p-4 ui-surface-sub rounded-xl space-y-3 text-[13px]">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 bg-slate-900/50 border border-slate-700/40 rounded-xl">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Top 1RM</p>
              <p className="text-slate-200 font-black mt-1 tabular-nums">{metrics.progressMetrics.topEstimated1RM} kg</p>
              <p className={`text-[12px] font-semibold mt-0.5 ${metrics.progressMetrics.rmTrend === 'up' ? 'text-emerald-400' : metrics.progressMetrics.rmTrend === 'down' ? 'text-red-400' : 'text-slate-500'}`}>
                {metrics.progressMetrics.rmTrend === 'up' ? '↑' : metrics.progressMetrics.rmTrend === 'down' ? '↓' : '→'} vs {metrics.progressMetrics.previousMax1RM} kg
              </p>
            </div>
            <div className="p-3 bg-slate-900/50 border border-slate-700/40 rounded-xl">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Volume trend</p>
              <p className="text-slate-200 font-bold mt-1">{metrics.volumeProgression.trend}</p>
              <p className="text-[12px] text-slate-500 font-semibold tabular-nums">{metrics.volumeProgression.current.toLocaleString()} total</p>
            </div>
            <div className="p-3 bg-slate-900/50 border border-slate-700/40 rounded-xl">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Density</p>
              <p className="text-slate-200 font-black mt-1 tabular-nums">{metrics.densityTrend.current} vol/min</p>
              <p className="text-[12px] text-slate-500 font-semibold">{metrics.densityTrend.trend}</p>
            </div>
            <div className="p-3 bg-slate-900/50 border border-slate-700/40 rounded-xl">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Rep mix</p>
              <p className="text-[12px] text-slate-400 font-semibold mt-1 tabular-nums">
                S {metrics.tempoAnalysis.distribution.low} · P {metrics.tempoAnalysis.distribution.mid} · H {metrics.tempoAnalysis.distribution.high}
              </p>
            </div>
          </div>
          <p className="text-[12px] text-slate-500 font-semibold">
            Estimates from logged sets — direction matters more than decimals.
          </p>
        </div>
      )}
    </div>
  );
}
