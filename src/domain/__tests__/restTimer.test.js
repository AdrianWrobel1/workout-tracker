import { describe, it, expect } from 'vitest';
import {
  DEFAULT_REST_SEC,
  normalizeRestDuration,
  createRestTimer,
  getRemainingSec,
  isRestComplete,
  addRestSeconds,
  skipRestTimer,
  formatRestTime,
  shouldAutoStartRest
} from '../restTimer';
import { toggleSetCompletion } from '../workoutActions';

const NOW = 1_700_000_000_000;

const makeWorkout = (set = { kg: 100, reps: 5, completed: false }) => ({
  id: 'w1',
  name: 'Push',
  startTime: new Date('2026-01-01T10:00:00.000Z').toISOString(),
  exercises: [
    { exerciseId: 1, name: 'Bench', category: 'Chest', sets: [{ ...set }] }
  ]
});

describe('rest timer engine (timestamp-based)', () => {
  it('1. creates an initial timer with the configured duration', () => {
    const timer = createRestTimer(90, NOW, 'set-1');
    expect(timer).toMatchObject({
      active: true,
      startedAt: NOW,
      endsAt: NOW + 90 * 1000,
      totalSec: 90,
      source: 'set-1'
    });
  });

  it('2. reports remaining time from endTimestamp - now', () => {
    const timer = createRestTimer(90, NOW);
    expect(getRemainingSec(timer, NOW + 30 * 1000)).toBe(60);
    expect(getRemainingSec(timer, NOW + 89 * 1000)).toBe(1);
  });

  it('3. completes at zero and reports zero remaining', () => {
    const timer = createRestTimer(90, NOW);
    expect(isRestComplete(timer, NOW + 90 * 1000)).toBe(true);
    expect(getRemainingSec(timer, NOW + 90 * 1000)).toBe(0);
    expect(isRestComplete(timer, NOW + 10 * 1000)).toBe(false);
  });

  it('4. +15 extends the end timestamp', () => {
    const timer = createRestTimer(90, NOW);
    const extended = addRestSeconds(timer, 15, NOW + 10 * 1000);
    expect(extended.endsAt).toBe(timer.endsAt + 15 * 1000);
    expect(getRemainingSec(extended, NOW + 10 * 1000)).toBe(95);
  });

  it('5. -15 shortens the end timestamp', () => {
    const timer = createRestTimer(90, NOW);
    const shortened = addRestSeconds(timer, -15, NOW + 10 * 1000);
    expect(shortened.endsAt).toBe(timer.endsAt - 15 * 1000);
    expect(getRemainingSec(shortened, NOW + 10 * 1000)).toBe(65);
  });

  it('6. never goes below zero; over-subtraction skips instead', () => {
    const timer = createRestTimer(90, NOW);
    expect(getRemainingSec(timer, NOW + 999 * 1000)).toBe(0);
    expect(addRestSeconds(timer, -1000, NOW)).toBeNull();
    expect(addRestSeconds(timer, -90, NOW)).toBeNull();
  });

  it('7. skip resolves to no timer', () => {
    expect(skipRestTimer(createRestTimer(90, NOW))).toBeNull();
    expect(getRemainingSec(skipRestTimer(), NOW)).toBe(0);
    expect(isRestComplete(skipRestTimer(), NOW)).toBe(false);
  });

  it('8. invalid durations normalize to a safe default / no timer', () => {
    expect(createRestTimer(0, NOW)).toBeNull();
    expect(createRestTimer(-30, NOW)).toBeNull();
    expect(createRestTimer(NaN, NOW)).toBeNull();
    expect(createRestTimer('lots', NOW)).toBeNull();
    expect(normalizeRestDuration(90)).toBe(90);
    expect(normalizeRestDuration(0)).toBe(DEFAULT_REST_SEC);
    expect(normalizeRestDuration(-5)).toBe(DEFAULT_REST_SEC);
    expect(normalizeRestDuration(NaN)).toBe(DEFAULT_REST_SEC);
    expect(normalizeRestDuration('abc')).toBe(DEFAULT_REST_SEC);
    expect(normalizeRestDuration(5)).toBe(DEFAULT_REST_SEC);
    expect(normalizeRestDuration(3600)).toBe(DEFAULT_REST_SEC);
    expect(normalizeRestDuration(30.4)).toBe(30);
  });

  it('9. stays accurate across time jumps (no tick counting)', () => {
    const timer = createRestTimer(90, NOW);
    // Simulate a backgrounded tab: no ticks for 45s, then one read.
    expect(getRemainingSec(timer, NOW + 45 * 1000)).toBe(45);
    // Long frame delay past the end still lands exactly on zero.
    expect(getRemainingSec(timer, NOW + 10_000 * 1000)).toBe(0);
    expect(isRestComplete(timer, NOW + 10_000 * 1000)).toBe(true);
  });

  it('10. an already-expired timer reads as complete', () => {
    const timer = createRestTimer(90, NOW - 120 * 1000);
    expect(getRemainingSec(timer, NOW)).toBe(0);
    expect(isRestComplete(timer, NOW)).toBe(true);
  });

  it('11. the exact-zero boundary counts as complete', () => {
    const timer = createRestTimer(60, NOW);
    expect(getRemainingSec(timer, NOW + 60 * 1000)).toBe(0);
    expect(isRestComplete(timer, NOW + 60 * 1000)).toBe(true);
    expect(isRestComplete(timer, NOW + 60 * 1000 - 1)).toBe(false);
  });

  it('12. repeated adjustments accumulate without drift', () => {
    let timer = createRestTimer(90, NOW);
    timer = addRestSeconds(timer, 15, NOW);
    timer = addRestSeconds(timer, 15, NOW);
    timer = addRestSeconds(timer, 15, NOW);
    timer = addRestSeconds(timer, -15, NOW);
    timer = addRestSeconds(timer, -15, NOW);
    expect(timer.endsAt).toBe(NOW + 105 * 1000);
    expect(getRemainingSec(timer, NOW)).toBe(105);
    // Original timer object is untouched (immutable adjustments).
    const original = createRestTimer(90, NOW);
    addRestSeconds(original, 15, NOW);
    expect(original.endsAt).toBe(NOW + 90 * 1000);
  });

  it('formats MM:SS display values', () => {
    expect(formatRestTime(90)).toBe('1:30');
    expect(formatRestTime(5)).toBe('0:05');
    expect(formatRestTime(0)).toBe('0:00');
    expect(formatRestTime(-10)).toBe('0:00');
  });
});

