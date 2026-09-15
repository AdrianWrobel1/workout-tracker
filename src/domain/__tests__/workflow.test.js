import { describe, it, expect } from 'vitest';
import {
  updateSetField,
  toggleSetCompletion,
  addSet,
  deleteSet,
  buildCompletedWorkout
} from '../workoutActions';
import { detectPRsInWorkout, buildLastWorkoutSnapshot } from '../workouts';
import { getExerciseRecords } from '../exercises';
import { calculate1RM, calculateWorkoutWorkVolume } from '../calculations';
import { mergeById } from '../../services/importExport';

/**
 * LAYER 4 — critical workflow at the pure level:
 * start → edit set → complete set → add/remove set → finish (durable shape)
 * → history/PR → export-shape → import merge → delete → undo shape.
 * React/persistence shells are thin wrappers around these transitions.
 */
describe('critical workout workflow', () => {
  const startWorkout = () => ({
    templateId: 't1',
    name: 'Push Day',
    note: '',
    date: '2026-01-15',
    startTime: '2026-01-15T10:00:00.000Z',
    exercises: [
      {
        exerciseId: 1,
        name: 'Bench',
        category: 'Chest',
        sets: [
          { kg: 0, reps: 0, completed: false, suggestedKg: 100, suggestedReps: 5 },
          { kg: 100, reps: 5, completed: false }
        ]
      }
    ]
  });

  it('start → edit → complete (auto-fill) → finish produces a durable workout', () => {
    let w = startWorkout();

    // edit second set
    w = updateSetField(w, 0, 1, 'reps', 6);
    expect(w.exercises[0].sets[1].reps).toBe(6);

    // complete first set: suggested values auto-fill
    const toggled = toggleSetCompletion(w, 0, 0);
    expect(toggled.toast).toBeNull();
    w = toggled.workout;
    expect(w.exercises[0].sets[0]).toMatchObject({ kg: 100, reps: 5, completed: true });

    // complete edited set
    w = toggleSetCompletion(w, 0, 1).workout;
    expect(calculateWorkoutWorkVolume(w, [], null)).toBe(100 * 5 + 100 * 6);

    // finish: durable shape with id/date/duration/tags
    const done = buildCompletedWorkout(w, { now: new Date('2026-01-15T11:00:00.000Z'), id: 'done-1', tags: ['#power'] });
    expect(done).toMatchObject({ id: 'done-1', tags: ['#power'], duration: 60 });
    expect(done.date).toBe('2026-01-15T11:00:00.000Z');
    expect(w.id).toBeUndefined(); // input untouched
  });

  it('add/remove set keeps completion of siblings', () => {
    let w = startWorkout();
    w = toggleSetCompletion(w, 0, 1).workout;
    w = addSet(w, 0);
    expect(w.exercises[0].sets).toHaveLength(3);
    expect(w.exercises[0].sets[1].completed).toBe(true);
    w = deleteSet(w, 0, 0);
    expect(w.exercises[0].sets).toHaveLength(2);
    expect(w.exercises[0].sets[0].completed).toBe(true);
  });

  it('second session detects PRs and feeds template snapshot', () => {
    const first = {
      id: 'w0',
      date: '2026-01-01T10:00:00.000Z',
      exercises: [{ exerciseId: 1, name: 'Bench', sets: [{ kg: 100, reps: 5, completed: true }] }]
    };
    const second = {
      id: 'w1',
      date: '2026-01-08T10:00:00.000Z',
      exercises: [{ exerciseId: 1, name: 'Bench', sets: [{ kg: 105, reps: 5, completed: true }] }]
    };
    const prs = detectPRsInWorkout(second, [first], calculate1RM, getExerciseRecords);
    expect(Object.keys(prs)).toHaveLength(1);

    const snapshot = buildLastWorkoutSnapshot(second);
    expect(snapshot.exercises[0].sets).toEqual([{ kg: 105, reps: 5 }]);

    // history retrieval: newest-first merge keeps both sessions
    const { merged } = mergeById([first], [second]);
    expect(merged.map((x) => x.id)).toEqual(['w1', 'w0']);
  });

  it('import merge is idempotent; delete + undo restores the record', () => {
    const history = [
      { id: 'w1', date: '2026-01-08T10:00:00.000Z', exercises: [] },
      { id: 'w0', date: '2026-01-01T10:00:00.000Z', exercises: [] }
    ];
    // re-importing the same backup adds nothing
    const reimport = mergeById(history, history);
    expect(reimport.added).toHaveLength(0);
    expect(reimport.merged).toHaveLength(2);

    // delete…
    const deleted = history.find((x) => x.id === 'w1');
    const afterDelete = history.filter((x) => x.id !== 'w1');
    expect(afterDelete).toHaveLength(1);

    // …undo restores the exact record
    const { merged: afterUndo, added } = mergeById(afterDelete, [deleted]);
    expect(added).toHaveLength(1);
    expect(afterUndo.find((x) => x.id === 'w1')).toEqual(deleted);
  });
});
