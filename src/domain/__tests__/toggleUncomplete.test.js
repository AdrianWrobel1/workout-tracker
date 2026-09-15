import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toggleSetCompletion, updateSetField } from '../workoutActions.js';
import { shouldAutoStartRest } from '../restTimer.js';
import { checkSetRecords } from '../exercises.js';
import { calculate1RM } from '../calculations.js';

/**
 * Regression coverage for: SET UN-COMPLETION DOES NOT COMMIT.
 *
 * Domain layer (`toggleSetCompletion`) was already correct; the production
 * defect was `App.jsx handleToggleSet` scoping `setActiveWorkout(...)`
 * inside the `if (set.completed)` branch so true->false never committed.
 *
 * - Tests A/B/E/F/G/H lock the canonical behavior contract.
 * - Tests C/D lock side-effect preservation (no rest, no PR on un-complete).
 * - Test Z guards the actual App.jsx commit scoping (fails on the bug).
 */

const makeWorkout = () => ({
  id: 'w1',
  name: 'Push',
  startTime: new Date('2026-01-01T10:00:00.000Z').toISOString(),
  exercises: [
    {
      exerciseId: 1,
      name: 'Bench',
      category: 'Chest',
      sets: [
        { kg: 100, reps: 5, completed: false, setType: 'work' },
        { kg: 100, reps: 5, completed: true, setType: 'work' }
      ]
    },
    {
      exerciseId: 2,
      name: 'Squat',
      category: 'Legs',
      sets: [{ kg: 120, reps: 5, completed: true, setType: 'work' }]
    }
  ]
});

describe('TEST A: incomplete -> complete still works', () => {
  it('toggles to completed and preserves values', () => {
    const before = makeWorkout();
    const { workout: after, toast } = toggleSetCompletion(before, 0, 0);
    expect(toast).toBeNull();
    expect(after.exercises[0].sets[0].completed).toBe(true);
    expect(after.exercises[0].sets[0]).toMatchObject({ kg: 100, reps: 5 });
    expect(before.exercises[0].sets[0].completed).toBe(false); // input untouched
  });
});

describe('TEST B: complete -> incomplete commits the toggled state', () => {
  it('toggles to incomplete and preserves weight/reps/type', () => {
    const before = makeWorkout();
    const targetBefore = before.exercises[0].sets[1];
    const { workout: after, toast } = toggleSetCompletion(before, 0, 1);
    expect(toast).toBeNull();
    const target = after.exercises[0].sets[1];
    expect(target.completed).toBe(false);
    expect(target.kg).toBe(targetBefore.kg);
    expect(target.reps).toBe(targetBefore.reps);
    expect(target.setType).toBe(targetBefore.setType);
    expect(after).not.toBe(before); // workout changed (new commit payload)
  });

  it('keeps unrelated exercises/sets referentially stable and input unmutated', () => {
    const before = makeWorkout();
    const snapshot = JSON.parse(JSON.stringify(before));
    const { workout: after } = toggleSetCompletion(before, 0, 1);
    // unrelated exercise untouched (same ref)
    expect(after.exercises[1]).toBe(before.exercises[1]);
    // sibling set in same exercise untouched (same ref, still completed)
    expect(after.exercises[0].sets[0]).toBe(before.exercises[0].sets[0]);
    expect(after.exercises[0].sets[0].completed).toBe(false);
    // target set is a new object (not mutated in place)
    expect(after.exercises[0].sets[1]).not.toBe(before.exercises[0].sets[1]);
    // input deep-unchanged
    expect(before).toEqual(snapshot);
  });

  it('round-trips through persistence serialization with completed=false', () => {
    const before = makeWorkout();
    const { workout: after } = toggleSetCompletion(before, 0, 1);
    const revived = JSON.parse(JSON.stringify(after));
    expect(revived.exercises[0].sets[1].completed).toBe(false);
    expect(revived.exercises[0].sets[1]).toMatchObject({ kg: 100, reps: 5 });
  });
});

