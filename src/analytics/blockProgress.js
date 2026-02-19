import { getTemplateWorkouts, getWeekStartKey, toTimestamp } from '../utils/workoutSelectors';

const DAY_MS = 24 * 60 * 60 * 1000;

const DEFAULT_OPTIONS = {
  strictTemplateIdMatch: true
};

const getElapsedWeeks = (startDate, endDate) => {
  const startTs = toTimestamp(startDate);
  const endTs = toTimestamp(endDate);
  if (startTs === null || endTs === null || endTs < startTs) return 0;
  return Math.floor((endTs - startTs) / (7 * DAY_MS)) + 1;
};

const sumTargetSessions = (weekPlan = [], weeksToCount = 0) => {
  if (!Array.isArray(weekPlan) || weekPlan.length === 0) return weeksToCount;
  let total = 0;
  for (let i = 0; i < weekPlan.length; i += 1) {
    const week = weekPlan[i];
    if ((week?.weekIndex || 0) > weeksToCount) continue;
    total += Number(week?.targetSessions) || 1;
  }
  return total;
};

export const calculateBlockProgress = (template, workouts = [], options = {}) => {
  const settings = { ...DEFAULT_OPTIONS, ...options };
  const block = template?.block || null;
  const weekPlan = block?.weekPlan || [];
  const plannedWeeks = Number(block?.durationWeeks) || weekPlan.length || 0;

  if (!template || !block) {
    return {
      isInBlock: false,
      weeksCompleted: 0,
      plannedWeeks,
      adherence: 0,
      deloadCompliance: null,
      status: 'on-track'
    };
  }

  const templateWorkouts = getTemplateWorkouts(workouts, template, settings);
  const now = options.now || new Date();
  const startDate = block?.startDate || null;
  const elapsedWeeks = startDate
    ? getElapsedWeeks(startDate, now)
    : Math.max(0, Number(block?.currentWeek) || 0);
  const weeksScope = plannedWeeks > 0 ? Math.min(elapsedWeeks, plannedWeeks) : elapsedWeeks;

  const uniqueWeeks = new Set();
  for (let i = 0; i < templateWorkouts.length; i += 1) {
    const workout = templateWorkouts[i];
    if (startDate) {
      const ts = toTimestamp(workout?.date);
      const startTs = toTimestamp(startDate);
      if (ts === null || startTs === null || ts < startTs) continue;
    }
    const weekKey = getWeekStartKey(workout?.date);
    if (weekKey) uniqueWeeks.add(weekKey);
  }
  const weeksCompleted = uniqueWeeks.size;

  const expectedSessions = sumTargetSessions(weekPlan, weeksScope);
  const completedSessions = templateWorkouts.length;
  const rawAdherence = expectedSessions > 0 ? (completedSessions / expectedSessions) : 0;
  const adherence = Number(rawAdherence.toFixed(2));

  let status = 'on-track';
  if (adherence > 1.05) status = 'ahead';
  else if (adherence < 0.8) status = 'behind';

  const deloadWeeks = weekPlan.filter(week => Boolean(week?.isDeload));
  let deloadCompliance = null;
  if (deloadWeeks.length > 0 && startDate) {
    let compliant = 0;
    for (let i = 0; i < deloadWeeks.length; i += 1) {
      const week = deloadWeeks[i];
      const idx = Math.max(0, (Number(week.weekIndex) || 1) - 1);
      const weekStart = new Date(startDate);
      weekStart.setDate(weekStart.getDate() + (idx * 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      let count = 0;
      for (let j = 0; j < templateWorkouts.length; j += 1) {
        const ts = toTimestamp(templateWorkouts[j]?.date);
        if (ts === null) continue;
        if (ts >= weekStart.getTime() && ts <= weekEnd.getTime()) count += 1;
      }

      const target = Number(week.targetSessions) || 1;
      if (count <= target) compliant += 1;
    }
    deloadCompliance = Number((compliant / deloadWeeks.length).toFixed(2));
  }

  const isInBlock = plannedWeeks > 0 ? weeksScope <= plannedWeeks : true;

  return {
    isInBlock,
    weeksCompleted,
    plannedWeeks,
    adherence,
    deloadCompliance,
    status
  };
};
