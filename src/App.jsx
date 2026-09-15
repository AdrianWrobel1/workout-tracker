import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';

// DOMAIN
import { calculate1RM } from './domain/calculations';
import { getExerciseRecords, getLastCompletedSets, suggestNextWeight, checkSetRecords } from './domain/exercises';
import { prepareCleanWorkoutData, compareWorkoutToPrevious, generateSessionFeedback, calculateMuscleDistribution, detectPRsInWorkout, buildLastWorkoutSnapshot, generateCoachLens, calculateMasteryLevel, calculateMomentum, detectAnomalies } from './domain/workouts';
import { normalizeSetForStorage, normalizeWorkoutExerciseForStorage, isWarmupSet, resolveSetType, cloneTemplateExercisesForActive, duplicateTemplate as duplicateTemplateValue } from './domain/workoutExtensions';
import { shouldAutoStartRest, normalizeRestDuration, resolveRestForWorkoutSet, sanitizeExerciseRestForStorage, DEFAULT_REST_SEC } from './domain/restTimer';
import { sanitizeProgressionForStorage } from './domain/progression';
import { sanitizeMusclesForStorage } from './domain/muscles';
import { resolveRecommendation } from './domain/progressionAdapter';
import {
  updateSetField as applySetField,
  toggleSetCompletion as applyToggleSet,
  addSet as applyAddSet,
  addWarmupSet as applyAddWarmupSet,
  deleteSet as applyDeleteSet,
  setSetType as applySetType,
  deleteExercise as applyDeleteExercise,
  reorderExercises as applyReorderExercises,
  createSuperset as applyCreateSuperset,
  removeSuperset as applyRemoveSuperset,
  buildCompletedWorkout
} from './domain/workoutActions';
import { isWorkoutPersisted } from './domain/activeWorkoutView';
import { generateId } from './domain/ids';
import {
  createScheduledFromTemplate,
  createScheduledCustom,
  updateScheduledWorkout,
  markScheduledCompleted,
  deleteScheduledWorkout,
  normalizeScheduledList,
  buildActiveBlueprintFromScheduled,
  getUpcomingPlans,
} from './domain/scheduledWorkouts';
import { buildSessionReturn, resolveSessionBackTarget } from './domain/sessionDetail';
import { validateImportPayload, isValidWorkout, isValidTemplate, isValidExercise, normalizeImportedWorkout, normalizeImportedExercise, mergeById } from './services/importExport';
import { calculateReadiness, calculateBlockProgress, optimizeSession, calculateMuscleBalance, muscleStats } from './analytics';

// HOOKS
import { useDebouncedLocalStorage, useDebouncedLocalStorageManual } from './hooks/useLocalStorage';
import { useIndexedDBStore, useIndexedDBSetting, useIndexedDBDirect } from './hooks/useIndexedDB';
import { useRecordsIndex } from './hooks/useRecordsIndex';
import { useModals } from './contexts/ModalContext';
import { useWorkouts, useUI, useSettings, useRestTimer } from './contexts/index.js';
import { SmartPlanProvider } from './contexts/SmartPlanContext.jsx';
import { TemplatesProvider } from './contexts/TemplatesContext.jsx';

// SERVICES
import { storage, STORES } from './services/storageService';

// COMPONENTS
import { MiniWorkoutBar } from './components/MiniWorkoutBar';
import { RestTimerBar } from './components/RestTimerBar';
import { UndoToast } from './components/UndoToast';
import { HiddenWorkoutBadge } from './components/HiddenWorkoutBadge';
import { BottomNav } from './components/BottomNav';
import { ExerciseSelectorModal } from './components/ExerciseSelectorModal';
import { CustomKeypad } from './components/CustomKeypad';
import { PRBanner } from './components/PRBanner';
import { MuscleBodyMap } from './components/MuscleBodyMap';

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
import { PlanningCalendarView } from './views/PlanningCalendarView';
import { SettingsView } from './views/SettingsView';
import { MonthlyProgressView } from './views/MonthlyProgressView';
import { ExportDataView } from './views/ExportDataView';

const ENABLE_BLOCKS = true;
const ENABLE_OPTIMIZER = true;
const ENABLE_READINESS = true;

