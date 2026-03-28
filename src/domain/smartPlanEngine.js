/**
 * SMART PLAN ENGINE
 * System-level coaching intelligence that transforms the app into a personal trainer
 * Analyzes training patterns, creates adaptive plans, and provides session-level coaching
 */

/**
 * Analyze training needs and create personalized session recommendation
 * Considers: readiness, consistency, muscle balance, recent fatigue, training gaps
 */
export const generateSmartSessionPlan = (workouts, readiness, muscleBalance, masteryData) => {
  const now = new Date();
  const recentWorkouts = (workouts || [])
    .filter(w => w.date && new Date(w.date) >= new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const lastWorkout = recentWorkouts[0];
  const daysSinceLastSession = lastWorkout
    ? Math.floor((now - new Date(lastWorkout.date)) / (24 * 60 * 60 * 1000))
    : 999;

  // Readiness assessment
  const readinessLevel = readiness?.status || 'optimal';
  const acuteLoad = Number(readiness?.acuteLoad) || 0;
  const chronicLoad = Number(readiness?.chronicLoad) || 0;

  // Recovery status
  const recoveryScore = chronicLoad > 0 ? Math.min(100, (1 - Math.min(acuteLoad / (chronicLoad * 1.5), 1)) * 100) : 75;
  const isFatigued = readinessLevel === 'fatigue' || acuteLoad > chronicLoad * 1.3;
  const isOverreached = acuteLoad > chronicLoad * 1.8;

  // Muscle balance analysis
  const imbalances = Object.entries(muscleBalance || {})
    .filter(([_, pair]) => pair?.status === 'imbalanced')
    .map(([key, pair]) => key);

  // Training frequency pattern
  const workoutsThisWeek = recentWorkouts.filter(
    w => new Date(w.date) >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  ).length;

  // Mastery progression
  const masteryLevel = masteryData?.level || 0;
  const masteryPoints = masteryData?.masteryPoints || 0;

  // COACH DECISION LOGIC
  let sessionType = 'balanced'; // balanced | intensity | volume | technique | deload | recovery
  let intensityRecommendation = 'moderate';
  let volumeRecommendation = 'standard';
  let focusAreas = [];
  let warnings = [];
  let confidence = 'high';

  // Decision 1: Recovery Priority
  if (isOverreached) {
    sessionType = 'deload';
    intensityRecommendation = 'light';
    volumeRecommendation = 'low';
    warnings.push('⚠️ Overreaching detected - prioritize recovery');
    confidence = 'high';
    return {
      sessionType,
      intensityRecommendation,
      volumeRecommendation,
      focusAreas,
      warnings,
      confidence,
      headline: 'Recovery Session Prescribed',
      description: 'Your body needs recovery. Do light cardio, stretching, or take a complete rest day.',
      sets: 'Low 3-5',
      reps: 'High 12-15',
      restPeriod: '30-45s',
      paceRecommendation: 'Slow, controlled',
      nextSessionDays: 2
    };
  }

  if (isFatigued) {
    sessionType = 'technique';
    intensityRecommendation = 'light-moderate';
    volumeRecommendation = 'low-moderate';
    warnings.push('Elevated fatigue - reduce intensity');
    confidence = 'high';
  }

  // Decision 2: Frequency & Spacing
  if (daysSinceLastSession === 0) {
    warnings.push('Already worked out today - consider active recovery or skip');
    sessionType = 'recovery';
    confidence = 'high';
  } else if (daysSinceLastSession === 1) {
    if (!isFatigued && recoveryScore > 70) {
      sessionType = 'balanced';
      intensityRecommendation = 'moderate';
    } else {
      sessionType = 'technique';
      intensityRecommendation = 'light-moderate';
    }
  } else if (daysSinceLastSession >= 3 && !isOverreached) {
    // Fresh and recovered
    intensityRecommendation = 'high';
    volumeRecommendation = 'high';
    if (workoutsThisWeek < 3) {
      sessionType = 'intensity';
      focusAreas.push('Push max strength');
    }
  }

  // Decision 3: Imbalance Correction
  if (imbalances.length > 0) {
    focusAreas.push(`Address ${imbalances.map(i => i.replace(/([A-Z])/g, ' $1').toLowerCase()).join(', ')}`);
    if (sessionType !== 'deload' && sessionType !== 'recovery') {
      sessionType = 'balanced';
    }
  } else if (masteryLevel >= 3 && !isFatigued) {
    focusAreas.push('Push progression on mastered movements');
    if (sessionType === 'balanced') {
      sessionType = 'intensity';
    }
  }

  // Decision 4: Mastery Progression
  if (masteryPoints > 80 && masteryLevel < 5) {
    focusAreas.push(`Next tier: ${masteryData?.nextMilestone || 'Master level'}`);
  }

  // Build description
  let description = '';
  if (sessionType === 'balanced') {
    description = `${recoveryScore > 80 ? 'You\'re well-recovered.' : 'Moderate recovery.'} Standard training approach.`;
  } else if (sessionType === 'intensity') {
    description = `Excellent recovery - time to push intensity and chase new PRs.`;
  } else if (sessionType === 'volume') {
    description = `Good condition for higher volume work. Build training density.`;
  } else if (sessionType === 'technique') {
    description = `Focus on form and technique rather than maximal loads.`;
  } else if (sessionType === 'deload') {
    description = `Mandatory recovery session. Your CNS needs it.`;
  }

  // Rest recommendations based on session type
  const restPeriods = {
    intensity: '3-5min',
    volume: '90-120s',
    balanced: '2-3min',
    technique: '60-90s',
    deload: '45-60s',
    recovery: '30-45s'
  };

  // Rep ranges
  const repRanges = {
    intensity: '3-5',
    volume: '8-12',
    balanced: '6-10',
    technique: '6-8',
    deload: '8-12',
    recovery: '10-15'
  };

  // Determine next session timing
  let nextSessionDays = 1;
  if (isOverreached) {
    nextSessionDays = 2;
  } else if (isFatigued && daysSinceLastSession < 2) {
    nextSessionDays = 2;
  } else if (daysSinceLastSession >= 3) {
    nextSessionDays = 1;
  }

  return {
    sessionType,
    intensityRecommendation,
    volumeRecommendation,
    focusAreas,
    warnings,
    confidence,
    headline: `${sessionType.charAt(0).toUpperCase() + sessionType.slice(1)} Session Recommended`,
    description,
    sets: sessionType === 'intensity' ? '3-4' : sessionType === 'volume' ? '4-5' : sessionType === 'deload' ? '2-3' : '3-4',
    reps: repRanges[sessionType],
    restPeriod: restPeriods[sessionType],
    paceRecommendation:
      sessionType === 'intensity'
        ? 'Explosive concentric, controlled eccentric'
        : sessionType === 'technique'
        ? 'Slow, deliberate, focus on form'
        : 'Steady controlled pace',
    nextSessionDays,
    recoveryScore: Math.round(recoveryScore),
    readinessAdvice: getReadinessAdvice(readinessLevel, acuteLoad, chronicLoad)
  };
};

/**
 * Generate week-level training prescription
 * Plans the entire week based on current state and goals
 */
export const generateWeeklyTrainingPlan = (workouts, readiness, masteryData, consistency) => {
  const now = new Date();
  const currentDayOfWeek = now.getDay();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - currentDayOfWeek);
  weekStart.setHours(0, 0, 0, 0);

  const thisWeekWorkouts = workouts.filter(
    w => new Date(w.date) >= weekStart && new Date(w.date) <= now
  );

  const targetSessions = consistency && consistency.consistency > 80 ? 4 : 3;
  const sessionsPlanned = thisWeekWorkouts.length;
  const sessionsRemaining = Math.max(0, targetSessions - sessionsPlanned);

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const weekPlan = [];
  const acuteLoad = Number(readiness?.acuteLoad) || 0;
  const chronicLoad = Number(readiness?.chronicLoad) || 0;
  const trainingRatio = chronicLoad > 0 ? acuteLoad / chronicLoad : 0;

  // Generate daily recommendations
  for (let i = currentDayOfWeek; i < 7; i++) {
    const dayDate = new Date(weekStart);
    dayDate.setDate(weekStart.getDate() + i);
    const dayName = dayNames[i];

    // Check if already worked out
    const hasWorked = thisWeekWorkouts.some(
      w => new Date(w.date).toDateString() === dayDate.toDateString()
    );

    let recommendation = 'OFF';
    let focus = '';

    if (!hasWorked && sessionsRemaining > 0 && i !== currentDayOfWeek) {
      if (trainingRatio > 1.3) {
        recommendation = 'LIGHT';
        focus = 'Recovery focus';
      } else if (trainingRatio < 0.8 && sessionsRemaining > 1) {
        recommendation = 'INTENSITY';
        focus = 'Push strength';
      } else if (i % 2 === 0 || i === 5) {
        // Odd days for intensity, even for volume
        recommendation = 'VOLUME';
        focus = 'Density & control';
      } else {
        recommendation = 'BALANCED';
        focus = 'Standard session';
      }
    }

    weekPlan.push({
      day: dayName,
      date: dayDate.toISOString().split('T')[0],
      recommendation,
      focus,
      index: i
    });
  }

  return {
    targetSessions,
    completedSessions: sessionsPlanned,
    sessionsRemaining,
    plan: weekPlan,
    overallTheme:
      trainingRatio > 1.3
        ? 'Recovery Week - Scale back'
        : trainingRatio > 1
        ? 'Maintenance - Steady pace'
        : 'Growth Phase - Build volume',
    adjustmentNeeded: trainingRatio > 1.3
  };
};

