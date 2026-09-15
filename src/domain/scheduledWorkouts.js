/**
 * Scheduled (planned) workouts — pure domain.
 *
 * PRODUCT MODEL (PLAN → TRAIN → REVIEW):
 *   TEMPLATE  = reusable blueprint (canonical, lives in templates store)
 *   PLANNED   = future intention (this file, lives in scheduled store)
 *   ACTIVE    = current mutable execution (activeWorkout snapshot)
 *   COMPLETED = actual historical session (workouts store, the ONLY history)
 *
 * OWNERSHIP CONTRACT (snapshot, never shared references):
 *   TEMPLATE → deep snapshot at schedule time → PLANNED WORKOUT.
 *   Editing a template after scheduling NEVER mutates already-scheduled
 *   plans. Starting a plan deep-clones the snapshot into an independent
 *   Active Workout; editing the Active Workout NEVER writes back to the plan.
 *   Completing a workout NEVER edits history shapes — the plan is only
 *   linked (completedWorkoutId) so the calendar can show fulfilment.
 *
 * ISOLATION: planned records are intentionally NOT workouts. Nothing here is
 * ever passed to Statistics / History / readiness / PR / Body Map selectors —
 * those read the `workouts` array only, so a plan can never inflate them.
 *
 * All functions are pure (new arrays/objects, no mutation) and tolerant of
 * legacy/malformed records: normalizeScheduledWorkout() returns null for
 * anything unusable instead of throwing.
 */

import { getLocalDayKey, parseWorkoutDate, toPersistedTimestamp } from './dates';
import { generateId } from './ids';
import { normalizeWorkoutExerciseForStorage, normalizeSetForStorage } from './workoutExtensions';

export const SCHEDULED_STATUS = {
  PLANNED: 'planned',
  COMPLETED: 'completed',
};

const DAY_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad2 = (n) => String(n).padStart(2, '0');

/** True for a real calendar day `YYYY-MM-DD` (rejects month 13, Feb 30, …). */
export const isValidDayKey = (value) => {
  if (typeof value !== 'string') return false;
  const m = DAY_KEY_RE.exec(value.trim());
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const check = new Date(y, mo - 1, d);
  return (
    check.getFullYear() === y &&
    check.getMonth() === mo - 1 &&
    check.getDate() === d
  );
};

/** Local `YYYY-MM-DD` for today (calendar identity, never UTC-sliced). */
export const todayLocalKey = (now = new Date()) => {
  const d = now instanceof Date ? now : parseWorkoutDate(now) || new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

/** Local `YYYY-MM-DD` for any persisted date value (null when unparseable). */
export const toDayKey = (value) => {
  if (typeof value === 'string' && isValidDayKey(value)) return value.trim();
  return getLocalDayKey(value);
};

const deepClone = (value) => {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return Array.isArray(value) ? value.map((v) => ({ ...v })) : { ...value };
  }
};

const cleanName = (name, fallback = 'Planned Workout') => {
  if (typeof name === 'string' && name.trim()) return name.trim().slice(0, 80);
  return fallback;
};

/**
 * Strip runtime-only fields from a snapshotted set so a plan holds
 * blueprint targets only (same contract as template storage).
 */
const snapshotSet = (set = {}) => {
  const {
    suggestedKg: _sk,
    suggestedReps: _sr,
    isBest1RM: _b1,
    isBestSetVolume: _bv,
    isHeaviestWeight: _hw,
    completed: _c,
    ...rest
  } = set || {};
  return normalizeSetForStorage({ ...rest, completed: false });
};

/**
 * Deep snapshot of blueprint exercises into plan-owned targets.
 * Never shares references with the source template/plan.
 */
export const snapshotExercises = (exercises = []) => {
  const list = Array.isArray(exercises) ? exercises : [];
  return list.map((ex) =>
    normalizeWorkoutExerciseForStorage({
      ...deepClone(ex || {}),
      sets: (ex?.sets || []).map(snapshotSet),
    })
  );
};

/**
 * Normalize one persisted record. Returns a canonical plan or null when
 * the record is unusable (missing id/date). Never throws, never NaN.
 */
export const normalizeScheduledWorkout = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const id = raw.id;
  if ((typeof id !== 'string' && typeof id !== 'number') || String(id) === '') return null;
  // Accept legacy `date` (any persisted date form) as well as `dateKey`.
  const dateKey =
    (typeof raw.dateKey === 'string' && isValidDayKey(raw.dateKey) && raw.dateKey.trim()) ||
    toDayKey(raw.dateKey ?? raw.date);
  if (!dateKey) return null;
  const status =
    raw.status === SCHEDULED_STATUS.COMPLETED
      ? SCHEDULED_STATUS.COMPLETED
      : SCHEDULED_STATUS.PLANNED;
  return {
    id,
    dateKey,
    name: cleanName(raw.name),
    templateId: raw.templateId ?? null,
    templateName:
      typeof raw.templateName === 'string' && raw.templateName.trim()
        ? raw.templateName.trim().slice(0, 80)
        : null,
    exercises: snapshotExercises(raw.exercises),
    status,
    completedWorkoutId:
      raw.completedWorkoutId != null ? raw.completedWorkoutId : null,
    createdAt:
      typeof raw.createdAt === 'string' && raw.createdAt
        ? raw.createdAt
        : toPersistedTimestamp(),
    updatedAt:
      typeof raw.updatedAt === 'string' && raw.updatedAt
        ? raw.updatedAt
        : toPersistedTimestamp(),
  };
};

