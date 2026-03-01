import React, { useState, useMemo } from 'react';
import { Edit2, Calendar, Check, Zap, ChevronDown, X } from 'lucide-react';
import { getWeekWorkouts, getMonthWorkouts, getMonthLabel, compareWorkoutToPrevious, generateCoachLens } from '../domain/workouts';
import { WeekHeatmap } from '../components/WeekHeatmap';
import { ProgressRing } from '../components/ProgressRing';
import { MiniSparkline } from '../components/MiniSparkline';
import { SimpleLineChart } from '../components/SimpleLineChart';
import { calculateTotalVolume, formatDate } from '../domain/calculations';

const QuickInsightsSection = ({ workouts, readiness, muscleBalance }) => {
  const [open, setOpen] = useState(false);
  const [selectedInsight, setSelectedInsight] = useState(null);
  const [showDetailedChart, setShowDetailedChart] = useState(false);
  const [detailModal, setDetailModal] = useState(null); // 'readiness' | 'balance' | null

  // Calculate weekly volume data for last 12 weeks
  const weeklyChartData = useMemo(() => {
    const data = [];
    const today = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const weekEnd = new Date(today);
      weekEnd.setDate(today.getDate() - (i * 7));
      weekEnd.setHours(0, 0, 0, 0);
      
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekEnd.getDate() - 6);

      const weekWorkouts = workouts.filter(w => {
        const wDate = new Date(w.date);
        return wDate >= weekStart && wDate <= weekEnd;
      });

      const weekVolume = weekWorkouts.reduce((sum, w) => {
        return sum + (w.exercises || []).reduce((exSum, ex) => {
          return exSum + calculateTotalVolume(ex.sets || []);
        }, 0);
      }, 0);

      data.push({
        date: weekEnd.toISOString().split('T')[0],
        value: weekVolume
      });
    }
    return data;
  }, [workouts]);

  const balanceRows = [
    { key: 'pushPull', label: 'Push / Pull' },
    { key: 'chestBack', label: 'Chest / Back' },
    { key: 'quadHam', label: 'Quads / Ham' }
  ];

  const readinessRatio = Number(readiness?.ratio) || 0;
  const readinessRatioMarker = Math.max(0, Math.min(100, (readinessRatio / 1.8) * 100));
  const readinessLoadMax = Math.max(1, Number(readiness?.acuteLoad) || 0, Number(readiness?.chronicLoad) || 0);
  
  // Calculate PRs this week
  const thisWeekPRCount = useMemo(() => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    
    let prCount = 0;
    (workouts || []).forEach(w => {
      const wDate = new Date(w.date);
      if (wDate >= weekStart) {
        Object.values(w.prStatus || {}).forEach(status => {
          if (Array.isArray(status.recordsPerSet)) {
            prCount += status.recordsPerSet.filter(records => records && records.length > 0).length;
          }
        });
      }
    });
    return prCount;
  }, [workouts]);

  // Calculate Coach Lens for latest workout
  const coachLensQuick = useMemo(() => {
    const latest = (workouts || [])
      .filter((workout) => workout && workout.id !== 'activeWorkout' && workout.date)
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    if (!latest) return null;
    const comparison = compareWorkoutToPrevious(latest, workouts || []);
    return generateCoachLens(latest, workouts || [], comparison, latest.prStatus || {});
  }, [workouts]);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${open ? 'bg-slate-800/60 border border-slate-700/30' : 'bg-transparent'}`}
      >
        <div className="flex items-center gap-3">
          <ChevronDown size={18} style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 180ms ease' }} />
          <div className="text-sm font-bold">Quick insights</div>
        </div>
        <div className="text-xs text-slate-400">{open ? 'Hide' : 'Show'}</div>
      </button>

      {open && (
        <>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <button
              onClick={() => setDetailModal('readiness')}
              className="text-left bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-slate-700/30 rounded-xl p-3 transition hover:border-slate-600/50 ui-press ui-stagger-enter ui-stagger-d1 ui-card-magnet"
            >
              <p className="text-[10px] text-slate-400 font-semibold tracking-widest">READINESS</p>
              <div className="flex items-end justify-between mt-1">
                <p className="text-lg font-black text-white leading-none">
                  {readiness?.readinessScore ?? 0}
                </p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ui-chip-pop-anim ui-readiness-morph transition-colors duration-200 ${
                  readiness?.status === 'fatigue'
                    ? 'text-amber-300 border-amber-500/30 bg-amber-500/10'
                    : readiness?.status === 'low'
                    ? 'text-sky-300 border-sky-500/30 bg-sky-500/10'
                    : 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
                }`}>
                  {readiness?.status || 'no data'}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 mt-2">ACWR: {readiness?.ratio ?? 0}</p>
            </button>

            <button
              onClick={() => setDetailModal('balance')}
              className="text-left bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-slate-700/30 rounded-xl p-3 transition hover:border-slate-600/50 ui-press ui-stagger-enter ui-stagger-d2 ui-card-magnet"
            >
              <p className="text-[10px] text-slate-400 font-semibold tracking-widest">MUSCLE BALANCE</p>
              <p className="text-lg font-black text-white mt-1 leading-none">
                {muscleBalance?.week?.score ?? 0}
                <span className="text-[10px] text-slate-400 font-semibold ml-1">week</span>
              </p>
              <div className="mt-2 flex items-center justify-between text-[10px]">
                <span className="text-slate-500">Block: {muscleBalance?.block?.score ?? 0}</span>
                <span className={`px-2 py-0.5 rounded-full border font-bold ui-chip-pop-anim transition-colors duration-200 ${getPairTone(muscleBalance?.week?.pushPull?.status || 'balanced')}`}>
                  {getPairLabel(muscleBalance?.week?.pushPull)}
                </span>
              </div>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-3">
            <button
              onClick={() => setSelectedInsight('progress')}
              className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-slate-700/30 hover:border-slate-600/50 rounded-xl p-4 flex justify-center transition-all duration-200 hover:scale-105 active:scale-95 ui-stagger-enter ui-stagger-d3 ui-card-magnet"
            >
              <ProgressRing workouts={workouts} />
            </button>

            <button
              onClick={() => setSelectedInsight('trend')}
              className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-slate-700/30 hover:border-slate-600/50 rounded-xl p-4 flex flex-col justify-center transition-all duration-200 hover:scale-105 active:scale-95 ui-stagger-enter ui-stagger-d4 ui-card-magnet"
            >
              <p className="text-xs text-slate-400 font-semibold tracking-widest mb-2">TREND</p>
              <div className="flex justify-center">
                <MiniSparkline workouts={workouts} metric="volume" />
              </div>
            </button>
          </div>

          <button
            onClick={() => setSelectedInsight('prs')}
            className="w-full text-left mt-3 bg-gradient-to-br from-amber-900/30 to-amber-950/30 border border-amber-700/30 hover:border-amber-600/50 rounded-xl p-4 transition ui-stagger-enter ui-stagger-d5 ui-card-magnet"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-amber-400 font-semibold tracking-widest">THIS WEEK RECORDS</p>
                <p className="text-2xl font-black text-white mt-2">{thisWeekPRCount}</p>
                <p className="text-xs text-amber-200 mt-1">{thisWeekPRCount === 1 ? 'Personal Record' : 'Personal Records'}</p>
              </div>
              <div className="text-4xl opacity-20">🏆</div>
            </div>
          </button>

          {coachLensQuick && (
            <button
              onClick={() => setSelectedInsight('coach')}
              className="w-full text-left mt-3 bg-gradient-to-br from-green-900/25 to-green-950/25 border border-green-700/30 hover:border-green-600/50 rounded-xl p-3.5 transition ui-stagger-enter ui-stagger-d6 ui-card-magnet"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-green-400 font-semibold tracking-widest">COACH INSIGHT</p>
                  <p className="text-sm text-green-50 font-semibold mt-1 line-clamp-2">{coachLensQuick.headline || 'Session analysis ready'}</p>
                </div>
                <span className={`text-[10px] px-2 py-1 rounded-full border font-bold flex-shrink-0 whitespace-nowrap ${
                  coachLensQuick.status === 'push'
                    ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
                    : coachLensQuick.status === 'recover'
                    ? 'text-amber-300 border-amber-500/30 bg-amber-500/10'
                    : 'text-sky-300 border-sky-500/30 bg-sky-500/10'
                }`}>
                  {coachLensQuick.status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded border border-green-700/40 bg-green-900/20 px-2 py-1.5">
                  <p className="text-green-300 font-semibold">Keep: <span className="text-green-100">{coachLensQuick.keep?.slice(0, 20)}...</span></p>
                </div>
                <div className="rounded border border-green-700/40 bg-green-900/20 px-2 py-1.5">
                  <p className="text-amber-300 font-semibold">Improve: <span className="text-amber-100">{coachLensQuick.improve?.slice(0, 15)}...</span></p>
                </div>
              </div>
            </button>
          )}



          {/* Insight modals */}
          {selectedInsight === 'progress' && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 max-w-sm w-full">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-white">Weekly Progress</h2>
                  <button
                    onClick={() => setSelectedInsight(null)}
                    className="p-1 hover:bg-slate-800 rounded transition"
                  >
                    X
                  </button>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <ProgressRing workouts={workouts} />
                </div>
                <p className="text-xs text-slate-400 text-center mt-4">
                  You're on track with your weekly goal! Keep crushing it
                </p>
              </div>
            </div>
          )}

          {selectedInsight === 'trend' && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 max-w-sm w-full">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-white">Volume Trend</h2>
                  <button
                    onClick={() => setSelectedInsight(null)}
                    className="p-1 hover:bg-slate-800 rounded transition"
                  >
                    X
                  </button>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <MiniSparkline workouts={workouts} metric="volume" />
                </div>
                <button
                  onClick={() => setShowDetailedChart(true)}
                  className="w-full mt-4 px-3 py-2 accent-bg hover:opacity-90 rounded transition text-sm font-bold"
                >
                  See detailed chart
                </button>
              </div>
            </div>
          )}

          {/* Detailed chart modal */}
          {showDetailedChart && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 max-w-2xl w-full max-h-[80dvh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white">Volume Trend - Last 12 Weeks</h2>
                  <button
                    onClick={() => setShowDetailedChart(false)}
                    className="p-2 hover:bg-slate-800 rounded transition"
                  >
                    <X size={20} className="text-slate-400" />
                  </button>
                </div>

                {/* Chart */}
                <div className="bg-slate-800/50 rounded-lg p-6 mb-6 flex flex-col items-center">
                  {weeklyChartData && weeklyChartData.length > 0 ? (
                    <SimpleLineChart
                      data={weeklyChartData}
                      color="#3b82f6"
                      unit="volume"
                    />
                  ) : (
                    <div className="w-full h-48 flex items-center justify-center text-slate-400">
                      Not enough data
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <p className="text-xs text-slate-400 font-semibold mb-1">AVG VOLUME</p>
                    <p className="text-xl font-bold text-white">
                      {Math.round(weeklyChartData.reduce((sum, w) => sum + w.value, 0) / weeklyChartData.length)}
                    </p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <p className="text-xs text-slate-400 font-semibold mb-1">PEAK WEEK</p>
                    <p className="text-xl font-bold text-blue-400">
                      {Math.max(...weeklyChartData.map(w => w.value))}
                    </p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <p className="text-xs text-slate-400 font-semibold mb-1">WEEKS ACTIVE</p>
                    <p className="text-xl font-bold text-emerald-400">
                      {weeklyChartData.filter(w => w.value > 0).length}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowDetailedChart(false)}
                  className="w-full px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded transition text-sm font-bold"
                >
                  Close
                </button>
              </div>
            </div>
          )}

                    {detailModal === 'readiness' && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 ui-backdrop-in">
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-sm w-full ui-sheet-rise-anim">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-white">Readiness Details</h2>
                  <button onClick={() => setDetailModal(null)} className="p-1 hover:bg-slate-800 rounded transition">
                    <X size={18} className="text-slate-400" />
                  </button>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-400 font-semibold tracking-widest">SCORE</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ui-chip-pop-anim ui-readiness-morph transition-colors duration-200 ${
                        readiness?.status === 'fatigue'
                          ? 'text-amber-300 border-amber-500/30 bg-amber-500/10'
                          : readiness?.status === 'low'
                          ? 'text-sky-300 border-sky-500/30 bg-sky-500/10'
                          : 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
                      }`}>
                        {readiness?.status || 'no data'}
                      </span>
                    </div>
                    <p className="text-xl font-black text-white mt-1">{readiness?.readinessScore ?? 0}/100</p>
                  </div>

                  <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-3">
                    <p className="text-[10px] text-slate-400 font-semibold tracking-widest mb-2">ACWR ZONES</p>
                    <div className="relative h-2 rounded-full overflow-hidden border border-slate-700/60">
                      <div className="absolute inset-y-0 left-0 w-[44%] bg-sky-500/35" />
                      <div className="absolute inset-y-0 left-[44%] w-[22%] bg-emerald-500/35" />
                      <div className="absolute inset-y-0 right-0 w-[34%] bg-amber-500/35" />
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white border border-slate-900 shadow ui-marker-spring"
                        style={{ left: `calc(${readinessRatioMarker}% - 5px)` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500 mt-1.5">
                      <span>Under 0.8</span>
                      <span>0.8-1.2</span>
                      <span>Over 1.3</span>
                    </div>
                    <p className="text-[11px] text-slate-300 mt-2">Current ACWR: <span className="font-bold text-white">{readinessRatio.toFixed(2)}</span></p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-2.5">
                      <p className="text-[10px] text-slate-400 font-semibold tracking-widest">ACUTE (7D)</p>
                      <p className="text-sm font-bold text-white">{readiness?.acuteLoad ?? 0}</p>
                      <div className="h-1.5 bg-slate-700/70 rounded-full mt-2 overflow-hidden">
                        <div className="h-full bg-sky-400 ui-meter-fill-anim" style={{ width: `${Math.round(((Number(readiness?.acuteLoad) || 0) / readinessLoadMax) * 100)}%` }} />
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-2.5">
                      <p className="text-[10px] text-slate-400 font-semibold tracking-widest">CHRONIC (28D)</p>
                      <p className="text-sm font-bold text-white">{readiness?.chronicLoad ?? 0}</p>
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

                    
          {detailModal === 'coach' && coachLensQuick && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 ui-backdrop-in">
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-sm w-full ui-sheet-rise-anim">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-white">Coach Lens</h2>
                  <button onClick={() => setDetailModal(null)} className="p-1 hover:bg-slate-800 rounded transition">
                    <X size={18} className="text-slate-400" />
                  </button>
                </div>
                <p className="text-sm text-slate-100 font-semibold">{coachLensQuick.headline}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${
                    coachLensQuick.status === 'push'
                      ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
                      : coachLensQuick.status === 'recover'
                      ? 'text-amber-300 border-amber-500/30 bg-amber-500/10'
                      : 'text-sky-300 border-sky-500/30 bg-sky-500/10'
                  }`}>
                    status: {coachLensQuick.status}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${
                    coachLensQuick.confidence === 'high'
                      ? 'text-emerald-200 border-emerald-500/30 bg-emerald-500/10'
                      : coachLensQuick.confidence === 'medium'
                      ? 'text-sky-200 border-sky-500/30 bg-sky-500/10'
                      : 'text-slate-300 border-slate-600/50 bg-slate-700/30'
                  }`}>
                    confidence: {coachLensQuick.confidence || 'low'}
                  </span>
                  {coachLensQuick.actionCertainty && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${getCertaintyTone(coachLensQuick.actionCertainty.level)}`}>
                      certainty: {coachLensQuick.actionCertainty.score}/100
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-2.5">
                    <p className="text-[10px] text-slate-500 font-semibold tracking-widest">PROGRESSION</p>
                    <p className="text-sm font-bold text-white">{coachLensQuick.scores?.progression ?? 0}</p>
                  </div>
                  <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-2.5">
                    <p className="text-[10px] text-slate-500 font-semibold tracking-widest">EXECUTION</p>
                    <p className="text-sm font-bold text-white">{coachLensQuick.scores?.execution ?? 0}</p>
                  </div>
                  <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-2.5">
                    <p className="text-[10px] text-slate-500 font-semibold tracking-widest">RISK</p>
                    <p className="text-sm font-bold text-white">{coachLensQuick.scores?.fatigueRisk ?? 0}</p>
                  </div>
                </div>
                <div className="space-y-1.5 mt-3 rounded-lg border border-cyan-500/15 bg-slate-900/30 px-3 py-2.5">
                  <p className="text-sm text-slate-100"><span className="text-emerald-300 font-semibold">Keep:</span> {coachLensQuick.keep}</p>
                  <p className="text-sm text-slate-100"><span className="text-amber-300 font-semibold">Improve:</span> {coachLensQuick.improve}</p>
                  <p className="text-sm text-slate-100"><span className="text-blue-300 font-semibold">Focus:</span> {coachLensQuick.focus}</p>
                </div>
                {coachLensQuick.actionCertainty && (
                  <div className="mt-2 rounded-lg border border-slate-700/60 bg-slate-900/45 px-3 py-2.5">
                    <p className="text-[10px] text-slate-400 font-semibold tracking-widest">ACTION CERTAINTY</p>
                    <p className="text-xs text-slate-300 mt-1">{coachLensQuick.actionCertainty.reason}</p>
                    <div className="grid grid-cols-3 gap-2 mt-2 text-[10px]">
                      <div className="rounded border border-slate-700/50 bg-slate-800/40 px-2 py-1">
                        <p className="text-slate-500">Tracked</p>
                        <p className="text-slate-100 font-bold">{coachLensQuick.actionCertainty.exposures?.trackedExercises ?? 0}</p>
                      </div>
                      <div className="rounded border border-slate-700/50 bg-slate-800/40 px-2 py-1">
                        <p className="text-slate-500">Avg exp.</p>
                        <p className="text-slate-100 font-bold">{coachLensQuick.actionCertainty.exposures?.average ?? 0}</p>
                      </div>
                      <div className="rounded border border-slate-700/50 bg-slate-800/40 px-2 py-1">
                        <p className="text-slate-500">Stale</p>
                        <p className="text-slate-100 font-bold">{coachLensQuick.actionCertainty.decay?.staleExercises ?? 0}</p>
                      </div>
                    </div>
                    {(coachLensQuick.actionCertainty.perExercise || []).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {(coachLensQuick.actionCertainty.perExercise || []).slice(0, 4).map((item) => (
                          <span key={item.exerciseId} className={`text-[10px] px-2 py-0.5 rounded-full border ${getCertaintyTone(item.level)}`}>
                            {item.exerciseName}: {item.score}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {(coachLensQuick.highlights || []).length > 0 && (
                  <div className="mt-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5">
                    <p className="text-[10px] text-emerald-300 font-semibold tracking-widest">WHAT WENT WELL</p>
                    <div className="mt-1.5 space-y-1">
                      {(coachLensQuick.highlights || []).slice(0, 3).map((item, idx) => (
                        <p key={`quick-hl-${idx}`} className="text-xs text-emerald-100">- {item}</p>
                      ))}
                    </div>
                  </div>
                )}
                {(coachLensQuick.risks || []).length > 0 && (
                  <div className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
                    <p className="text-[10px] text-amber-300 font-semibold tracking-widest">WATCH NEXT SESSION</p>
                    <div className="mt-1.5 space-y-1">
                      {(coachLensQuick.risks || []).slice(0, 2).map((item, idx) => (
                        <p key={`quick-risk-${idx}`} className="text-xs text-amber-100">- {item}</p>
                      ))}
                    </div>
                  </div>
                )}
                {(coachLensQuick.nextSessionPlan || []).length > 0 && (
                  <div className="mt-2 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-2.5">
                    <p className="text-[10px] text-cyan-300 font-semibold tracking-widest">NEXT SESSION PLAN</p>
                    <div className="mt-1.5 space-y-1">
                      {(coachLensQuick.nextSessionPlan || []).slice(0, 3).map((step, idx) => (
                        <p key={`quick-plan-${idx}`} className="text-xs text-cyan-100">{idx + 1}. {step}</p>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-3 rounded-lg border border-slate-700/50 bg-slate-800/30 p-2.5 text-xs text-slate-300">
                  <p>Volume delta: <span className="font-bold text-white">{coachLensQuick.snapshot?.volumeDeltaPct ?? 0}%</span></p>
                  <p className="mt-1">Work sets: <span className="font-bold text-white">{coachLensQuick.snapshot?.completedWorkSets ?? 0}/{coachLensQuick.snapshot?.plannedWorkSets ?? 0}</span></p>
                  <p className="mt-1">Density: <span className="font-bold text-white">{coachLensQuick.snapshot?.density ?? 0}/min</span></p>
                  <p className="mt-1">PRs: <span className="font-bold text-white">{coachLensQuick.snapshot?.prCount ?? 0}</span></p>
                </div>
              </div>
            </div>
          )}
          {detailModal === 'balance' && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 ui-backdrop-in">
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-sm w-full ui-sheet-rise-anim">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-white">Muscle Balance</h2>
                  <button onClick={() => setDetailModal(null)} className="p-1 hover:bg-slate-800 rounded transition">
                    <X size={18} className="text-slate-400" />
                  </button>
                </div>
                <div className="space-y-2.5">
                  <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-3 text-xs">
                    <p className="text-slate-300">Week score: <span className="font-bold text-white">{muscleBalance?.week?.score ?? 0}</span></p>
                    <p className="text-slate-400 mt-0.5">Block score: <span className="font-bold text-white">{muscleBalance?.block?.score ?? 0}</span></p>
                  </div>
                  {balanceRows.map((row) => {
                    const week = muscleBalance?.week?.[row.key];
                    const block = muscleBalance?.block?.[row.key];
                    const weekSplit = getPairSplit(week);
                    const blockSplit = getPairSplit(block);
                    return (
                      <div key={row.key} className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-2.5">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-semibold text-slate-200">{row.label}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ui-chip-pop-anim ui-readiness-morph transition-colors duration-200 ${getPairTone(week?.status || 'balanced')}`}>
                            {week?.status || 'balanced'}
                          </span>
                        </div>

                        <div className="space-y-2 mt-2">
                          <div>
                            <p className="text-[10px] text-slate-500 font-semibold mb-1">WEEK</p>
                            <div className="h-2 rounded-full overflow-hidden border border-slate-700/60 bg-slate-900/60 flex">
                              <div className="h-full bg-cyan-400/70 ui-meter-fill-anim" style={{ width: `${weekSplit.sideAPct}%` }} />
                              <div className="h-full bg-violet-400/70 ui-meter-fill-anim" style={{ width: `${weekSplit.sideBPct}%` }} />
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">
                              {week?.sideA || 'A'} {weekSplit.sideAValue} vs {week?.sideB || 'B'} {weekSplit.sideBValue}
                            </p>
                          </div>

                          <div>
                            <p className="text-[10px] text-slate-500 font-semibold mb-1">BLOCK</p>
                            <div className="h-2 rounded-full overflow-hidden border border-slate-700/60 bg-slate-900/60 flex">
                              <div className="h-full bg-cyan-400/60 ui-meter-fill-anim" style={{ width: `${blockSplit.sideAPct}%` }} />
                              <div className="h-full bg-violet-400/60 ui-meter-fill-anim" style={{ width: `${blockSplit.sideBPct}%` }} />
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">
                              {block?.sideA || 'A'} {blockSplit.sideAValue} vs {block?.sideB || 'B'} {blockSplit.sideBValue}
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

          {selectedInsight === 'prs' && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 max-w-sm w-full">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-white">This Week's Records</h2>
                  <button
                    onClick={() => setSelectedInsight(null)}
                    className="p-1 hover:bg-slate-800 rounded transition"
                  >
                    <X size={18} className="text-slate-400" />
                  </button>
                </div>
                <div className="text-center mb-6">
                  <div className="text-5xl font-black text-amber-400 mb-2">{thisWeekPRCount}</div>
                  <p className="text-slate-300 text-sm">
                    {thisWeekPRCount === 0 ? 'No personal records yet this week' : thisWeekPRCount === 1 ? '1 personal record achieved' : `${thisWeekPRCount} personal records achieved`}
                  </p>
                </div>
                {thisWeekPRCount > 0 && (
                  <div className="bg-gradient-to-br from-amber-900/30 to-amber-950/30 border border-amber-700/30 rounded-lg p-4 mb-4">
                    <p className="text-sm text-amber-200">Keep up the momentum! You're hitting new PRs this week.</p>
                  </div>
                )}
                <p className="text-xs text-slate-400 text-center">
                  PRs count all types of records: heaviest weight, most reps, and best set volume.
                </p>
              </div>
            </div>
          )}

          {selectedInsight === 'coach' && coachLensQuick && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 max-w-sm w-full max-h-[90dvh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-white">Coach Insight</h2>
                  <button
                    onClick={() => setSelectedInsight(null)}
                    className="p-1 hover:bg-slate-800 rounded transition"
                  >
                    <X size={18} className="text-slate-400" />
                  </button>
                </div>
                <div className="space-y-3">
                  <div className="rounded-lg border border-green-700/40 bg-green-900/20 p-3">
                    <p className="text-[10px] text-green-400 font-semibold tracking-widest mb-1">HEADLINE</p>
                    <p className="text-lg font-bold text-green-50">{coachLensQuick.headline}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-3 py-1 rounded-full border font-bold ${
                      coachLensQuick.status === 'push'
                        ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
                        : coachLensQuick.status === 'recover'
                        ? 'text-amber-300 border-amber-500/30 bg-amber-500/10'
                        : 'text-sky-300 border-sky-500/30 bg-sky-500/10'
                    }`}>
                      Status: {coachLensQuick.status}
                    </span>
                    <span className={`text-[10px] px-3 py-1 rounded-full border font-bold ${
                      coachLensQuick.confidence === 'high'
                        ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
                        : coachLensQuick.confidence === 'medium'
                        ? 'text-sky-300 border-sky-500/30 bg-sky-500/10'
                        : 'text-slate-300 border-slate-600/50 bg-slate-700/30'
                    }`}>
                      {coachLensQuick.confidence} confidence
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-2 text-center">
                      <p className="text-[10px] text-slate-500 mb-1">PROGRESSION</p>
                      <p className="text-sm font-bold text-white">{coachLensQuick.scores?.progression ?? 0}</p>
                    </div>
                    <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-2 text-center">
                      <p className="text-[10px] text-slate-500 mb-1">EXECUTION</p>
                      <p className="text-sm font-bold text-white">{coachLensQuick.scores?.execution ?? 0}</p>
                    </div>
                    <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-2 text-center">
                      <p className="text-[10px] text-slate-500 mb-1">FATIGUE RISK</p>
                      <p className="text-sm font-bold text-white">{coachLensQuick.scores?.fatigueRisk ?? 0}</p>
                    </div>
                  </div>
                  <div className="rounded-lg border border-emerald-700/40 bg-emerald-900/20 p-3">
                    <p className="text-[10px] text-emerald-400 font-semibold mb-1">KEEP</p>
                    <p className="text-sm text-emerald-50">{coachLensQuick.keep}</p>
                  </div>
                  <div className="rounded-lg border border-amber-700/40 bg-amber-900/20 p-3">
                    <p className="text-[10px] text-amber-400 font-semibold mb-1">IMPROVE</p>
                    <p className="text-sm text-amber-50">{coachLensQuick.improve}</p>
                  </div>
                  <div className="rounded-lg border border-blue-700/40 bg-blue-900/20 p-3">
                    <p className="text-[10px] text-blue-400 font-semibold mb-1">NEXT FOCUS</p>
                    <p className="text-sm text-blue-50">{coachLensQuick.focus}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
      </div>
  );
};

const getPairTone = (status) => {
  if (status === 'imbalanced') return 'text-rose-300 bg-rose-500/10 border-rose-500/30';
  if (status === 'slight') return 'text-amber-300 bg-amber-500/10 border-amber-500/30';
  return 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30';
};

const getCertaintyTone = (level) => {
  if (level === 'high') return 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10';
  if (level === 'medium') return 'text-sky-300 border-sky-500/30 bg-sky-500/10';
  return 'text-slate-300 border-slate-600/50 bg-slate-700/30';
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

export const HomeView = ({
  workouts,
  weeklyGoal,
  readiness,
  muscleBalance,
  trainingNotes,
  onTrainingNotesChange,
  onStartWorkout,
  onManageTemplates,
  onOpenCalendar,
  onViewHistory,
  onViewWorkoutDetail,
  onOpenMonthlyProgress
}) => {
  const [notesInput, setNotesInput] = useState(trainingNotes || '');
  const [isNotesFocused, setIsNotesFocused] = useState(false);
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [homeParallaxY, setHomeParallaxY] = useState(0);
  const [goalFlash, setGoalFlash] = useState(false);
  const prevWeekProgressRef = React.useRef(0);

  // Sync input when trainingNotes prop changes
  React.useEffect(() => {
    setNotesInput(trainingNotes || '');
  }, [trainingNotes]);

  const weekWorkouts = getWeekWorkouts(workouts);
  const safeWeeklyGoal = Math.max(Number(weeklyGoal) || 1, 1);
  const getMonthWorkoutsCount = (offset) => getMonthWorkouts(workouts, offset).length;
  const weekProgress = Math.min((weekWorkouts.length / safeWeeklyGoal) * 100, 100);

  React.useEffect(() => {
    if (prevWeekProgressRef.current !== 0 && prevWeekProgressRef.current !== weekProgress) {
      setGoalFlash(true);
      const t = setTimeout(() => setGoalFlash(false), 280);
      prevWeekProgressRef.current = weekProgress;
      return () => clearTimeout(t);
    }
    prevWeekProgressRef.current = weekProgress;
    return undefined;
  }, [weekProgress]);

  React.useEffect(() => {
    const onScroll = () => {
      const y = typeof window !== 'undefined' ? window.scrollY || 0 : 0;
      setHomeParallaxY(Math.min(y, 140));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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
      {/* Consistency Hero */}
      <div className="px-4 pt-6">
        <div className="bg-gradient-to-br from-accent/30 via-slate-900/70 to-black border border-accent/20 rounded-2xl p-5 shadow-lg ui-home-parallax" style={{ transform: `translateY(${homeParallaxY * -0.05}px)` }}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="text-[11px] text-slate-300 font-semibold tracking-widest">CONSISTENCY</p>
              <h1 className="text-2xl font-black text-white mt-1">Keep moving</h1>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <div className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold whitespace-nowrap ui-streak-countup">
                {weekStreak} week streak
              </div>
            </div>
          </div>

          <WeekHeatmap workouts={workouts} />

          <div className="mt-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-slate-400 text-[11px] font-semibold tracking-widest mb-1">WEEKLY TARGET</p>
              <p className="text-lg font-black text-white">
                {weekWorkouts.length} / {safeWeeklyGoal} workouts
              </p>
            </div>
            <div className={`min-w-12 h-12 px-2 rounded-full ${weekProgress >= 100 ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'accent-bg'} flex items-center justify-center text-white text-sm font-bold shadow-lg ui-goal-ring-fill ${goalFlash ? 'ui-week-goal-flash' : ''}`}>
              {Math.round(weekProgress)}%
            </div>
          </div>

          <div className="w-full bg-slate-800/50 rounded-full h-2 overflow-hidden border border-white/5 mt-3">
            <div
              className={`h-full ${weekProgress >= 100 ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gradient-to-r from-blue-500 to-cyan-500'} transition-all duration-200 ease-out ui-goal-meter-fill ${goalFlash ? 'ui-week-goal-flash' : ''}`}
              style={{ width: `${weekProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 pt-4 space-y-3">
        <button
          onClick={onStartWorkout}
          className="w-full bg-gradient-accent hover:opacity-90 text-white rounded-2xl py-4 px-6 flex items-center justify-center gap-3 font-bold text-lg shadow-2xl transition-all duration-200 ease-out ui-press border border-accent/20"
          style={{ boxShadow: `0 25px 50px -12px var(--accent)` }}
        >
          <Zap size={24} />
          Start New Workout
        </button>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onManageTemplates}
            className="bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50 text-white rounded-xl py-3 px-4 flex flex-col items-center justify-center gap-2 font-semibold transition-all duration-200 ease-out ui-press ui-home-quick-spring"
          >
            <Edit2 size={20} />
            <span className="text-xs">Templates</span>
          </button>
          <button
            onClick={onOpenCalendar}
            className="bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50 text-white rounded-xl py-3 px-4 flex flex-col items-center justify-center gap-2 font-semibold transition-all duration-200 ease-out ui-press ui-home-quick-spring"
          >
            <Calendar size={20} />
            <span className="text-xs">Calendar</span>
          </button>
        </div>
        <QuickInsightsSection workouts={workouts} readiness={readiness} muscleBalance={muscleBalance} />
      </div>

      {/* Training Notes */}
      <div className="px-4 pb-4 ui-notes-reveal">
        <div className="flex items-center justify-between mb-2">
          <p className="text-slate-400 text-xs font-semibold tracking-widest">TRAINING NOTES</p>
          <button
            onClick={() => setIsNotesModalOpen(true)}
            className="text-[11px] font-bold px-2.5 py-1 rounded-md border border-slate-600/60 text-slate-300 hover:text-white hover:border-slate-500/80 transition ui-press ui-notes-expand-focus"
          >
            Expand
          </button>
        </div>
        <textarea
          value={notesInput}
          onFocus={() => setIsNotesFocused(true)}
          onBlur={() => setIsNotesFocused(false)}
          onChange={(e) => {
            const nextValue = e.target.value;
            setNotesInput(nextValue);
            onTrainingNotesChange(nextValue);
          }}
          placeholder="Write notes directly here..."
          className={`w-full ${isNotesFocused || notesInput.length > 0 ? 'min-h-36' : 'min-h-24'} bg-slate-800/40 border border-slate-700/50 text-slate-200 rounded-lg p-3 font-semibold text-sm placeholder-slate-500 focus:border-blue-500 focus:outline-none transition-all duration-220 ease-out resize-y leading-relaxed whitespace-pre-wrap ui-notes-autogrow`}
        />

        {isNotesModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 ui-backdrop-in" onClick={() => setIsNotesModalOpen(false)}>
            <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl p-4 ui-sheet-rise-anim ui-notes-modal-pop" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-black tracking-wider text-white">TRAINING NOTES</p>
                <button
                  onClick={() => setIsNotesModalOpen(false)}
                  className="p-1 rounded-md border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition"
                >
                  <X size={15} />
                </button>
              </div>
              <textarea
                value={notesInput}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  setNotesInput(nextValue);
                  onTrainingNotesChange(nextValue);
                }}
                placeholder="Plan cues, reminders, recovery notes..."
                className="w-full min-h-[240px] bg-slate-800/50 border border-slate-700/50 text-slate-100 rounded-lg p-3 font-semibold text-sm placeholder-slate-500 focus:border-blue-500 focus:outline-none resize-y leading-relaxed whitespace-pre-wrap"
              />
              <button
                onClick={() => setIsNotesModalOpen(false)}
                className="w-full mt-3 h-10 rounded-lg bg-gradient-to-r from-accent to-accent text-white font-bold hover:opacity-90 transition ui-press ui-notes-expand-focus"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
      {/* Recent Workouts */}
      <div className="px-4 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-slate-400 text-xs font-semibold tracking-widest">RECENT</p>
            <h2 className="text-xl font-bold mt-1">Last Sessions</h2>
          </div>
          <button onClick={onViewHistory} className="accent-text hover:opacity-80 text-sm font-semibold transition ui-viewall-crossfade inline-flex items-center gap-1.5">
            <span>View All</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-slate-600/60 text-slate-300">{recentWorkouts.length}</span>
          </button>
        </div>

        {recentWorkouts.length === 0 ? (
          <div className="bg-slate-800/30 border border-slate-700/40 rounded-xl p-4 text-sm text-slate-400">
            No saved workouts yet.
          </div>
        ) : (
          <div className="space-y-2">
            {recentWorkouts.map((workout, index) => {
              const now = new Date();
              const workoutDate = new Date(workout.date);
              const ageInDays = Math.floor((now - workoutDate) / (1000 * 60 * 60 * 24));
              let opacity = 1;
              if (ageInDays > 7) {
                const fadeAmount = Math.min((ageInDays - 7) / 14, 0.5);
                opacity = 1 - fadeAmount;
              }

              return (
                <div
                  key={workout.id}
                  onClick={() => onViewWorkoutDetail(workout.date)}
                  className="bg-gradient-to-r from-slate-800/60 to-slate-900/60 hover:from-slate-700/60 hover:to-slate-800/60 border border-slate-700/30 p-4 rounded-xl cursor-pointer transition-all duration-200 ease-out group ui-card-mount-anim ui-last-session-enter ui-card-tilt"
                  style={{ opacity, animationDelay: `${Math.min(index, 4) * 55}ms` }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent to-accent flex items-center justify-center flex-shrink-0 mt-1">
                        <Check size={16} className="text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-sm text-white group-hover:accent-text transition truncate">{workout.name}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">{formatDate(workout.date)}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-white">{workout.exercises?.length || 0}</p>
                      <p className="text-xs text-slate-400">{workout.duration || 0}m</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Monthly Stats */}
      <div className="px-4 pb-4">
        <p className="text-slate-400 text-xs font-semibold tracking-widest mb-3">MONTHLY STATS</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onOpenMonthlyProgress(0)}
            className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-slate-700/30 rounded-xl p-4 hover:border-slate-600/50 transition ui-stagger-enter ui-stagger-d1 ui-press"
          >
            <p className="text-slate-400 text-xs font-semibold mb-2">THIS MONTH</p>
            <p className="text-2xl font-black text-white ui-number-slide">{getMonthWorkoutsCount(0)}</p>
            <p className="text-xs text-slate-500 mt-1">workouts</p>
          </button>
          <button
            onClick={() => onOpenMonthlyProgress(-1)}
            className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-slate-700/30 rounded-xl p-4 hover:border-slate-600/50 transition ui-stagger-enter ui-stagger-d2 ui-press"
          >
            <p className="text-slate-400 text-xs font-semibold mb-2">{getMonthLabel(-1).slice(0, 3).toUpperCase()}</p>
            <p className="text-2xl font-black text-white ui-number-slide">{getMonthWorkoutsCount(-1)}</p>
            <p className="text-xs text-slate-500 mt-1">workouts</p>
          </button>
        </div>
      </div>
    </div>
  );
};













