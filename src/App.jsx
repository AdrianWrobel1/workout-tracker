import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';

// DOMAIN
import { calculate1RM } from './domain/calculations';
import { getExerciseRecords, getLastCompletedSets, suggestNextWeight, checkSetRecords } from './domain/exercises';
import { prepareCleanWorkoutData, compareWorkoutToPrevious, generateSessionFeedback, calculateMuscleDistribution, detectPRsInWorkout } from './domain/workouts';

// HOOKS
import { useDebouncedLocalStorage, useDebouncedLocalStorageManual } from './hooks/useLocalStorage';
import { useIndexedDBStore, useIndexedDBSetting, useIndexedDBDirect } from './hooks/useIndexedDB';
import { useRecordsIndex } from './hooks/useRecordsIndex';
import { useModals } from './contexts/ModalContext';
import { useWorkouts, useUI, useSettings } from './contexts/index.js';

// SERVICES
import { storage, STORES } from './services/storageService';

// COMPONENTS
import { MiniWorkoutBar } from './components/MiniWorkoutBar';
import { BottomNav } from './components/BottomNav';
import { CalendarModal } from './components/CalendarModal';
import { ExerciseSelectorModal } from './components/ExerciseSelectorModal';
import { CustomKeypad } from './components/CustomKeypad';
import { PRBanner } from './components/PRBanner';

// VIEWS
import { HomeView } from './views/HomeView';
import { ActiveWorkoutView } from './views/ActiveWorkoutView';
import { SelectTemplateView } from './views/SelectTemplateView';
import { TemplatesView } from './views/TemplatesView';
import { ExercisesView } from './views/ExercisesView';
import { CreateExerciseView } from './views/CreateExerciseView';
import { ExerciseDetailView } from './views/ExerciseDetailView';
import { HistoryView } from './views/HistoryView';
import { WorkoutDetailView } from './views/WorkoutDetailView';
import { ProfileView } from './views/ProfileView';
import { ProfileStatisticsView } from './views/ProfileStatisticsView';
import { ProfileCalendarView } from './views/ProfileCalendarView';
import { SettingsView } from './views/SettingsView';
import { MonthlyProgressView } from './views/MonthlyProgressView';
import { ExportDataView } from './views/ExportDataView';


