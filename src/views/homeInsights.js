/**
 * Quick-insight selection for Home (UI 3.0).
 *
 * Deliberately NOT a scoring or recommendation engine: a fixed priority
 * cascade over signals the app already computes elsewhere (readiness,
 * muscle balance, PR detection, coaching). First match wins; everything
 * else becomes a supporting row or stays on its own screen.
 *
 * Pure module (no React) so it is unit-testable in the node environment
 * and reusable by later UI 3.0 phases without importing the Home view.
 */
export const pickPrimaryInsightKey = ({ hasHistory, readinessStatus, hasImbalance, weekPRCount }) => {
  if (!hasHistory) return null;
  if (readinessStatus === 'fatigue') return 'readiness';
  if (hasImbalance) return 'balance';
  if (weekPRCount > 0) return 'records';
  if (readinessStatus === 'low') return 'readiness';
  return 'coaching';
};
