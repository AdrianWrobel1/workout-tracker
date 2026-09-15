import { isWorkSet } from '../domain/workoutExtensions';
import { parseWorkoutDate } from '../domain/dates';
import {
  PUSH_AXES,
  PULL_AXES,
  resolveAttribution,
  detailWeights,
} from '../domain/muscles';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_OPTIONS = {
  weekDays: 7,
  fallbackBlockDays: 42
};

const toTs = (dateValue) => {
  const parsed = parseWorkoutDate(dateValue);
  if (parsed) return parsed.getTime();
  return null;
};

/**
 * Canonical set contributions from ONE resolution. No name/category keyword
 * heuristics: push/pull/chest/back come from the weighted axis attribution,
 * quads/hamstrings from the leg detail tags (each detail inherits its
 * roll-up axis weight). Unknown exercises contribute to nothing.
 */
const classifySetContributions = (exercise, workSetCount, exerciseMap) => {
  const resolution = resolveAttribution(exercise, exerciseMap);
  const weights = resolution.weights || {};
  const details = detailWeights(resolution);

  let push = 0;
  let pull = 0;
  for (const axis of PUSH_AXES) push += (Number(weights[axis]) || 0) * workSetCount;
  for (const axis of PULL_AXES) pull += (Number(weights[axis]) || 0) * workSetCount;

  const chest = (Number(weights.Chest) || 0) * workSetCount;
  const back = (Number(weights.Back) || 0) * workSetCount;
  const quads = (Number(details.Quads) || 0) * workSetCount;
  const hamstrings = (Number(details.Hamstrings) || 0) * workSetCount;

  return { push, pull, chest, back, quads, hamstrings };
};

const addPair = (bucket, pairKey, sideA, sideB, aValue, bValue) => {
  if (!bucket[pairKey]) {
    bucket[pairKey] = {
      sideA,
      sideB,
      a: 0,
      b: 0
    };
  }
  bucket[pairKey].a += aValue;
  bucket[pairKey].b += bValue;
};

const finalizePair = (pair) => {
  const a = Number(pair?.a) || 0;
  const b = Number(pair?.b) || 0;
  const total = a + b;
  const diffShare = total > 0 ? Math.abs(a - b) / total : 0;
  let status = 'balanced';
  if (diffShare > 0.3) status = 'imbalanced';
  else if (diffShare > 0.15) status = 'slight';

  return {
    sideA: pair.sideA,
    sideB: pair.sideB,
    sideAValue: Math.round(a * 10) / 10,
    sideBValue: Math.round(b * 10) / 10,
    ratio: b > 0 ? Number((a / b).toFixed(2)) : (a > 0 ? Number.POSITIVE_INFINITY : 1),
    status
  };
};

const createScope = (label) => ({
  label,
  pairs: {
    pushPull: { sideA: 'Push', sideB: 'Pull', a: 0, b: 0 },
    chestBack: { sideA: 'Chest', sideB: 'Back', a: 0, b: 0 },
    quadHam: { sideA: 'Quads', sideB: 'Hamstrings', a: 0, b: 0 }
  }
});

const finalizeScope = (scope) => {
  const pushPull = finalizePair(scope.pairs.pushPull);
  const chestBack = finalizePair(scope.pairs.chestBack);
  const quadHam = finalizePair(scope.pairs.quadHam);
  const pairs = [pushPull, chestBack, quadHam];
  const values = pairs.map((pair) => {
    const a = pair.sideAValue;
    const b = pair.sideBValue;
    if (a <= 0 && b <= 0) return 1;
    if (a <= 0 || b <= 0) return 0.2;
    return Math.min(a, b) / Math.max(a, b);
  });
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;

  return {
    label: scope.label,
    pushPull,
    chestBack,
    quadHam,
    score: Math.round(avg * 100)
  };
};

export const calculateMuscleBalance = (workouts = [], exercisesDB = [], options = {}) => {
  const settings = { ...DEFAULT_OPTIONS, ...options };
  const nowTs = toTs(options.now || new Date());
  if (nowTs === null) {
    return {
      week: finalizeScope(createScope('Last 7 days')),
      block: finalizeScope(createScope('Last 6 weeks')),
      blockMode: 'rolling'
    };
  }

  const weekThreshold = nowTs - (settings.weekDays * DAY_MS);
  const rollingBlockThreshold = nowTs - (settings.fallbackBlockDays * DAY_MS);
  const exerciseMap = new Map((exercisesDB || []).map(ex => [ex.id, ex]));

  let latestBlockId = null;
  let latestBlockTs = -Infinity;
  for (let i = 0; i < workouts.length; i += 1) {
    const workout = workouts[i];
    const ts = toTs(workout?.date);
    const blockId = workout?.blockRef?.blockId;
    if (ts === null || !blockId) continue;
    if (ts > latestBlockTs) {
      latestBlockTs = ts;
      latestBlockId = blockId;
    }
  }

  const weekScope = createScope('This week');
  const blockScope = createScope(latestBlockId ? 'Current block' : 'Last 6 weeks');

  for (let i = 0; i < workouts.length; i += 1) {
    const workout = workouts[i];
    const ts = toTs(workout?.date);
    if (ts === null || ts > nowTs) continue;

    const inWeek = ts >= weekThreshold;
    const inBlock = latestBlockId
      ? workout?.blockRef?.blockId === latestBlockId
      : ts >= rollingBlockThreshold;
    if (!inWeek && !inBlock) continue;

    const exercises = workout?.exercises || [];
    for (let j = 0; j < exercises.length; j += 1) {
      const exercise = exercises[j];
      const sets = exercise?.sets || [];
      let workSetCount = 0;
      for (let k = 0; k < sets.length; k += 1) {
        if (isWorkSet(sets[k])) workSetCount += 1;
      }
      if (workSetCount === 0) continue;

      const values = classifySetContributions(exercise, workSetCount, exerciseMap);

      if (inWeek) {
        addPair(weekScope.pairs, 'pushPull', 'Push', 'Pull', values.push, values.pull);
        addPair(weekScope.pairs, 'chestBack', 'Chest', 'Back', values.chest, values.back);
        addPair(weekScope.pairs, 'quadHam', 'Quads', 'Hamstrings', values.quads, values.hamstrings);
      }
      if (inBlock) {
        addPair(blockScope.pairs, 'pushPull', 'Push', 'Pull', values.push, values.pull);
        addPair(blockScope.pairs, 'chestBack', 'Chest', 'Back', values.chest, values.back);
        addPair(blockScope.pairs, 'quadHam', 'Quads', 'Hamstrings', values.quads, values.hamstrings);
      }
    }
  }

  return {
    week: finalizeScope(weekScope),
    block: finalizeScope(blockScope),
    blockMode: latestBlockId ? 'blockRef' : 'rolling'
  };
};
