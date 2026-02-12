import React, { createContext, useContext, useState, useCallback } from 'react';
import {
  calculateMuscleDistribution,
  prepareCleanWorkoutData,
  compareWorkoutToPrevious,
  generateSessionFeedback,
  detectPRsInWorkout,
} from '../domain/workouts';
import {
  getExerciseRecords,
  checkSetRecords,
  getLastCompletedSets,
  suggestNextWeight,
} from '../domain/exercises';
import { calculate1RM } from '../domain/calculations';

export const WorkoutContext = createContext();

export const WorkoutProvider = ({ children }) => {
  // Workout Data State
  const [workouts, setWorkouts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [exercisesDB, setExercisesDB] = useState([]);
  const [activeWorkout, setActiveWorkout] = useState(null);
  const [workoutTimer, setWorkoutTimer] = useState(0);
  const [isWorkoutMinimized, setIsWorkoutMinimized] = useState(false);
  const [selectedTags, setSelectedTags] = useState([]);
  const [deletedWorkout, setDeletedWorkout] = useState(null);
  const [pendingSummary, setPendingSummary] = useState(null);

  // --- EXERCISES HANDLERS ---

  const handleSaveExercise = useCallback((exercise) => {
    let newExerciseId;
    if (exercise.id) {
      setExercisesDB(exercisesDB.map(e => e.id === exercise.id ? exercise : e));
      newExerciseId = exercise.id;
    } else {
      newExerciseId = Date.now();
      setExercisesDB([...exercisesDB, { ...exercise, id: newExerciseId }]);
    }
    return newExerciseId;
  }, [exercisesDB]);

  const handleDeleteExerciseFromDB = useCallback((id) => {
    if (confirm('Delete this exercise? History will remain.')) {
      setExercisesDB(exercisesDB.filter(e => e.id !== id));
    }
  }, [exercisesDB]);

  const handleToggleFavorite = useCallback((exerciseId) => {
    setExercisesDB(prev => prev.map(ex => 
      ex.id === exerciseId ? { ...ex, isFavorite: !ex.isFavorite } : ex
    ));
  }, []);

  // --- WORKOUT HANDLERS ---

  const handleStartWorkout = useCallback((template) => {
    setActiveWorkout({
      templateId: template.id,
      name: template.name,
      note: '',
      date: new Date().toISOString().split('T')[0],
      startTime: new Date().toISOString(),
      exercises: template.exercises.map(ex => ({
        exerciseId: exercisesDB.find(e => e.name === ex.name)?.id || null,
        name: ex.name,
        category: ex.category,
        sets: ex.sets.map(set => ({ ...set, completed: false }))
      })),
      templateSnapshot: JSON.parse(JSON.stringify(template))
    });
    setWorkoutTimer(0);
  }, [exercisesDB]);

  const computeTemplateDiff = (template, workout) => {
    const tEx = template?.exercises || [];
    const wEx = workout?.exercises || [];
    const reasons = [];

    const tNames = tEx.map(e => e.name);
    const wNames = wEx.map(e => e.name);

    const added = wNames.filter(n => !tNames.includes(n));
    const removed = tNames.filter(n => !wNames.includes(n));
    if (added.length) reasons.push(`Added: ${added.join(', ')}`);
    if (removed.length) reasons.push(`Removed: ${removed.join(', ')}`);

    const sameOrder = tNames.length === wNames.length && tNames.every((n, i) => n === wNames[i]);
    if (!sameOrder && added.length === 0 && removed.length === 0) reasons.push('Order or exercise names changed');

    tEx.forEach((te) => {
      const wi = wEx.find(we => we.name === te.name);
      if (wi) {
        const ts = te.sets?.length || 0;
        const ws = wi.sets?.length || 0;
        if (ts !== ws) reasons.push(`Sets changed for ${wi.name} (${ts} → ${ws})`);
      }
    });

    if (reasons.length === 0) return { changed: false, reasons: [] };
    return { changed: true, reasons };
  };

  const calcSummaryMetrics = (workout, userWeight) => {
    const duration = Math.floor((new Date() - new Date(workout.startTime)) / 60000);
    let volume = 0;
    let setsDone = 0;
    const muscleTotals = {};
    (workout.exercises || []).forEach(ex => {
      (ex.sets || []).forEach(s => {
        if (s.completed) {
          const baseKg = Number(s.kg) || 0;
          const exDef = exercisesDB.find(d => d.id === ex.exerciseId) || {};
          const kg = baseKg + ((exDef.usesBodyweight && userWeight) ? Number(userWeight) : 0);
          const reps = Number(s.reps) || 0;
          const v = kg * reps;
          volume += v;
          setsDone += 1;
          const cat = ex.category || 'other';
          muscleTotals[cat] = (muscleTotals[cat] || 0) + v;
        }
      });
    });
    return { duration, volume, setsDone, muscleTotals };
  };

  const handleFinishWorkout = useCallback((userWeight, enablePerformanceAlerts) => {
    if (!activeWorkout) return null;
    const completedWorkout = { 
      ...activeWorkout, 
      id: Date.now(), 
      date: new Date().toISOString().split('T')[0], 
      tags: [] 
    };
    const template = templates.find(t => t.id === activeWorkout.templateId);
    const baseTemplate = template || activeWorkout.templateSnapshot || null;
    const diff = baseTemplate ? computeTemplateDiff(baseTemplate, activeWorkout) : { changed: true, reasons: ['No template associated for this workout'] };
    const metrics = calcSummaryMetrics(completedWorkout, userWeight);
    completedWorkout.duration = metrics.duration;
    const muscleTotals = calculateMuscleDistribution(completedWorkout, exercisesDB);
    
    const cleanData = prepareCleanWorkoutData(completedWorkout, exercisesDB);
    const comparison = compareWorkoutToPrevious(completedWorkout, workouts);
    const feedback = generateSessionFeedback(cleanData.totalVolume, cleanData.completedSets, comparison?.trend || '→');
    
    const prStatus = detectPRsInWorkout(completedWorkout, workouts, calculate1RM, getExerciseRecords);
    const hasPR = Object.keys(prStatus).length > 0;
    
    setSelectedTags([]);
    setPendingSummary({ 
      completedWorkout: { ...completedWorkout, prStatus, hasPR }, 
      templateId: template?.id || null, 
      diff, 
      metrics: { ...metrics, muscleTotals },
      cleanData,
      comparison,
      feedback
    });
    
    return {
      completedWorkout: { ...completedWorkout, prStatus, hasPR }, 
      templateId: template?.id || null, 
      diff, 
      metrics: { ...metrics, muscleTotals },
      cleanData,
      comparison,
      feedback
    };
  }, [activeWorkout, templates, workouts, exercisesDB]);

  const handleMinimizeWorkout = useCallback(() => {
    setIsWorkoutMinimized(true);
  }, []);

  const handleMaximizeWorkout = useCallback(() => {
    setIsWorkoutMinimized(false);
  }, []);

  const handleCancelWorkout = useCallback(() => {
    if (confirm('Cancel this workout? Progress will be lost.')) {
      setActiveWorkout(null);
      setWorkoutTimer(0);
      setIsWorkoutMinimized(false);
    }
  }, []);

  // --- ACTIVE WORKOUT MODIFICATIONS ---

  const handleUpdateSet = useCallback((exIndex, setIndex, field, value, userWeight, enablePerformanceAlerts) => {
    const updated = {
      ...activeWorkout,
      exercises: activeWorkout.exercises.map((ex, idx) => {
        if (idx !== exIndex) return ex;
        return {
          ...ex,
          sets: ex.sets.map((set, sidx) => {
            if (sidx !== setIndex) return set;
            return { ...set, [field]: value };
          })
        };
      })
    };
    setActiveWorkout(updated);

    const exId = updated.exercises[exIndex].exerciseId;
    const isCompleted = updated.exercises[exIndex].sets[setIndex].completed;
    if (exId && isCompleted) {
      const kg = Number(updated.exercises[exIndex].sets[setIndex].kg) || 0;
      const reps = Number(updated.exercises[exIndex].sets[setIndex].reps) || 0;
      
      const tempWorkout = { ...updated };
      const prStatus = detectPRsInWorkout(tempWorkout, workouts, calculate1RM, getExerciseRecords);
      
      if (prStatus[exId]?.recordsPerSet?.[setIndex]) {
        const recordTypes = prStatus[exId].recordsPerSet[setIndex];
        updated.exercises[exIndex].sets[setIndex].isBest1RM = recordTypes.includes('best1RM');
        updated.exercises[exIndex].sets[setIndex].isBestSetVolume = recordTypes.includes('bestSetVolume');
        updated.exercises[exIndex].sets[setIndex].isHeaviestWeight = recordTypes.includes('heaviestWeight');
      } else {
        updated.exercises[exIndex].sets[setIndex].isBest1RM = false;
        updated.exercises[exIndex].sets[setIndex].isBestSetVolume = false;
        updated.exercises[exIndex].sets[setIndex].isHeaviestWeight = false;
      }
      
      setActiveWorkout(updated);
      
      const hist = getExerciseRecords(exId, workouts);
      const histBest = hist.best1RM || 0;
      const this1RM = calculate1RM(kg, reps);
      if (this1RM > histBest) {
        setExercisesDB(prev => prev.map(e => e.id === exId ? { ...e, defaultSets: [{ kg, reps }, ...(e.defaultSets || []).slice(1)] } : e));
        if (navigator.vibrate) navigator.vibrate(20);
      }
    }
  }, [activeWorkout, workouts]);

  const handleToggleSet = useCallback((exIndex, setIndex, enablePerformanceAlerts, enableHapticFeedback, showToast) => {
    const updated = {
      ...activeWorkout,
      exercises: activeWorkout.exercises.map((ex, idx) => {
        if (idx !== exIndex) return ex;
        return {
          ...ex,
          sets: ex.sets.map((set, sidx) => {
            if (sidx !== setIndex) return set;
            
            const newVal = !set.completed;
            let updatedSet = { ...set, completed: newVal };
            
            if (newVal && !set.completed) {
              const kg = Number(set.kg) || 0;
              const reps = Number(set.reps) || 0;
              const suggestedKg = Number(set.suggestedKg) || 0;
              const suggestedReps = Number(set.suggestedReps) || 0;
              
              if (kg === 0 && reps === 0 && suggestedKg === 0 && suggestedReps === 0) {
                showToast('Please enter kg and reps');
                return set;
              }
              
              if (kg === 0 && reps === 0 && (suggestedKg > 0 || suggestedReps > 0)) {
                updatedSet.kg = suggestedKg;
                updatedSet.reps = suggestedReps;
              } else if (kg === 0 || reps === 0) {
                if (kg === 0) updatedSet.kg = suggestedKg;
                if (reps === 0) updatedSet.reps = suggestedReps;
              }
            }
            
            if (!newVal) {
              updatedSet.isBest1RM = false;
              updatedSet.isBestSetVolume = false;
              updatedSet.isHeaviestWeight = false;
            }
            
            return updatedSet;
          })
        };
      })
    };
    
    setActiveWorkout(updated);

    const set = updated.exercises[exIndex].sets[setIndex];
    if (set.completed) {
      const exId = updated.exercises[exIndex].exerciseId;
      const exerciseName = updated.exercises[exIndex].name;
      if (exId) {
        const kg = Number(set.kg) || 0;
        const reps = Number(set.reps) || 0;
        if (kg > 0 && reps > 0 && !set.warmup) {
          const this1RM = calculate1RM(kg, reps);
          const hist = getExerciseRecords(exId, workouts);
          const histBest = hist?.best1RM || 0;
          if (this1RM > histBest) {
            setExercisesDB(prev => prev.map(e => e.id === exId ? { ...e, defaultSets: [{ kg, reps }, ...(e.defaultSets || []).slice(1)] } : e));
          }

          if (enablePerformanceAlerts) {
            const prRecords = checkSetRecords(kg, reps, hist, calculate1RM);
            if (prRecords.isBest1RM || prRecords.isBestSetVolume || prRecords.isHeaviestWeight) {
              const recordTypes = [];
              if (prRecords.isHeaviestWeight) recordTypes.push('heaviestWeight');
              if (prRecords.isBestSetVolume) recordTypes.push('bestSetVolume');
              if (prRecords.isBest1RM) recordTypes.push('best1RM');
              
              set.isBest1RM = prRecords.isBest1RM;
              set.isBestSetVolume = prRecords.isBestSetVolume;
              set.isHeaviestWeight = prRecords.isHeaviestWeight;
              
              if (enableHapticFeedback && navigator.vibrate) {
                navigator.vibrate([20, 10, 20]);
              }
            }
          }
        }
      }

      if (activeWorkout.exercises[exIndex].supersetId) {
        const supersetId = activeWorkout.exercises[exIndex].supersetId;
        let nextExIndex = -1;
        
        for (let i = exIndex + 1; i < activeWorkout.exercises.length; i++) {
          if (activeWorkout.exercises[i].supersetId === supersetId) {
            nextExIndex = i;
            break;
          }
        }
        
        if (nextExIndex === -1) {
          for (let i = 0; i < exIndex; i++) {
            if (activeWorkout.exercises[i].supersetId === supersetId) {
              nextExIndex = i;
              break;
            }
          }
        }
        
        if (nextExIndex !== -1) {
          setTimeout(() => {
            const element = document.querySelector(`[data-exercise-index="${nextExIndex}"]`);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 100);
        }
      }
    }
  }, [activeWorkout, workouts]);

  const handleAddSet = useCallback((exIndex) => {
    const updated = {
      ...activeWorkout,
      exercises: activeWorkout.exercises.map((ex, idx) => {
        if (idx !== exIndex) return ex;
        const lastSet = ex.sets.at(-1) || { kg: 0, reps: 0 };
        return {
          ...ex,
          sets: [...ex.sets, { ...lastSet, completed: false }]
        };
      })
    };
    setActiveWorkout(updated);
  }, [activeWorkout]);

  const handleAddWarmupSet = useCallback((exIndex) => {
    const updated = { ...activeWorkout };
    const firstSet = updated.exercises[exIndex].sets[0] || { kg: 0, reps: 0 };
    updated.exercises[exIndex].sets = [{ ...firstSet, completed: false, warmup: true }, ...updated.exercises[exIndex].sets];
    setActiveWorkout(updated);
  }, [activeWorkout]);

  const handleDeleteSet = useCallback((exIndex, setIndex) => {
    const updated = { ...activeWorkout };
    if (updated.exercises[exIndex] && updated.exercises[exIndex].sets[setIndex]) {
      updated.exercises[exIndex].sets.splice(setIndex, 1);
      setActiveWorkout(updated);
    }
  }, [activeWorkout]);

  const handleToggleWarmup = useCallback((exIndex, setIndex) => {
    const updated = { ...activeWorkout };
    const set = updated.exercises[exIndex].sets[setIndex];
    if (set) {
      set.warmup = !set.warmup;
      setActiveWorkout(updated);
    }
  }, [activeWorkout]);

  const handleAddNote = useCallback(() => {
    const note = prompt("Workout Note:", activeWorkout.note);
    if (note !== null) setActiveWorkout({ ...activeWorkout, note });
  }, [activeWorkout]);

  const handleAddExerciseNote = useCallback((exIndex, note) => {
    const exercise = activeWorkout?.exercises[exIndex];
    if (exercise?.exerciseId) {
      const updatedDB = exercisesDB.map(ex => 
        ex.id === exercise.exerciseId ? { ...ex, note: note } : ex
      );
      setExercisesDB(updatedDB);
    }
  }, [activeWorkout, exercisesDB]);

  const handleDeleteExercise = useCallback((exIndex) => {
    if (confirm('Delete this exercise?')) {
      const updated = { ...activeWorkout };
      const deletedSupersetId = updated.exercises[exIndex].supersetId;
      updated.exercises.splice(exIndex, 1);
      
      if (deletedSupersetId) {
        updated.exercises = updated.exercises.map(ex => 
          ex.supersetId === deletedSupersetId ? { ...ex, supersetId: null } : ex
        );
      }
      
      setActiveWorkout(updated);
    }
  }, [activeWorkout]);

  const handleReorderExercises = useCallback((newOrder) => {
    const updated = { ...activeWorkout };
    updated.exercises = newOrder;
    setActiveWorkout(updated);
  }, [activeWorkout]);

  const handleReplaceExercise = useCallback((exIndex, newExercise) => {
    const lastSets = getLastCompletedSets(newExercise.id, workouts);
    const suggested = suggestNextWeight(lastSets);
    
    let sets;
    if (lastSets.length > 0) {
      sets = lastSets.map(s => ({ kg: Number(s.kg) || 0, reps: Number(s.reps) || 0, completed: false }));
      if (suggested) {
        sets = [...sets, { kg: suggested.suggestedKg, reps: suggested.suggestedReps, completed: false }];
      }
    } else {
      sets = newExercise.defaultSets ? [...newExercise.defaultSets] : [{ kg: 0, reps: 0 }];
      sets = sets.map(s => ({ ...s, completed: false }));
    }
    
    const updated = { ...activeWorkout };
    const exData = {
      exerciseId: newExercise.id,
      name: newExercise.name,
      category: newExercise.category,
      sets: sets,
      exerciseNote: ''
    };
    updated.exercises[exIndex] = exData;
    setActiveWorkout(updated);
  }, [activeWorkout, workouts]);

  // --- SUPERSET HANDLERS ---

  const handleCreateSuperset = useCallback((exIndex1, exIndex2) => {
    const updated = { ...activeWorkout };
    const supersetId = `superset_${Date.now()}`;
    updated.exercises[exIndex1].supersetId = supersetId;
    updated.exercises[exIndex2].supersetId = supersetId;
    setActiveWorkout(updated);
  }, [activeWorkout]);

  const handleRemoveSuperset = useCallback((exIndex) => {
    const updated = { ...activeWorkout };
    const supersetId = updated.exercises[exIndex].supersetId;
    
    if (supersetId) {
      updated.exercises = updated.exercises.map(ex => 
        ex.supersetId === supersetId ? { ...ex, supersetId: null } : ex
      );
    }
    
    setActiveWorkout(updated);
  }, [activeWorkout]);

  // --- TEMPLATES ---
  // Note: Template handlers (save/delete) are in App.jsx since they depend on UIContext (editingTemplate)

  // --- DATA PERSISTENCE ---

  const handleSaveWorkout = useCallback((workout) => {
    setWorkouts([...workouts, workout]);
    setActiveWorkout(null);
    setWorkoutTimer(0);
    setIsWorkoutMinimized(false);
  }, [workouts]);

  const handleUpdateWorkout = useCallback((id, updates) => {
    setWorkouts(workouts.map(w => w.id === id ? { ...w, ...updates } : w));
  }, [workouts]);

  const handleDeleteWorkout = useCallback((id) => {
    const workout = workouts.find(w => w.id === id);
    setWorkouts(workouts.filter(w => w.id !== id));
    setDeletedWorkout(workout);
  }, [workouts]);

  const value = {
    // State
    workouts,
    setWorkouts,
    templates,
    setTemplates,
    exercisesDB,
    setExercisesDB,
    activeWorkout,
    setActiveWorkout,
    workoutTimer,
    setWorkoutTimer,
    isWorkoutMinimized,
    setIsWorkoutMinimized,
    selectedTags,
    setSelectedTags,
    deletedWorkout,
    setDeletedWorkout,
    pendingSummary,
    setPendingSummary,
    
    // Exercises handlers
    handleSaveExercise,
    handleDeleteExerciseFromDB,
    handleToggleFavorite,
    
    // Workout handlers
    handleStartWorkout,
    handleFinishWorkout,
    handleMinimizeWorkout,
    handleMaximizeWorkout,
    handleCancelWorkout,
    
    // Active workout modifications
    handleUpdateSet,
    handleToggleSet,
    handleAddSet,
    handleAddWarmupSet,
    handleDeleteSet,
    handleToggleWarmup,
    handleAddNote,
    handleAddExerciseNote,
    handleDeleteExercise,
    handleReorderExercises,
    handleReplaceExercise,
    
    // Superset handlers
    handleCreateSuperset,
    handleRemoveSuperset,
    
    // Data persistence
    handleSaveWorkout,
    handleUpdateWorkout,
    handleDeleteWorkout,
  };

  return (
    <WorkoutContext.Provider value={value}>
      {children}
    </WorkoutContext.Provider>
  );
};

export const useWorkouts = () => {
  const context = useContext(WorkoutContext);
  if (!context) {
    throw new Error('useWorkouts must be used within WorkoutProvider');
  }
  return context;
};
