import React, { createContext, useContext, useState, useCallback } from 'react';

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

    // PR & Notifications
    activePRBanner,
    setActivePRBanner,
    prBannerVisible,
    setPRBannerVisible,
    handleShowPRBanner,
    handleClosePRBanner,
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
