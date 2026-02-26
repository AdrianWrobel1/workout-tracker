import React, { useState, useEffect } from 'react';
import { ChevronLeft, Clock, FileText, Medal, LayoutGrid, List } from 'lucide-react';
import { formatDate, calculate1RM } from '../domain/calculations';
import { resolveSetType } from '../domain/workoutExtensions';

const SET_TYPE_META = {
  warmup: {
    label: 'WARM-UP',
    short: 'WU',
    full: 'Warm-up',
    card: 'bg-amber-500/10 border-amber-500/30',
    chip: 'bg-amber-600/25 border-amber-500/45 text-amber-200',
    compactLabel: 'text-amber-300'
  },
  work: {
    label: 'WORK',
    short: 'WK',
    full: 'Work',
    card: 'bg-slate-900/40 border-slate-700/50',
    chip: 'bg-slate-700/35 border-slate-600/50 text-slate-200',
    compactLabel: 'text-slate-400'
  },
  drop: {
    label: 'DROP',
    short: 'DR',
    full: 'Drop',
    card: 'bg-violet-500/10 border-violet-500/30',
    chip: 'bg-violet-600/25 border-violet-500/45 text-violet-200',
    compactLabel: 'text-violet-300'
  },
  failure: {
    label: 'FAILURE',
    short: 'FL',
    full: 'Failure',
    card: 'bg-rose-500/10 border-rose-500/30',
    chip: 'bg-rose-600/25 border-rose-500/45 text-rose-200',
    compactLabel: 'text-rose-300'
  },
  tempo: {
    label: 'TEMPO',
    short: 'TP',
    full: 'Tempo',
    card: 'bg-cyan-500/10 border-cyan-500/30',
    chip: 'bg-cyan-600/25 border-cyan-500/45 text-cyan-200',
    compactLabel: 'text-cyan-300'
  },
  pause: {
    label: 'PAUSE',
    short: 'PS',
    full: 'Pause',
    card: 'bg-indigo-500/10 border-indigo-500/30',
    chip: 'bg-indigo-600/25 border-indigo-500/45 text-indigo-200',
    compactLabel: 'text-indigo-300'
  }
};

const getSetTypeMeta = (set) => {
  const type = resolveSetType(set);
  return {
    type,
    ...(SET_TYPE_META[type] || SET_TYPE_META.work)
  };
};

