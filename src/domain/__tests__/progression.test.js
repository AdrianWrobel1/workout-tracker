import { describe, it, expect } from 'vitest';
import {
  getNextPrescription,
  PROGRESSION_MODES,
  PROGRESSION_STATES,
  REASON_CODES,
  DEFAULT_INCREMENT_KG,
  DEFAULT_STALL_THRESHOLD,
  DEFAULT_DELOAD_FACTOR,
  HISTORY_WINDOW,
  resolveIncrementKg,
  parseRepRange,
  sanitizeProgressionForStorage,
  selectProgressionHistory
} from '../progression.js';

/**
 * PROGRESSION ENGINE V1 — test-first contract.
 *
 * Numbers mirror the mission's minimum suite (§20). The engine is pure:
 * plain serializable input in, plain serializable result out, no mutation.
 */

const set = (kg, reps, extra = {}) => ({ kg, reps, completed: true, setType: 'work', ...extra });
const S = (date, sets) => ({ date, sets });
const IN = (policy, history, extra = {}) => ({ policy, history, ...extra });
const LIN = (over = {}) => ({ mode: 'linear', targetReps: 5, incrementKg: 2.5, ...over });
const DBL = (over = {}) => ({ mode: 'double', repMin: 8, repMax: 12, incrementKg: 2.5, ...over });
const REP = (over = {}) => ({ mode: 'reps', repMin: 8, repMax: 12, repStep: 1, ...over });

const session100x5 = (date = '2026-01-08', reps = 5) =>
  S(date, [set(100, reps), set(100, reps), set(100, reps)]);

describe('GENERAL', () => {
  it('1. OFF returns no progression with explicit reason and legacy-compatible shape', () => {
    const r = getNextPrescription(IN({ mode: 'off' }, [session100x5()]));
    expect(r.policy).toBe('off');
    expect(r.state).toBe('OFF');
    expect(r.reasonCode).toBe('PROGRESSION_OFF');
    expect(r.confidence).toBe('NONE');
  });

  it('2. no history yields NO_HISTORY without manufacturing certainty', () => {
    const r = getNextPrescription(IN(LIN(), []));
    expect(r.state).toBe('NO_HISTORY');
    expect(r.reasonCode).toBe('NO_HISTORY');
    expect(r.prescription).toBeNull();
    expect(r.confidence).toBe('NONE');
  });

  it('3. invalid input degrades to INVALID_INPUT instead of crashing', () => {
    for (const bad of [
      null,
      undefined,
      {},
      { policy: null, history: [] },
      { policy: { mode: 'telepathy' }, history: [] },
      { policy: LIN(), history: null },
      { policy: LIN(), history: 'yesterday' }
    ]) {
      const r = getNextPrescription(bad);
      expect(r.state).toBe('INVALID_INPUT');
      expect(r.reasonCode).toBe('INVALID_INPUT');
    }
  });

  it('4. output is deterministic for identical input', () => {
    const input = IN(DBL(), [
      S('2026-01-01', [set(100, 8), set(100, 9)]),
      S('2026-01-08', [set(100, 10), set(100, 11)])
    ]);
    const a = getNextPrescription(input);
    const b = getNextPrescription(JSON.parse(JSON.stringify(input)));
    expect(a).toEqual(b);
  });

  it('5. input objects are never mutated (frozen input survives)', () => {
    const input = IN(LIN(), [session100x5()]);
    deepFreeze(input);
    const r = getNextPrescription(input);
    expect(r.state).toBe('UP');
    expect(input.history[0].sets[0]).toEqual({ kg: 100, reps: 5, completed: true, setType: 'work' });
  });
});

