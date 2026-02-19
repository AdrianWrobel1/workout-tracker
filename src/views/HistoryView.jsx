import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Medal, Plus, Trash2, X } from 'lucide-react';
import { formatMonth, calculateTotalVolume } from '../domain/calculations';
import { getExerciseRecords } from '../domain/exercises';
import { WorkoutCard } from '../components/WorkoutCard';
import { VirtualList } from '../components/VirtualList';

const TAGS = ['#cut', '#power', '#volume', '#sleep-bad', '#bulk', '#stress', '#sick'];

const HistoryViewInner = ({
  workouts,
  onViewWorkoutDetail,
  onDeleteWorkout,
  onEditWorkout,
  exercisesDB = [],
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
  const [showNewExercise, setShowNewExercise] = useState(false);
  const [useExerciseDB, setUseExerciseDB] = useState(false);
  const [newExercise, setNewExercise] = useState({ exerciseId: null, name: '', category: '', sets: [{ kg: 0, reps: 0, completed: false }] });
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    if (scrollContainerRef.current && scrollPosition !== null && scrollPosition !== undefined) {
      scrollContainerRef.current.scrollTop = scrollPosition;
    }
  }, [scrollPosition]);

  const handleScroll = () => {
    if (scrollContainerRef.current && onSaveScrollPosition) onSaveScrollPosition(scrollContainerRef.current.scrollTop);
  };

  useEffect(() => {
    if (!scrollToWorkoutDate || !onScrollToWorkoutDone) return;
    const t = setTimeout(() => {
      document.querySelector(`[data-workout-date="${scrollToWorkoutDate}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      onScrollToWorkoutDone();
    }, 120);
    return () => clearTimeout(t);
  }, [scrollToWorkoutDate, onScrollToWorkoutDone]);

  const prWorkoutIds = useMemo(() => {
    const ids = new Set();
    const fromCache = getRecords || (() => null);
    (workouts || []).forEach(w => {
      const hasPr = (w.exercises || []).some(ex => {
        if (!ex.exerciseId) return false;
        const rec = fromCache(ex.exerciseId) ?? getExerciseRecords(ex.exerciseId, workouts);
        const best = rec?.best1RM || 0;
        const maxInWorkout = Math.max(0, ...(ex.sets || []).filter(s => s?.completed).map(s => {
          const kg = Number(s.kg) || 0;
          const reps = Number(s.reps) || 0;
          return kg && reps ? Math.round(kg * (1 + reps / 30)) : 0;
        }));
        return best > 0 && maxInWorkout >= best;
      });
      if (hasPr) ids.add(w.id);
    });
    return ids;
  }, [workouts, getRecords]);

  const heavyCutoff = useMemo(() => {
    const vols = (workouts || []).map(w => (w.exercises || []).reduce((sum, ex) => sum + calculateTotalVolume(ex.sets || []), 0)).sort((a, b) => a - b);
    if (vols.length === 0) return 0;
    const idx = Math.floor(vols.length * 0.7);
    return vols[idx] || 0;
  }, [workouts]);

  const { filteredWorkouts, groups, sortedKeys } = useMemo(() => {
    let result = [...(workouts || [])];
    if (filter === 'pr') result = result.filter(w => prWorkoutIds.has(w.id));
    if (filter === 'heavy') {
      result = result.filter(w => {
        const vol = (w.exercises || []).reduce((sum, ex) => sum + calculateTotalVolume(ex.sets || []), 0);
        return vol >= heavyCutoff && heavyCutoff > 0;
      });
    }
    if (filter === 'light') {
      result = result.filter(w => {
        const vol = (w.exercises || []).reduce((sum, ex) => sum + calculateTotalVolume(ex.sets || []), 0);
        return heavyCutoff > 0 ? vol > 0 && vol < heavyCutoff * 0.3 : vol > 0 && vol < 1000;
      });
    }
    if (selectedTags.length > 0) result = result.filter(w => selectedTags.some(tag => (w.tags || []).includes(tag)));
    result.sort((a, b) => new Date(b.date) - new Date(a.date));

    const byMonth = {};
    result.forEach(w => {
      const key = new Date(w.date).toISOString().slice(0, 7);
      if (!byMonth[key]) byMonth[key] = [];
      byMonth[key].push(w);
    });
    return { filteredWorkouts: result, groups: byMonth, sortedKeys: Object.keys(byMonth).sort((a, b) => b.localeCompare(a)) };
  }, [workouts, filter, prWorkoutIds, heavyCutoff, selectedTags]);

  const resetEditorHelpers = () => {
    setShowNewExercise(false);
    setUseExerciseDB(false);
    setNewExercise({ exerciseId: null, name: '', category: '', sets: [{ kg: 0, reps: 0, completed: false }] });
  };

  const handleEditStart = (workout) => {
    setEditingId(workout.id);
    setEditData(JSON.parse(JSON.stringify(workout)));
    resetEditorHelpers();
  };

  const handleEditSave = () => {
    if (!editData || !onEditWorkout) return;
    const idToScroll = editingId;
    onEditWorkout(editData);
    setEditingId(null);
    setEditData(null);
    resetEditorHelpers();
    setTimeout(() => document.querySelector(`[data-workout-id="${idToScroll}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 100);
  };

  const handleEditCancel = () => {
    const idToScroll = editingId;
    setEditingId(null);
    setEditData(null);
    resetEditorHelpers();
    setTimeout(() => document.querySelector(`[data-workout-id="${idToScroll}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 100);
  };

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

  const groupedCards = sortedKeys.map(key => (
    <div key={key}>
      <div className="mb-4">
        <h2 className="text-sm font-black text-slate-300 tracking-widest">{formatMonth(key + '-01')}</h2>
        <div className="h-0.5 bg-gradient-to-r from-blue-500/50 to-transparent mt-2 rounded-full" />
      </div>
      <div className="space-y-3">
        {groups[key].map(workout => (
          <div key={workout.id} data-workout-id={workout.id} data-workout-date={workout.date} className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-xl p-4 transition-all ui-card-mount-anim hover:border-slate-600/70 hover:from-slate-800/60 hover:to-slate-900/60">
            <WorkoutCard
              workout={workout}
              onViewDetail={() => onViewWorkoutDetail(workout.date)}
              onEdit={() => handleEditStart(workout)}
              onDelete={() => onDeleteWorkout && onDeleteWorkout(workout.id)}
              showActions={true}
              exercisesDB={exercisesDB}
              getRecordsFn={(exerciseId, exercise) => ({ prCount: (exercise.sets || []).filter(s => s.isBest1RM || s.isBestSetVolume || s.isHeaviestWeight).length })}
            />
          </div>
        ))}
      </div>
    </div>
  ));

  const current = editData;

  return (
    <div className="min-h-screen bg-black text-white pb-24" ref={scrollContainerRef} onScroll={handleScroll} style={{ overflow: 'auto' }}>
      <div className="bg-gradient-to-b from-black to-black/80 border-b border-white/10 p-4 sticky top-0 z-20">
        <h1 className="text-4xl font-black">HISTORY</h1>
        <p className="text-xs text-slate-400 mt-2 font-semibold tracking-widest">YOUR WORKOUT LOG</p>

        <div className="flex gap-2 mt-4 overflow-x-auto pb-2 no-scrollbar">
          {[{ id: 'all', label: 'All' }, { id: 'pr', label: 'PR' }, { id: 'heavy', label: 'Heavy' }, { id: 'light', label: 'Light' }].map(item => (
            <button key={item.id} onClick={() => onFilterChange && onFilterChange(item.id)} className={`text-xs font-bold px-4 py-2 rounded-full transition-all whitespace-nowrap ${(filter || 'all') === item.id ? 'accent-bg text-white shadow-lg shadow-accent/50' : 'bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-slate-300'}`}>
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <p className="text-xs text-slate-400 font-semibold tracking-widest mb-2">FILTER BY TAGS</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setSelectedTags([])} className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${selectedTags.length === 0 ? 'accent-bg text-white shadow-lg shadow-accent/30' : 'bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-slate-300'}`}>All</button>
            {TAGS.map(tag => (
              <button key={tag} onClick={() => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])} className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${selectedTags.includes(tag) ? 'accent-bg text-white shadow-lg shadow-accent/30' : 'bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-slate-300'}`}>
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {filteredWorkouts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-400 text-sm font-semibold">{(filter || 'all') === 'all' ? 'No workouts yet' : 'No workouts match this filter'}</p>
            <p className="text-slate-600 text-xs mt-2">{(filter || 'all') === 'all' ? 'Start your first workout to see it here' : 'Try a different filter'}</p>
          </div>
        ) : filteredWorkouts.length > 50 ? (
          <VirtualList
            items={filteredWorkouts}
            itemHeight={320}
            containerHeight={window.innerHeight - 250}
            keyExtractor={(item) => item.id}
            renderItem={(workout) => (
              <div key={workout.id} data-workout-id={workout.id} data-workout-date={workout.date} className="mb-3">
                <WorkoutCard workout={workout} onViewDetail={() => onViewWorkoutDetail && onViewWorkoutDetail(workout.date)} onEdit={() => handleEditStart(workout)} onDelete={() => onDeleteWorkout && onDeleteWorkout(workout.id)} exercisesDB={exercisesDB} hasPR={false} />
              </div>
            )}
          />
        ) : groupedCards}
      </div>

      {editingId && current && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm">
          <div className="h-full w-full sm:max-w-3xl sm:mx-auto sm:my-4 sm:h-[calc(100%-2rem)] bg-gradient-to-br from-slate-900/98 to-black border border-slate-700/60 sm:rounded-2xl flex flex-col shadow-2xl">
            <div className="p-4 border-b border-slate-700/50 bg-slate-950/90">
              <p className="text-[11px] text-slate-400 font-semibold tracking-widest uppercase">Edit Workout</p>
              <h2 className="text-lg font-black text-white mt-1 truncate">{current.name || 'Workout'}</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input type="text" value={current.name} onChange={(e) => setEditData({ ...current, name: e.target.value })} className="touch-input w-full bg-slate-800/60 border border-slate-600/50 text-white rounded-xl font-semibold" placeholder="Workout name" />
                <input type="date" value={current.date || ''} onChange={(e) => setEditData({ ...current, date: e.target.value })} className="touch-input w-full bg-slate-800/60 border border-slate-600/50 text-white rounded-xl font-semibold" />
                <input type="number" inputMode="decimal" value={current.duration || 0} onChange={(e) => setEditData({ ...current, duration: Number(e.target.value) || 0 })} className="touch-input w-full bg-slate-800/60 border border-slate-600/50 text-white rounded-xl font-semibold" placeholder="Duration (min)" />
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
                      <button onClick={() => updateEdit(updated => { updated.exercises[exIdx].sets.push({ kg: 0, reps: 0, completed: false }); })} className="p-2 accent-bg-light accent-border-light rounded-lg transition accent-text"><Plus size={14} /></button>
                      <button onClick={() => updateEdit(updated => { updated.exercises = updated.exercises.filter((_, i) => i !== exIdx); })} className="p-2 bg-red-600/20 border border-red-500/30 rounded-lg transition text-red-400"><Trash2 size={14} /></button>
                    </div>
                  </div>

                  {(ex.sets || []).map((set, setIdx) => (
                    <div key={setIdx} className="bg-slate-900/70 border border-slate-700/50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-400 font-bold">SET #{setIdx + 1}</span>
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1.5 text-xs text-slate-400">
                            <input type="checkbox" checked={!!set.completed} onChange={() => updateEdit(updated => { updated.exercises[exIdx].sets[setIdx].completed = !updated.exercises[exIdx].sets[setIdx].completed; })} className="w-4 h-4 cursor-pointer rounded border-slate-600/50 accent-emerald-600 ui-checkbox" />
                            Done
                          </label>
                          <button onClick={() => updateEdit(updated => { updated.exercises[exIdx].sets = updated.exercises[exIdx].sets.filter((_, i) => i !== setIdx); })} className="p-1 text-red-400 hover:text-red-300 transition"><X size={14} /></button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="number" inputMode="decimal" value={set.kg} onChange={(e) => updateEdit(updated => { updated.exercises[exIdx].sets[setIdx].kg = Number(e.target.value) || 0; })} className="touch-input w-full bg-slate-800/60 border border-slate-600/50 text-white rounded-lg font-bold" placeholder="kg" />
                        <input type="number" inputMode="decimal" value={set.reps} onChange={(e) => updateEdit(updated => { updated.exercises[exIdx].sets[setIdx].reps = Number(e.target.value) || 0; })} className="touch-input w-full bg-slate-800/60 border border-slate-600/50 text-white rounded-lg font-bold" placeholder="reps" />
                      </div>
                    </div>
                  ))}
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

              <textarea value={current.note || ''} onChange={(e) => setEditData({ ...current, note: e.target.value })} className="touch-input w-full bg-slate-800/60 border border-slate-600/50 text-white rounded-xl resize-none" placeholder="Workout notes..." rows={4} />

              <div className="flex flex-wrap gap-2">
                {TAGS.map(tag => (
                  <button key={tag} onClick={() => setEditData(prev => { const updated = { ...prev }; const now = updated.tags || []; updated.tags = now.includes(tag) ? now.filter(t => t !== tag) : [...now, tag]; return updated; })} className={`px-3 py-2 rounded-full text-xs font-bold transition-all ${(current.tags || []).includes(tag) ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-slate-300'}`}>{tag}</button>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-slate-700/50 bg-slate-950/90">
              <div className="flex gap-2">
                <button onClick={handleEditCancel} className="flex-1 px-4 py-3 rounded-lg bg-slate-800/60 border border-slate-600/50 text-white text-sm hover:bg-slate-700/50 transition font-semibold">Cancel</button>
                <button onClick={handleEditSave} className="flex-1 px-4 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm transition font-bold shadow-lg shadow-emerald-600/30">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const HistoryView = React.memo(HistoryViewInner);
