import React, { useState, useEffect, useMemo, useCallback } from 'react';

// DOMAIN
import { calculate1RM } from './domain/calculations';
import { getExerciseRecords, getLastCompletedSets, suggestNextWeight } from './domain/exercises';
import { prepareCleanWorkoutData, compareWorkoutToPrevious, generateSessionFeedback, calculateMuscleDistribution, detectPRsInWorkout } from './domain/workouts';

// HOOKS
import { useDebouncedLocalStorage, useDebouncedLocalStorageManual } from './hooks/useLocalStorage';
import { useModals } from './contexts/ModalContext';

// COMPONENTS
import { MiniWorkoutBar } from './components/MiniWorkoutBar';
import { BottomNav } from './components/BottomNav';
import { CalendarModal } from './components/CalendarModal';
import { ExerciseSelectorModal } from './components/ExerciseSelectorModal';

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
  // --- CONTEXT ---
  const { showCalendar, closeCalendar, openCalendar, showExerciseSelector, closeExerciseSelector, openExerciseSelector, showExportModal, closeExportModal } = useModals();

  // --- STATE ---
  const [view, setView] = useState('home');
  const [activeTab, setActiveTab] = useState('home');

  const [workouts, setWorkouts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [exercisesDB, setExercisesDB] = useState([]);
  const [userWeight, setUserWeight] = useState(null);
  const [weeklyGoal, setWeeklyGoal] = useState(4);
  const [activeWorkout, setActiveWorkout] = useState(null);
  const [workoutTimer, setWorkoutTimer] = useState(0);
  const [isWorkoutMinimized, setIsWorkoutMinimized] = useState(false);
  const [selectedTags, setSelectedTags] = useState([]); // for post-workout tag selection

  // UI State
  const [selectorMode, setSelectorMode] = useState(null); // 'template' | 'activeWorkout'
  const [historyFilter, setHistoryFilter] = useState('all'); // persist across views
  const [profileSubview, setProfileSubview] = useState('main'); // 'main' | 'statistics'
  const [exportType, setExportType] = useState('all'); // 'all' | 'workouts' | 'exercises'
  const [exportPeriod, setExportPeriod] = useState('all'); // 'all' | 'last7' | 'last30' | 'last90' | 'custom'
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [exportExerciseId, setExportExerciseId] = useState(null);

  // Selection State
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedExerciseId, setSelectedExerciseId] = useState(null);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [editingExercise, setEditingExercise] = useState(null);
  const [selectedExerciseIndex, setSelectedExerciseIndex] = useState(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const [pendingSummary, setPendingSummary] = useState(null);
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [firstLoad, setFirstLoad] = useState(true);
  const [returnTo, setReturnTo] = useState(null);

  // --- EFFECTS ---

  // Load Data
  useEffect(() => {
    try {
      const savedEx = localStorage.getItem('exercises');
      if (savedEx) setExercisesDB(JSON.parse(savedEx));

      const savedWorkouts = localStorage.getItem('workouts');
      if (savedWorkouts) setWorkouts(JSON.parse(savedWorkouts));

      const savedTemplates = localStorage.getItem('templates');
      if (savedTemplates) setTemplates(JSON.parse(savedTemplates));

      const savedGoal = localStorage.getItem('weeklyGoal');
      if (savedGoal) setWeeklyGoal(parseInt(savedGoal));

      const savedWeight = localStorage.getItem('userWeight');
      if (savedWeight) setUserWeight(Number(savedWeight));

      // Opcjonalnie: Przywracanie aktywnego treningu (jeśli aplikacja została zamknięta)
      const savedActive = localStorage.getItem('activeWorkout');
      if (savedActive) {
        const parsed = JSON.parse(savedActive);
        // Sprawdź czy nie jest zbyt stary (np. > 24h)
        if (new Date() - new Date(parsed.startTime) < 86400000) {
          setActiveWorkout(parsed);
          setView('activeWorkout');
        }
      }
    } catch (e) {
      console.error("Error loading data", e);
    }
  }, []);

  // initial skeleton (cold start): show for ~350ms
  useEffect(() => {
    const t = setTimeout(() => setFirstLoad(false), 350);
    return () => clearTimeout(t);
  }, []);

  // Save Data (debounced to prevent excessive localStorage writes)
  useDebouncedLocalStorage('exercises', exercisesDB, 1000);
  useDebouncedLocalStorage('workouts', workouts, 1000);
  useDebouncedLocalStorage('templates', templates, 1000);
  useDebouncedLocalStorage('userWeight', userWeight, 1000);
  useDebouncedLocalStorageManual('activeWorkout', activeWorkout, 500);

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
    if (exercise.id) {
      setExercisesDB(exercisesDB.map(e => e.id === exercise.id ? exercise : e));
    } else {
      setExercisesDB([...exercisesDB, { ...exercise, id: Date.now() }]);
    }
    setView('exercises');
    setEditingExercise(null);
  }, [exercisesDB]);

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
    const updated = { ...activeWorkout };
    updated.exercises[exIndex].sets[setIndex][field] = value;
    setActiveWorkout(updated);

    // If this set is already completed, update exercise default in DB
    const exId = updated.exercises[exIndex].exerciseId;
    const isCompleted = updated.exercises[exIndex].sets[setIndex].completed;
    if (exId && isCompleted) {
      const kg = Number(updated.exercises[exIndex].sets[setIndex].kg) || 0;
      const reps = Number(updated.exercises[exIndex].sets[setIndex].reps) || 0;
        // compute 1RM for this set
        const this1RM = calculate1RM(kg, reps);
        // compare against historical best (exclude warmups)
        const hist = getExerciseRecords(exId, workouts);
        const histBest = hist.best1RM || 0;
        if (this1RM > histBest) {
          setExercisesDB(prev => prev.map(e => e.id === exId ? { ...e, defaultSets: [{ kg, reps }, ...(e.defaultSets || []).slice(1)] } : e));
          // subtle haptic for PR
          if (navigator.vibrate) navigator.vibrate(20);
        }
    }
  }, [activeWorkout, workouts]);

  const handleToggleSet = useCallback((exIndex, setIndex) => {
    const updated = { ...activeWorkout };
    const newVal = !updated.exercises[exIndex].sets[setIndex].completed;
    updated.exercises[exIndex].sets[setIndex].completed = newVal;
    setActiveWorkout(updated);

    // When marking completed, update exercise default in DB
    if (newVal) {
      const exId = updated.exercises[exIndex].exerciseId;
      if (exId) {
        const kg = Number(updated.exercises[exIndex].sets[setIndex].kg) || 0;
        const reps = Number(updated.exercises[exIndex].sets[setIndex].reps) || 0;
        const this1RM = calculate1RM(kg, reps);
        const hist = getExerciseRecords(exId, workouts);
        const histBest = hist.best1RM || 0;
        if (this1RM > histBest) {
          setExercisesDB(prev => prev.map(e => e.id === exId ? { ...e, defaultSets: [{ kg, reps }, ...(e.defaultSets || []).slice(1)] } : e));
        }
      }
    }
  }, [activeWorkout, workouts]);

  const handleAddSet = useCallback((exIndex) => {
    const updated = { ...activeWorkout };
    const lastSet = updated.exercises[exIndex].sets.at(-1) || { kg: 0, reps: 0 };
    updated.exercises[exIndex].sets.push({ ...lastSet, completed: false });
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
    const updated = { ...activeWorkout };
    updated.exercises[exIndex].exerciseNote = note;
    setActiveWorkout(updated);
  }, [activeWorkout]);

  const handleDeleteExercise = useCallback((exIndex) => {
    if (confirm('Delete this exercise?')) {
      const updated = { ...activeWorkout };
      updated.exercises.splice(exIndex, 1);
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

  // --- ACTIONS: TEMPLATES ---

  const handleSaveTemplate = useCallback(() => {
    if (!editingTemplate.name.trim()) return;
    if (editingTemplate.id) {
      setTemplates(templates.map(t => t.id === editingTemplate.id ? editingTemplate : t));
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
    
    // Build sets with auto-memory
    let sets;
    if (lastSets.length > 0) {
      sets = lastSets.map(s => ({ kg: Number(s.kg) || 0, reps: Number(s.reps) || 0, completed: false }));
      if (suggested) {
        sets = [...sets, { kg: suggested.suggestedKg, reps: suggested.suggestedReps, completed: false }];
      }
    } else {
      sets = exercise.defaultSets ? [...exercise.defaultSets] : [{ kg: 0, reps: 0 }];
      sets = sets.map(s => ({ ...s, completed: false }));
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
    link.download = `workout_export_${exportType}_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    closeExportModal();
  }, [workouts, templates, exercisesDB, weeklyGoal, exportType, exportPeriod, exportStartDate, exportEndDate, exportExerciseId, closeExportModal]);

  const handleImport = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);

        if (data.workouts) {
          setWorkouts(prev => {
            const existingIds = new Set(prev.map(w => w.id));
            const newOnes = data.workouts.filter(w => !existingIds.has(w.id));
            return [...newOnes, ...prev];
          });
        }

        if (data.templates) {
          setTemplates(prev => {
            const existingIds = new Set(prev.map(t => t.id));
            const newOnes = data.templates.filter(t => !existingIds.has(t.id));
            return [...prev, ...newOnes];
          });
        }

        if (data.exercisesDB) {
          setExercisesDB(prev => {
            const existingIds = new Set(prev.map(e => e.id));
            const newOnes = data.exercisesDB.filter(e => !existingIds.has(e.id));
            return [...prev, ...newOnes];
          });
        }

        if (data.weeklyGoal && !weeklyGoal) {
          setWeeklyGoal(data.weeklyGoal);
        }

        alert('Import completed (merged)');
      } catch {
        alert('Invalid JSON file');
      }
    };

    reader.readAsText(file);
  }, []);


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
                onStartWorkout={() => setView('selectTemplate')}
                onManageTemplates={() => { setEditingTemplate({ name: '', exercises: [] }); setView('templates'); }}
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
              onDeleteWorkout={(id) => { if (confirm('Delete this workout?')) setWorkouts(workouts.filter(w => w.id !== id)); }}
              onEditWorkout={(updatedWorkout) => { setWorkouts(workouts.map(w => w.id === updatedWorkout.id ? updatedWorkout : w)); }}
              exercisesDB={exercisesDB}
              filter={historyFilter}
              onFilterChange={setHistoryFilter}
            />
          )}

          {view === 'exercises' && (
            <ExercisesView
              exercisesDB={exercisesDB}
              onAddExercise={() => {
                setEditingExercise({ name: '', category: 'Push', muscles: [], defaultSets: [{ kg: 0, reps: 0 }], usesBodyweight: false });
                setView('createExercise');
              }}
              onEditExercise={(ex) => { setEditingExercise(ex); setView('createExercise'); }}
              onDeleteExercise={handleDeleteExerciseFromDB}
              onViewDetail={(id) => { setSelectedExerciseId(id); setView('exerciseDetail'); }}
            />
          )}

          {view === 'createExercise' && editingExercise && (
            <CreateExerciseView
              exercise={editingExercise}
              onChange={setEditingExercise}
              onSave={() => handleSaveExercise(editingExercise)}
              onCancel={() => { setView('exercises'); setEditingExercise(null); }}
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
              onDelete={(id) => setTemplates(templates.filter(t => t.id !== id))}
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

                const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                const ext = data.format === 'json' ? 'json' : 'txt';
                link.download = `${filename}.${ext}`;
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
                  setWorkouts(workouts.filter(w => w.id !== id));
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
            setEditingExercise({ name: '', category: 'Push', muscles: [], defaultSets: [{ kg: 0, reps: 0 }], usesBodyweight: false });
            closeExerciseSelector();
            setView('createExercise');
          }}
        />
      )}
      {pendingSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div
            data-ui-anim
            className={`bg-gradient-to-br from-slate-900/95 to-black/95 text-white p-8 rounded-2xl w-[95%] max-w-md border border-slate-700/50 ui-modal-scale ${summaryVisible ? 'animate-modal-fade-in' : 'opacity-0 scale-95'}`}
          >
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-3xl font-black bg-gradient-to-r from-blue-400 to-blue-300 bg-clip-text text-transparent">
                  {pendingSummary.cleanData.totalVolume.toLocaleString()}
                </h2>
                <p className="text-xs text-slate-400 mt-1 font-semibold tracking-widest">TOTAL VOLUME</p>
              </div>
              <button onClick={() => setPendingSummary(null)} className="text-slate-500 hover:text-slate-300 transition">
                <span className="text-xl">✕</span>
              </button>
            </div>

            {/* Main stats row */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4">
                <p className="text-slate-400 text-xs font-semibold tracking-widest mb-2">SETS COMPLETED</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-white">{pendingSummary.cleanData.completedSets}</span>
                  {pendingSummary.comparison && (
                    <span className="text-xl" title={`${pendingSummary.comparison.prevVolume ? 'vs ' + Math.round(pendingSummary.comparison.prevVolume / 1000) + 'k prev' : ''}`}>
                      {pendingSummary.comparison.trend}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4">
                <p className="text-slate-400 text-xs font-semibold tracking-widest mb-2">DURATION</p>
                <p className="text-2xl font-black text-white">{pendingSummary.metrics.duration}m</p>
              </div>
            </div>

            {/* Feedback text */}
            <div className="bg-blue-950/30 border border-blue-500/20 rounded-lg p-4 mb-6 text-center">
              <p className="text-lg font-bold text-blue-300">{pendingSummary.feedback}</p>
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
                  <p className="text-xs text-slate-400 font-semibold tracking-widest mb-3">MUSCLE DISTRIBUTION</p>
                  <div className="flex justify-center">
                    <svg width="200" height="200" viewBox="0 0 200 200" className="drop-shadow-lg">
                      <defs>
                        <filter id="radarGlow">
                          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                          <feMerge>
                            <feMergeNode in="coloredBlur"/>
                            <feMergeNode in="SourceGraphic"/>
                          </feMerge>
                        </filter>
                      </defs>
                      <g transform="translate(100,100)">
                        {/* Concentric circles */}
                        {[1, 2, 3].map((r, i) => (
                          <circle key={i} r={i * 25} fill="none" stroke="#334155" strokeWidth="0.5" opacity="0.5" />
                        ))}
                        
                        {/* Axes and labels */}
                        {(() => {
                          const groups = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'];
                          const values = groups.map(g => radarData[g] || 0);
                          
                          // Already normalized 0-1, just scale to radius
                          const points = values.map((v, i) => {
                            const angle = (i / groups.length) * Math.PI * 2 - Math.PI / 2;
                            const radius = v * 75;
                            return `${Math.cos(angle) * radius},${Math.sin(angle) * radius}`;
                          }).join(' ');
                          
                          return (
                            <>
                              {/* Axes */}
                              {groups.map((g, i) => {
                                const angle = (i / groups.length) * Math.PI * 2 - Math.PI / 2;
                                const x = Math.cos(angle) * 80;
                                const y = Math.sin(angle) * 80;
                                return (
                                  <g key={g}>
                                    <line x1={0} y1={0} x2={x} y2={y} stroke="#475569" strokeWidth="0.5" opacity="0.7" />
                                    <text 
                                      x={x * 1.25} 
                                      y={y * 1.25} 
                                      fontSize="10" 
                                      fill="#cbd5e1" 
                                      fontWeight="600"
                                      textAnchor={Math.abs(x) > 10 ? (x > 0 ? 'start' : 'end') : 'middle'}
                                      dominantBaseline="middle"
                                    >
                                      {g}
                                    </text>
                                  </g>
                                );
                              })}
                              
                              {/* Data polygon with animation */}
                              <polygon 
                                points={points} 
                                fill="#3b82f6" 
                                fillOpacity="0.2" 
                                stroke="#3b82f6" 
                                strokeWidth="1.5"
                                filter="url(#radarGlow)"
                                className="animate-pulse"
                              />
                            </>
                          );
                        })()}
                      </g>
                    </svg>
                  </div>
                </div>
              );
            })()}

            {/* Tag Selection */}
            <div className="mb-6">
              <p className="text-xs text-slate-400 font-semibold tracking-widest mb-2">OPTIONAL TAGS</p>
              <div className="flex flex-wrap gap-2">
                {['sleep bad', 'cut', 'bulk', 'stress'].map(tag => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTags(prev => 
                      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                    )}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
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

            {/* Action buttons */}
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => {
                  const workoutWithTags = { ...pendingSummary.completedWorkout, tags: selectedTags };
                  setWorkouts([workoutWithTags, ...workouts]);
                  setActiveWorkout(null);
                  setWorkoutTimer(0);
                  setPendingSummary(null);
                  setSelectedTags([]);
                  setView('home');
                }}
                className="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold text-sm transition-all duration-200 ease-out ui-press shadow-lg shadow-blue-600/30"
              >
                Save Workout
              </button>
              
              {pendingSummary.templateId && (
                <button 
                  onClick={() => {
                    if (pendingSummary.templateId) {
                      const ti = templates.findIndex(t => t.id === pendingSummary.templateId);
                      if (ti !== -1) {
                        const newTemplate = { ...templates[ti] };
                        newTemplate.exercises = (pendingSummary.completedWorkout.exercises || []).map(ex => ({ name: ex.name, category: ex.category, sets: ex.sets.map(s => ({ kg: 0, reps: 0 })) }));
                        const updated = [...templates]; 
                        updated[ti] = newTemplate; 
                        setTemplates(updated);
                      }
                    }
                    const workoutWithTags = { ...pendingSummary.completedWorkout, tags: selectedTags };
                    setWorkouts([workoutWithTags, ...workouts]);
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
    </>
  );
}