describe('LINEAR', () => {
  it('6. success (all work sets hit target) increases weight by the increment', () => {
    const r = getNextPrescription(IN(LIN(), [session100x5()]));
    expect(r.state).toBe('UP');
    expect(r.reasonCode).toBe('TARGET_MET');
    expect(r.prescription).toMatchObject({ weight: 102.5, repsMin: 5, repsMax: 5 });
  });

  it('7. failure holds the target instead of dropping weight', () => {
    const r = getNextPrescription(IN(LIN(), [session100x5('2026-01-08', 3)]));
    expect(r.state).toBe('HOLD');
    expect(r.reasonCode).toBe('TARGET_NOT_MET');
    expect(r.prescription).toMatchObject({ weight: 100, repsMin: 5, repsMax: 5 });
  });

  it('8. repeated failure below the stall threshold still holds (stallCount tracked)', () => {
    const r = getNextPrescription(IN(LIN(), [
      session100x5('2026-01-01', 3),
      session100x5('2026-01-08', 3)
    ]));
    expect(r.state).toBe('HOLD');
    expect(r.evidence.stallCount).toBe(2);
  });

  it('9. increment comes from explicit config; malformed increment falls back to 2.5', () => {
    const custom = getNextPrescription(IN(LIN({ incrementKg: 5 }), [session100x5()]));
    expect(custom.prescription.weight).toBe(105);
    for (const bad of [0, -2.5, NaN, 'lots', null]) {
      const r = getNextPrescription(IN(LIN({ incrementKg: bad }), [session100x5()]));
      expect(r.prescription.weight).toBe(102.5);
    }
    expect(resolveIncrementKg({})).toBe(DEFAULT_INCREMENT_KG);
    expect(resolveIncrementKg({ incrementKg: 1.25 })).toBe(1.25);
  });

  it('10. explicit hold: a light session below target never lowers the prescription', () => {
    const r = getNextPrescription(IN(LIN({ targetWeight: 100 }), [
      S('2026-01-01', [set(100, 5), set(100, 5)]),
      S('2026-01-08', [set(80, 5), set(80, 5)])
    ]));
    expect(r.state).toBe('HOLD');
    expect(r.prescription.weight).toBe(100);
  });
});

describe('DOUBLE PROGRESSION (primary V1 model)', () => {
  it('11. below range holds without a weight increase', () => {
    const r = getNextPrescription(IN(DBL(), [S('2026-01-08', [set(100, 6), set(100, 7)])]));
    expect(r.state).toBe('HOLD');
    expect(r.prescription.weight).toBe(100);
    expect(r.reasonCode).toBe('TARGET_NOT_MET');
  });

  it('12. inside range holds at the same weight', () => {
    const r = getNextPrescription(IN(DBL(), [S('2026-01-08', [set(100, 8), set(100, 9), set(100, 10)])]));
    expect(r.state).toBe('HOLD');
    expect(r.prescription).toMatchObject({ weight: 100, repsMin: 8, repsMax: 12 });
  });

  it('13. top of range on every work set advances weight and resets reps to range bottom', () => {
    const r = getNextPrescription(IN(DBL(), [S('2026-01-08', [set(100, 12), set(100, 12), set(100, 12)])]));
    expect(r.state).toBe('UP');
    expect(r.reasonCode).toBe('TOP_OF_RANGE');
    expect(r.prescription).toMatchObject({ weight: 102.5, repsMin: 8, repsMax: 8 });
  });

  it('14. success rule is strict: one set short of max keeps HOLD', () => {
    const r = getNextPrescription(IN(DBL(), [S('2026-01-08', [set(100, 12), set(100, 12), set(100, 11)])]));
    expect(r.state).toBe('HOLD');
    expect(r.prescription.weight).toBe(100);
  });

  it('15. mixed-set performance below the range floor still holds (never drops)', () => {
    const r = getNextPrescription(IN(DBL(), [S('2026-01-08', [set(100, 12), set(100, 5)])]));
    expect(r.state).toBe('HOLD');
    expect(r.prescription.weight).toBe(100);
  });

  it('16. warmup sets are excluded from success evidence', () => {
    const r = getNextPrescription(IN(DBL(), [S('2026-01-08', [
      set(60, 5, { setType: 'warmup' }),
      set(100, 12), set(100, 12)
    ])]));
    expect(r.state).toBe('UP');
    expect(r.prescription.weight).toBe(102.5);
  });

  it('17. incomplete sets are excluded from success evidence', () => {
    const history = [{
      date: '2026-01-08',
      sets: [set(100, 12), set(100, 12), { kg: 100, reps: 2, completed: false, setType: 'work' }]
    }];
    const r = getNextPrescription(IN(DBL(), history));
    expect(r.state).toBe('UP');
  });

  it('18. next-weight reset lands exactly on range bottom with the configured increment', () => {
    const r = getNextPrescription(IN(DBL({ incrementKg: 5, repMin: 6, repMax: 10 }), [
      S('2026-01-08', [set(80, 10), set(80, 10)])
    ]));
    expect(r.prescription).toMatchObject({ weight: 85, repsMin: 6, repsMax: 6 });
  });

  it('19. multiple sessions anchor the reference weight from the previous session', () => {
    const r = getNextPrescription(IN(DBL(), [
      S('2026-01-01', [set(97.5, 12), set(97.5, 12)]),
      S('2026-01-08', [set(100, 9), set(100, 10)])
    ]));
    expect(r.state).toBe('HOLD');
    expect(r.prescription.weight).toBe(100);
    expect(r.evidence.sessionsConsidered).toBe(2);
  });

  it('20. edited history recomputes deterministically (no caching of past answers)', () => {
    const base = [S('2026-01-08', [set(100, 12), set(100, 11)])];
    expect(getNextPrescription(IN(DBL(), base)).state).toBe('HOLD');
    const edited = [S('2026-01-08', [set(100, 12), set(100, 12)])];
    const r = getNextPrescription(IN(DBL(), edited));
    expect(r.state).toBe('UP');
    expect(r.prescription.weight).toBe(102.5);
  });
});

