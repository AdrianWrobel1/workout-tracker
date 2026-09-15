/**
 * History 2.0 view-model — thin selectors over the canonical domain.
 *
 * REUSE > EXTEND > NEW: this file contains no new training logic.
 * Every number derives from exactly one canonical source, named per function:
 *
 *   completed-set rule .......... isWorkSet (domain/workoutExtensions)
 *   1RM ......................... calculate1RM (domain/calculations, Epley)
 *   set volume .................. calculateSetVolume (domain/calculations,
 *                                 bodyweight-aware via usesBodyweight)
 *   per-exercise past ........... getExerciseHistory / getExerciseRecords
 *                                 (domain/exercises)
 *   date semantics .............. parseWorkoutDate / getLocalDayKey /
 *                                 getLocalMonthKey (domain/dates) — local
 *                                 midnight for day keys, never UTC slicing
 *
 * What this file ADDS (and only this):
 *   1. a per-workout preview (WHEN / WHAT / HOW LONG / HOW MUCH / HOW MANY)
 *      so History JSX stays dumb,
 *   2. list semantics: future exclusion, stable newest-first ordering with
 *      dateless records last (never dropped), local month grouping,
 *   3. fast discovery filters (text query, tags, PR / heavy / light) over the
 *      preview — no second filter engine.
 *
 * Conventions:
 *   - Empty / malformed inputs yield zeros, nulls and empty lists — never
 *     NaN / Infinity / undefined. Broken dates render as "unknown", never
 *     as Invalid Date.
 *   - Future-dated workouts are excluded from history (a session dated
 *     tomorrow is not completed history). The excluded count is returned
 *     so the UI can say so honestly.
 *   - "Heavy"/"light" cutoffs use canonical WORK volume (work sets only),
 *     not legacy completed volume (which includes warm-ups).
 */

import { parseWorkoutDate, getLocalDayKey, getLocalMonthKey } from './dates';
import { isWorkSet } from './workoutExtensions';
import { calculate1RM, calculateSetVolume, formatDate } from './calculations';
import { getExerciseRecords } from './exercises';
import { buildExerciseMap } from '../analytics/statistics';

export const HISTORY_FILTERS = ['all', 'pr', 'heavy', 'light'];

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** True when any completed set carries a stored PR flag. */
export function hasStoredPR(workout) {
  return (workout?.exercises || []).some((ex) =>
    (ex?.sets || []).some(
      (s) =>
        s?.completed &&
        (s.isBest1RM || s.isBestSetVolume || s.isHeaviestWeight)
    )
  );
}

/** Count of completed sets carrying at least one stored PR flag. */
export function countStoredPRs(workout) {
  let n = 0;
  for (const ex of workout?.exercises || []) {
    for (const s of ex?.sets || []) {
      if (
        s?.completed &&
        (s.isBest1RM || s.isBestSetVolume || s.isHeaviestWeight)
      ) {
        n += 1;
      }
    }
  }
  return n;
}

/**
 * Records-based PR check (legacy fallback): the session's best estimated 1RM
 * for an exercise reaches the all-time best, i.e. the PR happened here.
 * `getRecords` is the warmed records-index lookup; falls back to a direct
 * scan only when no cache is provided.
 */
export function isPRWorkout(workout, workouts, getRecords = null) {
  if (!workout) return false;
  if (hasStoredPR(workout)) return true;
  const fromCache =
    typeof getRecords === 'function' ? getRecords : () => null;
  return (workout.exercises || []).some((ex) => {
    if (!ex?.exerciseId) return false;
    const rec =
      fromCache(ex.exerciseId) ??
      getExerciseRecords(ex.exerciseId, workouts);
    const best = num(rec?.best1RM);
    if (!(best > 0)) return false;
    let maxInWorkout = 0;
    for (const s of ex.sets || []) {
      if (!isWorkSet(s)) continue;
      const kg = num(s?.kg);
      const reps = num(s?.reps);
      if (kg > 0 && reps > 0) {
        const est = calculate1RM(kg, reps);
        if (est > maxInWorkout) maxInWorkout = est;
      }
    }
    return maxInWorkout >= best;
  });
}

