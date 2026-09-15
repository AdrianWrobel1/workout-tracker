/**
 * Canonical muscle attribution V2 — regression suite.
 *
 * Pins: aliases, primary/secondary/weights, Core fix, unknown handling,
 * category fallback, invalid tokens, audited compound corrections, legacy +
 * custom exercises, single-resolver consistency across every consumer, and
 * the adversarial one-workout cross-screen test.
 */
import { describe, it, expect } from 'vitest';
import {
  MUSCLE_AXES,
  PRIMARY_WEIGHT,
  SECONDARY_WEIGHT,
  UNKNOWN_MUSCLE,
  DETAIL_TO_AXIS,
  normalizeMuscleToken,
  normalizeExerciseKey,
  categoryToAxes,
  mapCategoryToMuscles,
  lookupKnownExercise,
  resolveAttribution,
  resolveAxes,
  attributeAmount,
  detailWeights,
  resolveStoredAttribution,
  primaryOf,
  sanitizeMusclesForStorage,
} from '../muscles';
import { resolveMusclesForExercise, muscleStats } from '../../analytics/statistics';
import { calculateMuscleBalance } from '../../analytics/muscleBalance';
import { computeVolumeLandmarks } from '../../analytics/volumeLandmarks';
import { calculateMuscleDistribution, prepareCleanWorkoutData } from '../workouts';
import { getExerciseDetailModel } from '../exerciseDetail';
import { getSessionMuscleStats } from '../sessionDetail';

const set = (over = {}) => ({ kg: 100, reps: 5, completed: true, setType: 'work', ...over });
const mapOf = (db) => new Map(db.map((e) => [e.id, e]));

// 1. canonical aliases
describe('token aliases', () => {
  it('maps common synonyms to canonical axes', () => {
    expect(normalizeMuscleToken('pec')).toMatchObject({ axis: 'Chest' });
    expect(normalizeMuscleToken('PECS')).toMatchObject({ axis: 'Chest' });
    expect(normalizeMuscleToken('lats')).toMatchObject({ axis: 'Back', detail: 'Lats' });
    expect(normalizeMuscleToken('Quads')).toMatchObject({ axis: 'Legs', detail: 'Quads' });
    expect(normalizeMuscleToken('hamstrings')).toMatchObject({ axis: 'Legs', detail: 'Hamstrings' });
    expect(normalizeMuscleToken('glutes')).toMatchObject({ axis: 'Legs', detail: 'Glutes' });
    expect(normalizeMuscleToken('rear delt')).toMatchObject({ axis: 'Shoulders', detail: 'Rear Delts' });
    expect(normalizeMuscleToken('side delts')).toMatchObject({ axis: 'Shoulders', detail: 'Side Delts' });
    expect(normalizeMuscleToken('abs')).toMatchObject({ axis: 'Core', detail: 'Abs' });
    expect(normalizeMuscleToken('BICEPS')).toMatchObject({ axis: 'Biceps' });
    expect(normalizeMuscleToken('triceps')).toMatchObject({ axis: 'Triceps' });
  });
  it('treats movement buckets as valid-but-empty (never axes)', () => {
    expect(normalizeMuscleToken('push')).toBeNull();
    expect(normalizeMuscleToken('pull')).toBeNull();
    expect(normalizeMuscleToken('cardio')).toBeNull();
  });
  it('rejects garbage and non-strings', () => {
    expect(normalizeMuscleToken('banana')).toBeNull();
    expect(normalizeMuscleToken('')).toBeNull();
    expect(normalizeMuscleToken(null)).toBeNull();
    expect(normalizeMuscleToken(42)).toBeNull();
  });
  it('matches exact tokens only — no substring accidents', () => {
    // The old substring map turned any 'ab' into Core; exact matching must not.
    expect(normalizeMuscleToken('cable')).toBeNull();
    expect(normalizeMuscleToken('ab')).toMatchObject({ axis: 'Core' });
  });
});

