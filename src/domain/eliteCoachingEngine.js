/**
 * ELITE COACHING ENGINE - ENHANCED v2
 * World-class training prescription algorithm with RPE-based scaling,
 * injury prevention, and autoregulation support
 * Inspired by: Russian coaching periodization, Mike Israetel (RIR), John Kavanagh method
 */

/**
 * Calculate RPE-based intensity recommendations
 * RPE: Rate of Perceived Exertion (1-10 scale)
 */
const rpeToIntensityScale = (rpe) => {
  // Convert RPE to intensity level
  if (rpe >= 9.5) return 'veryhigh'; // RPE 9.5-10: max effort
  if (rpe >= 8.5) return 'high';     // RPE 8.5-9: heavy
  if (rpe >= 7) return 'moderate';    // RPE 7-8.5: moderate
  return 'light';                     // RPE <7: light
};

/**
 * Detect potential injury risk patterns
 */
const analyzeInjuryRiskPatterns = (workouts, records) => {
  const risks = [];

  if (!workouts || workouts.length === 0) return risks;

  // Pattern 1: Rapid load increases (>20% week-over-week on same lift)
  records?.forEach(record => {
    const recentLifts = record.lifts?.slice(-4) || [];
    if (recentLifts.length >= 2) {
      const latestVolume = recentLifts[recentLifts.length - 1]?.totalVolume || 0;
      const previousVolume = recentLifts[recentLifts.length - 2]?.totalVolume || 0;
      
      if (previousVolume > 0) {
        const increase = ((latestVolume - previousVolume) / previousVolume) * 100;
        if (increase > 25) {
          risks.push({
            type: 'rapid_load_increase',
            severity: 'medium',
            message: `${record.exerciseName}: ${increase.toFixed(0)}% volume increase this week`,
            recommendation: 'Progress more gradually (5-10% per week)'
          });
        }
      }
    }
  });

  // Pattern 2: Excessive weekly frequency (>12 sets per muscle group per week)
  const muscleVolume = {};
  (workouts || []).slice(-1).forEach(w => {
    (w.exercises || []).forEach(ex => {
      const muscle = ex.primaryMuscle || 'general';
      const volume = (ex.sets || []).length;
      muscleVolume[muscle] = (muscleVolume[muscle] || 0) + volume;
    });
  });

  Object.entries(muscleVolume).forEach(([muscle, sets]) => {
    if (sets > 12) {
      risks.push({
        type: 'excessive_frequency',
        severity: 'low',
        message: `${muscle}: ${sets} sets this week (high volume)`,
        recommendation: 'Consider spreading volume across more days'
      });
    }
  });

  // Pattern 3: Stagnation in secondary lifts (no progress in 8+ weeks)
  const now = new Date();
  const eightWeeksAgo = new Date(now.getTime() - 56 * 24 * 60 * 60 * 1000);
  
  records?.forEach(record => {
    const recentLifts = record.lifts?.filter(l => new Date(l.date) >= eightWeeksAgo) || [];
    if (recentLifts.length >= 4) {
      const maxOld = Math.max(...recentLifts.slice(0, 2).map(l => l.max1RM || 0));
      const maxNew = Math.max(...recentLifts.slice(-2).map(l => l.max1RM || 0));
      
      if (maxOld > 0 && maxNew === maxOld) {
        risks.push({
          type: 'stagnation',
          severity: 'low',
          message: `${record.exerciseName}: No progress in 8 weeks`,
          recommendation: 'Try volume-focused phase or change rep ranges'
        });
      }
    }
  });

  return risks;
};

/**
 * Autoregulation support - suggest adjustments based on session RPE
 */
const generateAutoregulationTips = (masteryData, trainingRatio, CNSStatus) => {
  const tips = [];

  if (masteryData?.level >= 3) {
    tips.push({
      title: 'RPE-Based Auto-Regulation',
      content: 'You can modify today\'s plan based on how you feel. Start warm-up reps at RPE 4-5, assess readiness.',
      action: 'Stop 1-2 reps short if struggling, push harder if feeling fresh'
    });
  }

  if (trainingRatio > 1.15) {
    tips.push({
      title: 'Fatigue Management',
      content: 'High fatigue detected. Focus on form quality over load.',
      action: 'Reduce weights by 10-15%, add 2-3 min extra rest between sets'
    });
  }

  if (CNSStatus === 'RECOVERED') {
    tips.push({
      title: 'PR Window Open',
      content: 'CNS is fresh. This is an ideal session to test maximal loads.',
      action: 'Take an extra 2 min rest, attempt PRs on main lifts'
    });
  }

  return tips;
};

