import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Active Workout 2.0 presentation contracts (source-level, same pattern as
 * toggleUncomplete TEST Z): the canonical engines own behavior, but the
 * execution surface must keep its accessibility / idempotency guarantees.
 * These fail if a future edit drops an aria label, shrinks a touch target,
 * or re-introduces double-finish/double-save.
 */

const here = path.dirname(fileURLToPath(import.meta.url)); // .../src/domain/__tests__
const srcDir = path.resolve(here, '..', '..');
const read = (rel) => fs.readFileSync(path.resolve(srcDir, rel), 'utf8');

describe('set toggle control contract (ActiveWorkoutExerciseCard)', () => {
  const card = read('components/ActiveWorkoutExerciseCard.jsx');

  it('toggle button exposes an accessible name and pressed state', () => {
    expect(card).toContain('aria-label={toggleLabel}');
    expect(card).toContain('aria-pressed={Boolean(set.completed)}');
  });

  it('toggle button meets the 44px touch target', () => {
    // w-12 h-12 = 48px (≥44px Apple HIG); guards against regressing to w-9 h-9 (36px).
    expect(card).toContain('w-12 h-12');
    expect(card).not.toMatch(/toggle[\s\S]{0,400}w-9 h-9/);
  });

  it('weight/reps inputs have associated labels', () => {
    expect(card).toContain('htmlFor={kgId}');
    expect(card).toContain('htmlFor={repsId}');
    expect(card).toContain('id={kgId}');
    expect(card).toContain('id={repsId}');
  });

  it('previous performance stays available on narrow phones and to screen readers', () => {
    expect(card).toContain('sr-only');
    expect(card).toContain('Last time');
    expect(card).toContain('min-[390px]:hidden');
  });

  it('current set is exposed beyond color (ring + text + aria-current)', () => {
    expect(card).toContain("aria-current={isCurrent ? 'true' : undefined}");
    expect(card).toContain('NOW');
  });
});

describe('active workout header contract (ActiveWorkoutView)', () => {
  const view = read('views/ActiveWorkoutView.jsx');

  it('shows the workout name so the user knows what they are doing', () => {
    expect(view).toContain('activeWorkout?.name');
  });

  it('exposes elapsed time and progress to assistive tech', () => {
    expect(view).toContain('role="timer"');
    expect(view).toContain('role="status"');
  });

  it('provides text-labeled exercise jump navigation (scroll only, no state change)', () => {
    expect(view).toContain('aria-label="Jump to exercise"');
    expect(view).toContain('scrollIntoView');
  });

  it('handles the empty-workout edge without crashing', () => {
    expect(view).toContain('No exercises yet');
  });
});

describe('finish idempotency contract (App)', () => {
  const app = read('App.jsx');

  it('double Finish cannot build two summaries', () => {
    expect(app).toContain('if (pendingSummary) return;');
  });

  it('double Save cannot duplicate history (in-flight ref + persisted-id check)', () => {
    expect(app).toContain('saveInFlightRef');
    expect(app).toContain('isWorkoutPersisted(workouts, pendingSummary.completedWorkout.id)');
  });

  it('no leftover scroll-debug instrumentation', () => {
    expect(app).not.toContain('SCROLL DEBUG');
  });
});

describe('rest timer integration contract (App + view)', () => {
  const app = read('App.jsx');
  const view = read('views/ActiveWorkoutView.jsx');

  it('completion-only rest auto-start stays guarded in App', () => {
    expect(app).toContain('shouldAutoStartRest');
  });

  it('manual rest start keeps an accessible label and 44px target', () => {
    expect(view).toContain('aria-label={`Start rest timer for');
    expect(view).toContain('min-h-[44px]');
  });
});
