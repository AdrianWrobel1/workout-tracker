import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Medal, Plus, Trash2, X, Search } from 'lucide-react';
import { formatMonth, calculateTotalVolume } from '../domain/calculations';
import { getHistoryModel, relativeDay } from '../domain/history';
import { WorkoutCard } from '../components/WorkoutCard';
import { VirtualList } from '../components/VirtualList';
import { AnalyticsEmpty } from '../components/analyticsUI';

const TAGS = ['#cut', '#power', '#volume', '#sleep-bad', '#bulk', '#stress', '#sick'];

const HistoryViewInner = ({
  workouts,
  onViewWorkoutDetail,
  onDeleteWorkout,
  onEditWorkout,
  exercisesDB = [],
  userWeight = null,
  filter = 'all',
  onFilterChange,
  scrollToWorkoutDate,
  onScrollToWorkoutDone,
  getRecords,
  scrollPosition,
  onSaveScrollPosition
}) => {
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState(null);
  const [selectedTags, setSelectedTags] = useState([]);
  const [query, setQuery] = useState('');
  const [showNewExercise, setShowNewExercise] = useState(false);
  const [useExerciseDB, setUseExerciseDB] = useState(false);
  const [newExercise, setNewExercise] = useState({ exerciseId: null, name: '', category: '', sets: [{ kg: 0, reps: 0, completed: false }] });
  const [activeRecordFlashId, setActiveRecordFlashId] = useState(null);
  const [listTransitionOn, setListTransitionOn] = useState(false);
  const scrollContainerRef = useRef(null);
  // Frozen at mount: "today" cutoffs stay stable across re-renders (and
  // satisfy react-hooks/purity — no impure clock reads during render).
  const [now] = useState(() => Date.now());

  useEffect(() => {
    scrollContainerRef.current = document.querySelector('.app-content');
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || scrollPosition === null || scrollPosition === undefined) return;
    container.scrollTop = scrollPosition;
  }, [scrollPosition]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !onSaveScrollPosition) return;

    const handleContainerScroll = () => onSaveScrollPosition(container.scrollTop);
    container.addEventListener('scroll', handleContainerScroll, { passive: true });

    return () => container.removeEventListener('scroll', handleContainerScroll);
  }, [onSaveScrollPosition]);

  useEffect(() => {
    const start = setTimeout(() => setListTransitionOn(true), 0);
    const timer = setTimeout(() => setListTransitionOn(false), 220);
    return () => {
      clearTimeout(start);
      clearTimeout(timer);
    };
  }, [filter, selectedTags, query]);

  useEffect(() => {
    if (!scrollToWorkoutDate || !onScrollToWorkoutDone) return;
    const t = setTimeout(() => {
      document.querySelector(`[data-workout-date="${scrollToWorkoutDate}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      onScrollToWorkoutDone();
    }, 120);
    return () => clearTimeout(t);
  }, [scrollToWorkoutDate, onScrollToWorkoutDone]);

  // Canonical list model: future exclusion, newest-first ordering with
  // dateless records last, local month grouping, PR/heavy/light over work
  // volume, tag + text discovery. See domain/history.js.
  const model = useMemo(() => getHistoryModel({
    workouts,
    filter,
    tags: selectedTags,
    query,
    now,
    getRecords,
    exercisesDB,
    userWeight,
  }), [workouts, filter, selectedTags, query, now, getRecords, exercisesDB, userWeight]);

  const byId = useMemo(() => {
    const map = new Map();
    (workouts || []).forEach(w => { if (w?.id != null) map.set(w.id, w); });
    return map;
  }, [workouts]);

  const prPreviewIds = useMemo(() => {
    const ids = new Set();
    model.items.forEach(p => { if (p.hasStoredPR) ids.add(p.id); });
    return ids;
  }, [model]);

  const virtualItems = useMemo(
    () => model.items.map(p => byId.get(p.id)).filter(Boolean),
    [model, byId]
  );

  const resetEditorHelpers = () => {
    setShowNewExercise(false);
    setUseExerciseDB(false);
    setNewExercise({ exerciseId: null, name: '', category: '', sets: [{ kg: 0, reps: 0, completed: false }] });
  };

  const handleEditStart = useCallback((workout) => {
    setEditingId(workout.id);
    setEditData(JSON.parse(JSON.stringify(workout)));
    resetEditorHelpers();
  }, []);

  const handleDelete = useCallback((id) => {
    if (onDeleteWorkout) onDeleteWorkout(id);
  }, [onDeleteWorkout]);

  const handleEditSave = () => {
    if (!editData || !onEditWorkout) return;
    const idToScroll = editingId;
    onEditWorkout(editData);
    setEditingId(null);
    setEditData(null);
    resetEditorHelpers();
    setTimeout(() => document.querySelector(`[data-workout-id="${idToScroll}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 100);
  };

  const handleEditCancel = useCallback(() => {
    const idToScroll = editingId;
    setEditingId(null);
    setEditData(null);
    resetEditorHelpers();
    setTimeout(() => document.querySelector(`[data-workout-id="${idToScroll}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 100);
  }, [editingId]);

  // Escape closes the edit sheet (it is a modal dialog).
  useEffect(() => {
    if (!editingId) return;
    const onKey = (e) => {
      if (e.key === 'Escape') handleEditCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [editingId, handleEditCancel]);

  const updateEdit = (updater) => {
    if (!editData) return;
    const updated = { ...editData };
    updater(updated);
    setEditData(updated);
  };

  const addExerciseToEditedWorkout = () => {
    if (!editData) return;
    if (useExerciseDB) {
      const selectedEx = exercisesDB.find(e => e.id === newExercise.exerciseId);
      if (!selectedEx) return;
      updateEdit(updated => {
        updated.exercises = [...(updated.exercises || []), {
          exerciseId: selectedEx.id,
          name: selectedEx.name,
          category: selectedEx.category,
          muscles: selectedEx.muscles || [],
          sets: JSON.parse(JSON.stringify(newExercise.sets))
        }];
      });
    } else {
      if (!newExercise.name.trim()) return;
      updateEdit(updated => {
        updated.exercises = [...(updated.exercises || []), {
          name: newExercise.name,
          category: newExercise.category || 'Other',
          sets: JSON.parse(JSON.stringify(newExercise.sets))
        }];
      });
    }
    resetEditorHelpers();
  };

  const editSummary = useMemo(() => {
    if (!editData) return { exerciseCount: 0, setCount: 0, totalVolume: 0, prCount: 0 };
    const exerciseCount = (editData.exercises || []).length;
    const setCount = (editData.exercises || []).reduce((sum, ex) => sum + ((ex.sets || []).length), 0);
    const totalVolume = (editData.exercises || []).reduce((sum, ex) => sum + calculateTotalVolume(ex.sets || []), 0);
    const prCount = (editData.exercises || []).reduce((sum, ex) => sum + ((ex.sets || []).filter(s => s?.isBest1RM || s?.isBestSetVolume || s?.isHeaviestWeight).length), 0);
    return { exerciseCount, setCount, totalVolume, prCount };
  }, [editData]);

  const handleOpenWorkoutFromHistory = useCallback((workout) => {
    if (!onViewWorkoutDetail || !workout) return;
    if (prPreviewIds.has(workout.id)) {
      setActiveRecordFlashId(workout.id);
      setTimeout(() => setActiveRecordFlashId(null), 420);
      setTimeout(() => onViewWorkoutDetail(workout.date, workout.id), 120);
      return;
    }
    onViewWorkoutDetail(workout.date, workout.id);
  }, [onViewWorkoutDetail, prPreviewIds]);

  const renderCard = useCallback((workout) => (
    <WorkoutCard
      workout={workout}
      onViewDetail={handleOpenWorkoutFromHistory}
      onEdit={handleEditStart}
      onDelete={handleDelete}
      showActions={true}
      exercisesDB={exercisesDB}
      userWeight={userWeight}
      relative={relativeDay(workout.date, now)}
      getRecordsFn={(exerciseId, exercise) => ({ prCount: (exercise.sets || []).filter(s => s.isBest1RM || s.isBestSetVolume || s.isHeaviestWeight).length })}
    />
  ), [handleOpenWorkoutFromHistory, handleEditStart, handleDelete, exercisesDB, userWeight, now]);

  const groupedCards = model.groups.map(group => (
    <section key={group.monthKey} aria-label={group.monthKey === 'unknown' ? 'Unknown date' : formatMonth(group.monthKey + '-01')}>
      <div className="mb-3">
        <h2 className="text-sm font-black text-slate-300 uppercase tracking-widest">{group.monthKey === 'unknown' ? 'Unknown date' : formatMonth(group.monthKey + '-01')}</h2>
        <div className="h-0.5 bg-slate-700/50 mt-2 rounded-full" aria-hidden="true" />
      </div>
      <div className="space-y-3">
        {group.items.map(preview => {
          const workout = byId.get(preview.id);
          if (!workout) return null;
          return (
      <div key={preview.id} data-workout-id={workout.id} data-workout-date={workout.date} className={`${activeRecordFlashId === workout.id ? 'ui-record-click rounded-xl' : ''} ui-list-item-stagger` }>
            {renderCard(workout)}
          </div>
          );
        })}
      </div>
    </section>
  ));

  const current = editData;
  const isFiltering = (filter || 'all') !== 'all' || selectedTags.length > 0 || query.trim() !== '';

  return (
    <div className="bg-black text-white pb-16">
      <div className="bg-black/95 backdrop-blur border-b border-white/10 p-4 sticky top-0 z-20 shadow-2xl">
        <h1 className="text-4xl font-black">HISTORY</h1>
        <p className="text-xs text-slate-400 mt-2 font-semibold tracking-widest">YOUR TRAINING LOG</p>

        <div className="mt-3 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search workouts or exercises…"
            aria-label="Search workouts"
            className="touch-input w-full bg-slate-800/60 border border-slate-700/50 text-white rounded-xl pl-9 pr-8 text-sm font-semibold placeholder:text-slate-500 focus:outline-none focus:border-slate-500"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-500 hover:text-slate-300 rounded-lg"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex gap-2 mt-3 overflow-x-auto pb-1 no-scrollbar" role="group" aria-label="History filters">
          {[{ id: 'all', label: 'All' }, { id: 'pr', label: 'PR' }, { id: 'heavy', label: 'Heavy' }, { id: 'light', label: 'Light' }].map(item => (
            <button key={item.id} onClick={() => onFilterChange && onFilterChange(item.id)} aria-pressed={(filter || 'all') === item.id} className={`text-xs font-bold px-4 min-h-[44px] rounded-full transition-all whitespace-nowrap ${(filter || 'all') === item.id ? 'accent-bg text-white shadow-lg shadow-accent/50' : 'bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-slate-300'}`}>
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-3">
          <h2 className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mb-2">Filter by tags</h2>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setSelectedTags([])} aria-pressed={selectedTags.length === 0} className={`px-4 min-h-[44px] rounded-full text-xs font-bold transition-all ${selectedTags.length === 0 ? 'accent-bg text-white shadow-lg shadow-accent/30' : 'bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-slate-300'}`}>All</button>
            {TAGS.map(tag => (
              <button key={tag} onClick={() => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])} aria-pressed={selectedTags.includes(tag)} className={`px-4 min-h-[44px] rounded-full text-xs font-bold transition-all ${selectedTags.includes(tag) ? 'accent-bg text-white shadow-lg shadow-accent/30' : 'bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-slate-300'}`}>
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={"p-4 space-y-6 max-w-3xl w-full mx-auto " + (listTransitionOn ? "ui-history-crossfade" : "")}>
        {model.excludedFuture > 0 && (
          <p className="text-[11px] text-slate-500 font-semibold" role="status">
            {model.excludedFuture} upcoming {model.excludedFuture === 1 ? 'workout' : 'workouts'} hidden — history shows completed sessions only.
          </p>
        )}
        {model.items.length === 0 ? (
          <AnalyticsEmpty
            title={!isFiltering ? 'No workouts yet' : 'No workouts match this filter'}
            hint={!isFiltering ? 'Start your first workout to see it here' : 'Try a different search or filter'}
          />
        ) : model.items.length > 50 ? (
          <VirtualList
            items={virtualItems}
            itemHeight={380}
            containerHeight={window.innerHeight - 250}
            keyExtractor={(item) => item.id}
            renderItem={(workout) => (
              <div key={workout.id} data-workout-id={workout.id} data-workout-date={workout.date} className="mb-3">
                {renderCard(workout)}
              </div>
            )}
          />
        ) : groupedCards}
      </div>

      {editingId && current && (
        <div className="fixed inset-x-0 top-0 z-50 bg-black/85 backdrop-blur-sm" style={{ height: 'calc(100vh - 4rem)' }} role="dialog" aria-modal="true" aria-label={`Edit ${current.name || 'workout'}`} onMouseDown={(e) => { if (e.target === e.currentTarget) handleEditCancel(); }}>
          <div className="h-full w-full sm:max-w-3xl sm:mx-auto sm:my-4 sm:h-[calc(100%-2rem)] bg-gradient-to-br from-slate-900/98 to-black border border-slate-700/60 sm:rounded-2xl flex flex-col shadow-2xl">
            <div className="p-4 border-b border-slate-700/50 bg-slate-950/90">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-slate-400 font-semibold tracking-widest uppercase">Edit Workout</p>
                  <h2 className="text-lg font-black text-white mt-1 truncate">{current.name || 'Workout'}</h2>
                </div>
                <div className="text-xs text-slate-300 text-right">
                  <p className="font-semibold">{current.date}</p>
                  <p>{current.duration || 0} min</p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-400">
                <div className="rounded-lg bg-slate-800/40 p-2">Exercises: <span className="font-bold text-white">{editSummary.exerciseCount}</span></div>
                <div className="rounded-lg bg-slate-800/40 p-2">Sets: <span className="font-bold text-white">{editSummary.setCount}</span></div>
                <div className="rounded-lg bg-slate-800/40 p-2">Volume: <span className="font-bold text-white">{editSummary.totalVolume}kg</span></div>
                <div className="rounded-lg bg-slate-800/40 p-2">PR sets: <span className="font-bold text-white">{editSummary.prCount}</span></div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input type="text" aria-label="Workout name" value={current.name} onChange={(e) => setEditData({ ...current, name: e.target.value })} className="touch-input w-full bg-slate-800/60 border border-slate-600/50 text-white rounded-xl font-semibold" placeholder="Workout name" />
                <input type="date" aria-label="Workout date" value={current.date || ''} onChange={(e) => setEditData({ ...current, date: e.target.value })} className="touch-input w-full bg-slate-800/60 border border-slate-600/50 text-white rounded-xl font-semibold" />
                <input type="number" aria-label="Duration in minutes" inputMode="decimal" value={current.duration || 0} onChange={(e) => setEditData({ ...current, duration: Number(e.target.value) || 0 })} className="touch-input w-full bg-slate-800/60 border border-slate-600/50 text-white rounded-xl font-semibold" placeholder="Duration (min)" />
              </div>

              {(current.exercises || []).map((ex, exIdx) => (
                <div key={`${ex.name}-${exIdx}`} className="space-y-3 p-4 bg-slate-900/55 border border-slate-700/50 rounded-xl">
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-white truncate">{ex.name}</h3>
                        {(ex.sets || []).some(s => s.isBest1RM || s.isBestSetVolume || s.isHeaviestWeight) && <Medal size={16} className="text-yellow-400" />}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{ex.category || 'Other'}</p>
                    </div>
                      <div className="flex gap-2">
                        <button onClick={() => updateEdit(updated => { updated.exercises[exIdx].sets.push({ kg: 0, reps: 0, completed: false }); })} aria-label={`Add set to ${ex.name}`} className="p-2.5 sm:p-2 accent-bg-light accent-border-light rounded-lg transition accent-text active:scale-95" title="Add set"><Plus size={16} className="sm:hidden" /> <Plus size={14} className="hidden sm:block" /></button>
                        <button onClick={() => updateEdit(updated => { updated.exercises = updated.exercises.filter((_, i) => i !== exIdx); })} aria-label={`Delete ${ex.name}`} className="p-2.5 sm:p-2 bg-red-600/20 border border-red-500/30 rounded-lg transition text-red-400 active:scale-95" title="Delete exercise"><Trash2 size={16} className="sm:hidden" /> <Trash2 size={14} className="hidden sm:block" /></button>
                      </div>
                  </div>

                  {(ex.sets || []).map((set, setIdx) => (
                    <div key={setIdx} className="bg-slate-900/70 border border-slate-700/50 rounded-lg p-3 group relative">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-400 font-bold">SET #{setIdx + 1}</span>
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1.5 text-xs text-slate-400">
                            <input type="checkbox" checked={!!set.completed} onChange={() => updateEdit(updated => { updated.exercises[exIdx].sets[setIdx].completed = !updated.exercises[exIdx].sets[setIdx].completed; })} className="w-4 h-4 cursor-pointer rounded border-slate-600/50 accent-emerald-600 ui-checkbox" />
                            Done
                          </label>
                          <button onClick={() => {
                            updateEdit(updated => { updated.exercises[exIdx].sets = updated.exercises[exIdx].sets.filter((_, i) => i !== setIdx); });
                          }} className="p-1 text-red-400 hover:text-red-300 transition ui-set-undo-button"><X size={14} /></button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="number" aria-label={`Set ${setIdx + 1} weight in kilograms`} inputMode="decimal" value={set.kg} onChange={(e) => updateEdit(updated => { updated.exercises[exIdx].sets[setIdx].kg = Number(e.target.value) || 0; })} className="touch-input w-full bg-slate-800/60 border border-slate-600/50 text-white rounded-lg font-bold ui-keypad-input" placeholder="kg" />
                        <input type="number" aria-label={`Set ${setIdx + 1} reps`} inputMode="decimal" value={set.reps} onChange={(e) => updateEdit(updated => { updated.exercises[exIdx].sets[setIdx].reps = Number(e.target.value) || 0; })} className="touch-input w-full bg-slate-800/60 border border-slate-600/50 text-white rounded-lg font-bold ui-keypad-input" placeholder="reps" />
                      </div>
                    </div>
                  ))}

                  <div className="flex justify-center">
                    <button
                      onClick={() => updateEdit(updated => { updated.exercises[exIdx].sets.push({ kg: 0, reps: 0, completed: false }); })}
                      className="w-fit px-3 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition"
                    >
                      + Add Set
                    </button>
                  </div>
                </div>
              ))}

              <div className="space-y-3 p-4 bg-slate-900/45 border border-slate-700/50 rounded-xl">
                <button onClick={() => setShowNewExercise(prev => !prev)} className="w-full text-sm px-4 py-3 rounded-lg bg-slate-800/60 border border-blue-500/30 text-blue-400 hover:bg-slate-700/50 flex items-center justify-center gap-2 transition font-semibold"><Plus size={14} /> {showNewExercise ? 'Hide Add Exercise' : 'Add Exercise'}</button>
                {showNewExercise && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex items-center gap-2 text-xs cursor-pointer p-2 rounded-lg bg-slate-800/40"><input type="radio" checked={!useExerciseDB} onChange={() => setUseExerciseDB(false)} className="w-4 h-4 cursor-pointer accent-blue-600" /> <span className="font-semibold">New</span></label>
                      <label className="flex items-center gap-2 text-xs cursor-pointer p-2 rounded-lg bg-slate-800/40"><input type="radio" checked={useExerciseDB} onChange={() => setUseExerciseDB(true)} className="w-4 h-4 cursor-pointer accent-blue-600" /> <span className="font-semibold">From DB</span></label>
                    </div>
                    {!useExerciseDB ? (
                      <input type="text" value={newExercise.name} onChange={(e) => setNewExercise({ ...newExercise, name: e.target.value })} className="touch-input w-full bg-slate-800/60 border border-slate-600/50 text-white rounded-xl" placeholder="Exercise name" />
                    ) : (
                      <select value={newExercise.exerciseId || ''} onChange={(e) => { const exId = parseInt(e.target.value); const found = exercisesDB.find(ex => ex.id === exId); setNewExercise({ exerciseId: exId, name: found?.name || '', category: found?.category || '', sets: [{ kg: 0, reps: 0, completed: false }] }); }} className="w-full bg-slate-800/60 border border-slate-600/50 text-white px-3 py-3 rounded-lg text-sm">
                        <option value="">Choose exercise...</option>
                        {exercisesDB.map(ex => <option key={ex.id} value={ex.id}>{ex.name} ({ex.category})</option>)}
                      </select>
                    )}
                    <div className="flex gap-2">
                      <button onClick={resetEditorHelpers} className="flex-1 text-xs px-3 py-2 rounded bg-slate-800/50 border border-slate-600/50 text-white hover:bg-slate-700/50 transition font-semibold">Cancel</button>
                      <button onClick={addExerciseToEditedWorkout} disabled={useExerciseDB ? !newExercise.exerciseId : !newExercise.name.trim()} className="flex-1 text-xs px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition font-bold">Add</button>
                    </div>
                  </>
                )}
              </div>

              <textarea aria-label="Workout notes" value={current.note || ''} onChange={(e) => setEditData({ ...current, note: e.target.value })} className="touch-input w-full bg-slate-800/60 border border-slate-600/50 text-white rounded-xl resize-none" placeholder="Workout notes..." rows={4} />

              <div className="flex flex-wrap gap-2">
                {TAGS.map(tag => (
                  <button key={tag} onClick={() => setEditData(prev => { const updated = { ...prev }; const now = updated.tags || []; updated.tags = now.includes(tag) ? now.filter(t => t !== tag) : [...now, tag]; return updated; })} className={`px-3 py-2 rounded-full text-xs font-bold transition-all ${(current.tags || []).includes(tag) ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-slate-300'}`}>{tag}</button>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-slate-700/50 bg-slate-950/90 sticky bottom-0 z-20 flex gap-2">
                <button onClick={handleEditCancel} className="flex-1 px-4 py-3 rounded-lg bg-slate-800/60 border border-slate-600/50 text-white text-sm hover:bg-slate-700/50 transition font-semibold ui-press">Cancel</button>
                <button onClick={handleEditSave} className="flex-1 px-4 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm transition font-bold shadow-lg shadow-emerald-600/30 ui-press">Save</button>

            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const HistoryView = React.memo(HistoryViewInner);