/** Normalize a whole persisted list, dropping malformed records. */
export const normalizeScheduledList = (list) => {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const raw of list) {
    const plan = normalizeScheduledWorkout(raw);
    if (plan) out.push(plan);
  }
  return out;
};

/**
 * Create a planned workout snapshotted from an existing template.
 * The template object is only READ — never mutated, never referenced.
 */
export const createScheduledFromTemplate = (
  template,
  dateKey,
  { now = new Date(), id = generateId() } = {}
) => {
  if (!template || typeof template !== 'object') return null;
  if (!isValidDayKey(dateKey)) return null;
  const stamp = toPersistedTimestamp(now);
  return {
    id,
    dateKey,
    name: cleanName(template.name, 'Planned Workout'),
    templateId: template.id ?? null,
    templateName:
      typeof template.name === 'string' && template.name.trim()
        ? template.name.trim().slice(0, 80)
        : null,
    exercises: snapshotExercises(template.exercises),
    status: SCHEDULED_STATUS.PLANNED,
    completedWorkoutId: null,
    createdAt: stamp,
    updatedAt: stamp,
  };
};

/**
 * Create a planned workout from user-authored content (Create New path).
 * `exercises` must already be blueprint-shaped; sets are normalized.
 */
export const createScheduledCustom = (
  { name, exercises = [], dateKey, templateId = null, templateName = null },
  { now = new Date(), id = generateId() } = {}
) => {
  if (!isValidDayKey(dateKey)) return null;
  const list = Array.isArray(exercises) ? exercises : [];
  if (list.length === 0) return null;
  if (typeof name !== 'string' || !name.trim()) return null;
  const stamp = toPersistedTimestamp(now);
  return {
    id,
    dateKey: dateKey.trim(),
    name: cleanName(name),
    templateId: templateId ?? null,
    templateName:
      typeof templateName === 'string' && templateName.trim()
        ? templateName.trim().slice(0, 80)
        : null,
    exercises: snapshotExercises(list),
    status: SCHEDULED_STATUS.PLANNED,
    completedWorkoutId: null,
    createdAt: stamp,
    updatedAt: stamp,
  };
};

/**
 * Edit a plan's draft fields (name / exercises / reschedule target).
 * Same id — rescheduling MOVES the record, never clones it.
 */
export const updateScheduledWorkout = (list, id, patch = {}, { now = new Date() } = {}) => {
  const arr = Array.isArray(list) ? list : [];
  if (patch?.dateKey !== undefined && !isValidDayKey(patch.dateKey)) return arr;
  let changed = false;
  const next = arr.map((plan) => {
    if (!plan || plan.id !== id) return plan;
    changed = true;
    const updated = { ...plan };
    if (patch.name !== undefined) updated.name = cleanName(patch.name, plan.name);
    if (patch.dateKey !== undefined) updated.dateKey = patch.dateKey.trim();
    if (patch.exercises !== undefined && Array.isArray(patch.exercises)) {
      updated.exercises = snapshotExercises(patch.exercises);
    }
    if (patch.templateId !== undefined) updated.templateId = patch.templateId ?? null;
    if (patch.templateName !== undefined) {
      updated.templateName =
        typeof patch.templateName === 'string' && patch.templateName.trim()
          ? patch.templateName.trim().slice(0, 80)
          : null;
    }
    updated.updatedAt = toPersistedTimestamp(now);
    return updated;
  });
  return changed ? next : arr;
};

/** Move a plan to another date (pure; original date loses the marker). */
export const rescheduleScheduledWorkout = (list, id, newDateKey, opts = {}) => {
  if (!isValidDayKey(newDateKey)) return Array.isArray(list) ? list : [];
  return updateScheduledListDate(list, id, newDateKey.trim(), opts);
};

const updateScheduledListDate = (list, id, dateKey, opts) =>
  updateScheduledWorkout(list, id, { dateKey }, opts);

/** Link a plan to its completed session (fulfilment, not deletion). */
export const markScheduledCompleted = (list, id, completedWorkoutId, { now = new Date() } = {}) => {
  const arr = Array.isArray(list) ? list : [];
  let changed = false;
  const next = arr.map((plan) => {
    if (!plan || plan.id !== id) return plan;
    changed = true;
    return {
      ...plan,
      status: SCHEDULED_STATUS.COMPLETED,
      completedWorkoutId: completedWorkoutId ?? plan.completedWorkoutId ?? null,
      updatedAt: toPersistedTimestamp(now),
    };
  });
  return changed ? next : arr;
};

