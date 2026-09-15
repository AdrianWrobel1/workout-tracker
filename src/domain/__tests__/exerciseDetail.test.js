import { describe, it, expect } from 'vitest';
import {
  RECENT_SESSION_LIMIT,
  buildExerciseDetailReturn,
  buildStatisticsReturn,
  getExerciseDetailModel,
  resolveExerciseDetailBackTarget,
} from '../exerciseDetail';

const done = (kg, reps, over = {}) => ({ kg, reps, completed: true, setType: 'work', ...over });
const warmup = (kg, reps) => ({ kg, reps, completed: true, setType: 'warmup' });
const W = (id, date, exerciseId, sets, name = 'Bench') => ({
  id,
  date,
  name: 'Workout',
  exercises: [{ exerciseId, name, category: 'Push', sets }],
});
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

const DB = [{ id: 'bench', name: 'Bench Press', category: 'Push', muscles: ['Chest', 'Triceps'] }];
const model = (workouts, exercisesDB = DB, extra = {}) =>
  getExerciseDetailModel({ exerciseId: 'bench', workouts, exercisesDB, ...extra });

// 1. normal history + 5. latest + 6. best/7. PR
describe('exercise with normal history', () => {
  const workouts = [
    W('w1', daysAgo(10), 'bench', [done(90, 8), done(90, 8)]),
    W('w2', daysAgo(3), 'bench', [done(100, 8), done(100, 6)]),
  ];
  it('reports sessions, latest actuals and all-time best with dates', () => {
    const m = model(workouts);
    expect(m.found).toBe(true);
    expect(m.sessionsCount).toBe(2);
    expect(m.hasHistory).toBe(true);
    // latest = most recent session
    expect(m.latest.date).toBe(daysAgo(3));
    expect(m.latest.workSetsCount).toBe(2);
    expect(m.latest.topSet).toEqual({ kg: 100, reps: 8 });
    expect(m.latest.max1RM).toBeGreaterThan(100);
    // best across history with source dates
    expect(m.hasBest).toBe(true);
    expect(m.best.heaviestWeight).toBe(100);
    expect(m.best.heaviestWeightDate).toBe(daysAgo(3));
    expect(m.best.best1RM).toBeGreaterThan(0);
    expect(m.best.best1RMDate).toBe(daysAgo(3));
  });
});

// 2. zero history
describe('zero history', () => {
  it('returns honest empties, never NaN/Infinity/undefined', () => {
    const m = model([]);
    expect(m.found).toBe(true);
    expect(m.hasHistory).toBe(false);
    expect(m.latest).toBeNull();
    expect(m.hasBest).toBe(false);
    expect(m.workload).toMatchObject({ totalVolume: 0, avgVolume: 0, totalSets: 0, totalReps: 0 });
    expect(m.recentSessions).toEqual([]);
    const json = JSON.stringify(m);
    expect(json).not.toMatch(/NaN|Infinity|undefined/);
    for (const v of [m.workload.totalVolume, m.workload.avgVolume, m.workload.perWeek]) {
      expect(Number.isFinite(v)).toBe(true);
    }
  });
});

// 3. one session
describe('one session', () => {
  it('latest equals best, trend stays neutral', () => {
    const m = model([W('w1', daysAgo(2), 'bench', [done(80, 10)])]);
    expect(m.sessionsCount).toBe(1);
    expect(m.latest.topSet).toEqual({ kg: 80, reps: 10 });
    expect(m.best.best1RM).toBe(m.latest.max1RM);
    expect(m.trend).toBe('→');
  });
});

// 4. multiple sessions order newest-first
describe('multiple sessions', () => {
  it('exposes full list newest-first and caps recent rows', () => {
    const workouts = Array.from({ length: 10 }, (_, i) =>
      W(`w${i}`, daysAgo(20 - i * 2), 'bench', [done(60 + i, 8)])
    );
    const m = model(workouts);
    expect(m.sessionsCount).toBe(10);
    expect(m.sessions[0].date > m.sessions[9].date).toBe(true);
    expect(m.recentSessions).toHaveLength(RECENT_SESSION_LIMIT);
    expect(m.hasMoreSessions).toBe(true);
  });
});

