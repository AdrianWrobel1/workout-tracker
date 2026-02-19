import React, { useState, useMemo } from 'react';
import { Edit2, Calendar, Check, Zap, ChevronDown, X } from 'lucide-react';
import { getWeekWorkouts, getMonthWorkouts, getMonthLabel } from '../domain/workouts';
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
              className="text-left bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-slate-700/30 rounded-xl p-3 transition hover:border-slate-600/50 ui-press"
            >
              <p className="text-[10px] text-slate-400 font-semibold tracking-widest">READINESS</p>
              <div className="flex items-end justify-between mt-1">
                <p className="text-lg font-black text-white leading-none">
                  {readiness?.readinessScore ?? 0}
                </p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${
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
              className="text-left bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-slate-700/30 rounded-xl p-3 transition hover:border-slate-600/50 ui-press"
            >
              <p className="text-[10px] text-slate-400 font-semibold tracking-widest">MUSCLE BALANCE</p>
              <p className="text-lg font-black text-white mt-1 leading-none">
                {muscleBalance?.week?.score ?? 0}
                <span className="text-[10px] text-slate-400 font-semibold ml-1">week</span>
              </p>
              <div className="mt-2 flex items-center justify-between text-[10px]">
                <span className="text-slate-500">Block: {muscleBalance?.block?.score ?? 0}</span>
                <span className={`px-2 py-0.5 rounded-full border font-bold ${getPairTone(muscleBalance?.week?.pushPull?.status || 'balanced')}`}>
                  {getPairLabel(muscleBalance?.week?.pushPull)}
                </span>
              </div>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-3">
            <button
              onClick={() => setSelectedInsight('progress')}
              className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-slate-700/30 hover:border-slate-600/50 rounded-xl p-4 flex justify-center transition-all duration-200 hover:scale-105 active:scale-95"
            >
              <ProgressRing workouts={workouts} />
            </button>

            <button
              onClick={() => setSelectedInsight('trend')}
              className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-slate-700/30 hover:border-slate-600/50 rounded-xl p-4 flex flex-col justify-center transition-all duration-200 hover:scale-105 active:scale-95"
            >
              <p className="text-xs text-slate-400 font-semibold tracking-widest mb-2">TREND</p>
              <div className="flex justify-center">
                <MiniSparkline workouts={workouts} metric="volume" />
              </div>
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
                    ✕
                  </button>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <ProgressRing workouts={workouts} />
                </div>
                <p className="text-xs text-slate-400 text-center mt-4">
                  You're on track with your weekly goal! Keep crushing it 💪
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
                    ✕
                  </button>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <MiniSparkline workouts={workouts} metric="volume" />
                </div>
                <button
                  onClick={() => setShowDetailedChart(true)}
                  className="w-full mt-4 px-3 py-2 accent-bg hover:opacity-90 rounded transition text-sm font-bold"
                >
                  See detailed chart →
                </button>
              </div>
            </div>
          )}

          {/* Detailed chart modal */}
          {showDetailedChart && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
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
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-sm w-full">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-white">Readiness Details</h2>
                  <button onClick={() => setDetailModal(null)} className="p-1 hover:bg-slate-800 rounded transition">
                    <X size={18} className="text-slate-400" />
                  </button>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-3">
                    <p className="text-xs text-slate-400 font-semibold tracking-widest mb-1">SCORE</p>
                    <p className="text-xl font-black text-white">{readiness?.readinessScore ?? 0}/100</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-2.5">
                      <p className="text-[10px] text-slate-400 font-semibold tracking-widest">ACUTE</p>
                      <p className="text-sm font-bold text-white">{readiness?.acuteLoad ?? 0}</p>
                    </div>
                    <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-2.5">
                      <p className="text-[10px] text-slate-400 font-semibold tracking-widest">CHRONIC</p>
                      <p className="text-sm font-bold text-white">{readiness?.chronicLoad ?? 0}</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-300">{readiness?.suggestion || 'No readiness data available yet.'}</p>
                </div>
              </div>
            </div>
          )}

          {detailModal === 'balance' && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-sm w-full">
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
                    return (
                      <div key={row.key} className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-2.5">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-semibold text-slate-200">{row.label}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${getPairTone(week?.status || 'balanced')}`}>
                            {week?.status || 'balanced'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">Week: <span className="text-slate-200 font-semibold">{getPairLabel(week)}</span></p>
                        <p className="text-[11px] text-slate-400">Block: <span className="text-slate-200 font-semibold">{getPairLabel(block)}</span></p>
                      </div>
                    );
                  })}
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

  // Sync input when trainingNotes prop changes
  React.useEffect(() => {
    setNotesInput(trainingNotes || '');
  }, [trainingNotes]);

  const weekWorkouts = getWeekWorkouts(workouts);
  const safeWeeklyGoal = Math.max(Number(weeklyGoal) || 1, 1);
  const getMonthWorkoutsCount = (offset) => getMonthWorkouts(workouts, offset).length;
  const weekProgress = Math.min((weekWorkouts.length / safeWeeklyGoal) * 100, 100);

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
    <div className="min-h-screen bg-black text-white pb-28">
      {/* Consistency Hero */}
      <div className="px-4 pt-6">
        <div className="bg-gradient-to-br from-accent/30 via-slate-900/70 to-black border border-accent/20 rounded-2xl p-5 shadow-lg">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="text-[11px] text-slate-300 font-semibold tracking-widest">CONSISTENCY</p>
              <h1 className="text-2xl font-black text-white mt-1">Keep moving</h1>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <div className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold whitespace-nowrap">
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
            <div className={`min-w-12 h-12 px-2 rounded-full ${weekProgress >= 100 ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'accent-bg'} flex items-center justify-center text-white text-sm font-bold shadow-lg`}>
              {Math.round(weekProgress)}%
            </div>
          </div>

          <div className="w-full bg-slate-800/50 rounded-full h-2 overflow-hidden border border-white/5 mt-3">
            <div
              className={`h-full ${weekProgress >= 100 ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gradient-to-r from-blue-500 to-cyan-500'} transition-all duration-200 ease-out`}
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
            className="bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50 text-white rounded-xl py-3 px-4 flex flex-col items-center justify-center gap-2 font-semibold transition-all duration-200 ease-out ui-press"
          >
            <Edit2 size={20} />
            <span className="text-xs">Templates</span>
          </button>
          <button
            onClick={onOpenCalendar}
            className="bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50 text-white rounded-xl py-3 px-4 flex flex-col items-center justify-center gap-2 font-semibold transition-all duration-200 ease-out ui-press"
          >
            <Calendar size={20} />
            <span className="text-xs">Calendar</span>
          </button>
        </div>
        <QuickInsightsSection workouts={workouts} readiness={readiness} muscleBalance={muscleBalance} />
      </div>

      {/* Training Notes */}
      <div className="px-4 pb-4">
        <p className="text-slate-400 text-xs font-semibold tracking-widest mb-2">TRAINING NOTES</p>
        <textarea
          value={notesInput}
          onChange={(e) => {
            const nextValue = e.target.value;
            setNotesInput(nextValue);
            onTrainingNotesChange(nextValue);
          }}
          placeholder="Write notes directly here..."
          className="w-full min-h-28 bg-slate-800/40 border border-slate-700/50 text-slate-200 rounded-lg p-3 font-semibold text-sm placeholder-slate-500 focus:border-blue-500 focus:outline-none transition resize-y leading-relaxed whitespace-pre-wrap"
        />
      </div>

      {/* Recent Workouts */}
      <div className="px-4 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-slate-400 text-xs font-semibold tracking-widest">RECENT</p>
            <h2 className="text-xl font-bold mt-1">Last Sessions</h2>
          </div>
          <button onClick={onViewHistory} className="accent-text hover:opacity-80 text-sm font-semibold transition">
            View All
          </button>
        </div>

        {recentWorkouts.length === 0 ? (
          <div className="bg-slate-800/30 border border-slate-700/40 rounded-xl p-4 text-sm text-slate-400">
            No saved workouts yet.
          </div>
        ) : (
          <div className="space-y-2">
            {recentWorkouts.map((workout) => {
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
                  className="bg-gradient-to-r from-slate-800/60 to-slate-900/60 hover:from-slate-700/60 hover:to-slate-800/60 border border-slate-700/30 p-4 rounded-xl cursor-pointer transition-all duration-200 ease-out group ui-card-mount-anim"
                  style={{ opacity }}
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
            className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-slate-700/30 rounded-xl p-4 hover:border-slate-600/50 transition"
          >
            <p className="text-slate-400 text-xs font-semibold mb-2">THIS MONTH</p>
            <p className="text-2xl font-black text-white">{getMonthWorkoutsCount(0)}</p>
            <p className="text-xs text-slate-500 mt-1">workouts</p>
          </button>
          <button
            onClick={() => onOpenMonthlyProgress(-1)}
            className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-slate-700/30 rounded-xl p-4 hover:border-slate-600/50 transition"
          >
            <p className="text-slate-400 text-xs font-semibold mb-2">{getMonthLabel(-1).slice(0, 3).toUpperCase()}</p>
            <p className="text-2xl font-black text-white">{getMonthWorkoutsCount(-1)}</p>
            <p className="text-xs text-slate-500 mt-1">workouts</p>
          </button>
        </div>
      </div>
    </div>
  );
};

