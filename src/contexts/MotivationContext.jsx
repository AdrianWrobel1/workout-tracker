import React, { createContext, useContext, useReducer, useCallback } from 'react';

const MotivationContext = createContext();

// Motivation state: goals, commitments, point rewards, tier
const initialState = {
  commitments: {}, // { id: { exercise, reps, weight, deadline, completed, createdAt } }
  goals: {}, // { id: { title, category, target, progress, deadline } }
  rewardPoints: 0,
  tier: 'starting', // starting, building, rolling, unstoppable, legendary
  achievements: {}, // { id: { name, unlockedAt, icon } }
  loadingMotiv: false,
  errorMotiv: null
};

const motivationReducer = (state, action) => {
  switch (action.type) {
    case 'ADD_COMMITMENT':
      return {
        ...state,
        commitments: { ...state.commitments, [action.payload.id]: action.payload }
      };
    case 'UPDATE_COMMITMENT':
      return {
        ...state,
        commitments: { ...state.commitments, [action.payload.id]: { ...state.commitments[action.payload.id], ...action.payload.updates } }
      };
    case 'COMPLETE_COMMITMENT':
      const { [action.payload]: removed, ...restCommit } = state.commitments;
      return {
        ...state,
        commitments: restCommit,
        rewardPoints: state.rewardPoints + 50
      };
    case 'ADD_GOAL':
      return {
        ...state,
        goals: { ...state.goals, [action.payload.id]: action.payload }
      };
    case 'UPDATE_GOAL':
      return {
        ...state,
        goals: { ...state.goals, [action.payload.id]: { ...state.goals[action.payload.id], ...action.payload.updates } }
      };
    case 'ADD_REWARD_POINTS':
      return { ...state, rewardPoints: state.rewardPoints + action.payload };
    case 'SET_TIER':
      return { ...state, tier: action.payload };
    case 'UNLOCK_ACHIEVEMENT':
      return {
        ...state,
        achievements: { ...state.achievements, [action.payload.id]: action.payload }
      };
    case 'SET_LOADING':
      return { ...state, loadingMotiv: action.payload };
    case 'SET_ERROR':
      return { ...state, errorMotiv: action.payload };
    default:
      return state;
  }
};

export function MotivationProvider({ children }) {
  const [state, dispatch] = useReducer(motivationReducer, initialState);

  const addCommitment = useCallback((exercise, reps, weight, deadline) => {
    const commitment = {
      id: `commit_${Date.now()}`,
      exercise,
      reps,
      weight,
      deadline,
      completed: false,
      createdAt: new Date().toISOString()
    };
    dispatch({ type: 'ADD_COMMITMENT', payload: commitment });
    return commitment;
  }, []);

  const completeCommitment = useCallback((id) => {
    dispatch({ type: 'COMPLETE_COMMITMENT', payload: id });
  }, []);

  const addGoal = useCallback((title, category, target, deadline) => {
    const goal = {
      id: `goal_${Date.now()}`,
      title,
      category,
      target,
      progress: 0,
      deadline,
      createdAt: new Date().toISOString()
    };
    dispatch({ type: 'ADD_GOAL', payload: goal });
    return goal;
  }, []);

  const updateGoal = useCallback((id, updates) => {
    dispatch({ type: 'UPDATE_GOAL', payload: { id, updates } });
  }, []);

  const addRewardPoints = useCallback((points) => {
    dispatch({ type: 'ADD_REWARD_POINTS', payload: points });
  }, []);

  const setTier = useCallback((tier) => {
    dispatch({ type: 'SET_TIER', payload: tier });
  }, []);

  const unlockAchievement = useCallback((id, name, icon = '🏆') => {
    const achievement = {
      id,
      name,
      icon,
      unlockedAt: new Date().toISOString()
    };
    dispatch({ type: 'UNLOCK_ACHIEVEMENT', payload: achievement });
    return achievement;
  }, []);

  const value = {
    ...state,
    addCommitment,
    completeCommitment,
    addGoal,
    updateGoal,
    addRewardPoints,
    setTier,
    unlockAchievement,
    dispatch
  };

  return <MotivationContext.Provider value={value}>{children}</MotivationContext.Provider>;
}

export function useMotivation() {
  const context = useContext(MotivationContext);
  if (!context) {
    throw new Error('useMotivation must be used within MotivationProvider');
  }
  return context;
}
