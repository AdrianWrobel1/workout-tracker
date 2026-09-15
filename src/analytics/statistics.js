/**
 * Statistics 2.0 view-model — thin selectors over the canonical domain.
 *
 * REUSE > EXTEND > REFACTOR > NEW: this file contains no new training logic.
 * Every number derives from exactly one canonical source, named per function:
 *
 *   completed-set rule .......... isWorkSet (domain/workoutExtensions)
 *   1RM ......................... calculate1RM (domain/calculations, Epley)
 *   set/workout volume .......... calculateSetVolume (domain/calculations,
 *                                 bodyweight-aware via usesBodyweight)
  *   muscle taxonomy ............. resolveAttribution (domain/muscles) —
  *                                 the single resolver; no second taxonomy
 *   per-exercise past ........... getExerciseHistory (domain/exercises)
 *   readiness / balance ......... analytics/readiness + analytics/muscleBalance
 *                                 (read directly by the UI, never re-implemented)
 *
 * What this file ADDS (and only this):
 *   1. a global time-range filter (7D / 30D / 90D / ALL) shared by every
 *      history-derived Statistics section,
 *   2. per-muscle detail rows (sets + volume + sessions + share + relative
 *      intensity + trend) for the Body Map,
 *   3. small range-aware aggregates (overview, per-workout series,
 *      consistency, strength movers).
 *
 * Finish-screen vs Statistics contexts stay apart by construction: the finish
 * path calls these selectors with `[workout]` (one session), Statistics with
 * the range-filtered history. Nothing here reads transient UI state.
 *
 * All functions are pure and take `now` explicitly. Empty inputs yield zeros
 * and empty lists — never NaN/Infinity.
 */
import { isWorkSet } from '../domain/workoutExtensions';
import { calculate1RM, calculateSetVolume } from '../domain/calculations';
import {
  MUSCLE_AXES,
  resolveAttribution,
  resolveAxes,
  attributeAmount,
} from '../domain/muscles';
import { getExerciseHistory } from '../domain/exercises';

export const DAY_MS = 24 * 60 * 60 * 1000;

// Global Statistics ranges. Day counts match getDateRangeForPeriod
// (analytics/chartCompare); 'all' means the whole history.
export const STAT_RANGES = ['7days', '30days', '3months', 'all'];

export const RANGE_DAYS = {
  '7days': 7,
  '30days': 30,
  '3months': 90,
  all: 0
};

// Canonical muscle axes — re-exported from the single taxonomy
// (domain/muscles). No second taxonomy.
export { MUSCLE_AXES } from '../domain/muscles';

// --- timestamps -----------------------------------------------------------

export function workoutTime(w) {
  if (!w || typeof w !== 'object') return NaN;
  const t = new Date(w.date).getTime();
  return Number.isFinite(t) ? t : NaN;
}

// --- range filter ---------------------------------------------------------

/**
 * History inside the global Statistics range, oldest first.
 * Future workouts and workouts without a usable date are excluded — a session
 * dated tomorrow must not inflate "last 7 days", and a dateless record cannot
 * be placed in time. 'all' keeps every non-future, dated workout.
 */
export function filterWorkoutsByRange(workouts, range, now = Date.now()) {
  const current = now instanceof Date ? now.getTime() : Number(now);
  if (!Array.isArray(workouts) || !Number.isFinite(current)) return [];
  const days = RANGE_DAYS[range] ?? 0;
  const cutoff = days > 0 ? current - days * DAY_MS : -Infinity;
  return workouts
    .filter((w) => {
      const t = workoutTime(w);
      return Number.isFinite(t) && t <= current && t > cutoff;
    })
    .sort((a, b) => workoutTime(a) - workoutTime(b));
}

// --- muscle resolution ----------------------------------------------------

