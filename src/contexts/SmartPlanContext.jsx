import React, { createContext, useContext, useMemo } from 'react';
import {
  generateSmartSessionPlan,
  generateWeeklyTrainingPlan,
  analyzeTrainingGaps,
  generateSessionCoaching,
  generateProgressionReport
} from '../domain/smartPlanEngine';

const SmartPlanContext = createContext();

export const SmartPlanProvider = ({
  children,
  workouts = [],
  readiness = null,
  muscleBalance = null,
  masteryData = null,
  consistencyData = null,
  currentSession = null,
  anomalyDetection = null
}) => {
  // Generate all smart plans based on current data
  const sessionPlan = useMemo(
    () => generateSmartSessionPlan(workouts, readiness, muscleBalance, masteryData),
    [workouts, readiness, muscleBalance, masteryData]
  );

  const weeklyPlan = useMemo(
    () => generateWeeklyTrainingPlan(workouts, readiness, masteryData, consistencyData),
    [workouts, readiness, masteryData, consistencyData]
  );

  const trainingGaps = useMemo(
    () => analyzeTrainingGaps(workouts, muscleBalance, masteryData),
    [workouts, muscleBalance, masteryData]
  );

  const sessionCoaching = useMemo(
    () => {
      if (!currentSession) return null;
      const recentWorkouts = (workouts || [])
        .filter(w => w.date && new Date(w.date) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 3);
      return generateSessionCoaching(currentSession, recentWorkouts, masteryData, anomalyDetection);
    },
    [currentSession, workouts, masteryData, anomalyDetection]
  );

  const progressionReport = useMemo(
    () => generateProgressionReport(workouts, masteryData, consistencyData),
    [workouts, masteryData, consistencyData]
  );

  const value = {
    sessionPlan,
    weeklyPlan,
    trainingGaps,
    sessionCoaching,
    progressionReport
  };

  return (
    <SmartPlanContext.Provider value={value}>
      {children}
    </SmartPlanContext.Provider>
  );
};

export const useSmartPlan = () => {
  const context = useContext(SmartPlanContext);
  if (!context) {
    throw new Error('useSmartPlan must be used within SmartPlanProvider');
  }
  return context;
};
