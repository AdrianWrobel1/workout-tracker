import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronRight, Edit2, Trash2, Plus, X as CloseIcon } from 'lucide-react';
import { formatDate, formatMonth, calculateTotalVolume } from '../domain/calculations';
import { getExerciseRecords } from '../domain/exercises';
import { WorkoutCard } from '../components/WorkoutCard';

export const HistoryView = ({ workouts, onViewWorkoutDetail, onDeleteWorkout, onEditWorkout, exercisesDB = [], filter = 'all', onFilterChange }) => {
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState(null);
  const [showNewExercise, setShowNewExercise] = useState(false);
  const [newExercise, setNewExercise] = useState({ exerciseId: null, name: '', category: '', sets: [{ kg: 0, reps: 0, completed: false }] });
  const [useExerciseDB, setUseExerciseDB] = useState(false);
  const [expandedExerciseIdx, setExpandedExerciseIdx] = useState(null);
  const [tagFilter, setTagFilter] = useState(null); // null for all, or specific tag
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const tagDropdownRef = useRef(null);

  // Close tag dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target)) {
        setShowTagDropdown(false);
      }
    };
    if (showTagDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showTagDropdown]);

  // Smart filter logic
  const hasPR = (workout) => {
    try {
      return (workout.exercises || []).some(ex => {
        const exId = ex.exerciseId;
        if (!exId) return false;
        const records = getExerciseRecords(exId, workouts) || {};
        const best1RM = records.best1RM || 0;
        const max1RMInThisWorkout = Math.max(0, ...(ex.sets || [])
          .filter(s => s && s.completed && !s.warmup)
          .map(s => {
            const kg = Number(s.kg) || 0;
            const reps = Number(s.reps) || 0;
            if (!kg || !reps) return 0;
            return Math.round(kg * (1 + reps / 30));
          }), 0);
        return max1RMInThisWorkout >= best1RM && best1RM > 0;
      });
    } catch (e) {
      return false;
    }
  };

  const getWorkoutIntensity = (workout) => {
    // heavy = volume > 70th percentile of all volumes
    const allVols = (workouts || []).map(w => (w.exercises || []).reduce((sum, ex) => sum + calculateTotalVolume(ex.sets || []), 0));
    const allVols_sorted = [...allVols].sort((a, b) => a - b);
    const idx = Math.floor(allVols_sorted.length * 0.7);
    const p70 = (allVols_sorted.length > 0 && Number.isFinite(allVols_sorted[idx])) ? allVols_sorted[idx] : 0;
    const thisVol = (workout.exercises || []).reduce((sum, ex) => sum + calculateTotalVolume(ex.sets || []), 0);

    if (p70 <= 0) {
      // Not enough historical data; classify by simple thresholds
      if (thisVol === 0) return 'light';
      if (thisVol > 1000) return 'heavy';
      return 'normal';
    }

    if (thisVol >= p70) return 'heavy';
    if (thisVol > 0 && thisVol < p70 * 0.3) return 'light';
    return 'normal';
  };

  const filteredWorkouts = useMemo(() => {
    let result = workouts;
    const filterToUse = filter || 'all';
    
    // Apply smart filter (PR, heavy, light)
    if (filterToUse === 'pr') {
      result = result.filter(w => hasPR(w));
    } else if (filterToUse === 'heavy') {
      result = result.filter(w => getWorkoutIntensity(w) === 'heavy');
    } else if (filterToUse === 'light') {
      result = result.filter(w => getWorkoutIntensity(w) === 'light');
    }
    
    // Apply tag filter
    if (tagFilter) {
      result = result.filter(w => (w.tags || []).includes(tagFilter));
    }
    
    return result;
  }, [workouts, filter, tagFilter]);

  // Group workouts by month-year
  const groups = {};
  filteredWorkouts.forEach(w => {
    const key = new Date(w.date).toISOString().slice(0,7);
    if (!groups[key]) groups[key] = [];
    groups[key].push(w);
  });

  const sortedKeys = Object.keys(groups).sort((a,b) => b.localeCompare(a));

  const handleEditStart = (workout) => {
    setEditingId(workout.id);
    setEditData(JSON.parse(JSON.stringify(workout)));
    setShowNewExercise(false);
    setNewExercise({ exerciseId: null, name: '', category: '', sets: [{ kg: 0, reps: 0, completed: false }] });
    setUseExerciseDB(false);
    setExpandedExerciseIdx(null);
  };

  const handleEditSave = () => {
    if (editData && onEditWorkout) {
      onEditWorkout(editData);
      setEditingId(null);
      setEditData(null);
    }
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditData(null);
    setShowNewExercise(false);
    setNewExercise({ exerciseId: null, name: '', category: '', sets: [{ kg: 0, reps: 0, completed: false }] });
    setUseExerciseDB(false);
    setExpandedExerciseIdx(null);
  };

  const handleSetToggle = (exIndex, setIndex) => {
    if (!editData) return;
    const updated = { ...editData };
    updated.exercises[exIndex].sets[setIndex].completed = 
      !updated.exercises[exIndex].sets[setIndex].completed;
    setEditData(updated);
  };

  const handleAddSetToExercise = (exIndex) => {
    if (!editData) return;
    const updated = { ...editData };
    updated.exercises[exIndex].sets = [
      ...(updated.exercises[exIndex].sets || []),
      { kg: 0, reps: 0, completed: false }
    ];
    setEditData(updated);
  };

  const handleRemoveSetFromExercise = (exIndex, setIndex) => {
    if (!editData) return;
    const updated = { ...editData };
    updated.exercises[exIndex].sets = updated.exercises[exIndex].sets.filter((_, i) => i !== setIndex);
    setEditData(updated);
  };

  const handleAddExercise = () => {
    if (!editData) return;
    
    if (useExerciseDB) {
      if (!newExercise.exerciseId) return;
      const selectedEx = exercisesDB.find(e => e.id === newExercise.exerciseId);
      if (!selectedEx) return;
      
      const updated = { ...editData };
      updated.exercises = [...(updated.exercises || []), {
        exerciseId: selectedEx.id,
        name: selectedEx.name,
        category: selectedEx.category,
        muscles: selectedEx.muscles || [],
        sets: JSON.parse(JSON.stringify(newExercise.sets))
      }];
      setEditData(updated);
    } else {
      if (!newExercise.name.trim()) return;
      const updated = { ...editData };
      updated.exercises = [...(updated.exercises || []), {
        name: newExercise.name,
        category: newExercise.category || 'Other',
        sets: JSON.parse(JSON.stringify(newExercise.sets))
      }];
      setEditData(updated);
    }
    
    setNewExercise({ exerciseId: null, name: '', category: '', sets: [{ kg: 0, reps: 0, completed: false }] });
    setShowNewExercise(false);
    setUseExerciseDB(false);
  };

  const handleDeleteExercise = (exIndex) => {
    if (!editData) return;
    const updated = { ...editData };
    updated.exercises = updated.exercises.filter((_, i) => i !== exIndex);
    setEditData(updated);
  };

  const handleAddSetToNew = () => {
    setNewExercise({
      ...newExercise,
      sets: [...newExercise.sets, { kg: 0, reps: 0, completed: false }]
    });
  };

  const handleRemoveSetFromNew = (setIdx) => {
    setNewExercise({
      ...newExercise,
      sets: newExercise.sets.filter((_, i) => i !== setIdx)
    });
  };

  const groupElements = sortedKeys.map(key => (
    <div key={key}>
      <div className="mb-4">
        <h2 className="text-sm font-black text-slate-300 tracking-widest">{formatMonth(key + '-01')}</h2>
        <div className="h-0.5 bg-gradient-to-r from-blue-500/50 to-transparent mt-2 rounded-full" />
      </div>
      <div className="space-y-3">
        {groups[key].map(workout => {
          const isEditing = editingId === workout.id;
          const current = isEditing ? editData : workout;

          return (
            <div key={workout.id} className={`bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-xl p-4 transition-all ui-card-mount-anim ${!isEditing ? 'hover:border-slate-600/70 hover:from-slate-800/60 hover:to-slate-900/60' : ''}`}>
              {isEditing ? (
                // Edit Mode
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <input 
                      type="text" 
                      value={current.name} 
                      onChange={(e) => setEditData({...current, name: e.target.value})}
                      className="flex-1 bg-slate-800/50 border border-slate-600/50 text-white px-4 py-2 rounded-lg text-sm font-semibold focus:border-blue-500 focus:outline-none transition"
                      placeholder="Workout name"
                    />
                    <input 
                      type="number" 
                      value={current.duration || 0}
                      onChange={(e) => setEditData({...current, duration: Number(e.target.value) || 0})}
                      className="w-24 bg-slate-800/50 border border-slate-600/50 text-white px-4 py-2 rounded-lg text-sm font-semibold focus:border-blue-500 focus:outline-none transition"
                      placeholder="min"
                    />
                  </div>
                  
                  <div className="overflow-y-auto space-y-2.5 bg-black/20 p-4 rounded-lg">
                    {current.exercises?.map((ex, exIdx) => (
                      <div key={exIdx} className="space-y-2 p-4 bg-slate-800/40 border border-slate-700/50 rounded-lg">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-bold text-white">{ex.name}</div>
                            <div className="text-xs text-slate-400">{ex.category}</div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setExpandedExerciseIdx(expandedExerciseIdx === exIdx ? null : exIdx)}
                              className="p-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg transition text-blue-400"
                              title="Add set"
                            >
                              <Plus size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteExercise(exIdx)}
                              className="p-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded-lg transition text-red-400"
                              title="Delete exercise"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        {expandedExerciseIdx === exIdx && (
                          <div className="bg-slate-900/50 p-4 rounded-lg border-l-2 border-blue-500 space-y-2">
                            <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Add set</label>
                            <div className="flex flex-col sm:flex-row gap-2 items-end">
                              <input 
                                type="number" 
                                placeholder="kg"
                                defaultValue={0}
                                onBlur={(e) => {
                                  const updated = { ...editData };
                                  updated.exercises[exIdx].sets.push({ kg: Number(e.target.value) || 0, reps: 0, completed: false });
                                  setEditData(updated);
                                  setExpandedExerciseIdx(null);
                                }}
                                className="w-full sm:flex-1 bg-slate-800/50 border border-slate-600/50 text-white px-3 py-2 rounded text-sm focus:border-blue-500 focus:outline-none"
                              />
                              <span className="hidden sm:inline text-slate-500 font-bold">×</span>
                              <span className="sm:hidden text-slate-500 font-bold text-center w-full">×</span>
                              <input 
                                type="number" 
                                placeholder="reps"
                                defaultValue={0}
                                onBlur={(e) => {
                                  const lastIdx = editData.exercises[exIdx].sets.length - 1;
                                  if (lastIdx >= 0) {
                                    const updated = { ...editData };
                                    updated.exercises[exIdx].sets[lastIdx].reps = Number(e.target.value) || 0;
                                    setEditData(updated);
                                    setExpandedExerciseIdx(null);
                                  }
                                }}
                                className="w-full sm:flex-1 bg-slate-800/50 border border-slate-600/50 text-white px-3 py-2 rounded text-sm focus:border-blue-500 focus:outline-none"
                              />
                              <button
                                onClick={() => {
                                  const updated = { ...editData };
                                  updated.exercises[exIdx].sets.push({ kg: 0, reps: 0, completed: false });
                                  setEditData(updated);
                                }}
                                className="w-full sm:w-auto px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold text-xs transition"
                              >
                                ✓
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="space-y-1.5">
                          {ex.sets?.map((set, setIdx) => (
                            <div key={setIdx} className="flex items-center gap-2 p-2 bg-slate-900/40 rounded-lg text-xs">
                              <input 
                                type="checkbox" 
                                checked={set.completed}
                                onChange={() => handleSetToggle(exIdx, setIdx)}
                                className="w-4 h-4 cursor-pointer rounded border-slate-600/50 accent-emerald-600 ui-checkbox"
                              />
                              <span className="min-w-[2rem] text-slate-400 font-bold">#{setIdx + 1}</span>
                              <input 
                                type="number" 
                                value={set.kg}
                                onChange={(e) => {
                                  const updated = { ...current };
                                  updated.exercises[exIdx].sets[setIdx].kg = Number(e.target.value) || 0;
                                  setEditData(updated);
                                }}
                                className="w-16 bg-slate-800/50 border border-slate-600/50 text-white px-2 py-1 rounded text-xs focus:border-blue-500 focus:outline-none"
                                placeholder="kg"
                              />
                              <span className="text-slate-500">×</span>
                              <input 
                                type="number" 
                                value={set.reps}
                                onChange={(e) => {
                                  const updated = { ...current };
                                  updated.exercises[exIdx].sets[setIdx].reps = Number(e.target.value) || 0;
                                  setEditData(updated);
                                }}
                                className="w-16 bg-slate-800/50 border border-slate-600/50 text-white px-2 py-1 rounded text-xs focus:border-blue-500 focus:outline-none"
                                placeholder="reps"
                              />
                              <button
                                onClick={() => handleRemoveSetFromExercise(exIdx, setIdx)}
                                className="text-red-400 hover:text-red-300 ml-auto transition"
                              >
                                <CloseIcon size={14} />
                              </button>
                              <span className={`text-xs font-bold ${set.completed ? 'text-emerald-400' : 'text-slate-600'}`}>
                                {set.completed ? '✓' : '○'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    {showNewExercise && (
                      <div className="space-y-3 p-4 bg-slate-800/40 border border-blue-500/30 rounded-lg">
                        <div className="flex gap-3 mb-2">
                          <label className="flex items-center gap-2 text-xs cursor-pointer flex-1">
                            <input 
                              type="radio" 
                              checked={!useExerciseDB}
                              onChange={() => setUseExerciseDB(false)}
                              className="w-4 h-4 cursor-pointer accent-blue-600"
                            />
                            <span className="font-semibold">New</span>
                          </label>
                          {exercisesDB.length > 0 && (
                            <label className="flex items-center gap-2 text-xs cursor-pointer flex-1">
                              <input 
                                type="radio" 
                                checked={useExerciseDB}
                                onChange={() => setUseExerciseDB(true)}
                                className="w-4 h-4 cursor-pointer accent-blue-600"
                              />
                              <span className="font-semibold">From DB</span>
                            </label>
                          )}
                        </div>

                        {!useExerciseDB ? (
                          <input 
                            type="text" 
                            value={newExercise.name}
                            onChange={(e) => setNewExercise({...newExercise, name: e.target.value})}
                            className="w-full bg-slate-800/50 border border-slate-600/50 text-white px-3 py-2 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
                            placeholder="Exercise name"
                            autoFocus
                          />
                        ) : (
                          <select
                            value={newExercise.exerciseId || ''}
                            onChange={(e) => {
                              const exId = parseInt(e.target.value);
                              const found = exercisesDB.find(ex => ex.id === exId);
                              setNewExercise({
                                exerciseId: exId,
                                name: found?.name || '',
                                category: found?.category || '',
                                sets: [{ kg: 0, reps: 0, completed: false }]
                              });
                            }}
                            className="w-full bg-slate-800/50 border border-slate-600/50 text-white px-3 py-2 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
                            autoFocus
                          >
                            <option value="">Choose exercise...</option>
                            {exercisesDB.map(ex => (
                              <option key={ex.id} value={ex.id}>
                                {ex.name} ({ex.category})
                              </option>
                            ))}
                          </select>
                        )}

                        <div className="space-y-1.5">
                          {newExercise.sets?.map((set, setIdx) => (
                            <div key={setIdx} className="flex items-center gap-2 text-xs p-2 bg-slate-900/40 rounded">
                              <span className="text-slate-400 font-bold">#{setIdx + 1}</span>
                              <input 
                                type="number" 
                                value={set.kg}
                                onChange={(e) => {
                                  const updated = [...newExercise.sets];
                                  updated[setIdx].kg = Number(e.target.value) || 0;
                                  setNewExercise({...newExercise, sets: updated});
                                }}
                                className="w-16 bg-slate-800/50 border border-slate-600/50 text-white px-2 py-1 rounded text-xs focus:border-blue-500 focus:outline-none"
                                placeholder="kg"
                              />
                              <span className="text-slate-500">×</span>
                              <input 
                                type="number" 
                                value={set.reps}
                                onChange={(e) => {
                                  const updated = [...newExercise.sets];
                                  updated[setIdx].reps = Number(e.target.value) || 0;
                                  setNewExercise({...newExercise, sets: updated});
                                }}
                                className="w-16 bg-slate-800/50 border border-slate-600/50 text-white px-2 py-1 rounded text-xs focus:border-blue-500 focus:outline-none"
                                placeholder="reps"
                              />
                              <button
                                onClick={() => handleRemoveSetFromNew(setIdx)}
                                className="text-red-400 hover:text-red-300 ml-auto transition"
                              >
                                <CloseIcon size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                        <button 
                          onClick={handleAddSetToNew}
                          className="w-full text-xs px-3 py-2 rounded bg-slate-800/50 border border-slate-600/50 text-slate-300 hover:text-white transition font-semibold"
                        >
                          + Set
                        </button>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              setShowNewExercise(false);
                              setNewExercise({ exerciseId: null, name: '', category: '', sets: [{ kg: 0, reps: 0, completed: false }] });
                              setUseExerciseDB(false);
                            }}
                            className="flex-1 text-xs px-3 py-2 rounded bg-slate-800/50 border border-slate-600/50 text-white hover:bg-slate-700/50 transition font-semibold"
                          >
                            Cancel
                          </button>
                          <button 
                            onClick={handleAddExercise}
                            disabled={useExerciseDB ? !newExercise.exerciseId : !newExercise.name.trim()}
                            className="flex-1 text-xs px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition font-bold"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                    <button 
                    onClick={() => setShowNewExercise(!showNewExercise)}
                    disabled={showNewExercise}
                    className="w-full text-xs px-4 py-2 rounded-lg bg-slate-800/50 border border-blue-500/30 text-blue-400 hover:bg-slate-700/50 hover:border-blue-500/50 disabled:opacity-50 flex items-center justify-center gap-2 transition font-semibold"
                  >
                    <Plus size={14} /> Add Exercise
                  </button>

                  <textarea 
                    value={current.note || ''}
                    onChange={(e) => setEditData({...current, note: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-600/50 text-white px-4 py-2 rounded-lg text-sm resize-none focus:border-blue-500 focus:outline-none transition"
                    placeholder="Workout notes..."
                    rows={2}
                  />

                  {/* Tags Section */}
                  <div>
                    <p className="text-xs text-slate-400 font-semibold tracking-widest mb-2">TAGS</p>
                    <div className="flex flex-wrap gap-2">
                      {['#cut', '#power', '#volume', '#sleep-bad', '#bulk', '#stress'].map(tag => (
                        <button
                          key={tag}
                          onClick={() => {
                            const updated = { ...current };
                            const currentTags = updated.tags || [];
                            if (currentTags.includes(tag)) {
                              updated.tags = currentTags.filter(t => t !== tag);
                            } else {
                              updated.tags = [...currentTags, tag];
                            }
                            setEditData(updated);
                          }}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                            (current.tags || []).includes(tag)
                              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                              : 'bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-slate-300'
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={handleEditCancel}
                      className="flex-1 px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white text-sm hover:bg-slate-700/50 transition font-semibold"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleEditSave}
                      className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm transition font-bold shadow-lg shadow-emerald-600/30"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                // View Mode - Use memoized WorkoutCard component
                <WorkoutCard
                  workout={workout}
                  onViewDetail={() => onViewWorkoutDetail(workout.date)}
                  onEdit={() => handleEditStart(workout)}
                  onDelete={() => onDeleteWorkout && onDeleteWorkout(workout.id)}
                  showActions={true}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  ));

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Header */}
      <div className="bg-gradient-to-b from-black to-black/80 border-b border-white/10 p-4 sticky top-0 z-20">
        <h1 className="text-4xl font-black">HISTORY</h1>
        <p className="text-xs text-slate-400 mt-2 font-semibold tracking-widest">YOUR WORKOUT LOG</p>
        
        {/* Smart Filters */}
        <div className="flex gap-2 mt-4 overflow-x-auto pb-2 no-scrollbar">
          {[
            { id: 'all', label: 'All' },
            { id: 'pr', label: '🏆 PR' },
            { id: 'heavy', label: '💪 Heavy' },
            { id: 'light', label: '🌱 Light' }
          ].map(filterItem => (
            <button
              key={filterItem.id}
              onClick={() => onFilterChange && onFilterChange(filterItem.id)}
              className={`text-xs font-bold px-4 py-2 rounded-full transition-all whitespace-nowrap ${
                (filter || 'all') === filterItem.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/50'
                  : 'bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-slate-300'
              }`}
            >
              {filterItem.label}
            </button>
          ))}
        </div>
        
        {/* Tag Filters */}
        <div className="relative mt-3" ref={tagDropdownRef}>
          <button
            onClick={() => setShowTagDropdown(!showTagDropdown)}
            className="w-full bg-slate-800/50 border border-slate-600/50 hover:bg-slate-700/50 text-white rounded-lg px-4 py-3 text-sm font-bold flex items-center justify-between transition"
          >
            <span>Tags: {tagFilter || 'All'}</span>
            <span className={`text-xs transition-transform ${showTagDropdown ? 'rotate-180' : ''}`}>▾</span>
          </button>
          {showTagDropdown && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900/95 border border-slate-700/50 rounded-lg shadow-lg z-50">
              <button
                onClick={() => {
                  setTagFilter(null);
                  setShowTagDropdown(false);
                }}
                className={`w-full text-left px-4 py-3 text-sm font-semibold transition-colors ${
                  tagFilter === null
                    ? 'bg-blue-600/30 text-white'
                    : 'text-slate-300 hover:bg-slate-800/50'
                }`}
              >
                All
              </button>
              {['#cut', '#power', '#volume', '#sleep-bad', '#bulk', '#stress'].map(tag => (
                <button
                  key={tag}
                  onClick={() => {
                    setTagFilter(tag);
                    setShowTagDropdown(false);
                  }}
                  className={`w-full text-left px-4 py-3 text-sm font-semibold transition-colors ${
                    tagFilter === tag
                      ? 'bg-blue-600/30 text-white'
                      : 'text-slate-300 hover:bg-slate-800/50'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 space-y-6">
        {filteredWorkouts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-400 text-sm font-semibold">
              {(filter || 'all') === 'all' ? 'No workouts yet' : 'No workouts match this filter'}
            </p>
            <p className="text-slate-600 text-xs mt-2">
              {(filter || 'all') === 'all' ? 'Start your first workout to see it here' : 'Try a different filter'}
            </p>
          </div>
        ) : (
          groupElements
        )}
      </div>
    </div>
  );
};