// 2/3. valid primary + secondary (stored V2 shape wins over everything)
describe('stored V2 shape', () => {
  const db = [{ id: 'x', name: 'Custom Cable Thing', category: 'Pull', primary: 'Back', secondary: ['Biceps'], detail: ['Lats'] }];
  it('wins over the knowledge base and legacy muscles', () => {
    const res = resolveAttribution({ exerciseId: 'x', name: 'Custom Cable Thing', category: 'Pull' }, mapOf(db));
    expect(res).toMatchObject({ primary: 'Back', secondary: ['Biceps'], detail: ['Lats'], source: 'v2' });
    expect(res.weights).toEqual({ Back: 1, Biceps: 0.5 });
  });
  it('validates secondary/detail (drops self, unknown, mismatched detail)', () => {
    const bad = [{ id: 'y', name: 'Whatever', category: 'Push', primary: 'Chest', secondary: ['Chest', 'Banana', 'Triceps'], detail: ['Quads', 'Abs'] }];
    const res = resolveAttribution({ exerciseId: 'y' }, mapOf(bad));
    expect(res.primary).toBe('Chest');
    expect(res.secondary).toEqual(['Triceps']);
    expect(res.detail).toEqual([]);
  });
});

// 4. weighted attribution
describe('weight semantics', () => {
  it('exposes central primary/secondary weights', () => {
    expect(PRIMARY_WEIGHT).toBe(1);
    expect(SECONDARY_WEIGHT).toBe(0.5);
  });
  it('attributeAmount splits proportionally, never duplicates', () => {
    const out = attributeAmount({ weights: { Chest: 1, Triceps: 0.5, Shoulders: 0.5 } }, 4);
    expect(out).toEqual({ Chest: 4, Triceps: 2, Shoulders: 2 });
  });
  it('raw totals stay separate from attributed exposure in muscleStats', () => {
    const db = [{ id: 'b', name: 'Bench Press', category: 'Push', muscles: ['Chest', 'Triceps', 'Shoulders'] }];
    const w = { id: 'w', date: '2026-09-10', exercises: [{ exerciseId: 'b', name: 'Bench Press', category: 'Push', sets: [set()] }] };
    const stats = muscleStats([w], { exercisesDB: db });
    expect(stats.totalSets).toBe(1);
    expect(stats.setsByMuscle.Chest).toBe(1);
    expect(stats.setsByMuscle.Triceps).toBe(0.5);
    expect(stats.setsByMuscle.Shoulders).toBe(0.5);
  });
});

// 5. Core fix
describe('Core fix', () => {
  it("category 'Core' resolves to Core, not Other", () => {
    expect(categoryToAxes('Core')).toEqual(['Core']);
    expect(categoryToAxes('core')).toEqual(['Core']);
    expect(mapCategoryToMuscles('Core')).toEqual(['Core']);
  });
  it('Ab Wheel is visible in Statistics and the Body Map inputs', () => {
    const db = [{ id: 'ab', name: 'Ab Wheel Rollout', category: 'Pull', muscles: ['Core'] }];
    const w = { id: 'w', date: '2026-09-10', exercises: [{ exerciseId: 'ab', name: 'Ab Wheel Rollout', category: 'Pull', sets: [set(), set()] }] };
    const stats = muscleStats([w], { exercisesDB: db });
    expect(stats.setsByMuscle.Core).toBe(2);
    expect(stats.sessionsByMuscle.Core).toBe(1);
    expect(stats.totalSets).toBe(2);
  });
  it('Ab Wheel is effectively Core-category and never Pull in balance', () => {
    const db = [{ id: 'ab', name: 'Ab Wheel Rollout', category: 'Pull', muscles: ['Core'] }];
    const w = { id: 'w', date: new Date().toISOString(), exercises: [{ exerciseId: 'ab', name: 'Ab Wheel Rollout', category: 'Pull', sets: [set()] }] };
    const balance = calculateMuscleBalance([w], db);
    expect(balance.week.pushPull.sideAValue).toBe(0);
    expect(balance.week.pushPull.sideBValue).toBe(0);
    const res = resolveAttribution({ exerciseId: 'ab' }, mapOf(db));
    expect(res.category).toBe('Core');
  });
});

