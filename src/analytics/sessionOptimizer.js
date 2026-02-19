import { getSetTimeWeight, normalizeSetForStorage, resolveSetType } from '../domain/workoutExtensions';
import { getExerciseKey } from '../utils/workoutSelectors';

const DEFAULT_OPTIONS = {
  strategy: 'trim-sets-first',
  minWorkSetsPerExercise: 1,
  keepTopPriorityCount: 1,
  defaultSetSec: 150,
  defaultRestSec: 90
};

const getHistorySetDurationIndex = (history = [], options = {}) => {
  const defaultSetSec = options.defaultSetSec || 150;
  const index = new Map();

  for (let i = 0; i < history.length; i += 1) {
    const workout = history[i];
    const durationMin = Number(workout?.duration) || 0;
    if (durationMin <= 0) continue;

    let totalWorkSets = 0;
    const exercises = workout?.exercises || [];
    for (let j = 0; j < exercises.length; j += 1) {
      const sets = exercises[j]?.sets || [];
      for (let k = 0; k < sets.length; k += 1) {
        if ((sets[k]?.completed || false) && resolveSetType(sets[k]) !== 'warmup') totalWorkSets += 1;
      }
    }
    if (totalWorkSets === 0) continue;

    const secPerSetInWorkout = (durationMin * 60) / totalWorkSets;
    for (let j = 0; j < exercises.length; j += 1) {
      const exercise = exercises[j];
      const key = getExerciseKey(exercise);
      const sets = exercise?.sets || [];
      let exerciseWorkSets = 0;
      for (let k = 0; k < sets.length; k += 1) {
        if ((sets[k]?.completed || false) && resolveSetType(sets[k]) !== 'warmup') exerciseWorkSets += 1;
      }
      if (exerciseWorkSets === 0) continue;

      if (!index.has(key)) {
        index.set(key, { totalSec: 0, totalSets: 0 });
      }
      const entry = index.get(key);
      entry.totalSec += secPerSetInWorkout * exerciseWorkSets;
      entry.totalSets += exerciseWorkSets;
    }
  }

  const normalized = new Map();
  index.forEach((value, key) => {
    normalized.set(key, value.totalSets > 0 ? (value.totalSec / value.totalSets) : defaultSetSec);
  });
  return normalized;
};

const getEstimatedSetSeconds = (set, exercise, timingIndex, options) => {
  const key = getExerciseKey(exercise);
  const baseSec = timingIndex.get(key) || exercise?.estimatedSetSec || options.defaultSetSec;
  const setType = resolveSetType(set);
  const weightedSetSec = baseSec * getSetTimeWeight(setType);
  const restSec = setType === 'warmup' ? Math.round(options.defaultRestSec * 0.5) : options.defaultRestSec;
  return weightedSetSec + restSec;
};

const cloneTemplate = (template = {}) => {
  return {
    ...template,
    exercises: (template.exercises || []).map(exercise => ({
      ...exercise,
      sets: (exercise.sets || []).map(set => normalizeSetForStorage({ ...set, completed: false }))
    }))
  };
};