/**
 * Canonical muscle axes for one workout exercise. Thin compat wrapper over
 * the single resolver (domain/muscles `resolveAttribution`): attributed axes
 * in primary-first order, or ['Other'] when unknown. Weighted exposure (for
 * stats) lives in `muscleStats` via `attributeAmount`, not here.
 */
export function resolveMusclesForExercise(exercise, exerciseMap) {
  return resolveAxes(exercise, exerciseMap);
}

export function buildExerciseMap(exercisesDB) {
  return new Map((Array.isArray(exercisesDB) ? exercisesDB : []).map((ex) => [ex?.id, ex]));
}

function bodyweightOpts(exercise, exerciseMap, userWeight) {
  const dbExercise = exercise?.exerciseId != null && exerciseMap
    ? exerciseMap.get(exercise.exerciseId)
    : null;
  return { usesBodyweight: Boolean(dbExercise?.usesBodyweight), userWeight };
}

function doneWorkSets(exercise) {
  return ((exercise?.sets) || []).filter(isWorkSet);
}

// --- muscle aggregates ----------------------------------------------------

/**
 * Per-axis aggregates for a workout list (range-filtered history, or a
 * single-element list on the finish screen):
 * - setsByMuscle: WEIGHTED attributed exposure (primary 1.0, secondary 0.5
 *   via the canonical resolver — a synergist never duplicates full credit),
 * - volumeByMuscle: WEIGHTED attributed work tonnage via canonical
 *   calculateSetVolume (same weights),
 * - sessionsByMuscle: workouts training the axis at least once (inclusion).
 * Raw physical accounting stays separate: totalSets/totalVolume count the
 * actual work once and never as duplicates. Attributed sums may therefore
 * differ from raw totals by construction — they are exposure units, not
 * physical tonnage.
 */
export function muscleStats(workouts, opts = {}) {
  const { userWeight = null, exercisesDB = [] } = opts;
  const list = Array.isArray(workouts) ? workouts : [];
  const exerciseMap = buildExerciseMap(exercisesDB);
  const setsByMuscle = Object.fromEntries(MUSCLE_AXES.map((m) => [m, 0]));
  const volumeByMuscle = Object.fromEntries(MUSCLE_AXES.map((m) => [m, 0]));
  const sessionsByMuscle = Object.fromEntries(MUSCLE_AXES.map((m) => [m, 0]));
  let totalSets = 0;
  let totalVolume = 0;

  for (const w of list) {
    const trained = new Set();
    for (const ex of w?.exercises || []) {
      const rows = doneWorkSets(ex);
      if (!rows.length) continue;
      totalSets += rows.length;
      const resolution = resolveAttribution(ex, exerciseMap);
      const o = bodyweightOpts(ex, exerciseMap, userWeight);
      const vol = rows.reduce((sum, s) => sum + calculateSetVolume(s, o), 0);
      totalVolume += vol;
      const setsAttr = attributeAmount(resolution, rows.length);
      const volAttr = attributeAmount(resolution, vol);
      for (const axis of MUSCLE_AXES) {
        if (setsAttr[axis] > 0) {
          setsByMuscle[axis] += setsAttr[axis];
          trained.add(axis);
        }
        if (volAttr[axis] > 0) volumeByMuscle[axis] += volAttr[axis];
      }
    }
    for (const axis of trained) sessionsByMuscle[axis] += 1;
  }
  for (const axis of MUSCLE_AXES) {
    setsByMuscle[axis] = Math.round(setsByMuscle[axis] * 10) / 10;
    volumeByMuscle[axis] = Math.round(volumeByMuscle[axis] * 10) / 10;
  }
  return {
    setsByMuscle,
    volumeByMuscle,
    sessionsByMuscle,
    totalSets,
    totalVolume: Math.round(totalVolume * 10) / 10
  };
}

