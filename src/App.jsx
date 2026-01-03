import React, { useState, useEffect, useMemo } from 'react';

// DOMAIN
import { calculate1RM } from './domain/calculations';

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
import { SettingsView } from './views/SettingsView';
import { MonthlyProgressView } from './views/MonthlyProgressView';


export default function App() {
  // --- STATE ---
  const [view, setView] = useState('home');
  const [activeTab, setActiveTab] = useState('home');

  const [workouts, setWorkouts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [exercisesDB, setExercisesDB] = useState([]);
  const [weeklyGoal, setWeeklyGoal] = useState(4);

  const [activeWorkout, setActiveWorkout] = useState(null);
  const [workoutTimer, setWorkoutTimer] = useState(0);
  const [isWorkoutMinimized, setIsWorkoutMinimized] = useState(false);


  // UI State
  const [showCalendar, setShowCalendar] = useState(false);
  const [showExerciseSelector, setShowExerciseSelector] = useState(false);
  const [selectorMode, setSelectorMode] = useState(null); // 'template' | 'activeWorkout'

  // Selection State
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedExerciseId, setSelectedExerciseId] = useState(null);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [editingExercise, setEditingExercise] = useState(null);
  const [selectedExerciseIndex, setSelectedExerciseIndex] = useState(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const [pendingSummary, setPendingSummary] = useState(null);

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

  // Save Data
  useEffect(() => { localStorage.setItem('exercises', JSON.stringify(exercisesDB)); }, [exercisesDB]);
  useEffect(() => { localStorage.setItem('workouts', JSON.stringify(workouts)); }, [workouts]);
  useEffect(() => { localStorage.setItem('templates', JSON.stringify(templates)); }, [templates]);
  useEffect(() => {
    if (activeWorkout) localStorage.setItem('activeWorkout', JSON.stringify(activeWorkout));
    else localStorage.removeItem('activeWorkout');
  }, [activeWorkout]);

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

  const handleSaveExercise = (exercise) => {
    if (exercise.id) {
      setExercisesDB(exercisesDB.map(e => e.id === exercise.id ? exercise : e));
    } else {
      setExercisesDB([...exercisesDB, { ...exercise, id: Date.now() }]);
    }
    setView('exercises');
    setEditingExercise(null);
  };

  const handleDeleteExerciseFromDB = (id) => {
    if (confirm('Delete this exercise? History will remain.')) {
      setExercisesDB(exercisesDB.filter(e => e.id !== id));
    }
  };

  // --- ACTIONS: WORKOUTS ---

  const handleStartWorkout = (template) => {
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
  };

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
          const kg = Number(s.kg) || 0;
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
    const groups = {}; // muscle -> totalVolume
    const mapToAxis = (m) => {
      if (!m) return null;
      const s = m.toLowerCase();
      if (s.includes('chest')) return 'Chest';
      if (s.includes('back')) return 'Back';
      if (s.includes('leg')) return 'Legs';
      if (s.includes('shoulder')) return 'Shoulders';
      if (s.includes('core') || s.includes('abs') || s.includes('ab')) return 'Core';
      if (s.includes('trice') || s.includes('bice') || s.includes('arm')) return 'Arms';
      return null;
    };
    (workout.exercises || []).forEach(ex => {
      // sum volume per exercise (sum of kg*reps for all sets)
      let exVolume = 0;
      (ex.sets || []).forEach(s => {
        const kg = Number(s.kg) || 0;
        const reps = Number(s.reps) || 0;
        exVolume += kg * reps;
      });

      // if exercise lists muscles, add whole exVolume to each muscle
      const muscles = ex.muscles || ex.muscles === undefined ? ex.muscles : [];
      if (ex.muscles && ex.muscles.length > 0) {
        ex.muscles.forEach(m => {
          const axis = mapToAxis(m);
          if (axis) groups[axis] = (groups[axis] || 0) + exVolume;
        });
      } else if (ex.category) {
        const axis = mapToAxis(ex.category);
        if (axis) groups[axis] = (groups[axis] || 0) + exVolume;
      }
    });

    return groups;
  };

  const handleFinishWorkout = () => {
    if (!activeWorkout) return;
    const completedWorkout = { ...activeWorkout, id: Date.now() };
    const template = templates.find(t => t.id === activeWorkout.templateId);
    const baseTemplate = template || activeWorkout.templateSnapshot || null;
    const diff = baseTemplate ? computeTemplateDiff(baseTemplate, activeWorkout) : { changed: true, reasons: ['No template associated for this workout'] };
    const metrics = calcSummaryMetrics(completedWorkout);
    const muscleTotals = computeMuscleTotals(completedWorkout);
    setPendingSummary({ completedWorkout, templateId: template?.id || null, diff, metrics: { ...metrics, muscleTotals } });
  };
  const handleMinimizeWorkout = () => {
    setIsWorkoutMinimized(true);
    setView('home');
    setActiveTab('home');
  };

  const handleMaximizeWorkout = () => {
    setIsWorkoutMinimized(false);
    setView('activeWorkout');
  };


  // Active Workout Modifications
  const handleUpdateSet = (exIndex, setIndex, field, value) => {
    const updated = { ...activeWorkout };
    updated.exercises[exIndex].sets[setIndex][field] = value;
    setActiveWorkout(updated);

    // If this set is already completed, update exercise default in DB
    const exId = updated.exercises[exIndex].exerciseId;
    const isCompleted = updated.exercises[exIndex].sets[setIndex].completed;
    if (exId && isCompleted) {
      const kg = updated.exercises[exIndex].sets[setIndex].kg;
      const reps = updated.exercises[exIndex].sets[setIndex].reps;
      setExercisesDB(prev => prev.map(e => e.id === exId ? { ...e, defaultSets: [{ kg, reps }, ...(e.defaultSets || []).slice(1)] } : e));
    }
  };

  const handleToggleSet = (exIndex, setIndex) => {
    const updated = { ...activeWorkout };
    const newVal = !updated.exercises[exIndex].sets[setIndex].completed;
    updated.exercises[exIndex].sets[setIndex].completed = newVal;
    setActiveWorkout(updated);

    // When marking completed, update exercise default in DB
    if (newVal) {
      const exId = updated.exercises[exIndex].exerciseId;
      if (exId) {
        const kg = updated.exercises[exIndex].sets[setIndex].kg;
        const reps = updated.exercises[exIndex].sets[setIndex].reps;
        setExercisesDB(prev => prev.map(e => e.id === exId ? { ...e, defaultSets: [{ kg, reps }, ...(e.defaultSets || []).slice(1)] } : e));
      }
    }
  };

  const handleAddSet = (exIndex) => {
    const updated = { ...activeWorkout };
    const lastSet = updated.exercises[exIndex].sets.at(-1) || { kg: 0, reps: 0 };
    updated.exercises[exIndex].sets.push({ ...lastSet, completed: false });
    setActiveWorkout(updated);
  };

  const handleAddNote = () => {
    const note = prompt("Workout Note:", activeWorkout.note);
    if (note !== null) setActiveWorkout({ ...activeWorkout, note });
  };

  const handleAddExerciseNote = (exIndex, note) => {
    const updated = { ...activeWorkout };
    updated.exercises[exIndex].exerciseNote = note;
    setActiveWorkout(updated);
  };

  const handleDeleteExercise = (exIndex) => {
    if (confirm('Delete this exercise?')) {
      const updated = { ...activeWorkout };
      updated.exercises.splice(exIndex, 1);
      setActiveWorkout(updated);
    }
  };

  const handleReorderExercises = (newOrder) => {
    const updated = { ...activeWorkout };
    updated.exercises = newOrder;
    setActiveWorkout(updated);
  };

  const handleReplaceExercise = (exIndex, newExercise) => {
    const updated = { ...activeWorkout };
    const exData = {
      exerciseId: newExercise.id,
      name: newExercise.name,
      category: newExercise.category,
      sets: newExercise.defaultSets ? [...newExercise.defaultSets] : [{ kg: 0, reps: 0 }],
      exerciseNote: ''
    };
    updated.exercises[exIndex] = { ...exData, sets: exData.sets.map(s => ({ ...s, completed: false })) };
    setActiveWorkout(updated);
    setShowExerciseSelector(false);
  };

  // --- ACTIONS: TEMPLATES ---

  const handleSaveTemplate = () => {
    if (!editingTemplate.name.trim()) return;
    if (editingTemplate.id) {
      setTemplates(templates.map(t => t.id === editingTemplate.id ? editingTemplate : t));
    } else {
      setTemplates([...templates, { ...editingTemplate, id: Date.now() }]);
    }
    setEditingTemplate(null);
  };

  // --- SELECTOR LOGIC ---

  const handleSelectExercise = (exercise) => {
    const exData = {
      exerciseId: exercise.id,
      name: exercise.name,
      category: exercise.category,
      sets: exercise.defaultSets ? [...exercise.defaultSets] : [{ kg: 0, reps: 0 }]
    };

    if (selectorMode === 'template') {
      setEditingTemplate({
        ...editingTemplate,
        exercises: [...(editingTemplate.exercises || []), exData]
      });
    } else if (selectorMode === 'activeWorkout') {
      const newEx = { ...exData, sets: (exData.sets || [{ kg: 0, reps: 0 }]).map(s => ({ ...s, completed: false })) };
      setActiveWorkout(prev => ({
        ...prev,
        exercises: [...(prev?.exercises || []), newEx]
      }));
    }
    setShowExerciseSelector(false);
  };

  // --- DATA MANAGEMENT ---

  const handleExport = () => {
    const dataStr = JSON.stringify({ workouts, templates, exercisesDB, weeklyGoal }, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `workout_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  const handleImport = (e) => {
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
            const existingNames = new Set(prev.map(e => e.name));
            const newOnes = data.exercisesDB.filter(e => !existingNames.has(e.name));
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
  };


  // --- NAVIGATION HANDLER ---
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (tabId === 'home') setView('home');
    else if (tabId === 'history') setView('history');
    else if (tabId === 'exercises') setView('exercises');
    else if (tabId === 'profile') setView('profile');
    else if (tabId === 'settings') setView('settings');
  };

  // --- RENDER ---
  return (
    <>
      <div className="flex justify-center bg-zinc-900 min-h-screen">
        <div className="w-full max-w-md bg-zinc-900 shadow-2xl min-h-screen relative">

          {/* VIEW ROUTING */}
          {view === 'home' && (
            <HomeView
              workouts={workouts}
              weeklyGoal={weeklyGoal}
              onStartWorkout={() => setView('selectTemplate')}
              onManageTemplates={() => { setEditingTemplate({ name: '', exercises: [] }); setView('templates'); }}
              onOpenCalendar={() => setShowCalendar(true)}
              onViewHistory={() => { setActiveTab('history'); setView('history'); }}
              onViewWorkoutDetail={(date) => { setSelectedDate(date); setView('workoutDetail'); }}
              onOpenMonthlyProgress={(offset) => { setMonthOffset(offset); setView('monthlyProgress'); }}
            />
          )}

          {view === 'history' && (
            <HistoryView
              workouts={workouts}
              onViewWorkoutDetail={(date) => { setSelectedDate(date); setView('workoutDetail'); }}
            />
          )}

          {view === 'exercises' && (
            <ExercisesView
              exercisesDB={exercisesDB}
              onAddExercise={() => {
                setEditingExercise({ name: '', category: 'Push', muscles: [], defaultSets: [{ kg: 0, reps: 0 }] });
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
              onOpenWorkout={(date) => { setSelectedDate(date); setView('workoutDetail'); }}
            />
          )}

          {view === 'workoutDetail' && selectedDate && (
            <WorkoutDetailView
              selectedDate={selectedDate}
              workouts={workouts}
              onBack={() => {
                // Inteligentny powrót: jeśli byliśmy w historii, wróć do historii
                if (activeTab === 'history') setView('history');
                else setView('home');
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
              onReplaceExercise={(exIndex) => { setSelectedExerciseIndex(exIndex); setSelectorMode('activeWorkout'); setShowExerciseSelector(true); }}
              onAddExercise={() => { setSelectedExerciseIndex(null); setSelectorMode('activeWorkout'); setShowExerciseSelector(true); }}
              onMinimize={handleMinimizeWorkout}
            />
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
              onAddExercise={() => { setSelectedExerciseIndex(null); setSelectorMode('template'); setShowExerciseSelector(true); }}
            />
          )}

          {view === 'profile' && <ProfileView workouts={workouts} exercisesDB={exercisesDB} />}

          {view === 'settings' && (
            <SettingsView
              weeklyGoal={weeklyGoal}
              onWeeklyGoalChange={setWeeklyGoal}
              onExport={handleExport}
              onImport={handleImport}
              onReset={() => { if (confirm('Reset all data?')) { localStorage.clear(); location.reload(); } }}
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
          onClose={() => setShowCalendar(false)}
          onSelectDate={(d) => { setSelectedDate(d); setView('workoutDetail'); }}
        />
      )}

      {showExerciseSelector && (
        <ExerciseSelectorModal
          exercisesDB={exercisesDB}
          onClose={() => setShowExerciseSelector(false)}
          onSelectExercise={(ex) => {
            if (selectorMode === 'activeWorkout' && selectedExerciseIndex !== null) {
              handleReplaceExercise(selectedExerciseIndex, ex);
              setSelectedExerciseIndex(null);
            } else {
              handleSelectExercise(ex);
            }
          }}
          onCreateNew={() => {
            setEditingExercise({ name: '', category: 'Push', muscles: [], defaultSets: [{ kg: 0, reps: 0 }] });
            setShowExerciseSelector(false);
            setView('createExercise');
          }}
        />
      )}
      {pendingSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-zinc-900 text-white p-6 rounded-xl w-[95%] max-w-2xl border border-zinc-700">
            <div className="flex justify-between items-start">
              <h3 className="text-lg font-bold">Workout Summary</h3>
              <button onClick={() => setPendingSummary(null)} className="text-zinc-400">✕</button>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-4 text-center">
              <div>
                <div className="text-xs text-zinc-400">Duration</div>
                <div className="text-2xl font-bold">{pendingSummary.metrics.duration}m</div>
              </div>
              <div>
                <div className="text-xs text-zinc-400">Volume</div>
                <div className="text-2xl font-bold">{pendingSummary.metrics.volume}</div>
              </div>
              <div>
                <div className="text-xs text-zinc-400">Sets</div>
                <div className="text-2xl font-bold">{pendingSummary.metrics.setsDone}</div>
              </div>
            </div>

            <div className="mt-6 flex gap-6">
              <div className="flex-1">
                <div className="text-sm text-zinc-300 mb-2">Muscle distribution</div>
                <div className="flex justify-center">
                  {/* Radar chart */}
                  <svg width="220" height="220" viewBox="0 0 220 220">
                    <g transform="translate(110,110)">
                      {/* axes and rings */}
                      {[3, 2, 1].map((r, i) => (
                        <circle key={i} r={(i + 1) * 30} fill="none" stroke="#2b2b2b" strokeWidth="1" />
                      ))}
                      {
                        (() => {
                          const groups = ['Back', 'Legs', 'Chest', 'Arms', 'Core', 'Shoulders'];
                          const totals = groups.map(g => (pendingSummary.metrics.muscleTotals && pendingSummary.metrics.muscleTotals[g]) ? pendingSummary.metrics.muscleTotals[g] : 0);
                          const max = Math.max(...totals, 1);
                          const points = totals.map((t, i) => {
                            const angle = (i / groups.length) * Math.PI * 2 - Math.PI / 2;
                            const radius = (t / max) * 90;
                            return `${Math.cos(angle) * radius},${Math.sin(angle) * radius}`;
                          }).join(' ');
                          return (
                            <>
                              {/* axes lines and labels (no numeric ticks) */}
                              {groups.map((g, i) => {
                                const angle = (i / groups.length) * Math.PI * 2 - Math.PI / 2;
                                const x = Math.cos(angle) * 100; const y = Math.sin(angle) * 100;
                                return (
                                  <g key={g}>
                                    <line x1={0} y1={0} x2={x} y2={y} stroke="#2b2b2b" strokeWidth="1" />
                                    <text x={x * 1.15} y={y * 1.15} fontSize="11" fill="#cfcfcf" textAnchor={Math.abs(x) > 10 ? (x > 0 ? 'start' : 'end') : 'middle'}>{g}</text>
                                  </g>
                                );
                              })}
                              <polygon points={points} fill="#fb718590" stroke="#fb7185" strokeWidth="1" />
                            </>
                          );
                        })()
                      }
                    </g>
                  </svg>
                </div>
              </div>

              <div className="w-1/3">
                <div className="text-sm text-zinc-300">Changes</div>
                <div className="mt-2 text-sm text-zinc-200 bg-zinc-800 p-3 rounded h-40 overflow-auto">
                  {pendingSummary.diff.changed ? (
                    <ul className="list-disc list-inside text-sm">
                      {pendingSummary.diff.reasons.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  ) : (
                    <div className="text-zinc-400">No changes to template detected</div>
                  )}
                </div>

                <div className="mt-4 flex flex-col gap-2">
                  <button onClick={() => setPendingSummary(null)} className="w-full px-3 py-2 rounded bg-zinc-700">Cancel</button>
                  <button onClick={() => {
                    // Keep original template: save workout only
                    setWorkouts([pendingSummary.completedWorkout, ...workouts]);
                    setActiveWorkout(null);
                    setWorkoutTimer(0);
                    setPendingSummary(null);
                    setView('home');
                  }} className="w-full px-3 py-2 rounded bg-rose-500">Keep Original Template</button>
                  <button onClick={() => {
                    // Update template structure
                    if (pendingSummary.templateId) {
                      const ti = templates.findIndex(t => t.id === pendingSummary.templateId);
                      if (ti !== -1) {
                        const newTemplate = { ...templates[ti] };
                        newTemplate.exercises = (pendingSummary.completedWorkout.exercises || []).map(ex => ({ name: ex.name, category: ex.category, sets: ex.sets.map(s => ({ kg: 0, reps: 0 })) }));
                        const updated = [...templates]; updated[ti] = newTemplate; setTemplates(updated);
                      }
                    }
                    setWorkouts([pendingSummary.completedWorkout, ...workouts]);
                    setActiveWorkout(null);
                    setWorkoutTimer(0);
                    setPendingSummary(null);
                    setView('home');
                  }} className="w-full px-3 py-2 rounded bg-emerald-500">Update Template</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}