/**
 * Analysis engine: Identify weak points and opportunities
 */
export const analyzeTrainingGaps = (workouts, muscleBalance, masteryData) => {
  const exerciseExposure = {};
  const exerciseRecords = {};

  (workouts || []).forEach(w => {
    (w.exercises || []).forEach(ex => {
      if (!exerciseExposure[ex.exerciseId]) {
        exerciseExposure[ex.exerciseId] = { name: ex.name, count: 0, lastVolume: 0 };
        exerciseRecords[ex.exerciseId] = { prs: 0, maxVolume: 0 };
      }
      exerciseExposure[ex.exerciseId].count += 1;
      let setVolume = 0;
      (ex.sets || []).forEach(s => {
        if (s.completed) setVolume += (Number(s.kg) || 0) * (Number(s.reps) || 0);
      });
      exerciseExposure[ex.exerciseId].lastVolume = setVolume;
      exerciseRecords[ex.exerciseId].maxVolume = Math.max(
        exerciseRecords[ex.exerciseId].maxVolume,
        setVolume
      );
    });

    // Count PRs
    Object.keys(w.prStatus || {}).forEach(exId => {
      if (!exerciseRecords[exId]) exerciseRecords[exId] = { prs: 0, maxVolume: 0 };
      exerciseRecords[exId].prs += 1;
    });
  });

  // Identify stale exercises
  const staleThreshold = 21; // Days
  const now = new Date();
  const staleExercises = Object.entries(exerciseExposure)
    .filter(([_, data]) => {
      const lastSeen = (workouts || [])
        .filter(w => (w.exercises || []).some(ex => ex.exerciseId == _))
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

      if (!lastSeen) return true;
      const daysSinceLast = Math.floor((now - new Date(lastSeen.date)) / (24 * 60 * 60 * 1000));
      return daysSinceLast > staleThreshold;
    })
    .slice(0, 3)
    .map(([_, data]) => ({ name: data.name, daysSinceLast: staleThreshold + 7 }));

  // Identify plateau exercises
  const plateaiedExercises = Object.entries(exerciseRecords)
    .filter(([_, data]) => data.prs === 0 && data.maxVolume > 0)
    .slice(0, 3)
    .map(([exId, data]) => {
      const exData = exerciseExposure[exId];
      return {
        name: exData?.name || 'Unknown',
        sessionsSinceLastPR: exData?.count || 0,
        maxVolume: data.maxVolume
      };
    });

  return {
    staleExercises,
    plateaiedExercises,
    recommendations: [
      ...staleExercises.map(
        ex => `Reintroduce ${ex.name} (haven't done it in ${ex.daysSinceLast} days)`
      ),
      ...plateaiedExercises.map(
        ex =>
          `Push progression on ${ex.name} (${ex.sessionsSinceLastPR} sessions without PR - try higher weight or reps)`
      )
    ]
  };
};

