/**
 * Canonical ID generation.
 *
 * History: the app used `Date.now()` (ms timestamp, number) for workouts,
 * exercises, templates and `superset_${Date.now()}` for supersets. Those IDs
 * collide when two entities are created within the same millisecond and mix
 * number/string types across stores.
 *
 * Rule going forward:
 * - NEW entities use `generateId()` (crypto.randomUUID when available,
 *   otherwise a timestamp + random suffix). Always a string.
 * - READERS accept legacy numeric `Date.now()` IDs and prefixed strings
 *   (`superset_...`, `debrief_...`). Never rewrite historical IDs.
 */

export const generateId = () => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // fall through to timestamp fallback
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

export const generateSupersetId = () => `superset_${generateId()}`;

/** Accept anything IndexedDB can use as a key; used by import validation. */
export const isValidId = (id) =>
  typeof id === 'string' ? id.length > 0 : typeof id === 'number' && Number.isFinite(id);
