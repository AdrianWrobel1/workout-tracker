import { describe, it, expect } from 'vitest';
import {
  SCHEDULED_STATUS,
  isValidDayKey,
  todayLocalKey,
  normalizeScheduledWorkout,
  normalizeScheduledList,
  createScheduledFromTemplate,
  createScheduledCustom,
  updateScheduledWorkout,
  rescheduleScheduledWorkout,
  markScheduledCompleted,
  deleteScheduledWorkout,
  getScheduledById,
  getScheduledForDay,
  getCompletedPlansForDay,
  resolveScheduledSource,
  summarizeScheduled,
  buildMonthDayIndex,
  getCompletedForDay,
  getUpcomingPlans,
  buildActiveBlueprintFromScheduled,
  snapshotExercises,
} from '../scheduledWorkouts';
import { cloneTemplateExercisesForActive } from '../workoutExtensions';

const template = (over = {}) => ({
  id: 'tpl-push-a',
  name: 'Push A',
  exercises: [
    {
      exerciseId: 'e1',
      name: 'Bench',
      category: 'Chest',
      sets: [
        { kg: 100, reps: 5, setType: 'work' },
        { kg: 100, reps: 5, setType: 'work' },
      ],
    },
    {
      exerciseId: 'e2',
      name: 'OHP',
      category: 'Shoulders',
      sets: [{ kg: 60, reps: 8, setType: 'work' }],
    },
  ],
  ...over,
});

/* CALENDAR (1–8): date math lives in the view; the domain contract it
   depends on is day-key validity + month index. */
describe('scheduled workouts — calendar contract', () => {
  it('1. accepts real days, rejects impossible ones (incl. leap years)', () => {
    expect(isValidDayKey('2026-02-28')).toBe(true);
    expect(isValidDayKey('2024-02-29')).toBe(true); // leap year
    expect(isValidDayKey('2025-02-29')).toBe(false); // not a leap year
    expect(isValidDayKey('2026-13-01')).toBe(false);
    expect(isValidDayKey('2026-00-10')).toBe(false);
    expect(isValidDayKey('2026-04-31')).toBe(false);
    expect(isValidDayKey('not-a-date')).toBe(false);
    expect(isValidDayKey(null)).toBe(false);
    expect(isValidDayKey('')).toBe(false);
  });

  it('2/3. previous/next month arithmetic handles year boundaries', () => {
    // The view derives months from Date math; the index keys must sort
    // lexicographically across a year boundary for that to work.
    expect('2026-01-05' < '2025-12-31').toBe(false);
    expect('2025-12-31' < '2026-01-05').toBe(true);
    const idx = buildMonthDayIndex({
      scheduled: [
        createScheduledFromTemplate(template(), '2025-12-31'),
        createScheduledFromTemplate(template(), '2026-01-01'),
      ],
      workouts: [],
    });
    expect(idx.get('2025-12-31').planned).toBe(1);
    expect(idx.get('2026-01-01').planned).toBe(1);
  });

  it('4. today key is a valid local day key', () => {
    expect(isValidDayKey(todayLocalKey())).toBe(true);
  });

  it('5/6/7. year boundary + leap day + selected-date lookup', () => {
    const plans = [
      createScheduledFromTemplate(template(), '2024-02-29', { id: 'leap' }),
      createScheduledFromTemplate(template(), '2025-12-31', { id: 'nye' }),
    ];
    expect(getScheduledForDay(plans, '2024-02-29')).toHaveLength(1);
    expect(getScheduledForDay(plans, '2025-12-31')).toHaveLength(1);
    expect(getScheduledById(plans, 'leap').name).toBe('Push A');
  });

  it('8. empty date yields empty planned + completed lists', () => {
    expect(getScheduledForDay([], '2026-10-02')).toEqual([]);
    expect(getCompletedForDay([], '2026-10-02')).toEqual([]);
    expect(getScheduledForDay(null, '2026-10-02')).toEqual([]);
  });
});