/**
 * Session coaching - real-time guidance
 */
export const generateSessionCoaching = (currentSession, recentWorkouts, masteryData, anomalyDetection) => {
  const sessionVolume = (currentSession.exercises || []).reduce((sum, ex) => {
    return (
      sum +
      (ex.sets || []).reduce(
        (ssum, s) => ssum + (s.completed ? (Number(s.kg) || 0) * (Number(s.reps) || 0) : 0),
        0
      )
    );
  }, 0);

  const avgRecentVolume =
    recentWorkouts.length > 0
      ? recentWorkouts.reduce((sum, w) => {
          const vol = (w.exercises || []).reduce((exsum, ex) => {
            return (
              exsum +
              (ex.sets || []).reduce(
                (ssum, s) => ssum + ((Number(s.kg) || 0) * (Number(s.reps) || 0) || 0),
                0
              )
            );
          }, 0);
          return sum + vol;
        }, 0) / recentWorkouts.length
      : sessionVolume;

  const volumeDelta = ((sessionVolume - avgRecentVolume) / avgRecentVolume) * 100;
  const isProgressiveOverload = volumeDelta > 5;
  const isDeload = volumeDelta < -15;
  const isAnomalous = anomalyDetection?.severity === 'high' || anomalyDetection?.severity === 'medium';

  const tips = [];
  const alerts = [];

  if (isProgressiveOverload) {
    tips.push('Great volume progression! Keep this momentum.');
  }
  if (isDeload) {
    tips.push('Smart deload session. Recovery is key.');
  }
  if (isAnomalous) {
    alerts.push(`Unusual pattern detected: ${anomalyDetection?.anomalies?.[0]}`);
  }

  // Exercise-specific coaching
  const exerciseCoaching = (currentSession.exercises || []).map(ex => ({
    name: ex.name,
    tip: generateExerciseTip(ex, masteryData),
    prStatus: currentSession.prStatus?.[ex.exerciseId] ? 'NEW PR - Nice!' : 'No PR this session'
  }));

  return {
    volumeDelta: Math.round(volumeDelta),
    isProgressiveOverload,
    isDeload,
    isAnomalous,
    tips,
    alerts,
    exerciseCoaching,
    motivation: generateMotivationalMessage(isProgressiveOverload, isDeload, currentSession.exercises?.length || 0)
  };
};

