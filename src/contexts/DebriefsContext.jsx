import React, { createContext, useContext, useReducer, useCallback } from 'react';

const DebriefsContext = createContext();

// Debrief entry: { id, workoutId, date, qualitativeNotes, metrics, inferredMind, createdAt }
const initialState = {
  debriefs: {},
  activeDebrief: null,
  loadingDebrief: false,
  errorDebrief: null
};

const debriefReducer = (state, action) => {
  switch (action.type) {
    case 'SET_DEBRIEFS':
      return { ...state, debriefs: action.payload };
    case 'ADD_DEBRIEF':
      return {
        ...state,
        debriefs: { ...state.debriefs, [action.payload.id]: action.payload }
      };
    case 'UPDATE_DEBRIEF':
      return {
        ...state,
        debriefs: { ...state.debriefs, [action.payload.id]: { ...state.debriefs[action.payload.id], ...action.payload.updates } }
      };
    case 'DELETE_DEBRIEF':
      const { [action.payload]: _, ...rest } = state.debriefs;
      return { ...state, debriefs: rest };
    case 'SET_ACTIVE_DEBRIEF':
      return { ...state, activeDebrief: action.payload };
    case 'SET_LOADING':
      return { ...state, loadingDebrief: action.payload };
    case 'SET_ERROR':
      return { ...state, errorDebrief: action.payload };
    default:
      return state;
  }
};

export function DebriefsProvider({ children }) {
  const [state, dispatch] = useReducer(debriefReducer, initialState);

  const createDebrief = useCallback((workoutId, qualitativeNotes = '', metricsSnapshot = {}) => {
    const debrief = {
      id: `debrief_${Date.now()}`,
      workoutId,
      date: new Date().toISOString(),
      qualitativeNotes,
      metrics: metricsSnapshot,
      inferredMind: inferMindFromNotes(qualitativeNotes),
      createdAt: new Date().toISOString()
    };
    dispatch({ type: 'ADD_DEBRIEF', payload: debrief });
    return debrief;
  }, []);

  const updateDebrief = useCallback((debrief, updates) => {
    dispatch({ type: 'UPDATE_DEBRIEF', payload: { id: debrief, updates } });
  }, []);

  const deleteDebrief = useCallback((debrief) => {
    dispatch({ type: 'DELETE_DEBRIEF', payload: debrief });
  }, []);

  const setActiveDebrief = useCallback((debrief) => {
    dispatch({ type: 'SET_ACTIVE_DEBRIEF', payload: debrief });
  }, []);

  const value = {
    ...state,
    createDebrief,
    updateDebrief,
    deleteDebrief,
    setActiveDebrief,
    dispatch
  };

  return <DebriefsContext.Provider value={value}>{children}</DebriefsContext.Provider>;
}

export function useDebriefs() {
  const context = useContext(DebriefsContext);
  if (!context) {
    throw new Error('useDebriefs must be used within DebriefsProvider');
  }
  return context;
}

/**
 * Infer user's mindset from qualitative notes using simple heuristics
 */
function inferMindFromNotes(notes = '') {
  const lower = notes.toLowerCase();
  const scores = {
    energized: 0,
    fatigued: 0,
    focused: 0,
    scattered: 0,
    confident: 0,
    uncertain: 0,
    pain: 0
  };

  // Energized
  if (lower.match(/energized|pumped|strong|powerful|explosive|amazing|great/i)) scores.energized += 2;
  if (lower.match(/feeling good|felt good/i)) scores.energized += 1;

  // Fatigued
  if (lower.match(/tired|exhausted|drained|worn out|depleted/i)) scores.fatigued += 2;
  if (lower.match(/heavy|sluggish|slow/i)) scores.fatigued += 1;

  // Focused
  if (lower.match(/focused|locked in|dialed in|sharp|clear/i)) scores.focused += 2;
  if (lower.match(/flow|zone/i)) scores.focused += 1;

  // Scattered
  if (lower.match(/distracted|scattered|unfocused|mind wandering/i)) scores.scattered += 2;

  // Confident
  if (lower.match(/confident|assured|capable|dominant/i)) scores.confident += 2;

  // Uncertain
  if (lower.match(/uncertain|doubtful|unsure|weak/i)) scores.uncertain += 2;

  // Pain
  if (lower.match(/pain|hurt|sore|injury|ache/i)) scores.pain += 2;

  const dominant = Object.entries(scores).reduce((a, b) => b[1] > a[1] ? b : a, ['neutral', 0]);
  return dominant[0];
}