/* PLANNING (9–14) */
describe('scheduled workouts — planning', () => {
  it('9. creates a planned workout with stable id + snapshot config', () => {
    const plan = createScheduledFromTemplate(template(), '2026-10-02', { id: 'p1' });
    expect(plan).toMatchObject({
      id: 'p1',
      dateKey: '2026-10-02',
      name: 'Push A',
      templateId: 'tpl-push-a',
      status: SCHEDULED_STATUS.PLANNED,
      completedWorkoutId: null,
    });
    expect(plan.exercises).toHaveLength(2);
    expect(plan.createdAt).toEqual(plan.updatedAt);
  });

  it('10. choosing an existing template snapshots (deep copy, no aliasing)', () => {
    const tpl = template();
    const plan = createScheduledFromTemplate(tpl, '2026-10-02');
    plan.exercises[0].sets[0].kg = 999;
    plan.exercises.push({ name: 'Extra' });
    expect(tpl.exercises[0].sets[0].kg).toBe(100);
    expect(tpl.exercises).toHaveLength(2);
  });

  it('11. creates a new custom plan without touching templates', () => {
    const plan = createScheduledCustom({
      name: 'My Friday Mix',
      dateKey: '2026-10-02',
      exercises: [
        { exerciseId: 'e9', name: 'Squat', sets: [{ kg: 120, reps: 5, setType: 'work' }] },
      ],
    });
    expect(plan.templateId).toBeNull();
    expect(plan.name).toBe('My Friday Mix');
    expect(plan.exercises[0].sets[0]).toMatchObject({ kg: 120, reps: 5 });
  });

  it('11b. rejects custom plans with no name, no exercises, or bad dates', () => {
    expect(createScheduledCustom({ name: '', dateKey: '2026-10-02', exercises: [{ name: 'X' }] })).toBeNull();
    expect(createScheduledCustom({ name: 'X', dateKey: '2026-10-02', exercises: [] })).toBeNull();
    expect(createScheduledCustom({ name: 'X', dateKey: 'nope', exercises: [{ name: 'X' }] })).toBeNull();
    expect(createScheduledFromTemplate(null, '2026-10-02')).toBeNull();
    expect(createScheduledFromTemplate(template(), 'bad-key')).toBeNull();
  });

  it('12. custom plan can link a freshly saved template id', () => {
    const plan = createScheduledCustom({
      name: 'Legs',
      dateKey: '2026-10-02',
      exercises: [{ name: 'Squat', sets: [{ kg: 0, reps: 0 }] }],
      templateId: 'tpl-new',
      templateName: 'Legs',
    });
    expect(plan.templateId).toBe('tpl-new');
    expect(resolveScheduledSource(plan, [{ id: 'tpl-new', name: 'Legs' }]).kind).toBe('template');
  });

  it('13. persistence round-trip: normalize keeps good records, drops garbage', () => {
    const good = createScheduledFromTemplate(template(), '2026-10-02', { id: 'keep' });
    const list = normalizeScheduledList([
      good,
      { id: 'legacy', date: '2026-10-03T10:00:00.000Z', name: 'Old', exercises: [] },
      null,
      { noId: true },
      { id: 'bad-date', dateKey: 'yesterday-ish' },
      'junk',
    ]);
    expect(list.map((p) => p.id)).toEqual(['keep', 'legacy']);
    expect(list[1].dateKey).toBe('2026-10-03');
  });

  it('14. refresh persistence: normalized plans keep snapshot + status', () => {
    const plan = createScheduledFromTemplate(template(), '2026-10-02', { id: 'p' });
    const revived = normalizeScheduledList(JSON.parse(JSON.stringify([plan])));
    expect(revived[0]).toEqual(plan);
  });
});

