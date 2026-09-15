/**
 * Progression adapter — ONE final recommendation, never two engines.
 *
 * Precedence (single chain — callers MUST NOT re-implement it):
 *   explicit plan values on sets (template/block start) — never overwritten
 *     (UI concern: hints fill empty sets only, never replace user input)
 *   > templatePrevious memory (per-template last completed sets, when passed)
 *   > enabled progression policy (canonical engine)
 *   > legacy historical suggestion (suggestNextWeight ramp / last values)
 *   > no recommendation (null)
 *
 * PRODUCT NOTE (open question, preserved from audited behavior): the two
 * historical callers diverged — handleSelectExercise skipped the engine when
 * templatePrevious existed (template memory wins), while handleReplaceExercise
 * preferred the engine hint even with template memory present. This adapter
 * implements the DOCUMENTED order (templatePrevious > progression) so both
 * paths now resolve identically. If product later decides progression should
 * outrank template memory, change it HERE once — never in callers.
 *
 * Manual user input always wins for ACTUAL performance: the adapter only
 * produces hint values + display data, and [Use] fills empty sets only.
 * Never throws; worst case is null (UI renders nothing).
 */
import { getLastCompletedSets, suggestNextWeight } from './exercises';
import { getNextPrescription, selectProgressionHistory } from './progression';
import { formatProgressionWhy, formatPrescription } from './progressionCopy';

const DISPLAYABLE_STATES = new Set(['UP', 'REP_UP', 'HOLD', 'STALL', 'DELOAD', 'NO_HISTORY']);

const toHints = (prescription) => {
  if (!prescription) return { suggestedKg: 0, suggestedReps: 0 };
  return {
    suggestedKg: Number(prescription.weight) || 0,
    suggestedReps: Number(prescription.repsMin) || 0
  };
};

/**
 * Normalize the per-template memory input into [{kg,reps}].
 * Accepts the stored shape {sets:[...], lastDate} or a bare sets array.
 * Malformed entries are dropped; never throws.
 */
const normalizeTemplatePreviousSets = (input) => {
  try {
    const raw = Array.isArray(input) ? input : input?.sets;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((s) => ({ kg: Number(s?.kg) || 0, reps: Number(s?.reps) || 0 }))
      .filter((s) => s.kg > 0 || s.reps > 0);
  } catch {
    return [];
  }
};

/**
 * Template-memory suggestion: same ramp/last-value semantics as legacy, but
 * sourced from the per-template memory instead of global history. Advisory
 * hints only — explicit [Use] behavior unchanged.
 */
const templateMemoryRecommendation = (memSets) => {
  const suggested = suggestNextWeight(memSets);
  if (suggested) {
    return {
      source: 'template-memory',
      suggestedKg: Number(suggested.suggestedKg) || 0,
      suggestedReps: Number(suggested.suggestedReps) || 0,
      state: 'HOLD',
      reasonCode: 'HOLD',
      whyText: 'Based on your last session with this template.',
      prescription: null,
      result: null
    };
  }
  const last = memSets[memSets.length - 1];
  return {
    source: 'template-memory',
    suggestedKg: Number(last.kg) || 0,
    suggestedReps: Number(last.reps) || 0,
    state: 'HOLD',
    reasonCode: 'HOLD',
    whyText: 'Based on your last session with this template.',
    prescription: null,
    result: null
  };
};

const legacyRecommendation = (exerciseId, workouts, templatePreviousSets = null) => {
  // Template memory outranks global history when explicitly provided.
  const memSets = normalizeTemplatePreviousSets(templatePreviousSets);
  if (memSets.length > 0) {
    return templateMemoryRecommendation(memSets);
  }
  const lastSets = getLastCompletedSets(exerciseId, workouts);
  if (lastSets.length === 0) return null;
  const suggested = suggestNextWeight(lastSets);
  if (suggested) {
    return {
      source: 'legacy',
      suggestedKg: Number(suggested.suggestedKg) || 0,
      suggestedReps: Number(suggested.suggestedReps) || 0,
      state: 'HOLD',
      reasonCode: 'HOLD',
      whyText: 'Based on your last session.',
      prescription: null,
      result: null
    };
  }
  const last = lastSets[lastSets.length - 1];
  return {
    source: 'legacy-memory',
    suggestedKg: Number(last.kg) || 0,
    suggestedReps: Number(last.reps) || 0,
    state: 'HOLD',
    reasonCode: 'HOLD',
    whyText: 'Based on your last session.',
    prescription: null,
    result: null
  };
};

/**
 * Resolve the single recommendation for an exercise.
 * { exercise: DB record (id, progression?, usesBodyweight?), workouts, plan?,
 *   templatePrevious?: {sets:[{kg,reps}]} | [{kg,reps}] (per-template memory) }
 *
 * Single precedence chain: templatePrevious > progression > legacy > null.
 * Callers pass templatePrevious INSTEAD of branching around the adapter.
 */
export const resolveRecommendation = ({ exercise, workouts = [], plan = null, templatePrevious = null } = {}) => {
  try {
    const exerciseId = exercise?.id ?? exercise?.exerciseId ?? null;
    if (exerciseId === null || exerciseId === undefined) return null;
    const templateSets = normalizeTemplatePreviousSets(templatePrevious);
    const hasTemplateMemory = templateSets.length > 0;
    const mode = exercise?.progression?.mode;
    if (!mode || mode === 'off') {
      return legacyRecommendation(exerciseId, workouts, hasTemplateMemory ? templateSets : null);
    }
    // Documented precedence: per-template memory outranks the engine.
    if (hasTemplateMemory) {
      return templateMemoryRecommendation(templateSets);
    }
    // Canonical engine path. History comes from persisted actuals only —
    // the active (incomplete) workout is never evidence.
    const history = selectProgressionHistory(exerciseId, workouts);
    const result = getNextPrescription({
      policy: exercise.progression,
      history,
      plan,
      usesBodyweight: exercise?.usesBodyweight === true
    });
    if (!DISPLAYABLE_STATES.has(result.state) || !result.prescription) {
      return legacyRecommendation(exerciseId, workouts);
    }
    const hints = toHints(result.prescription);
    return {
      source: 'progression',
      suggestedKg: hints.suggestedKg,
      suggestedReps: hints.suggestedReps,
      state: result.state,
      reasonCode: result.reasonCode,
      whyText: formatProgressionWhy(result),
      prescriptionText: formatPrescription(result.prescription),
      prescription: result.prescription,
      evidence: result.evidence,
      confidence: result.confidence,
      result
    };
  } catch {
    return null;
  }
};