export const optimizeSession = (template, timeLimit, history = [], options = {}) => {
  const settings = { ...DEFAULT_OPTIONS, ...options };
  const timeLimitMin = Number(timeLimit) || 0;
  const baseTemplate = cloneTemplate(template);
  const exercises = baseTemplate.exercises || [];

  if (!timeLimitMin || exercises.length === 0) {
    return {
      optimizedTemplate: baseTemplate,
      estimatedMinutesBefore: 0,
      estimatedMinutesAfter: 0,
      removed: [],
      preservedCore: []
    };
  }

  const timingIndex = getHistorySetDurationIndex(history, settings);
  const metaByExercise = new Map();
  const workSetCounts = [];
  const preservedCore = [];

  const sortedByPriority = [...exercises].sort((a, b) => {
    const pa = Number(a?.priority) || 3;
    const pb = Number(b?.priority) || 3;
    return pa - pb;
  });
  for (let i = 0; i < sortedByPriority.length; i += 1) {
    const exercise = sortedByPriority[i];
    if (exercise?.nonNegotiable || i < settings.keepTopPriorityCount) {
      preservedCore.push(exercise.name || `Exercise ${i + 1}`);
    }
  }

  let totalSeconds = 0;
  const removableCandidates = [];

  for (let exIndex = 0; exIndex < exercises.length; exIndex += 1) {
    const exercise = exercises[exIndex];
    const sets = exercise.sets || [];
    const priority = Number(exercise?.priority) || 3;
    const nonNegotiable = Boolean(exercise?.nonNegotiable);
    const exerciseMeta = [];

    let workSetCount = 0;
    for (let setIndex = 0; setIndex < sets.length; setIndex += 1) {
      const normalizedSet = normalizeSetForStorage(sets[setIndex]);
      const setKey = `${exIndex}:${setIndex}`;
      const setSec = getEstimatedSetSeconds(normalizedSet, exercise, timingIndex, settings);
      totalSeconds += setSec;
      const setType = resolveSetType(normalizedSet);
      if (setType !== 'warmup') workSetCount += 1;

      exerciseMeta.push({ exIndex, setIndex, setKey, setSec, setType, priority, nonNegotiable });
    }
    metaByExercise.set(exIndex, exerciseMeta);
    workSetCounts[exIndex] = workSetCount;

    for (let setIndex = exerciseMeta.length - 1; setIndex >= 0; setIndex -= 1) {
      const meta = exerciseMeta[setIndex];
      removableCandidates.push({
        ...meta,
        minWorkSetsPerExercise: settings.minWorkSetsPerExercise,
        exerciseName: exercise.name || `Exercise ${exIndex + 1}`
      });
    }
  }

  const estimatedMinutesBefore = Math.round(totalSeconds / 60);
  if (estimatedMinutesBefore <= timeLimitMin) {
    return {
      optimizedTemplate: baseTemplate,
      estimatedMinutesBefore,
      estimatedMinutesAfter: estimatedMinutesBefore,
      removed: [],
      preservedCore
    };
  }

  removableCandidates.sort((a, b) => {
    if (a.nonNegotiable !== b.nonNegotiable) return a.nonNegotiable ? 1 : -1;
    if (a.priority !== b.priority) return b.priority - a.priority; // remove low priority first
    if (a.setType !== b.setType) {
      if (a.setType === 'warmup') return -1;
      if (b.setType === 'warmup') return 1;
    }
    return b.setIndex - a.setIndex;
  });

  const removedByExercise = new Map();
  const removedSetKeys = new Set();

  for (let i = 0; i < removableCandidates.length; i += 1) {
    if (Math.round(totalSeconds / 60) <= timeLimitMin) break;
    const candidate = removableCandidates[i];
    if (candidate.nonNegotiable) continue;

    const exercise = exercises[candidate.exIndex];
    if (!exercise) continue;
    const set = exercise.sets[candidate.setIndex];
    if (!set) continue;
    if (removedSetKeys.has(candidate.setKey)) continue;

    const setType = resolveSetType(set);
    if (setType !== 'warmup') {
      const currentWorkSets = workSetCounts[candidate.exIndex] || 0;
      if (currentWorkSets <= candidate.minWorkSetsPerExercise) continue;
      workSetCounts[candidate.exIndex] = currentWorkSets - 1;
    }

    removedSetKeys.add(candidate.setKey);
    totalSeconds -= candidate.setSec;
    removedByExercise.set(
      candidate.exerciseName,
      (removedByExercise.get(candidate.exerciseName) || 0) + 1
    );
  }

  const optimizedExercises = exercises.map((exercise, exIndex) => {
    const meta = metaByExercise.get(exIndex) || [];
    const filteredSets = [];
    for (let setIndex = 0; setIndex < meta.length; setIndex += 1) {
      if (removedSetKeys.has(meta[setIndex].setKey)) continue;
      filteredSets.push(normalizeSetForStorage(exercise.sets[setIndex]));
    }

    return { ...exercise, sets: filteredSets };
  });

  const optimizedTemplate = {
    ...baseTemplate,
    exercises: optimizedExercises
  };

  const removed = Array.from(removedByExercise.entries()).map(([exerciseName, setsRemoved]) => ({
    exerciseName,
    setsRemoved
  }));

  return {
    optimizedTemplate,
    estimatedMinutesBefore,
    estimatedMinutesAfter: Math.max(0, Math.round(totalSeconds / 60)),
    removed,
    preservedCore
  };
};
