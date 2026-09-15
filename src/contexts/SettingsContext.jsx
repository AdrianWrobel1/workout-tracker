import React, { createContext, useContext, useState, useCallback } from 'react';
import { normalizeRestDuration, DEFAULT_REST_SEC } from '../domain/restTimer';

export const SettingsContext = createContext();

export const SettingsProvider = ({ children }) => {
  // User Profile Settings
  const [userWeight, setUserWeight] = useState(75);
  const [weeklyGoal, setWeeklyGoal] = useState(4); // number of workouts per week
  const [defaultStatsRange, setDefaultStatsRange] = useState('3months');
  const [trainingNotes, setTrainingNotes] = useState('');

  // Performance & UI Settings
  const [enablePerformanceAlerts, setEnablePerformanceAlerts] = useState(true);
  const [enableHapticFeedback, setEnableHapticFeedback] = useState(true);
  const [reduceAnimations, setReduceAnimations] = useState(false);

  // Rest Timer Settings (transient countdown itself lives in RestTimerContext)
  const [restDurationSec, setRestDurationSec] = useState(DEFAULT_REST_SEC);
  const [restAutoStart, setRestAutoStart] = useState(true);
  const [restSoundEnabled, setRestSoundEnabled] = useState(true);

  // PR & Notifications
  const [activePRBanner, setActivePRBanner] = useState(null);
  const [prBannerVisible, setPRBannerVisible] = useState(false);

  // --- HANDLERS: USER PROFILE ---

  const handleUserWeightChange = useCallback((weight) => {
    const numWeight = Number(weight) || 0;
    setUserWeight(numWeight);
  }, []);

  const handleWeeklyGoalChange = useCallback((goal) => {
    const numGoal = Number(goal) || 1;
    setWeeklyGoal(Math.max(1, Math.min(7, numGoal)));
  }, []);

  const handleDefaultStatsRangeChange = useCallback((range) => {
    setDefaultStatsRange(range);
  }, []);

  const handleTrainingNotesChange = useCallback((notes) => {
    setTrainingNotes(notes || '');
  }, []);

  // --- HANDLERS: PERFORMANCE SETTINGS ---

  const handleTogglePerformanceAlerts = useCallback(() => {
    setEnablePerformanceAlerts(prev => !prev);
  }, []);

  const handleToggleHapticFeedback = useCallback(() => {
    setEnableHapticFeedback(prev => !prev);
  }, []);

  const handleToggleReduceAnimations = useCallback(() => {
    setReduceAnimations(prev => !prev);
  }, []);

  // --- HANDLERS: PR NOTIFICATIONS ---

  const handleShowPRBanner = useCallback((exercise, recordTypes) => {
    setActivePRBanner({
      exerciseName: exercise,
      recordTypes
    });
    setPRBannerVisible(true);
    
    // Auto-dismiss after 6 seconds
    setTimeout(() => {
      setPRBannerVisible(false);
    }, 6000);
  }, []);

  const handleClosePRBanner = useCallback(() => {
    setPRBannerVisible(false);
  }, []);

  // --- HANDLERS: REST TIMER ---

  const handleRestDurationChange = useCallback((seconds) => {
    setRestDurationSec(normalizeRestDuration(seconds, DEFAULT_REST_SEC));
  }, []);

  const handleToggleRestAutoStart = useCallback(() => {
    setRestAutoStart(prev => !prev);
  }, []);

  const handleToggleRestSound = useCallback(() => {
    setRestSoundEnabled(prev => !prev);
  }, []);

  const value = {
    // User Profile Settings
    userWeight,
    setUserWeight,
    handleUserWeightChange,
    weeklyGoal,
    setWeeklyGoal,
    handleWeeklyGoalChange,
    defaultStatsRange,
    setDefaultStatsRange,
    handleDefaultStatsRangeChange,
    trainingNotes,
    setTrainingNotes,
    handleTrainingNotesChange,

    // Performance Settings
    enablePerformanceAlerts,
    setEnablePerformanceAlerts,
    handleTogglePerformanceAlerts,
    enableHapticFeedback,
    setEnableHapticFeedback,
    handleToggleHapticFeedback,
    reduceAnimations,
    setReduceAnimations,
    handleToggleReduceAnimations,


    // PR & Notifications
    activePRBanner,
    setActivePRBanner,
    prBannerVisible,
    setPRBannerVisible,
    handleShowPRBanner,
    handleClosePRBanner,

    // Rest Timer
    restDurationSec,
    setRestDurationSec,
    handleRestDurationChange,
    restAutoStart,
    setRestAutoStart,
    handleToggleRestAutoStart,
    restSoundEnabled,
    setRestSoundEnabled,
    handleToggleRestSound,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
};

