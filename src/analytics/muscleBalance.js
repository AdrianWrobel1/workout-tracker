import { isWorkSet } from '../domain/workoutExtensions';
import { mapCategoryToMuscles } from '../domain/workouts';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_OPTIONS = {
  weekDays: 7,
  fallbackBlockDays: 42
};

const toTs = (dateValue) => {
  const ts = new Date(dateValue).getTime();
  return Number.isFinite(ts) ? ts : null;
};

const normalizeText = (value) => String(value || '').toLowerCase();

const inferMuscles = (exercise, exerciseMap) => {
  const dbExercise = exercise?.exerciseId != null ? exerciseMap.get(exercise.exerciseId) : null;
  const fromDb = Array.isArray(dbExercise?.muscles) ? dbExercise.muscles : [];
  const fromWorkout = Array.isArray(exercise?.targetMuscles) ? exercise.targetMuscles : [];
  const fallback = mapCategoryToMuscles(exercise?.category);
  return (fromDb.length ? fromDb : (fromWorkout.length ? fromWorkout : fallback)).map(normalizeText);
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

const classifySetContributions = (exercise, workSetCount, muscles) => {
  const name = normalizeText(exercise?.name);
  const category = normalizeText(exercise?.category);
  const contains = (terms) => terms.some(term => muscles.includes(term) || name.includes(term) || category.includes(term));

  let push = 0;
  let pull = 0;
  if (contains(['chest', 'shoulders', 'triceps', 'push'])) push += workSetCount;
  if (contains(['back', 'biceps', 'pull', 'rear'])) pull += workSetCount;

  let chest = 0;
  let back = 0;
  if (contains(['chest', 'pec'])) chest += workSetCount;
  if (contains(['back', 'lat'])) back += workSetCount;

  let quads = 0;
  let hamstrings = 0;
  const quadHint = contains(['quad', 'squat', 'leg press', 'lunge', 'split squat', 'extension', 'hack']);
  const hamHint = contains(['ham', 'rdl', 'deadlift', 'curl', 'good morning', 'hip thrust', 'glute']);
  if (quadHint && hamHint) {
    quads += workSetCount * 0.5;
    hamstrings += workSetCount * 0.5;
  } else if (quadHint) {
    quads += workSetCount;
  } else if (hamHint) {
    hamstrings += workSetCount;
  }

  return { push, pull, chest, back, quads, hamstrings };
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

      const muscles = inferMuscles(exercise, exerciseMap);
      const values = classifySetContributions(exercise, workSetCount, muscles);

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
