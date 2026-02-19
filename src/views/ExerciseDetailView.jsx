import React, { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, Trophy, Medal, LayoutGrid, List } from 'lucide-react';
import { UnifiedChart } from '../components/UnifiedChart';
import { VirtualList } from '../components/VirtualList';
import { getExerciseHistory, getExerciseRecords, getLastSet, getExerciseTrend, getChartContext } from '../domain/exercises';
import { formatLastSetDate } from '../domain/calculations';
import { detectPlateau } from '../analytics/plateau';

const ENABLE_PLATEAU_ALERT = true;
const ENABLE_ADVANCED_CHART_INTERACTIONS = true;

const ExerciseDetailViewInner = ({ exerciseId, workouts, exercisesDB, onBack, onOpenWorkout, userWeight }) => {
  const [activeTab, setActiveTab] = useState('history');
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [chartPeriod, setChartPeriod] = useState('3months');
  const [isCompact, setIsCompact] = useState(() => {
    try { return JSON.parse(localStorage.getItem('exerciseDetailCompactView') || 'false'); } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem('exerciseDetailCompactView', JSON.stringify(isCompact)); } catch (_) {}
  }, [isCompact]);

  const exerciseDef = exercisesDB.find(e => e.id === exerciseId);
  const history = useMemo(() => getExerciseHistory(exerciseId, workouts), [exerciseId, workouts]);
  const records = useMemo(() => getExerciseRecords(exerciseId, workouts), [exerciseId, workouts]);
  const plateau = useMemo(() => detectPlateau(exerciseId, workouts), [exerciseId, workouts]);

  if (!exerciseDef) return null;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-b from-black to-black/80 border-b border-white/10 p-4 sticky top-0 z-20 shadow-2xl">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg transition shrink-0">
              <ChevronLeft size={20} />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className={isCompact ? 'text-lg font-black leading-tight' : 'text-2xl font-black leading-tight'}>{exerciseDef.name}</h1>
              <p className="text-xs text-slate-400 mt-1 font-semibold">
                {exerciseDef.category} • {exerciseDef.muscles?.join(', ') || 'General'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsCompact(!isCompact)}
            className="p-2 hover:bg-white/10 rounded-lg transition text-slate-400 hover:text-white shrink-0"
            title={isCompact ? 'Normal view' : 'Compact view (screenshot)'}
          >
            {isCompact ? <List size={20} /> : <LayoutGrid size={20} />}
          </button>
        </div>

        {/* Tabs */}
        <div className={`flex gap-1 bg-slate-800/50 p-1 rounded-lg border border-slate-700/50 ${isCompact ? 'mb-0' : ''}`}>
          {['History', 'Charts', 'Records'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab.toLowerCase())}
              className={`flex-1 py-2 px-3 text-xs font-bold rounded transition-all ${
                activeTab === tab.toLowerCase()
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/50'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Summary Section */}
      {(() => {
        const lastSet = getLastSet(exerciseId, workouts);
        const trend = getExerciseTrend(exerciseId, workouts);
        
        if (!lastSet) return null;
        
        return (
          <div className={isCompact ? 'px-3 py-2 border-b border-slate-700/30' : 'px-4 py-4 bg-gradient-to-b from-slate-900/40 to-black/20 border-b border-slate-700/30'}>
            <div className={isCompact ? 'grid grid-cols-4 gap-2' : 'grid grid-cols-2 sm:grid-cols-4 gap-3'}>
              {/* Last */}
              <div className={isCompact ? 'bg-slate-800/50 border border-slate-700/50 rounded p-2 text-center' : 'bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 text-center'}>
                <p className="text-xs text-slate-400 font-semibold mb-1">LAST</p>
                <p className={isCompact ? 'text-sm font-black text-white' : 'text-lg font-black text-white'}>{lastSet.kg}×{lastSet.reps}</p>
              </div>
              {/* Best 1RM */}
              <div className={isCompact ? 'bg-slate-800/50 border border-slate-700/50 rounded p-2 text-center' : 'bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 text-center'}>
                <p className="text-xs text-slate-400 font-semibold mb-1">BEST (1RM)</p>
                <p className={isCompact ? 'text-sm font-black text-white' : 'text-lg font-black text-white'}>{records.best1RM ?? '—'}</p>
              </div>
              {/* Max Weight */}
              <div className={isCompact ? 'bg-slate-800/50 border border-slate-700/50 rounded p-2 text-center' : 'bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 text-center'}>
                <p className="text-xs text-slate-400 font-semibold mb-1">MAX</p>
                <p className={isCompact ? 'text-sm font-black text-blue-400' : 'text-lg font-black text-blue-400'}>{records.heaviestWeight ?? '—'}<span className="text-slate-500">kg</span></p>
              </div>
              {/* Trend */}
              <div className={isCompact ? 'bg-slate-800/50 border border-slate-700/50 rounded p-2 text-center' : 'bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 text-center'}>
                <p className="text-xs text-slate-400 font-semibold mb-1">TREND</p>
                <p className={`${isCompact ? 'text-lg' : 'text-2xl'} font-black ${
                  trend === '↑' ? 'text-green-400' : 
                  trend === '↓' ? 'text-red-400' : 
                  'text-slate-300'
                }`}>{trend}</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Week Detail Modal */}
      {selectedWeek && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-start justify-center p-4 pt-20">
          <div className="w-full max-w-xl bg-gradient-to-br from-slate-900/95 to-black/95 border border-slate-700/50 rounded-2xl p-5 shadow-2xl max-h-[80vh] overflow-y-auto ui-modal-scale ui-fade-scale-anim">
            <div className="flex justify-between items-center mb-5 pb-4 border-b border-slate-700/50">
              <h3 className="text-2xl font-black">Week {selectedWeek.date}</h3>
              <button onClick={() => setSelectedWeek(null)} className="p-2 hover:bg-white/10 rounded-lg transition text-slate-400">
                <span className="text-xl">×</span>
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {/* Day-by-day breakdown */}
              {(() => {
                const days = [];
                const start = new Date(selectedWeek.startISO);
                for (let i = 0; i < 7; i++) {
                  const d = new Date(start);
                  d.setDate(start.getDate() + i);
                  const iso = d.toISOString().substring(0,10);
                  const dayWorkouts = workouts.filter(w => w.date === iso);
                  let vol = 0;
                  let mins = 0;
                  dayWorkouts.forEach(w => {
                    (w.exercises||[]).forEach(ex => {
                      const exEntry = ex;
                      const setsVol = (exEntry.sets||[]).filter(s=>s.completed).reduce((s2,s)=>s2+(s.kg*s.reps),0);
                      vol += setsVol;
                    });
                    mins += (w.duration||0);
                  });

                  days.push({ iso, label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }), vol, mins, workouts: dayWorkouts });
                }

                const maxVol = Math.max(...days.map(d=>d.vol), 1);
                return days.map((day, idx) => (
                  <div key={idx} className="bg-slate-800/40 border border-slate-700/50 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">{day.label}</span>
                      <div className="text-right">
                        <div className="text-sm font-bold text-blue-400">{day.vol.toLocaleString()} kg</div>
                        <div className="text-xs text-slate-400">{day.mins} min</div>
                      </div>
                    </div>
                    <div className="w-full h-2 bg-slate-900/50 rounded-full overflow-hidden border border-slate-700/50">
                      <div
                        style={{ width: `${(day.vol/maxVol)*100}%` }}
                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full"
                      />
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {ENABLE_PLATEAU_ALERT && plateau?.isPlateau && (
        <div className="px-4 py-3 border-b border-amber-500/20 bg-amber-500/10">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-black tracking-wider text-amber-300 uppercase">
              Plateau Risk ({plateau.confidence})
            </p>
            <span className="text-[11px] font-semibold text-amber-200">
              {plateau.lastImprovementSessionsAgo} sessions without improvement
            </span>
          </div>
          <p className="text-xs text-amber-100/90 mt-1">
            Stagnation: {plateau.stagnationType} • exposures checked: {plateau.exposuresChecked}
          </p>
        </div>
      )}

      {/* Content */}
      <div className={isCompact ? 'p-2 grow overflow-y-auto pb-24' : 'p-4 grow overflow-y-auto pb-24'}>
        {activeTab === 'history' && (
          <div className={isCompact ? 'space-y-2' : 'space-y-5'}>
            {history.length === 0 ? (
              <div className="text-center text-slate-500 mt-10 py-6">
                <p className="text-sm font-semibold">No history yet</p>
              </div>
            ) : history.length > 100 ? (
              // OPTIMIZED: Use virtual list for large histories (100+ items)
              <VirtualList
                items={history}
                itemHeight={200}
                overscan={5}
                renderItem={(item, index) => {
                  const i = index;
                  const prevItem = history[i - 1];
                  const currentMonth = item.date.substring(0, 7);
                  const prevMonth = prevItem?.date.substring(0, 7);
                  const showMonth = currentMonth !== prevMonth;
                  
                  return (
                    <div key={`${item.date}-item`}>
                      {showMonth && (
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest sticky top-0 bg-black/50 py-3 mt-4 first:mt-0">
                          {new Date(item.date).toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                        </h3>
                      )}
                      <div className={isCompact ? 'bg-slate-800/50 border border-slate-700/50 rounded p-2 hover:border-slate-600/50 transition-all' : 'bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-lg p-4 hover:border-slate-600/50 transition-all'}>
                        <div className={`flex justify-between items-baseline ${isCompact ? 'mb-1' : 'mb-3'}`}>
                          <span className={isCompact ? 'text-xs font-black text-blue-400' : 'font-black text-blue-400'}>
                            {new Date(item.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', weekday: 'short' })}
                          </span>
                          <span className="text-xs text-slate-400 font-bold">1RM <span className="text-blue-300">{item.max1RM} kg</span></span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {item.sets.map((set, idx) => (
                            <button
                              key={`${item.date}-${set.kg}-${set.reps}-${idx}`}
                              onClick={() => onOpenWorkout && onOpenWorkout(item.date)}
                              className={`${isCompact ? 'px-2 py-1 rounded text-xs' : 'px-3 py-2 rounded-lg text-xs'} border transition flex items-center gap-1.5 ${
                                (set.isBest1RM || set.isBestSetVolume || set.isHeaviestWeight)
                                  ? 'bg-yellow-500/20 border-yellow-500/40 hover:bg-yellow-500/30'
                                  : 'bg-slate-800/60 hover:bg-slate-700/60 border-slate-700/50 hover:border-slate-600/50'
                              }`}
                              title={
                                (set.isBest1RM || set.isBestSetVolume || set.isHeaviestWeight)
                                  ? [
                                      set.isHeaviestWeight && 'Heaviest Weight',
                                      set.isBestSetVolume && 'Best Set Volume',
                                      set.isBest1RM && 'Best 1RM'
                                    ].filter(Boolean).join(', ')
                                  : ''
                              }
                            >
                              {(set.isBest1RM || set.isBestSetVolume || set.isHeaviestWeight) && (
                                <Medal size={12} className="text-yellow-400" />
                              )}
                              <span className="font-black text-white">{set.kg}</span>
                              <span className="text-slate-500">×</span>
                              <span className="text-slate-300">{set.reps}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
            ) : (
              history.map((item, i) => {
                const prevItem = history[i - 1];
                const currentMonth = item.date.substring(0, 7);
                const prevMonth = prevItem?.date.substring(0, 7);
                const showMonth = currentMonth !== prevMonth;

                return (
                  <React.Fragment key={`${exerciseId}-${item.date}`}>
                    {showMonth && (
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest sticky top-0 bg-black/50 py-3 mt-4 first:mt-0">
                        {new Date(item.date).toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                      </h3>
                    )}
                    <div className={isCompact ? 'bg-slate-800/50 border border-slate-700/50 rounded p-2 hover:border-slate-600/50 transition-all' : 'bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-lg p-4 hover:border-slate-600/50 transition-all'}>
                      <div className={`flex justify-between items-baseline ${isCompact ? 'mb-1' : 'mb-3'}`}>
                        <span className={isCompact ? 'text-xs font-black text-blue-400' : 'font-black text-blue-400'}>
                          {new Date(item.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', weekday: 'short' })}
                        </span>
                        <span className="text-xs text-slate-400 font-bold">1RM <span className="text-blue-300">{item.max1RM} kg</span></span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {item.sets.map((set, idx) => (
                          <button
                            key={`${item.date}-${set.kg}-${set.reps}-${idx}`}
                            onClick={() => onOpenWorkout && onOpenWorkout(item.date)}
                            className={`${isCompact ? 'px-2 py-1 rounded text-xs' : 'px-3 py-2 rounded-lg text-xs'} border transition flex items-center gap-1.5 ${
                              (set.isBest1RM || set.isBestSetVolume || set.isHeaviestWeight)
                                ? 'bg-yellow-500/20 border-yellow-500/40 hover:bg-yellow-500/30'
                                : 'bg-slate-800/60 hover:bg-slate-700/60 border-slate-700/50 hover:border-slate-600/50'
                            }`}
                            title={
                              (set.isBest1RM || set.isBestSetVolume || set.isHeaviestWeight)
                                ? [
                                    set.isHeaviestWeight && 'Heaviest Weight',
                                    set.isBestSetVolume && 'Best Set Volume',
                                    set.isBest1RM && 'Best 1RM'
                                  ].filter(Boolean).join(', ')
                                : ''
                            }
                          >
                            {(set.isBest1RM || set.isBestSetVolume || set.isHeaviestWeight) && (
                              <Medal size={12} className="text-yellow-400" />
                            )}
                            <span className="font-black text-white">{set.kg}</span>
                            <span className="text-slate-500">×</span>
                            <span className="text-slate-300">{set.reps}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </React.Fragment>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'charts' && (
          <div className="space-y-5 mt-2">
            {/* Time Period Selector */}
            <div className="flex gap-2 px-4">
              {['7days', '30days', '3months', '1year'].map(period => (
                <button
                  key={period}
                  onClick={() => setChartPeriod(period)}
                  className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all ${
                    chartPeriod === period
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                      : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'
                  }`}
                >
                  {period === '7days' ? 'Last 7d' : period === '30days' ? 'Last 30d' : period === '3months' ? 'Last 3m' : 'Last Year'}
                </button>
              ))}
            </div>

            {/* 1RM Chart */}
            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-xl p-4">
              <div className="mb-4">
                <h3 className="text-xs text-slate-400 font-black uppercase tracking-widest mb-1">Estimated 1RM Progress</h3>
                <p className="text-xs text-blue-400 font-semibold">{getChartContext(exerciseId, workouts)}</p>
              </div>
              <UnifiedChart
                workouts={workouts}
                exerciseId={exerciseId}
                metric="weight"
                timePeriod={chartPeriod}
                color="#3b82f6"
                unit="kg"
                userWeight={userWeight}
                exercisesDB={exercisesDB}
                enableAdvancedInteractions={ENABLE_ADVANCED_CHART_INTERACTIONS}
              />
            </div>

            {/* Volume Chart */}
            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-xl p-4">
              <h3 className="text-xs text-slate-400 font-black uppercase tracking-widest mb-4">Total Volume</h3>
              <UnifiedChart
                workouts={workouts}
                exerciseId={exerciseId}
                metric="volume"
                timePeriod={chartPeriod}
                color="#10b981"
                unit="kg"
                userWeight={userWeight}
                exercisesDB={exercisesDB}
                enableAdvancedInteractions={ENABLE_ADVANCED_CHART_INTERACTIONS}
              />
            </div>
          </div>
        )}

        {activeTab === 'records' && (
          <div className={isCompact ? 'grid grid-cols-2 gap-2 mt-2' : 'grid grid-cols-2 gap-4 mt-4'}>
            {/* Best 1RM */}
            <div className={`col-span-2 bg-gradient-to-br from-amber-600/20 to-amber-700/10 border border-amber-500/30 rounded-xl flex flex-col items-center justify-center text-center ${isCompact ? 'p-3' : 'p-6'}`}>
              <Trophy className="text-amber-400 mb-3" size={isCompact ? 24 : 36} />
              <div className={isCompact ? 'text-2xl font-black text-white mb-1' : 'text-4xl font-black text-white mb-1'}>
                {records.best1RM} <span className="text-lg font-normal text-slate-400">kg</span>
              </div>
              <div className="text-xs text-amber-400 font-black uppercase tracking-wider">All-Time Best 1RM</div>
              {records.best1RMDate && (
                <div className="text-xs text-slate-500 mt-3 font-semibold">Set {formatLastSetDate(records.best1RMDate)}</div>
              )}
            </div>

            {/* Max Weight (heaviest single weight lifted) */}
            <div className={isCompact ? 'bg-gradient-to-br from-blue-600/20 to-blue-700/10 border border-blue-500/30 rounded-lg p-3 text-center' : 'bg-gradient-to-br from-blue-600/20 to-blue-700/10 border border-blue-500/30 rounded-lg p-4 text-center'}>
              <div className="text-xs text-slate-400 uppercase font-black tracking-wider mb-2">Max Weight</div>
              <div className={isCompact ? 'text-xl font-black text-blue-400' : 'text-3xl font-black text-blue-400'}>
                {records.heaviestWeight ?? '—'} <span className="text-sm font-normal text-slate-500">kg</span>
              </div>
              {records.heaviestWeightDate && (
                <div className="text-xs text-slate-500 mt-2 font-semibold">{formatLastSetDate(records.heaviestWeightDate)}</div>
              )}
            </div>

            {/* Max Reps */}
            <div className={isCompact ? 'bg-gradient-to-br from-purple-600/20 to-purple-700/10 border border-purple-500/30 rounded-lg p-3 text-center' : 'bg-gradient-to-br from-purple-600/20 to-purple-700/10 border border-purple-500/30 rounded-lg p-4 text-center'}>
              <div className="text-xs text-slate-400 uppercase font-black tracking-wider mb-2">Max Reps</div>
              <div className={isCompact ? 'text-xl font-black text-purple-400' : 'text-3xl font-black text-purple-400'}>
                {records.maxReps} <span className="text-sm font-normal text-slate-500">reps</span>
              </div>
              {records.maxRepsDate && (
                <div className="text-xs text-slate-500 mt-2 font-semibold">{formatLastSetDate(records.maxRepsDate)}</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const ExerciseDetailView = React.memo(ExerciseDetailViewInner);
