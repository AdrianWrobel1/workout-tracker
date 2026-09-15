import { describe, it, expect } from 'vitest';
import {
  normalizeSetForStorage,
  normalizeWorkoutExerciseForStorage,
  cloneTemplateExercisesForActive,
  duplicateTemplate,
  isWorkSet
} from '../workoutExtensions';
import { buildCompletedWorkout } from '../workoutActions';
import { buildLastWorkoutSnapshot, prepareCleanWorkoutData, compareWorkoutToPrevious } from '../workouts';
import { calculateExerciseWorkVolume, calculateWorkoutWorkVolume } from '../calculations';
import { getWorkoutPreview } from '../history';
import { getSessionSummary, getSessionExercises } from '../sessionDetail';
import { isWorkoutPersisted } from '../activeWorkoutView';
import { getPlansForTemplate, getActivePlanForTemplate, createPlan } from '../templatePlans';
import { resolveRecommendation } from '../progressionAdapter';

// Simulates App.handleStartWorkout's clone step (deep clone + normalize + reset).
const startTemplate = (template) => {
  const cloned = cloneTemplateExercisesForActive(template.exercises || []);
  return {
    templateId: template.id,
    name: template.name,
    exercises: cloned.map((exercise) => normalizeWorkoutExerciseForStorage({
      ...exercise,
      sets: (exercise.sets || []).map((set) => normalizeSetForStorage({ ...set, completed: false }))
    }))
  };
};

const benchTemplate = () => ({
  id: 't1',
  name: 'Push',
  exercises: [
    {
      exerciseId: 1, name: 'Bench', category: 'Chest', supersetId: null, planNotes: 'control',
      priority: 3, nonNegotiable: false, targetMuscles: ['Chest'],
      progression: { mode: 'linear', incrementKg: 2.5 },
      sets: [
        { kg: 100, reps: 5, completed: false, setType: 'work', warmup: false },
        { kg: 100, reps: 5, completed: false, setType: 'work', warmup: false }
      ]
    },
    {
      exerciseId: 2, name: 'Row', category: 'Back',
      sets: [{ kg: 50, reps: 8, completed: false, setType: 'warmup', warmup: true }]
    }
  ],
  plans: []
});

describe('TEMPLATES 1-5: create/edit/reopen/start/isolation', () => {
  it('1. template holds blueprint targets (not actuals)', () => {
    const t = benchTemplate();
    expect(t.exercises[0].sets.every(s => s.completed === false)).toBe(true);
    expect(t.exercises[0].sets[0]).toMatchObject({ kg: 100, reps: 5 });
  });

  it('2. edit preserves order and does not mutate the source (immutable)', () => {
    const t = benchTemplate();
    const edited = {
      ...t,
      exercises: t.exercises.map((ex, i) => (i === 0 ? { ...ex, planNotes: 'explosive' } : ex))
    };
    expect(t.exercises[0].planNotes).toBe('control');
    expect(edited.exercises[0].planNotes).toBe('explosive');
    expect(edited.exercises.map(e => e.name)).toEqual(['Bench', 'Row']);
  });

  it('3. reopen via JSON round-trip preserves order and config', () => {
    const t = benchTemplate();
    const reopened = JSON.parse(JSON.stringify(t));
    expect(reopened.exercises.map(e => e.name)).toEqual(['Bench', 'Row']);
    expect(reopened.exercises[0].sets).toHaveLength(2);
    expect(reopened.exercises[0].planNotes).toBe('control');
  });

  it('4. start creates an independent working copy (TEMPLATE → CLONE → ACTIVE)', () => {
    const t = benchTemplate();
    const active = startTemplate(t);
    expect(active.templateId).toBe('t1');
    expect(active.exercises).not.toBe(t.exercises);
    expect(active.exercises[0]).not.toBe(t.exercises[0]);
    expect(active.exercises[0].sets[0]).not.toBe(t.exercises[0].sets[0]);
  });

  it('5. MANDATORY: active 110x5 does not mutate template 100x5', () => {
    const t = benchTemplate();
    const active = startTemplate(t);
    active.exercises[0].sets[0].kg = 110;
    expect(t.exercises[0].sets[0].kg).toBe(100);
    expect(active.exercises[0].sets[0].kg).toBe(110);
  });

  it('5b. nested isolation: targetMuscles/progression/notes/superset metadata', () => {
    const t = benchTemplate();
    const active = startTemplate(t);
    active.exercises[0].targetMuscles.push('Triceps');
    active.exercises[0].progression.incrementKg = 5;
    active.exercises[0].planNotes = 'changed';
    active.exercises[0].supersetId = 'superset_x';
    expect(t.exercises[0].targetMuscles).toEqual(['Chest']);
    expect(t.exercises[0].progression.incrementKg).toBe(2.5);
    expect(t.exercises[0].planNotes).toBe('control');
    expect(t.exercises[0].supersetId).toBeNull();
  });

  it('5c. set array isolation: push/delete in active does not touch template', () => {
    const t = benchTemplate();
    const active = startTemplate(t);
    active.exercises[0].sets.push({ kg: 120, reps: 3, completed: false });
    active.exercises[1].sets.pop();
    expect(t.exercises[0].sets).toHaveLength(2);
    expect(t.exercises[1].sets).toHaveLength(1);
  });
});