describe('REP PROGRESSION', () => {
  it('21. all sets at the rung advance the ladder by the rep step', () => {
    const r = getNextPrescription(IN(REP(), [S('2026-01-08', [set(60, 8), set(60, 8)])]));
    expect(r.state).toBe('REP_UP');
    expect(r.prescription).toMatchObject({ weight: 60, repsMin: 9, repsMax: 9 });
  });

  it('22. max reps caps the ladder (no indefinite growth)', () => {
    const r = getNextPrescription(IN(REP(), [S('2026-01-08', [set(60, 12), set(60, 12)])]));
    expect(r.prescription.repsMax).toBe(12);
    expect(r.reasonCode).toBe('TOP_OF_RANGE');
  });

  it('23. reset behavior restarts at range bottom only when explicitly configured', () => {
    const hold = getNextPrescription(IN(REP(), [S('2026-01-08', [set(60, 12), set(60, 12)])]));
    expect(hold.prescription.repsMin).toBe(12);
    const restart = getNextPrescription(IN(REP({ resetToMin: true }), [S('2026-01-08', [set(60, 12), set(60, 12)])]));
    expect(restart.prescription).toMatchObject({ weight: 60, repsMin: 8, repsMax: 8 });
  });

  it('24. invalid range (max below min) is rejected, never executed', () => {
    const r = getNextPrescription(IN(REP({ repMin: 12, repMax: 8 }), [session100x5()]));
    expect(r.state).toBe('INVALID_INPUT');
  });
});

describe('STALL DETECTION', () => {
  const fail3 = (date) => S(date, [set(100, 3), set(100, 3)]);

  it('25. one bad session holds without any stall flag', () => {
    const r = getNextPrescription(IN(LIN(), [fail3('2026-01-08')]));
    expect(r.state).toBe('HOLD');
    expect(r.reasonCode).toBe('TARGET_NOT_MET');
    expect(r.evidence.stallCount).toBe(1);
  });

  it('26. repeated unsuccessful sessions at the same load constitute stall', () => {
    const r = getNextPrescription(IN(LIN(), [fail3('2026-01-01'), fail3('2026-01-08'), fail3('2026-01-15')]));
    expect(r.state).toBe('STALL');
    expect(r.reasonCode).toBe('STALL');
    expect(r.evidence.stallCount).toBe(3);
    expect(r.prescription.weight).toBe(100);
  });

  it('27. improvement resets the stall streak', () => {
    const r = getNextPrescription(IN(LIN(), [
      fail3('2026-01-01'),
      fail3('2026-01-08'),
      S('2026-01-15', [set(100, 4), set(100, 4)])
    ]));
    expect(r.state).toBe('HOLD');
    expect(r.evidence.stallCount).toBeLessThan(DEFAULT_STALL_THRESHOLD);
  });

  it('28. stall never triggers a deload unless explicitly enabled', () => {
    const r = getNextPrescription(IN(LIN(), [fail3('2026-01-01'), fail3('2026-01-08'), fail3('2026-01-15'), fail3('2026-01-22')]));
    expect(r.state).toBe('STALL');
    expect(r.prescription.weight).toBe(100);
  });
});

