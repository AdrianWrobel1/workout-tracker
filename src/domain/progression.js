/**
 * Progression Engine V1 — canonical, deterministic NEXT PRESCRIPTION.
 *
 * Pure domain module: plain serializable input in, plain serializable
 * result out. No React, no IndexedDB, no storage, no mutation, no throws.
 *
 * Concepts (kept deliberately distinct):
 *   PLAN           = what the template/block explicitly asks for (input only)
 *   RECOMMENDATION = what this engine suggests (output prescription)
 *   ACTUAL         = what the user performed (history input, never rewritten)
 *
 * Evidence rules (explicit, no magic):
 *   - same exercise history, completed work sets only (isWorkSet);
 *     warmups, incomplete sets and malformed records are never evidence.
 *   - success is judged on the most recent session; stall is counted over
 *     consecutive unsuccessful sessions at the same load (newest first).
 *   - a session that improves best-set-volume does not extend a stall streak.
 *   - a weight change starts a new progression attempt (breaks the streak).
 *   - one poor session can only HOLD, never stall, deload or drop load.
 */
import { isWarmupSet } from './workoutExtensions';

export const PROGRESSION_MODES = ['off', 'linear', 'double', 'reps', 'deload'];
export const PROGRESSION_STATES = ['NO_HISTORY', 'OFF', 'HOLD', 'UP', 'REP_UP', 'STALL', 'DELOAD'];
export const REASON_CODES = [
  'NO_HISTORY',
  'PROGRESSION_OFF',
  'TARGET_NOT_MET',
  'TARGET_MET',
  'TOP_OF_RANGE',
  'HOLD',
  'STALL',
  'DELOAD',
  'INVALID_INPUT',
  'MANUAL_OVERRIDE' // UI-side code: emitted when the user overrides a recommendation, never by the engine
];

/** Single home for every progression constant (nothing scattered in UI). */
export const DEFAULT_INCREMENT_KG = 2.5;
export const DEFAULT_STALL_THRESHOLD = 3;
export const DEFAULT_DELOAD_FACTOR = 0.9;
export const HISTORY_WINDOW = 6;
export const DEFAULT_REP_STEP = 1;

const round2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
const finiteNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

const validIncrement = (v) => {
  const n = finiteNum(v);
  return n !== null && n > 0 && n <= 50 ? n : null;
};

/** Canonical increment resolver: explicit policy value → safe default. */
export const resolveIncrementKg = (policy = {}) =>
  validIncrement(policy?.incrementKg) ?? DEFAULT_INCREMENT_KG;

/** Read a plan-style rep-range string ('8-12', '5') without inventing targets. */
export const parseRepRange = (value) => {
  if (typeof value !== 'string') return null;
  const range = value.match(/^\s*(\d+)\s*[-–]\s*(\d+)\s*$/);
  if (range) {
    const repMin = Number(range[1]);
    const repMax = Number(range[2]);
    if (repMin >= 1 && repMax >= repMin) return { repMin, repMax };
    return null;
  }
  const single = value.match(/^\s*(\d+)\s*$/);
  if (single && Number(single[1]) >= 1) return { repMin: Number(single[1]), repMax: Number(single[1]) };
  return null;
};

const validRepBound = (v) => {
  const n = finiteNum(v);
  if (n === null || n < 1 || n > 100) return null;
  return Math.trunc(n);
};

/**
 * Validate + normalize an optional `progression` exercise-config object.
 * Valid config → new exercise object carrying it; absent/malformed →
 * object WITHOUT the property (global OFF / legacy behavior preserved).
 * Pure: never mutates the input.
 */