/** Relative 0–4 shade levels within one window (hardest-worked axis = 4). */
export function levelsOf(setsByMuscle) {
  const load = setsByMuscle || {};
  const max = Math.max(0, ...MUSCLE_AXES.map((m) => Number(load[m]) || 0));
  const lv = {};
  MUSCLE_AXES.forEach((m) => {
    const v = Number(load[m]) || 0;
    lv[m] = !v ? 0 : max <= 0 ? 0 : Math.max(1, Math.min(4, Math.ceil((v / max) * 4)));
  });
  return lv;
}

export const MUSCLE_INTENSITY = ['No data', 'Low', 'Moderate', 'High', 'Very high'];

export function intensityOfLevel(level) {
  if (level >= 4) return MUSCLE_INTENSITY[4];
  if (level === 3) return MUSCLE_INTENSITY[3];
  if (level === 2) return MUSCLE_INTENSITY[2];
  if (level === 1) return MUSCLE_INTENSITY[1];
  return MUSCLE_INTENSITY[0];
}

// Front/back visibility per axis, matching the shipped Body Map geometry.
// One axis state drives every region it maps to — projections are display only.
const FRONT_ONLY = new Set(['Chest', 'Biceps']);
const BACK_ONLY = new Set(['Back', 'Triceps']);

export function viewsForMuscle(axis) {
  if (BACK_ONLY.has(axis)) return ['back'];
  if (FRONT_ONLY.has(axis)) return ['front'];
  return ['front', 'back'];
}

/** Contextual detail for one selected axis (Body Map panel). */
export function muscleDetailFor(axis, stats) {
  const sets = Math.round(((Number(stats?.setsByMuscle?.[axis]) || 0) * 10)) / 10;
  const volume = Number(stats?.volumeByMuscle?.[axis]) || 0;
  const sessions = Number(stats?.sessionsByMuscle?.[axis]) || 0;
  const totalSets = Number(stats?.totalSets) || 0;
  const share = totalSets > 0 && sets > 0 ? sets / totalSets : 0;
  const level = levelsOf(stats?.setsByMuscle || {})[axis] ?? 0;
  return { axis, sets, volume, sessions, share, level, intensity: intensityOfLevel(level) };
}

/**
 * Older-half vs newer-half trend for one axis. Null below two training
 * sessions — insufficient data is a null, never a flat line. ±10% noise band.
 */
export function muscleTrend(workouts, axis, opts = {}) {
  const { exercisesDB = [] } = opts;
  const exerciseMap = buildExerciseMap(exercisesDB);
  const per = [];
  for (const w of Array.isArray(workouts) ? workouts : []) {
    let sets = 0;
    for (const ex of w?.exercises || []) {
      const rows = doneWorkSets(ex);
      if (!rows.length) continue;
      if (resolveMusclesForExercise(ex, exerciseMap).includes(axis)) sets += rows.length;
    }
    if (sets > 0) per.push({ t: workoutTime(w), sets });
  }
  per.sort((a, b) => a.t - b.t);
  if (per.length < 2) return null;
  const mid = Math.floor(per.length / 2);
  const older = per.slice(0, mid).reduce((a, p) => a + p.sets, 0);
  const newer = per.slice(mid).reduce((a, p) => a + p.sets, 0);
  if (!(older > 0) && !(newer > 0)) return null;
  const direction = newer > older * 1.1 ? 'up' : newer < older * 0.9 ? 'down' : 'flat';
  return {
    direction,
    sessions: per.length,
    olderSets: Math.round(older * 10) / 10,
    newerSets: Math.round(newer * 10) / 10
  };
}

// --- overview -------------------------------------------------------------

