import React, { useMemo, useState, useContext } from 'react';
import { WorkoutContext } from '../contexts/WorkoutContext';
import { generateEliteCoaching } from '../domain/eliteCoachingEngine';

/**
 * EliteCoachingCard - Compact coaching prescription card for Quick Insights
 * Displays current training state and coaching recommendations
 */
export const EliteCoachingCard = ({ readiness, masteryData, anomalyDetection, onClick }) => {
  const { records } = useContext(WorkoutContext);
  const [expanded, setExpanded] = useState(false);

  const coaching = useMemo(() => {
    return generateEliteCoaching(records || [], readiness, masteryData, anomalyDetection);
  }, [records, readiness, masteryData, anomalyDetection]);

  const handleCardClick = () => {
    setExpanded(!expanded);
    onClick?.();
  };

  const intensityColors = {
    veryhigh: 'from-red-600 to-red-700 border-red-600',
    high: 'from-orange-600 to-orange-700 border-orange-600',
    moderate: 'from-blue-600 to-blue-700 border-blue-600',
    light: 'from-green-600 to-green-700 border-green-600'
  };

  const zoneEmojis = {
    peak: '🔥',
    growth: '📈',
    maintenance: '⚖️'
  };

  return (
    <div
      onClick={handleCardClick}
      className={`
        bg-gradient-to-br ${intensityColors[coaching.intensity]}
        border-2 rounded-lg p-4 cursor-pointer transition-all
        hover:shadow-lg hover:scale-102 transform duration-200
        text-white select-none
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="text-xs font-bold opacity-90 uppercase tracking-wider">
            {zoneEmojis[coaching.trainingZone]} {coaching.trainingZone}
          </div>
          <div className="text-lg font-bold leading-tight mt-1">
            {coaching.intensity.toUpperCase()}
          </div>
        </div>
        <div className="text-2xl text-white/80">{expanded ? '▼' : '▶'}</div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-white/20 rounded px-2 py-1 text-center">
          <div className="text-xs opacity-75">Reps</div>
          <div className="font-bold">{coaching.repRange}</div>
        </div>
        <div className="bg-white/20 rounded px-2 py-1 text-center">
          <div className="text-xs opacity-75">Sets</div>
          <div className="font-bold">{coaching.sets}</div>
        </div>
        <div className="bg-white/20 rounded px-2 py-1 text-center">
          <div className="text-xs opacity-75">Rest</div>
          <div className="font-bold text-xs">{coaching.restPeriod}</div>
        </div>
      </div>

      {/* Message */}
      <p className="text-sm leading-snug mb-3 text-white/95">{coaching.message}</p>

      {/* Techniques - collapse when not expanded */}
      {expanded && (
        <>
          <div className="border-t border-white/20 pt-3 mb-3">
            <div className="text-xs font-bold mb-2 opacity-75">RECOMMENDED TECHNIQUES</div>
            <div className="flex flex-wrap gap-1">
              {(coaching.techniques || []).map((tech, i) => (
                <span key={i} className="bg-white/20 rounded px-2 py-1 text-xs">
                  {tech}
                </span>
              ))}
            </div>
          </div>

          {/* Detailed rationale */}
          <div className="bg-white/10 rounded p-2 mb-2">
            <div className="text-xs opacity-75 mb-1">STATUS</div>
            <div className="text-xs font-mono">{coaching.rationale}</div>
          </div>

          {/* Anomaly warning */}
          {coaching.anomalyWarning && (
            <div className="bg-yellow-500/30 border border-yellow-400 rounded p-2 mb-2">
              <div className="text-xs font-bold text-yellow-100">{coaching.anomalyWarning}</div>
            </div>
          )}

          {/* Mastery bonus */}
          {coaching.masteryBonus && (
            <div className="bg-purple-400/30 border border-purple-300 rounded p-2 mb-2">
              <div className="text-xs font-bold text-purple-50">✨ {coaching.masteryBonus}</div>
            </div>
          )}

          {/* RPE Guidance */}
          {coaching.rpeGuidance && (
            <div className="border-t border-white/20 pt-3 mb-3">
              <div className="text-xs font-bold mb-2 opacity-75">RPE GUIDANCE</div>
              <div className="bg-white/10 rounded p-2 mb-2">
                <p className="text-[10px] text-white/80 mb-1">Target RPE: <span className="font-bold text-white">{coaching.rpeGuidance.targetRPE}</span></p>
                <p className="text-[10px] text-white/70">{coaching.rpeGuidance.description}</p>
              </div>
              {coaching.rpeGuidance.adjustmentTips?.length > 0 && (
                <div className="space-y-1">
                  {coaching.rpeGuidance.adjustmentTips.map((tip, i) => (
                    <p key={i} className="text-[9px] text-white/60 leading-tight">• {tip}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Autoregulation Tips */}
          {coaching.autoregulationTips?.length > 0 && (
            <div className="border-t border-white/20 pt-3 mb-3">
              <div className="text-xs font-bold mb-2 opacity-75">💡 AUTOREGULATION TIPS</div>
              {coaching.autoregulationTips.map((tip, i) => (
                <div key={i} className="bg-blue-500/10 border border-blue-400/30 rounded p-2 mb-1.5">
                  <p className="text-[10px] font-bold text-blue-200">{tip.title}</p>
                  <p className="text-[9px] text-blue-100/80 mt-1">{tip.content}</p>
                  <p className="text-[9px] text-blue-200 font-semibold mt-1">→ {tip.action}</p>
                </div>
              ))}
            </div>
          )}

          {/* Injury Risk Warnings */}
          {coaching.injuryRisks?.length > 0 && (
            <div className="border-t border-white/20 pt-3 mb-3">
              <div className="text-xs font-bold mb-2 opacity-75">⚠️ INJURY PREVENTION</div>
              {coaching.injuryRisks.map((risk, i) => (
                <div key={i} className={`rounded p-2 mb-1.5 border ${
                  risk.severity === 'high'
                    ? 'bg-red-500/10 border-red-400/30'
                    : 'bg-amber-500/10 border-amber-400/30'
                }`}>
                  <p className={`text-[10px] font-bold ${risk.severity === 'high' ? 'text-red-200' : 'text-amber-200'}`}>
                    {risk.message}
                  </p>
                  <p className={`text-[9px] ${risk.severity === 'high' ? 'text-red-100/80' : 'text-amber-100/80'} mt-1`}>
                    {risk.recommendation}
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Collapsed state hint */}
      {!expanded && (
        <div className="text-xs opacity-75 flex items-center gap-1">
          <span>RIR Target: {coaching.rirTarget}</span>
          <span>•</span>
          <span>Click for details</span>
        </div>
      )}
    </div>
  );
};

export default EliteCoachingCard;
