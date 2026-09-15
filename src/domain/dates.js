/**
 * Canonical date semantics.
 *
 * Persisted representation (going forward):
 * - Timestamped events (workout `date`, `startTime`, template snapshot dates):
 *   full ISO-8601 strings (`new Date().toISOString()`).
 * - Day grouping keys: local `YYYY-MM-DD` (`getLocalDayKey`).
 *
 * Backward compatibility:
 * - Readers MUST accept legacy date-only strings (`YYYY-MM-DD`), full ISO
 *   strings, numeric epoch ms, and anything `new Date()` parses.
 * - Never rewrite historical dates; normalize only at comparison time.
 */

/** Parse any persisted workout date into a Date or null (never throws). */
export const parseWorkoutDate = (value) => {
  if (value == null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    // Date-only strings parse as UTC midnight; interpret as local midnight
    // so grouping matches what the user saw when the workout was saved.
    const localDay = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (localDay) {
      const d = new Date(Number(localDay[1]), Number(localDay[2]) - 1, Number(localDay[3]));
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
};

const pad2 = (n) => String(n).padStart(2, '0');

/** Local day key `YYYY-MM-DD` for any persisted date value. */
export const getLocalDayKey = (value) => {
  const d = parseWorkoutDate(value);
  if (!d) return null;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

/** Local month key `YYYY-MM` for any persisted date value. */
export const getLocalMonthKey = (value) => {
  const d = parseWorkoutDate(value);
  if (!d) return null;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
};

/** Monday-based local week-start day key for any persisted date value. */
export const getWeekStartKey = (value) => {
  const d = parseWorkoutDate(value);
  if (!d) return null;
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  const day = (copy.getDay() + 6) % 7; // Monday=0
  copy.setDate(copy.getDate() - day);
  return `${copy.getFullYear()}-${pad2(copy.getMonth() + 1)}-${pad2(copy.getDate())}`;
};

/** Canonical persisted timestamp for new timestamped events. */
export const toPersistedTimestamp = (when = new Date()) => {
  const d = when instanceof Date ? when : parseWorkoutDate(when);
  return (d || new Date()).toISOString();
};

/** Canonical persisted day string for new active-workout start dates. */
export const toPersistedDay = (when = new Date()) => {
  const key = getLocalDayKey(when instanceof Date ? when : parseWorkoutDate(when) || new Date());
  return key || new Date().toISOString().split('T')[0];
};

/** Whole minutes between startTime and `now` (workout duration). */
export const diffMinutes = (startTime, now = new Date()) => {
  const start = parseWorkoutDate(startTime);
  const end = now instanceof Date ? now : parseWorkoutDate(now);
  if (!start || !end) return 0;
  return Math.max(0, Math.floor((end - start) / 60000));
};