/** WHAT DID I DO? Headline numbers for the range (all history-derived). */
export function overviewStats(workouts, opts = {}) {
  const { userWeight = null, exercisesDB = [] } = opts;
  const list = Array.isArray(workouts) ? workouts : [];
  const exerciseMap = buildExerciseMap(exercisesDB);
  let sets = 0;
  let volume = 0;
  let minutes = 0;
  const days = new Set();
  for (const w of list) {
    for (const ex of w?.exercises || []) {
      const rows = doneWorkSets(ex);
      sets += rows.length;
      const o = bodyweightOpts(ex, exerciseMap, userWeight);
      volume += rows.reduce((sum, s) => sum + calculateSetVolume(s, o), 0);
    }
    if (w?.date) days.add(String(w.date).slice(0, 10));
    if (Number.isFinite(Number(w?.duration)) && Number(w.duration) > 0) minutes += Number(w.duration);
  }
  return {
    workouts: list.length,
    sets,
    volume: Math.round(volume * 10) / 10,
    activeDays: days.size,
    minutes
  };
}

// --- per-workout series ----------------------------------------------------

/** One point per session (no bucketing assumptions) for the trend charts. */
export function volumeSeries(workouts, opts = {}) {
  const { userWeight = null, exercisesDB = [] } = opts;
  const exerciseMap = buildExerciseMap(exercisesDB);
  return (Array.isArray(workouts) ? workouts : [])
    .map((w) => {
      let y = 0;
      for (const ex of w?.exercises || []) {
        const o = bodyweightOpts(ex, exerciseMap, userWeight);
        y += doneWorkSets(ex).reduce((sum, s) => sum + calculateSetVolume(s, o), 0);
      }
      return { t: workoutTime(w), date: w?.date, label: shortLabel(w?.date), value: Math.round(y * 10) / 10 };
    })
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.value))
    .sort((a, b) => a.t - b.t);
}

export function setsSeries(workouts) {
  return (Array.isArray(workouts) ? workouts : [])
    .map((w) => {
      let y = 0;
      for (const ex of w?.exercises || []) y += doneWorkSets(ex).length;
      return { t: workoutTime(w), date: w?.date, label: shortLabel(w?.date), value: y };
    })
    .filter((p) => Number.isFinite(p.t))
    .sort((a, b) => a.t - b.t);
}

