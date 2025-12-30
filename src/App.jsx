import React, { useState, useEffect } from 'react';
import {
  User, Clock, Home, Calendar, Plus, TrendingUp, Dumbbell, Check, X,
  ChevronRight, Edit2, Trash2, Save, ChevronLeft, Settings, Search
} from 'lucide-react';

/* ================= CALENDAR MODAL ================= */
const CalendarModal = ({ workouts, onClose, onSelectDate }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const today = new Date().toISOString().split('T')[0];
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= lastDate; d++) days.push(d);
    return days;
  };

  const renderMonth = (offset = 0) => {
    const date = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + offset,
      1
    );

    return (
      <div className="mb-8" key={offset}>
        <h3 className="text-lg font-semibold mb-4">
          {months[date.getMonth()]} {date.getFullYear()}
        </h3>

        <div className="grid grid-cols-7 gap-2 mb-2 text-xs text-zinc-500">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <div key={i} className="text-center">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {getDaysInMonth(date).map((day, i) => {
            if (!day) return <div key={i} />;
            const dateStr = new Date(
              date.getFullYear(),
              date.getMonth(),
              day
            ).toISOString().split('T')[0];
            const isToday = dateStr === today;
            const hasWorkout = workouts.some(w => w.date === dateStr);

            return (
              <button
                key={i}
                onClick={() => {
                  onSelectDate(dateStr);
                  onClose();
                }}
                className={`h-10 rounded-full text-sm font-medium transition
                  ${isToday ? 'bg-rose-400 text-white' :
                    hasWorkout ? 'bg-zinc-700 text-white' :
                      'text-zinc-400 hover:bg-zinc-800'}`}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 rounded-3xl p-6 max-w-md w-full max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between mb-6">
          <h2 className="text-xl font-bold">Select date</h2>
          <button onClick={onClose}><X /></button>
        </div>
        {renderMonth(0)}
        {renderMonth(1)}
      </div>
    </div>
  );
};

/* ============ ACTIVE WORKOUT EXERCISE CARD ============ */
const ActiveWorkoutExerciseCard = ({
  exercise,
  exerciseIndex,
  previousSets = [],
  onUpdateSet,
  onToggleSet,
  onAddSet
}) => (
  <div className="bg-zinc-800 rounded-2xl p-4 mb-6">
    <h3 className="text-xl font-semibold mb-4">{exercise.name}</h3>

    <div className="grid grid-cols-[48px_96px_72px_72px_40px] gap-2 text-xs text-zinc-500 mb-3">
      <span>Set</span>
      <span>Previous</span>
      <span className="text-center">kg</span>
      <span className="text-center">Reps</span>
      <span />
    </div>

    {exercise.sets.map((set, i) => {
      // LOGIKA PREVIOUS: Sprawdzamy czy istnieje set w historii I czy był oznaczony jako 'completed'
      const prevSet = previousSets[i];
      const showPrevious = prevSet && prevSet.completed;

      return (
        <div
          key={i}
          className="grid grid-cols-[48px_96px_72px_72px_40px] gap-2 items-center mb-3"
        >
          <div className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center">
            {i + 1}
          </div>

          {/* Wyświetlanie Previous */}
          <span className="text-xs text-zinc-400 font-mono tracking-tight">
             {showPrevious ? `${prevSet.kg}kg x ${prevSet.reps}` : '-'}
          </span>

          <input
            type="number"
            value={set.kg}
            onChange={e =>
              onUpdateSet(exerciseIndex, i, 'kg', Number(e.target.value))
            }
            className="bg-zinc-700 rounded-lg p-2 text-center text-white w-full"
          />

          <input
            type="number"
            value={set.reps}
            onChange={e =>
              onUpdateSet(exerciseIndex, i, 'reps', Number(e.target.value))
            }
            className="bg-zinc-700 rounded-lg p-2 text-center text-white w-full"
          />

          <button
            onClick={() => onToggleSet(exerciseIndex, i)}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors
              ${set.completed ? 'bg-green-500' : 'bg-zinc-700'}`}
          >
            {set.completed && <Check size={18} />}
          </button>
        </div>
      );
    })}

    <div className="border-t border-zinc-700 mt-4 pt-4">
      <button
        onClick={() => onAddSet(exerciseIndex)}
        className="w-full bg-zinc-700 rounded-lg p-3 text-white"
      >
        + Add Set
      </button>
    </div>
  </div>
);

/* ============ EXERCISE SELECTOR MODAL ============ */
const ExerciseSelectorModal = ({
  exercisesDB,
  onClose,
  onSelectExercise,
  onCreateNew
}) => {
  const [q, setQ] = useState('');
  const filtered = exercisesDB.filter(e =>
    e.name.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end">
      <div className="bg-zinc-900 rounded-t-3xl w-full max-h-[80vh] overflow-y-auto">
        <div className="p-4 border-b border-zinc-800">
          <div className="flex justify-between mb-4">
            <h2 className="font-bold text-white">Add Exercise</h2>
            <button onClick={onClose} className="text-white"><X /></button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-3 text-zinc-500" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search"
              className="w-full bg-zinc-800 rounded-xl pl-10 p-3 text-white"
            />
          </div>
        </div>

        <div className="p-4">
          <button
            onClick={onCreateNew}
            className="w-full bg-rose-400 rounded-xl p-4 mb-4 text-white font-semibold flex items-center justify-center gap-2"
          >
            <Plus /> Create New Exercise
          </button>

          {filtered.map(ex => (
            <button
              key={ex.id}
              onClick={() => onSelectExercise(ex)}
              className="w-full bg-zinc-800 rounded-xl p-4 mb-2 text-left"
            >
              <div className="font-semibold text-white">{ex.name}</div>
              <div className="text-xs text-zinc-400">
                {ex.defaultSets?.length || 0} sets
              </div>
            </button>
          ))}
          {filtered.length === 0 && <p className="text-zinc-500 text-center mt-4">No exercises found.</p>}
        </div>
      </div>
    </div>
  );
};

/* ============ MAIN COMPONENT ============ */

export default function WorkoutTracker() {
  // State
  const [showExerciseSelector, setShowExerciseSelector] = useState(false);
  const [workouts, setWorkouts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [exercisesDB, setExercisesDB] = useState([]);
  const [weeklyGoal, setWeeklyGoal] = useState(6);
  const [view, setView] = useState('home');
  const [activeWorkout, setActiveWorkout] = useState(null);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [editingExercise, setEditingExercise] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [workoutTimer, setWorkoutTimer] = useState(0);
  const [activeTab, setActiveTab] = useState('home');
  const [showCalendar, setShowCalendar] = useState(false);

  // Load from localStorage
  useEffect(() => {
    const savedExercises = localStorage.getItem('exercises');
    if (savedExercises) setExercisesDB(JSON.parse(savedExercises));

    const savedWorkouts = localStorage.getItem('workouts');
    if (savedWorkouts) setWorkouts(JSON.parse(savedWorkouts));

    const savedTemplates = localStorage.getItem('templates');
    if (savedTemplates) setTemplates(JSON.parse(savedTemplates));

    const savedGoal = localStorage.getItem('weeklyGoal');
    if (savedGoal) setWeeklyGoal(parseInt(savedGoal));
  }, []);

  // Persist
  useEffect(() => { localStorage.setItem('exercises', JSON.stringify(exercisesDB)); }, [exercisesDB]);
  useEffect(() => { localStorage.setItem('workouts', JSON.stringify(workouts)); }, [workouts]);
  useEffect(() => { localStorage.setItem('templates', JSON.stringify(templates)); }, [templates]);

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

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // --- POPRAWIONA FUNKCJA POBIERANIA HISTORII ---
  const getPreviousSetsForExercise = (exerciseName) => {
    // 1. Filtrujemy workouty, które mają to ćwiczenie
    const relevantWorkouts = workouts.filter(w =>
      w.exercises && w.exercises.some(e => e.name === exerciseName)
    );

    // 2. Sortujemy: najpierw data (malejąco), a jeśli data ta sama, to ID (malejąco)
    // To gwarantuje, że bierzemy absolutnie najświeższy wpis z historii
    relevantWorkouts.sort((a, b) => {
      const dateDiff = new Date(b.date) - new Date(a.date);
      if (dateDiff !== 0) return dateDiff;
      return (b.id || 0) - (a.id || 0); // Zakładając, że ID to timestamp lub rosnąca liczba
    });

    if (relevantWorkouts.length === 0) return [];

    // 3. Wyciągamy sety z tego ostatniego treningu
    const foundExercise = relevantWorkouts[0].exercises.find(
      ex => ex.name === exerciseName
    );

    return foundExercise ? foundExercise.sets : [];
  };

  const addExerciseFromDB = (exercise) => {
    const exerciseCopy = JSON.parse(JSON.stringify(exercise));
    const templateExercise = {
      name: exerciseCopy.name,
      sets: exerciseCopy.defaultSets ? JSON.parse(JSON.stringify(exerciseCopy.defaultSets)) : [{ kg: 0, reps: 0 }]
    };
    setEditingTemplate({
      ...editingTemplate,
      exercises: [...(editingTemplate?.exercises || []), templateExercise]
    });
    setShowExerciseSelector(false);
  };

  // Exercises DB helpers
  const saveExercise = (ex) => {
    if (ex.id) {
      const updated = exercisesDB.map(e => e.id === ex.id ? ex : e);
      setExercisesDB(updated);
      return ex;
    } else {
      const newEx = { ...ex, id: Date.now() };
      setExercisesDB([...exercisesDB, newEx]);
      return newEx;
    }
  };
  const deleteExercise = (id) => setExercisesDB(exercisesDB.filter(e => e.id !== id));

  // Templates / workouts
  const selectTemplate = (template) => {
    setActiveWorkout({
      templateId: template.id,
      name: template.name,
      date: new Date().toISOString().split('T')[0],
      startTime: new Date().toISOString(),
      exercises: template.exercises.map(ex => ({
        ...ex,
        sets: ex.sets.map(set => ({ ...set, completed: false }))
      }))
    });
    setWorkoutTimer(0);
    setView('activeWorkout');
    setActiveTab('home');
  };

  const finishWorkout = () => {
    if (!activeWorkout) return;
    const duration = Math.floor((new Date() - new Date(activeWorkout.startTime)) / 60000);
    // Dodajemy na początek listy, ID to timestamp
    setWorkouts([{ ...activeWorkout, duration, id: Date.now() }, ...workouts]);
    setActiveWorkout(null);
    setWorkoutTimer(0);
    setView('home');
    setActiveTab('home');
  };

  const toggleSet = (exIndex, setIndex) => {
    const updated = JSON.parse(JSON.stringify(activeWorkout));
    updated.exercises[exIndex].sets[setIndex].completed = !updated.exercises[exIndex].sets[setIndex].completed;
    setActiveWorkout(updated);
  };

  const updateSet = (exIndex, setIndex, field, value) => {
    const updated = JSON.parse(JSON.stringify(activeWorkout));
    updated.exercises[exIndex].sets[setIndex][field] = value;
    setActiveWorkout(updated);
  };

  const addSetToActiveExercise = (exIndex) => {
    const updated = JSON.parse(JSON.stringify(activeWorkout));
    const lastSet = updated.exercises[exIndex].sets[updated.exercises[exIndex].sets.length - 1] || { kg: 0, reps: 0 };
    updated.exercises[exIndex].sets.push({ ...lastSet, completed: false });
    setActiveWorkout(updated);
  };

  const deleteWorkout = (id) => setWorkouts(workouts.filter(w => w.id !== id));

  const saveTemplate = () => {
    if (!editingTemplate || !editingTemplate.name.trim()) return;
    if (editingTemplate.id) {
      setTemplates(templates.map(t => t.id === editingTemplate.id ? editingTemplate : t));
    } else {
      setTemplates([...templates, { ...editingTemplate, id: Date.now() }]);
    }
    setEditingTemplate(null);
    setView('home'); 
  };

  const deleteTemplate = (id) => setTemplates(templates.filter(t => t.id !== id));

  // Template editor actions
  const openExerciseSelector = () => setShowExerciseSelector(true);

  const addSetToExercise = (exIndex) => {
    const updated = JSON.parse(JSON.stringify(editingTemplate));
    const lastSet = updated.exercises[exIndex].sets[updated.exercises[exIndex].sets.length - 1];
    updated.exercises[exIndex].sets.push({ ...lastSet });
    setEditingTemplate(updated);
  };

  const removeExercise = (exIndex) => {
    const updated = JSON.parse(JSON.stringify(editingTemplate));
    updated.exercises.splice(exIndex, 1);
    setEditingTemplate(updated);
  };

  const removeSet = (exIndex, setIndex) => {
    const updated = JSON.parse(JSON.stringify(editingTemplate));
    if (updated.exercises[exIndex].sets.length > 1) {
      updated.exercises[exIndex].sets.splice(setIndex, 1);
      setEditingTemplate(updated);
    }
  };

  // Calendar / date helpers
  const getWeekWorkouts = () => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + 1);
    weekStart.setHours(0, 0, 0, 0);
    return workouts.filter(w => new Date(w.date) >= weekStart);
  };

  const getMonthWorkouts = (monthOffset = 0) => {
    const now = new Date();
    const targetDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    return workouts.filter(w => {
      const d = new Date(w.date);
      return d.getMonth() === targetDate.getMonth() && d.getFullYear() === targetDate.getFullYear();
    });
  };

  const getWorkoutsByDate = (dateStr) => workouts.filter(w => w.date === dateStr);

  const getStreak = () => {
    if (workouts.length === 0) return 0;

    const weeksWithWorkout = new Set();
    workouts.forEach(w => {
      const d = new Date(w.date);
      const year = d.getFullYear();
      const week = Math.floor(
        (d - new Date(year, 0, 1)) / (7 * 24 * 60 * 60 * 1000)
      );
      weeksWithWorkout.add(`${year}-${week}`);
    });

    let streak = 0;
    let cursor = new Date();

    while (true) {
      const year = cursor.getFullYear();
      const week = Math.floor(
        (cursor - new Date(year, 0, 1)) / (7 * 24 * 60 * 60 * 1000)
      );

      if (weeksWithWorkout.has(`${year}-${week}`)) {
        streak++;
        cursor.setDate(cursor.getDate() - 7); 
      } else {
        break;
      }
    }

    return streak;
  };

  const weekWorkouts = getWeekWorkouts();
  const thisMonth = getMonthWorkouts(0);
  const lastMonth = getMonthWorkouts(-1);
  const streak = getStreak();
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  // Bottom Navigation Component
  const BottomNav = () => {
    const navItems = [
      { id: 'profile', icon: User, label: 'Profile' },
      { id: 'history', icon: Calendar, label: 'History' },
      { id: 'home', icon: Home, label: 'Home', isCenter: true },
      { id: 'exercises', icon: Dumbbell, label: 'Exercises' },
      { id: 'settings', icon: Settings, label: 'Settings' }
    ];
    return (
      <nav className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 z-40 pb-safe">
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.map(({ id, icon: Icon, label, isCenter }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => {
                  setActiveTab(id);
                  if (id === 'home') setView('home');
                  else if (id === 'history') setView('history');
                  else if (id === 'exercises') setView('exercises');
                  else if (id === 'profile') setView('profile');
                  else if (id === 'settings') setView('settings');
                }}
                className={`flex flex-col items-center justify-center transition-all duration-200 ease-out ${isCenter ? 'relative -mt-6' : ''} ${isActive ? 'text-white' : 'text-zinc-500'} hover:text-zinc-300 active:scale-95`}
              >
                {isCenter ? (
                  <div className={`flex items-center justify-center w-14 h-14 rounded-full ${isActive ? 'bg-zinc-800 shadow-lg border border-zinc-700' : 'bg-rose-500'} transition-all duration-200`}>
                    <Icon size={28} color={isActive ? "white" : "white"} strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                ) : (
                  <>
                    <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                    <span className={`text-[10px] mt-1 font-medium tracking-wide ${isActive ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200`}>{label}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    );
  };

  // Render main content
  const renderContent = () => {
    // PROFILE
    if (view === 'profile') {
      return (
        <div className="min-h-screen bg-zinc-900 text-white pb-24">
          <div className="bg-zinc-800 p-4 mb-6"><h1 className="text-2xl font-bold">Profile</h1></div>
          <div className="p-6 space-y-4">
            <div><label className="block text-sm text-zinc-400 mb-2">Name</label><input type="text" placeholder="Your name" className="w-full bg-zinc-800 rounded-xl p-4 text-white" /></div>
            <div><label className="block text-sm text-zinc-400 mb-2">Age</label><input type="number" placeholder="Your age" className="w-full bg-zinc-800 rounded-xl p-4 text-white" /></div>
            <div><label className="block text-sm text-zinc-400 mb-2">Weight (kg)</label><input type="number" placeholder="Your weight" className="w-full bg-zinc-800 rounded-xl p-4 text-white" /></div>
          </div>
        </div>
      );
    }

    // HISTORY
    if (view === 'history') {
      return (
        <div className="min-h-screen bg-zinc-900 text-white pb-24">
          <div className="bg-zinc-800 p-4 mb-6"><h1 className="text-2xl font-bold">History</h1></div>
          <div className="p-6 space-y-4">
            {workouts.length === 0 ? <p className="text-center text-zinc-400 mt-10">No workouts yet</p> : workouts.map(workout => (
              <div key={workout.id} onClick={() => { setSelectedDate(workout.date); setView('workoutDetail'); }} className="bg-zinc-800 rounded-2xl p-4 cursor-pointer">
                <div className="flex justify-between mb-2">
                  <div><h3 className="font-semibold text-lg">{workout.name}</h3><p className="text-xs text-zinc-400">{new Date(workout.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} • {workout.duration || 0} min</p></div>
                  <ChevronRight className="text-zinc-500" size={20} />
                </div>
                <div className="text-sm text-zinc-300">{workout.exercises?.slice(0, 2).map((ex, i) => (<span key={i}>{ex.name}{i < 1 && workout.exercises.length > 1 ? ' • ' : ''}</span>))}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // EXERCISES list
    if (view === 'exercises') {
      return (
        <div className="min-h-screen bg-zinc-900 text-white pb-24">
          <div className="bg-zinc-800 p-4 mb-6"><h1 className="text-2xl font-bold">Exercises</h1></div>
          <div className="p-6">
            <button onClick={() => { setEditingExercise({ name: '', defaultSets: [{ kg: 0, reps: 0 }] }); setView('createExercise'); }} className="w-full bg-rose-400 text-white rounded-xl p-4 mb-6 font-semibold flex items-center justify-center gap-2"><Plus size={20} /> Add Exercise</button>
            <div className="space-y-4">
              {exercisesDB.map(exercise => (
                <div key={exercise.id} className="bg-zinc-800 rounded-xl p-4 flex justify-between items-center">
                  <div><h3 className="font-semibold text-lg">{exercise.name}</h3><p className="text-sm text-zinc-400">{exercise.defaultSets?.length || 0} sets</p></div>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingExercise(exercise); setView('createExercise'); }} className="p-2 bg-zinc-700 rounded-lg text-blue-400"><Edit2 size={18} /></button>
                    <button onClick={() => deleteExercise(exercise.id)} className="p-2 bg-zinc-700 rounded-lg text-red-400"><Trash2 size={18} /></button>
                  </div>
                </div>
              ))}
              {exercisesDB.length === 0 && <p className="text-zinc-400 text-center mt-6">No exercises yet — add one.</p>}
            </div>
          </div>
        </div>
      );
    }

    // CREATE/EDIT EXERCISE
    if (view === 'createExercise' && editingExercise) {
      return (
        <div className="min-h-screen bg-zinc-900 text-white pb-24">
          <div className="bg-zinc-800 p-4 flex items-center justify-between mb-6">
            <button onClick={() => { setView('exercises'); setEditingExercise(null); }}><ChevronLeft size={24} /></button>
            <h1 className="text-xl font-bold">{editingExercise.id ? 'Edit' : 'Create'} Exercise</h1>
            <button onClick={() => { const result = saveExercise(editingExercise); if (!editingExercise.id && result && showExerciseSelector) addExerciseFromDB(result); setView('exercises'); setEditingExercise(null); }} className="text-green-400"><Save size={24} /></button>
          </div>
          <div className="p-6">
            <div className="mb-6">
              <label className="block text-sm text-zinc-400 mb-2">Exercise Name</label>
              <input type="text" value={editingExercise.name} onChange={(e) => setEditingExercise({ ...editingExercise, name: e.target.value })} placeholder="e.g., Bench Press (Barbell)" className="w-full bg-zinc-800 rounded-xl p-4 text-white" />
            </div>
            <div className="mb-4">
              <label className="block text-sm text-zinc-400 mb-2">Default Sets</label>
              <div className="space-y-2">
                {(editingExercise.defaultSets || [{ kg: 0, reps: 0 }]).map((set, i) => (
                  <div key={i} className="grid grid-cols-[50px_1fr_1fr_40px] gap-2">
                    <span className="text-zinc-400 flex items-center">{i + 1}</span>
                    <input type="number" value={set.kg} onChange={(e) => { const updated = { ...editingExercise }; updated.defaultSets[i].kg = parseInt(e.target.value) || 0; setEditingExercise(updated); }} placeholder="kg" className="bg-zinc-700 rounded-lg p-2 text-white text-center" />
                    <input type="number" value={set.reps} onChange={(e) => { const updated = { ...editingExercise }; updated.defaultSets[i].reps = parseInt(e.target.value) || 0; setEditingExercise(updated); }} placeholder="reps" className="bg-zinc-700 rounded-lg p-2 text-white text-center" />
                    <button onClick={() => { const updated = { ...editingExercise }; if (updated.defaultSets.length > 1) { updated.defaultSets.splice(i, 1); setEditingExercise(updated); } }} className="text-red-400"><X size={16} /></button>
                  </div>
                ))}
              </div>
              <button onClick={() => { const updated = { ...editingExercise }; if (!updated.defaultSets) updated.defaultSets = []; const last = updated.defaultSets[updated.defaultSets.length - 1] || { kg: 0, reps: 0 }; updated.defaultSets.push({ ...last }); setEditingExercise(updated); }} className="w-full bg-zinc-700 text-zinc-400 rounded-lg p-2 text-sm mt-2">+ Add Set</button>
            </div>
          </div>
        </div>
      );
    }

    // SETTINGS
    if (view === 'settings') {
      return (
        <div className="min-h-screen bg-zinc-900 text-white pb-24">
          <div className="bg-zinc-800 p-4 mb-6"><h1 className="text-2xl font-bold">Settings</h1></div>
          <div className="p-6">
            <div className="bg-zinc-800 rounded-xl p-4 mb-4">
              <h3 className="font-semibold mb-2">Weekly Goal</h3>
              <input type="number" value={weeklyGoal} onChange={(e) => { const val = parseInt(e.target.value) || 1; setWeeklyGoal(val); localStorage.setItem('weeklyGoal', val); }} className="w-full bg-zinc-700 rounded-lg p-3 text-white" />
            </div>
            <button onClick={() => { if (confirm('Clear all data?')) { localStorage.clear(); setWorkouts([]); setTemplates([]); setExercisesDB([]); setWeeklyGoal(6); } }} className="w-full bg-red-600 text-white rounded-xl p-4 font-semibold">Clear All Data</button>
          </div>
        </div>
      );
    }

    // WORKOUT DETAIL
    if (view === 'workoutDetail' && selectedDate) {
      const dateWorkouts = getWorkoutsByDate(selectedDate);
      return (
        <div className="min-h-screen bg-zinc-900 text-white">
          <div className="bg-zinc-800 p-4 flex items-center gap-4">
            <button onClick={() => { setView('home'); setSelectedDate(null); }}><ChevronLeft size={24} /></button>
            <h1 className="text-xl font-bold">{new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</h1>
          </div>
          <div className="p-6 space-y-4">
            {dateWorkouts.length === 0 ? <p className="text-center text-zinc-400 mt-10">No workouts</p> : dateWorkouts.map(workout => (
              <div key={workout.id} className="bg-zinc-800 rounded-2xl p-5">
                <div className="flex justify-between mb-4">
                  <div><h2 className="text-2xl font-bold mb-1">{workout.name}</h2><p className="text-sm text-zinc-400">{workout.duration || 0} min</p></div>
                  <button onClick={() => deleteWorkout(workout.id)} className="text-red-400"><Trash2 size={20} /></button>
                </div>
                {workout.exercises?.map((ex, i) => (
                  <div key={i} className="mb-4">
                    <h3 className="text-lg font-semibold text-blue-400 mb-2">{ex.name}</h3>
                    <div className="space-y-1 text-sm">{ex.sets.map((set, j) => (<div key={j} className="flex gap-2 text-zinc-300"><span className={set.completed ? 'text-green-400' : 'text-zinc-500'}>{set.completed ? '✓' : '○'}</span><span>Set {j + 1}: {set.kg} kg × {set.reps}</span></div>))}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      );
    }

    // MONTH DETAIL
    if (view === 'monthDetail' && selectedMonth !== null) {
      const monthWorkouts = getMonthWorkouts(selectedMonth);
      const now = new Date();
      const targetDate = new Date(now.getFullYear(), now.getMonth() + selectedMonth, 1);
      const monthName = months[targetDate.getMonth()];
      return (
        <div className="min-h-screen bg-zinc-900 text-white">
          <div className="bg-zinc-800 p-4 flex items-center gap-4">
            <button onClick={() => { setView('home'); setSelectedMonth(null); }}><ChevronLeft size={24} /></button>
            <h1 className="text-xl font-bold">{monthName}</h1>
          </div>
          <div className="p-6">
            <div className="bg-zinc-800 rounded-2xl p-4 mb-6"><p className="text-3xl font-bold text-rose-400">{monthWorkouts.length}</p><p className="text-zinc-400">Workouts</p></div>
            <div className="space-y-4">{monthWorkouts.map(workout => (
              <div key={workout.id} onClick={() => { setSelectedDate(workout.date); setView('workoutDetail'); }} className="bg-zinc-800 rounded-2xl p-4 cursor-pointer">
                <div className="flex justify-between mb-2">
                  <div><h3 className="font-semibold text-lg">{workout.name}</h3><p className="text-xs text-zinc-400">{new Date(workout.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p></div>
                  <ChevronRight className="text-zinc-500" size={20} />
                </div>
              </div>
            ))}</div>
          </div>
        </div>
      );
    }

    // HOME view (main dashboard)
    if (view === 'home') {
      return (
        <div className="min-h-screen bg-zinc-900 text-white pb-24">
          <div className="bg-teal-800 rounded-b-3xl p-6 mb-6">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16">
                  <svg className="w-16 h-16 -rotate-90"><circle cx="32" cy="32" r="28" stroke="#94a3b8" strokeWidth="4" fill="none" /><circle cx="32" cy="32" r="28" stroke="#d4a574" strokeWidth="4" fill="none" strokeDasharray={`${(weekWorkouts.length / weeklyGoal) * 176} 176`} /></svg>
                  <div className="absolute inset-0 flex items-center justify-center text-sm font-bold">{weekWorkouts.length}/{weeklyGoal}</div>
                </div>
                <div><div className="text-xs text-teal-200 mb-1">WEEKLY GOAL</div><div className="text-lg font-semibold">Keep it up!</div></div>
              </div>
              <div className="text-right"><div className="text-xs text-teal-200 mb-1">BEST STREAK</div><div className="text-2xl font-bold">{streak}</div></div>
            </div>
          </div>

          <button
            onClick={() => setShowCalendar(true)}
            className="mx-4 mb-6 bg-zinc-800 hover:bg-zinc-700 rounded-2xl p-4 w-[calc(100%-2rem)] text-left"
          >
            <div className="flex justify-between text-xs text-zinc-400 mb-3">
              <span>THIS WEEK</span>
              <span>{weekWorkouts.length} of {weeklyGoal}</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-zinc-500">
              <Calendar size={20} />
              <span className="text-sm">Tap to open calendar</span>
            </div>
          </button>

          <div className="mx-6 mb-6 space-y-3">
            <button onClick={() => setView('selectTemplate')} className="w-full bg-rose-400 hover:bg-rose-500 text-white rounded-2xl p-4 flex items-center justify-center gap-2 font-semibold"><Plus size={20} /> Start New Workout</button>
            <button onClick={() => { setEditingTemplate({ name: '', exercises: [] }); setView('manageTemplates'); }} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white rounded-2xl p-4 flex items-center justify-center gap-2 font-semibold"><Edit2 size={20} /> Manage Templates</button>
          </div>

          <div className="mx-4 mb-6">
            <h2 className="text-zinc-400 text-sm mb-4">RECENT WORKOUTS</h2>
            <div className="grid gap-4">{workouts.slice(0, 3).map(workout => (
              <div key={workout.id} onClick={() => { setSelectedDate(workout.date); setView('workoutDetail'); }} className="bg-zinc-800 rounded-2xl p-4 cursor-pointer">
                <div className="flex justify-between mb-2">
                  <div><div className="flex items-center gap-2 mb-1"><Dumbbell size={20} /><h3 className="font-semibold text-lg">{workout.name}</h3></div><p className="text-xs text-zinc-400">{new Date(workout.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p></div>
                  <ChevronRight className="text-zinc-500" size={20} />
                </div>
              </div>
            ))}</div>
          </div>

          <div className="mx-4">
            <h2 className="text-2xl font-bold mb-4">Monthly Progress</h2>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => { setSelectedMonth(0); setView('monthDetail'); }} className="bg-zinc-800 rounded-2xl p-4 border-2 border-rose-400 text-left">
                <div className="text-4xl mb-2">📅</div>
                <h3 className="font-semibold mb-1">{months[new Date().getMonth()]}</h3>
                <div className="w-full bg-zinc-700 rounded-full h-2 mb-2"><div className="bg-rose-400 h-2 rounded-full" style={{ width: `${Math.min((thisMonth.length / 30) * 100, 100)}%` }}></div></div>
                <p className="text-rose-400 font-semibold">{thisMonth.length} workouts</p>
              </button>
              <button onClick={() => { setSelectedMonth(-1); setView('monthDetail'); }} className="bg-zinc-800 rounded-2xl p-4 text-left">
                <div className="text-4xl mb-2">☁️</div>
                <h3 className="font-semibold mb-1">{months[(new Date().getMonth() - 1 + 12) % 12]}</h3>
                <div className="w-full bg-zinc-700 rounded-full h-2 mb-2"><div className="bg-teal-400 h-2 rounded-full" style={{ width: `${Math.min((lastMonth.length / 30) * 100, 100)}%` }}></div></div>
                <p className="text-teal-400 font-semibold">{lastMonth.length} workouts</p>
              </button>
            </div>
          </div>
        </div>
      );
    }

    // SELECT TEMPLATE
    if (view === 'selectTemplate') {
      return (
        <div className="min-h-screen bg-zinc-900 text-white p-6">
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => setView('home')}><X size={28} /></button>
            <h1 className="text-2xl font-bold">Select Template</h1>
            <div className="w-7"></div>
          </div>

          {templates.length === 0 ? (
            <div className="text-center mt-20">
              <p className="text-zinc-400 mb-4">No templates yet</p>
              <button onClick={() => { setEditingTemplate({ name: '', exercises: [] }); setView('manageTemplates'); }} className="bg-rose-400 text-white px-6 py-3 rounded-xl">Create First Template</button>
            </div>
          ) : (
            <div className="space-y-4">{templates.map(template => (
              <button key={template.id} onClick={() => selectTemplate(template)} className="w-full bg-zinc-800 hover:bg-zinc-700 rounded-2xl p-5 text-left">
                <h3 className="text-xl font-semibold mb-2">{template.name}</h3>
                <p className="text-sm text-zinc-400">{template.exercises.length} exercises</p>
              </button>
            ))}</div>
          )}
        </div>
      );
    }

    // ACTIVE WORKOUT
    if (view === 'activeWorkout' && activeWorkout) {
      return (
        <div className="min-h-screen bg-zinc-900 text-white pb-24">
          <div className="bg-zinc-800 p-4 sticky top-0 z-10">
            <div className="flex justify-between mb-3">
              <button onClick={() => { if (confirm('Cancel workout?')) { setActiveWorkout(null); setWorkoutTimer(0); setView('home'); } }}><X size={24} /></button>
              <button onClick={finishWorkout} className="bg-green-500 text-white px-6 py-2 rounded-xl font-semibold">Finish</button>
            </div>
            <div className="flex items-center justify-center gap-2 text-zinc-400"><Clock size={18} /><span className="text-xl font-mono">{formatTime(workoutTimer)}</span></div>
          </div>

          <div className="p-6">
            <h1 className="text-3xl font-bold mb-6">{activeWorkout.name}</h1>
            <div>
              {activeWorkout.exercises.map((exercise, exIndex) => {
                const previousSets = getPreviousSetsForExercise(exercise.name);

                return (
                  <ActiveWorkoutExerciseCard
                    key={exIndex}
                    exercise={exercise}
                    exerciseIndex={exIndex}
                    onUpdateSet={updateSet}
                    onToggleSet={toggleSet}
                    onAddSet={addSetToActiveExercise}
                    previousSets={previousSets}
                  />
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    // MANAGE TEMPLATES
    if (view === 'manageTemplates') {
      if (editingTemplate) {
        return (
          <div className="min-h-screen bg-zinc-900 text-white p-6 pb-24">
            <div className="flex justify-between mb-6">
              <button onClick={() => setEditingTemplate(null)}><X size={28} /></button>
              <h1 className="text-2xl font-bold">Edit Template</h1>
              <button onClick={saveTemplate} className="text-green-400"><Save size={24} /></button>
            </div>

            <input type="text" value={editingTemplate.name} onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })} placeholder="Template Name" className="w-full bg-zinc-800 rounded-xl p-4 text-white text-xl mb-6" />

            <div className="space-y-4 mb-6">
              {editingTemplate.exercises.map((exercise, exIndex) => (
                <div key={exIndex} className="bg-zinc-800 rounded-xl p-4">
                  <div className="flex justify-between mb-3">
                    <input type="text" value={exercise.name} onChange={(e) => { const updated = { ...editingTemplate }; updated.exercises[exIndex].name = e.target.value; setEditingTemplate(updated); }} placeholder="Exercise name" className="flex-1 bg-zinc-700 rounded-lg p-3 text-white" />
                    <button onClick={() => removeExercise(exIndex)} className="ml-2 text-red-400 p-2"><Trash2 size={18} /></button>
                  </div>

                  <div className="grid grid-cols-[50px_80px_80px_40px] gap-2 text-xs text-zinc-500 mb-2">
                    <span>Set</span><span className="text-center">kg</span><span className="text-center">Reps</span><span></span>
                  </div>

                  {exercise.sets.map((set, setIndex) => (
                    <div key={setIndex} className="grid grid-cols-[50px_80px_80px_40px] gap-2 mb-2">
                      <span className="text-zinc-400">{setIndex + 1}</span>
                      <input type="number" value={set.kg} onChange={(e) => { const updated = { ...editingTemplate }; updated.exercises[exIndex].sets[setIndex].kg = parseInt(e.target.value) || 0; setEditingTemplate(updated); }} className="bg-zinc-700 rounded-lg p-2 text-white text-center" />
                      <input type="number" value={set.reps} onChange={(e) => { const updated = { ...editingTemplate }; updated.exercises[exIndex].sets[setIndex].reps = parseInt(e.target.value) || 0; setEditingTemplate(updated); }} className="bg-zinc-700 rounded-lg p-2 text-white text-center" />
                      <button onClick={() => removeSet(exIndex, setIndex)} className="text-red-400 text-sm"><X size={16} /></button>
                    </div>
                  ))}

                  <button onClick={() => addSetToExercise(exIndex)} className="w-full bg-zinc-700 text-zinc-400 rounded-lg p-2 text-sm mt-2">+ Add Set</button>
                </div>
              ))}
            </div>

            <button onClick={openExerciseSelector} className="w-full bg-blue-600 text-white rounded-xl p-4 font-semibold">+ Add Exercise</button>
          </div>
        );
      }

      return (
        <div className="min-h-screen bg-zinc-900 text-white p-6 pb-24">
          <div className="flex justify-between mb-6"><button onClick={() => setView('home')}><X size={28} /></button><h1 className="text-2xl font-bold">Templates</h1><div className="w-7"></div></div>
          <button onClick={() => setEditingTemplate({ name: '', exercises: [] })} className="w-full bg-rose-400 text-white rounded-xl p-4 font-semibold mb-6"><Plus className="inline mr-2" size={20} /> Create New</button>
          <div className="space-y-4">{templates.map(template => (
            <div key={template.id} className="bg-zinc-800 rounded-xl p-4 flex justify-between">
              <div><h3 className="font-semibold text-lg">{template.name}</h3><p className="text-sm text-zinc-400">{template.exercises.length} exercises</p></div>
              <div className="flex gap-2">
                <button onClick={() => setEditingTemplate(template)} className="p-2 bg-zinc-700 rounded-lg text-blue-400"><Edit2 size={18} /></button>
                <button onClick={() => deleteTemplate(template.id)} className="p-2 bg-zinc-700 rounded-lg text-red-400"><Trash2 size={18} /></button>
              </div>
            </div>
          ))}</div>
        </div>
      );
    }

    return null;
  };

  // Final render
  return (
    <>
      <div className="min-h-screen bg-zinc-900 flex justify-center">
        <div className="w-full max-w-[420px] relative bg-zinc-900 shadow-2xl overflow-hidden">
          {renderContent()}
        </div>
      </div>

      <BottomNav />

      {showCalendar && (
        <CalendarModal
          workouts={workouts}
          onClose={() => setShowCalendar(false)}
          onSelectDate={(d) => {
            setSelectedDate(d);
            setView('workoutDetail');
          }}
        />
      )}

      {showExerciseSelector && (
        <ExerciseSelectorModal
          exercisesDB={exercisesDB}
          onClose={() => setShowExerciseSelector(false)}
          onSelectExercise={addExerciseFromDB}
          onCreateNew={() => {
            setEditingExercise({ name: '', defaultSets: [{ kg: 0, reps: 0 }] });
            setShowExerciseSelector(false);
            setView('createExercise');
          }}
        />
      )}
    </>
  );
}