export const sanitizeProgressionForStorage = (exercise) => {
  if (!exercise || typeof exercise !== 'object') return exercise;
  const raw = exercise.progression;
  if (raw === undefined || raw === null) {
    if (!('progression' in exercise)) return exercise;
    const { progression: _dropped, ...rest } = exercise;
    return rest;
  }
  if (typeof raw !== 'object' || !PROGRESSION_MODES.includes(raw.mode)) {
    if (!('progression' in exercise)) return exercise;
    const { progression: _dropped, ...rest } = exercise;
    return rest;
  }
  const clean = { mode: raw.mode };
  const repMin = validRepBound(raw.repMin);
  const repMax = validRepBound(raw.repMax);
  if (repMin !== null) clean.repMin = repMin;
  if (repMax !== null) clean.repMax = repMax;
  const targetReps = validRepBound(raw.targetReps);
  if (targetReps !== null) clean.targetReps = targetReps;
  const targetWeight = finiteNum(raw.targetWeight);
  if (targetWeight !== null && targetWeight >= 0 && targetWeight <= 1000) clean.targetWeight = round2(targetWeight);
  const incrementKg = validIncrement(raw.incrementKg);
  if (incrementKg !== null) clean.incrementKg = incrementKg;
  const repStep = validRepBound(raw.repStep);
  if (repStep !== null && repStep <= 10) clean.repStep = repStep;
  const targetSets = validRepBound(raw.targetSets);
  if (targetSets !== null && targetSets <= 20) clean.targetSets = targetSets;
  const stallThreshold = validRepBound(raw.stallThreshold);
  if (stallThreshold !== null && stallThreshold >= 2 && stallThreshold <= 10) clean.stallThreshold = stallThreshold;
  const deloadFactor = finiteNum(raw.deloadFactor);
  if (deloadFactor !== null && deloadFactor >= 0.5 && deloadFactor < 1) clean.deloadFactor = deloadFactor;
  if (raw.deloadAfterStall === true) clean.deloadAfterStall = true;
  if (raw.resetToMin === true) clean.resetToMin = true;
  return { ...exercise, progression: clean };
};

/**
 * Build engine-ready history for one exercise from persisted workouts:
 * same exerciseId, sessions with completed sets, oldest first, capped to
 * the most recent HISTORY_WINDOW sessions. Incomplete sessions carry no
 * evidence and are skipped. Pure: returns new objects, input untouched.
 */
export const selectProgressionHistory = (exerciseId, workouts = [], window = HISTORY_WINDOW) => {
  if (exerciseId === undefined || exerciseId === null || !Array.isArray(workouts)) return [];
  const sessions = [];
  for (const w of workouts) {
    if (!w || !Array.isArray(w.exercises)) continue;
    const entry = w.exercises.find((e) => e && e.exerciseId === exerciseId);
    if (!entry || !Array.isArray(entry.sets)) continue;
    const sets = entry.sets
      .filter((s) => s && s.completed === true && !isWarmupSet(s))
      .map((s) => ({ kg: Number(s.kg) || 0, reps: Number(s.reps) || 0, completed: true }))
      .filter((s) => Number.isFinite(s.kg) && s.kg >= 0 && Number.isFinite(s.reps) && s.reps >= 1);
    if (sets.length === 0) continue;
    sessions.push({ date: w.date, sets });
  }
  sessions.sort((a, b) => new Date(a.date) - new Date(b.date));
  return sessions.slice(-Math.max(1, window));
};

const isValidDate = (d) => {
  const t = new Date(d).getTime();
  return Number.isFinite(t);
};

/** Completed work sets with finite load; malformed records are dropped. */
const validEvidenceSets = (sets) => {
  if (!Array.isArray(sets)) return [];
  return sets.filter((s) => {
    if (!s || s.completed !== true || isWarmupSet(s)) return false;
    const kg = Number(s.kg);
    const reps = Number(s.reps);
    return Number.isFinite(kg) && kg >= 0 && Number.isFinite(reps) && reps >= 1;
  }).map((s) => ({ kg: Number(s.kg), reps: Number(s.reps) }));
};