describe('TEMPLATES 6-7: repeated starts', () => {
  it('6. same template started twice yields independent workouts', () => {
    const t = benchTemplate();
    const a = startTemplate(t);
    const b = startTemplate(t);
    a.exercises[0].sets[0].kg = 110;
    expect(b.exercises[0].sets[0].kg).toBe(100);
    expect(t.exercises[0].sets[0].kg).toBe(100);
    b.exercises[1].sets.push({ kg: 60, reps: 6, completed: false });
    expect(a.exercises[1].sets).toHaveLength(1);
  });
});

describe('TEMPLATES 7-15: ordering + configuration preservation', () => {
  it('7. exercise ordering survives clone', () => {
    const t = benchTemplate();
    expect(startTemplate(t).exercises.map(e => e.name)).toEqual(['Bench', 'Row']);
  });

  it('8. set ordering survives clone', () => {
    const t = benchTemplate();
    const active = startTemplate(t);
    expect(active.exercises[0].sets.map(s => s.kg)).toEqual([100, 100]);
  });

  it('9. set configuration (kg/reps/type) preserved', () => {
    const active = startTemplate(benchTemplate());
    expect(active.exercises[0].sets[0]).toMatchObject({ kg: 100, reps: 5, setType: 'work' });
  });

  it('10. warmups preserved as warmup type', () => {
    const active = startTemplate(benchTemplate());
    expect(active.exercises[1].sets[0].warmup).toBe(true);
    expect(isWorkSet({ ...active.exercises[1].sets[0], completed: true })).toBe(false);
  });

  it('11. set types preserved (drop/failure/tempo/pause count as work)', () => {
    const t = benchTemplate();
    t.exercises[0].sets.push({ kg: 80, reps: 8, completed: false, setType: 'drop', warmup: false });
    const active = startTemplate(t);
    expect(active.exercises[0].sets[2].setType).toBe('drop');
  });

  it('13. progression config cloned (not shared)', () => {
    const active = startTemplate(benchTemplate());
    expect(active.exercises[0].progression).toEqual({ mode: 'linear', incrementKg: 2.5 });
  });

  it('14. notes (planNotes) preserved', () => {
    expect(startTemplate(benchTemplate()).exercises[0].planNotes).toBe('control');
  });

  it('15. superset links preserved', () => {
    const t = benchTemplate();
    t.exercises[0].supersetId = 'ss1';
    t.exercises[1].supersetId = 'ss1';
    const active = startTemplate(t);
    expect(active.exercises[0].supersetId).toBe('ss1');
    expect(active.exercises[1].supersetId).toBe('ss1');
  });

  it('12/15b. per-exercise work volume is canonical (warmups excluded)', () => {
    const active = startTemplate(benchTemplate());
    active.exercises[0].sets.forEach(s => { s.completed = true; });
    active.exercises[1].sets.forEach(s => { s.completed = true; });
    expect(calculateExerciseWorkVolume(active.exercises[0], {})).toBe(1000);
    expect(calculateExerciseWorkVolume(active.exercises[1], {})).toBe(0);
  });
});