// 6/7. unknown + category fallback
describe('unknown stays unknown', () => {
  it('unmapped categories yield Other with zero weights', () => {
    for (const cat of ['Conditioning', 'Cardio', 'Full Body', '', null, undefined]) {
      expect(categoryToAxes(cat)).toEqual([UNKNOWN_MUSCLE]);
    }
    const res = resolveAttribution({ exerciseId: 'ghost', name: 'Mystery', category: 'Conditioning' }, new Map());
    expect(res.primary).toBe('Other');
    expect(res.weights).toEqual({});
    expect(res.axes).toEqual([]);
    expect(res.source).toBe('unknown');
  });
  it('unknown exercises credit no axis in statistics', () => {
    const w = { id: 'w', date: '2026-09-10', exercises: [{ exerciseId: 'ghost', name: 'Mystery', category: 'Conditioning', sets: [set()] }] };
    const stats = muscleStats([w], { exercisesDB: [] });
    expect(stats.totalSets).toBe(1);
    expect(Object.values(stats.setsByMuscle).every((v) => v === 0)).toBe(true);
  });
  it('category fallback still maps movement patterns', () => {
    expect(categoryToAxes('Push')).toEqual(['Chest', 'Shoulders', 'Triceps']);
    expect(categoryToAxes('Pull')).toEqual(['Back', 'Biceps']);
    expect(categoryToAxes('Legs')).toEqual(['Legs']);
  });
});

// 8. invalid tokens
describe('invalid token handling', () => {
  it('drops invalid tokens, keeps valid ones in order', () => {
    const db = [{ id: 'c', name: 'Zzz Custom', category: 'Push', muscles: ['Banana', 'Chest', 'push', 'Triceps'] }];
    const res = resolveAttribution({ exerciseId: 'c', category: 'Push' }, mapOf(db));
    expect(res.primary).toBe('Chest');
    expect(res.secondary).toEqual(['Triceps']);
    expect(res.source).toBe('legacy');
  });
  it('falls through to category when every token is invalid', () => {
    const db = [{ id: 'c', name: 'Zzz Custom', category: 'Pull', muscles: ['Banana'] }];
    const res = resolveAttribution({ exerciseId: 'c', category: 'Pull' }, mapOf(db));
    expect(res.source).toBe('category');
    expect(res.axes).toEqual(['Back', 'Biceps']);
  });
});

// 9-17. audited compound corrections
describe('audited compound semantics', () => {
  const res = (name, extra = {}) =>
    resolveAttribution({ exerciseId: null, name, category: 'Push', ...extra }, new Map());
  it('9. Bench Press: Chest primary, Triceps + Shoulders secondary', () => {
    expect(res('Bench Press')).toMatchObject({ primary: 'Chest', secondary: ['Triceps', 'Shoulders'] });
  });
  it('10. Dips: Chest primary (not Triceps-only)', () => {
    expect(res('Dipy')).toMatchObject({ primary: 'Chest', secondary: ['Triceps', 'Shoulders'] });
    expect(res('Dips')).toMatchObject({ primary: 'Chest' });
  });
  it('11. Barbell Row: Back + Biceps', () => {
    expect(res('Barbell Row')).toMatchObject({ primary: 'Back', secondary: ['Biceps'], detail: ['Lats', 'Upper Back'] });
  });
  it('12. Pull-Up: Back + Biceps + Lats detail', () => {
    expect(res('Weighted Pull-Ups')).toMatchObject({ primary: 'Back', secondary: ['Biceps'], detail: ['Lats'] });
  });
  it('13. Chin-Up resolves as Pull with Back + Biceps', () => {
    const r = res('Chin up');
    expect(r).toMatchObject({ primary: 'Back', secondary: ['Biceps'] });
    expect(r.category).toBe('Pull');
  });
  it('14. Squat: Legs with Quads + Glutes detail', () => {
    expect(res('Back Squat')).toMatchObject({ primary: 'Legs', detail: ['Quads', 'Glutes'] });
    const full = resolveAttribution({ exerciseId: null, name: 'Back Squat', category: 'Legs' }, new Map());
    expect(detailWeights(full)).toEqual({ Quads: 1, Glutes: 1 });
  });
  it('15. Legs detail rolls up to the Legs axis', () => {
    for (const tag of ['Quads', 'Hamstrings', 'Glutes', 'Calves']) {
      expect(DETAIL_TO_AXIS[tag]).toBe('Legs');
    }
    expect(res('Leg Extension')).toMatchObject({ primary: 'Legs', detail: ['Quads'] });
  });
  it('16. Face Pull: Shoulders + Back with Rear Delts detail', () => {
    expect(res('Face pull')).toMatchObject({ primary: 'Shoulders', secondary: ['Back'], detail: ['Rear Delts'] });
  });
  it('17. Flyes: Chest + Shoulders (no Triceps)', () => {
    const r = res('Rozpiętki');
    expect(r).toMatchObject({ primary: 'Chest', secondary: ['Shoulders'] });
    expect(r.secondary).not.toContain('Triceps');
  });
  it('Smith incline matches barbell incline attribution', () => {
    expect(res('Incline barbell press (smith)')).toMatchObject({
      primary: 'Chest',
      secondary: ['Triceps', 'Shoulders'],
      detail: ['Upper Chest'],
    });
  });
  it('Overhead Press: Shoulders + Triceps with Front Delts detail', () => {
    expect(res('Overhead Press (Barbell)')).toMatchObject({
      primary: 'Shoulders',
      secondary: ['Triceps'],
      detail: ['Front Delts'],
    });
  });
});

