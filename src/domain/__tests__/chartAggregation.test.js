import { describe, it, expect } from 'vitest';
import { aggregateDaily, aggregateWeekly, aggregateMonthly } from '../chartAggregation';
import { calculate1RM } from '../calculations';

const mkSet = (kg, reps, extra = {}) => ({ kg, reps, completed: true, ...extra });
const mkWorkout = (date, sets) => ({
  id: date,
  date,
  duration: 60,
  exercises: [{ exerciseId: 1, name: 'Bench', sets }]
});

describe('chart aggregation (canonical)', () => {
  it('daily volume SUMS sets like weekly/monthly (no single-set MAX)', () => {
    const w = mkWorkout('2026-01-15T12:00:00.000Z', [mkSet(100, 5), mkSet(100, 5)]);
    const daily = aggregateDaily([w], 'volume', null, null, []);
    const weekly = aggregateWeekly([w], 'volume', null, null, []);
    const monthly = aggregateMonthly([w], 'volume', null, null, []);
    expect(daily).toHaveLength(1);
    expect(daily[0].value).toBe(1000);
    expect(weekly[0].value).toBe(1000);
    expect(monthly[0].value).toBe(1000);
  });

  it('weight metric takes MAX, sets metric takes SUM', () => {
    const w = mkWorkout('2026-01-15T12:00:00.000Z', [mkSet(100, 5), mkSet(60, 10)]);
    const weight = aggregateDaily([w], 'weight', null, null, []);
    const sets = aggregateDaily([w], 'sets', null, null, []);
    expect(weight[0].value).toBe(Math.max(calculate1RM(100, 5), calculate1RM(60, 10)));
    expect(sets[0].value).toBe(2);
  });

  it('counts only work sets (warmups and incomplete excluded)', () => {
    const w = mkWorkout('2026-01-15T12:00:00.000Z', [
      mkSet(100, 5),
      mkSet(200, 5, { warmup: true, setType: 'warmup' }),
      { kg: 300, reps: 5, completed: false }
    ]);
    expect(aggregateDaily([w], 'volume', null, null, [])[0].value).toBe(500);
  });

  it('counts bodyweight sets via effective kg (kg=0 + userWeight)', () => {
    const w = mkWorkout('2026-01-15T12:00:00.000Z', [mkSet(0, 10)]);
    const db = [{ id: 1, usesBodyweight: true }];
    expect(aggregateDaily([w], 'volume', null, 80, db)[0].value).toBe(800);
    // ...and without bodyweight context a 0kg set still contributes nothing
    expect(aggregateDaily([w], 'volume', null, null, [])[0].value).toBe(0);
  });

  it('1RM uses the canonical Epley owner', () => {
    const w = mkWorkout('2026-01-15T12:00:00.000Z', [mkSet(100, 5)]);
    expect(aggregateDaily([w], 'weight', null, null, [])[0].value).toBe(calculate1RM(100, 5));
  });
});