describe('DELOAD', () => {
  it('29. explicit deload reduces load by the configured factor', () => {
    const r = getNextPrescription(IN({ mode: 'deload', deloadFactor: 0.9, repMin: 8 }, [session100x5()]));
    expect(r.state).toBe('DELOAD');
    expect(r.reasonCode).toBe('DELOAD');
    expect(r.prescription.weight).toBe(90);
  });

  it('30. automatic deload fires only after the stall threshold when opted in', () => {
    const fail3 = (date) => S(date, [set(100, 3), set(100, 3)]);
    const policy = LIN({ deloadAfterStall: true });
    const r = getNextPrescription(IN(policy, [fail3('2026-01-01'), fail3('2026-01-08'), fail3('2026-01-15')]));
    expect(r.state).toBe('DELOAD');
    expect(r.prescription.weight).toBe(90);
  });

  it('31. one bad session never deloads', () => {
    const r = getNextPrescription(IN(LIN({ deloadAfterStall: true }), [S('2026-01-08', [set(100, 3), set(100, 3)])]));
    expect(['HOLD', 'STALL']).toContain(r.state);
    expect(r.prescription.weight).toBe(100);
  });

  it('32. deload output is always strictly lighter and never negative', () => {
    const tiny = getNextPrescription(IN({ mode: 'deload', deloadFactor: 0.9 }, [S('2026-01-08', [set(2.5, 5)])]));
    expect(tiny.prescription.weight).toBeLessThan(2.5);
    expect(tiny.prescription.weight).toBeGreaterThanOrEqual(0);
    const zero = getNextPrescription(IN({ mode: 'deload' }, [S('2026-01-08', [set(0, 10)])]));
    expect(zero.prescription.weight).toBe(0);
  });
});

describe('BODYWEIGHT', () => {
  it('33. missing bodyweight is never fabricated into the prescription', () => {
    const r = getNextPrescription(IN(LIN(), [session100x5()], { usesBodyweight: true }));
    expect(r.state).toBe('UP');
    expect(r.prescription.weight).toBe(102.5);
    expect(JSON.stringify(r)).not.toContain('bodyweightKg');
  });

  it('34. bodyweight exercises progress on logged external load only', () => {
    const r = getNextPrescription(IN(DBL(), [S('2026-01-08', [set(0, 12), set(0, 12)])], { usesBodyweight: true }));
    expect(r.state).toBe('UP');
    expect(r.prescription.weight).toBe(2.5);
  });

  it('35. weighted exercises are unaffected by the bodyweight flag', () => {
    const plain = getNextPrescription(IN(LIN(), [session100x5()]));
    const flagged = getNextPrescription(IN(LIN(), [session100x5()], { usesBodyweight: false }));
    expect(flagged).toEqual(plain);
  });
});

describe('RIR/RPE (secondary evidence only)', () => {
  it('36. absent RIR changes nothing', () => {
    const r = getNextPrescription(IN(LIN(), [session100x5()]));
    expect(r.state).toBe('UP');
    expect(r.evidence.avgRir).toBeNull();
  });

  it('37. valid RIR is recorded as evidence without driving the decision', () => {
    const withRir = S('2026-01-08', [set(100, 5, { rir: 2 }), set(100, 5, { rir: 1 })]);
    const r = getNextPrescription(IN(LIN(), [withRir]));
    expect(r.state).toBe('UP');
    expect(r.evidence.avgRir).toBeCloseTo(1.5);
  });

  it('38. extreme RIR values are ignored and never break the engine', () => {
    const wild = S('2026-01-08', [set(100, 5, { rir: -50 }), set(100, 5, { rir: 999 })]);
    const r = getNextPrescription(IN(LIN(), [wild]));
    expect(r.state).toBe('UP');
    expect(r.evidence.avgRir).toBeNull();
  });
});