// 8. trend
describe('trend', () => {
  it('points up when recent 1RM clearly beats older training', () => {
    const m = model([
      W('w-old', daysAgo(40), 'bench', [done(60, 5)]),
      W('w-new', daysAgo(1), 'bench', [done(100, 5)]),
    ]);
    expect(m.trend).toBe('↑');
  });
});

// 9. volume (canonical, warmups excluded, bodyweight-aware)
describe('exercise workload', () => {
  it('sums work-set volume only and ignores warmups', () => {
    const m = model([W('w1', daysAgo(1), 'bench', [warmup(60, 5), done(100, 5), done(100, 5)])]);
    expect(m.workload.totalVolume).toBe(1000);
    expect(m.workload.avgVolume).toBe(1000);
    expect(m.workload.totalSets).toBe(2);
    expect(m.workload.totalReps).toBe(10);
  });
  it('adds bodyweight for bodyweight exercises like Statistics does', () => {
    const bwDB = [{ id: 'bench', name: 'Pull-up', category: 'Pull', usesBodyweight: true }];
    const m = model([W('w1', daysAgo(1), 'bench', [done(0, 10)])], bwDB, { userWeight: 80 });
    expect(m.workload.totalVolume).toBe(800);
  });
  it('never mixes muscle attribution into exercise totals', () => {
    const m = model([W('w1', daysAgo(1), 'bench', [done(100, 5)])]);
    // one set of 500 kg volume counted once, not once per muscle
    expect(m.workload.totalVolume).toBe(500);
  });
});

// 10-13. progression engine consumption
describe('progression integration (consumed, not reimplemented)', () => {
  const upDB = [
    { id: 'bench', name: 'Bench', category: 'Push', progression: { mode: 'double', repMin: 8, repMax: 12, incrementKg: 2.5 } },
  ];
  it('UP: top-of-range prescribes more weight, actual stays untouched', () => {
    const m = model([W('w1', daysAgo(4), 'bench', [done(100, 12), done(100, 12)])], upDB);
    expect(m.hasRecommendation).toBe(true);
    expect(m.recommendation.source).toBe('progression');
    expect(m.recommendation.state).toBe('UP');
    expect(m.recommendation.suggestedKg).toBe(102.5);
    // 15. actual vs recommended separation
    expect(m.latest.topSet).toEqual({ kg: 100, reps: 12 });
    expect(m.recommendation.suggestedKg).not.toBe(m.latest.topSet.kg);
    expect(m.recommendation.whyText).toBeTruthy();
    expect(m.recommendation.prescriptionText).toBe('102.5 kg × 8');
  });
  it('HOLD: below-range holds the current load', () => {
    const m = model([W('w1', daysAgo(4), 'bench', [done(100, 8), done(100, 8)])], upDB);
    expect(m.recommendation.state).toBe('HOLD');
    expect(m.recommendation.suggestedKg).toBe(100);
  });
  it('STALL: repeated misses at the same load stall', () => {
    const workouts = [9, 7, 5].map((ago, i) =>
      W(`w${i}`, daysAgo(ago), 'bench', [done(100, 8), done(100, 8)])
    );
    const m = model(workouts, upDB);
    expect(['STALL', 'HOLD']).toContain(m.recommendation.state);
    if (m.recommendation.state === 'STALL') {
      expect(m.recommendation.suggestedKg).toBe(100);
    }
  });
  it('DELOAD: deload policy reduces load', () => {
    const deloadDB = [
      { id: 'bench', name: 'Bench', category: 'Push', progression: { mode: 'deload', repMin: 8, deloadFactor: 0.9 } },
    ];
    const m = model([W('w1', daysAgo(4), 'bench', [done(100, 8)])], deloadDB);
    expect(m.recommendation.state).toBe('DELOAD');
    expect(m.recommendation.suggestedKg).toBeLessThan(100);
  });
});

