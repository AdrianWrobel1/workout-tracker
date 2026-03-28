import React, { useMemo } from 'react';
import { getActivePlanForTemplate, calculateWeightRangeForPlan } from '../domain/templatePlans';
import { calculate1RM } from '../domain/calculations';

export const PlanGuidanceDisplay = ({ template, sets = [], plan: activePlanProp = null }) => {
  const plan = useMemo(() => {
    if (activePlanProp) return activePlanProp;
    if (!template) return null;
    return getActivePlanForTemplate(template);
  }, [template, activePlanProp]);

  // Calculate 1RM from recent sets if available
  const estimate1RM = useMemo(() => {
    if (!sets || sets.length === 0) return null;
    
    // Find heaviest set (completed and with both weight and reps)
    let max1RM = 0;
    sets.forEach(set => {
      if (set.kg && set.reps && !set.skipped) {
        const rm = calculate1RM(Number(set.kg), Number(set.reps));
        max1RM = Math.max(max1RM, rm);
      }
    });
    
    return max1RM > 0 ? max1RM : null;
  }, [sets]);

  const weightRange = useMemo(() => {
    if (!plan || !plan.percentageRange || !estimate1RM) return null;
    return calculateWeightRangeForPlan(plan, estimate1RM);
  }, [estimate1RM, plan]);

  if (!plan || !plan.percentageRange) return null;

  if (!weightRange) {
    return (
      <div className="text-[10px] text-slate-500 italic">
        No weight history - {plan.name}
      </div>
    );
  }

  const intensityColors = {
    light: 'from-green-600 to-green-700 border-green-600',
    moderate: 'from-blue-600 to-blue-700 border-blue-600',
    high: 'from-orange-600 to-orange-700 border-orange-600',
    veryhigh: 'from-red-600 to-red-700 border-red-600'
  };

  return (
    <div className={`
      bg-gradient-to-r ${intensityColors[plan.intensityLevel]}
      border rounded px-2.5 py-1.5 flex items-center justify-between
      text-white text-[10px] font-semibold
    `}>
      <div className="flex items-center gap-2 flex-1">
        <span>{plan.name}</span>
        <span className="opacity-75">•</span>
        <span>{weightRange.range}</span>
      </div>
      <span className="opacity-75 ml-2">{plan.repRange}</span>
    </div>
  );
};

export default PlanGuidanceDisplay;