const AnimatedMetricValue = ({ value, duration = 420, suffix = '' }) => {
  const targetValue = Number(value) || 0;
  const [display, setDisplay] = useState(targetValue);

  useEffect(() => {
    const startValue = display;
    if (!Number.isFinite(targetValue) || targetValue === startValue) return undefined;

    const startTime = performance.now();
    let frame;

    const step = (now) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = Math.round(startValue + (targetValue - startValue) * eased);
      setDisplay(next);
      if (progress < 1) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [targetValue, duration]);

  return <>{display}{suffix}</>;
};


export default function App() {
  // --- CONTEXT HOOKS ---
  const {
    workouts, setWorkouts,
    templates, setTemplates,
    exercisesDB, setExercisesDB,
    scheduledWorkouts, setScheduledWorkouts,
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
    reduceAnimations, setReduceAnimations,
    activePRBanner, setActivePRBanner,
    prBannerVisible, setPRBannerVisible,
    restDurationSec, setRestDurationSec,
    restAutoStart, setRestAutoStart,
    restSoundEnabled, setRestSoundEnabled,
  } = useSettings();

  const { startRest, skipRest } = useRestTimer();

  // --- CONTEXT ---
  const { showExerciseSelector, closeExerciseSelector, openExerciseSelector, showExportModal, closeExportModal } = useModals();

  // --- HOOKS ---
  const { recordsIndex, updateRecordForExercise, updateRecordsForExercises, rebuildIndex, getRecords, clearCache } = useRecordsIndex();

  // --- LOCAL STATE ---
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [toast, setToast] = useState(null);
  const [returnTo, setReturnTo] = useState(null);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState(null);
  const [openSessionAfterSave, setOpenSessionAfterSave] = useState(false);
  const [selectedExerciseIndex, setSelectedExerciseIndex] = useState(null);
  const [historyScrollPosition, setHistoryScrollPosition] = useState(null);
  const [hasHydratedPersistence, setHasHydratedPersistence] = useState(false);
  const [scrollToWorkoutDate, setScrollToWorkoutDate] = useState(null);
  const [autosaveStatus, setAutosaveStatus] = useState({ state: 'idle', savedAt: null }); // idle | saving | saved | error
  const [tabTransitionClass, setTabTransitionClass] = useState('ui-tab-slide-in-right');
  const [hiddenWorkout, setHiddenWorkout] = useState(null);
  
  // Undo deleted workout
  const undoTimeoutRef = useRef(null);
  const autosaveRequestRef = useRef(0);
  const prBannerTimeoutRef = useRef(null);
  // Guards the finish-save path: rapid double-taps on Save must persist the
  // workout exactly once (same id → single history entry).
  const saveInFlightRef = useRef(false);
  const activeTabRef = useRef(activeTab);
  const activeWorkoutRef = useRef(activeWorkout);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    activeWorkoutRef.current = activeWorkout;
  }, [activeWorkout]);

  useEffect(() => {
    document.documentElement.setAttribute('data-motion', reduceAnimations ? 'reduced' : 'full');
    return () => {
      document.documentElement.setAttribute('data-motion', 'full');
    };
  }, [reduceAnimations]);

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
          console.log(`[ok] Migrated ${migrated.migratedWorkouts} workouts from localStorage`);
        }

        // Load entities from IndexedDB
        const exercises = await storage.getAllFromStore(STORES.EXERCISES);
        const workouts = await storage.getAllFromStore(STORES.WORKOUTS);
        const templates = await storage.getAllFromStore(STORES.TEMPLATES);

        setExercisesDB(exercises || []);
        // Exclude activeWorkout from list so it never gets overwritten by list persistence
        setWorkouts((workouts || []).filter(w => w.id !== 'activeWorkout'));
        setTemplates(templates || []);
        // Planned workouts: separate store (v2 schema). Pre-v2 databases
        // have no such store — fall back to an empty schedule, never crash.
        try {
          const scheduled = await storage.getAllFromStore(STORES.SCHEDULED);
          setScheduledWorkouts(normalizeScheduledList(scheduled || []));
        } catch (scheduleErr) {
          console.warn('Scheduled workouts unavailable, starting empty:', scheduleErr);
          setScheduledWorkouts([]);
        }

        // Load settings
        const goal = await storage.getSetting('weeklyGoal', 4);
        const statsRange = await storage.getSetting('defaultStatsRange', '3months');
        const weight = await storage.getSetting('userWeight', null);
        const enableAlerts = await storage.getSetting('enablePerformanceAlerts', true);
        const enableHaptic = await storage.getSetting('enableHapticFeedback', false);
        const notes = await storage.getSetting('trainingNotes', '');
        const reduceMotion = await storage.getSetting('reduceAnimations', false);
        const restDuration = await storage.getSetting('restDurationSec', DEFAULT_REST_SEC);
        const restAuto = await storage.getSetting('restAutoStart', true);
        const restSound = await storage.getSetting('restSoundEnabled', true);
        // display prefs
        setWeeklyGoal(parseInt(goal) || 4);
        setDefaultStatsRange(statsRange || '3months');
        setUserWeight(Number(weight) || null);
        setEnablePerformanceAlerts(enableAlerts !== null ? enableAlerts : true);
        setEnableHapticFeedback(enableHaptic !== null ? enableHaptic : false);
        setTrainingNotes(typeof notes === 'string' ? notes : '');
        setReduceAnimations(Boolean(reduceMotion));
        setRestDurationSec(Number(restDuration) || DEFAULT_REST_SEC);
        setRestAutoStart(restAuto !== null ? Boolean(restAuto) : true);
        setRestSoundEnabled(restSound !== null ? Boolean(restSound) : true);

        // Load active workout if within 24h
        const activeWO = await storage.get(STORES.WORKOUTS, 'activeWorkout');
        if (activeWO && activeWO.startTime) {
          if (new Date() - new Date(activeWO.startTime) < 86400000) {
            setActiveWorkout(activeWO);
            setView('activeWorkout');
          }
        }

        console.log('[ok] Data loaded from IndexedDB');
      } catch (error) {
        console.error('Error initializing storage:', error);
      } finally {
        setHasHydratedPersistence(true);
      }
    })();
  }, []);

  // initial skeleton (cold start): show for ~350ms
  useEffect(() => {
    const t = setTimeout(() => setFirstLoad(false), 350);
    return () => clearTimeout(t);
  }, []);

  // Save Data (debounced). Workouts use incremental put/delete in handlers, not full setMany.
  useIndexedDBStore(STORES.EXERCISES, exercisesDB, 200, { skipSave: !hasHydratedPersistence });
  useIndexedDBStore(STORES.TEMPLATES, templates, 200, { skipSave: !hasHydratedPersistence });
  // Planned-workout persistence rides the same debounced IndexedDB hook —
  // no second storage system. Single-record writes below are belt-and-braces
  // for schedule mutations; the hook converges the rest.
  useIndexedDBStore(STORES.SCHEDULED, scheduledWorkouts, 200, { skipSave: !hasHydratedPersistence });
  
  // Persist settings (smaller payloads, can use settings API)
  // weeklyGoal is included: it is loaded on hydration, so it must also be
  // saved or user changes (and imported values) are silently lost on reload.
  useIndexedDBSetting('weeklyGoal', weeklyGoal, 300, { skipSave: !hasHydratedPersistence });
  useIndexedDBSetting('userWeight', userWeight, 300, { skipSave: !hasHydratedPersistence });
  useIndexedDBSetting('defaultStatsRange', defaultStatsRange, 300, { skipSave: !hasHydratedPersistence });
  useIndexedDBSetting('trainingNotes', trainingNotes, 500, { skipSave: !hasHydratedPersistence });
  useIndexedDBSetting('enablePerformanceAlerts', enablePerformanceAlerts, 500, { skipSave: !hasHydratedPersistence });
  useIndexedDBSetting('enableHapticFeedback', enableHapticFeedback, 500, { skipSave: !hasHydratedPersistence });
  useIndexedDBSetting('reduceAnimations', reduceAnimations, 500, { skipSave: !hasHydratedPersistence });
  useIndexedDBSetting('restDurationSec', restDurationSec, 500, { skipSave: !hasHydratedPersistence });
  useIndexedDBSetting('restAutoStart', restAutoStart, 500, { skipSave: !hasHydratedPersistence });
  useIndexedDBSetting('restSoundEnabled', restSoundEnabled, 500, { skipSave: !hasHydratedPersistence });

  // activeWorkout requires immediate async save (no debounce for critical data)
  const { saveAsync } = useIndexedDBDirect();
  useEffect(() => {
    if (!activeWorkout) {
      autosaveRequestRef.current += 1;
      setAutosaveStatus({ state: 'idle', savedAt: null });
      return;
    }

    const requestId = ++autosaveRequestRef.current;
    setAutosaveStatus(prev => ({ state: 'saving', savedAt: prev.savedAt }));

    const timeoutId = setTimeout(() => {
      (async () => {
        const ok = await saveAsync(STORES.WORKOUTS, { ...activeWorkout, id: 'activeWorkout' });
        if (requestId !== autosaveRequestRef.current) {
          if (!activeWorkoutRef.current) {
            storage.delete(STORES.WORKOUTS, 'activeWorkout').catch((err) => {
              console.error('Error clearing stale active workout snapshot:', err);
            });
          }
          return;
        }

        if (ok) {
          setAutosaveStatus({ state: 'saved', savedAt: new Date().toISOString() });
        } else {
          setAutosaveStatus(prev => ({ state: 'error', savedAt: prev.savedAt }));
        }
      })();
    }, 100); // Small debounce to batch rapid updates

    return () => clearTimeout(timeoutId);
  }, [activeWorkout, saveAsync]);
  // Safety cleanup: if active workout is cleared, remove snapshot entry after UI settles.
  // Guarded by firstLoad to avoid deleting a restorable workout during initial hydration.
  useEffect(() => {
    if (firstLoad || activeWorkout) return;

    const timer = setTimeout(() => {
      storage.delete(STORES.WORKOUTS, 'activeWorkout').catch((err) => {
        console.error('Error clearing inactive activeWorkout snapshot:', err);
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [activeWorkout, firstLoad]);

  // Timer
  useEffect(() => {
    let interval;
    if (activeWorkout && activeWorkout.startTime) {
      interval = setInterval(() => {
        const elapsed = Math.floor((new Date() - new Date(activeWorkout.startTime)) / 1000);
        if (!Number.isNaN(elapsed)) {
          setWorkoutTimer(Math.max(0, elapsed));
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeWorkout]);

  const readiness = useMemo(() => (
    ENABLE_READINESS ? calculateReadiness(workouts) : null
  ), [workouts]);
  const muscleBalance = useMemo(() => (
    calculateMuscleBalance(workouts, exercisesDB)
  ), [workouts, exercisesDB]);

  // Smart Plan Engine data
  const masteryData = useMemo(() => calculateMasteryLevel(workouts || []), [workouts]);
  const momentumData = useMemo(() => calculateMomentum(workouts || []), [workouts]);
  const anomalyDetection = useMemo(() => detectAnomalies(activeWorkout, workouts || []), [activeWorkout, workouts]);
  const consistencyData = useMemo(() => {
    const now = new Date();
    const weeksData = new Map();
    (workouts || []).forEach(w => {
      const wDate = new Date(w.date);
      const normalized = new Date(wDate);
      const day = (normalized.getDay() + 6) % 7;
      normalized.setDate(normalized.getDate() - day);
      normalized.setHours(0, 0, 0, 0);
      const weekKey = normalized.toISOString().split('T')[0];
      weeksData.set(weekKey, true);
    });
    let count = 0;
    for (let i = 0; i < 12; i++) {
      const weekEnd = new Date(now);
      weekEnd.setDate(now.getDate() - (i * 7));
      weekEnd.setHours(0, 0, 0, 0);
      const normalized = new Date(weekEnd);
      const day = (normalized.getDay() + 6) % 7;
      normalized.setDate(normalized.getDate() - day);
      normalized.setHours(0, 0, 0, 0);
      const weekKey = normalized.toISOString().split('T')[0];
      if (weeksData.has(weekKey)) count += 1;
    }
    return { activeWeeks: count, totalWeeks: 12, consistency: Math.round((count / 12) * 100) };
  }, [workouts]);

  const activeTemplateForProgress = useMemo(() => {
    if (!activeWorkout?.templateId) return null;
    return templates.find(template => template.id === activeWorkout.templateId) || null;
  }, [activeWorkout?.templateId, templates]);

  const activeBlockProgress = useMemo(() => {
    if (!ENABLE_BLOCKS || !activeTemplateForProgress?.block) return null;
    return calculateBlockProgress(activeTemplateForProgress, workouts, { strictTemplateIdMatch: true });
  }, [activeTemplateForProgress, workouts]);

  // Small Home preview of what's next — launcher only, never a calendar.
  const upcomingPlans = useMemo(
    () => getUpcomingPlans(scheduledWorkouts, { limit: 3 }),
    [scheduledWorkouts]
  );

  // Fallback auto-close for PR banner (prevents stuck banner states)
  useEffect(() => {
    if (prBannerTimeoutRef.current) {
      clearTimeout(prBannerTimeoutRef.current);
      prBannerTimeoutRef.current = null;
    }
    if (!prBannerVisible) return;

    const recordsCount = Math.max(1, Number(activePRBanner?.recordTypes?.length) || 1);
    const ttl = 2600 * recordsCount + 1400;
    prBannerTimeoutRef.current = setTimeout(() => {
      setPRBannerVisible(false);
    }, ttl);

    return () => {
      if (prBannerTimeoutRef.current) {
        clearTimeout(prBannerTimeoutRef.current);
        prBannerTimeoutRef.current = null;
      }
    };
  }, [prBannerVisible, activePRBanner, setPRBannerVisible]);

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
    // Sanitize the optional per-exercise rest override: a valid `restSec`
    // persists as part of the exercise record (existing IndexedDB store, no
    // schema change); absent/malformed values are dropped so the exercise
    // inherits the global default. History is untouched — this only affects
    // future rest timers.
    // The optional `progression` config is sanitized the same additive way:
    // valid config persists on the record, absent/malformed means OFF
    // (legacy behavior preserved, no migration, history untouched).
    // Muscle metadata is normalized into the canonical V2 shape
    // (primary/secondary/detail + synced muscles[]) the same additive way:
    // known exercises gain audited attribution, free-text tokens are
    // alias-normalized, and invalid tokens are dropped so the read-time
    // category fallback applies. History is untouched.
    const clean = sanitizeMusclesForStorage(sanitizeProgressionForStorage(sanitizeExerciseRestForStorage(exercise)));
    let newExerciseId;
    if (clean.id) {
      setExercisesDB(exercisesDB.map(e => e.id === clean.id ? clean : e));
      newExerciseId = clean.id;
    } else {
      newExerciseId = generateId();
      setExercisesDB([...exercisesDB, { ...clean, id: newExerciseId }]);
    }

    // If exercise was created from the planner, deliver it through the
    // draft backup (the calendar remounts and restores its in-progress
    // draft + appends this exercise) and return to the calendar.
    if (exerciseCreateSource === 'planned') {
      const saved = clean.id ? clean : { ...clean, id: newExerciseId };
      // Fresh token: the calendar applies each backup exactly once.
      setPlannedDraftBackup(prev => ({ token: generateId(), draft: prev?.draft ?? null, pickedExercise: saved }));
      setExerciseCreateSource(null);
      setEditingExercise(null);
      setView('calendar');
      return;
    }

    // If exercise was created from activeWorkout, add it and return
    if (exerciseCreateSource === 'activeWorkout' && activeWorkout) {
      const newExercise = normalizeWorkoutExerciseForStorage({
        exerciseId: newExerciseId, 
        name: exercise.name, 
        category: exercise.category,
        priority: 3,
        nonNegotiable: false,
        sets: exercise.defaultSets?.map(() => normalizeSetForStorage({ kg: 0, reps: 0, completed: false }, 'work')) || [normalizeSetForStorage({ kg: 0, reps: 0, completed: false }, 'work')]
      });
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

  const handleStartWorkout = useCallback((template, opts = {}) => {
    if (!template) return;

    // If there is already an active workout, ask user whether to go to it or start a new one
    if (activeWorkout) {
      const goToExisting = confirm('You already have an active workout. Press OK to go to it, Cancel to start a new workout and replace the current one.');
      if (goToExisting) {
        setView('activeWorkout');
        return;
      } else {
        const ok = confirm('Starting a new workout will replace your current active workout. Continue?');
        if (!ok) return;
        // proceed to replace
      }
    }

    const now = new Date();
    const timeLimit = Number(template?.optimizerRules?.defaultTimeLimitMin) || 0;
    let sourceTemplate = template;
    let optimizerMeta;

    if (ENABLE_OPTIMIZER && timeLimit > 0) {
      const optimized = optimizeSession(template, timeLimit, workouts, {
        minWorkSetsPerExercise: Number(template?.optimizerRules?.minWorkSetsPerExercise) || 1,
        keepTopPriorityCount: Number(template?.optimizerRules?.keepTopPriorityCount) || 1
      });
      sourceTemplate = optimized.optimizedTemplate || template;
      optimizerMeta = {
        timeLimitMin: timeLimit,
        mode: optimized.removed.length > 0 ? 'minimum-effective' : 'full',
        reduced: optimized.removed.length > 0
      };
    }

    const block = sourceTemplate?.block || template?.block;
    const currentWeek = Number(block?.currentWeek) || undefined;
    const currentWeekPlan = Array.isArray(block?.weekPlan)
      ? block.weekPlan.find((week) => Number(week?.weekIndex) === currentWeek)
      : null;

    const blockRef = ENABLE_BLOCKS && block?.blockId
      ? {
          blockId: block.blockId,
          weekIndex: currentWeek,
          microcycle: currentWeek,
          isDeloadWeek: Boolean(currentWeekPlan?.isDeload)
        }
      : undefined;

    // TEMPLATE → CLONE → ACTIVE: deep-clone first so nested structures
    // (sets, targetMuscles, progression/rest config, notes, superset links)
    // never share references with the blueprint. Stale exerciseIds are kept
    // as-is (graceful orphan) — resolution falls back to global defaults.
    const clonedExercises = cloneTemplateExercisesForActive(sourceTemplate.exercises || []);
    const exercises = clonedExercises.map((exercise) => {
      const dbExercise = exercise.exerciseId != null
        ? exercisesDB.find(item => item.id === exercise.exerciseId)
        : exercisesDB.find(item => item.name === exercise.name);

      return normalizeWorkoutExerciseForStorage({
        ...exercise,
        exerciseId: exercise.exerciseId ?? dbExercise?.id ?? null,
        // Explicit blueprint config contract (spread preserves the rest):
        // name, category, supersetId, planNotes, priority, nonNegotiable,
        // estimatedSetSec, targetMuscles (copied), progression (copied),
        // sets[{kg,reps,setType,warmup,rir,tempo,pauseSec}] reset to open.
        // Timer runtime is never copied (lives in RestTimerContext only).
        // Plans/defaultPlanId/lastWorkoutSnapshot/templatePrevious stay on
        // the template (guidance/memory, not working copy).
        sets: (exercise.sets || []).map(set => normalizeSetForStorage({
          ...set,
          completed: false,
          // Active working copy never inherits template hints/PR flags.
          suggestedKg: undefined,
          suggestedReps: undefined,
          isBest1RM: false,
          isBestSetVolume: false,
          isHeaviestWeight: false
        }))
      });
    });

    setActiveWorkout({
      // Planned-start override: when launching from a scheduled plan the
      // stored templateId is the plan's source template (or null for custom
      // plans) so template memory/snapshot updates still resolve correctly.
      templateId: opts.templateId !== undefined ? opts.templateId : template.id,
      name: template.name,
      note: '',
      date: now.toISOString().split('T')[0],
      startTime: now.toISOString(),
      exercises,
      // Linkage for completion fulfilment (stripped before history write).
      ...(opts.plannedId != null ? { plannedId: opts.plannedId } : {}),
      ...(blockRef ? { blockRef } : {}),
      ...(optimizerMeta ? { optimizerMeta } : {}),
      templateSnapshot: JSON.parse(JSON.stringify(template))
    });
    setWorkoutTimer(0);
    setView('activeWorkout');
    setActiveTab('home');
  }, [exercisesDB, workouts]);

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
        if (ts !== ws) reasons.push(`Sets changed for ${wi.name} (${ts} -> ${ws})`);
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

  // Helper to show toast message (declared before finish so the
  // finish guard can reuse it without a TDZ cycle).
  const showToast = useCallback((message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2000);
  }, []);

  const handleFinishWorkout = useCallback(() => {
    if (!activeWorkout) return;
    // Idempotency: a rapid double-tap on Finish must not build two summaries.
    if (pendingSummary) return;
    // A finish with zero completed sets would persist an empty session that
    // inflates workout counts in History/Statistics with no training data.
    // Warm-up-only sessions are still allowed (honest zeros, not emptiness).
    const hasAnyCompletedSet = (activeWorkout.exercises || []).some((ex) =>
      (ex.sets || []).some((s) => s?.completed)
    );
    if (!hasAnyCompletedSet) {
      showToast('Complete at least one set to finish your workout');
      return;
    }
    // The session is over — drop the transient rest timer (never persisted).
    skipRest();
    // Canonical durable builder: deep clone (PR detection mutates its input),
    // collision-safe id, full ISO timestamp. Active workout is NOT cleared
    // here — it stays autosaved until the user confirms Save, so a refresh
    // between Finish and Save loses only the summary modal, not the data.
    // The plan link (plannedId) is provenance for fulfilment only — it is
    // stripped here so history records keep their canonical shape.
    const now = new Date();
    const { plannedId: linkedPlanId, ...finishedWorkout } = buildCompletedWorkout(activeWorkout, { now, id: generateId(), tags: [] });
    const completedWorkout = finishedWorkout;
    const template = templates.find(t => t.id === activeWorkout.templateId);
    const baseTemplate = template || activeWorkout.templateSnapshot || null;
    const diff = baseTemplate ? computeTemplateDiff(baseTemplate, activeWorkout) : { changed: true, reasons: ['No template associated for this workout'] };
    const metrics = calcSummaryMetrics(completedWorkout);
    completedWorkout.duration = metrics.duration;
    const muscleTotals = computeMuscleTotals(completedWorkout);
    
    // Prepare clean data and comparison (canonical BW-aware so Finish
    // can never diverge from Session/History/Statistics for one workout).
    const cleanData = prepareCleanWorkoutData(completedWorkout, exercisesDB, userWeight);
    const comparison = compareWorkoutToPrevious(completedWorkout, workouts, { exercisesDB, userWeight });
    const feedback = generateSessionFeedback(cleanData.totalVolume, cleanData.completedSets, comparison?.trend || 'flat');
    
    // Pre-calculate PR status (on clone; no mutation of activeWorkout)
    const prStatus = detectPRsInWorkout(completedWorkout, workouts, calculate1RM, getExerciseRecords);
    const hasPR = Object.keys(prStatus).length > 0;
    const coachLens = generateCoachLens(
      completedWorkout,
      workouts,
      comparison,
      prStatus
    );
    
    setSelectedTags([]); // reset tag selection
    setPendingSummary({ 
      completedWorkout: { ...completedWorkout, prStatus, hasPR }, 
      templateId: template?.id || null,
      plannedId: linkedPlanId ?? null,
      diff, 
      metrics: { ...metrics, muscleTotals },
      cleanData,
      comparison,
      feedback,
      coachLens
    });
  }, [activeWorkout, pendingSummary, templates, workouts, exercisesDB, userWeight, getExerciseRecords, skipRest, showToast]);
  const handleMinimizeWorkout = useCallback(() => {
    setIsWorkoutMinimized(true);
    // when workout is minimised, return user to previous active tab/view
    const target = activeTabRef.current || 'home';
    setView(target);
    // ensure we see the top of the new view
    requestAnimationFrame(() => {
      const main = document.querySelector('.app-content');
      if (main) main.scrollTo({ top: 0, behavior: 'instant' });
    });
  }, [setIsWorkoutMinimized, setView]);

  const handleDismissWorkout = useCallback(() => {
    if (!activeWorkout) return;
    // Keep a copy in local state so user can restore it via badge
    setHiddenWorkout(activeWorkout);
    setActiveWorkout(null);
    setIsWorkoutMinimized(false);
    // return user to previous tab/view
    const target = activeTabRef.current || 'home';
    setView(target);
  }, [activeWorkout, setActiveWorkout, setIsWorkoutMinimized, setView]);

  const handleRestoreHiddenWorkout = useCallback(() => {
    if (!hiddenWorkout) return;
    setActiveWorkout(hiddenWorkout);
    setHiddenWorkout(null);
    setView('activeWorkout');
  }, [hiddenWorkout, setActiveWorkout, setView]);

  const handleMaximizeWorkout = useCallback(() => {
    if (!activeWorkout) return;
    setIsWorkoutMinimized(false);
    setView('activeWorkout');
  }, [activeWorkout, setIsWorkoutMinimized, setView]);


  // Active Workout Modifications
  const handleUpdateSet = useCallback((exIndex, setIndex, field, value) => {
    if (!activeWorkout?.exercises?.[exIndex]?.sets?.[setIndex]) return;
    // Canonical immutable update (single source: workoutActions.updateSetField)
    let updated = applySetField(activeWorkout, exIndex, setIndex, field, value);

    // If this set is already completed, re-run PR detection to update flags
    const exId = updated.exercises[exIndex].exerciseId;
    const isCompleted = updated.exercises[exIndex].sets[setIndex].completed;
    if (exId && isCompleted) {
      const kg = Number(updated.exercises[exIndex].sets[setIndex].kg) || 0;
      const reps = Number(updated.exercises[exIndex].sets[setIndex].reps) || 0;

      // P1 FIX: Re-run PR detection after edit to update set flags correctly.
      // detectPRsInWorkout mutates its input, so pass a throwaway deep clone.
      const probe = JSON.parse(JSON.stringify(updated));
      const prStatus = detectPRsInWorkout(probe, workouts, calculate1RM, getExerciseRecords);

      // Fold PR flags into a NEW object (never mutate after setState).
      const recordTypes = prStatus[exId]?.recordsPerSet?.[setIndex];
      updated = {
        ...updated,
        exercises: updated.exercises.map((ex, idx) => {
          if (idx !== exIndex) return ex;
          return {
            ...ex,
            sets: ex.sets.map((set, sidx) => {
              if (sidx !== setIndex) return set;
              return {
                ...set,
                isBest1RM: recordTypes ? recordTypes.includes('best1RM') : false,
                isBestSetVolume: recordTypes ? recordTypes.includes('bestSetVolume') : false,
                isHeaviestWeight: recordTypes ? recordTypes.includes('heaviestWeight') : false
              };
            })
          };
        })
      };

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
    } else {
      setActiveWorkout(updated);
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

    // Canonical immutable update (no shallow nested mutation)
    setActiveWorkout(applySetField(activeWorkout, exerciseIndex, setIndex, field, value));

    handleCloseKeypad();
  }, [activeInput, activeWorkout, keypadValue, handleCloseKeypad]);

  const handleKeypadNext = useCallback(() => {
    if (!activeInput || !activeWorkout) return;

    const { exerciseIndex, setIndex, field } = activeInput;
    const value = keypadValue ? Number(keypadValue) : 0;

    // Canonical immutable update (no shallow nested mutation)
    const updated = applySetField(activeWorkout, exerciseIndex, setIndex, field, value);
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

  const handleToggleSet = useCallback((exIndex, setIndex) => {
    if (!activeWorkout?.exercises?.[exIndex]?.sets?.[setIndex]) return;
    // Canonical immutable toggle (auto-fill + toast handled inside).
    const { workout: toggled, toast: validationToast } = applyToggleSet(activeWorkout, exIndex, setIndex);
    if (validationToast) {
      showToast(validationToast);
      return;
    }

    let finalWorkout = toggled;

    // When marking completed, check for PRs and update default exercises.
    // All flag writes are folded into finalWorkout BEFORE setState (single set).
    const set = finalWorkout.exercises[exIndex].sets[setIndex];
    if (set.completed) {
      const exId = finalWorkout.exercises[exIndex].exerciseId;
      const exerciseName = finalWorkout.exercises[exIndex].name;
      if (exId) {
        const kg = Number(set.kg) || 0;
        const reps = Number(set.reps) || 0;
        if (kg > 0 && reps > 0 && !isWarmupSet(set)) {
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
              // Mark the set with PR flags (new object, not post-set mutation)
              finalWorkout = {
                ...finalWorkout,
                exercises: finalWorkout.exercises.map((ex, idx) => {
                  if (idx !== exIndex) return ex;
                  return {
                    ...ex,
                    sets: ex.sets.map((s, sidx) => (
                      sidx !== setIndex ? s : {
                        ...s,
                        isBest1RM: prRecords.isBest1RM,
                        isBestSetVolume: prRecords.isBestSetVolume,
                        isHeaviestWeight: prRecords.isHeaviestWeight
                      }
                    ))
                  };
                })
              };

              // Trigger PR banner display
              const recordTypes = [];
              if (prRecords.isHeaviestWeight) recordTypes.push('heaviestWeight');
              if (prRecords.isBestSetVolume) recordTypes.push('bestSetVolume');
              if (prRecords.isBest1RM) recordTypes.push('best1RM');

              setActivePRBanner({
                exerciseName,
                recordTypes,
                eventId: Date.now() + Math.random()
              });
              setPRBannerVisible(true);

              // Optional haptic feedback
              if (enableHapticFeedback && navigator.vibrate) {
                navigator.vibrate([20, 10, 20]);
              }
            }
          }
        }
      }
    }

    // Common commit: complete AND un-complete persist + repaint.
    // Completion-only side effects stay guarded: PR above (in-branch),
    // rest below (shouldAutoStartRest edge) and superset scroll (gated).
    setActiveWorkout(finalWorkout);

    // Rest timer: react to a fresh valid work-set completion only.
    // Rejected completions early-returned above; warmups, edits and
    // un-completions are filtered by shouldAutoStartRest. Guarded so a
    // timer failure can never break workout logging.
    // Effective duration: per-exercise `restSec` override → global default →
    // safe fallback (resolveRestForWorkoutSet never throws and never mutates).
    try {
      const prevSet = activeWorkout.exercises[exIndex]?.sets?.[setIndex] ?? null;
      const nextSet = finalWorkout.exercises[exIndex]?.sets?.[setIndex] ?? null;
      if (shouldAutoStartRest({ prevSet, nextSet, toast: null, autoStartEnabled: restAutoStart })) {
        const effectiveRestSec = resolveRestForWorkoutSet({
          workout: finalWorkout,
          exIndex,
          exercisesDB,
          globalRestSec: restDurationSec
        });
        const completedExerciseId = finalWorkout.exercises[exIndex]?.exerciseId;
        const source = completedExerciseId !== undefined && completedExerciseId !== null
          ? `${exIndex}:${setIndex}:ex:${completedExerciseId}`
          : `${exIndex}:${setIndex}`;
        startRest(effectiveRestSec, source);
      }
    } catch (err) {
      console.error('Rest timer auto-start failed:', err);
    }

      // If part of superset, auto-scroll to next exercise in superset (complete-only, preserved).
      if (set.completed && activeWorkout.exercises[exIndex].supersetId) {
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
  }, [activeWorkout, workouts, exercisesDB, enablePerformanceAlerts, enableHapticFeedback, showToast, startRest, restDurationSec, restAutoStart]);

  // Apply a progression recommendation into empty prescription slots only.
  // Manual user input always wins: completed sets, warmups and any set with
  // user-entered values are left untouched. Canonical immutable updates.
  const handleApplyRecommendation = useCallback((exIndex) => {
    const entry = activeWorkout?.exercises?.[exIndex];
    if (!entry || !activeWorkout) return;
    const dbExercise = exercisesDB.find(e => e.id === entry.exerciseId) || null;
    const tpl = activeWorkout?.templateId ? templates.find(t => t.id === activeWorkout.templateId) : null;
    const templatePrevious = tpl?.templatePrevious?.[entry.exerciseId] ?? null;
    const rec = resolveRecommendation({ exercise: dbExercise || { id: entry.exerciseId }, workouts, templatePrevious });
    if (!rec || !(rec.suggestedKg > 0 || rec.suggestedReps > 0)) return;
    let updated = activeWorkout;
    (entry.sets || []).forEach((s, setIndex) => {
      if (!s || s.completed || isWarmupSet(s)) return;
      if (!(Number(s.kg) > 0)) updated = applySetField(updated, exIndex, setIndex, 'kg', rec.suggestedKg);
      if (!(Number(s.reps) > 0)) updated = applySetField(updated, exIndex, setIndex, 'reps', rec.suggestedReps);
    });
    if (updated !== activeWorkout) setActiveWorkout(updated);
  }, [activeWorkout, workouts, exercisesDB, templates]);

  const handleAddSet = useCallback((exIndex) => {
    if (!activeWorkout) return;
    setActiveWorkout(applyAddSet(activeWorkout, exIndex));
  }, [activeWorkout]);

  const handleAddWarmupSet = useCallback((exIndex) => {
    if (!activeWorkout) return;
    setActiveWorkout(applyAddWarmupSet(activeWorkout, exIndex));
  }, [activeWorkout]);

  const handleDeleteSet = useCallback((exIndex, setIndex) => {
    if (!activeWorkout?.exercises?.[exIndex]?.sets?.[setIndex]) return;
    setActiveWorkout(applyDeleteSet(activeWorkout, exIndex, setIndex));
  }, [activeWorkout]);

  const handleToggleWarmup = useCallback((exIndex, setIndex) => {
    if (!activeWorkout?.exercises?.[exIndex]?.sets?.[setIndex]) return;
    const toggledType = isWarmupSet(activeWorkout.exercises[exIndex].sets[setIndex]) ? 'work' : 'warmup';
    setActiveWorkout(applySetType(activeWorkout, exIndex, setIndex, toggledType));
  }, [activeWorkout]);

  const handleSetSetType = useCallback((exIndex, setIndex, nextType) => {
    if (!activeWorkout?.exercises?.[exIndex]?.sets?.[setIndex]) return;
    if (!nextType) return;
    setActiveWorkout(applySetType(activeWorkout, exIndex, setIndex, nextType));
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
    if (!activeWorkout?.exercises?.[exIndex]) return;
    if (confirm('Delete this exercise?')) {
      // Canonical immutable delete (no splice on state-derived array).
      setActiveWorkout(applyDeleteExercise(activeWorkout, exIndex));
    }
  }, [activeWorkout]);

  const handleReorderExercises = useCallback((newOrder) => {
    if (!activeWorkout || !Array.isArray(newOrder)) return;
    setActiveWorkout(applyReorderExercises(activeWorkout, newOrder));
  }, [activeWorkout]);

  const handleReplaceExercise = useCallback((exIndex, newExercise) => {
    // Check for template-specific previous sets first
    let lastSets = [];
    let suggested = null;
    let templatePrevious = null;

    // For active workouts from a template, prefer template-specific sets
    if (activeWorkout?.templateId) {
      const template = templates.find(t => t.id === activeWorkout.templateId);
      templatePrevious = template?.templatePrevious?.[newExercise.id] ?? null;
      if (templatePrevious?.sets && templatePrevious.sets.length > 0) {
        lastSets = templatePrevious.sets;
      }
    }

    // Fall back to global previous if no template-specific sets found
    if (lastSets.length === 0) {
      lastSets = getLastCompletedSets(newExercise.id, workouts);
    }

    // Single precedence chain lives in the adapter (templatePrevious >
    // progression > legacy). Callers pass memory IN, never branch around it.
    // DB record carries the progression policy; falls back to the passed
    // exercise object.
    const dbRecord = exercisesDB.find(e => e.id === newExercise.id) || newExercise;
    const recommendation = resolveRecommendation({ exercise: dbRecord, workouts, templatePrevious });
    suggested = recommendation &&
      (recommendation.suggestedKg > 0 || recommendation.suggestedReps > 0)
      ? { suggestedKg: recommendation.suggestedKg, suggestedReps: recommendation.suggestedReps }
      : suggestNextWeight(lastSets);
    
    // Build sets with auto-memory
    let sets;
    if (lastSets.length > 0) {
      sets = lastSets.map(s => normalizeSetForStorage({
        kg: Number(s.kg) || 0,
        reps: Number(s.reps) || 0,
        completed: false
      }, 'work'));
      if (suggested) {
        sets = [...sets, normalizeSetForStorage({
          kg: suggested.suggestedKg,
          reps: suggested.suggestedReps,
          completed: false
        }, 'work')];
      }
    } else {
      sets = newExercise.defaultSets ? [...newExercise.defaultSets] : [{ kg: 0, reps: 0 }];
      sets = sets.map(s => normalizeSetForStorage({ ...s, completed: false }, 'work'));
    }
    
    const exData = normalizeWorkoutExerciseForStorage({
      exerciseId: newExercise.id,
      name: newExercise.name,
      category: newExercise.category,
      priority: 3,
      nonNegotiable: false,
      sets,
      exerciseNote: ''
    });
    const updated = {
      ...activeWorkout,
      exercises: activeWorkout.exercises.map((exercise, idx) => (
        idx === exIndex ? exData : exercise
      ))
    };
    setActiveWorkout(updated);
    closeExerciseSelector();
  }, [activeWorkout, workouts, templates, exercisesDB, closeExerciseSelector]);

  // --- SUPERSET HANDLERS ---

  const handleCreateSuperset = useCallback((exIndex1, exIndex2) => {
    if (!activeWorkout) return;
    // Canonical immutable link with collision-safe id (legacy: Date.now()).
    setActiveWorkout(applyCreateSuperset(activeWorkout, exIndex1, exIndex2));
  }, [activeWorkout]);

  const handleRemoveSuperset = useCallback((exIndex) => {
    if (!activeWorkout?.exercises?.[exIndex]) return;
    setActiveWorkout(applyRemoveSuperset(activeWorkout, exIndex));
  }, [activeWorkout]);

  const handleToggleFavorite = useCallback((exerciseId) => {
    setExercisesDB(prev => prev.map(ex => 
      ex.id === exerciseId ? { ...ex, isFavorite: !ex.isFavorite } : ex
    ));
  }, []);

  // --- ACTIONS: TEMPLATES ---

  // Blueprint storage: templates hold TARGETS/config only — never runtime.
  // Strips suggested hints + PR flags that may ride along via spreads.
  const normalizeTemplateForStorage = useCallback((template = {}) => ({
    ...template,
    exercises: (template.exercises || []).map(exercise => normalizeWorkoutExerciseForStorage({
      ...exercise,
      sets: (exercise.sets || []).map(set => {
        const { suggestedKg: _sk, suggestedReps: _sr, isBest1RM: _b1, isBestSetVolume: _bv, isHeaviestWeight: _hw, ...rest } = set || {};
        return normalizeSetForStorage({
          ...rest,
          completed: false
        });
      })
    }))
  }), []);

  const handleSaveTemplate = useCallback(() => {
    if (!editingTemplate || typeof editingTemplate.name !== 'string' || !editingTemplate.name.trim()) return;
    if (!Array.isArray(editingTemplate.exercises)) return;
    // Idempotent create: pre-assign the id so a rapid double-tap maps
    // instead of pushing twice. Functional update avoids stale-closure races.
    const id = editingTemplate.id || generateId();
    const normalizedTemplate = { ...normalizeTemplateForStorage(editingTemplate), id };
    setTemplates(prev => {
      const list = Array.isArray(prev) ? prev : [];
      if (list.some(t => t && t.id === id)) {
        return list.map(t => (t && t.id === id ? normalizedTemplate : t));
      }
      return [...list, normalizedTemplate];
    });
    setEditingTemplate(null);
  }, [editingTemplate, normalizeTemplateForStorage]);

  // --- ACTIONS: PLANNED WORKOUTS (schedule layer) ---
  // Every mutation below is a thin shell over the pure domain in
  // `src/domain/scheduledWorkouts.js`, the existing start path
  // (handleStartWorkout) and the canonical template pipeline
  // (normalizeTemplateForStorage + templates store) — no second systems.

  // PLANNED → ACTIVE: the snapshot becomes a blueprint for the EXISTING
  // start engine (conflict confirms, optimizer, cloning, timer reset).
  // The plan itself is never touched — the working copy is independent.
  const handleStartPlannedWorkout = useCallback((planId) => {
    const plan = scheduledWorkouts.find(p => p && p.id === planId);
    if (!plan) {
      showToast('Planned workout not found');
      return;
    }
    if (plan.status === 'completed') {
      showToast('This plan is already completed');
      return;
    }
    const blueprint = buildActiveBlueprintFromScheduled(plan);
    if (!blueprint || blueprint.exercises.length === 0) {
      showToast('Planned workout has no exercises');
      return;
    }
    handleStartWorkout(
      {
        id: plan.templateId || `planned-${plan.id}`,
        name: blueprint.name,
        exercises: blueprint.exercises,
      },
      { plannedId: plan.id, templateId: plan.templateId ?? null }
    );
  }, [scheduledWorkouts, handleStartWorkout, showToast]);

  // TEMPLATE → snapshot → PLANNED. Reads the template only.
  const handleScheduleFromTemplate = useCallback((templateId, dateKey) => {
    const tpl = templates.find(t => t && t.id === templateId);
    if (!tpl) {
      showToast('Template not found');
      return { ok: false, error: 'Template not found.' };
    }
    const plan = createScheduledFromTemplate(tpl, dateKey, { id: generateId() });
    if (!plan) {
      showToast('Could not schedule for this date');
      return { ok: false, error: 'Could not schedule for this date.' };
    }
    setScheduledWorkouts(prev => [...(Array.isArray(prev) ? prev : []), plan]);
    storage.set(STORES.SCHEDULED, plan).catch((err) => {
      console.error('Error persisting scheduled workout:', err);
    });
    return { ok: true, id: plan.id };
  }, [templates, showToast]);

  // CREATE NEW (+ optional SAVE AS TEMPLATE) and plan EDIT (planId set).
  const handleSaveCustomPlan = useCallback(({ planId = null, name, dateKey, exercises, saveAsTemplate = false }) => {
    let templateId = null;
    let templateName = null;
    if (planId == null && saveAsTemplate) {
      const tpl = {
        ...normalizeTemplateForStorage({ id: generateId(), name, exercises: exercises || [] }),
      };
      if (!tpl.name?.trim() || !Array.isArray(tpl.exercises) || tpl.exercises.length === 0) {
        return { ok: false, error: 'Add a name and at least one exercise.' };
      }
      setTemplates(prev => [...(Array.isArray(prev) ? prev : []), tpl]);
      storage.set(STORES.TEMPLATES, tpl).catch((err) => {
        console.error('Error persisting template from planner:', err);
      });
      templateId = tpl.id;
      templateName = tpl.name;
    }
    if (planId != null) {
      const existing = scheduledWorkouts.find(p => p && p.id === planId);
      if (!existing) return { ok: false, error: 'Planned workout not found.' };
      const next = updateScheduledWorkout(scheduledWorkouts, planId, { name, dateKey, exercises });
      const updated = next.find(p => p && p.id === planId);
      if (!updated || updated.dateKey !== (typeof dateKey === 'string' ? dateKey.trim() : updated.dateKey)) {
        return { ok: false, error: 'Pick a valid date.' };
      }
      setScheduledWorkouts(next);
      storage.set(STORES.SCHEDULED, updated).catch((err) => {
        console.error('Error persisting scheduled workout edit:', err);
      });
      setPlannedDraftBackup(null);
      return { ok: true, id: planId };
    }
    const plan = createScheduledCustom(
      { name, exercises, dateKey, templateId, templateName },
      { id: generateId() }
    );
    if (!plan) return { ok: false, error: 'Add a name, a valid date and at least one exercise.' };
    setScheduledWorkouts(prev => [...(Array.isArray(prev) ? prev : []), plan]);
    storage.set(STORES.SCHEDULED, plan).catch((err) => {
      console.error('Error persisting scheduled workout:', err);
    });
    setPlannedDraftBackup(null);
    return { ok: true, id: plan.id };
  }, [scheduledWorkouts, normalizeTemplateForStorage]);

  // DELETE removes only the planned event (confirm matches existing
  // destructive-action pattern). Templates/history/exercises untouched.
  const handleDeletePlan = useCallback((planId) => {
    const plan = scheduledWorkouts.find(p => p && p.id === planId);
    if (!plan) return;
    if (!confirm(`Delete planned "${plan.name}"? Templates and history are kept.`)) return;
    storage.delete(STORES.SCHEDULED, planId).catch((err) => {
      console.error('Error deleting scheduled workout:', err);
    });
    setScheduledWorkouts(prev => deleteScheduledWorkout(prev, planId));
  }, [scheduledWorkouts]);

  // Completion linkage: a saved session fulfils its plan (marked + linked),
  // history stays canonical — the plan is never written into `workouts`.
  const fulfillLinkedPlan = useCallback((plannedId, completedWorkoutId) => {
    if (plannedId == null) return;
    const plan = scheduledWorkouts.find(p => p && p.id === plannedId);
    if (!plan || plan.status === 'completed') return;
    const marked = {
      ...plan,
      status: 'completed',
      completedWorkoutId: completedWorkoutId ?? null,
      updatedAt: new Date().toISOString(),
    };
    storage.set(STORES.SCHEDULED, marked).catch((err) => {
      console.error('Error persisting plan fulfilment:', err);
    });
    setScheduledWorkouts(prev => markScheduledCompleted(prev, plannedId, completedWorkoutId));
  }, [scheduledWorkouts]);

  // Exercise-picker bridge for the planner: the global selector modal stays
  // the single picker; the picked exercise is delivered via the draft backup
  // so planner context survives modal AND create-exercise navigation.
  const [plannedDraftBackup, setPlannedDraftBackup] = useState(null);
  const handleRequestExercisePick = useCallback((draftSnapshot) => {
    setPlannedDraftBackup({ token: generateId(), draft: draftSnapshot ?? null, pickedExercise: null });
    setSelectorMode('planned');
    openExerciseSelector();
  }, [openExerciseSelector, setSelectorMode]);

  // DUPLICATE TEMPLATE: independent blueprint copy (deep clone + new id).
  // Execution memory (snapshots) is cleared — the copy starts without history.
  const handleDuplicateTemplate = useCallback((templateOrId) => {
    const source = typeof templateOrId === 'object' && templateOrId !== null
      ? templateOrId
      : templates.find(t => t && t.id === templateOrId);
    if (!source) return;
    const copy = duplicateTemplateValue(source, generateId);
    if (!copy) return;
    setTemplates(prev => [...(Array.isArray(prev) ? prev : []), copy]);
  }, [templates]);

  // --- SELECTOR LOGIC ---

  const handleSelectExercise = useCallback((exercise) => {
    // Check for template-specific previous sets first
    let lastSets = [];
    let suggested = null;
    let templatePrevious = null;

    // For active workouts from a template, prefer template-specific sets
    if (selectorMode === 'activeWorkout' && activeWorkout?.templateId) {
      const template = templates.find(t => t.id === activeWorkout.templateId);
      templatePrevious = template?.templatePrevious?.[exercise.id] ?? null;
      if (templatePrevious?.sets && templatePrevious.sets.length > 0) {
        lastSets = templatePrevious.sets;
      }
    }

    // Fall back to global previous if no template-specific sets found
    if (lastSets.length === 0) {
      lastSets = getLastCompletedSets(exercise.id, workouts);
    }
    // Single precedence chain lives in the adapter (templatePrevious >
    // progression > legacy). No caller-level bypass: memory goes IN.
    const recommendation = resolveRecommendation({ exercise, workouts, templatePrevious });
    suggested = recommendation &&
      (recommendation.suggestedKg > 0 || recommendation.suggestedReps > 0)
      ? { suggestedKg: recommendation.suggestedKg, suggestedReps: recommendation.suggestedReps }
      : suggestNextWeight(lastSets);
    
    // Build sets with suggested values as placeholder hints
    let sets;
    if (lastSets.length > 0) {
      sets = lastSets.map(s => normalizeSetForStorage({
        kg: 0,
        reps: 0,
        completed: false,
        suggestedKg: Number(s.kg) || 0,
        suggestedReps: Number(s.reps) || 0
      }, 'work'));
      if (suggested) {
        sets = [...sets, normalizeSetForStorage({
          kg: 0,
          reps: 0,
          completed: false,
          suggestedKg: suggested.suggestedKg,
          suggestedReps: suggested.suggestedReps
        }, 'work')];
      }
    } else {
      sets = exercise.defaultSets ? [...exercise.defaultSets] : [{ kg: 0, reps: 0 }];
      sets = sets.map(s => normalizeSetForStorage({
        kg: 0,
        reps: 0,
        completed: false,
        suggestedKg: Number(s.kg) || 0,
        suggestedReps: Number(s.reps) || 0
      }, 'work'));
    }
    
    const exData = normalizeWorkoutExerciseForStorage({
      exerciseId: exercise.id,
      name: exercise.name,
      category: exercise.category,
      priority: 3,
      nonNegotiable: false,
      sets
    });

    if (selectorMode === 'template') {
      // Blueprint targets: keep set config (type/warmup/rir/tempo/pause),
      // drop hints/PR runtime (never stored on templates).
      setEditingTemplate({
        ...editingTemplate,
        exercises: [...(editingTemplate.exercises || []), {
          ...exData,
          sets: exData.sets.map(set => ({
            kg: Number(set.kg) || 0,
            reps: Number(set.reps) || 0,
            warmup: Boolean(set.warmup),
            setType: set.setType || (set.warmup ? 'warmup' : 'work'),
            rir: set.rir ?? null,
            tempo: set.tempo ?? null,
            pauseSec: set.pauseSec ?? null
          }))
        }]
      });
    } else if (selectorMode === 'activeWorkout') {
      const newEx = normalizeWorkoutExerciseForStorage(exData);
      setActiveWorkout(prev => ({
        ...prev,
        exercises: [...(prev?.exercises || []), newEx]
      }));
    }
    closeExerciseSelector();
  }, [selectorMode, editingTemplate, activeWorkout, workouts, templates, closeExerciseSelector]);

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
    const normalizedFilteredWorkouts = filteredWorkouts.map((workout) => ({
      ...workout,
      exercises: (workout.exercises || []).map((exercise) => ({
        ...exercise,
        sets: (exercise.sets || []).map((set) => {
          const setType = resolveSetType(set);
          return {
            ...set,
            setType,
            warmup: setType === 'warmup',
            rir: set.rir ?? null,
            tempo: set.tempo ?? null,
            pauseSec: set.pauseSec ?? null
          };
        })
      }))
    }));

    // Build export data
    if (exportType === 'all') {
      dataToExport = { workouts: normalizedFilteredWorkouts, templates, exercisesDB: filteredExercisesDB, weeklyGoal };
    } else if (exportType === 'workouts') {
      dataToExport = { workouts: normalizedFilteredWorkouts };
    } else if (exportType === 'exercises') {
      dataToExport = { exercisesDB: filteredExercisesDB, workouts: normalizedFilteredWorkouts }; // Include workouts for context
    } else if (exportType === 'singleExercise') {
      dataToExport = { exercisesDB: filteredExercisesDB, workouts: normalizedFilteredWorkouts }; // Include workouts for context
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

    const reader = new FileReader();
    reader.onload = (event) => {
      (async () => {
        try {
          const data = JSON.parse(event.target.result);

          // PARSE → VALIDATE (flat backup shape and service export shape)
          const { ok, errors, normalized } = validateImportPayload(data);
          if (!ok) {
            alert(`Import rejected: ${errors.join('; ')}`);
            return;
          }
          const source = normalized;

          const validWorkouts = source.workouts.filter(w => {
            if (!isValidWorkout(w)) {
              console.warn('Invalid workout skipped:', w);
              return false;
            }
            return true;
          });
          const validTemplates = source.templates.filter(t => {
            if (!isValidTemplate(t)) {
              console.warn('Invalid template skipped:', t);
              return false;
            }
            return true;
          });
          const validExercises = source.exercisesDB.filter(ex => {
            if (!isValidExercise(ex)) {
              console.warn('Invalid exercise skipped:', ex);
              return false;
            }
            return true;
          });

          // NORMALIZE (setType/warmup flags, numeric coercion, defaults).
          // Exercises keep a valid `restSec` override; absent/malformed
          // values are dropped so old backups inherit the global default.
          const normalizedWorkouts = validWorkouts.map(normalizeImportedWorkout);
          const normalizedExercises = validExercises.map(normalizeImportedExercise);

          // RESOLVE CONFLICTS (deterministic: existing records win on id clash)
          const workoutMerge = mergeById(workouts, normalizedWorkouts);
          const templateMerge = mergeById(templates, validTemplates);
          const exerciseMerge = mergeById(exercisesDB, normalizedExercises);

          // WRITE + VERIFY — workouts have no auto-sync hook, so an explicit
          // write is required (previously imported workouts were lost on reload).
          if (workoutMerge.added.length > 0) {
            try {
              await storage.setMany(STORES.WORKOUTS, workoutMerge.added);
            } catch (err) {
              console.error('Import error: failed to persist workouts:', err);
              alert('Import failed while saving workouts. Nothing was changed.');
              return;
            }
            setWorkouts(workoutMerge.merged);
          }
          if (templateMerge.added.length > 0) setTemplates(templateMerge.merged);
          if (exerciseMerge.added.length > 0) setExercisesDB(exerciseMerge.merged);

          // weeklyGoal: adopt from backup only when the user has none set,
          // so a stale backup never silently clobbers an active goal.
          // (Persistence of the goal itself is covered by the settings hook.)
          // Supports both the flat backup shape and the service export shape.
          const importedSettings = Array.isArray(data?.data?.settings) ? data.data.settings : [];
          const importedGoal = typeof data.weeklyGoal === 'number'
            ? data.weeklyGoal
            : Number(importedSettings.find(s => s?.key === 'weeklyGoal')?.value) || null;
          if (typeof importedGoal === 'number' && Number.isFinite(importedGoal) && !weeklyGoal) {
            setWeeklyGoal(importedGoal);
          }

          // Rebuild PR cache from the merged in-memory lists (not a stale
          // storage read — imported workouts were just written above).
          try {
            await rebuildIndex(workoutMerge.merged, exerciseMerge.merged);
          } catch (error) {
            console.error('Error rebuilding PR cache after import:', error);
          }

          // REPORT
          alert(
            `Import completed: ${workoutMerge.added.length} workouts, ` +
            `${templateMerge.added.length} templates, ${exerciseMerge.added.length} exercises added ` +
            `(${workoutMerge.skipped + templateMerge.skipped + exerciseMerge.skipped} duplicates skipped, ` +
            `${source.workouts.length - validWorkouts.length + source.templates.length - validTemplates.length + source.exercisesDB.length - validExercises.length} invalid skipped)`
          );
        } catch (error) {
          console.error('Import error:', error);
          alert('Invalid JSON file or corrupted data');
        }
      })();
    };

    reader.onerror = () => {
      alert('Error reading file');
    };

    reader.readAsText(file);
    // Allow re-importing the same file twice in a row.
    e.target.value = '';
  }, [workouts, templates, exercisesDB, weeklyGoal, rebuildIndex, setWorkouts, setTemplates, setExercisesDB, setWeeklyGoal]);


  // --- SINGLE DELETE FUNNEL (P0-E) ---
  // Every workout delete (History, MonthlyProgress, ...) goes through here so
  // persistence, PR-cache invalidation and undo stay consistent. Previously the
  // monthly view only filtered in-memory state, so deletions resurrected on reload.
  const handleDeleteWorkoutById = useCallback(async (id) => {
    // Capture workout FIRST before state changes
    const workoutToDelete = workouts.find(w => w.id === id);
    if (!workoutToDelete) return;

    // Persist first: if the record cannot be removed, keep everything visible.
    try {
      await storage.delete(STORES.WORKOUTS, id);
    } catch (err) {
      console.error('Error persisting workout deletion:', err);
      showToast('Could not delete workout. Try again.');
      return;
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
  }, [workouts, setWorkouts, setDeletedWorkout, updateRecordsForExercises, showToast]);


  // --- NAVIGATION HANDLER ---
  const handleTabChange = useCallback((tabId) => {
    const tabOrder = { home: 0, history: 1, profile: 2 };
    const previousTab = activeTabRef.current;
    const hasAnimatedTabs = tabOrder[previousTab] !== undefined && tabOrder[tabId] !== undefined && previousTab !== tabId;

    if (hasAnimatedTabs) {
      setTabTransitionClass(
        tabOrder[tabId] > tabOrder[previousTab] ? 'ui-tab-slide-in-right' : 'ui-tab-slide-in-left'
      );
    }

    activeTabRef.current = tabId;
    setActiveTab(tabId);
    // Tab switches abandon any detail chain (History→Session→Exercise,
    // Statistics→Exercise): keeping a stale returnTo would send a later Back
    // to the wrong origin. Fresh detail entries set their own returnTo.
    setReturnTo(null);
    if (activeWorkout) setIsWorkoutMinimized(true);
    if (tabId === 'home') setView('home');
    else if (tabId === 'history') setView('history');
    else if (tabId === 'exercises') setView('exercises');
    // The profile tab lands directly on Statistics 2.0; the legacy profile
    // hub stays reachable from the Statistics header (no longer the default).
    else if (tabId === 'profile') { setView('profile'); setProfileSubview('statistics'); }
    else if (tabId === 'settings') setView('settings');
  }, [activeWorkout, setActiveTab, setIsWorkoutMinimized, setView, setProfileSubview, setReturnTo]);

  // Scroll to top when opening a detail/overlay view so user always starts at top of the sub-view
  useEffect(() => {
    const detailViews = ['workoutDetail', 'exerciseDetail', 'createExercise', 'templates', 'selectTemplate', 'monthlyProgress', 'calendar', 'exportData', 'settings', 'profile', 'statistics'];
    if (detailViews.includes(view)) {
      const main = document.querySelector('.app-content');
      if (main) main.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [view]);

  const showBottomNav = (view !== 'activeWorkout' || isWorkoutMinimized) && !(view === 'templates' && editingTemplate);
  const miniWorkoutBarVisible = Boolean(activeWorkout) && (view !== 'activeWorkout' || isWorkoutMinimized);
  const showMiniWorkoutBar = miniWorkoutBarVisible;
  // Floating rest bar stacks above the bottom nav and, when visible, the mini
  // workout bar; in fullscreen active-workout it hugs the safe-area bottom.
  const restBarBottomOffset = showMiniWorkoutBar
    ? 'calc(168px + env(safe-area-inset-bottom))'
    : showBottomNav
      ? 'calc(76px + env(safe-area-inset-bottom))'
      : 'calc(12px + env(safe-area-inset-bottom))';

  // --- RENDER ---
  return (
    <>
      <TemplatesProvider templates={templates} setTemplates={setTemplates}>
        <SmartPlanProvider
        workouts={workouts}
        readiness={readiness}
        muscleBalance={muscleBalance}
        masteryData={masteryData}
        consistencyData={consistencyData}
        currentSession={activeWorkout}
        anomalyDetection={anomalyDetection}
      >
        <div className="app-wrapper bg-black">
        <div className={`app-content w-full max-w-md mx-auto bg-zinc-900 shadow-2xl md:border-x md:border-white/5 ${view === 'history' ? 'history-view' : ''} ${showBottomNav ? 'pb-[calc(64px+env(safe-area-inset-bottom))]' : 'pb-safe'}`}>

          {/* VIEW ROUTING */}
          {view === 'home' && (
            firstLoad ? (
              <div className="bg-black text-white pb-28 px-4 py-6">
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
                readiness={readiness}
                muscleBalance={muscleBalance}
                masteryData={masteryData}
                anomalyDetection={anomalyDetection}
                trainingNotes={trainingNotes}
                onTrainingNotesChange={setTrainingNotes}
                onStartWorkout={() => setView('selectTemplate')}
                onManageTemplates={() => { setEditingTemplate(null); setView('templates'); }}
                onOpenCalendar={() => { setReturnTo({ view: 'home' }); setView('calendar'); }}
                upcomingPlans={upcomingPlans}
                onViewHistory={() => handleTabChange('history')}
                onViewWorkoutDetail={(date) => { setSelectedDate(date); setSelectedWorkoutId(null); setReturnTo({ view: 'home' }); setView('workoutDetail'); }}
                onOpenMonthlyProgress={(offset) => { setMonthOffset(offset); setView('monthlyProgress'); }}
              />
            )
          )}

          {view === 'history' && (
            <HistoryView
              workouts={workouts}
              getRecords={getRecords}
              scrollToWorkoutDate={scrollToWorkoutDate}
              onScrollToWorkoutDone={() => setScrollToWorkoutDate(null)}
              scrollPosition={historyScrollPosition}
              onSaveScrollPosition={setHistoryScrollPosition}
              onViewWorkoutDetail={(date, workoutId) => { setSelectedDate(date); setSelectedWorkoutId(workoutId ?? null); setReturnTo(null); setView('workoutDetail'); }}
              onDeleteWorkout={handleDeleteWorkoutById}
              onEditWorkout={async (updatedWorkout) => {
                try { await storage.set(STORES.WORKOUTS, updatedWorkout); } catch (err) { console.error('Error persisting workout edit:', err); }
                setWorkouts(prev => prev.map(w => w.id === updatedWorkout.id ? updatedWorkout : w));
              }}
              exercisesDB={exercisesDB}
              userWeight={userWeight}
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
              onViewDetail={(id) => { setSelectedExerciseId(id); setReturnTo(null); setView('exerciseDetail'); }}
              onToggleFavorite={handleToggleFavorite}
            />
          )}

          {view === 'createExercise' && editingExercise && (
            <CreateExerciseView
              exercise={editingExercise}
              onChange={setEditingExercise}
              onSave={() => handleSaveExercise(editingExercise)}
              globalRestSec={restDurationSec}
              onCancel={() => { 
                setExerciseCreateSource(null);
                setEditingExercise(null);
                if (exerciseCreateSource === 'activeWorkout') {
                  setView('activeWorkout');
                } else if (exerciseCreateSource === 'planned') {
                  // Draft backup (if any) restores the in-progress plan.
                  setView('calendar');
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
              userWeight={userWeight}
              globalRestSec={restDurationSec}
              onBack={() => {
                // Session and Statistics deep-link here via returnTo;
                // everywhere else keeps the legacy back-to-exercises behavior.
                if (returnTo?.view === 'profileStatistics') {
                  setReturnTo(returnTo.prev ?? null);
                  setProfileSubview('statistics');
                  setView('profile');
                  return;
                }
                const sessionTarget = resolveSessionBackTarget(returnTo);
                if (sessionTarget) {
                  setSelectedDate(sessionTarget.date);
                  setSelectedWorkoutId(sessionTarget.workoutId);
                  setReturnTo(returnTo.prev ?? null);
                  setView('workoutDetail');
                  return;
                }
                setView('exercises');
              }}
              onOpenWorkout={(date) => {
                // set return context so we can come back to exercise detail,
                // preserving whatever sits beneath (session or statistics).
                setReturnTo({ view: 'exerciseDetail', exerciseId: selectedExerciseId, prev: returnTo });
                setSelectedDate(date);
                setSelectedWorkoutId(null);
                setView('workoutDetail');
              }}
            />
          )}

          {view === 'workoutDetail' && selectedDate && (
            <WorkoutDetailView
              selectedDate={selectedDate}
              selectedWorkoutId={selectedWorkoutId}
              workouts={workouts}
              exercisesDB={exercisesDB}
              userWeight={userWeight}
              onOpenExercise={(exerciseId) => {
                // Session → Exercise Detail, with a way back to this session.
                // Preserve whatever sits beneath (statistics marker, prior
                // session) so depth ≥ 2 chains unwind instead of being lost.
                setReturnTo((prev) => ({ ...buildSessionReturn({ date: selectedDate, workoutId: selectedWorkoutId }), prev: prev ?? null }));
                setSelectedExerciseId(exerciseId);
                setView('exerciseDetail');
              }}
              onBack={() => {
                const dateToScroll = selectedDate;
                if (returnTo) {
                  if (returnTo.view === 'exerciseDetail') {
                    setSelectedExerciseId(returnTo.exerciseId);
                    setView('exerciseDetail');
                    setReturnTo(returnTo.prev ?? null);
                  } else {
                    setReturnTo(null);
                    setView(returnTo.view || 'home');
                  }
                } else {
                  if (activeTab === 'history') {
                    setScrollToWorkoutDate(dateToScroll);
                    setView('history');
                  } else setView('home');
                }
                setSelectedDate(null);
                setSelectedWorkoutId(null);
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
              readiness={readiness}
              blockProgress={activeBlockProgress}
              exercisesDB={exercisesDB}
              onCancel={async () => {
                if (confirm('Cancel?')) {
                  skipRest();
                  setActiveWorkout(null);
                  setWorkoutTimer(0);
                  setIsWorkoutMinimized(false);
                  setView('home');
                  try { await storage.delete(STORES.WORKOUTS, 'activeWorkout'); } catch (err) { console.error('Error clearing active workout snapshot:', err); }
                }
              }}
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
              onSetSetType={handleSetSetType}
              onAddWarmupSet={handleAddWarmupSet}
              onApplyRecommendation={handleApplyRecommendation}
              onOpenKeypad={handleOpenKeypad}
              onCreateSuperset={handleCreateSuperset}
              onRemoveSuperset={handleRemoveSuperset}
              autosaveStatus={autosaveStatus}
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
              exercisesDB={exercisesDB}
              onClose={() => setView('home')}
              onCreateNew={() => setEditingTemplate({ name: '', exercises: [] })}
              onEdit={(t) => { setEditingTemplate(JSON.parse(JSON.stringify(t))); setView('templates'); }}
              onDelete={(id) => { if (confirm('Delete this template? History will remain.')) setTemplates(prev => prev.filter(t => t.id !== id)); }}
              onDuplicate={handleDuplicateTemplate}
              onStart={handleStartWorkout}
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
              onWorkoutClick={(date) => { setSelectedDate(date); setSelectedWorkoutId(null); setReturnTo({ view: 'profile' }); setView('workoutDetail'); }}
              onOpenSettings={() => setView('settings')}
              defaultStatsRange={defaultStatsRange}
            />
          )}

          {view === 'profile' && profileSubview === 'statistics' && (
            <ProfileStatisticsView
              workouts={workouts}
              exercisesDB={exercisesDB}
              userWeight={userWeight}
              onOpenProfile={() => setProfileSubview('main')}
              onOpenSettings={() => setView('settings')}
              defaultStatsRange={defaultStatsRange}
              onOpenExercise={(id) => {
                setSelectedExerciseId(id);
                // Preserve whatever sits beneath so a chained return
                // (e.g. session → exercise → workout → exercise) unwinds.
                setReturnTo((prev) => ({ view: 'profileStatistics', prev: prev ?? null }));
                setView('exerciseDetail');
              }}
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

                const normalizeExportSet = (set = {}) => {
                  const setType = resolveSetType(set);
                  return {
                    ...set,
                    setType,
                    warmup: setType === 'warmup',
                    rir: set.rir ?? null,
                    tempo: set.tempo ?? null,
                    pauseSec: set.pauseSec ?? null
                  };
                };

                const normalizedWorkouts = workoutsToExport.map((workout) => ({
                  ...workout,
                  exercises: (workout.exercises || []).map((exercise) => ({
                    ...exercise,
                    sets: (exercise.sets || []).map((set) => normalizeExportSet(set))
                  }))
                }));

                const filename = data.exportMode === 'all'
                  ? `backup_${new Date().toISOString().split('T')[0]}`
                  : `workouts_${data.fromDate}_to_${data.toDate}`;

                let content = '';

                if (data.format === 'txt') {
                  content += 'WORKOUT EXPORT REPORT\n';
                  content += `Generated: ${new Date().toLocaleString('en-US')}\n`;
                  if (data.exportMode !== 'all') {
                    content += `Range: ${data.fromDate} to ${data.toDate}\n`;
                  }
                  content += `Workouts: ${normalizedWorkouts.length}\n`;
                  content += `Exercises: ${exercisesToExport.length}\n`;
                  if (data.exportMode === 'all') {
                    content += `Templates: ${templatesToExport.length}\n`;
                  }
                  content += `\n${'-'.repeat(72)}\n\n`;

                  if (data.exportMode === 'all' && templatesToExport.length > 0) {
                    content += 'TEMPLATE SUMMARY\n';
                    templatesToExport.forEach((template, index) => {
                      content += `${index + 1}. ${template.name} (${template.exercises?.length || 0} exercises)\n`;
                    });
                    content += `\n${'-'.repeat(72)}\n\n`;
                  }

                  normalizedWorkouts.forEach((workout, index) => {
                    content += `${index + 1}. ${workout.name} | ${workout.date}\n`;
                    content += `   Duration: ${workout.duration || 0} min\n`;

                    if (workout.tags?.length) {
                      content += `   Tags: ${workout.tags.join(' ')}\n`;
                    }

                    if (workout.note) {
                      content += `   Note: ${workout.note}\n`;
                    }

                    (workout.exercises || []).forEach((exercise) => {
                      const completedSets = (exercise.sets || []).filter(set => set.completed);
                      if (!completedSets.length) return;

                      content += `   - ${exercise.name}\n`;
                      completedSets.forEach((set, setIndex) => {
                        const setType = resolveSetType(set);
                        const kg = Number(set.kg) || 0;
                        const reps = Number(set.reps) || 0;
                        const estimated1RM = kg > 0 && reps > 0 && setType !== 'warmup'
                          ? calculate1RM(kg, reps)
                          : null;

                        const extras = [];
                        if (set.rir != null) extras.push(`RIR ${set.rir}`);
                        if (set.tempo) extras.push(`Tempo ${set.tempo}`);
                        if (set.pauseSec) extras.push(`Pause ${set.pauseSec}s`);

                        content += `      ${setIndex + 1}) [${setType.toUpperCase()}] ${kg} kg x ${reps}`;
                        if (estimated1RM != null) content += ` (1RM ${estimated1RM})`;
                        if (extras.length) content += ` | ${extras.join(' | ')}`;
                        content += '\n';
                      });
                    });

                    content += '\n';
                  });
                } else if (data.format === 'csv') {
                  const escapeCsv = (value) => {
                    const text = value == null ? '' : String(value);
                    if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
                    return text;
                  };

                  const rows = [[
                    'date',
                    'workout_name',
                    'duration_min',
                    'exercise_name',
                    'exercise_category',
                    'set_index',
                    'set_type',
                    'completed',
                    'kg',
                    'reps',
                    'volume',
                    'estimated_1rm',
                    'is_pr',
                    'rir',
                    'tempo',
                    'pause_sec',
                    'tags',
                    'note'
                  ]];

                  normalizedWorkouts.forEach((workout) => {
                    const tags = (workout.tags || []).join(' ');
                    const note = workout.note || '';

                    (workout.exercises || []).forEach((exercise) => {
                      (exercise.sets || []).forEach((set, setIndex) => {
                        const setType = resolveSetType(set);
                        const kg = Number(set.kg) || 0;
                        const reps = Number(set.reps) || 0;
                        const volume = kg * reps;
                        const estimated1RM = kg > 0 && reps > 0 && setType !== 'warmup'
                          ? calculate1RM(kg, reps)
                          : '';
                        const isPR = Boolean(set.isBest1RM || set.isBestSetVolume || set.isHeaviestWeight);

                        rows.push([
                          workout.date || '',
                          workout.name || '',
                          workout.duration || 0,
                          exercise.name || '',
                          exercise.category || '',
                          setIndex + 1,
                          setType,
                          set.completed ? 'yes' : 'no',
                          kg,
                          reps,
                          volume,
                          estimated1RM,
                          isPR ? 'yes' : 'no',
                          set.rir ?? '',
                          set.tempo ?? '',
                          set.pauseSec ?? '',
                          tags,
                          note
                        ]);
                      });
                    });
                  });

                  content = rows.map(row => row.map(escapeCsv).join(',')).join('\n');
                } else {
                  const exportData = {
                    workouts: normalizedWorkouts,
                    exercisesDB: exercisesToExport
                  };
                  if (data.exportMode === 'all') {
                    exportData.templates = templatesToExport;
                  }
                  content = JSON.stringify(exportData, null, 2);
                }

                const mimeByFormat = {
                  json: 'application/json;charset=utf-8',
                  txt: 'text/plain;charset=utf-8',
                  csv: 'text/csv;charset=utf-8'
                };
                const extByFormat = {
                  json: 'json',
                  txt: 'txt',
                  csv: 'csv'
                };

                const blob = new Blob([content], {
                  type: mimeByFormat[data.format] || 'text/plain;charset=utf-8'
                });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${filename}.${extByFormat[data.format] || 'txt'}`;
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
              onReset={async () => {
                if (!confirm('Reset all data?')) return;
                try {
                  await storage.clear(STORES.WORKOUTS);
                  await storage.clear(STORES.EXERCISES);
                  await storage.clear(STORES.TEMPLATES);
                  await storage.clear(STORES.SCHEDULED);
                  await storage.clear(STORES.SETTINGS);
                  // P0-F: also drop derived caches (PR index, reverse index),
                  // otherwise stale records rehydrate after reload.
                  // Matches the recovery path in ErrorBoundary.
                  await storage.clear(STORES.RECORDS_INDEX);
                  await storage.clear(STORES.REVERSE_INDEXES);
                } catch (err) {
                  console.error('Error clearing IndexedDB stores during reset:', err);
                }
                // also clear localStorage and any service-worker/caches
                try {
                  localStorage.clear();
                  if (window.caches) {
                    const keys = await caches.keys();
                    await Promise.all(keys.map(k => caches.delete(k)));
                  }
                  if (navigator.serviceWorker) {
                    const regs = await navigator.serviceWorker.getRegistrations();
                    await Promise.all(regs.map(r => r.unregister()));
                  }
                } catch (err) {
                  console.error('Error clearing caches during reset:', err);
                }
                location.reload();
              }}
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
              reduceAnimations={reduceAnimations}
              onReduceAnimationsChange={setReduceAnimations}
              restDurationSec={restDurationSec}
              onRestDurationChange={(v) => setRestDurationSec(normalizeRestDuration(v, DEFAULT_REST_SEC))}
              restAutoStart={restAutoStart}
              onRestAutoStartChange={setRestAutoStart}
              restSoundEnabled={restSoundEnabled}
              onRestSoundEnabledChange={setRestSoundEnabled}


            />
          )}

          {view === 'monthlyProgress' && (
            <MonthlyProgressView
              workouts={workouts}
              monthOffset={monthOffset}
              onBack={() => setView('home')}
              onViewWorkoutDetail={(date) => { setSelectedDate(date); setSelectedWorkoutId(null); setReturnTo({ view: 'monthlyProgress' }); setView('workoutDetail'); }}
              onDeleteWorkout={(id) => {
                if (confirm('Delete this workout?')) {
                  handleDeleteWorkoutById(id);
                }
              }}
            />
          )}

          {view === 'calendar' && (
            <PlanningCalendarView
              workouts={workouts}
              scheduledWorkouts={scheduledWorkouts}
              templates={templates}
              exercisesDB={exercisesDB}
              draftBackup={plannedDraftBackup}
              onConsumeDraftBackup={() => setPlannedDraftBackup(null)}
              onBack={() => {
                // Home and Profile both land here; return to the real origin.
                if (returnTo?.view) {
                  const target = returnTo.view;
                  setReturnTo(null);
                  setView(target);
                } else {
                  setView('profile');
                }
              }}
              onViewSession={(workoutId) => {
                const target = workouts.find(w => w && w.id === workoutId);
                setSelectedDate(target?.date ?? null);
                setSelectedWorkoutId(workoutId);
                setReturnTo({ view: 'calendar' });
                setView('workoutDetail');
              }}
              onStartPlan={handleStartPlannedWorkout}
              onScheduleFromTemplate={handleScheduleFromTemplate}
              onSaveCustomPlan={handleSaveCustomPlan}
              onDeletePlan={handleDeletePlan}
              onRequestExercisePick={handleRequestExercisePick}
            />
          )}

        </div>
      </div>

      {/* GLOBAL MODALS & NAV */}
      {/* Nav chowamy tylko w trybie aktywnego treningu, zeby nie przeszkadzal */}
      {showBottomNav && (
        <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
      )}

      {showMiniWorkoutBar && (
        <div className="mini-workout-shell">
          <MiniWorkoutBar
            workoutName={activeWorkout?.name}
            timer={workoutTimer}
            onMaximize={handleMaximizeWorkout}
            onHide={handleDismissWorkout}
          />
        </div>
      )}

      <RestTimerBar bottomOffset={restBarBottomOffset} />

      {hiddenWorkout && (
        <HiddenWorkoutBadge workoutName={hiddenWorkout.name} onRestore={handleRestoreHiddenWorkout} />
      )}

      {showExerciseSelector && (
        <ExerciseSelectorModal
          exercisesDB={exercisesDB}
          mode={selectorMode}
          onClose={closeExerciseSelector}
          onSelectExercise={(ex) => {
            // Planner picks stay on the calendar: the exercise travels via
            // the draft backup (no navigation, no lost draft).
            if (selectorMode === 'planned') {
              // Fresh token per pick: the calendar applies each exactly once.
              setPlannedDraftBackup(prev => ({ token: generateId(), draft: prev?.draft ?? null, pickedExercise: ex }));
              closeExerciseSelector();
              setSelectorMode(null);
              return;
            }
            if (selectorMode === 'activeWorkout' && selectedExerciseIndex !== null) {
              handleReplaceExercise(selectedExerciseIndex, ex);
              setSelectedExerciseIndex(null);
            } else {
              handleSelectExercise(ex);
            }
          }}
          onCreateNew={() => {
            const source = selectorMode === 'activeWorkout' ? 'activeWorkout' : selectorMode === 'planned' ? 'planned' : 'exercises';
            setEditingExercise({ name: '', category: 'Push', muscles: [], defaultSets: [{ kg: 0, reps: 0 }], usesBodyweight: false });
            setExerciseCreateSource(source);
            closeExerciseSelector();
            setView('createExercise');
          }}
        />
      )}
      {pendingSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 ui-backdrop-in">
          <div
            data-ui-anim
            className={`bg-gradient-to-br from-slate-900/95 to-black/95 text-white rounded-2xl w-full max-w-[370px] sm:max-w-md border border-slate-700/50 ui-modal-scale max-h-[92dvh] overflow-y-auto ${summaryVisible ? 'animate-modal-fade-in' : 'opacity-0 scale-95'}`}
          >
            <div className="p-4 sm:p-6 sticky top-0 bg-gradient-to-b from-slate-900/95 to-transparent border-b border-slate-700/30 flex justify-between items-start">
              <div>
                <h2 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-blue-400 to-blue-300 bg-clip-text text-transparent">
                  {pendingSummary.cleanData.totalVolume.toLocaleString()}
                </h2>
                <p className="text-xs text-slate-400 mt-1 font-semibold tracking-widest">TOTAL VOLUME</p>
              </div>
              <button onClick={() => setPendingSummary(null)} className="text-slate-500 hover:text-slate-300 transition flex-shrink-0">
                <span className="text-xl">X</span>
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-3.5 sm:space-y-4">
            {/* Main stats row */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-2.5 sm:p-4 ui-stagger-enter ui-stagger-d1">
                <p className="text-slate-400 text-xs font-semibold tracking-widest mb-2">SETS COMPLETED</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl sm:text-2xl font-black text-white"><AnimatedMetricValue value={pendingSummary.cleanData.completedSets} /></span>
                  {pendingSummary.comparison && (
                    <span className="text-lg" title={`${pendingSummary.comparison.prevVolume ? 'vs ' + Math.round(pendingSummary.comparison.prevVolume / 1000) + 'k prev' : ''}`}>
                      {pendingSummary.comparison.trend === 'up' ? '\u2191' : pendingSummary.comparison.trend === 'down' ? '\u2193' : '\u2192'}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-2.5 sm:p-4 ui-stagger-enter ui-stagger-d2">
                <p className="text-slate-400 text-xs font-semibold tracking-widest mb-2">DURATION</p>
                <p className="text-xl sm:text-2xl font-black text-white"><AnimatedMetricValue value={pendingSummary.metrics.duration} suffix="m" /></p>
              </div>
            </div>

            {/* Feedback text */}
            <div className="bg-accent/30 border border-accent/20 rounded-lg p-2.5 sm:p-4 text-center ui-stagger-enter ui-stagger-d3">
              <p className="text-sm sm:text-lg font-bold accent-text">{pendingSummary.feedback}</p>
            </div>

                                    {pendingSummary.coachLens && (
              <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-xl p-3 sm:p-3.5 ui-stagger-enter ui-stagger-d4 ui-coach-card-in space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-cyan-200 font-semibold tracking-widest">COACH LENS</p>
                    <p className="text-sm text-slate-100 mt-1">{pendingSummary.coachLens.headline || pendingSummary.coachLens.focus}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-1 rounded-full border font-bold uppercase tracking-wide ${
                      pendingSummary.coachLens.status === 'push'
                        ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
                        : pendingSummary.coachLens.status === 'recover'
                        ? 'text-amber-300 bg-amber-500/10 border-amber-500/30'
                        : 'text-sky-300 bg-sky-500/10 border-sky-500/30'
                    }`}>
                      {pendingSummary.coachLens.status || 'steady'}
                    </span>
                    <span className={`text-[10px] px-2 py-1 rounded-full border font-bold uppercase tracking-wide ${
                      pendingSummary.coachLens.confidence === 'high'
                        ? 'text-emerald-200 bg-emerald-500/10 border-emerald-500/30'
                        : pendingSummary.coachLens.confidence === 'medium'
                        ? 'text-sky-200 bg-sky-500/10 border-sky-500/30'
                        : 'text-slate-300 bg-slate-700/40 border-slate-600/60'
                    }`}>
                      confidence: {pendingSummary.coachLens.confidence || 'low'}
                    </span>
                  </div>
                </div>

                {pendingSummary.coachLens.scores && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-2 ui-coach-metric-enter ui-coach-metric-d1">
                      <p className="text-[10px] text-slate-500 font-semibold tracking-widest">OUTPUT</p>
                      <p className="text-sm font-black text-white">{pendingSummary.coachLens.scores.progression ?? 0}</p>
                      <div className="h-1.5 mt-1.5 bg-slate-700/70 rounded-full overflow-hidden">
                        <div className="h-full bg-cyan-400/80" style={{ width: `${Math.max(0, Math.min(100, pendingSummary.coachLens.scores.progression ?? 0))}%` }} />
                      </div>
                      <p className="text-[9px] text-slate-500 mt-1">{pendingSummary.coachLens.scoreLegend?.progression || 'Output trend and PR momentum.'}</p>
                    </div>
                    <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-2 ui-coach-metric-enter ui-coach-metric-d2">
                      <p className="text-[10px] text-slate-500 font-semibold tracking-widest">EXECUTION</p>
                      <p className="text-sm font-black text-white">{pendingSummary.coachLens.scores.execution ?? 0}</p>
                      <div className="h-1.5 mt-1.5 bg-slate-700/70 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-400/80" style={{ width: `${Math.max(0, Math.min(100, pendingSummary.coachLens.scores.execution ?? 0))}%` }} />
                      </div>
                      <p className="text-[9px] text-slate-500 mt-1">{pendingSummary.coachLens.scoreLegend?.execution || 'Work set completion quality.'}</p>
                    </div>
                    <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-2 ui-coach-metric-enter ui-coach-metric-d3">
                      <p className="text-[10px] text-slate-500 font-semibold tracking-widest">FATIGUE</p>
                      <p className="text-sm font-black text-white">{pendingSummary.coachLens.scores.fatigueRisk ?? 0}</p>
                      <div className="h-1.5 mt-1.5 bg-slate-700/70 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-400/80" style={{ width: `${Math.max(0, Math.min(100, pendingSummary.coachLens.scores.fatigueRisk ?? 0))}%` }} />
                      </div>
                      <p className="text-[9px] text-slate-500 mt-1">{pendingSummary.coachLens.scoreLegend?.fatigueRisk || 'Next-session slowdown risk.'}</p>
                    </div>
                  </div>
                )}

                {pendingSummary.coachLens.snapshot && (
                  <div className="grid grid-cols-4 gap-2">
                    <div className="rounded-lg border border-slate-700/50 bg-slate-900/35 px-2 py-1.5">
                      <p className="text-[10px] text-slate-500">VOL DELTA</p>
                      <p className="text-xs font-bold text-slate-100">{pendingSummary.coachLens.snapshot.volumeDeltaPct > 0 ? '+' : ''}{pendingSummary.coachLens.snapshot.volumeDeltaPct}%</p>
                    </div>
                    <div className="rounded-lg border border-slate-700/50 bg-slate-900/35 px-2 py-1.5">
                      <p className="text-[10px] text-slate-500">WORK SETS</p>
                      <p className="text-xs font-bold text-slate-100">{pendingSummary.coachLens.snapshot.completedWorkSets}/{pendingSummary.coachLens.snapshot.plannedWorkSets}</p>
                    </div>
                    <div className="rounded-lg border border-slate-700/50 bg-slate-900/35 px-2 py-1.5">
                      <p className="text-[10px] text-slate-500">DENSITY</p>
                      <p className="text-xs font-bold text-slate-100">{pendingSummary.coachLens.snapshot.density}/min</p>
                    </div>
                    <div className="rounded-lg border border-slate-700/50 bg-slate-900/35 px-2 py-1.5">
                      <p className="text-[10px] text-slate-500">PRS</p>
                      <p className="text-xs font-bold text-slate-100">{pendingSummary.coachLens.snapshot.prCount ?? 0}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* PR Celebration */}
            {pendingSummary.completedWorkout.hasPR && (
              <div className="bg-gradient-to-br from-amber-600/20 to-amber-700/10 border border-amber-500/30 rounded-xl p-4 mb-6 flex items-center justify-center gap-3 animate-pulse-gentle">
                <span className="text-4xl animate-bounce">{"\u{1F3C6}"}</span>
                <div className="text-center">
                  <p className="text-xs text-amber-400 font-black uppercase tracking-wider">PERSONAL RECORD!</p>
                  <p className="text-sm text-amber-300 font-bold mt-1">
                    {Object.keys(pendingSummary.completedWorkout.prStatus).length} new {Object.keys(pendingSummary.completedWorkout.prStatus).length === 1 ? 'PR' : 'PRs'}
                  </p>
                </div>
              </div>
            )}

            {/* Muscle Body Map — current workout only, never history */}
            {(() => {
              const finishStats = muscleStats([pendingSummary.completedWorkout], { userWeight, exercisesDB });
              if (!(finishStats.totalSets > 0)) return null;
              return (
                <div className="mb-6">
                  <p className="text-xs text-slate-400 font-semibold tracking-widest mb-4">MUSCLES TRAINED</p>
                  <div className="bg-slate-800/20 rounded-xl p-4">
                    <MuscleBodyMap
                      setsByMuscle={finishStats.setsByMuscle}
                      stats={finishStats}
                      workouts={[pendingSummary.completedWorkout]}
                      exercisesDB={exercisesDB}
                    />
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
            <div className="p-4 sm:p-6 pt-0 flex flex-col gap-2 sticky bottom-0 bg-gradient-to-t from-slate-900/95 to-transparent border-t border-slate-700/30">
              <label className="flex items-center gap-2.5 px-1 py-1 text-xs text-slate-400 font-semibold cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={openSessionAfterSave}
                  onChange={(e) => setOpenSessionAfterSave(e.target.checked)}
                  className="w-4 h-4 cursor-pointer rounded border-slate-600/50 accent-blue-600"
                />
                Open session detail after saving
              </label>
              <button 
                onClick={async () => {
                  // Finish persists exactly once: ignore re-taps while a save
                  // is in flight, and close quietly if this id already saved.
                  if (saveInFlightRef.current) return;
                  if (isWorkoutPersisted(workouts, pendingSummary.completedWorkout.id)) {
                    setPendingSummary(null);
                    setSelectedTags([]);
                    return;
                  }
                  saveInFlightRef.current = true;
                  try {
                  const workoutWithTags = { ...pendingSummary.completedWorkout, tags: selectedTags };

                  // P0-A: verify durable persistence BEFORE clearing active state.
                  // If the workout itself cannot be saved, keep everything and
                  // tell the user — never imply a save that did not happen.
                  try {
                    await storage.set(STORES.WORKOUTS, workoutWithTags);
                  } catch (err) {
                    console.error('Error saving workout:', err);
                    showToast('Could not save workout — your active workout is kept. Try again.');
                    return;
                  }

                  // Update state for immediate UI feedback
                  const newWorkouts = [workoutWithTags, ...workouts];
                  setWorkouts(newWorkouts);

                  // Fulfil the plan this session was started from (if any).
                  fulfillLinkedPlan(pendingSummary.plannedId, workoutWithTags.id);
                  
                  // Update PR cache for all exercises in this workout (use new list for cache)
                  const exerciseIds = (workoutWithTags.exercises || []).map(e => e.exerciseId).filter(Boolean);
                  await updateRecordsForExercises(exerciseIds, newWorkouts);

                  // Update template lastWorkoutSnapshot (prev per template: Pull A vs Pull B)
                  // Secondary write: a snapshot failure must not lose the workout.
                  if (pendingSummary.templateId) {
                    const snapshot = buildLastWorkoutSnapshot(workoutWithTags);
                    const ti = templates.findIndex(t => t.id === pendingSummary.templateId);
                    if (ti !== -1 && snapshot) {
                      const updatedTemplate = { ...templates[ti], lastWorkoutSnapshot: snapshot };
                      try {
                        await storage.set(STORES.TEMPLATES, updatedTemplate);
                        setTemplates(prev => prev.map(t => t.id === updatedTemplate.id ? updatedTemplate : t));
                      } catch (err) {
                        console.error('Error saving template snapshot:', err);
                        showToast('Workout saved, but template snapshot was not updated.');
                      }
                    }
                  }

                  setActiveWorkout(null);
                  setWorkoutTimer(0);
                  try { await storage.delete(STORES.WORKOUTS, 'activeWorkout'); } catch (err) { console.error('Error clearing active workout snapshot:', err); }
                  setPendingSummary(null);
                  setSelectedTags([]);
                  if (openSessionAfterSave) {
                    setSelectedDate(workoutWithTags.date);
                    setSelectedWorkoutId(workoutWithTags.id);
                    setReturnTo(null);
                    setActiveTab('history');
                    setView('workoutDetail');
                  } else {
                    handleTabChange('history');
                    setScrollToWorkoutDate(workoutWithTags.date);
                  }
                  setOpenSessionAfterSave(false);
                  } finally {
                    saveInFlightRef.current = false;
                  }
                }}
                className="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-accent to-accent hover:opacity-90 text-white font-bold text-sm transition-all duration-200 ease-out ui-press shadow-lg shadow-accent/30"
              >
                Save Workout
              </button>
              
              {pendingSummary.templateId && (
                <button 
                  onClick={async () => {
                    if (saveInFlightRef.current) return;
                    if (isWorkoutPersisted(workouts, pendingSummary.completedWorkout.id)) {
                      setPendingSummary(null);
                      setSelectedTags([]);
                      return;
                    }
                    saveInFlightRef.current = true;
                    try {
                    const workoutWithTags = { ...pendingSummary.completedWorkout, tags: selectedTags };

                    // P0-A: verify durable persistence BEFORE clearing active state.
                    try {
                      await storage.set(STORES.WORKOUTS, workoutWithTags);
                    } catch (err) {
                      console.error('Error saving workout:', err);
                      showToast('Could not save workout — your active workout is kept. Try again.');
                      return;
                    }

                    // Update state for immediate UI feedback
                    const newWorkouts = [workoutWithTags, ...workouts];
                    
                    if (pendingSummary.templateId) {
                      const ti = templates.findIndex(t => t.id === pendingSummary.templateId);
                      if (ti !== -1) {
                        const newTemplate = { ...templates[ti] };
                        // CONFIG PRESERVATION: copy the full blueprint-relevant
                        // config back (order, setType/warmup, rir/tempo/pause,
                        // superset links, notes, muscle targets, progression).
                        // Only kg/reps reset to 0 (targets re-hinted from
                        // execution structure); history itself is untouched.
                        newTemplate.exercises = (pendingSummary.completedWorkout.exercises || []).map(ex => normalizeWorkoutExerciseForStorage({
                          ...ex,
                          name: ex.name,
                          exerciseId: ex.exerciseId ?? null,
                          category: ex.category,
                          priority: ex.priority ?? 3,
                          nonNegotiable: Boolean(ex.nonNegotiable),
                          estimatedSetSec: ex.estimatedSetSec ?? null,
                          targetMuscles: Array.isArray(ex.targetMuscles) ? [...ex.targetMuscles] : ex.targetMuscles,
                          progression: ex.progression && typeof ex.progression === 'object' ? { ...ex.progression } : ex.progression,
                          supersetId: ex.supersetId ?? null,
                          planNotes: ex.planNotes ?? '',
                          sets: (ex.sets || []).map(set => normalizeSetForStorage({
                            ...set,
                            kg: 0,
                            reps: 0,
                            completed: false,
                            suggestedKg: undefined,
                            suggestedReps: undefined,
                            isBest1RM: false,
                            isBestSetVolume: false,
                            isHeaviestWeight: false
                          }, resolveSetType(set)))
                        }));
                        newTemplate.lastWorkoutSnapshot = buildLastWorkoutSnapshot(workoutWithTags);
                        
                        // Store template-specific previous sets for each exercise
                        if (!newTemplate.templatePrevious) newTemplate.templatePrevious = {};
                        (pendingSummary.completedWorkout.exercises || []).forEach(ex => {
                          if (ex.exerciseId) {
                            const completedSets = (ex.sets || []).filter(s => s.completed && !isWarmupSet(s));
                            if (completedSets.length > 0) {
                              newTemplate.templatePrevious[ex.exerciseId] = {
                                sets: completedSets.map(s => ({ kg: Number(s.kg) || 0, reps: Number(s.reps) || 0 })),
                                lastDate: workoutWithTags.date
                              };
                            }
                          }
                        });
                        
                        const updated = [...templates];
                        updated[ti] = newTemplate;
                        // Secondary write: template failure must not lose the workout.
                        try {
                          await storage.set(STORES.TEMPLATES, newTemplate);
                          setTemplates(updated);
                        } catch (err) {
                          console.error('Error updating template:', err);
                          showToast('Workout saved, but template update failed.');
                        }
                      }
                    }
                    
                    // Update PR cache for all exercises in this workout
                    const exerciseIds = (workoutWithTags.exercises || []).map(e => e.exerciseId).filter(Boolean);
                    await updateRecordsForExercises(exerciseIds, newWorkouts);

                    setWorkouts(newWorkouts);
                    // Fulfil the plan this session was started from (if any).
                    fulfillLinkedPlan(pendingSummary.plannedId, workoutWithTags.id);
                    setActiveWorkout(null);
                    setWorkoutTimer(0);
                    try { await storage.delete(STORES.WORKOUTS, 'activeWorkout'); } catch (err) { console.error('Error clearing active workout snapshot:', err); }
                    setPendingSummary(null);
                    setSelectedTags([]);
                    if (openSessionAfterSave) {
                      setSelectedDate(workoutWithTags.date);
                      setSelectedWorkoutId(workoutWithTags.id);
                      setReturnTo(null);
                      setActiveTab('history');
                      setView('workoutDetail');
                    } else {
                      handleTabChange('history');
                      setScrollToWorkoutDate(workoutWithTags.date);
                    }
                    setOpenSessionAfterSave(false);
                    } finally {
                      saveInFlightRef.current = false;
                    }
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
      </SmartPlanProvider>
      </TemplatesProvider>
      
      {/* Toast Message */}
      {toast && (
        <div className="fixed bottom-24 left-4 right-4 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg animate-pulse">
          {toast}
        </div>
      )}

      {/* Undo Deleted Workout Toast */}
      <UndoToast
        deletedWorkout={deletedWorkout}
        onUndo={async () => {
          if (!deletedWorkout) return;
          const restoredWorkouts = [deletedWorkout, ...workouts];
          try {
            await storage.set(STORES.WORKOUTS, deletedWorkout);
          } catch (err) {
            console.error('Error persisting workout restoration:', err);
            return;
          }
          setWorkouts(restoredWorkouts);
          setDeletedWorkout(null);
          if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
        }}
        onDismiss={() => setDeletedWorkout(null)}
      />
      
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








































