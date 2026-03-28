import React, { useMemo } from 'react';

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
        icon: '🎯',
        title: 'Execution Excellence',
        detail: 'Perfect set completion. Technique was on point throughout.'
      });
    } else if (completionRate > 80) {
      insights.push({
        type: 'strong',
        icon: '✓',
        title: 'Solid Execution',
        detail: `${Math.round(completionRate)}% of planned work completed cleanly.`
      });
    } else if (completionRate < 60) {
      insights.push({
        type: 'warning',
        icon: '⚠',
        title: 'Execution Challenge',
        detail: `Only ${Math.round(completionRate)}% of planned work completed. Consider reducing volume or intensity.`
      });
    }

    // Consistency analysis
    const excellentConsistency = Object.values(exerciseQuality).filter((e) => e.consistency === 'excellent').length;
    const variableConsistency = Object.values(exerciseQuality).filter((e) => e.consistency === 'variable').length;

    if (excellentConsistency > 0) {
      insights.push({
        type: 'excellent',
        icon: '💎',
        title: 'Technical Consistency',
        detail: `${excellentConsistency} exercise${excellentConsistency > 1 ? 's' : ''} showed tight rep-to-rep consistency.`
      });
    }

    if (variableConsistency > 0) {
      insights.push({
        type: 'caution',
        icon: '📍',
        title: 'Variable Output Detected',
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
          icon: '📉',
          title: 'Fatigue Pattern',
          detail: `${Math.round(volumeDrop * 100)}% volume drop across session. Rest longer between sets or reduce accessory work.`
        });
      } else if (volumeDrop < -0.1) {
        insights.push({
          type: 'strong',
          icon: '📈',
          title: 'Energy Escalation',
          detail: 'Volume increased through the session—excellent pacing and warm-up strategy.'
        });
      }
    }

    // Movement quality proxy: check for extreme rep ranges
    const veryLowReps = chronologicalSets.filter((s) => s.reps < 3).length;
    const veryHighReps = chronologicalSets.filter((s) => s.reps > 20).length;

    if (veryHighReps > chronologicalSets.length * 0.5) {
      insights.push({
        type: 'info',
        icon: '🔥',
        title: 'Hypertrophy Focus',
        detail: 'Session skewed toward higher reps. Good for muscle building; monitor joint stress.'
      });
    } else if (veryLowReps > chronologicalSets.length * 0.4) {
      insights.push({
        type: 'info',
        icon: '💪',
        title: 'Strength Emphasis',
        detail: 'Heavy work with low reps dominates. Recovery and CNS fatigue are key considerations.'
      });
    }

    return insights;
  }, [workout]);

  if (!workout) {
    return (
      <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg text-center">
        <p className="text-gray-600 text-sm">No workout data available</p>
      </div>
    );
  }

  if (analysis.length === 0) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg text-center">
        <p className="text-gray-600 text-sm">No technique patterns detected yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="font-bold text-sm px-1">ELITE COACHING INSIGHTS</h4>
      <div className="space-y-2">
        {analysis.map((insight, idx) => (
          <div
            key={idx}
            className={`p-3 rounded-lg border ${
              insight.type === 'exceptional'
                ? 'bg-green-50 border-green-200'
                : insight.type === 'strong'
                ? 'bg-blue-50 border-blue-200'
                : insight.type === 'excellent'
                ? 'bg-emerald-50 border-emerald-200'
                : insight.type === 'warning'
                ? 'bg-red-50 border-red-200'
                : insight.type === 'caution'
                ? 'bg-yellow-50 border-yellow-200'
                : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div className="flex gap-2 items-start">
              <span className="text-lg leading-5">{insight.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{insight.title}</p>
                <p className="text-xs text-gray-700 mt-1">{insight.detail}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
