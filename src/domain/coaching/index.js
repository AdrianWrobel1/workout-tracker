/**
 * Coaching V2 — canonical public seam.
 * UI and future surfaces import from here (or the specific module), never
 * from duplicated wording/scoring helpers elsewhere.
 */
export {
  collectExerciseEvidence,
  collectSessionEvidence,
  collectGlobalEvidence,
  collectMuscleEvidence,
  excludeFutureWorkouts,
  COACHING_CONFIDENCE
} from './evidence';
export {
  normalizeTrend,
  normalizePlateau,
  normalizeMover,
  normalizeLandmark,
  normalizeComparison,
  TREND_DIRECTIONS,
  TREND_METRICS,
  TREND_CONFIDENCE
} from './normalize';
export {
  interpretStagnation,
  interpretMover,
  interpretProgression,
  interpretLandmarks,
  interpretBalance,
  interpretConsistency,
  interpretReadiness,
  INSIGHT_TYPES,
  INSIGHT_CONFIDENCE,
  REASON_CODES
} from './interpret';
export {
  prioritizeInsights,
  splitHomeInsights,
  GLOBAL_CAP,
  HOME_PRIMARY_COUNT,
  HOME_SECONDARY_CAP
} from './prioritize';
export {
  getCoachingInsights,
  getPrimaryInsight,
  getExerciseGuidance,
  getSessionDebrief,
  getSessionCoaching
} from './coaching';
