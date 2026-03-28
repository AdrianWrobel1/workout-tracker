import React, { useMemo } from 'react';
import { calculateMasteryLevel, calculateMomentum, extractKeyMetrics } from '../domain/workouts';
import { ChevronRight } from 'lucide-react';

export default function DynamicDashboard({ workouts, exercisesDB = [] }) {
  const data = useMemo(() => {
    const mastery = calculateMasteryLevel(workouts || []);
    const momentum = calculateMomentum(workouts || []);
    const lastWorkout = workouts && workouts.length > 0 ? workouts[workouts.length - 1] : null;
    const metrics = lastWorkout ? extractKeyMetrics(lastWorkout, workouts || [], exercisesDB) : null;

    return { mastery, momentum, metrics, lastWorkout };
  }, [workouts, exercisesDB]);

  if (!data.lastWorkout) {
    return (
      <div className="p-4 bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg text-center">
        <p className="text-slate-400 text-sm">Start tracking workouts to unlock the Dashboard</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Momentum Banner */}
      <div className="p-5 bg-gradient-to-r from-amber-600/30 to-orange-600/30 rounded-lg border border-orange-500/50">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">
            {data.momentum.motivationTier === 'legendary' ? '🔥'
              : data.momentum.motivationTier === 'unstoppable' ? '💪'
              : data.momentum.motivationTier === 'rolling' ? '🚀'
              : data.momentum.motivationTier === 'building' ? '📈'
              : '🌱'}
          </span>
          <div className="flex-1">
            <p className="font-black text-lg capitalize">{data.momentum.motivationTier.replace(/_/g, ' ')}</p>
            <p className="text-xs text-orange-200 font-semibold">{data.momentum.currentStreak}-Session Streak</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-orange-300">{data.momentum.momentumScore}</p>
            <p className="text-xs text-orange-200">Momentum</p>
          </div>
        </div>
        <div className="w-full bg-black/40 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-amber-400 to-orange-500 h-2 rounded-full transition-all"
            style={{ width: `${Math.min(data.momentum.momentumScore, 100)}%` }}
          />
        </div>
      </div>

      {/* Mastery Level */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 bg-gradient-to-br from-purple-600/30 to-blue-600/30 rounded-lg border border-blue-500/50">
          <p className="text-xs text-blue-200 font-semibold mb-2">MASTERY LEVEL</p>
          <p className="text-3xl font-black mb-2">{data.mastery.level}</p>
          <p className="text-sm font-bold text-blue-100">{data.mastery.title}</p>
          <p className="text-xs text-blue-300 mt-2">{data.mastery.points} pts</p>
          <div className="w-full bg-black/40 rounded-full h-1.5 mt-2">
            <div
              className="bg-gradient-to-r from-blue-400 to-purple-500 h-1.5 rounded-full transition-all"
              style={{ width: `${data.mastery.progress}%` }}
            />
          </div>
          <p className="text-xs text-blue-300 mt-1">{data.mastery.nextMilestone}</p>
        </div>

        <div className="p-4 bg-gradient-to-br from-emerald-600/30 to-teal-600/30 rounded-lg border border-teal-500/50">
          <p className="text-xs text-teal-200 font-semibold mb-2">THIS WEEK</p>
          <p className="text-3xl font-black mb-1">
            {workouts
              ? workouts.filter((w) => {
                  const weekAgo = new Date();
                  weekAgo.setDate(weekAgo.getDate() - 7);
                  return new Date(w.date) >= weekAgo;
                }).length
              : 0}
          </p>
          <p className="text-sm font-bold text-teal-100">Workouts</p>
          <p className="text-xs text-teal-300 mt-3">
            {workouts
              ? (workouts.filter((w) => {
                  const weekAgo = new Date();
                  weekAgo.setDate(weekAgo.getDate() - 7);
                  return new Date(w.date) >= weekAgo;
                }).length >= 3
                  ? '✓ On track'
                  : '↑ Push for 3')
              : 'No data yet'}
          </p>
        </div>
      </div>

      {/* Key Metrics */}
      {data.metrics && (
        <div className="p-4 bg-slate-800/40 rounded-lg border border-slate-700/50">
          <h4 className="font-bold text-sm mb-3">KEY METRICS</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-900/50 rounded">
              <p className="text-xs text-slate-400 font-semibold">RM PROGRESS</p>
              <p className="text-lg font-black text-white mt-1">{data.metrics.progressMetrics.topEstimated1RM} kg</p>
              <p
                className={`text-xs mt-1 ${
                  data.metrics.progressMetrics.rmTrend === 'up'
                    ? 'text-green-400'
                    : data.metrics.progressMetrics.rmTrend === 'down'
                    ? 'text-red-400'
                    : 'text-yellow-400'
                }`}
              >
                {data.metrics.progressMetrics.rmTrend === 'up' ? '↑' : data.metrics.progressMetrics.rmTrend === 'down' ? '↓' : '→'} vs{' '}
                {data.metrics.progressMetrics.previousMax1RM} kg
              </p>
            </div>
            <div className="p-3 bg-slate-900/50 rounded">
              <p className="text-xs text-slate-400 font-semibold">DENSITY</p>
              <p className="text-lg font-black text-white mt-1">{data.metrics.densityTrend.current}</p>
              <p className="text-xs text-slate-400 mt-1">vol/min {data.metrics.densityTrend.trend}</p>
            </div>
            <div className="p-3 bg-slate-900/50 rounded">
              <p className="text-xs text-slate-400 font-semibold">VOLUME TREND</p>
              <p className="text-lg font-black text-white mt-1">{data.metrics.volumeProgression.trend}</p>
              <p className="text-xs text-slate-400 mt-1">{data.metrics.volumeProgression.current.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-slate-900/50 rounded">
              <p className="text-xs text-slate-400 font-semibold">AVG REPS</p>
              <p className="text-lg font-black text-white mt-1">{data.metrics.tempoAnalysis.avgRepsPerSet}</p>
              <p className="text-xs text-slate-400 mt-1">per set</p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 bg-blue-900/30 rounded-lg text-center border border-blue-800/50">
          <p className="text-xs text-blue-300 font-semibold mb-1">All Time</p>
          <p className="text-2xl font-black text-blue-200">{workouts ? workouts.length : 0}</p>
          <p className="text-xs text-blue-400 mt-1">Workouts</p>
        </div>
        <div className="p-3 bg-green-900/30 rounded-lg text-center border border-green-800/50">
          <p className="text-xs text-green-300 font-semibold mb-1">Total Hours</p>
          <p className="text-2xl font-black text-green-200">
            {workouts
              ? Math.round(
                  workouts.reduce((sum, w) => sum + (Number(w.duration) || 0), 0) / 60
                )
              : 0}
          </p>
          <p className="text-xs text-green-400 mt-1">Training</p>
        </div>
        <div className="p-3 bg-purple-900/30 rounded-lg text-center border border-purple-800/50">
          <p className="text-xs text-purple-300 font-semibold mb-1">Consistency</p>
          <p className="text-2xl font-black text-purple-200">
            {workouts && workouts.length > 0
              ? Math.round((workouts && workouts.length >= 30 ? 30 : workouts.length) / 30 * 100)
              : 0}
            %
          </p>
          <p className="text-xs text-purple-400 mt-1">30 Day</p>
        </div>
      </div>

      {/* Action Callout */}
      <div className="p-4 bg-gradient-to-r from-cyan-600/20 to-blue-600/20 rounded-lg border border-blue-500/30">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-sm">Ready for next session?</p>
            <p className="text-xs text-slate-300 mt-1">
              {data.momentum.currentStreak >= 7
                ? '🔥 Keep the momentum rolling!'
                : data.momentum.currentStreak >= 3
                ? '💪 You\'re on a roll!'
                : '🎯 Start your streak today'}
            </p>
          </div>
          <ChevronRight size={20} className="text-blue-300" />
        </div>
      </div>
    </div>
  );
}
