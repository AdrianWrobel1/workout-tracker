/**
 * Template Plans System
 * Allows users to define weight range guidance for each template
 * E.g., "Light: 60-70%", "Work: 80-90%", "Heavy: 90%+"
 */

const defaultPlan = {
  id: null,
  name: 'Default',
  description: 'No weight guidance',
  intensityLevel: 'moderate', // light | moderate | high | veryhigh
  percentageRange: { min: 80, max: 90 },
  repRange: '8-12',
  rirTarget: 2,
  color: 'gray'
};

const presetPlans = {
  'strength': {
    name: 'Strength Focus',
    intensityLevel: 'high',
    percentageRange: { min: 85, max: 95 },
    repRange: '1-5',
    rirTarget: 1,
    description: 'Heavy compound lifts, max strength development',
    color: 'red'
  },
  'hypertrophy': {
    name: 'Hypertrophy Block',
    intensityLevel: 'moderate',
    percentageRange: { min: 70, max: 85 },
    repRange: '6-12',
    rirTarget: 2,
    description: 'Muscle building focus with controlled tempo',
    color: 'blue'
  },
  'endurance': {
    name: 'Muscular Endurance',
    intensityLevel: 'light',
    percentageRange: { min: 60, max: 75 },
    repRange: '12-20',
    rirTarget: 3,
    description: 'High reps, lighter weight, conditioning',
    color: 'green'
  },
  'power': {
    name: 'Power Development',
    intensityLevel: 'veryhigh',
    percentageRange: { min: 75, max: 90 },
    repRange: '2-5',
    rirTarget: 0,
    description: 'Explosive movements, full recovery between sets',
    color: 'purple'
  },
  'deload': {
    name: 'Deload Week',
    intensityLevel: 'light',
    percentageRange: { min: 50, max: 70 },
    repRange: '10-15',
    rirTarget: 4,
    description: 'Light recovery work, form focus',
    color: 'yellow'
  }
};

export const createPlan = (name, intensityLevel, percentageMin, percentageMax, repRange, rirTarget) => {
  return {
    id: Date.now().toString(),
    name,
    intensityLevel,
    percentageRange: { min: percentageMin, max: percentageMax },
    repRange,
    rirTarget,
    color: GetColorForIntensity(intensityLevel),
    createdAt: new Date().toISOString()
  };
};

const GetColorForIntensity = (level) => {
  const colors = {
    light: 'green',
    moderate: 'blue',
    high: 'red',
    veryhigh: 'purple'
  };
  return colors[level] || 'gray';
};

export const getPlansForTemplate = (template) => {
  if (!template.plans || template.plans.length === 0) {
    return [defaultPlan];
  }
  return template.plans;
};

export const addPlanToTemplate = (template, plan) => {
  const updatedTemplate = { ...template };
  updatedTemplate.plans = [...(template.plans || []), plan];
  return updatedTemplate;
};

export const removePlanFromTemplate = (template, planId) => {
  const updatedTemplate = { ...template };
  updatedTemplate.plans = (template.plans || []).filter(p => p.id !== planId);
  return updatedTemplate;
};

export const setDefaultPlanForTemplate = (template, planId) => {
  const updatedTemplate = { ...template };
  updatedTemplate.defaultPlanId = planId;
  return updatedTemplate;
};

export const getActivePlanForTemplate = (template) => {
  if (template.defaultPlanId) {
    return (template.plans || []).find(p => p.id === template.defaultPlanId);
  }
  return (template.plans || []).length > 0 ? template.plans[0] : defaultPlan;
};

/**
 * Calculate weight range for an exercise based on plan and estimated 1RM
 */
export const calculateWeightRangeForPlan = (plan, estimate1RM) => {
  if (!plan || !estimate1RM) return null;

  const minWeight = (estimate1RM * plan.percentageRange.min) / 100;
  const maxWeight = (estimate1RM * plan.percentageRange.max) / 100;

  return {
    min: Math.round(minWeight * 2) / 2, // Round to nearest 0.5
    max: Math.round(maxWeight * 2) / 2,
    midpoint: Math.round(((minWeight + maxWeight) / 2) * 2) / 2,
    range: `${Math.round(minWeight * 2) / 2}kg - ${Math.round(maxWeight * 2) / 2}kg`,
    percentage: `${plan.percentageRange.min}% - ${plan.percentageRange.max}%`
  };
};

/**
 * Suggest plan based on training goals
 */
export const suggestPlanByGoal = (goal) => {
  const goalMap = {
    'strength': 'strength',
    'muscle': 'hypertrophy',
    'size': 'hypertrophy',
    'power': 'power',
    'endurance': 'endurance',
    'conditioning': 'endurance',
    'recovery': 'deload',
    'deload': 'deload'
  };

  const key = Object.keys(goalMap).find(k => goal?.toLowerCase().includes(k));
  return key ? presetPlans[goalMap[key]] : presetPlans['hypertrophy'];
};

export { presetPlans, defaultPlan };