export default function App() {
  // --- CONTEXT HOOKS ---
  const {
    workouts, setWorkouts,
    templates, setTemplates,
    exercisesDB, setExercisesDB,
    activeWorkout, setActiveWorkout,
    workoutTimer, setWorkoutTimer,
    isWorkoutMinimized, setIsWorkoutMinimized,
    selectedTags, setSelectedTags,
    deletedWorkout, setDeletedWorkout,
    pendingSummary, setPendingSummary,
  } = useWorkouts();

  const {
    view, setView,
    activeTab, setActiveTab,
    editingTemplate, setEditingTemplate,
    editingExercise, setEditingExercise,
    activeInput, setActiveInput,
    keypadValue, setKeypadValue,
    selectorMode, setSelectorMode,
    historyFilter, setHistoryFilter,
    profileSubview, setProfileSubview,
    selectedDate, setSelectedDate,
    selectedExerciseId, setSelectedExerciseId,
    monthOffset, setMonthOffset,
    exerciseCreateSource, setExerciseCreateSource,
    finishingWorkout, setFinishingWorkout,
    firstLoad, setFirstLoad,
    exportType, setExportType,
    exportPeriod, setExportPeriod,
    exportStartDate, setExportStartDate,
    exportEndDate, setExportEndDate,
    exportExerciseId, setExportExerciseId,
  } = useUI();

  const {
    userWeight, setUserWeight,
    weeklyGoal, setWeeklyGoal,
    defaultStatsRange, setDefaultStatsRange,
    trainingNotes, setTrainingNotes,
    enablePerformanceAlerts, setEnablePerformanceAlerts,
    enableHapticFeedback, setEnableHapticFeedback,
    activePRBanner, setActivePRBanner,
    prBannerVisible, setPRBannerVisible,
  } = useSettings();

  // --- CONTEXT ---
  const { showCalendar, closeCalendar, openCalendar, showExerciseSelector, closeExerciseSelector, openExerciseSelector, showExportModal, closeExportModal } = useModals();

  // --- HOOKS ---
  const { recordsIndex, updateRecordForExercise, updateRecordsForExercises, rebuildIndex, getRecords, clearCache } = useRecordsIndex();

  // --- LOCAL STATE ---
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [toast, setToast] = useState(null);
  const [returnTo, setReturnTo] = useState(null);
  const [selectedExerciseIndex, setSelectedExerciseIndex] = useState(null);
  
  // Undo deleted workout
  const undoTimeoutRef = useRef(null);

  // Initialize accent color from localStorage on app startup
  useEffect(() => {
    const accentColor = localStorage.getItem('accentColor') || '#4f46e5'; // Default Indigo accent
    document.documentElement.style.setProperty('--accent', accentColor);
  }, []);

  // P6 FIX: Clear keypad state when view changes to prevent stale values on reopening
  useEffect(() => {
    setActiveInput(null);
    setKeypadValue('');
  }, [view]);

  // Initialize IndexedDB and load data
  useEffect(() => {
    (async () => {
      try {
        // Initialize IndexedDB
        await storage.init();
        
        // Migrate from localStorage on first run
        const migrated = await storage.migrateFromLocalStorage();
        if (migrated.migratedWorkouts > 0) {
          console.log(`✓ Migrated ${migrated.migratedWorkouts} workouts from localStorage`);
        }

        // Load entities from IndexedDB
        const exercises = await storage.getAllFromStore(STORES.EXERCISES);
        const workouts = await storage.getAllFromStore(STORES.WORKOUTS);
        const templates = await storage.getAllFromStore(STORES.TEMPLATES);

        setExercisesDB(exercises || []);
        setWorkouts(workouts || []);
        setTemplates(templates || []);

        // Load settings
        const goal = await storage.getSetting('weeklyGoal', 4);
        const statsRange = await storage.getSetting('defaultStatsRange', '12m');
        const weight = await storage.getSetting('userWeight', null);
        const enableAlerts = await storage.getSetting('enablePerformanceAlerts', true);
        const enableHaptic = await storage.getSetting('enableHapticFeedback', false);
        const notes = await storage.getSetting('trainingNotes', '');

        setWeeklyGoal(parseInt(goal) || 4);
        setDefaultStatsRange(statsRange || '12m');
        setUserWeight(Number(weight) || null);
        setEnablePerformanceAlerts(enableAlerts !== null ? enableAlerts : true);
        setEnableHapticFeedback(enableHaptic !== null ? enableHaptic : false);
        setTrainingNotes(typeof notes === 'string' ? notes : '');

        // Load active workout if within 24h
        const activeWO = await storage.get(STORES.WORKOUTS, 'activeWorkout');
        if (activeWO && activeWO.startTime) {
          if (new Date() - new Date(activeWO.startTime) < 86400000) {
            setActiveWorkout(activeWO);
            setView('activeWorkout');
          }
        }

        console.log('✓ Data loaded from IndexedDB');
      } catch (error) {
        console.error('Error initializing storage:', error);
      }
    })();
  }, []);

  // initial skeleton (cold start): show for ~350ms
  useEffect(() => {
    const t = setTimeout(() => setFirstLoad(false), 350);
    return () => clearTimeout(t);
  }, []);

  // Save Data (debounced to prevent excessive localStorage writes)
  // Persist data to IndexedDB (async, non-blocking)
  useIndexedDBStore(STORES.EXERCISES, exercisesDB, 200);
  useIndexedDBStore(STORES.WORKOUTS, workouts, 200);
  useIndexedDBStore(STORES.TEMPLATES, templates, 200);
  
  // Persist settings (smaller payloads, can use settings API)
  useIndexedDBSetting('userWeight', userWeight, 300);
  useIndexedDBSetting('defaultStatsRange', defaultStatsRange, 300);
  useIndexedDBSetting('trainingNotes', trainingNotes, 500);
  useIndexedDBSetting('enablePerformanceAlerts', enablePerformanceAlerts, 500);
  useIndexedDBSetting('enableHapticFeedback', enableHapticFeedback, 500);
  
  // activeWorkout requires immediate async save (no debounce for critical data)
  const { saveAsync } = useIndexedDBDirect();
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (activeWorkout) {
        saveAsync(STORES.WORKOUTS, { ...activeWorkout, id: 'activeWorkout' });
      }
    }, 100); // Small debounce to batch rapid updates
    return () => clearTimeout(timeoutId);
  }, [activeWorkout, saveAsync]);

  // Timer
  useEffect(() => {
    let interval;
    if (activeWorkout) {
      interval = setInterval(() => {
        setWorkoutTimer(Math.floor((new Date() - new Date(activeWorkout.startTime)) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeWorkout]);

  // --- ACTIONS: EXERCISES ---

  // Animate summary card on mount (subtle fade+scale)
  useEffect(() => {
    if (pendingSummary) {
      setSummaryVisible(false);
      const t = setTimeout(() => setSummaryVisible(true), 30);
      return () => clearTimeout(t);
    } else {
      setSummaryVisible(false);
    }
  }, [pendingSummary]);

  const handleSaveExercise = useCallback((exercise) => {
    let newExerciseId;
    if (exercise.id) {
      setExercisesDB(exercisesDB.map(e => e.id === exercise.id ? exercise : e));
      newExerciseId = exercise.id;
    } else {
      newExerciseId = Date.now();
      setExercisesDB([...exercisesDB, { ...exercise, id: newExerciseId }]);
    }

    // If exercise was created from activeWorkout, add it and return
    if (exerciseCreateSource === 'activeWorkout' && activeWorkout) {
      const newExercise = { 
        exerciseId: newExerciseId, 
        name: exercise.name, 
        category: exercise.category,
        sets: exercise.defaultSets?.map(s => ({ kg: 0, reps: 0, completed: false, warmup: false })) || [{ kg: 0, reps: 0, completed: false, warmup: false }]
      };
      setActiveWorkout({
        ...activeWorkout,
        exercises: [...(activeWorkout.exercises || []), newExercise]
      });
      setExerciseCreateSource(null);
      setEditingExercise(null);
      setView('activeWorkout');
    } else {
      setExerciseCreateSource(null);
      setView('exercises');
      setEditingExercise(null);
    }
  }, [exercisesDB, exerciseCreateSource, activeWorkout]);

  const handleDeleteExerciseFromDB = useCallback((id) => {
    if (confirm('Delete this exercise? History will remain.')) {
      setExercisesDB(exercisesDB.filter(e => e.id !== id));
    }
  }, [exercisesDB]);

  // --- ACTIONS: WORKOUTS ---

  const handleStartWorkout = useCallback((template) => {
    setActiveWorkout({
      templateId: template.id,
      name: template.name,
      note: '',
      date: new Date().toISOString().split('T')[0],
      startTime: new Date().toISOString(),
      exercises: template.exercises.map(ex => ({
        // Mapujemy nazwę na ID jeśli możliwe, dla spójności
        exerciseId: exercisesDB.find(e => e.name === ex.name)?.id || null,
        name: ex.name,
        category: ex.category,
        sets: ex.sets.map(set => ({ ...set, completed: false }))
      }))
    ,
    // keep snapshot of template at start so diff can be computed even if templates change
    templateSnapshot: JSON.parse(JSON.stringify(template))
    });
    setWorkoutTimer(0);
    setView('activeWorkout');
    setActiveTab('home');
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

    // Check sets differences per matching exercise names
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

  const calcSummaryMetrics = (workout) => {
    const duration = Math.floor((new Date() - new Date(workout.startTime)) / 60000);
    let volume = 0;
    let setsDone = 0;
    const muscleTotals = {}; // category -> volume
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

  // Compute muscle totals following provided logic (use ALL sets, not only completed)
  const computeMuscleTotals = (workout) => {
    return calculateMuscleDistribution(workout, exercisesDB);
  };

  const handleFinishWorkout = useCallback(() => {
    if (!activeWorkout) return;
    const completedWorkout = { ...activeWorkout, id: Date.now(), date: new Date().toISOString().split('T')[0], tags: [] };
    const template = templates.find(t => t.id === activeWorkout.templateId);
    const baseTemplate = template || activeWorkout.templateSnapshot || null;
    const diff = baseTemplate ? computeTemplateDiff(baseTemplate, activeWorkout) : { changed: true, reasons: ['No template associated for this workout'] };
    const metrics = calcSummaryMetrics(completedWorkout);
    completedWorkout.duration = metrics.duration;
    const muscleTotals = computeMuscleTotals(completedWorkout);
    
    // Prepare clean data and comparison
    const cleanData = prepareCleanWorkoutData(completedWorkout, exercisesDB);
    const comparison = compareWorkoutToPrevious(completedWorkout, workouts);
    const feedback = generateSessionFeedback(cleanData.totalVolume, cleanData.completedSets, comparison?.trend || '→');
    
    // Pre-calculate PR status
    const prStatus = detectPRsInWorkout(completedWorkout, workouts, calculate1RM, getExerciseRecords);
    const hasPR = Object.keys(prStatus).length > 0;
    
    setSelectedTags([]); // reset tag selection
    setPendingSummary({ 
      completedWorkout: { ...completedWorkout, prStatus, hasPR }, 
      templateId: template?.id || null, 
      diff, 
      metrics: { ...metrics, muscleTotals },
      cleanData,
      comparison,
      feedback
    });
  }, [activeWorkout, templates, workouts, exercisesDB]);
  const handleMinimizeWorkout = useCallback(() => {
    setIsWorkoutMinimized(true);
    setView('home');
    setActiveTab('home');
  }, []);

  const handleMaximizeWorkout = useCallback(() => {
    setIsWorkoutMinimized(false);
    setView('activeWorkout');
  }, []);


  // Active Workout Modifications
  const handleUpdateSet = useCallback((exIndex, setIndex, field, value) => {
    // FIXED: Deep copy to prevent shallow mutation
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

    // If this set is already completed, re-run PR detection to update flags
    const exId = updated.exercises[exIndex].exerciseId;
    const isCompleted = updated.exercises[exIndex].sets[setIndex].completed;
    if (exId && isCompleted) {
      const kg = Number(updated.exercises[exIndex].sets[setIndex].kg) || 0;
      const reps = Number(updated.exercises[exIndex].sets[setIndex].reps) || 0;
      
      // P1 FIX: Re-run PR detection after edit to update set flags correctly
      // Create temporary workout for PR detection
      const tempWorkout = { ...updated };
      const prStatus = detectPRsInWorkout(tempWorkout, workouts, calculate1RM, getExerciseRecords);
      
      // Apply PR flags back to the updated set
      if (prStatus[exId]?.recordsPerSet?.[setIndex]) {
        const recordTypes = prStatus[exId].recordsPerSet[setIndex];
        updated.exercises[exIndex].sets[setIndex].isBest1RM = recordTypes.includes('best1RM');
        updated.exercises[exIndex].sets[setIndex].isBestSetVolume = recordTypes.includes('bestSetVolume');
        updated.exercises[exIndex].sets[setIndex].isHeaviestWeight = recordTypes.includes('heaviestWeight');
      } else {
        // Clear PR flags if no longer a record
        updated.exercises[exIndex].sets[setIndex].isBest1RM = false;
        updated.exercises[exIndex].sets[setIndex].isBestSetVolume = false;
        updated.exercises[exIndex].sets[setIndex].isHeaviestWeight = false;
      }
      
      setActiveWorkout(updated);
      
      // Also update exercise default in DB if new 1RM
      const hist = getExerciseRecords(exId, workouts);
      const histBest = hist.best1RM || 0;
      const this1RM = calculate1RM(kg, reps);
      if (this1RM > histBest) {
        setExercisesDB(prev => prev.map(e => e.id === exId ? { ...e, defaultSets: [{ kg, reps }, ...(e.defaultSets || []).slice(1)] } : e));
        // subtle haptic for PR
        if (navigator.vibrate) navigator.vibrate(20);
      }
    }
  }, [activeWorkout, workouts, exercisesDB]);

  // Keypad Handlers
  const handleOpenKeypad = useCallback((exIndex, setIndex, field) => {
    if (!activeWorkout) return;
    const currentValue = activeWorkout.exercises[exIndex]?.sets?.[setIndex]?.[field] || '';
    setActiveInput({ exerciseIndex: exIndex, setIndex, field });
    setKeypadValue(currentValue.toString());
  }, [activeWorkout]);

  const handleCloseKeypad = useCallback(() => {
    setActiveInput(null);
    setKeypadValue('');
  }, []);

  const handleKeypadDone = useCallback(() => {
    if (!activeInput || !activeWorkout) return;
    
    const { exerciseIndex, setIndex, field } = activeInput;
    const value = keypadValue ? Number(keypadValue) : 0;
    
    // Update the set value
    const updated = { ...activeWorkout };
    updated.exercises[exerciseIndex].sets[setIndex][field] = value;
    setActiveWorkout(updated);
    
    handleCloseKeypad();
  }, [activeInput, activeWorkout, keypadValue, handleCloseKeypad]);

  const handleKeypadNext = useCallback(() => {
    if (!activeInput || !activeWorkout) return;
    
    const { exerciseIndex, setIndex, field } = activeInput;
    const value = keypadValue ? Number(keypadValue) : 0;
    
    // Update the current field
    const updated = { ...activeWorkout };
    updated.exercises[exerciseIndex].sets[setIndex][field] = value;
    setActiveWorkout(updated);
    
    // Move to next field: kg -> reps -> done
    if (field === 'kg') {
      const nextValue = updated.exercises[exerciseIndex].sets[setIndex].reps || '';
      setActiveInput({ exerciseIndex, setIndex, field: 'reps' });
      setKeypadValue(nextValue.toString());
    } else {
      // After reps, close keypad
      handleCloseKeypad();
    }
  }, [activeInput, activeWorkout, keypadValue, handleCloseKeypad]);

  // Helper to show toast message
  const showToast = useCallback((message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2000);
  }, []);

  const handleToggleSet = useCallback((exIndex, setIndex) => {
    // FIXED: Deep copy to prevent shallow mutation
    const updated = {
      ...activeWorkout,
      exercises: activeWorkout.exercises.map((ex, idx) => {
        if (idx !== exIndex) return ex;
        return {
          ...ex,
          sets: ex.sets.map((set, sidx) => {
            if (sidx !== setIndex) return set;
            
            // Toggle completion
            const newVal = !set.completed;
            
            let updatedSet = { ...set, completed: newVal };
            
            // If trying to complete a set
            if (newVal && !set.completed) {
              const kg = Number(set.kg) || 0;
              const reps = Number(set.reps) || 0;
              const suggestedKg = Number(set.suggestedKg) || 0;
              const suggestedReps = Number(set.suggestedReps) || 0;
              
              // Check if there are no values
              if (kg === 0 && reps === 0 && suggestedKg === 0 && suggestedReps === 0) {
                showToast('Please enter kg and reps');
                return set; // Don't change completion
              }
              
              // Auto-fill with suggested values if user didn't enter anything
              if (kg === 0 && reps === 0 && (suggestedKg > 0 || suggestedReps > 0)) {
                updatedSet.kg = suggestedKg;
                updatedSet.reps = suggestedReps;
              } else if (kg === 0 || reps === 0) {
                // Fill in suggested if one is missing
                if (kg === 0) updatedSet.kg = suggestedKg;
                if (reps === 0) updatedSet.reps = suggestedReps;
              }
            }
            
            // If unchecking, remove medal flags
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

    // When marking completed, check for PRs and update default exercises
    const set = updated.exercises[exIndex].sets[setIndex];
    if (set.completed) {
      const exId = updated.exercises[exIndex].exerciseId;
      const exerciseName = updated.exercises[exIndex].name;
      if (exId) {
        const kg = Number(set.kg) || 0;
        const reps = Number(set.reps) || 0;
        if (kg > 0 && reps > 0 && !set.warmup) {
          const this1RM = calculate1RM(kg, reps);
          
          // Use cache if available, fallback to calculation
          const hist = getRecords(exId) || getExerciseRecords(exId, workouts);
          const histBest = hist?.best1RM || 0;
          if (this1RM > histBest) {
            setExercisesDB(prev => prev.map(e => e.id === exId ? { ...e, defaultSets: [{ kg, reps }, ...(e.defaultSets || []).slice(1)] } : e));
          }

          // Check for PRs using new 3-type system
          if (enablePerformanceAlerts) {
            const prRecords = checkSetRecords(kg, reps, hist, calculate1RM);
            if (prRecords.isBest1RM || prRecords.isBestSetVolume || prRecords.isHeaviestWeight) {
              // Mark the set with PR flags
              const recordTypes = [];
              if (prRecords.isHeaviestWeight) recordTypes.push('heaviestWeight');
              if (prRecords.isBestSetVolume) recordTypes.push('bestSetVolume');
              if (prRecords.isBest1RM) recordTypes.push('best1RM');
              
              set.isBest1RM = prRecords.isBest1RM;
              set.isBestSetVolume = prRecords.isBestSetVolume;
              set.isHeaviestWeight = prRecords.isHeaviestWeight;
              
              // Trigger PR banner display
              setActivePRBanner({
                exerciseName,
                recordTypes
              });
              setPRBannerVisible(true);
              
              // Optional haptic feedback
              if (enableHapticFeedback && navigator.vibrate) {
                navigator.vibrate([20, 10, 20]);
              }

              // Auto-dismiss banner after banner sequence completes (doubled time for mobile)
              setTimeout(() => {
                setPRBannerVisible(false);
              }, 6000);
            }
          }
        }
      }

      // If part of superset, auto-scroll to next exercise in superset
      if (activeWorkout.exercises[exIndex].supersetId) {
        const supersetId = activeWorkout.exercises[exIndex].supersetId;
        let nextExIndex = -1;
        
        // Find next exercise in the same superset (after current)
        for (let i = exIndex + 1; i < activeWorkout.exercises.length; i++) {
          if (activeWorkout.exercises[i].supersetId === supersetId) {
            nextExIndex = i;
            break;
          }
        }
        
        // If not found, wrap around and search from beginning
        if (nextExIndex === -1) {
          for (let i = 0; i < exIndex; i++) {
            if (activeWorkout.exercises[i].supersetId === supersetId) {
              nextExIndex = i;
              break;
            }
          }
        }
        
        // Auto-scroll to next exercise
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
  }, [activeWorkout, workouts, exercisesDB, enablePerformanceAlerts, enableHapticFeedback, showToast]);

  const handleAddSet = useCallback((exIndex) => {
    // FIXED: Deep copy for immutability
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
    // insert before first set so it appears as #0
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
    // Update the exercise note in exercisesDB (single source of truth)
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
      
      // If we deleted from a superset, remove superset from remaining exercises
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
    // Get last completed sets for auto-memory
    const lastSets = getLastCompletedSets(newExercise.id, workouts);
    const suggested = suggestNextWeight(lastSets);
    
    // Build sets with auto-memory
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
    closeExerciseSelector();
  }, [activeWorkout, workouts, closeExerciseSelector]);

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
      // Remove superset from all exercises with this ID
      updated.exercises = updated.exercises.map(ex => 
        ex.supersetId === supersetId ? { ...ex, supersetId: null } : ex
      );
    }
    
    setActiveWorkout(updated);
  }, [activeWorkout]);

  const handleToggleFavorite = useCallback((exerciseId) => {
    setExercisesDB(prev => prev.map(ex => 
      ex.id === exerciseId ? { ...ex, isFavorite: !ex.isFavorite } : ex
    ));
  }, []);

  // --- ACTIONS: TEMPLATES ---

  const handleSaveTemplate = useCallback(() => {
    if (!editingTemplate.name.trim()) return;
    if (editingTemplate.id) {
      setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? editingTemplate : t));
    } else {
      setTemplates([...templates, { ...editingTemplate, id: Date.now() }]);
    }
    setEditingTemplate(null);
  }, [editingTemplate, templates]);

  // --- SELECTOR LOGIC ---

  const handleSelectExercise = useCallback((exercise) => {
    // Get last completed sets for auto-memory
    const lastSets = getLastCompletedSets(exercise.id, workouts);
    const suggested = suggestNextWeight(lastSets);
    
    // Build sets with suggested values as placeholder hints
    let sets;
    if (lastSets.length > 0) {
      sets = lastSets.map(s => ({ 
        kg: 0, 
        reps: 0, 
        completed: false,
        suggestedKg: Number(s.kg) || 0,
        suggestedReps: Number(s.reps) || 0
      }));
      if (suggested) {
        sets = [...sets, { 
          kg: 0, 
          reps: 0, 
          completed: false,
          suggestedKg: suggested.suggestedKg,
          suggestedReps: suggested.suggestedReps
        }];
      }
    } else {
      sets = exercise.defaultSets ? [...exercise.defaultSets] : [{ kg: 0, reps: 0 }];
      sets = sets.map(s => ({ 
        kg: 0, 
        reps: 0, 
        completed: false,
        suggestedKg: Number(s.kg) || 0,
        suggestedReps: Number(s.reps) || 0
      }));
    }
    
    const exData = {
      exerciseId: exercise.id,
      name: exercise.name,
      category: exercise.category,
      sets: sets
    };

    if (selectorMode === 'template') {
      setEditingTemplate({
        ...editingTemplate,
        exercises: [...(editingTemplate.exercises || []), { ...exData, sets: exData.sets.map(s => ({ kg: s.kg, reps: s.reps })) }]
      });
    } else if (selectorMode === 'activeWorkout') {
      const newEx = { ...exData };
      setActiveWorkout(prev => ({
        ...prev,
        exercises: [...(prev?.exercises || []), newEx]
      }));
    }
    closeExerciseSelector();
  }, [selectorMode, editingTemplate, workouts, closeExerciseSelector]);

  // --- DATA MANAGEMENT ---

  const handleExport = useCallback(() => {
    let dataToExport = {};

    // Filter workouts by period
    let filteredWorkouts = workouts;
    if (exportPeriod !== 'all') {
      const now = new Date();
      let startDate;
      switch (exportPeriod) {
        case 'last7':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'last30':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'last90':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case 'custom':
          if (exportStartDate && exportEndDate) {
            startDate = new Date(exportStartDate);
            const endDate = new Date(exportEndDate);
            filteredWorkouts = workouts.filter(w => {
              const workoutDate = new Date(w.date);
              return workoutDate >= startDate && workoutDate <= endDate;
            });
          }
          break;
        default:
          break;
      }
      if (startDate && exportPeriod !== 'custom') {
        filteredWorkouts = workouts.filter(w => new Date(w.date) >= startDate);
      }
    }

    // Filter exercises data based on workouts
    let filteredExercisesDB = exercisesDB;
    if (exportType === 'exercises') {
      // For exercise data export, include only exercises that appear in filtered workouts
      const exerciseIdsInWorkouts = new Set();
      filteredWorkouts.forEach(workout => {
        workout.exercises?.forEach(ex => {
          if (ex.exerciseId) exerciseIdsInWorkouts.add(ex.exerciseId);
        });
      });
      filteredExercisesDB = exercisesDB.filter(ex => exerciseIdsInWorkouts.has(ex.id));
    } else if (exportType === 'singleExercise' && exportExerciseId) {
      // For single exercise export, include only the selected exercise
      filteredExercisesDB = exercisesDB.filter(ex => ex.id === exportExerciseId);
      // Also filter workouts to only those containing this exercise
      filteredWorkouts = filteredWorkouts.filter(workout =>
        workout.exercises?.some(ex => ex.exerciseId === exportExerciseId)
      );
    }

    // Build export data
    if (exportType === 'all') {
      dataToExport = { workouts: filteredWorkouts, templates, exercisesDB: filteredExercisesDB, weeklyGoal };
    } else if (exportType === 'workouts') {
      dataToExport = { workouts: filteredWorkouts };
    } else if (exportType === 'exercises') {
      dataToExport = { exercisesDB: filteredExercisesDB, workouts: filteredWorkouts }; // Include workouts for context
    } else if (exportType === 'singleExercise') {
      dataToExport = { exercisesDB: filteredExercisesDB, workouts: filteredWorkouts }; // Include workouts for context
    }

    const dataStr = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    // Ensure filename ends exactly with .json and not .json.txt
    const filename = `workout_export_${exportType}_${new Date().toISOString().split('T')[0]}.json`;
    link.download = filename;
    link.setAttribute('type', blob.type);
    link.click();
    URL.revokeObjectURL(url);
    closeExportModal();
  }, [workouts, templates, exercisesDB, weeklyGoal, exportType, exportPeriod, exportStartDate, exportEndDate, exportExerciseId, closeExportModal]);

  const handleImport = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validation schema
    const isValidWorkout = (w) => {
      return w && typeof w === 'object' &&
        w.id && w.date && Array.isArray(w.exercises) &&
        w.exercises.every(ex => ex.exerciseId && ex.name && Array.isArray(ex.sets) &&
          ex.sets.every(s => typeof s.kg === 'number' && typeof s.reps === 'number')
        );
    };

    const isValidTemplate = (t) => {
      return t && typeof t === 'object' &&
        t.id && t.name && Array.isArray(t.exercises);
    };

    const isValidExercise = (ex) => {
      return ex && typeof ex === 'object' &&
        ex.id && ex.name && typeof ex.category === 'string';
    };

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);

        if (!data || typeof data !== 'object') {
          alert('Invalid JSON structure');
          return;
        }

        if (data.workouts) {
          if (!Array.isArray(data.workouts)) {
            alert('Workouts must be an array');
            return;
          }
          const validWorkouts = data.workouts.filter(w => {
            if (!isValidWorkout(w)) {
              console.warn('Invalid workout skipped:', w);
              return false;
            }
            return true;
          });
          if (validWorkouts.length > 0) {
            setWorkouts(prev => {
              const existingIds = new Set(prev.map(w => w.id));
              const newOnes = validWorkouts.filter(w => !existingIds.has(w.id));
              return [...newOnes, ...prev];
            });
          }
        }

        if (data.templates) {
          if (!Array.isArray(data.templates)) {
            console.warn('Templates must be an array');
          } else {
            const validTemplates = data.templates.filter(t => {
              if (!isValidTemplate(t)) {
                console.warn('Invalid template skipped:', t);
                return false;
              }
              return true;
            });
            if (validTemplates.length > 0) {
              setTemplates(prev => {
                const existingIds = new Set(prev.map(t => t.id));
                const newOnes = validTemplates.filter(t => !existingIds.has(t.id));
                return [...prev, ...newOnes];
              });
            }
          }
        }

        if (data.exercisesDB) {
          if (!Array.isArray(data.exercisesDB)) {
            console.warn('ExercisesDB must be an array');
          } else {
            const validExercises = data.exercisesDB.filter(ex => {
              if (!isValidExercise(ex)) {
                console.warn('Invalid exercise skipped:', ex);
                return false;
              }
              return true;
            });
            if (validExercises.length > 0) {
              setExercisesDB(prev => {
                const existingIds = new Set(prev.map(e => e.id));
                const newOnes = validExercises.filter(e => !existingIds.has(e.id));
                return [...prev, ...newOnes];
              });
            }
          }
        }

        if (data.weeklyGoal && !weeklyGoal && typeof data.weeklyGoal === 'number') {
          setWeeklyGoal(data.weeklyGoal);
        }

        // Rebuild PR cache after import (do it async after state updates settle)
        setTimeout(() => {
          // Need to use closure values which will be stale, so we recalculate from storage
          (async () => {
            try {
              const importedWorkouts = await storage.getAllFromStore(STORES.WORKOUTS);
              const importedExercises = await storage.getAllFromStore(STORES.EXERCISES);
              await rebuildIndex(importedWorkouts, importedExercises);
            } catch (error) {
              console.error('Error rebuilding PR cache after import:', error);
            }
          })();
        }, 0);

        alert('Import completed (validated and merged)');
      } catch (error) {
        console.error('Import error:', error);
        alert('Invalid JSON file or corrupted data');
      }
    };

    reader.onerror = () => {
      alert('Error reading file');
    };

    reader.readAsText(file);
  }, [weeklyGoal]);


  // --- NAVIGATION HANDLER ---
  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId);
    if (tabId === 'home') setView('home');
    else if (tabId === 'history') setView('history');
    else if (tabId === 'exercises') setView('exercises');
    else if (tabId === 'profile') setView('profile');
    else if (tabId === 'settings') setView('settings');
  }, []);

  // --- RENDER ---
  return (
    <>
      <div className="flex justify-center bg-zinc-900 min-h-screen">
        <div className="w-full max-w-md bg-zinc-900 shadow-2xl min-h-screen relative">

          {/* VIEW ROUTING */}
          {view === 'home' && (
            firstLoad ? (
              <div className="min-h-screen bg-black text-white pb-28 px-4 py-6">
                <div className="h-36 bg-slate-800/50 rounded-2xl mb-4 animate-pulse" />
                <div className="h-14 bg-slate-800/50 rounded-xl mb-3 animate-pulse" />
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="h-20 bg-slate-800/40 rounded-xl animate-pulse" />
                  <div className="h-20 bg-slate-800/40 rounded-xl animate-pulse" />
                </div>
                <div className="space-y-3 mt-4">
                  <div className="h-20 bg-slate-800/40 rounded-xl animate-pulse" />
                  <div className="h-20 bg-slate-800/40 rounded-xl animate-pulse" />
                  <div className="h-20 bg-slate-800/40 rounded-xl animate-pulse" />
                </div>
              </div>
            ) : (
              <HomeView
                workouts={workouts}
                weeklyGoal={weeklyGoal}
                trainingNotes={trainingNotes}
                onTrainingNotesChange={setTrainingNotes}
                onStartWorkout={() => setView('selectTemplate')}
                onManageTemplates={() => { setEditingTemplate(null); setView('templates'); }}
                onOpenCalendar={openCalendar}
                onViewHistory={() => { setActiveTab('history'); setView('history'); }}
                onViewWorkoutDetail={(date) => { setSelectedDate(date); setView('workoutDetail'); }}
                onOpenMonthlyProgress={(offset) => { setMonthOffset(offset); setView('monthlyProgress'); }}
              />
            )
          )}

          {view === 'history' && (
            <HistoryView
              workouts={workouts}
              onViewWorkoutDetail={(date) => { setSelectedDate(date); setView('workoutDetail'); }}
              onDeleteWorkout={async (id) => {
                // Capture workout FIRST before state changes
                const workoutToDelete = workouts.find(w => w.id === id);
                if (workoutToDelete) {
                  // Delete from storage using specific ID
                  try {
                    await storage.delete(STORES.WORKOUTS, id);
                  } catch (err) {
                    console.error('Error persisting workout deletion:', err);
                  }
                  
                  // Compute the filtered list for PR cache update
                  const newWorkouts = workouts.filter(w => w.id !== id);
                  
                  // Use functional setState to ensure we always filter the latest state
                  setWorkouts(prev => prev.filter(w => w.id !== id));
                  
                  setDeletedWorkout(workoutToDelete);
                  
                  // Invalidate PR cache for exercises in deleted workout
                  const exerciseIds = (workoutToDelete.exercises || [])
                    .map(e => e.exerciseId)
                    .filter(Boolean);
                  if (exerciseIds.length > 0) {
                    updateRecordsForExercises(exerciseIds, newWorkouts).catch(err =>
                      console.error('Error updating records after delete:', err)
                    );
                  }
                  
                  // Clear existing timeout
                  if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
                  
                  // Set new timeout to clear undo option after 10 seconds
                  undoTimeoutRef.current = setTimeout(() => {
                    setDeletedWorkout(null);
                  }, 10000);
                }
              }}
              onEditWorkout={(updatedWorkout) => { setWorkouts(prev => prev.map(w => w.id === updatedWorkout.id ? updatedWorkout : w)); }}
              exercisesDB={exercisesDB}
              filter={historyFilter}
              onFilterChange={setHistoryFilter}
            />
          )}

          {view === 'exercises' && (
            <ExercisesView
              exercisesDB={exercisesDB}
              onAddExercise={() => {
                setEditingExercise({ name: '', category: 'Push', muscles: [], defaultSets: [{ kg: 0, reps: 0 }], usesBodyweight: false, isFavorite: false });
                setView('createExercise');
              }}
              onEditExercise={(ex) => { setEditingExercise(ex); setView('createExercise'); }}
              onDeleteExercise={handleDeleteExerciseFromDB}
              onViewDetail={(id) => { setSelectedExerciseId(id); setView('exerciseDetail'); }}
              onToggleFavorite={handleToggleFavorite}
            />
          )}

          {view === 'createExercise' && editingExercise && (
            <CreateExerciseView
              exercise={editingExercise}
              onChange={setEditingExercise}
              onSave={() => handleSaveExercise(editingExercise)}
              onCancel={() => { 
                setExerciseCreateSource(null);
                setEditingExercise(null);
                if (exerciseCreateSource === 'activeWorkout') {
                  setView('activeWorkout');
                } else {
                  setView('exercises');
                }
              }}
            />
          )}

          {view === 'exerciseDetail' && selectedExerciseId && (
            <ExerciseDetailView
              exerciseId={selectedExerciseId}
              workouts={workouts}
              exercisesDB={exercisesDB}
              onBack={() => setView('exercises')}
              onOpenWorkout={(date) => {
                // set return context so we can come back to exercise detail
                setReturnTo({ view: 'exerciseDetail', exerciseId: selectedExerciseId });
                setSelectedDate(date);
                setView('workoutDetail');
              }}
              userWeight={userWeight}
            />
          )}

          {view === 'workoutDetail' && selectedDate && (
            <WorkoutDetailView
              selectedDate={selectedDate}
              workouts={workouts}
              exercisesDB={exercisesDB}
              onBack={() => {
                if (returnTo) {
                  if (returnTo.view === 'exerciseDetail') {
                    setSelectedExerciseId(returnTo.exerciseId);
                    setView('exerciseDetail');
                  } else {
                    setView(returnTo.view || 'home');
                  }
                  setReturnTo(null);
                } else {
                  if (activeTab === 'history') setView('history');
                  else setView('home');
                }
                setSelectedDate(null);
              }}
            />
          )}

          {view === 'selectTemplate' && (
            <SelectTemplateView
              templates={templates}
              onClose={() => setView('home')}
              onSelectTemplate={handleStartWorkout}
              onEditTemplate={(t) => { setEditingTemplate(JSON.parse(JSON.stringify(t))); setView('templates'); }}
            />
          )}

          {view === 'activeWorkout' && activeWorkout && (
            <div data-ui-anim className={`transition-opacity duration-200 ease-out ${pendingSummary ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
              <ActiveWorkoutView
                activeWorkout={activeWorkout}
              workouts={workouts}
              workoutTimer={workoutTimer}
              exercisesDB={exercisesDB}
              onCancel={() => { if (confirm('Cancel?')) { setActiveWorkout(null); setView('home'); } }}
              onFinish={handleFinishWorkout}
              onUpdateSet={handleUpdateSet}
              onToggleSet={handleToggleSet}
              onAddSet={handleAddSet}
              onAddNote={handleAddNote}
              onAddExerciseNote={handleAddExerciseNote}
              onDeleteExercise={handleDeleteExercise}
              onReorderExercises={handleReorderExercises}
              onReplaceExercise={(exIndex) => { setSelectedExerciseIndex(exIndex); setSelectorMode('activeWorkout'); openExerciseSelector(); }}
              onAddExercise={() => { setSelectedExerciseIndex(null); setSelectorMode('activeWorkout'); openExerciseSelector(); }}
              onMinimize={handleMinimizeWorkout}
              onDeleteSet={handleDeleteSet}
              onToggleWarmup={handleToggleWarmup}
              onAddWarmupSet={handleAddWarmupSet}
              onOpenKeypad={handleOpenKeypad}
              onCreateSuperset={handleCreateSuperset}
              onRemoveSuperset={handleRemoveSuperset}
              />
              <PRBanner 
                prData={activePRBanner}
                isVisible={prBannerVisible}
                onAutoClose={() => setPRBannerVisible(false)}
              />
            </div>
          )}

          {view === 'templates' && (
            <TemplatesView
              templates={templates}
              editingTemplate={editingTemplate}
              onClose={() => setView('home')}
              onCreateNew={() => setEditingTemplate({ name: '', exercises: [] })}
              onEdit={(t) => { setEditingTemplate(JSON.parse(JSON.stringify(t))); setView('templates'); }}
              onDelete={(id) => setTemplates(prev => prev.filter(t => t.id !== id))}
              onChange={setEditingTemplate}
              onSave={handleSaveTemplate}
              onAddExercise={() => { setSelectedExerciseIndex(null); setSelectorMode('template'); openExerciseSelector(); }}
            />
          )}

          {view === 'profile' && profileSubview === 'main' && (
            <ProfileView
              workouts={workouts}
              exercisesDB={exercisesDB}
              userWeight={userWeight}
              onUserWeightChange={setUserWeight}
              onViewStatistics={() => setProfileSubview('statistics')}
              onViewExercises={() => setView('exercises')}
              onViewCalendar={() => setView('calendar')}
              onWorkoutClick={(date) => { setSelectedDate(date); setView('workoutDetail'); }}
              onOpenSettings={() => setView('settings')}
            />
          )}

          {view === 'profile' && profileSubview === 'statistics' && (
            <ProfileStatisticsView
              workouts={workouts}
              exercisesDB={exercisesDB}
              userWeight={userWeight}
              onBack={() => setProfileSubview('main')}
            />
          )}

          {view === 'exportData' && (
            <ExportDataView
              onBack={() => setView('settings')}
              onExport={(data) => {
                // Determine workouts to export
                let workoutsToExport = [];
                let exercisesToExport = exercisesDB;
                let templatesToExport = templates;

                if (data.exportMode === 'all') {
                  // Export everything
                  workoutsToExport = workouts;
                } else {
                  // Export period
                  workoutsToExport = workouts.filter(w => {
                    const wDate = new Date(w.date);
                    const from = new Date(data.fromDate);
                    const to = new Date(data.toDate);
                    to.setHours(23, 59, 59, 999);
                    return wDate >= from && wDate <= to;
                  });
                  
                  // Filter exercises to only those used in filtered workouts
                  const usedExerciseIds = new Set();
                  workoutsToExport.forEach(w => {
                    w.exercises?.forEach(ex => {
                      if (ex.exerciseId) usedExerciseIds.add(ex.exerciseId);
                    });
                  });
                  exercisesToExport = exercisesDB.filter(e => usedExerciseIds.has(e.id));
                  templatesToExport = [];
                }

                let content = '';
                const filename = data.exportMode === 'all' 
                  ? `backup_${new Date().toISOString().split('T')[0]}`
                  : `workouts_${data.fromDate}_to_${data.toDate}`;

                switch(data.format) {
                  case 'txt':
                    if (data.exportMode === 'all') {
                      content = `BACKUP PEŁNY\n`;
                      content += `Data eksportu: ${new Date().toLocaleString('pl-PL')}\n`;
                      content += `Treningi: ${workoutsToExport.length}\n`;
                      content += `Ćwiczenia: ${exercisesToExport.length}\n`;
                      content += `Szablony: ${templatesToExport.length}\n\n`;
                      content += `${'─'.repeat(70)}\n\n`;
                      
                      content += `SZABLONY TRENINGÓW:\n`;
                      templatesToExport.forEach((t, idx) => {
                        content += `${idx + 1}. ${t.name}\n`;
                        t.exercises?.forEach(ex => {
                          content += `   • ${ex.name} - ${ex.sets?.length || 0} serii\n`;
                        });
                        content += '\n';
                      });
                      
                      content += `\n${'─'.repeat(70)}\n\n`;
                      content += `ĆWICZENIA:\n`;
                      exercisesToExport.forEach((e, idx) => {
                        content += `${idx + 1}. ${e.name} (${e.category})\n`;
                      });
                    } else {
                      content = `EXPORT TRENINGÓW\n`;
                      content += `Zakres: ${data.fromDate} do ${data.toDate}\n`;
                      content += `Data eksportu: ${new Date().toLocaleString('pl-PL')}\n`;
                      content += `Ilość treningów: ${workoutsToExport.length}\n\n`;
                      content += `${'─'.repeat(70)}\n\n`;
                    }
                    
                    workoutsToExport.forEach((w, idx) => {
                      content += `${idx + 1}. ${w.name} (${w.date})\n`;
                      content += `   Czas: ${w.duration || 0} min\n`;
                      if (w.note) content += `   Notatka: ${w.note}\n`;
                      if (w.exercises?.length > 0) {
                        content += `   Ćwiczenia:\n`;
                        w.exercises.forEach(ex => {
                          content += `     • ${ex.name}\n`;
                          const doneSets = (ex.sets || []).filter(s => s.completed);
                          doneSets.forEach(s => {
                            content += `       - ${s.kg} kg × ${s.reps} rep${s.reps !== '1' ? 's' : ''}\n`;
                          });
                        });
                      }
                      content += '\n';
                    });
                    break;
                  case 'json':
                    const exportData = {
                      workouts: workoutsToExport,
                      exercisesDB: exercisesToExport
                    };
                    if (data.exportMode === 'all') {
                      exportData.templates = templatesToExport;
                    }
                    content = JSON.stringify(exportData, null, 2);
                    break;
                }

                const blob = new Blob([content], { 
                  type: data.format === 'json' ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8'
                });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                const ext = data.format === 'json' ? 'json' : 'txt';
                link.download = `${filename}.${ext}`;
                link.setAttribute('type', blob.type);
                link.click();
                URL.revokeObjectURL(url);
                setView('settings');
              }}
            />
          )}

          {view === 'settings' && (
            <SettingsView
              weeklyGoal={weeklyGoal}
              onWeeklyGoalChange={setWeeklyGoal}
              onExport={handleExport}
              onImport={handleImport}
              onReset={() => { if (confirm('Reset all data?')) { localStorage.clear(); location.reload(); } }}
              showExportModal={showExportModal}
              setShowExportModal={closeExportModal}
              exportType={exportType}
              setExportType={setExportType}
              exportPeriod={exportPeriod}
              setExportPeriod={setExportPeriod}
              exportStartDate={exportStartDate}
              setExportStartDate={setExportStartDate}
              exportEndDate={exportEndDate}
              setExportEndDate={setExportEndDate}
              exportExerciseId={exportExerciseId}
              setExportExerciseId={setExportExerciseId}
              exercisesDB={exercisesDB}
              onOpenExportData={() => setView('exportData')}
              defaultStatsRange={defaultStatsRange}
              onDefaultStatsRangeChange={setDefaultStatsRange}
              enablePerformanceAlerts={enablePerformanceAlerts}
              onEnablePerformanceAlertsChange={setEnablePerformanceAlerts}
              enableHapticFeedback={enableHapticFeedback}
              onEnableHapticFeedbackChange={setEnableHapticFeedback}
            />
          )}

          {view === 'monthlyProgress' && (
            <MonthlyProgressView
              workouts={workouts}
              monthOffset={monthOffset}
              onBack={() => setView('home')}
              onViewWorkoutDetail={(date) => { setSelectedDate(date); setView('workoutDetail'); }}
              onDeleteWorkout={(id) => {
                if (confirm('Delete this workout?')) {
                  setWorkouts(prev => prev.filter(w => w.id !== id));
                }
              }}
            />
          )}

          {view === 'calendar' && (
            <ProfileCalendarView
              workouts={workouts}
              onBack={() => setView('profile')}
              onViewWorkoutDetail={(date) => { setSelectedDate(date); setView('workoutDetail'); }}
            />
          )}
          {activeWorkout && isWorkoutMinimized && (
            <MiniWorkoutBar
              workoutName={activeWorkout.name}
              timer={workoutTimer}
              onMaximize={handleMaximizeWorkout}
            />
          )}

        </div>
      </div>

      {/* GLOBAL MODALS & NAV */}
      {/* Nav chowamy tylko w trybie aktywnego treningu, żeby nie przeszkadzał */}
      {view !== 'activeWorkout' && (
        <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
      )}

      {showCalendar && (
        <CalendarModal
          workouts={workouts}
          onClose={closeCalendar}
          onSelectDate={(d) => { setSelectedDate(d); setView('workoutDetail'); }}
        />
      )}

      {showExerciseSelector && (
        <ExerciseSelectorModal
          exercisesDB={exercisesDB}
          onClose={closeExerciseSelector}
          onSelectExercise={(ex) => {
            if (selectorMode === 'activeWorkout' && selectedExerciseIndex !== null) {
              handleReplaceExercise(selectedExerciseIndex, ex);
              setSelectedExerciseIndex(null);
            } else {
              handleSelectExercise(ex);
            }
          }}
          onCreateNew={() => {
            const source = selectorMode === 'activeWorkout' ? 'activeWorkout' : 'exercises';
            setEditingExercise({ name: '', category: 'Push', muscles: [], defaultSets: [{ kg: 0, reps: 0 }], usesBodyweight: false });
            setExerciseCreateSource(source);
            closeExerciseSelector();
            setView('createExercise');
          }}
        />
      )}
      {pendingSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div
            data-ui-anim
            className={`bg-gradient-to-br from-slate-900/95 to-black/95 text-white rounded-2xl w-full max-w-md border border-slate-700/50 ui-modal-scale max-h-[90vh] overflow-y-auto ${summaryVisible ? 'animate-modal-fade-in' : 'opacity-0 scale-95'}`}
          >
            <div className="p-6 sticky top-0 bg-gradient-to-b from-slate-900/95 to-transparent border-b border-slate-700/30 flex justify-between items-start">
              <div>
                <h2 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-blue-400 to-blue-300 bg-clip-text text-transparent">
                  {pendingSummary.cleanData.totalVolume.toLocaleString()}
                </h2>
                <p className="text-xs text-slate-400 mt-1 font-semibold tracking-widest">TOTAL VOLUME</p>
              </div>
              <button onClick={() => setPendingSummary(null)} className="text-slate-500 hover:text-slate-300 transition flex-shrink-0">
                <span className="text-xl">✕</span>
              </button>
            </div>

            <div className="p-6 space-y-4">
            {/* Main stats row */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3 sm:p-4">
                <p className="text-slate-400 text-xs font-semibold tracking-widest mb-2">SETS COMPLETED</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl sm:text-2xl font-black text-white">{pendingSummary.cleanData.completedSets}</span>
                  {pendingSummary.comparison && (
                    <span className="text-lg" title={`${pendingSummary.comparison.prevVolume ? 'vs ' + Math.round(pendingSummary.comparison.prevVolume / 1000) + 'k prev' : ''}`}>
                      {pendingSummary.comparison.trend}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3 sm:p-4">
                <p className="text-slate-400 text-xs font-semibold tracking-widest mb-2">DURATION</p>
                <p className="text-xl sm:text-2xl font-black text-white">{pendingSummary.metrics.duration}m</p>
              </div>
            </div>

            {/* Feedback text */}
            <div className="bg-accent/30 border border-accent/20 rounded-lg p-3 sm:p-4 text-center">
              <p className="text-sm sm:text-lg font-bold accent-text">{pendingSummary.feedback}</p>
            </div>

            {/* PR Celebration */}
            {pendingSummary.completedWorkout.hasPR && (
              <div className="bg-gradient-to-br from-amber-600/20 to-amber-700/10 border border-amber-500/30 rounded-xl p-4 mb-6 flex items-center justify-center gap-3 animate-pulse-gentle">
                <span className="text-4xl animate-bounce">🏆</span>
                <div className="text-center">
                  <p className="text-xs text-amber-400 font-black uppercase tracking-wider">PERSONAL RECORD!</p>
                  <p className="text-sm text-amber-300 font-bold mt-1">
                    {Object.keys(pendingSummary.completedWorkout.prStatus).length} new {Object.keys(pendingSummary.completedWorkout.prStatus).length === 1 ? 'PR' : 'PRs'}
                  </p>
                </div>
              </div>
            )}

            {/* Radar chart - only if data exists */}
            {(() => {
              const radarData = pendingSummary.cleanData.radarData || {};
              const hasData = Object.values(radarData).some(v => v > 0);
              if (!hasData) return null;
              
              return (
                <div className="mb-6">
                  <p className="text-xs text-slate-400 font-semibold tracking-widest mb-4">MUSCLE DISTRIBUTION</p>
                  <div className="flex justify-center bg-slate-800/20 rounded-xl p-6">
                    <svg width="320" height="320" viewBox="0 0 320 320" className="drop-shadow-lg animate-fade-in">
                      <defs>
                        {/* Glow filter for polygon */}
                        <filter id="radarPolygonGlow">
                          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                          <feMerge>
                            <feMergeNode in="coloredBlur"/>
                            <feMergeNode in="SourceGraphic"/>
                          </feMerge>
                        </filter>
                        
                        {/* Glow filter for data points */}
                        <filter id="radarPointGlow">
                          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                          <feMerge>
                            <feMergeNode in="coloredBlur"/>
                            <feMergeNode in="SourceGraphic"/>
                          </feMerge>
                        </filter>
                      </defs>
                      <g transform="translate(160,160)">
                        {/* Concentric circles - subtle grid */}
                        {[1, 2, 3].map((r, i) => (
                          <circle 
                            key={i} 
                            r={i * 35} 
                            fill="none" 
                            stroke="#475569" 
                            strokeWidth="0.5" 
                            opacity="0.12"
                          />
                        ))}
                        
                        {/* Axes and labels */}
                        {(() => {
                          const groups = ['Chest', 'Back', 'Legs', 'Shoulders', 'Biceps', 'Triceps', 'Core'];
                          const values = groups.map(g => radarData[g] || 0);
                          
                          // Normalized 0-1, scale to radius
                          const points = values.map((v, i) => {
                            const angle = (i / groups.length) * Math.PI * 2 - Math.PI / 2;
                            const radius = v * 100;
                            return `${Math.cos(angle) * radius},${Math.sin(angle) * radius}`;
                          }).join(' ');
                          
                          // Get coordinates for data point markers
                          const pointCoords = values.map((v, i) => {
                            const angle = (i / groups.length) * Math.PI * 2 - Math.PI / 2;
                            const radius = v * 100;
                            return {
                              x: Math.cos(angle) * radius,
                              y: Math.sin(angle) * radius
                            };
                          });
                          
                          return (
                            <>
                              {/* Subtle axis lines (very faint) */}
                              {groups.map((g, i) => {
                                const angle = (i / groups.length) * Math.PI * 2 - Math.PI / 2;
                                const x = Math.cos(angle) * 105;
                                const y = Math.sin(angle) * 105;
                                return (
                                  <line 
                                    key={`axis-${i}`}
                                    x1={0} 
                                    y1={0} 
                                    x2={x} 
                                    y2={y} 
                                    stroke="#475569" 
                                    strokeWidth="0.5" 
                                    opacity="0.08"
                                  />
                                );
                              })}
                              
                              {/* Data polygon with animation and glow */}
                              <polygon 
                                points={points} 
                                fill="#06b6d4" 
                                fillOpacity="0.28"
                                stroke="#06b6d4" 
                                strokeWidth="2"
                                filter="url(#radarPolygonGlow)"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{
                                  animation: 'radarDraw 500ms ease-out forwards',
                                  transformOrigin: '0 0'
                                }}
                              />
                              
                              {/* Data point markers */}
                              {pointCoords.map((coord, i) => (
                                <g key={`point-${i}`}>
                                  {/* Outer glow circle */}
                                  <circle 
                                    cx={coord.x} 
                                    cy={coord.y} 
                                    r="5" 
                                    fill="none" 
                                    stroke="#06b6d4" 
                                    strokeWidth="1" 
                                    opacity="0.3"
                                    style={{
                                      animation: `radarPointPulse 2s ease-in-out infinite`,
                                      animationDelay: `${i * 0.15}s`
                                    }}
                                  />
                                  
                                  {/* Center point */}
                                  <circle
                                    cx={coord.x}
                                    cy={coord.y}
                                    r="3.5"
                                    fill="#06b6d4"
                                    filter="url(#radarPointGlow)"
                                    style={{
                                      animation: `radarDraw 500ms ease-out forwards`,
                                      animationDelay: `${i * 30}ms`
                                    }}
                                  />
                                </g>
                              ))}
                              
                              {/* Labels */}
                              {groups.map((g, i) => {
                                const angle = (i / groups.length) * Math.PI * 2 - Math.PI / 2;
                                const x = Math.cos(angle) * 130;
                                const y = Math.sin(angle) * 130;
                                return (
                                  <text 
                                    key={`label-${i}`}
                                    x={x} 
                                    y={y}
                                    fontSize="12" 
                                    fill="#cbd5e1" 
                                    fontWeight="600"
                                    textAnchor={Math.abs(x) > 10 ? (x > 0 ? 'start' : 'end') : 'middle'}
                                    dominantBaseline="middle"
                                  >
                                    {g}
                                  </text>
                                );
                              })}
                            </>
                          );
                        })()}
                      </g>
                    </svg>
                    
                    {/* CSS animations */}
                    <style>{`
                      @keyframes radarDraw {
                        from {
                          stroke-dasharray: 1000;
                          stroke-dashoffset: 1000;
                        }
                        to {
                          stroke-dasharray: 1000;
                          stroke-dashoffset: 0;
                        }
                      }
                      
                      @keyframes radarPointPulse {
                        0%, 100% {
                          r: 5;
                          opacity: 0.2;
                        }
                        50% {
                          r: 7;
                          opacity: 0.1;
                        }
                      }
                      
                      .animate-fade-in {
                        animation: fadeIn 400ms ease-out;
                      }
                      
                      @keyframes fadeIn {
                        from {
                          opacity: 0;
                        }
                        to {
                          opacity: 1;
                        }
                      }
                    `}</style>
                  </div>
                </div>
              );
            })()}

            {/* Tag Selection */}
            <div className="mb-4 sm:mb-6">
              <p className="text-xs text-slate-400 font-semibold tracking-widest mb-2">WORKOUT TAGS</p>
              <div className="flex flex-wrap gap-2">
                {['#cut', '#power', '#volume', '#sleep-bad', '#bulk', '#stress', '#sick'].map(tag => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTags(prev => 
                      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                    )}
                    className={`px-3 sm:px-4 py-2 rounded-full text-xs font-bold transition-all ${
                      selectedTags.includes(tag)
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                        : 'bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            </div>

            {/* Action buttons */}
            <div className="p-6 pt-0 flex flex-col gap-2 sticky bottom-0 bg-gradient-to-t from-slate-900/95 to-transparent border-t border-slate-700/30">
              <button 
                onClick={async () => {
                  const workoutWithTags = { ...pendingSummary.completedWorkout, tags: selectedTags };
                  
                  // Save just the new workout (more efficient than saving entire array)
                  try {
                    await storage.set(STORES.WORKOUTS, workoutWithTags);
                  } catch (err) {
                    console.error('Error saving workout:', err);
                  }
                  
                  // Update state for immediate UI feedback
                  const newWorkouts = [workoutWithTags, ...workouts];
                  setWorkouts(newWorkouts);
                  
                  // Update PR cache for all exercises in this workout (use new list for cache)
                  const exerciseIds = (workoutWithTags.exercises || []).map(e => e.exerciseId).filter(Boolean);
                  await updateRecordsForExercises(exerciseIds, newWorkouts);

                  setActiveWorkout(null);
                  setWorkoutTimer(0);
                  setPendingSummary(null);
                  setSelectedTags([]);
                  setView('home');
                }}
                className="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-accent to-accent hover:opacity-90 text-white font-bold text-sm transition-all duration-200 ease-out ui-press shadow-lg shadow-accent/30"
              >
                Save Workout
              </button>
              
              {pendingSummary.templateId && (
                <button 
                  onClick={async () => {
                    const workoutWithTags = { ...pendingSummary.completedWorkout, tags: selectedTags };
                    
                    // Update state for immediate UI feedback
                    const newWorkouts = [workoutWithTags, ...workouts];
                    
                    // Save just the new workout (more efficient)
                    try {
                      await storage.set(STORES.WORKOUTS, workoutWithTags);
                    } catch (err) {
                      console.error('Error saving workout:', err);
                    }
                    
                    if (pendingSummary.templateId) {
                      const ti = templates.findIndex(t => t.id === pendingSummary.templateId);
                      if (ti !== -1) {
                        const newTemplate = { ...templates[ti] };
                        newTemplate.exercises = (pendingSummary.completedWorkout.exercises || []).map(ex => ({ name: ex.name, category: ex.category, sets: ex.sets.map(s => ({ kg: 0, reps: 0 })) }));
                        const updated = [...templates]; 
                        updated[ti] = newTemplate; 
                        // Save just the updated template
                        try {
                          await storage.set(STORES.TEMPLATES, newTemplate);
                        } catch (err) {
                          console.error('Error updating template:', err);
                        }
                        setTemplates(updated);
                      }
                    }
                    
                    // Update PR cache for all exercises in this workout
                    const exerciseIds = (workoutWithTags.exercises || []).map(e => e.exerciseId).filter(Boolean);
                    await updateRecordsForExercises(exerciseIds, newWorkouts);

                    setWorkouts(newWorkouts);
                    setActiveWorkout(null);
                    setWorkoutTimer(0);
                    setPendingSummary(null);
                    setSelectedTags([]);
                    setView('home');
                  }}
                  className="w-full px-4 py-3 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 border border-slate-600/50 text-slate-300 hover:text-white font-semibold text-sm transition-all"
                >
                  Save & Update Template
                </button>
              )}
              
              <button 
                onClick={() => setPendingSummary(null)}
                className="w-full px-4 py-2 rounded-lg bg-slate-800/40 hover:bg-slate-700/40 text-slate-400 hover:text-slate-300 font-semibold text-sm transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Toast Message */}
      {toast && (
        <div className="fixed bottom-24 left-4 right-4 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg animate-pulse">
          {toast}
        </div>
      )}

      {/* Undo Deleted Workout Toast */}
      {deletedWorkout && (
        <div className="fixed bottom-24 left-4 right-4 bg-slate-800 border-2 border-slate-700 text-white px-6 py-4 rounded-xl shadow-xl flex items-center justify-between z-40 animate-pulse">
          <div>
            <p className="text-base font-bold">Workout deleted</p>
            <p className="text-xs text-slate-400 mt-1">Undo within 10 seconds</p>
          </div>
          <button
            onClick={async () => {
              const restoredWorkouts = [deletedWorkout, ...workouts];
              
              // Restore to storage using set (restores specific workout by ID)
              try {
                await storage.set(STORES.WORKOUTS, deletedWorkout);
              } catch (err) {
                console.error('Error persisting workout restoration:', err);
                return;
              }
              
              // Update state
              setWorkouts(restoredWorkouts);
              setDeletedWorkout(null);
              if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
            }}
            className="ml-4 px-5 py-2 accent-bg hover:opacity-90 rounded-lg font-bold text-sm transition-colors text-white flex-shrink-0"
          >
            Undo
          </button>
        </div>
      )}
      
      {/* Custom Number Keypad */}
      {activeInput && (
        <CustomKeypad
          value={keypadValue}
          onValueChange={setKeypadValue}
          onDone={handleKeypadDone}
          onNext={activeInput.field === 'kg' ? handleKeypadNext : null}
          label={activeInput.field.toUpperCase()}
        />
      )}
    </>
  );
}