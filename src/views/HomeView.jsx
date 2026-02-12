import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Edit2, Calendar, Check, TrendingUp, Zap, ChevronDown, X } from 'lucide-react';
import { getWeekWorkouts, getMonthWorkouts, getMonthLabel } from '../domain/workouts';
import { WeekHeatmap } from '../components/WeekHeatmap';
import { ProgressRing } from '../components/ProgressRing';
import { MiniSparkline } from '../components/MiniSparkline';
import { SimpleLineChart } from '../components/SimpleLineChart';
import { calculateTotalVolume } from '../domain/calculations';
import { formatDate } from '../domain/calculations';

const QuickInsightsSection = ({ workouts }) => {
  const [open, setOpen] = useState(false);
  const [selectedInsight, setSelectedInsight] = useState(null);
  const [showDetailedChart, setShowDetailedChart] = useState(false);

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
                  className="w-full mt-4 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded transition text-sm font-bold"
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
        </>
      )}
    </div>
  );
};

export const HomeView = ({
  workouts,
  weeklyGoal,
  trainingNotes,
  onTrainingNotesChange,
  onStartWorkout,
  onManageTemplates,
  onOpenCalendar,
  onViewHistory,
  onViewWorkoutDetail,
  onOpenMonthlyProgress
}) => {
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [notesInput, setNotesInput] = useState(trainingNotes || '');

  // Sync modal input when trainingNotes prop changes
  React.useEffect(() => {
    setNotesInput(trainingNotes || '');
  }, [trainingNotes, notesModalOpen]);

  const weekWorkouts = getWeekWorkouts(workouts);
  const getMonthWorkoutsCount = (offset) => getMonthWorkouts(workouts, offset).length;
  const weekProgress = Math.min((weekWorkouts.length / weeklyGoal) * 100, 100);

  return (
    <div className="min-h-screen bg-black text-white pb-28">
      {/* Header Hero */}
      <div className="bg-gradient-to-br from-slate-950 via-black to-black border-b border-white/10 p-6 pb-8">
        <div className="mb-8">
          <p className="text-slate-400 text-sm font-light tracking-widest mb-2">WELCOME BACK</p>
          <h1 className="text-4xl font-black bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
            Keep Moving
          </h1>
        </div>

        {/* Weekly Progress Card */}
        <div className="bg-gradient-to-br from-blue-950/40 to-slate-900/40 border border-blue-500/20 rounded-2xl p-6">
          {/* Minimal week heatmap */}
          <WeekHeatmap workouts={workouts} />
          
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-slate-400 text-xs font-semibold tracking-widest mb-2">WEEKLY GOAL</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-white">{weekWorkouts.length}</span>
                <span className="text-slate-400 text-lg font-light">/ {weeklyGoal}</span>
              </div>
            </div>
            <div className={`w-14 h-14 rounded-full ${weekProgress >= 100 ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-blue-500 to-blue-600'} flex items-center justify-center text-white font-bold shadow-lg`}>
              {Math.round(weekProgress)}%
            </div>
          </div>
          <div className="w-full bg-slate-800/50 rounded-full h-2 overflow-hidden border border-white/5">
            <div 
              className={`h-full ${weekProgress >= 100 ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gradient-to-r from-blue-500 to-cyan-500'} transition-all duration-200 ease-out`}
              style={{ width: `${weekProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Quick Actions + Stats */}
      <div className="px-4 py-6 space-y-4">
        <button
          onClick={onStartWorkout}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white rounded-2xl py-4 px-6 flex items-center justify-center gap-3 font-bold text-lg shadow-2xl shadow-blue-900/50 transition-all duration-200 ease-out ui-press border border-blue-400/20"
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
        {/* Quick Insights (collapsible) placed under Templates/Calendar as requested */}
        <QuickInsightsSection workouts={workouts} />
      </div>

      {/* Training Notes */}
      <div className="px-4 py-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-slate-400 text-xs font-semibold tracking-widest">TRAINING NOTES</p>
          <button
            onClick={() => {
              setNotesInput(trainingNotes || '');
              setNotesModalOpen(true);
            }}
            className="text-blue-400 hover:text-blue-300 text-xs font-semibold transition"
          >
            {trainingNotes ? 'Edit' : 'Add'}
          </button>
        </div>
        {trainingNotes && (
          <div className="w-full bg-slate-800/30 border border-slate-700/50 text-slate-300 rounded-lg p-3 font-semibold text-sm line-clamp-2">
            {trainingNotes}
          </div>
        )}
      </div>

      {/* Training Notes Modal */}
      {notesModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-gradient-to-br from-slate-900 to-black border border-slate-700/50 rounded-2xl w-full sm:max-w-md max-h-[90vh] sm:max-h-[85vh] flex flex-col shadow-2xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-700/30">
              <h2 className="text-lg sm:text-xl font-black text-white">Training Notes</h2>
              <button
                onClick={() => setNotesModalOpen(false)}
                className="p-1 hover:bg-slate-800/50 rounded-lg transition"
              >
                <X size={24} className="text-slate-400" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <textarea
                autoFocus
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                placeholder="Zapisz wszystko: co dołożyć, co nie weszło, co bolało, pomysły na kolejne treningi…"
                className="w-full h-64 bg-slate-800/50 border border-slate-700/50 text-white rounded-lg p-4 font-semibold text-sm placeholder-slate-600 focus:border-blue-500 focus:outline-none transition resize-none"
              />
            </div>

            {/* Footer */}
            <div className="flex gap-2 p-4 sm:p-6 border-t border-slate-700/30 bg-slate-900/30">
              <button
                onClick={() => {
                  onTrainingNotesChange(notesInput);
                  setNotesModalOpen(false);
                }}
                className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold text-sm transition-all"
              >
                Save
              </button>
              <button
                onClick={() => setNotesModalOpen(false)}
                className="flex-1 px-4 py-3 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 font-bold text-sm transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recent Workouts */}
      <div className="px-4 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-slate-400 text-xs font-semibold tracking-widest">RECENT</p>
            <h2 className="text-xl font-bold mt-1">Last Sessions</h2>
          </div>
          <button onClick={onViewHistory} className="text-blue-400 hover:text-blue-300 text-sm font-semibold transition">
            View All
          </button>
        </div>

        <div className="space-y-2">
          {workouts.slice(0, 4).map((workout, idx) => {
            // Calculate age in days
            const now = new Date();
            const workoutDate = new Date(workout.date);
            const ageInDays = Math.floor((now - workoutDate) / (1000 * 60 * 60 * 24));
            
            // Fade effect: full opacity for 0-7 days, then fade
            let opacity = 1;
            if (ageInDays > 7) {
              const fadeAmount = Math.min((ageInDays - 7) / 14, 0.5); // fade over 14 days
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
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <Check size={16} className="text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-sm text-white group-hover:text-blue-300 transition truncate">{workout.name}</h3>
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
      </div>

      {/* Stats Section */}
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