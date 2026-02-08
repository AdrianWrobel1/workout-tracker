import React, { useState } from 'react';
import { Plus, Edit2, Calendar, Check, TrendingUp, Zap, ChevronDown } from 'lucide-react';
import { getWeekWorkouts, getMonthWorkouts, getMonthLabel } from '../domain/workouts';
import { WeekHeatmap } from '../components/WeekHeatmap';
import { ProgressRing } from '../components/ProgressRing';
import { MiniSparkline } from '../components/MiniSparkline';
import { formatDate } from '../domain/calculations';

const QuickInsightsSection = ({ workouts }) => {
  const [open, setOpen] = useState(false);

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
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-slate-700/30 rounded-xl p-4 flex justify-center">
            <ProgressRing workouts={workouts} />
          </div>

          <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-slate-700/30 rounded-xl p-4 flex flex-col justify-center">
            <p className="text-xs text-slate-400 font-semibold tracking-widest mb-2">TREND</p>
            <div className="flex justify-center">
              <MiniSparkline workouts={workouts} metric="volume" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const HomeView = ({
  workouts,
  weeklyGoal,
  onStartWorkout,
  onManageTemplates,
  onOpenCalendar,
  onViewHistory,
  onViewWorkoutDetail,
  onOpenMonthlyProgress
}) => {
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