/**
 * Helper: Generate individual exercise coaching tip
 */
function generateExerciseTip(exercise, masteryData) {
  const setCount = exercise.sets?.length || 0;
  const completedSets = exercise.sets?.filter(s => s.completed)?.length || 0;

  if (completedSets === 0) return 'Get started!';
  if (completedSets < setCount / 2) return 'Keep grinding, halfway there!';
  if (completedSets >= setCount) return 'Set complete! Form solid?';
  return 'Steady pace, maintain form.';
}

/**
 * Helper: Generate motivational message
 */
function generateMotivationalMessage(isProgressive, isDeload, exerciseCount) {
  if (isDeload) return 'Respecting the recovery. Smart training.';
  if (isProgressive && exerciseCount > 4) return 'Progressive and comprehensive. Elite-level approach!';
  if (isProgressive) return 'Progressive overload locked in. Keep building!';
  return 'Consistency beats perfection. Great work!';
}

/**
 * Helper: Generate readiness advice
 */
function getReadinessAdvice(status, acuteLoad, chronicLoad) {
  if (status === 'fatigue') {
    return 'Elevated fatigue detected. Focus on form and technique rather than max loads.';
  }
  if (status === 'low') {
    return 'CNS is taxed. Good day for lighter work or active recovery.';
  }

  const ratio = chronicLoad > 0 ? acuteLoad / chronicLoad : 0;
  if (ratio > 1.2) {
    return 'Accumulating fatigue. Monitor recovery closely.';
  }
  if (ratio < 0.7) {
    return 'Well-recovered. Good time to push intensity.';
  }

  return 'Optimal readiness. Execute your plan with full intent.';
}

/**
 * Long-term progression tracking and goal alignment
 */
export const generateProgressionReport = (workouts, masteryData, consistency) => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const workouts30d = workouts.filter(w => new Date(w.date) >= thirtyDaysAgo);
  const workouts90d = workouts.filter(w => new Date(w.date) >= ninetyDaysAgo);

  const totalVolume30d = workouts30d.reduce((sum, w) => {
    const vol = (w.exercises || []).reduce((exsum, ex) => {
      return (
        exsum +
        (ex.sets || []).reduce(
          (ssum, s) => ssum + (Number(s.kg) || 0) * (Number(s.reps) || 0),
          0
        )
      );
    }, 0);
    return sum + vol;
  }, 0);

  const totalVolume90d = workouts90d.reduce((sum, w) => {
    const vol = (w.exercises || []).reduce((exsum, ex) => {
      return (
        exsum +
        (ex.sets || []).reduce(
          (ssum, s) => ssum + (Number(s.kg) || 0) * (Number(s.reps) || 0),
          0
        )
      );
    }, 0);
    return sum + vol;
  }, 0);

  const volumeProgress = ((totalVolume30d - totalVolume90d / 3) / (totalVolume90d / 3)) * 100;

  return {
    sessions30d: workouts30d.length,
    sessions90d: workouts90d.length,
    totalVolume30d,
    totalVolume90d,
    volumeProgress: Math.round(volumeProgress),
    masteryLevel: masteryData?.level || 0,
    consistencyScore: consistency?.consistency || 0,
    trend:
      volumeProgress > 10
        ? 'Strongly progressing'
        : volumeProgress > 0
        ? 'Steady progression'
        : 'Plateau/maintenance',
    nextMilestone: masteryData?.nextMilestone || 'Continue building'
  };
};