describe('TEST C: complete -> incomplete does NOT trigger rest timer', () => {
  it('no rest on un-complete of a work set', () => {
    const done = makeWorkout();
    const prevSet = done.exercises[0].sets[1];
    const { workout: next, toast } = toggleSetCompletion(done, 0, 1);
    expect(next.exercises[0].sets[1].completed).toBe(false);
    expect(
      shouldAutoStartRest({ prevSet, nextSet: next.exercises[0].sets[1], toast, autoStartEnabled: true })
    ).toBe(false);
  });

  it('no rest on un-complete of a warmup set (warmup semantics unchanged)', () => {
    const w = {
      exercises: [{ exerciseId: 1, name: 'Bench', sets: [{ kg: 60, reps: 5, completed: true, setType: 'warmup' }] }]
    };
    const prevSet = w.exercises[0].sets[0];
    const { workout: next, toast } = toggleSetCompletion(w, 0, 0);
    expect(next.exercises[0].sets[0].completed).toBe(false);
    expect(
      shouldAutoStartRest({ prevSet, nextSet: next.exercises[0].sets[0], toast, autoStartEnabled: true })
    ).toBe(false);
  });

  it('complete -> incomplete -> complete yields exactly one new timer edge', () => {
    const w = {
      exercises: [{ exerciseId: 1, name: 'Bench', sets: [{ kg: 100, reps: 5, completed: false, setType: 'work' }] }]
    };
    const first = toggleSetCompletion(w, 0, 0);
    expect(
      shouldAutoStartRest({ prevSet: w.exercises[0].sets[0], nextSet: first.workout.exercises[0].sets[0], toast: first.toast, autoStartEnabled: true })
    ).toBe(true);
    const un = toggleSetCompletion(first.workout, 0, 0);
    expect(
      shouldAutoStartRest({ prevSet: first.workout.exercises[0].sets[0], nextSet: un.workout.exercises[0].sets[0], toast: un.toast, autoStartEnabled: true })
    ).toBe(false);
    const re = toggleSetCompletion(un.workout, 0, 0);
    expect(
      shouldAutoStartRest({ prevSet: un.workout.exercises[0].sets[0], nextSet: re.workout.exercises[0].sets[0], toast: re.toast, autoStartEnabled: true })
    ).toBe(true);
  });
});

describe('TEST D: complete -> incomplete has no PR side effect', () => {
  it('clears PR flags and reports no records for the un-completed set', () => {
    const w = {
      exercises: [{
        exerciseId: 1,
        name: 'Bench',
        sets: [{ kg: 100, reps: 5, completed: true, setType: 'work', isBest1RM: true, isBestSetVolume: true, isHeaviestWeight: true }]
      }]
    };
    const { workout: after } = toggleSetCompletion(w, 0, 0);
    expect(after.exercises[0].sets[0]).toMatchObject({
      completed: false,
      isBest1RM: false,
      isBestSetVolume: false,
      isHeaviestWeight: false
    });
    // An un-completed set is not a record candidate: empty history + valid
    // lift still computes, but the toggle itself attached no PR flags.
    const hist = { best1RM: 9999, bestSetVolume: 99999, heaviestWeight: 9999 };
    const rec = checkSetRecords(100, 5, hist, calculate1RM);
    expect(rec).toEqual({ isBest1RM: false, isBestSetVolume: false, isHeaviestWeight: false });
  });

  it('re-completing after un-complete behaves like a normal completion', () => {
    const w = {
      exercises: [{ exerciseId: 1, name: 'Bench', sets: [{ kg: 100, reps: 5, completed: true, setType: 'work' }] }]
    };
    const un = toggleSetCompletion(w, 0, 0).workout;
    expect(un.exercises[0].sets[0].completed).toBe(false);
    const re = toggleSetCompletion(un, 0, 0);
    expect(re.toast).toBeNull();
    expect(re.workout.exercises[0].sets[0]).toMatchObject({ kg: 100, reps: 5, completed: true });
  });
});

describe('TEST E: un-complete does not delete or recreate the set', () => {
  it('set count and order are stable', () => {
    const before = makeWorkout();
    const { workout: after } = toggleSetCompletion(before, 0, 1);
    expect(after.exercises[0].sets).toHaveLength(before.exercises[0].sets.length);
    expect(after.exercises).toHaveLength(before.exercises.length);
    expect(after.exercises[0].sets[1]).toMatchObject({ kg: 100, reps: 5, completed: false });
  });
});