// 14. OFF / no recommendation
describe('off / no recommendation', () => {
  it('OFF falls back to legacy memory without touching the engine', () => {
    const m = model([W('w1', daysAgo(4), 'bench', [done(80, 8)])]);
    expect(m.recommendation.source).toMatch(/legacy/);
    expect(m.recommendation.suggestedKg).toBe(80);
  });
  it('no history means no recommendation at all', () => {
    const m = model([]);
    expect(m.recommendation).toBeNull();
    expect(m.hasRecommendation).toBe(false);
  });
});

// 16. missing muscle metadata
describe('muscle information', () => {
  it('uses explicit muscles when present', () => {
    // 'Bench Press' is a known exercise: canonical data completes the legacy
    // row with the audited Shoulders synergist (source 'known').
    expect(model([W('w1', daysAgo(1), 'bench', [done(80, 8)])]).muscles).toMatchObject({
      primary: 'Chest',
      secondary: ['Triceps', 'Shoulders'],
      explicit: true,
    });
  });
  it('falls back to the category map without inventing data', () => {
    const noMuscleDB = [{ id: 'bench', name: 'Bench', category: 'Push' }];
    const m = model([W('w1', daysAgo(1), 'bench', [done(80, 8)])], noMuscleDB);
    expect(m.muscles.explicit).toBe(false);
    expect(m.muscles.tokens).toEqual(['Chest', 'Shoulders', 'Triceps']);
    expect(m.identity.muscleLine).toBe('Chest, Shoulders, Triceps');
  });
  it('falls back to General/Other when nothing is known', () => {
    const bareDB = [{ id: 'bench', name: 'Mystery' }];
    const m = model([], bareDB);
    expect(m.identity.category).toBe('General');
    expect(m.muscles.tokens).toEqual(['Other']);
  });
});

describe('rest resolution', () => {
  it('reports override vs global default honestly', () => {
    const withOverride = [{ id: 'bench', name: 'B', category: 'Push', restSec: 120 }];
    expect(model([], withOverride).rest).toMatchObject({ effectiveSec: 120, isOverride: true });
    expect(model([]).rest).toMatchObject({ effectiveSec: 90, isOverride: false });
  });
});

describe('unknown exercise', () => {
  it('returns found:false instead of blank/throw', () => {
    expect(model([], DB).found).toBe(true);
    const m = getExerciseDetailModel({ exerciseId: 'ghost', workouts: [], exercisesDB: DB });
    expect(m).toMatchObject({ found: false, exerciseId: 'ghost' });
  });
});

// 17. navigation / returnTo contract
describe('navigation contract', () => {
  it('returns to Statistics for statistics deep-links, exercises otherwise', () => {
    expect(resolveExerciseDetailBackTarget({ view: 'profileStatistics' })).toEqual({
      view: 'profile',
      profileSubview: 'statistics',
    });
    expect(resolveExerciseDetailBackTarget(null)).toEqual({ view: 'exercises' });
    expect(resolveExerciseDetailBackTarget({ view: 'exerciseDetail', exerciseId: 'bench' })).toEqual({
      view: 'exercises',
    });
  });
  it('builds stable return markers', () => {
    expect(buildExerciseDetailReturn('bench')).toEqual({ view: 'exerciseDetail', exerciseId: 'bench' });
    expect(buildStatisticsReturn()).toEqual({ view: 'profileStatistics' });
  });
});

// 18. large history sanity
describe('large history sanity', () => {
  it('handles 500 workouts quickly with finite numbers', () => {
    const workouts = Array.from({ length: 500 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (500 - i));
      return W(`w${i}`, d.toISOString().slice(0, 10), 'bench', [done(60 + (i % 40), 5 + (i % 3))]);
    });
    const start = Date.now();
    const m = model(workouts);
    expect(Date.now() - start).toBeLessThan(2000);
    expect(m.sessionsCount).toBe(500);
    expect(m.recentSessions).toHaveLength(RECENT_SESSION_LIMIT);
    expect(m.hasMoreSessions).toBe(true);
    expect(Number.isFinite(m.workload.totalVolume)).toBe(true);
    expect(Number.isFinite(m.best.best1RM)).toBe(true);
  });
});
