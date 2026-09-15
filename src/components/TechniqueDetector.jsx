import React, { useMemo } from 'react';
import {
  Target, Check, AlertTriangle, Diamond, MapPin,
  TrendingDown, TrendingUp, Flame, Dumbbell,
} from 'lucide-react';

const TYPE_META = {
  exceptional: { Icon: Target, classes: 'bg-emerald-500/10 border-emerald-500/30', iconClass: 'text-emerald-300' },
  strong: { Icon: Check, classes: 'bg-sky-500/10 border-sky-500/30', iconClass: 'text-sky-300' },
  excellent: { Icon: Diamond, classes: 'bg-emerald-500/10 border-emerald-500/30', iconClass: 'text-emerald-300' },
  warning: { Icon: AlertTriangle, classes: 'bg-red-500/10 border-red-500/30', iconClass: 'text-red-300' },
  caution: { Icon: MapPin, classes: 'bg-amber-500/10 border-amber-500/30', iconClass: 'text-amber-300' },
  info: { Icon: Flame, classes: 'bg-slate-500/10 border-slate-500/30', iconClass: 'text-slate-300' },
};

export default function TechniqueDetector({ workout }) {
  const analysis = useMemo(() => {
    if (!workout) return [];

    const insights = [];

    // Analyze completed sets
    let totalCompletedSets = 0;
    let totalPlannedSets = 0;
    const exerciseQuality = {};

    (workout.exercises || []).forEach((ex) => {
      let completedCount = 0;
      let volumePerSet = [];

      (ex.sets || []).forEach((set) => {
        if (set.completed) {
          totalCompletedSets += 1;
          const kg = Number(set.kg) || 0;
          const reps = Number(set.reps) || 0;
          if (kg > 0 && reps > 0) {
            volumePerSet.push(kg * reps);
            completedCount += 1;
          }
        }
        totalPlannedSets += 1;
      });

      if (completedCount > 0) {
        const avgVolume = volumePerSet.reduce((a, b) => a + b, 0) / volumePerSet.length;
        const variance = volumePerSet.reduce((sum, v) => sum + Math.pow(v - avgVolume, 2), 0) / volumePerSet.length;
        const stdDev = Math.sqrt(variance);

        exerciseQuality[ex.exerciseId || ex.name] = {
          name: ex.name,
          completedRate: (completedCount / (ex.sets || []).length) * 100,
          avgVolume,
          consistency: stdDev < avgVolume * 0.15 ? 'excellent' : stdDev < avgVolume * 0.3 ? 'good' : 'variable'
        };
      }
    });

    // Technique Insights
    const completionRate = totalPlannedSets > 0 ? (totalCompletedSets / totalPlannedSets) * 100 : 0;

    if (completionRate > 95) {
      insights.push({
        type: 'exceptional',
        title: 'Execution excellence',
        detail: 'Perfect set completion. Technique was on point throughout.'
      });
    } else if (completionRate > 80) {
      insights.push({
        type: 'strong',
        title: 'Solid execution',
        detail: `${Math.round(completionRate)}% of planned work completed cleanly.`
      });
    } else if (completionRate < 60) {
      insights.push({
        type: 'warning',
        title: 'Execution challenge',
        detail: `Only ${Math.round(completionRate)}% of planned work completed. Consider reducing volume or intensity.`
      });
    }

    // Consistency analysis
    const excellentConsistency = Object.values(exerciseQuality).filter((e) => e.consistency === 'excellent').length;
    const variableConsistency = Object.values(exerciseQuality).filter((e) => e.consistency === 'variable').length;

    if (excellentConsistency > 0) {
      insights.push({
        type: 'excellent',
        title: 'Technical consistency',
        detail: `${excellentConsistency} exercise${excellentConsistency > 1 ? 's' : ''} showed tight rep-to-rep consistency.`
      });
    }

    if (variableConsistency > 0) {
      insights.push({
        type: 'caution',
        title: 'Variable output detected',
        detail: `${variableConsistency} exercise${variableConsistency > 1 ? 's' : ''} showed inconsistent rep quality. Focus on form over load next session.`
      });
    }

    // Load trajectory analysis
    const chronologicalSets = [];
    (workout.exercises || []).forEach((ex) => {
      (ex.sets || []).forEach((set, idx) => {
        if (set.completed) {
          chronologicalSets.push({
            kg: Number(set.kg) || 0,
            reps: Number(set.reps) || 0,
            order: idx
          });
        }
      });
    });

    if (chronologicalSets.length > 3) {
      const firstHalf = chronologicalSets.slice(0, Math.floor(chronologicalSets.length / 2));
      const secondHalf = chronologicalSets.slice(Math.floor(chronologicalSets.length / 2));

      const firstAvgVol = firstHalf.reduce((sum, s) => sum + s.kg * s.reps, 0) / firstHalf.length;
      const secondAvgVol = secondHalf.reduce((sum, s) => sum + s.kg * s.reps, 0) / secondHalf.length;

      const volumeDrop = (firstAvgVol - secondAvgVol) / firstAvgVol;

      if (volumeDrop > 0.2) {
        insights.push({
          type: 'warning',
          title: 'Fatigue pattern',
          detail: `${Math.round(volumeDrop * 100)}% volume drop across session. Rest longer between sets or reduce accessory work.`
        });
      } else if (volumeDrop < -0.1) {
        insights.push({
          type: 'strong',
          title: 'Energy escalation',
          detail: 'Volume increased through the session — excellent pacing and warm-up strategy.'
        });
      }
    }

    // Movement quality proxy: check for extreme rep ranges
    const veryLowReps = chronologicalSets.filter((s) => s.reps < 3).length;
    const veryHighReps = chronologicalSets.filter((s) => s.reps > 20).length;

    if (veryHighReps > chronologicalSets.length * 0.5) {
      insights.push({
        type: 'info',
        title: 'Hypertrophy focus',
        detail: 'Session skewed toward higher reps. Good for muscle building; monitor joint stress.'
      });
    } else if (veryLowReps > chronologicalSets.length * 0.4) {
      insights.push({
        type: 'info',
        title: 'Strength emphasis',
        detail: 'Heavy work with low reps dominates. Recovery and CNS fatigue are key considerations.'
      });
    }

    return insights;
  }, [workout]);

  if (!workout) {
    return (
      <div className="p-4 ui-surface-sub rounded-xl text-center">
        <p className="text-slate-400 text-sm font-semibold">No workout data available</p>
      </div>
    );
  }

  if (analysis.length === 0) {
    return (
      <div className="p-4 ui-surface-sub rounded-xl text-center">
        <p className="text-slate-500 text-[13px] font-semibold">No technique patterns detected yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <h4 className="text-sm font-black text-slate-200 uppercase tracking-widest px-1">Technique notes</h4>
      <ul className="space-y-2">
        {analysis.map((insight, idx) => {
          const meta = TYPE_META[insight.type] || TYPE_META.info;
          const Icon = insight.title === 'Fatigue pattern'
            ? TrendingDown
            : insight.title === 'Energy escalation'
              ? TrendingUp
              : insight.title === 'Strength emphasis'
                ? Dumbbell
                : meta.Icon;
          return (
            <li
              key={idx}
              className={`p-3 rounded-xl border ${meta.classes}`}
            >
              <div className="flex gap-2.5 items-start">
                <Icon size={16} className={`shrink-0 mt-0.5 ${meta.iconClass}`} aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-white">{insight.title}</p>
                  <p className="text-[13px] text-slate-400 mt-1 leading-relaxed">{insight.detail}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