/* ISOLATION (15–18) */
describe('scheduled workouts — isolation', () => {
  it('15. plan snapshot converts to an active-workout blueprint copy', () => {
    const plan = createScheduledFromTemplate(template(), '2026-10-02');
    const blueprint = buildActiveBlueprintFromScheduled(plan);
    expect(blueprint.name).toBe('Push A');
    expect(blueprint.exercises).toHaveLength(2);
    // The existing start path clones once more — simulate it.
    const workingCopy = cloneTemplateExercisesForActive(blueprint.exercises);
    expect(workingCopy).not.toBe(plan.exercises);
    expect(workingCopy[0]).not.toBe(plan.exercises[0]);
  });

  it('16. editing the active copy never mutates the planned record', () => {
    const plan = createScheduledFromTemplate(template(), '2026-10-02');
    const blueprint = buildActiveBlueprintFromScheduled(plan);
    const active = {
      name: blueprint.name,
      exercises: cloneTemplateExercisesForActive(blueprint.exercises),
    };
    // User changes 100×5 → 110×5 mid-session.
    active.exercises[0].sets[0].kg = 110;
    active.exercises[0].sets.push({ kg: 110, reps: 5 });
    expect(plan.exercises[0].sets[0].kg).toBe(100);
    expect(plan.exercises[0].sets).toHaveLength(2);
  });

  it('17. repeated starts produce independent working copies', () => {
    const plan = createScheduledFromTemplate(template(), '2026-10-02');
    const first = cloneTemplateExercisesForActive(buildActiveBlueprintFromScheduled(plan).exercises);
    const second = cloneTemplateExercisesForActive(buildActiveBlueprintFromScheduled(plan).exercises);
    first[0].sets[0].kg = 110;
    expect(second[0].sets[0].kg).toBe(100);
    expect(plan.exercises[0].sets[0].kg).toBe(100);
  });

  it('18. editing the template never mutates the scheduled snapshot', () => {
    const tpl = template();
    const plan = createScheduledFromTemplate(tpl, '2026-10-02');
    tpl.exercises[0].sets[0].kg = 110; // user edits Push A to 110×5
    tpl.exercises.push({ name: 'Added Later', sets: [] });
    tpl.name = 'Push A v2';
    expect(plan.name).toBe('Push A');
    expect(plan.exercises[0].sets[0].kg).toBe(100);
    expect(plan.exercises).toHaveLength(2);
  });

  it('18b. snapshots strip runtime fields (completed / hints / PR flags)', () => {
    const tpl = template({
      exercises: [
        {
          exerciseId: 'e1',
          name: 'Bench',
          sets: [
            { kg: 100, reps: 5, completed: true, suggestedKg: 1, suggestedReps: 2, isBest1RM: true },
          ],
        },
      ],
    });
    const plan = createScheduledFromTemplate(tpl, '2026-10-02');
    expect(plan.exercises[0].sets[0]).toMatchObject({ kg: 100, reps: 5, completed: false });
    expect(plan.exercises[0].sets[0].suggestedKg).toBeUndefined();
    expect(plan.exercises[0].sets[0].isBest1RM).toBeFalsy();
  });
});

/* LIFECYCLE (19–22) */
describe('scheduled workouts — lifecycle', () => {
  const twoPlans = () => [
    createScheduledFromTemplate(template(), '2026-10-05', { id: 'mon' }),
    createScheduledFromTemplate(template({ name: 'Pull' }), '2026-10-05', { id: 'mon2' }),
  ];

  it('19. reschedule moves (no duplicate, old date cleared)', () => {
    let list = twoPlans();
    list = rescheduleScheduledWorkout(list, 'mon', '2026-10-08');
    expect(getScheduledForDay(list, '2026-10-05').map((p) => p.id)).toEqual(['mon2']);
    expect(getScheduledForDay(list, '2026-10-08').map((p) => p.id)).toEqual(['mon']);
    expect(list).toHaveLength(2);
    expect(getScheduledById(list, 'mon').updatedAt).toBeTruthy();
  });

  it('19b. reschedule rejects invalid dates (list untouched)', () => {
    const list = twoPlans();
    expect(rescheduleScheduledWorkout(list, 'mon', 'never')).toBe(list);
    expect(updateScheduledWorkout(list, 'mon', { dateKey: 'never' })).toBe(list);
  });

  it('20. delete removes only the planned event', () => {
    const tpl = template();
    let list = twoPlans();
    list = deleteScheduledWorkout(list, 'mon');
    expect(list).toHaveLength(1);
    expect(getScheduledById(list, 'mon')).toBeNull();
    // Source template object the plan came from is untouched by construction.
    expect(tpl.exercises).toHaveLength(2);
  });

  it('21. planned + completed coexist on the same day', () => {
    const plans = [createScheduledFromTemplate(template(), '2026-10-02', { id: 'p' })];
    const workouts = [
      { id: 'w1', name: 'Push A', date: '2026-10-02T18:00:00.000Z', exercises: [] },
    ];
    expect(getScheduledForDay(plans, '2026-10-02')).toHaveLength(1);
    expect(getCompletedForDay(workouts, '2026-10-02')).toHaveLength(1);
    const idx = buildMonthDayIndex({ scheduled: plans, workouts });
    expect(idx.get('2026-10-02')).toEqual({ planned: 1, completed: 1 });
  });

  it('22. completion links (marks fulfilled, keeps history canonical)', () => {
    let list = [createScheduledFromTemplate(template(), '2026-10-02', { id: 'p' })];
    list = markScheduledCompleted(list, 'p', 'w99');
    const plan = getScheduledById(list, 'p');
    expect(plan.status).toBe(SCHEDULED_STATUS.COMPLETED);
    expect(plan.completedWorkoutId).toBe('w99');
    // Fulfilled plans leave the actionable lane…
    expect(getScheduledForDay(list, '2026-10-02')).toEqual([]);
    // …but stay visible as fulfilment evidence.
    expect(getCompletedPlansForDay(list, '2026-10-02')).toHaveLength(1);
    // History itself is never written by this module.
    expect(plan.exercises[0].sets[0].completed).toBe(false);
  });
});

