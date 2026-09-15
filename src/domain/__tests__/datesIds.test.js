import { describe, it, expect } from 'vitest';
import { generateId, generateSupersetId, isValidId } from '../ids';
import {
  parseWorkoutDate,
  getLocalDayKey,
  getLocalMonthKey,
  getWeekStartKey,
  toPersistedTimestamp,
  diffMinutes
} from '../dates';

describe('ids', () => {
  it('generates unique string ids', () => {
    const a = generateId();
    const b = generateId();
    expect(typeof a).toBe('string');
    expect(a).not.toBe(b);
  });

  it('generates prefixed superset ids', () => {
    expect(generateSupersetId().startsWith('superset_')).toBe(true);
  });

  it('accepts legacy numeric and string ids', () => {
    expect(isValidId(1700000000000)).toBe(true);
    expect(isValidId('abc')).toBe(true);
    expect(isValidId('')).toBe(false);
    expect(isValidId(null)).toBe(false);
  });
});

describe('dates (legacy-compatible readers)', () => {
  it('parses full ISO, date-only, epoch ms and Date', () => {
    expect(parseWorkoutDate('2026-01-15T10:00:00.000Z')).toBeInstanceOf(Date);
    expect(parseWorkoutDate('2026-01-15')).toBeInstanceOf(Date);
    expect(parseWorkoutDate(1700000000000)).toBeInstanceOf(Date);
    expect(parseWorkoutDate(new Date('2026-01-15'))).toBeInstanceOf(Date);
    expect(parseWorkoutDate('garbage')).toBeNull();
    expect(parseWorkoutDate(null)).toBeNull();
  });

  it('date-only strings map to local midnight (no UTC shift)', () => {
    const d = parseWorkoutDate('2026-01-15');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(15);
  });

  it('day/month/week keys are stable across both persisted shapes', () => {
    // Noon UTC on the 15th is the 15th in every timezone west of +14 after local parse
    const iso = '2026-01-15T12:00:00.000Z';
    expect(getLocalDayKey(iso)).toMatch(/^2026-01-1[45]$/);
    expect(getLocalMonthKey('2026-01-15')).toBe('2026-01');
    expect(getLocalMonthKey(iso).startsWith('2026-01')).toBe(true);
    expect(typeof getWeekStartKey('2026-01-15')).toBe('string');
  });

  it('week start is Monday-based', () => {
    // 2026-01-15 is a Thursday; Monday is the 12th
    expect(getWeekStartKey('2026-01-15')).toBe('2026-01-12');
    expect(getWeekStartKey('2026-01-12')).toBe('2026-01-12');
    expect(getWeekStartKey('2026-01-11')).toBe('2026-01-05'); // Sunday belongs to previous week
  });

  it('toPersistedTimestamp emits full ISO; diffMinutes floors', () => {
    expect(toPersistedTimestamp(new Date('2026-01-01T10:00:00.000Z'))).toBe('2026-01-01T10:00:00.000Z');
    expect(
      diffMinutes('2026-01-01T10:00:00.000Z', new Date('2026-01-01T11:30:00.000Z'))
    ).toBe(90);
    expect(diffMinutes('bad-date')).toBe(0);
  });
});
