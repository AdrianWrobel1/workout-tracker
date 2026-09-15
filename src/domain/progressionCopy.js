/**
 * Progression copy — recommendation language, never authority language.
 *
 * The engine speaks in stable reason codes + why templates; this module
 * owns the human-readable English rendering. UI must use this (or its own
 * translations of these templates), never invent prescription wording.
 */
import { REASON_CODES } from './progression';

export const WHY_TEMPLATES = [
  'NO_PRIOR_SESSIONS',
  'PROGRESSION_DISABLED',
  'TARGET_REPS_ACHIEVED',
  'RANGE_TOP_COMPLETED',
  'BELOW_TARGET',
  'TARGET_NOT_SET',
  'STALL_DETECTED',
  'DELOAD_APPLIED',
  'INVALID_POLICY',
  'REP_LADDER_ADVANCED',
  'REP_LADDER_MAXED'
];

const fmtKg = (v) => (v === null || v === undefined ? '–' : `${v}`);

export const formatProgressionWhy = (result) => {
  const template = result?.why?.template;
  const args = result?.why?.args || {};
  switch (template) {
    case 'NO_PRIOR_SESSIONS':
      return 'No prior sessions for this exercise yet.';
    case 'PROGRESSION_DISABLED':
      return 'Progression is turned off for this exercise.';
    case 'TARGET_REPS_ACHIEVED':
      return `Target reached (${fmtKg(args.weight)} kg × ${args.reps}). Recommended: ${fmtKg(args.nextWeight)} kg.`;
    case 'RANGE_TOP_COMPLETED':
      return `All work sets reached the top of the range (${fmtKg(args.weight)} kg × ${args.maxReps}). Recommended: ${fmtKg(args.nextWeight)} kg × range bottom.`;
    case 'BELOW_TARGET':
      return 'Target not met yet. Recommended: hold the current prescription.';
    case 'TARGET_NOT_SET':
      return 'No target configured. Recommended: hold the last performed load.';
    case 'STALL_DETECTED':
      return `No improvement for ${args.stallCount} sessions (threshold ${args.threshold}). Recommended: hold at ${fmtKg(args.weight)} kg.`;
    case 'DELOAD_APPLIED':
      return `Deload: ${fmtKg(args.fromWeight)} kg → ${fmtKg(args.toWeight)} kg.`;
    case 'REP_LADDER_ADVANCED':
      return `Rung completed at ${fmtKg(args.weight)} kg. Recommended: ${args.toReps} reps.`;
    case 'REP_LADDER_MAXED':
      return args.restartReps !== undefined
        ? `Top of the rep ladder reached. Recommended: restart at ${args.restartReps} reps.`
        : 'Top of the rep ladder reached. Recommended: hold.';
    case 'INVALID_POLICY':
      return 'No recommendation available.';
    default:
      return 'No recommendation available.';
  }
};

export const formatPrescription = (prescription) => {
  if (!prescription || prescription.weight === null || prescription.weight === undefined) return null;
  const reps = prescription.repsMin === prescription.repsMax
    ? `${prescription.repsMin ?? '–'}`
    : `${prescription.repsMin ?? '–'}–${prescription.repsMax ?? '–'}`;
  return `${prescription.weight} kg × ${reps}`;
};

export { REASON_CODES };