/* EDGE (23–25) */
describe('scheduled workouts — edge cases', () => {
  it('23. stale template id stays startable via its snapshot', () => {
    const plan = createScheduledFromTemplate(template(), '2026-10-02');
    expect(resolveScheduledSource(plan, []).kind).toBe('stale');
    expect(resolveScheduledSource(plan, [{ id: 'other' }]).kind).toBe('stale');
    const blueprint = buildActiveBlueprintFromScheduled(plan);
    expect(blueprint.exercises[0].name).toBe('Bench');
  });

  it('23b. custom (template-less) plans resolve as custom', () => {
    const plan = createScheduledCustom({
      name: 'X',
      dateKey: '2026-10-02',
      exercises: [{ name: 'Dip', sets: [{ kg: 0, reps: 10 }] }],
    });
    expect(resolveScheduledSource(plan, [template()]).kind).toBe('custom');
  });

  it('24. stale exercises survive (kept safely, never crash summaries)', () => {
    const plan = createScheduledFromTemplate(template(), '2026-10-02');
    const summary = summarizeScheduled(plan);
    expect(summary).toMatchObject({ exerciseCount: 2, setCount: 3 });
    expect(summarizeScheduled(null)).toMatchObject({ exerciseCount: 0, setCount: 0 });
    expect(summarizeScheduled({})).toMatchObject({ exerciseCount: 0, setCount: 0 });
  });

  it('25. legacy/malformed data normalizes honestly (never NaN/undefined)', () => {
    expect(normalizeScheduledWorkout(null)).toBeNull();
    expect(normalizeScheduledWorkout({})).toBeNull();
    expect(normalizeScheduledWorkout({ id: 'x' })).toBeNull();
    expect(normalizeScheduledWorkout({ id: 'x', dateKey: '2026-10-02' }).name).toBe('Planned Workout');
    expect(normalizeScheduledWorkout({ id: 'x', dateKey: '2026-10-02', status: 'weird' }).status).toBe('planned');
    expect(normalizeScheduledWorkout({ id: 'x', dateKey: '2026-10-02', exercises: 'nope' }).exercises).toEqual([]);
    expect(normalizeScheduledList('nope')).toEqual([]);
  });

  it('month index ignores malformed plans, activeWorkout echoes, and dateless history', () => {
    const idx = buildMonthDayIndex({
      scheduled: [
        { id: 'bad', dateKey: 'someday' },
        { id: 'done', dateKey: '2026-10-02', status: 'completed' },
        createScheduledFromTemplate(template(), '2026-10-02'),
      ],
      workouts: [
        { id: 'activeWorkout', date: '2026-10-02', exercises: [] },
        { id: 'w1', date: '2026-10-02T10:00:00.000Z', exercises: [] },
        { id: 'w2', date: 'garbage', exercises: [] },
        null,
      ],
    });
    expect(idx.get('2026-10-02')).toEqual({ planned: 1, completed: 1 });
    expect(idx.has('someday')).toBe(false);
  });

  it('upcoming plans: today-onward, soonest first, bounded, fulfilled excluded', () => {
    const mk = (id, dateKey, status = 'planned') => ({
      id, dateKey, status, createdAt: `${dateKey}T00:00:00.000Z`,
    });
    const list = [
      mk('past', '2026-09-01'),
      mk('fri', '2026-10-02'),
      mk('mon', '2026-10-05'),
      mk('done', '2026-10-03', 'completed'),
      mk('bad', 'someday'),
    ];
    const upcoming = getUpcomingPlans(list, { now: new Date(2026, 8, 15), limit: 5 });
    expect(upcoming.map((p) => p.id)).toEqual(['fri', 'mon']);
    expect(getUpcomingPlans(list, { now: new Date(2026, 8, 15), limit: 1 })).toHaveLength(1);
    expect(getUpcomingPlans(null)).toEqual([]);
  });

  it('snapshotExercises never shares references with the source', () => {
    const src = [{ name: 'Bench', sets: [{ kg: 100, reps: 5 }], targetMuscles: ['chest'] }];
    const snap = snapshotExercises(src);
    snap[0].sets[0].kg = 1;
    snap[0].targetMuscles.push('x');
    expect(src[0].sets[0].kg).toBe(100);
    expect(src[0].targetMuscles).toEqual(['chest']);
    expect(snapshotExercises(null)).toEqual([]);
  });
});
