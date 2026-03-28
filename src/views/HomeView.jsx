import React, { useState, useMemo } from 'react';
import { Edit2, Calendar, Check, Zap, ChevronDown, X } from 'lucide-react';
import { getWeekWorkouts, getMonthWorkouts, getMonthLabel, calculateMasteryLevel, calculateMomentum } from '../domain/workouts';
import { WeekHeatmap } from '../components/WeekHeatmap';
import { ProgressRing } from '../components/ProgressRing';
import { MiniSparkline } from '../components/MiniSparkline';
import { SimpleLineChart } from '../components/SimpleLineChart';
import { EliteCoachingCard } from '../components/EliteCoachingCard';
import { calculateTotalVolume, formatDate } from '../domain/calculations';
import { generateEliteCoaching } from '../domain/eliteCoachingEngine';

const QuickInsightsSection = ({ workouts, readiness, muscleBalance, masteryData, anomalyDetection }) => {
  const [open, setOpen] = useState(false);
  const [selectedInsight, setSelectedInsight] = useState(null);
  const [showDetailedChart, setShowDetailedChart] = useState(false);
  const [detailModal, setDetailModal] = useState(null); // 'readiness' | 'balance' | 'mastery' | 'consistency' | 'readynext' | 'coaching' | null

  const coaching = useMemo(() => generateEliteCoaching(workouts, readiness, masteryData, anomalyDetection), [workouts, readiness, masteryData, anomalyDetection]);

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
  
  // Calculate PRs this week with exercise info
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
          // recordsPerSet is an object with setIndex as key and array of record types as value
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
  
  const thisWeekPRCount = thisWeekPRs.length;
  
  // Calculate mastery and momentum
  const resolvedMasteryData = useMemo(() => {
    return masteryData ?? calculateMasteryLevel(workouts || []);
  }, [masteryData, workouts]);
  const momentumData = useMemo(() => calculateMomentum(workouts || []), [workouts]);
  
  // Calculate consistency (% of weeks with at least 1 workout in last 12 weeks)
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

          <div className="grid grid-cols-2 gap-3 mt-3">
            <button
              onClick={() => setSelectedInsight('prs')}
              className="text-left bg-gradient-to-br from-amber-900/30 to-amber-950/30 border border-amber-700/30 rounded-xl p-3 transition hover:border-amber-600/50 ui-press ui-stagger-enter ui-stagger-d5 ui-card-magnet"
            >
              <p className="text-[10px] text-amber-400 font-semibold tracking-widest">THIS WEEK RECORDS</p>
              <p className="text-2xl font-black text-white mt-2">{thisWeekPRCount}</p>
              <p className="text-xs text-amber-200 mt-1">{thisWeekPRCount === 1 ? 'Record' : 'Records'}</p>
            </button>
            
            <button
              onClick={() => setDetailModal('mastery')}
              className="text-left bg-gradient-to-br from-purple-900/30 to-purple-950/30 border border-purple-700/30 rounded-xl p-3 transition hover:border-purple-600/50 ui-press ui-stagger-enter ui-stagger-d6 ui-card-magnet"
            >
              <p className="text-[10px] text-purple-400 font-semibold tracking-widest">MASTERY LEVEL</p>
              <p className="text-2xl font-black text-white mt-2">{resolvedMasteryData.level}</p>
              <p className="text-xs text-purple-200 mt-1 truncate">{resolvedMasteryData.title}</p>
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-3 mt-3">
            <button
              onClick={() => setDetailModal('consistency')}
              className="text-left bg-gradient-to-br from-cyan-900/30 to-cyan-950/30 border border-cyan-700/30 rounded-xl p-3 transition hover:border-cyan-600/50 ui-press ui-stagger-enter ui-stagger-d7 ui-card-magnet"
            >
              <p className="text-[10px] text-cyan-400 font-semibold tracking-widest">CONSISTENCY</p>
              <p className="text-2xl font-black text-white mt-2">{consistencyData.consistency}%</p>
              <p className="text-xs text-cyan-200 mt-1">{consistencyData.activeWeeks}/12 weeks</p>
            </button>
            
            <button
              onClick={() => setDetailModal('coaching')}
              className="text-left bg-gradient-to-br from-orange-900/30 to-red-900/30 border border-orange-700/30 rounded-xl p-3 transition hover:border-orange-600/50 ui-press ui-stagger-enter ui-stagger-d9 ui-card-magnet"
            >
              <p className="text-[10px] text-orange-400 font-semibold tracking-widest">💡 AI COACHING</p>
              <p className="text-sm font-black text-white mt-2">{coaching?.trainingZone?.toUpperCase() || 'No Data'}</p>
              <p className="text-xs text-orange-200 mt-1">{coaching?.repRange || 'Set target'} • {coaching?.sets || '3-4'} sets</p>
            </button>
          </div>



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
              <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 max-w-sm w-full max-h-[80dvh] overflow-y-auto">
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
                  <>
                    <div className="bg-gradient-to-br from-amber-900/30 to-amber-950/30 border border-amber-700/30 rounded-lg p-4 mb-4">
                      <p className="text-sm text-amber-200">Keep up the momentum! You're hitting new PRs this week.</p>
                    </div>
                    <div className="space-y-2 mb-4">
                      {thisWeekPRs.map((pr, idx) => (
                        <div key={idx} className="bg-slate-800/50 border border-slate-700/30 rounded-lg p-3">
                          <p className="text-sm font-bold text-white">{pr.exerciseName}</p>
                          <p className="text-xs text-amber-200 mt-1">{pr.recordTypes.join(', ')}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <p className="text-xs text-slate-400 text-center">
                  PRs count all types of records: best 1RM, best set volume, and heaviest weight.
                </p>
              </div>
            </div>
          )}

          {detailModal === 'mastery' && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 max-w-sm w-full">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-white">Mastery Level</h2>
                  <button
                    onClick={() => setDetailModal(null)}
                    className="p-1 hover:bg-slate-800 rounded transition"
                  >
                    <X size={18} className="text-slate-400" />
                  </button>
                </div>
                <div className="bg-gradient-to-br from-purple-900/30 to-purple-950/30 border border-purple-700/30 rounded-lg p-4 mb-4 text-center">
                  <p className="text-[10px] text-purple-400 font-semibold tracking-widest mb-2">CURRENT TIER</p>
                  <p className="text-4xl font-black text-white mb-2">{resolvedMasteryData.level}</p>
                  <p className="text-sm font-bold text-purple-200">{resolvedMasteryData.title}</p>
                </div>
                <div className="space-y-3">
                  <div className="bg-slate-800/50 border border-slate-700/30 rounded-lg p-3">
                    <p className="text-xs text-slate-400 mb-1">MASTERY POINTS</p>
                    <p className="text-2xl font-bold text-white">{resolvedMasteryData.masteryPoints || 0}</p>
                  </div>
                  <div className="bg-slate-800/50 border border-slate-700/30 rounded-lg p-3">
                    <p className="text-xs text-slate-400 mb-1">TO NEXT TIER</p>
                    <p className="text-sm text-slate-300">{resolvedMasteryData.nextMilestone || 'Master level achieved!'}</p>
                  </div>
                  <div className="bg-slate-800/50 border border-slate-700/30 rounded-lg p-3">
                    <p className="text-xs text-slate-400 mb-1">EXERCISES MASTERED</p>
                    <p className="text-lg font-bold text-white">{resolvedMasteryData.exercisesMastered || 0}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {detailModal === 'consistency' && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 max-w-sm w-full">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-white">Consistency Streak</h2>
                  <button
                    onClick={() => setDetailModal(null)}
                    className="p-1 hover:bg-slate-800 rounded transition"
                  >
                    <X size={18} className="text-slate-400" />
                  </button>
                </div>
                <div className="bg-gradient-to-br from-cyan-900/30 to-cyan-950/30 border border-cyan-700/30 rounded-lg p-4 mb-4 text-center">
                  <p className="text-[10px] text-cyan-400 font-semibold tracking-widest mb-2">CONSISTENCY RATE</p>
                  <p className="text-5xl font-black text-white mb-2">{consistencyData.consistency}%</p>
                  <p className="text-sm text-cyan-200">{consistencyData.activeWeeks} out of 12 weeks active</p>
                </div>
                <div className="space-y-3">
                  <div className="bg-slate-800/50 border border-slate-700/30 rounded-lg p-3">
                    <p className="text-xs text-slate-400 mb-1">12-WEEK PERFORMANCE</p>
                    <p className="text-sm text-slate-300">You've worked out in <span className="font-bold text-cyan-400">{consistencyData.activeWeeks}</span> weeks out of the last 12.</p>
                  </div>
                  <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border border-cyan-500/20 rounded-lg p-3">
                    <p className="text-xs text-cyan-300 font-semibold mb-2">💪 TIP</p>
                    <p className="text-xs text-cyan-100">Aim for consistency over intensity. One workout every week is better than sporadic intensive sessions.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {detailModal === 'readynext' && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 max-w-sm w-full">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-white">Ready for Next Session?</h2>
                  <button
                    onClick={() => setDetailModal(null)}
                    className="p-1 hover:bg-slate-800 rounded transition"
                  >
                    <X size={18} className="text-slate-400" />
                  </button>
                </div>
                <div className={`bg-gradient-to-br ${
                  momentumData.motivationTier === 'peak'
                    ? 'from-emerald-900/30 to-emerald-950/30 border border-emerald-700/30'
                    : momentumData.motivationTier === 'high'
                    ? 'from-cyan-900/30 to-cyan-950/30 border border-cyan-700/30'
                    : momentumData.motivationTier === 'moderate'
                    ? 'from-amber-900/30 to-amber-950/30 border border-amber-700/30'
                    : 'from-rose-900/30 to-rose-950/30 border border-rose-700/30'
                } rounded-lg p-4 mb-4 text-center`}>
                  <p className={`text-[10px] font-semibold tracking-widest mb-2 ${
                    momentumData.motivationTier === 'peak'
                      ? 'text-emerald-400'
                      : momentumData.motivationTier === 'high'
                      ? 'text-cyan-400'
                      : momentumData.motivationTier === 'moderate'
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}>MOTIVATION STATUS</p>
                  <p className="text-3xl font-black text-white capitalize mb-2">{momentumData.motivationTier}</p>
                  <p className={`text-sm ${
                    momentumData.motivationTier === 'peak'
                      ? 'text-emerald-200'
                      : momentumData.motivationTier === 'high'
                      ? 'text-cyan-200'
                      : momentumData.motivationTier === 'moderate'
                      ? 'text-amber-200'
                      : 'text-rose-200'
                  }`}>{momentumData.currentStreak} week streak going</p>
                </div>
                <div className="space-y-3">
                  <div className="bg-slate-800/50 border border-slate-700/30 rounded-lg p-3">
                    <p className="text-xs text-slate-400 mb-1">THIS WEEK'S MOMENTUM</p>
                    <p className="text-sm text-slate-300">{momentumData.weeklyMessage || 'You\'re making great progress!'}</p>
                  </div>
                  <div className={`rounded-lg p-3 ${
                    momentumData.motivationTier === 'peak'
                      ? 'bg-emerald-500/10 border border-emerald-500/20'
                      : momentumData.motivationTier === 'high'
                      ? 'bg-cyan-500/10 border border-cyan-500/20'
                      : momentumData.motivationTier === 'moderate'
                      ? 'bg-amber-500/10 border border-amber-500/20'
                      : 'bg-rose-500/10 border border-rose-500/20'
                  }`}>
                    <p className={`text-xs font-semibold mb-2 ${
                      momentumData.motivationTier === 'peak'
                        ? 'text-emerald-300'
                        : momentumData.motivationTier === 'high'
                        ? 'text-cyan-300'
                        : momentumData.motivationTier === 'moderate'
                        ? 'text-amber-300'
                        : 'text-rose-300'
                    }`}>💡 SESSION PLAN</p>
                    <p className="text-xs text-slate-200">{momentumData.sessionRecommendation || 'Time for a focused session!'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AI Coaching Modal */}
          {detailModal === 'coaching' && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-md w-full my-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-white">Today's Coaching</h2>
                  <button onClick={() => setDetailModal(null)} className="p-1 hover:bg-slate-800 rounded transition">
                    <X size={18} className="text-slate-400" />
                  </button>
                </div>
                <EliteCoachingCard 
                  readiness={readiness} 
                  masteryData={masteryData}
                  anomalyDetection={anomalyDetection}
                />

                <div className="mt-4 rounded-lg border border-orange-500/30 bg-orange-900/20 p-3">
                  <p className="text-xs text-orange-200 font-semibold mb-2">Action</p>
                  <p className="text-[11px] text-orange-100 mb-3">
                    This recommendation can be used as a template plan summary for your next session. Copy and paste into exercise notes or set up a matching plan in Template Plans.
                  </p>
                  <button
                    onClick={() => {
                      const summary = `AI Coaching: ${coaching.trainingZone} • ${coaching.intensity} • ${coaching.repRange} reps • ${coaching.sets} sets • RIR ${coaching.rirTarget}`;
                      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                        navigator.clipboard.writeText(summary);
                      }
                    }}
                    className="w-full px-3 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg text-xs font-bold text-slate-900 transition"
                  >
                    Copy Plan Summary
                  </button>
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
  masteryData,
  anomalyDetection,
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
        <QuickInsightsSection workouts={workouts} readiness={readiness} muscleBalance={muscleBalance} masteryData={masteryData} anomalyDetection={anomalyDetection} />
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















