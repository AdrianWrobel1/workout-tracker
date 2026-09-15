/**
 * Pure import/export transforms (no storage, no React).
 *
 * Import pipeline: PARSE → VALIDATE → NORMALIZE → RESOLVE CONFLICTS.
 * Persistence (WRITE → VERIFY → REPORT) stays in the caller so these
 * functions remain unit-testable without IndexedDB.
 */
import { normalizeSetForStorage } from '../domain/workoutExtensions';
import { sanitizeExerciseRestForStorage } from '../domain/restTimer';
import { sanitizeProgressionForStorage } from '../domain/progression';
import { sanitizeMusclesForStorage } from '../domain/muscles';
import { isValidId } from '../domain/ids';
import { parseWorkoutDate } from '../domain/dates';

const isCoercibleSet = (s) => {
  if (!s || typeof s !== 'object') return false;
  const kgOk = s.kg == null || Number.isFinite(Number(s.kg));
  const repsOk = s.reps == null || Number.isFinite(Number(s.reps));
  return kgOk && repsOk;
};

export const isValidWorkout = (w) =>
  Boolean(w) &&
  typeof w === 'object' &&
  isValidId(w.id) &&
  parseWorkoutDate(w.date) !== null &&
  Array.isArray(w.exercises) &&
  w.exercises.every(
    (ex) =>
      ex &&
      typeof ex === 'object' &&
      ex.exerciseId != null &&
      typeof ex.name === 'string' &&
      Array.isArray(ex.sets) &&
      ex.sets.every(isCoercibleSet)
  );

export const isValidTemplate = (t) =>
  Boolean(t) &&
  typeof t === 'object' &&
  isValidId(t.id) &&
  typeof t.name === 'string' &&
  Array.isArray(t.exercises);

export const isValidExercise = (ex) =>
  Boolean(ex) &&
  typeof ex === 'object' &&
  isValidId(ex.id) &&
  typeof ex.name === 'string' &&
  typeof ex.category === 'string';

/** Normalize one imported workout (setType/warmup flags, numeric coercion). */
export const normalizeImportedWorkout = (workout) => ({
  ...workout,
  tags: Array.isArray(workout.tags) ? workout.tags : [],
  note: typeof workout.note === 'string' ? workout.note : workout.note || '',
  duration: Number(workout.duration) || 0,
  exercises: (workout.exercises || []).map((ex) => ({
    ...ex,
    sets: (ex.sets || []).map((s) =>
      normalizeSetForStorage({
        ...s,
        kg: Number(s.kg) || 0,
        reps: Number(s.reps) || 0,
        completed: Boolean(s.completed)
      })
    )
  }))
});

/**
 * Normalize one imported exercise: preserve a valid `restSec` override and
 * a valid `progression` config; drop absent/malformed values so the
 * exercise inherits safe defaults. Muscle metadata is normalized into the
 * canonical V2 shape (known exercises gain audited attribution, free-text
 * tokens are alias-normalized, invalid tokens dropped). Never rejects an
 * otherwise valid exercise because of one optional parameter.
 */
export const normalizeImportedExercise = (exercise) =>
  sanitizeMusclesForStorage(sanitizeProgressionForStorage(sanitizeExerciseRestForStorage(exercise)));

/**
 * Merge imported items with existing ones by id.
 * Deterministic: existing records win on id conflict (no silent overwrite),
 * import order preserved for genuinely new records.
 * Returns { merged, added, skipped }.
 */
export const mergeById = (existing, incoming) => {
  const prev = Array.isArray(existing) ? existing : [];
  const next = Array.isArray(incoming) ? incoming : [];
  const existingIds = new Set(prev.map((w) => w?.id));
  const added = next.filter((w) => w && !existingIds.has(w.id));
  return { merged: [...added, ...prev], added, skipped: next.length - added.length };
};

export const validateImportPayload = (data) => {
  const errors = [];
  if (!data || typeof data !== 'object') return { ok: false, errors: ['Invalid JSON structure'] };
  // Accept both legacy export keys: { workouts, templates, exercisesDB } and
  // service export shape { data: { workouts, exercises, templates, settings } }.
  const root = data.data && typeof data.data === 'object' ? data.data : data;
  const workouts = root.workouts ?? [];
  const templates = root.templates ?? [];
  const exercisesDB = root.exercisesDB ?? root.exercises ?? [];
  if (root.workouts !== undefined && !Array.isArray(workouts)) errors.push('Workouts must be an array');
  if (root.templates !== undefined && !Array.isArray(templates)) errors.push('Templates must be an array');
  if (root.exercisesDB !== undefined || root.exercises !== undefined) {
    if (!Array.isArray(exercisesDB)) errors.push('Exercises must be an array');
  }
  return { ok: errors.length === 0, errors, normalized: { workouts, templates, exercisesDB } };
};