// 18. historical legacy exercise
describe('historical legacy compatibility', () => {
  it('legacy muscles[] pass through for names outside the knowledge base', () => {
    const db = [{ id: 1, name: 'Some 2019 Machine', category: 'Pull', muscles: ['Back'] }];
    const res = resolveAttribution({ exerciseId: 1, name: 'Some 2019 Machine', category: 'Pull' }, mapOf(db));
    expect(res).toMatchObject({ primary: 'Back', secondary: [], source: 'legacy' });
    expect(lookupKnownExercise('Some 2019 Machine')).toBeNull();
  });
  it('ambiguous customs keep stored values (unknown preserved, not invented)', () => {
    for (const name of ['Narciarz', 'Nogi tył', 'Maszyna na plecy']) {
      expect(lookupKnownExercise(name)).toBeNull();
    }
    expect(normalizeExerciseKey('Tył barku hantle na ławce')).toBe('tyl barku hantle na lawce');
  });
  it('workout targetMuscles are honored when nothing stored applies', () => {
    const res = resolveAttribution(
      { exerciseId: 'ghost', name: 'Zzz Custom', category: 'Push', targetMuscles: ['Back'] },
      new Map()
    );
    expect(res).toMatchObject({ primary: 'Back', source: 'workout' });
  });
});

// 19. custom exercise sanitization
describe('sanitizeMusclesForStorage', () => {
  it('completes known legacy names with canonical data', () => {
    const out = sanitizeMusclesForStorage({ id: 1, name: 'Dipy', category: 'Push', muscles: ['Triceps'] });
    expect(out).toMatchObject({ primary: 'Chest', secondary: ['Triceps', 'Shoulders'], muscles: ['Chest', 'Triceps', 'Shoulders'] });
  });
  it('fixes provably wrong categories on legacy rows', () => {
    expect(sanitizeMusclesForStorage({ name: 'Chin up', category: 'Push' }).category).toBe('Pull');
    expect(sanitizeMusclesForStorage({ name: 'Ab Wheel Rollout', category: 'Pull' }).category).toBe('Core');
  });
  it('derives V2 shape from legacy free-text via aliases', () => {
    const out = sanitizeMusclesForStorage({ name: 'Zzz Custom', category: 'Pull', muscles: ['lats', 'biceps', 'junk'] });
    expect(out).toMatchObject({ primary: 'Back', secondary: ['Biceps'], detail: ['Lats'] });
  });
  it('drops invalid muscles so category fallback applies at read time', () => {
    const out = sanitizeMusclesForStorage({ name: 'Zzz Custom', category: 'Pull', muscles: ['junk'] });
    expect(out).not.toHaveProperty('muscles');
    expect(out).not.toHaveProperty('primary');
  });
  it('never overrides a stored V2 shape or its category', () => {
    const row = { name: 'Bench Press', category: 'Push', primary: 'Chest', secondary: ['Triceps'], detail: [] };
    expect(sanitizeMusclesForStorage(row)).toMatchObject({ primary: 'Chest', secondary: ['Triceps'], category: 'Push' });
  });
  it('is pure (no input mutation)', () => {
    const row = { name: 'Dipy', category: 'Push', muscles: ['Triceps'] };
    sanitizeMusclesForStorage(row);
    expect(row).toEqual({ name: 'Dipy', category: 'Push', muscles: ['Triceps'] });
  });
});