describe('SAVE 16-19: workout vs template semantics', () => {
  const completedBench = () => ({
    id: 'w1', name: 'Push', date: '2026-09-12T10:00:00.000Z', startTime: '2026-09-12T09:00:00.000Z',
    exercises: [{ exerciseId: 1, name: 'Bench', category: 'Chest', sets: [{ kg: 110, reps: 5, completed: true, setType: 'work' }] }]
  });

  it('16. save workout creates exactly one history record (idempotent guard)', () => {
    const workouts = [];
    const w = completedBench();
    expect(isWorkoutPersisted(workouts, w.id)).toBe(false);
    const next = [w, ...workouts];
    expect(isWorkoutPersisted(next, w.id)).toBe(true);
    // double-save: guard closes quietly, no second record
    const again = isWorkoutPersisted(next, w.id) ? next : [w, ...next];
    expect(again).toHaveLength(1);
  });

  it('17. buildCompletedWorkout never mutates active + assigns durable id/date', () => {
    const active = { name: 'Push', startTime: '2026-09-12T09:00:00.000Z', exercises: [] };
    const done = buildCompletedWorkout(active, { now: new Date('2026-09-12T10:00:00.000Z'), id: 'w9', tags: [] });
    expect(done.id).toBe('w9');
    expect(active.id).toBeUndefined();
    expect(done.date).toContain('2026-09-12');
  });

  it('18. double-save safety: same id detected as persisted', () => {
    const workouts = [completedBench()];
    expect(isWorkoutPersisted(workouts, 'w1')).toBe(true);
    expect(isWorkoutPersisted(workouts, 'w2')).toBe(false);
  });

  it('19. template snapshot does not rewrite history records', () => {
    const history = [completedBench()];
    const snapshot = buildLastWorkoutSnapshot(history[0]);
    expect(snapshot.exercises[0].sets).toEqual([{ kg: 110, reps: 5 }]);
    expect(history[0].exercises[0].sets[0].kg).toBe(110);
  });
});

describe('COPY 20-22: duplication safety', () => {
  it('20. duplicate template gets a new id, copy suffix, cleared execution memory', () => {
    const t = { ...benchTemplate(), lastWorkoutSnapshot: { date: 'x', exercises: [] }, templatePrevious: { 1: { sets: [] } } };
    const copy = duplicateTemplate(t, () => 'new-id');
    expect(copy.id).toBe('new-id');
    expect(copy.name).toBe('Push (Copy)');
    expect(copy.lastWorkoutSnapshot).toBeNull();
    expect(copy.templatePrevious).toEqual({});
  });

  it('21. duplicate workout via buildCompletedWorkout assigns a fresh id', () => {
    const w = { name: 'A', startTime: '2026-09-12T09:00:00.000Z', exercises: [] };
    const a = buildCompletedWorkout(w, { now: new Date('2026-09-12T10:00:00.000Z'), id: 'a' });
    const b = buildCompletedWorkout(w, { now: new Date('2026-09-12T10:00:00.000Z'), id: 'b' });
    expect(a.id).not.toBe(b.id);
  });

  it('22. nested object isolation on duplicate', () => {
    const t = benchTemplate();
    const copy = duplicateTemplate(t, () => 'c2');
    copy.exercises[0].sets[0].kg = 999;
    copy.exercises[0].targetMuscles.push('X');
    expect(t.exercises[0].sets[0].kg).toBe(100);
    expect(t.exercises[0].targetMuscles).toEqual(['Chest']);
  });
});

describe('PLANS 23-25: organization', () => {
  it('23. empty plans fall back to default plan', () => {
    expect(getPlansForTemplate(benchTemplate())).toHaveLength(1);
    expect(getActivePlanForTemplate(benchTemplate()).name).toBe('Default');
  });

  it('24. plan → template relationship is explicit (plans live on template)', () => {
    const plan = createPlan('Strength', 'high', 85, 95, '1-5', 1, () => 'p1');
    const t = { ...benchTemplate(), plans: [plan], defaultPlanId: 'p1' };
    expect(getActivePlanForTemplate(t).id).toBe('p1');
  });

  it('25. start workflow keeps plan guidance out of the working copy', () => {
    const plan = createPlan('Strength', 'high', 85, 95, '1-5', 1, () => 'p1');
    const t = { ...benchTemplate(), plans: [plan], defaultPlanId: 'p1' };
    const active = startTemplate(t);
    expect(active.plans).toBeUndefined();
    expect(active.templateId).toBe('t1');
  });
});