const modalOf = (values) => {
  const counts = new Map();
  for (const v of values) {
    const k = round2(v);
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  let best = null;
  let bestCount = -1;
  for (const [k, c] of counts) {
    if (c > bestCount || (c === bestCount && k > best)) {
      best = k;
      bestCount = c;
    }
  }
  return best;
};

const sessionEvidence = (session) => {
  const sets = validEvidenceSets(session?.sets);
  if (sets.length === 0) return null;
  const weights = sets.map((s) => s.kg);
  const reps = sets.map((s) => s.reps);
  const bestVolume = Math.max(...sets.map((s) => s.kg * s.reps));
  const rirs = (session.sets || [])
    .map((s) => Number(s?.rir))
    .filter((r) => Number.isFinite(r) && r >= 0 && r <= 10);
  return {
    count: sets.length,
    weights,
    reps,
    modalWeight: modalOf(weights),
    maxWeight: Math.max(...weights.map(round2)),
    minWeight: Math.min(...weights.map(round2)),
    minReps: Math.min(...reps),
    maxReps: Math.max(...reps),
    bestVolume: round2(bestVolume),
    avgRir: rirs.length ? round2(rirs.reduce((a, b) => a + b, 0) / rirs.length) : null
  };
};

const emptyEvidence = () => ({
  sessionsConsidered: 0,
  sessionsSkipped: 0,
  lastSessionDate: null,
  stallCount: 0,
  anchorWeight: null,
  lastModalWeight: null,
  improvement: false,
  avgRir: null
});

const invalidResult = () => ({
  policy: null,
  state: 'INVALID_INPUT',
  prescription: null,
  reasonCode: 'INVALID_INPUT',
  why: { template: 'INVALID_POLICY', args: {} },
  evidence: emptyEvidence(),
  confidence: 'NONE'
});

const confidenceFor = (considered) => {
  if (considered <= 0) return 'NONE';
  if (considered === 1) return 'LIMITED';
  if (considered <= 3) return 'NORMAL';
  return 'STRONG';
};

const planMirror = (plan) => {
  if (!plan || typeof plan !== 'object') return null;
  const weight = finiteNum(plan.weight);
  const repMin = validRepBound(plan.repMin);
  const repMax = validRepBound(plan.repMax);
  const sets = validRepBound(plan.sets);
  if (weight === null && repMin === null && repMax === null && sets === null) return null;
  return {
    weight: weight !== null && weight >= 0 ? round2(weight) : null,
    repsMin: repMin,
    repsMax: repMax ?? repMin,
    sets
  };
};

/** Strictly-lighter deload load: factor first, step fallback, floored at 0. */
const deloadWeight = (refWeight, factor, incrementKg) => {
  const ref = Math.max(0, round2(refWeight));
  let next = round2(ref * factor);
  if (next >= ref) next = round2(ref - Math.max(0.5, incrementKg));
  return Math.max(0, next);
};

/**
 * getNextPrescription(input) — the single authoritative progression decision.
 * Never throws; worst case is an INVALID_INPUT / NO_HISTORY / OFF result.
 */
export const getNextPrescription = (input) => {
  try {
    const policy = input?.policy;
    const plan = input?.plan && typeof input.plan === 'object' ? input.plan : null;
    if (!policy || typeof policy !== 'object' || !PROGRESSION_MODES.includes(policy.mode)) {
      return invalidResult();
    }
    if (input?.history !== undefined && !Array.isArray(input.history)) return invalidResult();

    if (policy.mode === 'off') {
      return {
        policy: 'off',
        state: 'OFF',
        prescription: planMirror(plan),
        reasonCode: 'PROGRESSION_OFF',
        why: { template: 'PROGRESSION_DISABLED', args: { mode: 'off' } },
        evidence: emptyEvidence(),
        confidence: 'NONE'
      };
    }

    const rawHistory = Array.isArray(input.history) ? input.history : [];
    const sessions = [];
    let skipped = 0;
    for (const s of rawHistory) {
      if (!s || !isValidDate(s?.date)) {
        skipped += 1;
        continue;
      }
      const ev = sessionEvidence(s);
      if (!ev) {
        skipped += 1;
        continue;
      }
      sessions.push({ date: s.date, evidence: ev });
    }
    sessions.sort((a, b) => new Date(a.date) - new Date(b.date));
    const windowed = sessions.slice(-HISTORY_WINDOW);

    if (windowed.length === 0) {
      return {
        policy: policy.mode,
        state: 'NO_HISTORY',
        prescription: planMirror(plan),
        reasonCode: 'NO_HISTORY',
        why: { template: 'NO_PRIOR_SESSIONS', args: {} },
        evidence: { ...emptyEvidence(), sessionsSkipped: skipped },
        confidence: 'NONE'
      };
    }

    const last = windowed[windowed.length - 1];
    const prev = windowed.length > 1 ? windowed[windowed.length - 2] : null;
    const planWeight = finiteNum(plan?.weight);
    const targetWeight = finiteNum(policy.targetWeight);
    const anchorWeight =
      targetWeight !== null && targetWeight >= 0
        ? round2(targetWeight)
        : planWeight !== null && planWeight >= 0
          ? round2(planWeight)
          : prev
            ? prev.evidence.modalWeight
            : last.evidence.modalWeight;
    const incrementKg = resolveIncrementKg(policy);
    const stallThreshold =
      Number.isInteger(policy.stallThreshold) && policy.stallThreshold >= 2 && policy.stallThreshold <= 10
        ? policy.stallThreshold
        : DEFAULT_STALL_THRESHOLD;
    const setCount = validRepBound(policy.targetSets) ?? validRepBound(plan?.sets) ?? last.evidence.count;

    const baseEvidence = {
      sessionsConsidered: windowed.length,
      sessionsSkipped: skipped + (sessions.length - windowed.length),
      lastSessionDate: last.date,
      stallCount: 0,
      anchorWeight,
      lastModalWeight: last.evidence.modalWeight,
      improvement: prev ? last.evidence.bestVolume > prev.evidence.bestVolume : false,
      avgRir: last.evidence.avgRir
    };
    const confidence = confidenceFor(windowed.length);

    if (policy.mode === 'deload') {
      const factor =
        finiteNum(policy.deloadFactor) !== null && policy.deloadFactor >= 0.5 && policy.deloadFactor < 1
          ? policy.deloadFactor
          : DEFAULT_DELOAD_FACTOR;
      const fromWeight = targetWeight !== null && targetWeight >= 0
        ? round2(targetWeight)
        : planWeight !== null && planWeight >= 0
          ? round2(planWeight)
          : last.evidence.modalWeight;
      const weight = deloadWeight(fromWeight, factor, incrementKg);
      const reps = validRepBound(policy.repMin) ?? validRepBound(plan?.repMin) ?? validRepBound(plan?.repMax) ?? last.evidence.maxReps;
      return {
        policy: 'deload',
        state: 'DELOAD',
        prescription: { weight, repsMin: reps, repsMax: reps, sets: setCount },
        reasonCode: 'DELOAD',
        why: { template: 'DELOAD_APPLIED', args: { fromWeight, toWeight: weight, factor } },
        evidence: baseEvidence,
        confidence
      };
    }

    // Shared helpers for load-progressing policies (linear / double).
    const judgeSuccess = (isSuccess) => isSuccess;
    const countStall = (isUnsuccessful) => {
      let stall = 0;
      for (let i = windowed.length - 1; i >= 0; i -= 1) {
        const ev = windowed[i].evidence;
        if (ev.modalWeight !== anchorWeight) break; // new load = new attempt
        const ok = isUnsuccessful(ev) === false;
        if (ok) break;
        if (i > 0 && ev.bestVolume > windowed[i - 1].evidence.bestVolume) break; // still improving
        stall += 1;
      }
      return stall;
    };
    const maybeStallOrDeload = (holdPrescription, stallArgs) => {
      const stallCount = countStall(stallArgs.isUnsuccessful);
      const evidence = { ...baseEvidence, stallCount };
      if (stallCount >= stallThreshold) {
        if (policy.deloadAfterStall === true) {
          const factor =
            finiteNum(policy.deloadFactor) !== null && policy.deloadFactor >= 0.5 && policy.deloadFactor < 1
              ? policy.deloadFactor
              : DEFAULT_DELOAD_FACTOR;
          const weight = deloadWeight(holdPrescription.weight, factor, incrementKg);
          return {
            policy: policy.mode,
            state: 'DELOAD',
            prescription: { ...holdPrescription, weight },
            reasonCode: 'DELOAD',
            why: { template: 'DELOAD_APPLIED', args: { fromWeight: holdPrescription.weight, toWeight: weight, factor, stallCount } },
            evidence,
            confidence
          };
        }
        return {
          policy: policy.mode,
          state: 'STALL',
          prescription: holdPrescription,
          reasonCode: 'STALL',
          why: { template: 'STALL_DETECTED', args: { stallCount, threshold: stallThreshold, weight: holdPrescription.weight } },
          evidence,
          confidence
        };
      }
      return {
        policy: policy.mode,
        state: 'HOLD',
        prescription: holdPrescription,
        reasonCode: 'TARGET_NOT_MET',
        why: { template: 'BELOW_TARGET', args: stallArgs.whyArgs },
        evidence,
        confidence
      };
    };

    if (policy.mode === 'linear') {
      const targetReps = validRepBound(policy.targetReps) ?? validRepBound(plan?.repMax) ?? validRepBound(plan?.repMin);
      if (targetReps === null) {
        const holdPrescription = {
          weight: last.evidence.modalWeight,
          repsMin: last.evidence.maxReps,
          repsMax: last.evidence.maxReps,
          sets: setCount
        };
        return {
          policy: 'linear',
          state: 'HOLD',
          prescription: holdPrescription,
          reasonCode: 'TARGET_NOT_MET',
          why: { template: 'TARGET_NOT_SET', args: { weight: holdPrescription.weight } },
          evidence: { ...baseEvidence, stallCount: 0 },
          confidence
        };
      }
      const success =
        last.evidence.weights.every((w) => round2(w) >= anchorWeight) &&
        last.evidence.reps.every((r) => r >= targetReps);
      if (judgeSuccess(success)) {
        const weight = round2(Math.max(anchorWeight, last.evidence.maxWeight) + incrementKg);
        return {
          policy: 'linear',
          state: 'UP',
          prescription: { weight, repsMin: targetReps, repsMax: targetReps, sets: setCount },
          reasonCode: 'TARGET_MET',
          why: { template: 'TARGET_REPS_ACHIEVED', args: { weight: anchorWeight, reps: targetReps, nextWeight: weight } },
          evidence: { ...baseEvidence, stallCount: 0 },
          confidence
        };
      }
      const holdWeight = Math.max(anchorWeight, last.evidence.modalWeight);
      return maybeStallOrDeload(
        { weight: round2(holdWeight), repsMin: targetReps, repsMax: targetReps, sets: setCount },
        {
          isUnsuccessful: (ev) => !(ev.weights.every((w) => round2(w) >= anchorWeight) && ev.reps.every((r) => r >= targetReps)),
          whyArgs: { weight: round2(holdWeight), targetReps }
        }
      );
    }

    if (policy.mode === 'double') {
      const repMin = validRepBound(policy.repMin) ?? validRepBound(plan?.repMin);
      const repMax = validRepBound(policy.repMax) ?? validRepBound(plan?.repMax);
      if (repMin === null || repMax === null || repMax < repMin) {
        const holdPrescription = {
          weight: last.evidence.modalWeight,
          repsMin: last.evidence.maxReps,
          repsMax: last.evidence.maxReps,
          sets: setCount
        };
        return {
          policy: 'double',
          state: 'HOLD',
          prescription: holdPrescription,
          reasonCode: 'TARGET_NOT_MET',
          why: { template: 'TARGET_NOT_SET', args: { weight: holdPrescription.weight } },
          evidence: { ...baseEvidence, stallCount: 0 },
          confidence
        };
      }
      // Strict, documented success rule: EVERY completed work set reached
      // the top of the range at the reference load. Anything less holds the
      // range — adding load with submaximal sets left would push them
      // below the range floor.
      const success =
        last.evidence.weights.every((w) => round2(w) >= anchorWeight) &&
        last.evidence.reps.every((r) => r >= repMax);
      if (judgeSuccess(success)) {
        const weight = round2(Math.max(anchorWeight, last.evidence.maxWeight) + incrementKg);
        return {
          policy: 'double',
          state: 'UP',
          prescription: { weight, repsMin: repMin, repsMax: repMin, sets: setCount },
          reasonCode: 'TOP_OF_RANGE',
          why: { template: 'RANGE_TOP_COMPLETED', args: { weight: anchorWeight, maxReps: repMax, nextWeight: weight } },
          evidence: { ...baseEvidence, stallCount: 0 },
          confidence
        };
      }
      const holdWeight = Math.max(anchorWeight, last.evidence.modalWeight);
      return maybeStallOrDeload(
        { weight: round2(holdWeight), repsMin: repMin, repsMax: repMax, sets: setCount },
        {
          isUnsuccessful: (ev) => !(ev.weights.every((w) => round2(w) >= anchorWeight) && ev.reps.every((r) => r >= repMax)),
          whyArgs: { weight: round2(holdWeight), repMin, repMax }
        }
      );
    }

    if (policy.mode === 'reps') {
      const repMin = validRepBound(policy.repMin);
      const repMax = validRepBound(policy.repMax);
      if (repMin === null || repMax === null || repMax < repMin) return invalidResult();
      const step = validRepBound(policy.repStep) && policy.repStep <= 10 ? policy.repStep : DEFAULT_REP_STEP;
      const weight = last.evidence.modalWeight;
      const rung = Math.min(repMax, Math.max(repMin, last.evidence.minReps));
      const success = last.evidence.reps.every((r) => r >= rung);
      if (success && rung >= repMax) {
        if (policy.resetToMin === true) {
          return {
            policy: 'reps',
            state: 'REP_UP',
            prescription: { weight, repsMin: repMin, repsMax: repMin, sets: setCount },
            reasonCode: 'TOP_OF_RANGE',
            why: { template: 'REP_LADDER_MAXED', args: { weight, maxReps: repMax, restartReps: repMin } },
            evidence: { ...baseEvidence, stallCount: 0 },
            confidence
          };
        }
        return {
          policy: 'reps',
          state: 'HOLD',
          prescription: { weight, repsMin: repMax, repsMax: repMax, sets: setCount },
          reasonCode: 'TOP_OF_RANGE',
          why: { template: 'REP_LADDER_MAXED', args: { weight, maxReps: repMax } },
          evidence: { ...baseEvidence, stallCount: 0 },
          confidence
        };
      }
      if (success) {
        const next = Math.min(repMax, rung + step);
        return {
          policy: 'reps',
          state: 'REP_UP',
          prescription: { weight, repsMin: next, repsMax: next, sets: setCount },
          reasonCode: 'TARGET_MET',
          why: { template: 'REP_LADDER_ADVANCED', args: { weight, fromReps: rung, toReps: next } },
          evidence: { ...baseEvidence, stallCount: 0 },
          confidence
        };
      }
      const holdPrescription = { weight, repsMin: rung, repsMax: rung, sets: setCount };
      const stallCount = (() => {
        let stall = 0;
        for (let i = windowed.length - 1; i >= 0; i -= 1) {
          const ev = windowed[i].evidence;
          const r = Math.min(repMax, Math.max(repMin, ev.minReps));
          if (ev.reps.every((x) => x >= r)) break;
          if (i > 0 && ev.bestVolume > windowed[i - 1].evidence.bestVolume) break;
          stall += 1;
        }
        return stall;
      })();
      const evidence = { ...baseEvidence, stallCount };
      if (stallCount >= stallThreshold) {
        return {
          policy: 'reps',
          state: 'STALL',
          prescription: holdPrescription,
          reasonCode: 'STALL',
          why: { template: 'STALL_DETECTED', args: { stallCount, threshold: stallThreshold, weight } },
          evidence,
          confidence
        };
      }
      return {
        policy: 'reps',
        state: 'HOLD',
        prescription: holdPrescription,
        reasonCode: 'TARGET_NOT_MET',
        why: { template: 'BELOW_TARGET', args: { weight, rung } },
        evidence,
        confidence
      };
    }

    return invalidResult();
  } catch {
    return invalidResult();
  }
};