// 20. no duplicated resolver semantics
describe('single resolver', () => {
  const db = [
    { id: 'bench', name: 'Bench Press', category: 'Push', muscles: ['Chest', 'Triceps', 'Shoulders'] },
    { id: 'ab', name: 'Ab Wheel Rollout', category: 'Pull', muscles: ['Core'] },
  ];
  const map = mapOf(db);
  it('compat wrapper equals canonical axes', () => {
    for (const id of ['bench', 'ab', 'ghost']) {
      const ex = id === 'ghost' ? { exerciseId: 'ghost', category: 'Push' } : { exerciseId: id };
      expect(resolveMusclesForExercise(ex, map)).toEqual(resolveAxes(ex, map));
    }
  });
  it('stored-row helper agrees with the resolver', () => {
    expect(resolveStoredAttribution(db[0]).primary).toBe('Chest');
    expect(primaryOf(db[1])).toBe('Core');
    expect(primaryOf(null)).toBe('Other');
  });
});

// 21. same exercise across all consumers + adversarial one-workout test
describe('cross-screen consistency', () => {
  const db = [
    { id: 'bench', name: 'Bench Press', category: 'Push', muscles: ['Chest', 'Triceps', 'Shoulders'] },
    { id: 'row', name: 'Barbell Row', category: 'Pull', muscles: ['Back'] },
    { id: 'ab', name: 'Ab Wheel Rollout', category: 'Pull', muscles: ['Core'] },
  ];
  const W = {
    id: 'w1',
    name: 'Full Session',
    date: '2026-09-10T10:00:00.000Z',
    duration: 60,
    exercises: [
      { exerciseId: 'bench', name: 'Bench Press', category: 'Push', sets: [set({ kg: 100, reps: 5 })] },
      { exerciseId: 'row', name: 'Barbell Row', category: 'Pull', sets: [set({ kg: 80, reps: 8 })] },
      { exerciseId: 'ab', name: 'Ab Wheel Rollout', category: 'Pull', sets: [set({ kg: 0, reps: 10 })] },
    ],
  };
  it('ONE WORKOUT: Statistics == Session == Finish inputs == Body Map inputs', () => {
    const stats = muscleStats([W], { exercisesDB: db });
    const session = getSessionMuscleStats(W, { exercisesDB: db });
    expect(session).toEqual(stats);
    // Body Map consumes exactly these two values:
    expect(Object.keys(session.setsByMuscle).sort()).toEqual([...MUSCLE_AXES].sort());
    expect(session.totalSets).toBe(3);
  });
  it('radar proportions agree with weighted statistics proportions', () => {
    const stats = muscleStats([W], { exercisesDB: db });
    const radar = calculateMuscleDistribution(W, db);
    // Bench 500kg: Chest 500, Tri 250, Sho 250. Row 640kg: Back 640, Bi 320.
    expect(stats.volumeByMuscle.Chest).toBe(500);
    expect(stats.volumeByMuscle.Back).toBe(640);
    expect(stats.volumeByMuscle.Biceps).toBe(320);
    const max = Math.max(...MUSCLE_AXES.map((a) => stats.volumeByMuscle[a]));
    for (const axis of MUSCLE_AXES) {
      expect(radar[axis]).toBeCloseTo(stats.volumeByMuscle[axis] / max, 10);
    }
  });
  it('finish volumePerMuscle uses the same weighted attribution', () => {
    const clean = prepareCleanWorkoutData(W, db, null);
    expect(clean.totalVolume).toBe(500 + 640 + 0);
    expect(clean.volumePerMuscle.Chest).toBe(500);
    expect(clean.volumePerMuscle.Triceps).toBe(250);
    expect(clean.volumePerMuscle.Back).toBe(640);
    expect(clean.volumePerMuscle.Core).toBe(0);
    expect(clean.volumePerMuscle).not.toHaveProperty('Push');
    expect(clean.volumePerMuscle).not.toHaveProperty('Pull');
  });
  it('balance sees the same exercise the same way', () => {
    const now = new Date('2026-09-11T12:00:00Z').getTime();
    const balance = calculateMuscleBalance([W], db, { now });
    // push: bench Chest 1 + Tri 0.5 + Sho 0.5 = 2. pull: row Back 1 + Bi 0.5 = 1.5. Ab Wheel: neither.
    expect(balance.week.pushPull.sideAValue).toBe(2);
    expect(balance.week.pushPull.sideBValue).toBe(1.5);
    expect(balance.week.chestBack.sideAValue).toBe(1);
    expect(balance.week.chestBack.sideBValue).toBe(1);
  });
  it('landmarks key on canonical axes with weighted sets', () => {
    const weeks = Array.from({ length: 6 }, (_, i) => ({
      ...W,
      id: `w${i}`,
      date: new Date(Date.now() - i * 7 * 86400000).toISOString(),
    }));
    const landmarks = computeVolumeLandmarks(weeks, { exercisesDB: db });
    expect(Object.keys(landmarks.byMuscle).sort()).toEqual(['Back', 'Biceps', 'Chest', 'Core', 'Shoulders', 'Triceps'].sort());
    expect(landmarks.byMuscle.Chest.target).toBe(1);
    expect(landmarks.byMuscle.Triceps.target).toBe(1);
    expect(landmarks.byMuscle.Core.target).toBe(1);
  });
  it('exercise detail reports the canonical primary/secondary/detail', () => {
    const det = getExerciseDetailModel({ exerciseId: 'row', workouts: [W], exercisesDB: db });
    expect(det.muscles).toMatchObject({ primary: 'Back', secondary: ['Biceps'], detail: ['Lats', 'Upper Back'] });
    const ab = getExerciseDetailModel({ exerciseId: 'ab', workouts: [W], exercisesDB: db });
    expect(ab.muscles).toMatchObject({ primary: 'Core' });
    expect(ab.identity.category).toBe('Core');
  });
});