describe('TEST F: multi-set / multi-exercise isolation', () => {
  it('un-completing set 1 leaves completed set 2 alone', () => {
    const w = {
      exercises: [{
        exerciseId: 1,
        name: 'Bench',
        sets: [
          { kg: 100, reps: 5, completed: true, setType: 'work' },
          { kg: 100, reps: 5, completed: true, setType: 'work' }
        ]
      }]
    };
    const { workout: after } = toggleSetCompletion(w, 0, 0);
    expect(after.exercises[0].sets[0].completed).toBe(false);
    expect(after.exercises[0].sets[1].completed).toBe(true);
    expect(after.exercises[0].sets[1]).toBe(w.exercises[0].sets[1]);
  });

  it('un-completing an Exercise A set leaves Exercise B unchanged', () => {
    const before = makeWorkout();
    const { workout: after } = toggleSetCompletion(before, 0, 1);
    expect(after.exercises[0].sets[1].completed).toBe(false);
    expect(after.exercises[1]).toBe(before.exercises[1]);
    expect(after.exercises[1].sets[0].completed).toBe(true);
  });
});

describe('TEST G: keypad edit path shares the canonical toggle', () => {
  it('updateSetField then un-complete preserves the edited values', () => {
    let w = {
      exercises: [{ exerciseId: 1, name: 'Bench', sets: [{ kg: 0, reps: 0, completed: false, setType: 'work' }] }]
    };
    w = updateSetField(w, 0, 0, 'kg', 80);
    w = updateSetField(w, 0, 0, 'reps', 8);
    w = toggleSetCompletion(w, 0, 0).workout;
    expect(w.exercises[0].sets[0].completed).toBe(true);
    const un = toggleSetCompletion(w, 0, 0).workout;
    expect(un.exercises[0].sets[0]).toMatchObject({ kg: 80, reps: 8, completed: false });
  });
});

/**
 * TEST Z: App.jsx must commit the toggled workout on BOTH branches.
 * Fails while `setActiveWorkout(finalWorkout)` is scoped only inside
 * `if (set.completed) { ... }` (the reported defect); passes once the
 * commit is on the common path. PR/rest side effects must stay guarded.
 */
describe('TEST Z: App handleToggleSet commits on un-complete (integration boundary)', () => {
  const readHandlerRange = () => {
    const here = fileURLToPath(import.meta.url); // .../src/domain/__tests__/toggleUncomplete.test.js
    const appPath = path.resolve(path.dirname(here), '..', '..', 'App.jsx');
    const src = fs.readFileSync(appPath, 'utf8');
    const handlerStart = src.indexOf('const handleToggleSet = useCallback');
    expect(handlerStart).toBeGreaterThan(-1);
    // Handler ends at the first "}, [" dependency array close after its start.
    const depsClose = src.indexOf('}]);', handlerStart);
    // Fallback: bound the search to a large window if the pattern shifts.
    const handlerEnd = depsClose === -1 ? handlerStart + 20000 : depsClose + '}]);'.length;
    const body = src.slice(handlerStart, handlerEnd);
    return body;
  };

  const findMatchingBrace = (text, openIdx) => {
    let depth = 0;
    for (let i = openIdx; i < text.length; i += 1) {
      if (text[i] === '{') depth += 1;
      else if (text[i] === '}') {
        depth -= 1;
        if (depth === 0) return i;
      }
    }
    return -1;
  };

  it('has a setActiveWorkout(finalWorkout) commit reachable on the un-complete path', () => {
    const body = readHandlerRange();
    const branchIdx = body.indexOf('if (set.completed)');
    expect(branchIdx).toBeGreaterThan(-1);
    const branchOpen = body.indexOf('{', branchIdx);
    const branchClose = findMatchingBrace(body, branchOpen);
    expect(branchClose).toBeGreaterThan(branchOpen);

    const commits = [];
    let from = 0;
    for (;;) {
      const idx = body.indexOf('setActiveWorkout(finalWorkout)', from);
      if (idx === -1) break;
      commits.push(idx);
      from = idx + 1;
    }
    expect(commits.length).toBeGreaterThanOrEqual(1);
    // At least one commit must sit OUTSIDE the completion-only branch.
    const commonCommits = commits.filter((idx) => idx < branchOpen || idx > branchClose);
    expect(commonCommits.length).toBeGreaterThanOrEqual(1);
  });

  it('keeps completion-only side effects guarded (PR banner + record check)', () => {
    const body = readHandlerRange();
    const branchIdx = body.indexOf('if (set.completed)');
    const branchOpen = body.indexOf('{', branchIdx);
    const branchClose = findMatchingBrace(body, branchOpen);
    for (const marker of ['checkSetRecords', 'setActivePRBanner']) {
      const idx = body.indexOf(marker);
      expect(idx).toBeGreaterThan(-1);
      expect(idx).toBeGreaterThan(branchOpen);
      expect(idx).toBeLessThan(branchClose);
    }
  });
});
