import React, { useState } from 'react';
import { useSmartPlan } from '../contexts/SmartPlanContext';
import { AlertCircle, TrendingUp, Calendar, Zap, Award } from 'lucide-react';

/**
 * Smart Plan Panel Component
 * Displays AI coaching recommendations, session planning, and progress tracking
 */
export const SmartPlanPanel = () => {
  const { sessionPlan, weeklyPlan, trainingGaps, progressionReport } = useSmartPlan();
  const [expandedSection, setExpandedSection] = useState('session');

  if (!sessionPlan) return null;

  return (
    <div className="space-y-4">
      {/* Session Plan */}
      <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-xl p-4 hover:border-slate-600/70 transition">
        <button
          onClick={() => setExpandedSection(expandedSection === 'session' ? null : 'session')}
          className="w-full flex items-center justify-between mb-3"
        >
          <div className="flex items-center gap-2">
            <Zap size={18} className="text-blue-400" />
            <h3 className="text-sm font-bold text-white">Today's Coaching</h3>
          </div>
          <span className={`text-xs text-slate-400 transform transition ${expandedSection === 'session' ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </button>

        <div className="space-y-3">
          <div className={`rounded-lg p-3 ${
            sessionPlan.sessionType === 'intensity'
              ? 'bg-red-500/10 border border-red-500/30'
              : sessionPlan.sessionType === 'deload'
              ? 'bg-cyan-500/10 border border-cyan-500/30'
              : 'bg-slate-700/30 border border-slate-600/30'
          }`}>
            <p className="text-xs text-slate-400">RECOMMENDATION</p>
            <p className="text-sm font-bold text-white mt-1">{sessionPlan.headline}</p>
            <p className="text-xs text-slate-300 mt-2">{sessionPlan.description}</p>
          </div>

          {expandedSection === 'session' && (
            <>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-slate-800/50 border border-slate-700/30 rounded-lg p-2">
                  <p className="text-slate-400">Sets</p>
                  <p className="font-bold text-white">{sessionPlan.sets}</p>
                </div>
                <div className="bg-slate-800/50 border border-slate-700/30 rounded-lg p-2">
                  <p className="text-slate-400">Reps</p>
                  <p className="font-bold text-white">{sessionPlan.reps}</p>
                </div>
                <div className="bg-slate-800/50 border border-slate-700/30 rounded-lg p-2">
                  <p className="text-slate-400">Rest</p>
                  <p className="font-bold text-white text-[10px]">{sessionPlan.restPeriod}</p>
                </div>
              </div>

              {sessionPlan.focusAreas.length > 0 && (
                <div className="bg-slate-700/20 border border-slate-600/30 rounded-lg p-3">
                  <p className="text-xs text-slate-400 font-semibold mb-2">FOCUS AREAS</p>
                  <ul className="space-y-1">
                    {sessionPlan.focusAreas.map((area, idx) => (
                      <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                        <span className="text-blue-400 mt-0.5">•</span>
                        <span>{area}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {sessionPlan.warnings.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-amber-300 font-semibold mb-1">CAUTION</p>
                      {sessionPlan.warnings.map((warn, idx) => (
                        <p key={idx} className="text-xs text-amber-100">{warn}</p>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-slate-800/30 border border-slate-700/30 rounded-lg p-2">
                <p className="text-[10px] text-slate-400">Recovery Score: <span className="font-bold text-cyan-300">{sessionPlan.recoveryScore}%</span></p>
                <p className="text-[10px] text-slate-300 mt-1">{sessionPlan.readinessAdvice}</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Weekly Plan */}
      {weeklyPlan && (
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-xl p-4">
          <button
            onClick={() => setExpandedSection(expandedSection === 'weekly' ? null : 'weekly')}
            className="w-full flex items-center justify-between mb-3"
          >
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-emerald-400" />
              <h3 className="text-sm font-bold text-white">This Week</h3>
              <span className="text-xs text-slate-400">({weeklyPlan.completedSessions}/{weeklyPlan.targetSessions})</span>
            </div>
            <span className={`text-xs text-slate-400 transform transition ${expandedSection === 'weekly' ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>

          <p className="text-xs text-slate-400 mb-2">{weeklyPlan.overallTheme}</p>

          {expandedSection === 'weekly' && (
            <div className="space-y-2">
              {weeklyPlan.plan.map((day, idx) => (
                <div
                  key={idx}
                  className={`text-xs p-2 rounded-lg border ${
                    day.recommendation === 'OFF'
                      ? 'bg-slate-800/30 border-slate-700/30'
                      : day.recommendation === 'INTENSITY'
                      ? 'bg-red-500/10 border-red-500/20'
                      : day.recommendation === 'VOLUME'
                      ? 'bg-blue-500/10 border-blue-500/20'
                      : 'bg-emerald-500/10 border-emerald-500/20'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-200">{day.day}</span>
                    <span className={`font-bold ${
                      day.recommendation === 'OFF'
                        ? 'text-slate-400'
                        : day.recommendation === 'INTENSITY'
                        ? 'text-red-300'
                        : day.recommendation === 'VOLUME'
                        ? 'text-blue-300'
                        : 'text-emerald-300'
                    }`}>
                      {day.recommendation}
                    </span>
                  </div>
                  {day.focus && <p className="text-[10px] text-slate-400 mt-1">{day.focus}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Progress Report */}
      {progressionReport && (
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-xl p-4">
          <button
            onClick={() => setExpandedSection(expandedSection === 'progress' ? null : 'progress')}
            className="w-full flex items-center justify-between mb-3"
          >
            <div className="flex items-center gap-2">
              <TrendingUp size={18} className="text-purple-400" />
              <h3 className="text-sm font-bold text-white">Progress</h3>
            </div>
            <span className={`text-xs text-slate-400 transform transition ${expandedSection === 'progress' ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>

          <p className="text-xs text-slate-400 mb-2">{progressionReport.trend}</p>

          {expandedSection === 'progress' && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-800/30 border border-slate-700/30 rounded-lg p-2">
                <p className="text-slate-400">30-Day Sessions</p>
                <p className="text-lg font-bold text-white">{progressionReport.sessions30d}</p>
              </div>
              <div className="bg-slate-800/30 border border-slate-700/30 rounded-lg p-2">
                <p className="text-slate-400">Volume Progress</p>
                <p className={`text-lg font-bold ${progressionReport.volumeProgress > 0 ? 'text-emerald-300' : 'text-slate-300'}`}>
                  {progressionReport.volumeProgress > 0 ? '+' : ''}{progressionReport.volumeProgress}%
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Training Gaps */}
      {trainingGaps && trainingGaps.recommendations.length > 0 && (
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-xl p-4">
          <button
            onClick={() => setExpandedSection(expandedSection === 'gaps' ? null : 'gaps')}
            className="w-full flex items-center justify-between mb-3"
          >
            <div className="flex items-center gap-2">
              <Award size={18} className="text-amber-400" />
              <h3 className="text-sm font-bold text-white">Opportunities</h3>
            </div>
            <span className={`text-xs text-slate-400 transform transition ${expandedSection === 'gaps' ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>

          {expandedSection === 'gaps' && (
            <ul className="space-y-2">
              {trainingGaps.recommendations.slice(0, 3).map((rec, idx) => (
                <li key={idx} className="text-xs text-slate-300 bg-slate-800/30 border border-slate-700/30 rounded-lg p-2 flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">➜</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