export const generateEliteCoaching = (workouts, readiness, masteryData, anomalyDetection, records = []) => {
  if (!workouts || workouts.length === 0) {
    return {
      headline: 'Start Tracking',
      message: 'Build a baseline by completing workouts',
      intensity: 'moderate',
      volume: 'moderate',
      trainingZone: 'maintenance',
      rirTarget: 2,
      repRange: '8-12',
      sets: '3-4 sets',
      restPeriod: '2-3 min',
      frequency: 'moderate',
      techniques: ['Track workouts', 'Build consistency', 'Establish baseline'],
      rationale: 'No workout history yet',
      anomalyWarning: null,
      masteryBonus: null,
      tier: 'beginner'
    };
  }

  const now = new Date();
  const recentWorkouts = workouts
    .filter(w => w.date && new Date(w.date) >= new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const lastWorkout = recentWorkouts[0];
  const daysSinceLast = lastWorkout
    ? Math.floor((now - new Date(lastWorkout.date)) / (24 * 60 * 60 * 1000))
    : 999;

  // READINESS ANALYSIS - Multi-factor system
  const acuteLoad = Number(readiness?.acuteLoad) || 0;
  const chronicLoad = Number(readiness?.chronicLoad) || 0;
  const trainingRatio = chronicLoad > 0 ? acuteLoad / chronicLoad : 0;
  const status = readiness?.status || 'optimal';

  // CNS Fatigue Detection (Mike Israetel method)
  const CNSFatigue = trainingRatio > 1.5; // Acute > 1.5x Chronic
  const CNSRecovered = trainingRatio < 0.8;
  const CNSOptimal = trainingRatio >= 0.8 && trainingRatio <= 1.2;

  // MRV Analysis (Maximum Recoverable Volume)
  const avgVolume30d = recentWorkouts.slice(0, 10).reduce((sum, w) => {
    const vol = (w.exercises || []).reduce((exsum, ex) => {
      return (
        exsum +
        (ex.sets || []).reduce((ssum, s) => ssum + (Number(s.kg) || 0) * (Number(s.reps) || 0), 0)
      );
    }, 0);
    return sum + vol;
  }, 0) / Math.max(1, recentWorkouts.length);

  // Determine training zone (RIR-based)
  let trainingZone = 'maintenance'; // maintenance | growth | peak
  let intensity = 'moderate'; // light | moderate | high | veryhigh
  let volume = 'moderate'; // low | moderate | high
  let message = '';
  let techniques = [];
  let rirTarget = 2; // Reps In Reserve

  // DECISION TREE
  if (CNSFatigue || status === 'fatigue') {
    // OVERREACHING STATE - Must deload
    trainingZone = 'maintenance';
    intensity = 'light';
    volume = 'low';
    message = 'Your nervous system is fatigued. Execute a grease-the-groove deload: light weights, perfect form, short rest intervals.';
    techniques = ['Tempo (3-1-3)', 'High reps (12-15)', 'Controlled eccentrics'];
    rirTarget = 4;
  } else if (CNSRecovered && daysSinceLast >= 3) {
    // FRESH & READY - Push PR window
    trainingZone = 'peak';
    intensity = 'veryhigh';
    volume = 'high';
    message = 'Maximum recovery window. This is your PR attempt session. Attack your big lifts with conviction.';
    techniques = ['Compete intensity', 'Explosive concentrics', 'Heavy singles/doubles'];
    rirTarget = 0; // Go to failure on max attempts
  } else if (masteryData?.level >= 3 && CNSOptimal) {
    // ADVANCED + RECOVERED - Managed intensity push
    trainingZone = 'growth';
    intensity = 'high';
    volume = 'high';
    message = 'Optimal conditions for progressive overload. Focus on mastered movement patterns and drive new PRs.';
    techniques = ['Progressive overload', 'Cluster sets', 'Tempo drops'];
    rirTarget = 1;
  } else if (trainingRatio > 1.2) {
    // ACCUMULATING FATIGUE - Scale back but maintain
    trainingZone = 'maintenance';
    intensity = 'moderate';
    volume = 'moderate';
    message = 'Fatigue is building. Maintain strength with reduced volume—technical execution over load.';
    techniques = ['Density training', 'Same weight, fewer sets', 'Extended rest days'];
    rirTarget = 2;
  } else {
    // NORMAL STATE - Steady progression
    trainingZone = 'growth';
    intensity = 'moderate';
    volume = 'moderate';
    message = 'Normal training state. Follow your plan with consistent progressive overload.';
    techniques = ['Steady progression', 'Core compounds', '6-10 rep range'];
    rirTarget = 2;
  }

  // Frequency prescription (Russian system)
  let frequency = 'moderate'; // low (3x/wk) | moderate (4x/wk) | high (5x/wk) | deload (2x/wk)
  const sessionsThisWeek = recentWorkouts.filter(
    w => new Date(w.date) >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  ).length;

  if (CNSFatigue) {
    frequency = 'deload';
  } else if (CNSRecovered) {
    frequency = 'high';
  } else if (trainingRatio > 1.2) {
    frequency = 'low';
  } else {
    frequency = 'moderate';
  }

  // Rep ranges by training zone (Israetel/Schoenfeld)
  const repRanges = {
    'very-heavy': '1-3',
    'heavy': '3-5',
    'moderate-heavy': '5-8',
    'moderate': '8-12',
    'light-moderate': '12-15',
    'light': '15-20'
  };

  const repRange = {
    veryhigh: '2-4',
    high: '5-8',
    moderate: '8-12',
    light: '12-18'
  };

  // Set structure (Juggernaut periodization inspired)
  const setScaling = {
    veryhigh: '3-4 sets',
    high: '4-5 sets',
    moderate: '3-4 sets',
    light: '2-3 sets'
  };

  // Rest periods (CNS recovery basis)
  const restPeriods = {
    veryhigh: '4-5 min',
    high: '3-4 min',
    moderate: '2-3 min',
    light: '60-90s'
  };

  // Anomaly-based adjustments
  let anomalyWarning = null;
  if (anomalyDetection?.severity === 'high') {
    anomalyWarning = `⚠️ Unusual pattern: ${anomalyDetection.anomalies?.[0]?.split('(')[0] || 'Check form'}`;
  }

  // Injury risk analysis
  const injuryRisks = analyzeInjuryRiskPatterns(workouts, records);

  // Autoregulation guidance
  const CNSStatus = CNSFatigue ? 'FATIGUED' : CNSRecovered ? 'RECOVERED' : 'OPTIMAL';
  const autoregulationTips = generateAutoregulationTips(masteryData, trainingRatio, CNSStatus);

  // RPE-based intensity scaling (advanced)
  const rpeGuidance = {
    targetRPE: intensity === 'veryhigh' ? '9.5-10' : intensity === 'high' ? '8.5-9' : intensity === 'moderate' ? '7-8.5' : '5-7',
    description: intensity === 'veryhigh' ? 'Max effort' : intensity === 'high' ? 'Heavy' : intensity === 'moderate' ? 'Moderate' : 'Light',
    adjustmentTips: masteryData?.level >= 3 ? [
      'If RPE is lower than target after warm-up sets, add weight gradually',
      'If RPE is higher, reduce by 5-10% and focus on form',
      'Never push beyond RPE 9.5 on main lifts - injury risk increases'
    ] : []
  };

  return {
    headline: `${trainingZone.toUpperCase()}: ${intensity.toUpperCase()} INTENSITY`,
    message,
    trainingZone,
    intensity,
    volume,
    rirTarget,
    repRange: repRange[intensity],
    sets: setScaling[intensity],
    restPeriod: restPeriods[intensity],
    frequency,
    techniques,
    rationale: `Training ratio: ${trainingRatio.toFixed(2)} | CNS Status: ${CNSStatus}`,
    anomalyWarning,
    masteryBonus: masteryData?.level >= 3 ? `Mastery level ${masteryData.level} - You can handle advanced techniques` : null,
    // NEW: Enhanced features
    injuryRisks: injuryRisks.length > 0 ? injuryRisks : null,
    autoregulationTips: autoregulationTips.length > 0 ? autoregulationTips : null,
    rpeGuidance: masteryData?.level >= 2 ? rpeGuidance : null
  };
};

/**
 * Auto-prescription: Suggest perfect session for user's current state
 */
export const prescribeSessionForState = (readiness, masteryData, workoutHistory) => {
  const coaching = generateEliteCoaching(workoutHistory || [], readiness, masteryData, null);

  return {
    ...coaching,
    emoji: {
      'peak': '🔥',
      'growth': '📈', 
      'maintenance': '⚖️'
    }[coaching.trainingZone] || '💪'
  };
};

/**
 * RIR Calculator - Based on Schoenfeld's research
 */
export const calculateRIR = (workingWeight, estimate1RM) => {
  if (!estimate1RM || estimate1RM === 0) return null;

  const percentage = (workingWeight / estimate1RM) * 100;

  if (percentage >= 95) return '0-1 (max attempt)';
  if (percentage >= 90) return '1-2 (heavy)';
  if (percentage >= 85) return '2-3 (compound)';
  if (percentage >= 80) return '3-4 (working)';
  if (percentage >= 75) return '4-5 (hypertrophy)';
  return '5+ (volume)';
};

/**
 * Exercise rating - Is this exercise optimal for the training zone?
 */
export const rateExerciseForZone = (exerciseName, trainingZone, masteryData) => {
  const compounds = ['squat', 'bench', 'deadlift', 'row', 'overhead press', 'pull-up', 'barbell curl', 'front squat'];
  const hypertrophy = [...compounds, 'leg press', 'hack squat', 'machine row', 'dumbbell', 'cable'];
  const isolation = ['leg curl', 'leg extension', 'face pull', 'pec dec', 'lat pulldown', 'chest fly'];

  const exerciseLower = exerciseName.toLowerCase();
  const isCompound = compounds.some(c => exerciseLower.includes(c));
  const isIsolation = isolation.some(i => exerciseLower.includes(i));

  let score = 50; // Base score

  if (trainingZone === 'peak') {
    if (isCompound) score += 30;
    else score += 10;
  } else if (trainingZone === 'growth') {
    if (isCompound) score += 20;
    if (isIsolation) score += 15;
  } else if (trainingZone === 'maintenance') {
    if (isCompound) score += 10;
    score += 20; // Technical movements preferred
  }

  if (masteryData?.level >= 3 && isCompound) score += 10;

  return Math.min(100, score);
};

/**
 * Export helper functions for testing and advanced use
 */
export { analyzeInjuryRiskPatterns, generateAutoregulationTips, rpeToIntensityScale };