describe('rest auto-start integration (via toggleSetCompletion)', () => {
  const decide = (workout, autoStartEnabled = true) => {
    const prevSet = workout.exercises[0].sets[0];
    const { workout: next, toast } = toggleSetCompletion(workout, 0, 0);
    const nextSet = next.exercises[0].sets[0];
    return { should: shouldAutoStartRest({ prevSet, nextSet, toast, autoStartEnabled }), toast, next };
  };

  it('13. a completed work set starts rest', () => {
    const { should, toast } = decide(makeWorkout());
    expect(toast).toBeNull();
    expect(should).toBe(true);
  });

  it('13b. drop/failure/tempo/pause completions also start rest', () => {
    for (const setType of ['drop', 'failure', 'tempo', 'pause']) {
      const { should } = decide(makeWorkout({ kg: 50, reps: 8, completed: false, setType }));
      expect(should).toBe(true);
    }
  });

  it('14. warmup completion does not start automatic rest', () => {
    const { should } = decide(makeWorkout({ kg: 60, reps: 5, completed: false, setType: 'warmup' }));
    expect(should).toBe(false);
  });

  it('15. rejected completion (empty set, no suggestions) does not start rest', () => {
    const { should, toast } = decide(makeWorkout({ kg: 0, reps: 0, completed: false }));
    expect(toast).toBeTruthy();
    expect(should).toBe(false);
  });

  it('16. un-completing or re-toggling never starts a duplicate timer', () => {
    // Toggling an already-completed set un-completes it: no fresh completion.
    const done = makeWorkout({ kg: 100, reps: 5, completed: true });
    const prevSet = done.exercises[0].sets[0];
    const { workout: next, toast } = toggleSetCompletion(done, 0, 0);
    expect(
      shouldAutoStartRest({ prevSet, nextSet: next.exercises[0].sets[0], toast })
    ).toBe(false);
    // Disabled auto-start never fires either.
    expect(decide(makeWorkout(), false).should).toBe(false);
  });

  it('17. timer decisions never mutate workout history', () => {
    const workout = makeWorkout();
    const snapshot = JSON.parse(JSON.stringify(workout));
    const { next } = decide(workout);
    const timer = createRestTimer(90, NOW, 'set-0');
    addRestSeconds(timer, 15, NOW);
    addRestSeconds(timer, -15, NOW);
    skipRestTimer(timer);
    // The input workout is untouched by the toggle (immutable layer)…
    expect(workout).toEqual(snapshot);
    // …and the timer carries no workout data.
    expect(JSON.stringify(timer)).not.toContain('Bench');
    expect(next).not.toHaveProperty('restTimer');
    expect(next).not.toHaveProperty('secondsRemaining');
  });
});
