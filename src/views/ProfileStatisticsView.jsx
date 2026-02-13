import React, { useState, useMemo } from 'react';
import { ChevronLeft } from 'lucide-react';
import { RadarChart } from '../components/RadarChart';
import { UnifiedChart } from '../components/UnifiedChart';
import { calculateTotalVolume } from '../domain/calculations';
import { getChartData } from '../domain/profileCharts';

export const ProfileStatisticsView = ({ workouts = [], exercisesDB = [], userWeight, onBack }) => {
  const [timePeriod, setTimePeriod] = useState('3months'); // '7days' | '30days' | '3months' | '1year'

  // Helper to get start date from time period
  const getStartDate = (period) => {
    const now = new Date();
    switch (period) {
      case '7days':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30days':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case '3months':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      case '1year':
        return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    }
  };

  // Calculate muscle distribution for radar chart
  const radarData = useMemo(() => {
    const startDate = getStartDate(timePeriod);
    const now = new Date();

    const groups = {};
    const muscleGroups = ['Chest', 'Back', 'Legs', 'Shoulders', 'Biceps', 'Triceps', 'Core'];

    workouts.forEach(w => {
      const workoutDate = new Date(w.date);
      if (workoutDate < startDate || workoutDate > now) return;

      (w.exercises || []).forEach(ex => {
        const exDef = exercisesDB.find(e => e.id === ex.exerciseId) || {};
        const muscles = exDef.muscles || [];
        
        const completed = (ex.sets || []).filter(s => s.completed);
        if (completed.length === 0) return;

        completed.forEach(s => {
          const baseKg = Number(s.kg) || 0;
          const kg = baseKg + ((exDef.usesBodyweight && userWeight) ? Number(userWeight) : 0);
          const reps = Number(s.reps) || 0;
          const volume = kg * reps;

          if (muscles.length > 0) {
            muscles.forEach(m => {
              const normalized = normalizeMuscleName(m);
              if (!groups[normalized]) groups[normalized] = 0;
              groups[normalized] += volume;
            });
          }
        });
      });
    });

    const normalized = {};
    const maxVal = Math.max(...muscleGroups.map(g => groups[g] || 0), 1);

    muscleGroups.forEach(g => {
      normalized[g] = (groups[g] || 0) / maxVal;
    });

    return normalized;
  }, [workouts, exercisesDB, userWeight, timePeriod]);

  // Calculate detailed statistics
  const stats = useMemo(() => {
    const startDate = getStartDate(timePeriod);
    const now = new Date();

    let totalVolume = 0;
    let totalSessions = 0;
    let totalReps = 0;
    let totalDuration = 0;
    const muscleBreakdown = {};

    workouts.forEach(w => {
      const workoutDate = new Date(w.date);
      if (workoutDate < startDate || workoutDate > now) return;

      let sessionVolume = 0;
      (w.exercises || []).forEach(ex => {
        const exDef = exercisesDB.find(e => e.id === ex.exerciseId) || {};
        const completed = (ex.sets || []).filter(s => s.completed);

        completed.forEach(s => {
          const baseKg = Number(s.kg) || 0;
          const kg = baseKg + ((exDef.usesBodyweight && userWeight) ? Number(userWeight) : 0);
          const reps = Number(s.reps) || 0;
          const volume = kg * reps;

          totalVolume += volume;
          totalReps += reps;
          sessionVolume += volume;

          const muscles = exDef.muscles || [];
          if (muscles.length > 0) {
            muscles.forEach(m => {
              const normalized = normalizeMuscleName(m);
              if (!muscleBreakdown[normalized]) muscleBreakdown[normalized] = 0;
              muscleBreakdown[normalized] += volume;
            });
          }
        });
      });

      if (sessionVolume > 0) {
        totalSessions++;
        totalDuration += w.duration || 0;
      }
    });

    return {
      totalVolume: Math.round(totalVolume),
      totalSessions,
      totalReps,
      totalDuration,
      avgSessionVolume: totalSessions > 0 ? Math.round(totalVolume / totalSessions) : 0,
      muscleBreakdown
    };
  }, [workouts, exercisesDB, userWeight, timePeriod]);

  return (
    <div className="min-h-screen bg-black text-white pb-40">
      {/* Header */}
      <div className="bg-gradient-to-b from-black to-black/80 border-b border-white/10 p-4 sticky top-0 z-20 shadow-2xl">
        <div className="flex items-center gap-4 mb-2">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg transition">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-3xl font-black">STATISTICS</h1>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Time Period Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setTimePeriod('7days')}
            className={`flex-1 py-2 px-4 rounded-lg font-bold text-xs uppercase transition-all ${
              timePeriod === '7days'
                ? 'bg-gradient-accent text-white shadow-lg accent-shadow'
                : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'
            }`}
          >
            Last 7 days
          </button>
          <button
            onClick={() => setTimePeriod('30days')}
            className={`flex-1 py-2 px-4 rounded-lg font-bold text-xs uppercase transition-all ${
              timePeriod === '30days'
                ? 'bg-gradient-accent text-white shadow-lg accent-shadow'
                : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'
            }`}
          >
            Last 30 days
          </button>
          <button
            onClick={() => setTimePeriod('3months')}
            className={`flex-1 py-2 px-4 rounded-lg font-bold text-xs uppercase transition-all ${
              timePeriod === '3months'
                ? 'bg-gradient-accent text-white shadow-lg accent-shadow'
                : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'
            }`}
          >
            Last 3 months
          </button>
          <button
            onClick={() => setTimePeriod('1year')}
            className={`flex-1 py-2 px-4 rounded-lg font-bold text-xs uppercase transition-all ${
              timePeriod === '1year'
                ? 'bg-gradient-accent text-white shadow-lg accent-shadow'
                : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'
            }`}
          >
            Last year
          </button>
        </div>

        {/* Radar Chart */}
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-xl p-6">
          <h2 className="text-sm font-black text-slate-300 uppercase tracking-widest mb-6">Muscle Distribution</h2>
          <div className="flex justify-center">
            <RadarChart data={radarData} />
          </div>
        </div>

        {/* Key Statistics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-gradient-to-br from-blue-600/20 to-blue-700/10 border border-blue-500/30 rounded-xl p-3 sm:p-4">
            <p className="text-xs text-slate-400 font-semibold tracking-widest mb-2">TOTAL VOLUME</p>
            <p className="text-2xl sm:text-3xl font-black text-blue-400">{(stats.totalVolume / 1000).toFixed(1)}k</p>
            <p className="text-xs text-slate-500 mt-1">kg</p>
          </div>

          <div className="bg-gradient-to-br from-emerald-600/20 to-emerald-700/10 border border-emerald-500/30 rounded-xl p-3 sm:p-4 flex flex-col items-center justify-center text-center">
            <p className="text-xs text-slate-400 font-semibold tracking-widest mb-2 whitespace-nowrap">WORKOUTS</p>
            <p className="text-2xl sm:text-3xl font-black text-emerald-400">{stats.totalSessions}</p>
            <p className="text-xs text-slate-500 mt-1">sessions</p>
          </div>

          <div className="bg-gradient-to-br from-purple-600/20 to-purple-700/10 border border-purple-500/30 rounded-xl p-3 sm:p-4">
            <p className="text-xs text-slate-400 font-semibold tracking-widest mb-2">TOTAL REPS</p>
            <p className="text-2xl sm:text-3xl font-black text-purple-400">{stats.totalReps.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-1">reps</p>
          </div>

          <div className="bg-gradient-to-br from-amber-600/20 to-amber-700/10 border border-amber-500/30 rounded-xl p-3 sm:p-4">
            <p className="text-xs text-slate-400 font-semibold tracking-widest mb-2">DURATION</p>
            <p className="text-2xl sm:text-3xl font-black text-amber-400">{stats.totalDuration}</p>
            <p className="text-xs text-slate-500 mt-1">min</p>
          </div>

          <div className="bg-gradient-to-br from-cyan-600/20 to-cyan-700/10 border border-cyan-500/30 rounded-xl p-3 sm:p-4">
            <p className="text-xs text-slate-400 font-semibold tracking-widest mb-2">AVG VOLUME</p>
            <p className="text-2xl sm:text-3xl font-black text-cyan-400">{(stats.avgSessionVolume / 1000).toFixed(1)}k</p>
            <p className="text-xs text-slate-500 mt-1">kg</p>
          </div>
        </div>

        {/* Overall 1RM Trend Chart */}
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-xl p-4">
          <h2 className="text-sm font-black text-slate-300 uppercase tracking-widest mb-4">Overall 1RM Trend</h2>
          <UnifiedChart
            workouts={workouts}
            exerciseId={null}
            metric="weight"
            timePeriod={timePeriod}
            color="#3b82f6"
            unit="kg"
            userWeight={userWeight}
            exercisesDB={exercisesDB}
          />
        </div>

        {/* Muscle Group Breakdown */}
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-xl p-6">
          <h2 className="text-sm font-black text-slate-300 uppercase tracking-widest mb-4">VOLUME BY MUSCLE</h2>
          <div className="space-y-3">
            {Object.entries(stats.muscleBreakdown)
              .sort(([, a], [, b]) => b - a)
              .map(([muscle, volume]) => {
                const maxVol = Math.max(...Object.values(stats.muscleBreakdown));
                const percentage = maxVol > 0 ? (volume / maxVol) * 100 : 0;
                return (
                  <div key={muscle}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-bold text-white">{muscle}</span>
                      <span className="text-xs font-semibold text-slate-400">{(volume / 1000).toFixed(1)}k</span>
                    </div>
                    <div className="w-full h-2 bg-slate-800/50 rounded-full overflow-hidden border border-slate-700/50">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper to normalize muscle names to standard categories
function normalizeMuscleName(muscle) {
  if (!muscle) return 'Other';
  const s = muscle.toLowerCase();
  if (s.includes('chest') || s.includes('pec')) return 'Chest';
  if (s.includes('back') || s.includes('lat')) return 'Back';
  if (s.includes('leg') || s.includes('quad') || s.includes('ham')) return 'Legs';
  if (s.includes('shoulder') || s.includes('delt')) return 'Shoulders';
  if (s.includes('bicep')) return 'Biceps';
  if (s.includes('tricep') || s.includes('trice')) return 'Triceps';
  if (s.includes('core') || s.includes('abs')) return 'Core';
  return muscle;
}
