import React, { createContext, useContext, useState, useMemo } from 'react';

/**
 * Workout domain state (persistent entities + active session).
 *
 * NOTE: this provider holds STATE ONLY. All workout mutations live in
 * `src/domain/workoutActions.js` (pure, tested) and are orchestrated by
 * `src/App.jsx` (side effects, persistence, toasts). A previous revision
 * duplicated every App handler here with older, unsafe variants (splice and
 * direct nested assignment on state-derived objects); that duplication was
 * removed so there is exactly one mutation path.
 */
export const WorkoutContext = createContext();

export const WorkoutProvider = ({ children }) => {
  // Workout Data State
  const [workouts, setWorkouts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [exercisesDB, setExercisesDB] = useState([]);
  // Planned workouts: future intentions (scheduled store). Deliberately NOT
  // part of `workouts` so Statistics/History/PR/readiness selectors — which
  // read `workouts` only — can never see a plan until it is performed.
  const [scheduledWorkouts, setScheduledWorkouts] = useState([]);
  const [activeWorkout, setActiveWorkout] = useState(null);
  const [workoutTimer, setWorkoutTimer] = useState(0);
  const [isWorkoutMinimized, setIsWorkoutMinimized] = useState(false);
  const [selectedTags, setSelectedTags] = useState([]);
  const [deletedWorkout, setDeletedWorkout] = useState(null);
  const [pendingSummary, setPendingSummary] = useState(null);

  // Memoized so unrelated state updates don't force every consumer to rerender.
  // (Only App consumes this context today, but the memo keeps that invariant
  // cheap if more consumers are added later.)
  const value = useMemo(() => ({
    workouts,
    setWorkouts,
    templates,
    setTemplates,
    exercisesDB,
    setExercisesDB,
    scheduledWorkouts,
    setScheduledWorkouts,
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
  }), [
    workouts,
    templates,
    exercisesDB,
    scheduledWorkouts,
    activeWorkout,
    workoutTimer,
    isWorkoutMinimized,
    selectedTags,
    deletedWorkout,
    pendingSummary,
  ]);

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