// Performance: full consumer sweep over 500 workouts stays cheap.
describe('performance', () => {
  it('resolves 500 workouts across every consumer in reasonable time', () => {
    const db = [
      { id: 'bench', name: 'Bench Press', category: 'Push', muscles: ['Chest', 'Triceps', 'Shoulders'] },
      { id: 'row', name: 'Barbell Row', category: 'Pull', muscles: ['Back'] },
      { id: 'squat', name: 'Back Squat', category: 'Legs', muscles: ['Legs'] },
      { id: 'ab', name: 'Ab Wheel Rollout', category: 'Pull', muscles: ['Core'] },
    ];
    const ids = ['bench', 'row', 'squat', 'ab'];
    const ws = Array.from({ length: 500 }, (_, i) => ({
      id: `w${i}`,
      date: new Date(Date.now() - (i % 400) * 86400000).toISOString(),
      duration: 60,
      exercises: ids.map((id, k) => ({
        exerciseId: id,
        name: id,
        category: ['Push', 'Pull', 'Legs', 'Pull'][k],
        sets: [set({ kg: 60 + ((i + k) % 80), reps: 5 + ((i + k) % 6) })],
      })),
    }));
    const t0 = Date.now();
    const stats = muscleStats(ws, { exercisesDB: db });
    const balance = calculateMuscleBalance(ws, db);
    const landmarks = computeVolumeLandmarks(ws, { exercisesDB: db });
    const radar = calculateMuscleDistribution(ws[0], db);
    const clean = prepareCleanWorkoutData(ws[0], db, null);
    expect(Date.now() - t0).toBeLessThan(5000);
    for (const bag of [stats.setsByMuscle, stats.volumeByMuscle, clean.volumePerMuscle, radar]) {
      for (const v of Object.values(bag)) {
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
      }
    }
    expect(balance.week.pushPull.sideAValue).toBeGreaterThan(0);
    expect(Object.keys(landmarks.byMuscle).length).toBeGreaterThan(0);
  });
});