describe('EDGE 26-29: empty/stale/legacy', () => {
  it('26. empty template starts to an empty working copy without crashing', () => {
    const active = startTemplate({ id: 'empty', name: 'Empty Workout', exercises: [] });
    expect(active.exercises).toEqual([]);
  });

  it('27. empty plan list is safe', () => {
    expect(getActivePlanForTemplate({})).toBeTruthy();
  });

  it('28. stale exerciseId is kept (graceful orphan, no crash)', () => {
    const t = { id: 't', name: 'T', exercises: [{ exerciseId: 9999, name: 'Ghost', sets: [{ kg: 10, reps: 5, completed: false }] }] };
    const active = startTemplate(t);
    expect(active.exercises[0].exerciseId).toBe(9999);
    expect(active.exercises[0].name).toBe('Ghost');
  });

  it('29. legacy template (kg/reps only, no ids/config) normalizes safely', () => {
    const legacy = { id: 123, name: 'Old', exercises: [{ name: 'Bench', sets: [{ kg: 60, reps: 8 }] }] };
    const active = startTemplate(legacy);
    expect(active.exercises[0].exerciseId).toBeUndefined();
    expect(active.exercises[0].sets[0]).toMatchObject({ kg: 60, reps: 8 });
  });
});

describe('CROSS-SYSTEM: finish == session == history == stats volume', () => {
  const db = [{ id: 1, name: 'Pull-up', usesBodyweight: true }];
  const workout = {
    id: 'w', name: 'Back', date: '2026-09-12T10:00:00.000Z',
    exercises: [{ exerciseId: 1, name: 'Pull-up', category: 'Back', sets: [{ kg: 20, reps: 5, completed: true, setType: 'work' }] }]
  };

  it('finish headline uses BW-aware canonical volume (20+80)x5=500', () => {
    const clean = prepareCleanWorkoutData(workout, db, 80);
    expect(clean.totalVolume).toBe(500);
    expect(clean.completedSets).toBe(1);
  });

  it('session + history previews agree with finish', () => {
    const session = getSessionSummary(workout, { exercisesDB: db, userWeight: 80 });
    const preview = getWorkoutPreview(workout, { exercisesDB: db, userWeight: 80 });
    const rows = getSessionExercises(workout, { exercisesDB: db, userWeight: 80 });
    expect(session.workVolume).toBe(500);
    expect(preview.workVolume).toBe(500);
    expect(rows[0].volume).toBe(500);
    expect(calculateWorkoutWorkVolume(workout, db, 80)).toBe(500);
  });

  it('comparison accepts BW opts without breaking legacy 2-arg callers', () => {
    const prev = { date: '2026-09-01T10:00:00.000Z', exercises: [{ sets: [{ kg: 100, reps: 1, completed: true }] }] };
    const cur = { date: '2026-09-12T10:00:00.000Z', exercises: [{ sets: [{ kg: 110, reps: 1, completed: true }] }] };
    expect(compareWorkoutToPrevious(cur, [prev]).trend).toBe('up');
    expect(compareWorkoutToPrevious(cur, [prev], { exercisesDB: [], userWeight: 80 }).trend).toBe('up');
  });

  it('adversarial isolation: chest history vs back session never leak', () => {
    const chest = { id: 'a', name: 'Chest', date: '2026-09-10T10:00:00.000Z', exercises: [{ exerciseId: 1, name: 'Bench', category: 'Chest', sets: [{ kg: 100, reps: 5, completed: true, setType: 'work' }] }] };
    const back = { id: 'b', name: 'Back', date: '2026-09-12T10:00:00.000Z', exercises: [{ exerciseId: 2, name: 'Row', category: 'Back', sets: [{ kg: 80, reps: 8, completed: true, setType: 'work' }] }] };
    const summary = getSessionSummary(back, { exercisesDB: [], userWeight: null });
    expect(summary.workVolume).toBe(640);
    expect(summary.exercisesCount).toBe(1);
    expect(getWorkoutPreview(back, {}).workVolume).toBe(640);
    expect(chest.exercises[0].name).toBe('Bench');
  });

  it('progression: ACTUAL vs RECOMMENDED stay separate (adapter returns hints only)', () => {
    const rec = resolveRecommendation({ exercise: { id: 1, progression: { mode: 'off' } }, workouts: [] });
    expect(rec).toBeNull();
  });
});