describe('PRECEDENCE (engine side: plan as reference, actuals never rewritten)', () => {
  it('39. explicit plan weight anchors the prescription', () => {
    const r = getNextPrescription(IN(
      { mode: 'linear', targetReps: 5 },
      [S('2026-01-08', [set(100, 5), set(100, 5)])],
      { plan: { weight: 100, repMin: 5, repMax: 5, sets: 3 } }
    ));
    expect(r.state).toBe('UP');
    expect(r.prescription.weight).toBe(102.5);
  });

  it('40. template rep range drives double progression when policy omits it', () => {
    const r = getNextPrescription(IN(
      { mode: 'double', incrementKg: 2.5 },
      [S('2026-01-08', [set(100, 12), set(100, 12)])],
      { plan: { weight: 100, repMin: 8, repMax: 12, sets: 2 } }
    ));
    expect(r.state).toBe('UP');
    expect(r.prescription).toMatchObject({ weight: 102.5, repsMin: 8, repsMax: 8 });
  });

  it('41. progression applies from history when the plan permits (no explicit weight)', () => {
    const r = getNextPrescription(IN(
      { mode: 'double', repMin: 8, repMax: 12 },
      [S('2026-01-08', [set(100, 12), set(100, 12)])],
      { plan: { repMin: 8, repMax: 12, sets: 2 } }
    ));
    expect(r.prescription.weight).toBe(102.5);
  });

  it('42. manual actuals stay manual: history is echoed, never rewritten', () => {
    const history = [S('2026-01-08', [set(100, 12), set(100, 12)])];
    const before = JSON.parse(JSON.stringify(history));
    const r = getNextPrescription(IN(DBL(), history));
    expect(history).toEqual(before);
    expect(r.prescription.weight).toBe(102.5);
    expect(history[0].sets[0].kg).toBe(100);
  });
});

describe('LEGACY COMPATIBILITY', () => {
  it('43. exercise without a policy object is invalid input at engine level (adapter owns legacy)', () => {
    expect(getNextPrescription({ history: [session100x5()] }).state).toBe('INVALID_INPUT');
    expect(getNextPrescription(IN({}, [session100x5()])).state).toBe('INVALID_INPUT');
  });

  it('44. engine output never carries legacy suggestedKg/suggestedReps fields', () => {
    const r = getNextPrescription(IN(LIN(), [session100x5()]));
    expect(r).not.toHaveProperty('suggestedKg');
    expect(r).not.toHaveProperty('suggestedReps');
    expect(r.prescription).not.toHaveProperty('suggestedKg');
  });

  it('45. legacy-shaped history (with suggestedKg hints attached) does not disturb the engine', () => {
    const legacy = S('2026-01-08', [
      { kg: 100, reps: 5, completed: true, setType: 'work', suggestedKg: 60, suggestedReps: 8 }
    ]);
    const r = getNextPrescription(IN(LIN(), [legacy]));
    expect(r.state).toBe('UP');
    expect(r.prescription.weight).toBe(102.5);
  });
});

describe('EXPLANATION SYSTEM', () => {
  it('46. reason codes are a stable closed set', () => {
    expect([...REASON_CODES].sort()).toEqual([
      'DELOAD',
      'HOLD',
      'INVALID_INPUT',
      'MANUAL_OVERRIDE',
      'NO_HISTORY',
      'PROGRESSION_OFF',
      'STALL',
      'TARGET_MET',
      'TARGET_NOT_MET',
      'TOP_OF_RANGE'
    ].sort());
    expect(PROGRESSION_MODES).toEqual(['off', 'linear', 'double', 'reps', 'deload']);
  });

  it('47. why payload mirrors the result it explains', () => {
    const r = getNextPrescription(IN(DBL(), [S('2026-01-08', [set(100, 12), set(100, 12)])]));
    expect(r.why.template).toBe('RANGE_TOP_COMPLETED');
    expect(r.why.args).toMatchObject({ weight: 100, maxReps: 12 });
    expect(r.why.args.nextWeight).toBe(r.prescription.weight);
  });
});