/**
 * One-line preview answering WHEN / WHAT / HOW LONG / HOW MUCH / HOW MANY.
 * Pure; safe on malformed and legacy workouts.
 */
export function getWorkoutPreview(
  workout,
  { exercisesDB = [], userWeight = null, now = Date.now() } = {}
) {
  const current = now instanceof Date ? now.getTime() : num(now);
  const rawDate = workout?.date ?? workout?.startTime ?? null;
  const parsed = parseWorkoutDate(rawDate);
  const time = parsed ? parsed.getTime() : NaN;
  const validDate = Number.isFinite(time);
  const dayKey = getLocalDayKey(rawDate);
  const monthKey = getLocalMonthKey(rawDate);

  const todayKey = getLocalDayKey(new Date(current));
  const isFuture =
    validDate && dayKey && todayKey ? dayKey > todayKey : false;

  const durationRaw = Number(workout?.duration);
  const durationMin =
    Number.isFinite(durationRaw) && durationRaw >= 0
      ? Math.floor(durationRaw)
      : null;

  const exerciseMap = buildExerciseMap(exercisesDB);
  let completedSets = 0;
  let workSets = 0;
  let totalReps = 0;
  let workVolume = 0;
  const categories = new Set();
  const names = [];
  for (const ex of workout?.exercises || []) {
    const def =
      ex?.exerciseId != null ? exerciseMap.get(ex.exerciseId) : null;
    const usesBodyweight = Boolean(def?.usesBodyweight);
    names.push(String(ex?.name || def?.name || '').toLowerCase());
    const cat = ex?.category || def?.category;
    if (cat) categories.add(cat);
    for (const s of ex?.sets || []) {
      if (s?.completed) completedSets += 1;
      if (!isWorkSet(s)) continue;
      workSets += 1;
      totalReps += num(s?.reps);
      workVolume += calculateSetVolume(s, { usesBodyweight, userWeight });
    }
  }
  workVolume = Math.round(workVolume * 10) / 10;

  const prCount = countStoredPRs(workout);

  return {
    id: workout?.id ?? null,
    name:
      typeof workout?.name === 'string' && workout.name.trim()
        ? workout.name.trim()
        : 'Untitled workout',
    date: typeof workout?.date === 'string' ? workout.date : rawDate,
    dayKey,
    monthKey,
    time: validDate ? time : NaN,
    validDate,
    isFuture,
    durationMin,
    exercisesCount: (workout?.exercises || []).length,
    completedSets,
    workSets,
    totalReps,
    workVolume,
    prCount,
    hasStoredPR: prCount > 0,
    categories: [...categories],
    searchText: `${String(workout?.name || '').toLowerCase()} ${names.join(
      ' '
    )}`,
    tags: Array.isArray(workout?.tags) ? workout.tags : [],
  };
}

/**
 * 'today' / 'yesterday' / null for a persisted date value. Pure; null-safe.
 * Only day-accurate labels — never relative labels for older dates.
 */
export function relativeDay(dateValue, now = Date.now()) {
  const current = now instanceof Date ? now.getTime() : num(now);
  const key = getLocalDayKey(dateValue);
  if (!key || !Number.isFinite(current)) return null;
  const todayKey = getLocalDayKey(new Date(current));
  if (key === todayKey) return 'today';
  const yesterdayKey = getLocalDayKey(new Date(current - DAY_MS));
  if (key === yesterdayKey) return 'yesterday';
  return null;
}

/** Safe date label: null when unparseable (UI shows an honest fallback). */
export function formatSessionDate(dateValue) {
  if (parseWorkoutDate(dateValue) == null) return null;
  try {
    const label = formatDate(dateValue);
    return /invalid/i.test(String(label)) ? null : label;
  } catch {
    return null;
  }
}

/** Safe time label (HH:MM) for a timestamp value, null when unparseable. */
export function formatSessionTime(dateValue) {
  const d = parseWorkoutDate(dateValue);
  if (!d) return null;
  try {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return null;
  }
}

/** Human duration: null → null ('—' in UI), <60 → "45 min", else "1h 05m". */
export function formatSessionDuration(durationMin) {
  if (durationMin == null || durationMin === '') return null;
  const m = Number(durationMin);
  if (!Number.isFinite(m) || m < 0) return null;
  const floored = Math.floor(m);
  if (floored < 60) return `${floored} min`;
  const h = Math.floor(floored / 60);
  return `${h}h ${String(floored % 60).padStart(2, '0')}m`;
}