function shortLabel(dateValue) {
  const d = new Date(dateValue);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// --- top exercises ----------------------------------------------------------

/**
 * Exercises ranked by attributed work volume in the list, with session count
 * and best set. Powers the "Exercise progress" index — full curves live in
 * the exercise detail screen (no duplicate chart logic here).
 */
export function exerciseVolumes(workouts, opts = {}) {
  const { userWeight = null, exercisesDB = [] } = opts;
  const exerciseMap = buildExerciseMap(exercisesDB);
  const byId = new Map();
  for (const w of Array.isArray(workouts) ? workouts : []) {
    for (const ex of w?.exercises || []) {
      const rows = doneWorkSets(ex);
      if (!rows.length || ex?.exerciseId == null) continue;
      const o = bodyweightOpts(ex, exerciseMap, userWeight);
      const vol = rows.reduce((sum, s) => sum + calculateSetVolume(s, o), 0);
      let row = byId.get(ex.exerciseId);
      if (!row) {
        const def = exerciseMap.get(ex.exerciseId) || {};
        row = { id: ex.exerciseId, name: ex.name || def.name || String(ex.exerciseId), volume: 0, sessions: 0, bestKg: 0, bestReps: 0 };
        byId.set(ex.exerciseId, row);
      }
      row.volume += vol;
      row.sessions += 1;
      for (const s of rows) {
        const kg = Number(s.kg) || 0;
        const reps = Number(s.reps) || 0;
        if (kg * reps > row.bestKg * row.bestReps) { row.bestKg = kg; row.bestReps = reps; }
      }
    }
  }
  return [...byId.values()]
    .map((r) => ({ ...r, volume: Math.round(r.volume * 10) / 10 }))
    .sort((a, b) => b.volume - a.volume);
}

// --- consistency ----------------------------------------------------------

/** HOW OFTEN DID I SHOW UP? Sessions, active days, weekly rate. No scores. */
export function consistencyStats(workouts, range, now = Date.now()) {
  const list = Array.isArray(workouts) ? workouts : [];
  const current = now instanceof Date ? now.getTime() : Number(now);
  const days = new Set(list.map((w) => String(w?.date || '').slice(0, 10)).filter((d) => d && d !== ''));
  const rangeDays = RANGE_DAYS[range] ?? 0;
  const spanWeeks = rangeDays > 0
    ? rangeDays / 7
    : (() => {
      if (!list.length || !Number.isFinite(current)) return 1;
      const first = Math.min(...list.map(workoutTime).filter(Number.isFinite));
      if (!Number.isFinite(first)) return 1;
      return Math.max(1, (current - first) / (7 * DAY_MS));
    })();
  const perWeek = list.length ? Math.round((list.length / spanWeeks) * 10) / 10 : 0;
  const coverage = rangeDays > 0 && list.length ? Math.min(1, days.size / rangeDays) : 0;
  return { workouts: list.length, activeDays: days.size, perWeek, coverage };
}

// --- strength -------------------------------------------------------------

/**
 * HOW AM I PROGRESSING? Estimated-1RM movers in the range: exercises with at
 * least two estimable sessions, most-trained first (same ordering as the
 * coach insights). Actual logged performance only — a progression
 * prescription is never plotted as history here.
 */
export function strengthMovers(workouts, opts = {}) {
  const { topN = 3 } = opts;
  const series = new Map();
  for (const w of Array.isArray(workouts) ? workouts : []) {
    for (const ex of w?.exercises || []) {
      if (!ex?.exerciseId) continue;
      let best = 0;
      for (const s of doneWorkSets(ex)) {
        const est = calculate1RM(Number(s.kg) || 0, Number(s.reps) || 0);
        if (est > best) best = est;
      }
      if (!(best > 0)) continue;
      if (!series.has(ex.exerciseId)) series.set(ex.exerciseId, []);
      series.get(ex.exerciseId).push({ t: workoutTime(w), date: w?.date, y: best });
    }
  }
  return [...series.entries()]
    .filter(([, pts]) => pts.filter((p) => Number.isFinite(p.t)).length >= 2)
    .map(([id, pts]) => {
      const ordered = pts.filter((p) => Number.isFinite(p.t)).sort((a, b) => a.t - b.t);
      const first = ordered[0].y;
      const last = ordered[ordered.length - 1].y;
      return {
        id,
        sessions: ordered.length,
        first,
        last,
        delta: Math.round((last - first) * 10) / 10,
        pct: first ? Math.round(((last - first) / first) * 100) : 0,
        points: ordered
      };
    })
    .sort((a, b) => b.sessions - a.sessions || Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, Math.max(0, topN));
}

/**
 * Ranged view over the canonical per-exercise past (getExerciseHistory).
 * `best` is the best in range; `allTimeBest` keeps the global record so a
 * short range never rewrites what the lifter actually lifted.
 */
export function exerciseProgressInRange(workouts, exerciseId, range, now = Date.now()) {
  const full = getExerciseHistory(exerciseId, Array.isArray(workouts) ? workouts : []);
  const current = now instanceof Date ? now.getTime() : Number(now);
  const days = RANGE_DAYS[range] ?? 0;
  const cutoff = days > 0 && Number.isFinite(current) ? current - days * DAY_MS : -Infinity;
  const inRange = (dateValue) => {
    const t = new Date(dateValue).getTime();
    return Number.isFinite(t) && t <= current && t > cutoff;
  };
  const sessions = full.filter((s) => inRange(s.date));
  let best = 0;
  for (const s of sessions) {
    if ((s.max1RM || 0) > best) best = s.max1RM;
  }
  let allTimeBest = 0;
  for (const s of full) {
    if ((s.max1RM || 0) > allTimeBest) allTimeBest = s.max1RM;
  }
  return {
    best,
    allTimeBest,
    total: sessions.length,
    totalAllTime: full.length,
    sessions
  };
}