/** Delete only the planned event — templates/history/exercises untouched. */
export const deleteScheduledWorkout = (list, id) => {
  const arr = Array.isArray(list) ? list : [];
  return arr.filter((plan) => plan && plan.id !== id);
};

export const getScheduledById = (list, id) =>
  (Array.isArray(list) ? list : []).find((plan) => plan && plan.id === id) || null;

/** Actionable (not yet fulfilled) plans for one day, oldest first. */
export const getScheduledForDay = (list, dateKey) => {
  if (!isValidDayKey(dateKey)) return [];
  return (Array.isArray(list) ? list : [])
    .filter((plan) => plan && plan.dateKey === dateKey && plan.status !== SCHEDULED_STATUS.COMPLETED)
    .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
};

/** Fulfilled plans for one day (linked to history, newest first). */
export const getCompletedPlansForDay = (list, dateKey) => {
  if (!isValidDayKey(dateKey)) return [];
  return (Array.isArray(list) ? list : [])
    .filter((plan) => plan && plan.dateKey === dateKey && plan.status === SCHEDULED_STATUS.COMPLETED)
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
};

/**
 * Where did this plan come from? `stale` = its template was deleted —
 * the snapshot still stands on its own and remains startable.
 */
export const resolveScheduledSource = (plan, templates = []) => {
  if (!plan) return { kind: 'custom', template: null };
  if (plan.templateId == null) return { kind: 'custom', template: null };
  const template = (Array.isArray(templates) ? templates : []).find(
    (t) => t && t.id === plan.templateId
  );
  if (template) return { kind: 'template', template };
  return { kind: 'stale', template: null };
};

/**
 * Compact launcher facts for UI (counts only — targets are not actuals,
 * so no volume/PR language here by design).
 */
export const summarizeScheduled = (plan) => {
  const exercises = Array.isArray(plan?.exercises) ? plan.exercises : [];
  const exerciseCount = exercises.length;
  const setCount = exercises.reduce(
    (n, ex) => n + (Array.isArray(ex?.sets) ? ex.sets.length : 0),
    0
  );
  const names = exercises
    .map((ex) => (typeof ex?.name === 'string' ? ex.name.trim() : ''))
    .filter(Boolean)
    .slice(0, 3);
  return { exerciseCount, setCount, names };
};

/**
 * Month lookup for the calendar grid: dateKey → { planned, completed }.
 * `workouts` contribute COMPLETED via canonical local day keys; plans
 * contribute PLANNED only while actionable (fulfilled plans are history).
 * Bounded single pass — no per-cell history scan.
 */
export const buildMonthDayIndex = ({ scheduled = [], workouts = [] } = {}) => {
  const index = new Map();
  const touch = (key) => {
    if (!index.has(key)) index.set(key, { planned: 0, completed: 0 });
    return index.get(key);
  };
  for (const plan of Array.isArray(scheduled) ? scheduled : []) {
    if (!plan || !isValidDayKey(plan.dateKey)) continue;
    if (plan.status === SCHEDULED_STATUS.COMPLETED) continue;
    touch(plan.dateKey).planned += 1;
  }
  for (const w of Array.isArray(workouts) ? workouts : []) {
    if (!w || w.id === 'activeWorkout') continue;
    const key = toDayKey(w.date ?? w.startTime);
    if (!key) continue;
    touch(key).completed += 1;
  }
  return index;
};

/** Completed sessions (canonical history) for one day, newest first. */
export const getCompletedForDay = (workouts = [], dateKey) => {
  if (!isValidDayKey(dateKey)) return [];
  return (Array.isArray(workouts) ? workouts : [])
    .filter((w) => w && w.id !== 'activeWorkout' && toDayKey(w.date ?? w.startTime) === dateKey)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
};

/** Next actionable plans (today onward), soonest first, bounded. */
export const getUpcomingPlans = (list, { now = new Date(), limit = 3 } = {}) => {
  const from = todayLocalKey(now);
  const safeLimit = Number.isFinite(Number(limit)) ? Math.max(0, Math.floor(Number(limit))) : 3;
  return (Array.isArray(list) ? list : [])
    .filter(
      (plan) =>
        plan &&
        plan.status !== SCHEDULED_STATUS.COMPLETED &&
        isValidDayKey(plan.dateKey) &&
        plan.dateKey >= from
    )
    .sort((a, b) =>
      a.dateKey === b.dateKey
        ? String(a.createdAt || '').localeCompare(String(b.createdAt || ''))
        : a.dateKey.localeCompare(b.dateKey)
    )
    .slice(0, safeLimit);
};

/**
 * Blueprint for Active Workout creation from a plan snapshot.
 * Returns a FRESH deep copy — the caller (existing start path) clones once
 * more, so the plan can never alias the working copy.
 */
export const buildActiveBlueprintFromScheduled = (plan) => {
  if (!plan) return null;
  const normalized = normalizeScheduledWorkout(plan);
  if (!normalized) return null;
  return {
    name: normalized.name,
    exercises: deepClone(normalized.exercises),
  };
};