/** Compact volume: 12,450 → "12.4k", 850 → "850". Never NaN. */
export function formatCompactVolume(volume) {
  const v = num(volume);
  if (v >= 10000) return `${(v / 1000).toFixed(1)}k`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return `${Math.round(v)}`;
}

const comparePreviewsDesc = (a, b) => {
  const at = a.validDate ? a.time : -Infinity;
  const bt = b.validDate ? b.time : -Infinity;
  if (bt !== at) return bt - at;
  return String(a.id ?? '').localeCompare(String(b.id ?? ''));
};

/**
 * Full history list model: ordered previews + local month groups.
 * Pure; safe on empty / malformed inputs.
 */
export function getHistoryModel({
  workouts = [],
  filter = 'all',
  tags = [],
  query = '',
  now = Date.now(),
  getRecords = null,
  exercisesDB = [],
  userWeight = null,
} = {}) {
  const list = Array.isArray(workouts) ? workouts : [];
  const current = now instanceof Date ? now.getTime() : num(now);

  let excludedFuture = 0;
  const previews = [];
  for (const w of list) {
    const p = getWorkoutPreview(w, { exercisesDB, userWeight, now: current });
    if (p.isFuture) {
      excludedFuture += 1;
      continue;
    }
    previews.push(p);
  }
  previews.sort(comparePreviewsDesc);

  // Heavy/light cutoffs over canonical work volume (70th percentile, as before).
  const vols = previews.map((p) => p.workVolume).sort((a, b) => a - b);
  const heavyCutoff =
    vols.length > 0 ? vols[Math.floor(vols.length * 0.7)] || 0 : 0;

  const q = String(query || '').trim().toLowerCase();
  const tagList = Array.isArray(tags) ? tags : [];
  const activeFilter = HISTORY_FILTERS.includes(filter) ? filter : 'all';

  // PR checks are lazy (only when the PR filter is active) and memoized per
  // exercise within this call, so the legacy records fallback cannot turn
  // the list into an O(n^2) history scan.
  const byId = new Map(list.map((w) => [w?.id, w]));
  const recordsMemo = new Map();
  const cachedRecords = (exerciseId) => {
    if (typeof getRecords === 'function') {
      const hit = getRecords(exerciseId);
      if (hit) return hit;
    }
    if (!recordsMemo.has(exerciseId)) {
      recordsMemo.set(exerciseId, getExerciseRecords(exerciseId, list));
    }
    return recordsMemo.get(exerciseId);
  };

  const items = previews.filter((p) => {
    if (activeFilter === 'pr') {
      if (!p.hasStoredPR && !isPRWorkout(byId.get(p.id), list, cachedRecords)) {
        return false;
      }
    }
    if (activeFilter === 'heavy') {
      if (!(p.workVolume >= heavyCutoff && heavyCutoff > 0)) return false;
    }
    if (activeFilter === 'light') {
      if (heavyCutoff > 0) {
        if (!(p.workVolume > 0 && p.workVolume < heavyCutoff * 0.3)) {
          return false;
        }
      } else if (!(p.workVolume > 0 && p.workVolume < 1000)) {
        return false;
      }
    }
    if (tagList.length > 0 && !tagList.some((t) => p.tags.includes(t))) {
      return false;
    }
    if (q && !p.searchText.includes(q)) return false;
    return true;
  });

  const groupsMap = new Map();
  for (const p of items) {
    const key = p.monthKey || 'unknown';
    if (!groupsMap.has(key)) groupsMap.set(key, []);
    groupsMap.get(key).push(p);
  }
  const groups = [...groupsMap.entries()]
    .map(([monthKey, monthItems]) => ({ monthKey, items: monthItems }))
    .sort((a, b) => {
      if (a.monthKey === 'unknown') return 1;
      if (b.monthKey === 'unknown') return -1;
      return b.monthKey.localeCompare(a.monthKey);
    });

  return {
    items,
    groups,
    total: previews.length,
    shown: items.length,
    excludedFuture,
    heavyCutoff,
  };
}