export const WorkoutDetailView = ({ selectedDate, workouts, onBack, exercisesDB = [] }) => {
  // State for compact/normal view - reads and writes to localStorage
  const [isCompact, setIsCompact] = useState(() => {
    try {
      const saved = localStorage.getItem('workoutDetailCompactView');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  // Save to localStorage whenever isCompact changes
  useEffect(() => {
    try {
      localStorage.setItem('workoutDetailCompactView', JSON.stringify(isCompact));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }, [isCompact]);

  const dateWorkouts = workouts.filter(w => w.date === selectedDate);

  return (
    <div className="bg-black text-white pb-24">
      {/* Header */}
      <div className="bg-gradient-to-b from-black to-black/80 border-b border-white/10 p-4 flex items-center justify-between gap-4 sticky top-0 z-20 shadow-2xl">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg transition">
            <ChevronLeft size={24} />
          </button>
          <div>
            <p className="text-xs text-slate-400 font-semibold tracking-widest">WORKOUT DETAILS</p>
            <h1 className="text-2xl font-black">{formatDate(selectedDate)}</h1>
          </div>
        </div>
        <button
          onClick={() => setIsCompact(!isCompact)}
          className="p-2 hover:bg-white/10 rounded-lg transition text-slate-400 hover:text-white ui-press"
          title={isCompact ? 'Normal view' : 'Compact view'}
        >
          {isCompact ? <List size={20} /> : <LayoutGrid size={20} />}
        </button>
      </div>

      <div className={`transition-all duration-250 ease-out ${isCompact ? 'p-2 space-y-1.5' : 'p-4 space-y-4'}`}>
        {dateWorkouts.map(workout => {
          // Calculate workout stats
          let totalVolume = 0;
          let totalSets = 0;
          let totalRecords = 0;

          (workout.exercises || []).forEach(ex => {
            const completedSets = (ex.sets || []).filter(s => s.completed);
            totalSets += completedSets.length;

            completedSets.forEach(set => {
              const kg = Number(set.kg) || 0;
              const reps = Number(set.reps) || 0;
              totalVolume += kg * reps;

              if (set.isBest1RM || set.isBestSetVolume || set.isHeaviestWeight) {
                totalRecords++;
              }
            });
          });

          const stats = { totalVolume, totalSets, totalRecords };

          return (
            <div key={workout.id} className={isCompact ? 'bg-slate-800/40 border border-slate-700/50 rounded p-2 ui-layout-morph' : 'bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-xl p-5 ui-card-mount-anim ui-layout-morph'}>
              {/* Workout Header */}
              <div className={isCompact ? 'mb-1.5 pb-1.5 border-b border-slate-700/30' : 'mb-4'}>
                <h2 className={isCompact ? 'text-base font-black text-white' : 'text-2xl font-black text-white mb-3'}>{workout.name}</h2>

                {/* Clean Stats Grid - Responsive 2x2 on mobile, flexible on larger screens */}
                {!isCompact && (
                  <div className="grid grid-cols-2 gap-2.5 py-3 bg-slate-800/30 rounded-lg border border-slate-700/40">
                    {/* Time - Top Left */}
                    <div className="flex items-center gap-2.5 px-3 py-2 rounded hover:bg-slate-700/20 transition">
                      <Clock size={18} className="text-slate-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs text-slate-500 font-semibold">{"\u23F1\uFE0F"} TIME</div>
                        <div className="text-base font-black text-white">{Math.floor(workout.duration / 60)}h {(workout.duration % 60).toString().padStart(2, '0')}m</div>
                      </div>
                    </div>

                    {/* Volume - Top Right */}
                    <div className="flex items-center gap-2.5 px-3 py-2 rounded hover:bg-slate-700/20 transition">
                      <span className="text-lg leading-none" aria-hidden>{"\u{1F3CB}\uFE0F"}</span>
                      <div className="min-w-0">
                        <div className="text-xs text-slate-500 font-semibold">{"\u{1F3CB}\uFE0F"} VOLUME</div>
                        <div className="text-base font-black accent-text">{(stats.totalVolume / 1000).toFixed(1)}k</div>
                      </div>
                    </div>

                    {/* Sets - Bottom Left */}
                    <div className="flex items-center gap-2.5 px-3 py-2 rounded hover:bg-slate-700/20 transition">
                      <span className="text-lg leading-none" aria-hidden>{"\u{1F501}"}</span>
                      <div className="min-w-0">
                        <div className="text-xs text-slate-500 font-semibold">{"\u{1F501}"} SETS</div>
                        <div className="text-base font-black text-white">{stats.totalSets}</div>
                      </div>
                    </div>

                    {/* Records - Bottom Right */}
                    <div className="flex items-center gap-2.5 px-3 py-2 rounded hover:bg-slate-700/20 transition">
                      <Medal size={18} className={stats.totalRecords > 0 ? 'text-amber-400' : 'text-slate-600'} />
                      <div className="min-w-0">
                        <div className="text-xs text-slate-500 font-semibold">{"\u{1F396}\uFE0F"} RECORDS</div>
                        <div className={`text-base font-black ${stats.totalRecords > 0 ? 'text-amber-400' : 'text-slate-600'}`}>{stats.totalRecords || '-'}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Compact version - just the name and time */}
                {isCompact && (
                  <p className="text-xs text-slate-500 mt-1 font-semibold">
                    <Clock size={12} className="inline mr-1" /> {Math.floor(workout.duration / 60)}h {(workout.duration % 60).toString().padStart(2, '0')}m
                  </p>
                )}
              </div>

              {/* Separator reduced for new layout */}
              {!isCompact && (
                <div className="mb-4 pb-4 border-b border-slate-700/50" />
              )}

              {/* Workout Tags - Hide in compact */}
              {!isCompact && workout.tags && workout.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {workout.tags.map(tag => (
                    <span
                      key={tag}
                      className="text-xs px-2.5 py-1 rounded-full font-bold accent-bg-light accent-text accent-border-light"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Workout Note - Hide in compact */}
              {!isCompact && workout.note && (
                <div className="mb-4 bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-lg text-sm text-amber-200 italic flex gap-3">
                  <FileText size={16} className="shrink-0 mt-0.5 text-amber-400" />
                  <span>{workout.note}</span>
                </div>
              )}

              {/* Exercises */}
              <div className={isCompact ? 'space-y-1' : 'space-y-4'}>
                {workout.exercises?.map((ex, i) => {
                  const completedSets = (ex.sets || []).filter(s => s.completed);
                  if (completedSets.length === 0) return null;

                  return (
                    <div key={ex.exerciseId || `ex-${i}`} className={isCompact ? 'bg-slate-900/30 rounded p-1.5' : 'bg-slate-800/40 border border-slate-700/50 rounded-lg p-4'}>
                      {/* Exercise Header */}
                      <div className={isCompact ? 'mb-1' : 'mb-3'}>
                        <div className="flex items-center gap-2">
                          <h3 className={isCompact ? 'text-xs font-black text-white' : 'text-lg font-black text-white'}>{ex.name}</h3>
                          {(() => {
                            const hasRecords = completedSets.some(s => s.isBest1RM || s.isBestSetVolume || s.isHeaviestWeight);
                            if (hasRecords) {
                              const recordTypes = new Set();
                              completedSets.forEach(s => {
                                if (s.isHeaviestWeight) recordTypes.add('Heaviest Weight');
                                if (s.isBestSetVolume) recordTypes.add('Best Set Volume');
                                if (s.isBest1RM) recordTypes.add('Best 1RM');
                              });
                              return (
                                <Medal size={isCompact ? 12 : 20} className="text-yellow-400" title={Array.from(recordTypes).join(', ')} />
                              );
                            }
                            return null;
                          })()}
                        </div>
                        {!isCompact && (
                          <>
                            <p className="text-xs text-slate-400 mt-1 font-semibold">{ex.category}</p>
                            {(() => {
                              const exFromDB = exercisesDB?.find(e => e.id === ex.exerciseId);
                              return exFromDB?.note && (
                                <div className="mt-2 text-xs accent-bg-light accent-border-light accent-text px-2 py-1 rounded">
                                  {exFromDB.note}
                                </div>
                              );
                            })()}
                          </>
                        )}
                      </div>
                      <div className={isCompact ? 'space-y-0.5' : 'space-y-2.5'}>
                        {completedSets.map((set, j) => {
                          const typeMeta = getSetTypeMeta(set);
                          let workPosition = 0;
                          for (let idx = 0; idx <= j; idx += 1) {
                            if (resolveSetType(completedSets[idx]) !== 'warmup') {
                              workPosition += 1;
                            }
                          }
                          const setLabel = typeMeta.type === 'warmup' ? 'WU' : `#${workPosition}`;

                          return (
                            <div
                              key={`${ex.exerciseId}-${j}-${set.kg}-${set.reps}`}
                              className={isCompact ? 'flex items-center gap-1.5 text-xs px-1 py-0.5 rounded' : `flex items-center gap-3 p-2 rounded-lg border transition-all ${typeMeta.card} ${set.isBest1RM || set.isBestSetVolume || set.isHeaviestWeight ? 'bg-yellow-500/20 border-yellow-500/40' : ''}`}
                            >
                              {/* Compact: Single line format */}
                              {isCompact ? (
                                <>
                                  <span className={`font-bold ${typeMeta.compactLabel}`}>{setLabel}</span>
                                  <span className="text-white font-bold">{set.kg}</span>
                                  <span className="text-slate-500">x</span>
                                  <span className="text-white">{set.reps}</span>
                                  {typeMeta.type !== 'work' && (
                                    <span className={`ml-0.5 min-w-[64px] text-center px-1.5 py-0.5 rounded border text-[9px] font-black tracking-wide ${typeMeta.chip}`}>
                                      {typeMeta.full || typeMeta.short}
                                    </span>
                                  )}
                                  {(set.isBest1RM || set.isBestSetVolume || set.isHeaviestWeight) && (
                                    <Medal size={10} className="text-yellow-400 ml-auto" />
                                  )}
                                </>
                              ) : (
                                <>
                                  {(set.isBest1RM || set.isBestSetVolume || set.isHeaviestWeight) && typeMeta.type !== 'warmup' && (
                                    <div className="text-yellow-400" title={
                                      [
                                        set.isHeaviestWeight && 'Heaviest Weight',
                                        set.isBestSetVolume && 'Best Set Volume',
                                        set.isBest1RM && 'Best 1RM'
                                      ].filter(Boolean).join(', ')
                                    }>
                                      <Medal size={16} />
                                    </div>
                                  )}
                                  {typeMeta.type !== 'work' && (
                                    <div className={`w-[92px] min-w-[92px] text-center px-2 py-0.5 rounded border text-[10px] font-black tracking-wide ${typeMeta.chip}`}>
                                      {typeMeta.label}
                                    </div>
                                  )}
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black min-w-[2rem] ${typeMeta.type === 'warmup' ? 'bg-amber-600/20 text-amber-300 border border-amber-500/35' : 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'}`}>
                                    {setLabel}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-bold text-white">
                                      {set.kg} <span className="text-slate-400 font-normal">kg</span> x {set.reps}
                                    </p>
                                    {(set.rir != null || set.tempo || set.pauseSec) && (
                                      <p className="text-[11px] text-slate-400 mt-0.5">
                                        {set.rir != null ? `RIR ${set.rir}` : null}
                                        {set.rir != null && (set.tempo || set.pauseSec) ? ' | ' : null}
                                        {set.tempo ? `Tempo ${set.tempo}` : null}
                                        {set.tempo && set.pauseSec ? ' | ' : null}
                                        {set.pauseSec ? `Pause ${set.pauseSec}s` : null}
                                      </p>
                                    )}
                                  </div>
                                  <div className="text-right min-w-fit">
                                    <p className="text-xs text-slate-400 font-semibold">1RM</p>
                                    <p className="text-sm font-black accent-text">
                                      {calculate1RM(set.kg, set.reps)} kg
                                    </p>
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};








