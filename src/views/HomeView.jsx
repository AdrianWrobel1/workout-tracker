import React from 'react';
import { Plus, Edit2, Calendar, Check } from 'lucide-react';
import { getWeekWorkouts, getMonthWorkouts, getMonthLabel } from '../domain/workouts';
import { formatDate } from '../domain/calculations';

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

  return (
    <div className="min-h-screen bg-zinc-900 text-white pb-24">
      <div className="bg-gradient-to-br from-teal-900 to-zinc-900 rounded-b-3xl p-6 mb-6 shadow-2xl border-b border-zinc-800">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16">
              <svg className="w-16 h-16 -rotate-90">
                <circle cx="32" cy="32" r="28" stroke="#3f3f46" strokeWidth="4" fill="none" />
                <circle
                  cx="32" cy="32" r="28" stroke="#2dd4bf" strokeWidth="4" fill="none"
                  strokeDasharray={`${Math.min((weekWorkouts.length / weeklyGoal) * 176, 176)} 176`}
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-sm font-bold">
                {weekWorkouts.length}/{weeklyGoal}
              </div>
            </div>
            <div>
              <div className="text-xs text-teal-200 mb-1 font-bold tracking-wider">WEEKLY GOAL</div>
              <div className="text-lg font-semibold">Keep pushing!</div>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={onOpenCalendar}
        className="mx-4 mb-4 w-[calc(100%-2rem)] bg-zinc-800/70 hover:bg-zinc-800 border border-zinc-700 rounded-2xl p-4 flex justify-between items-center transition"
      >
        <div>
          <div className="text-xs uppercase tracking-widest text-zinc-400 mb-1">This week</div>
          <div className="text-sm text-zinc-300">Tap to open calendar</div>
        </div>
        <Calendar size={22} className="text-zinc-400" />
      </button>

      <div className="px-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onStartWorkout}
            className="bg-rose-500 hover:bg-rose-600 text-white rounded-2xl p-4 flex flex-col items-center justify-center gap-2 font-semibold shadow-lg shadow-rose-900/30 transition active:scale-95"
          >
            <Plus size={28} />
            <span>New Workout</span>
          </button>
          <button
            onClick={onManageTemplates}
            className="bg-zinc-800 hover:bg-zinc-700 text-white rounded-2xl p-4 flex flex-col items-center justify-center gap-2 font-semibold transition active:scale-95 border border-zinc-700"
          >
            <Edit2 size={24} className="text-zinc-400" />
            <span>Templates</span>
          </button>
        </div>

        <div className="bg-zinc-800/50 rounded-2xl p-4 border border-zinc-800">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-zinc-400 text-sm font-bold tracking-wide">RECENT ACTIVITY</h2>
            <button onClick={onViewHistory} className="text-xs text-rose-400">View All</button>
          </div>
          <div className="space-y-3">
            {workouts.slice(0, 3).map(workout => (
              <div
                key={workout.id}
                onClick={() => onViewWorkoutDetail(workout.date)}
                className="flex justify-between items-center bg-zinc-800 p-3 rounded-xl cursor-pointer hover:bg-zinc-700 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-500">
                    <Check size={18} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{workout.name}</h3>
                    <p className="text-xs text-zinc-500">{formatDate(workout.date)}</p>
                  </div>
                </div>
                <span className="text-xs font-mono text-zinc-400">{workout.duration}m</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-4 mt-6 mb-4">
        <h2 className="text-sm text-zinc-400 font-bold tracking-wide mb-3">MONTHLY PROGRESS</h2>
        <div className="grid grid-cols-3 gap-3">
          <button onClick={() => onOpenMonthlyProgress(-1)} className="bg-zinc-800/40 hover:bg-zinc-800/60 border border-zinc-700 rounded-xl p-3 text-center opacity-60 hover:opacity-100 transition">
            <div className="text-xl mb-1">📅</div>
            <div className="text-xs text-zinc-400">{getMonthLabel(-1)}</div>
            <div className="text-sm font-bold text-zinc-300 mt-1">{getMonthWorkoutsCount(-1)} workouts</div>
          </button>
          <button onClick={() => onOpenMonthlyProgress(0)} className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 rounded-xl p-3 text-center transition">
            <div className="text-xl mb-1">🏋️</div>
            <div className="text-xs text-zinc-400">{getMonthLabel(0)}</div>
            <div className="text-sm font-bold text-white mt-1">{getMonthWorkoutsCount(0)} workouts</div>
          </button>
          <button onClick={() => onOpenMonthlyProgress(1)} className="bg-zinc-800/40 hover:bg-zinc-800/60 border border-zinc-700 rounded-xl p-3 text-center opacity-60 hover:opacity-100 transition">
            <div className="text-xl mb-1">☀️</div>
            <div className="text-xs text-zinc-400">{getMonthLabel(1)}</div>
            <div className="text-sm font-bold text-zinc-300 mt-1">{getMonthWorkoutsCount(1)} workouts</div>
          </button>
        </div>
      </div>
    </div>
  );
};