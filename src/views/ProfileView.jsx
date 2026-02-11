import React, { useState, useMemo } from 'react';
import { Settings, BarChart3, Dumbbell, Activity, Calendar, Edit2 } from 'lucide-react';
import { calculateTotalVolume } from '../domain/calculations';
import { UnifiedChart } from '../components/UnifiedChart';

export const ProfileView = ({
  workouts = [],
  exercisesDB = [],
  userWeight,
  onUserWeightChange,
  onViewStatistics,
  onViewExercises,
  onViewCalendar,
  onWorkoutClick,
  onOpenSettings
}) => {
  const [hoveredBarIndex, setHoveredBarIndex] = useState(null);
  const [chartMetric, setChartMetric] = useState('duration'); // 'duration' | 'volume' | 'reps'
  const [dateRange, setDateRange] = useState('3months'); // '1week' | '1month' | '3months'
  const [isEditingName, setIsEditingName] = useState(false);
  const [userName, setUserName] = useState('Athlete');
  const [isViewingMeasures, setIsViewingMeasures] = useState(false);
  const [measurements, setMeasurements] = useState({
    chest: '',
    waist: '',
    hips: '',
    biceps: '',
    thigh: '',
    calf: ''
  });

  // Get date range in days
  const getDaysFromRange = (range) => {
    switch (range) {
      case '1week': return 7;
      case '1month': return 30;
      case '3months': return 90;
      case '1year': return 365;
      default: return 90;
    }
  };

  // Map date range format (ProfileView uses '1week' format, UnifiedChart uses '7days')
  const getUnifiedChartPeriod = (range) => {
    switch (range) {
      case '1week': return '7days';
      case '1month': return '30days';
      case '3months': return '3months';
      case '1year': return '1year';
      default: return '3months';
    }
  };

  // Calculate summary text based on metric
  const summaryText = useMemo(() => {
    const period = dateRange === '1week' ? 'this week' : dateRange === '1month' ? 'this month' : dateRange === '3months' ? 'last 3 months' : 'this year';
    
    if (chartMetric === 'duration') {
      // Calculate total duration from workouts in range
      const now = new Date();
      let startDate;
      switch (dateRange) {
        case '1week': startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
        case '1month': startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
        case '3months': startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); break;
        case '1year': startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); break;
        default: startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      }
      const total = (workouts || []).filter(w => new Date(w.date) >= startDate).reduce((sum, w) => sum + (w.duration || 0), 0);
      const hours = Math.round(total / 60);
      return `${hours} hours ${period}`;
    }
    
    // Count workouts in range
    const now = new Date();
    let startDate;
    switch (dateRange) {
      case '1week': startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
      case '1month': startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
      case '3months': startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); break;
      case '1year': startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); break;
      default: startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    }
    const sessions = (workouts || []).filter(w => new Date(w.date) >= startDate).length;
    return `${sessions} sessions ${period}`;
  }, [workouts, dateRange, chartMetric]);

  // Get last 5 workouts
  const lastWorkouts = useMemo(() => workouts.slice(0, 5), [workouts]);

  // Calculate workout count
  const workoutCount = workouts.length;

  return (
    <div className="min-h-screen bg-black text-white pb-40">
      {/* Header with Edit Button */}
      <div className="bg-gradient-to-b from-black to-black/80 border-b border-white/10 p-4 sticky top-0 z-20 shadow-2xl">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-black">PROFILE</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setIsEditingName(true)}
              className="p-2 hover:bg-white/10 rounded-lg transition text-slate-400 hover:text-white"
              aria-label="Edit nickname"
            >
              <Edit2 size={20} />
            </button>
            <button
              onClick={onOpenSettings}
              className="p-2 hover:bg-white/10 rounded-lg transition text-slate-400 hover:text-white"
              aria-label="Settings"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Profile Header Section */}
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-xl p-6 animate-chart-fade-in">
          <div className="flex items-start gap-4">
            {/* Avatar Placeholder */}
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl font-black text-white">👤</span>
            </div>

            {/* Profile Info */}
            <div className="flex-1">
              {isEditingName ? (
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="flex-1 bg-slate-800/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white font-black focus:border-blue-500 focus:outline-none transition"
                    autoFocus
                  />
                  <button
                    onClick={() => setIsEditingName(false)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <h2 className="text-2xl font-black text-white">{userName}</h2>
              )}
              <div className="mt-3 flex gap-6">
                <div>
                  <p className="text-xs text-slate-400 font-semibold tracking-widest">WORKOUTS</p>
                  <p className="text-xl font-black text-blue-400 mt-1">{workoutCount}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Activity Time Section */}
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-xl p-6 animate-chart-fade-in">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold text-white capitalize">{summaryText}</p>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="text-xs font-bold bg-slate-700/50 border border-slate-600/50 text-slate-300 rounded-lg px-3 py-1.5 focus:border-blue-500 focus:outline-none"
            >
              <option value="1week">Last 7 days</option>
              <option value="1month">Last 30 days</option>
              <option value="3months">Last 3 months</option>
              <option value="1year">Last year</option>
            </select>
          </div>

          {/* Chart - using UnifiedChart for consistency */}
          <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/30 mb-4">
            <UnifiedChart
              workouts={workouts}
              metric={chartMetric}
              timePeriod={getUnifiedChartPeriod(dateRange)}
              userWeight={userWeight}
              exercisesDB={exercisesDB}
              color="#06b6d4"
              unit={chartMetric === 'duration' ? 'h' : chartMetric === 'volume' ? 'k' : 'reps'}
            />
          </div>

          {/* Metric Toggle */}
          <div className="flex gap-2">
            {[
              { key: 'duration', label: 'Duration' },
              { key: 'volume', label: 'Volume' },
              { key: 'reps', label: 'Reps' }
            ].map(metric => (
              <button
                key={metric.key}
                onClick={() => setChartMetric(metric.key)}
                className={`flex-1 py-2 px-3 rounded-lg font-bold text-xs uppercase tracking-wider transition-all ${
                  chartMetric === metric.key
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'
                }`}
              >
                {metric.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dashboard Grid - 4 Tiles */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={onViewStatistics}
            className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 hover:border-slate-600/50 rounded-xl p-6 text-center transition-all hover:shadow-lg hover:shadow-blue-600/20 ui-card-mount-anim"
          >
            <BarChart3 size={32} className="mx-auto mb-3 text-blue-400" />
            <h3 className="font-black text-white text-sm">Statistics</h3>
          </button>

          <button
            onClick={onViewExercises}
            className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 hover:border-slate-600/50 rounded-xl p-6 text-center transition-all hover:shadow-lg hover:shadow-emerald-600/20 ui-card-mount-anim"
          >
            <Dumbbell size={32} className="mx-auto mb-3 text-emerald-400" />
            <h3 className="font-black text-white text-sm">Exercises</h3>
          </button>

          <button
            onClick={() => setIsViewingMeasures(true)}
            className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 hover:border-slate-600/50 rounded-xl p-6 text-center transition-all hover:shadow-lg hover:shadow-purple-600/20 ui-card-mount-anim"
          >
            <Activity size={32} className="mx-auto mb-3 text-purple-400" />
            <h3 className="font-black text-white text-sm">Measures</h3>
          </button>

          <button
            onClick={onViewCalendar}
            className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 hover:border-slate-600/50 rounded-xl p-6 text-center transition-all hover:shadow-lg hover:shadow-amber-600/20 ui-card-mount-anim"
          >
            <Calendar size={32} className="mx-auto mb-3 text-amber-400" />
            <h3 className="font-black text-white text-sm">Calendar</h3>
          </button>
        </div>

        {/* Recent Workouts Section */}
        {lastWorkouts.length > 0 && (
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-xl p-6 animate-chart-fade-in">
            <h2 className="text-sm font-black text-slate-300 uppercase tracking-widest mb-4">Recent Workouts</h2>
            <div className="space-y-3">
              {lastWorkouts.map((workout, idx) => {
                const date = new Date(workout.date);
                const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
                const totalVol = (workout.exercises || []).reduce(
                  (sum, ex) => sum + calculateTotalVolume(ex.sets || []),
                  0
                );
                const exerciseCount = (workout.exercises || []).length;

                return (
                  <button
                    key={idx}
                    onClick={() => onWorkoutClick && onWorkoutClick(workout.date)}
                    className="w-full text-left bg-slate-800/40 hover:bg-slate-800/60 border border-slate-700/50 hover:border-slate-600/50 rounded-lg p-4 transition-all"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-bold text-white">{workout.name || 'Unnamed Workout'}</h3>
                        <p className="text-xs text-slate-500 mt-1">{dateStr}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-blue-400">{(totalVol / 1000).toFixed(1)}k</p>
                        <p className="text-xs text-slate-500">total volume</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span>{workout.duration || 0}m</span>
                      <span>•</span>
                      <span>{exerciseCount} exercises</span>
                    </div>

                    {/* Exercise list - max 3 */}
                    {exerciseCount > 0 && (
                      <div className="mt-2 text-xs text-slate-500">
                        {(workout.exercises || [])
                          .slice(0, 3)
                          .map((ex, i) => (
                            <div key={i}>{ex.name}</div>
                          ))}
                        {exerciseCount > 3 && (
                          <div className="text-blue-400 font-semibold">See {exerciseCount - 3} more exercises</div>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Body Weight Setting */}
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-xl p-6 animate-chart-fade-in">
          <h2 className="text-sm font-black text-slate-300 uppercase tracking-widest mb-4">Body Weight</h2>
          <div className="flex gap-3">
            <input
              type="number"
              placeholder="Enter your weight in kg"
              value={userWeight ?? ''}
              onChange={(e) => onUserWeightChange && onUserWeightChange(Number(e.target.value) || null)}
              className="flex-1 bg-slate-800/50 border border-slate-600/50 rounded-lg px-4 py-3 text-white font-semibold focus:border-blue-500 focus:outline-none transition placeholder:text-slate-600"
            />
            <span className="flex items-center px-4 text-slate-400 font-bold">kg</span>
          </div>
        </div>

        {/* Measures Modal */}
        {isViewingMeasures && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-gradient-to-br from-slate-900 to-slate-800/95 border border-slate-700/50 rounded-2xl p-6 shadow-2xl animate-chart-fade-in">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-black text-white">Body Measurements</h2>
                <button
                  onClick={() => setIsViewingMeasures(false)}
                  className="text-slate-400 hover:text-slate-200 transition text-2xl font-light w-8 h-8 flex items-center justify-center"
                >
                  ×
                </button>
              </div>

              <div className="space-y-3 mb-6 max-h-60 overflow-y-auto">
                {[
                  { key: 'chest', label: 'Chest', unit: 'cm' },
                  { key: 'waist', label: 'Waist', unit: 'cm' },
                  { key: 'hips', label: 'Hips', unit: 'cm' },
                  { key: 'biceps', label: 'Biceps', unit: 'cm' },
                  { key: 'thigh', label: 'Thigh', unit: 'cm' },
                  { key: 'calf', label: 'Calf', unit: 'cm' }
                ].map(measure => (
                  <div key={measure.key} className="flex items-end gap-3">
                    <div className="flex-1">
                      <label className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1.5">{measure.label}</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={measurements[measure.key]}
                        onChange={(e) => setMeasurements(prev => ({ ...prev, [measure.key]: e.target.value }))}
                        className="w-full bg-slate-800/50 border border-slate-600/50 rounded-lg px-3 py-2.5 text-white font-semibold focus:border-blue-500 focus:outline-none transition placeholder:text-slate-600 text-sm"
                        inputMode="decimal"
                      />
                    </div>
                    <span className="text-slate-500 font-bold text-sm pb-2.5">{measure.unit}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-700/50">
                <button
                  onClick={() => setIsViewingMeasures(false)}
                  className="flex-1 py-2.5 px-4 bg-slate-700/50 hover:bg-slate-700 text-white font-bold rounded-lg transition text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setIsViewingMeasures(false)}
                  className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition text-sm"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};