describe('INVARIANTS', () => {
  it('48. weight is never negative', () => {
    const r = getNextPrescription(IN(LIN({ incrementKg: 2.5 }), [S('2026-01-08', [set(0, 5)])]));
    expect(r.prescription.weight).toBeGreaterThanOrEqual(0);
  });

  it('49. reps are never negative, zero, or fractional in prescriptions', () => {
    const results = [
      getNextPrescription(IN(LIN(), [session100x5()])),
      getNextPrescription(IN(DBL(), [S('2026-01-08', [set(100, 12), set(100, 12)])])),
      getNextPrescription(IN(REP(), [S('2026-01-08', [set(60, 8)])]))
    ];
    for (const r of results) {
      expect(Number.isInteger(r.prescription.repsMin)).toBe(true);
      expect(Number.isInteger(r.prescription.repsMax)).toBe(true);
      expect(r.prescription.repsMin).toBeGreaterThanOrEqual(1);
      expect(r.prescription.repsMax).toBeGreaterThanOrEqual(1);
    }
  });

  it('50. frozen input passes through untouched', () => {
    const input = IN(DBL(), [S('2026-01-08', [set(100, 12), set(100, 12)])]);
    deepFreeze(input);
    expect(() => getNextPrescription(input)).not.toThrow();
  });

  it('51. deterministic across key order and repeated calls', () => {
    const a = getNextPrescription({ history: [session100x5()], policy: LIN() });
    const b = getNextPrescription({ policy: LIN(), history: [session100x5()] });
    expect(a).toEqual(b);
  });

  it('52. hostile data cannot crash the engine', () => {
    const hostile = [
      { policy: LIN(), history: [{ date: 'not-a-date', sets: [{ kg: NaN, reps: Infinity, completed: true }] }] },
      { policy: DBL(), history: [{ date: '2026-01-08', sets: null }] },
      { policy: LIN(), history: [{ date: '2026-01-08' }] },
      { policy: LIN({ targetReps: -3 }), history: [session100x5()] },
      { policy: LIN(), history: [{ date: '2026-01-08', sets: [{ kg: 'heavy', reps: 'many', completed: true }] }] }
    ];
    for (const h of hostile) {
      const r = getNextPrescription(h);
      expect(PROGRESSION_STATES).toContain(r.state);
      expect(REASON_CODES).toContain(r.reasonCode);
    }
  });
});

describe('HELPERS', () => {
  it('parseRepRange reads plan strings without inventing targets', () => {
    expect(parseRepRange('8-12')).toEqual({ repMin: 8, repMax: 12 });
    expect(parseRepRange('5')).toEqual({ repMin: 5, repMax: 5 });
    expect(parseRepRange('')).toBeNull();
    expect(parseRepRange('heavy')).toBeNull();
    expect(parseRepRange(null)).toBeNull();
  });

  it('sanitizeProgressionForStorage keeps valid config and drops malformed parts', () => {
    const good = sanitizeProgressionForStorage({ id: 1, name: 'B', progression: { mode: 'double', repMin: 8, repMax: 12, incrementKg: 2.5 } });
    expect(good.progression).toMatchObject({ mode: 'double', repMin: 8, repMax: 12, incrementKg: 2.5 });
    const badMode = sanitizeProgressionForStorage({ id: 1, progression: { mode: 'beast' } });
    expect(badMode).not.toHaveProperty('progression');
    const absent = sanitizeProgressionForStorage({ id: 1, name: 'B' });
    expect(absent).not.toHaveProperty('progression');
    expect(absent.name).toBe('B');
  });

  it('selectProgressionHistory picks same-exercise completed sessions, oldest first, capped', () => {
    const workouts = [
      { id: 'w2', date: '2026-01-08', exercises: [{ exerciseId: 1, sets: [set(100, 5)] }] },
      { id: 'w1', date: '2026-01-01', exercises: [{ exerciseId: 1, sets: [set(90, 5)] }] },
      { id: 'w3', date: '2026-01-15', exercises: [{ exerciseId: 2, sets: [set(50, 10)] }] }
    ];
    const h = selectProgressionHistory(1, workouts);
    expect(h).toHaveLength(2);
    expect(h[0].date).toBe('2026-01-01');
    expect(h[1].date).toBe('2026-01-08');
    expect(workouts[0].id).toBe('w2');
  });
});

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}
