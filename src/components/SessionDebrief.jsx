import React, { useState, useEffect } from 'react';
import { generateCoachLens, generatePostWorkoutInsights, detectAnomalies, extractKeyMetrics } from '../domain/workouts';
import { useDebriefs } from '../contexts/DebriefsContext';
import { useMotivation } from '../contexts/MotivationContext';

export default function SessionDebrief({ workout, allWorkouts, exercisesDB }) {
  const { createDebrief } = useDebriefs();
  const { addRewardPoints, addGoal } = useMotivation();
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [showMetrics, setShowMetrics] = useState(false);

  if (!workout) {
    return (
      <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg text-center">
        <p className="text-gray-600">No workout data available</p>
      </div>
    );
  }

  const coachLens = generateCoachLens(workout, allWorkouts || []);
  const insights = generatePostWorkoutInsights(workout, allWorkouts || []);
  const anomalies = detectAnomalies(workout, allWorkouts || []);
  const metrics = extractKeyMetrics(workout, allWorkouts || [], exercisesDB || []);

  const handleSaveDebrief = () => {
    if (notes.trim()) {
      createDebrief(workout.id || `workout_${workout.startTime}`, notes, metrics);
      addRewardPoints(25);
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 2000);
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Headline */}
      <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">
            {coachLens.status === 'push' ? '🚀' : coachLens.status === 'recover' ? '⏸' : '📊'}
          </span>
          <h3 className="font-bold text-lg">{coachLens.headline}</h3>
        </div>
        <p className="text-sm text-gray-600">{coachLens.confidence.toUpperCase()} CONFIDENCE</p>
      </div>

      {/* Quick Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
          <p className="text-xs text-gray-600 font-semibold">VOLUME</p>
          <p className="text-xl font-bold text-blue-700">{coachLens.snapshot.volume.toLocaleString()}</p>
          <p className={`text-xs ${coachLens.snapshot.volumeDeltaPct > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {coachLens.snapshot.volumeDeltaPct > 0 ? '+' : ''}{coachLens.snapshot.volumeDeltaPct}%
          </p>
        </div>
        <div className="p-3 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
          <p className="text-xs text-gray-600 font-semibold">COMPLETION</p>
          <p className="text-xl font-bold text-green-700">{coachLens.snapshot.completionPct}%</p>
          <p className="text-xs text-gray-600">{coachLens.snapshot.completedWorkSets}/{coachLens.snapshot.plannedWorkSets}</p>
        </div>
        <div className="p-3 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg">
          <p className="text-xs text-gray-600 font-semibold">DENSITY</p>
          <p className="text-xl font-bold text-purple-700">{coachLens.snapshot.density}</p>
          <p className="text-xs text-gray-600">volume/min</p>
        </div>
        <div className="p-3 bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg">
          <p className="text-xs text-gray-600 font-semibold">FOCUS</p>
          <p className="text-xl font-bold text-amber-700">{metrics.tempoAnalysis.avgRepsPerSet}</p>
          <p className="text-xs text-gray-600">avg reps/set</p>
        </div>
      </div>

      {/* Insights Box */}
      <div className="p-4 bg-white rounded-lg border border-gray-200 space-y-3">
        <h4 className="font-bold text-sm">SESSION INSIGHTS</h4>
        <div className="space-y-2">
          <div className="flex gap-2 items-start">
            <span className="text-lg">✓</span>
            <div>
              <p className="text-sm font-medium">What Went Well</p>
              <p className="text-xs text-gray-600">{coachLens.keep}</p>
            </div>
          </div>
          <div className="flex gap-2 items-start">
            <span className="text-lg">⚠</span>
            <div>
              <p className="text-sm font-medium">Room to Improve</p>
              <p className="text-xs text-gray-600">{coachLens.improve}</p>
            </div>
          </div>
          <div className="flex gap-2 items-start">
            <span className="text-lg">🎯</span>
            <div>
              <p className="text-sm font-medium">Next Session Focus</p>
              <p className="text-xs text-gray-600">{coachLens.focus}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Anomalies */}
      {anomalies.severity !== 'none' && (
        <div className={`p-4 rounded-lg border ${
          anomalies.severity === 'high' ? 'bg-red-50 border-red-200' :
          anomalies.severity === 'medium' ? 'bg-yellow-50 border-yellow-200' :
          'bg-blue-50 border-blue-200'
        }`}>
          <div className="flex gap-2 items-start">
            <span className="text-lg">
              {anomalies.severity === 'high' ? '🔴' : anomalies.severity === 'medium' ? '🟡' : '🔵'}
            </span>
            <div>
              <p className="font-semibold text-sm">Anomaly Detected</p>
              <div className="text-xs space-y-1 mt-2">
                {anomalies.anomalies.map((anom, idx) => (
                  <p key={idx}>• {anom.message}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Qualitative Notes */}
      <div className="p-4 bg-white rounded-lg border border-gray-200">
        <label className="block text-sm font-semibold mb-2">How did this session feel?</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Energy level, focus, pain, technique quality, mind state..."
          className="w-full p-3 border border-gray-300 rounded text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleSaveDebrief}
          disabled={!notes.trim() || submitted}
          className={`w-full mt-3 py-2 rounded font-semibold text-sm transition ${
            submitted
              ? 'bg-green-500 text-white'
              : notes.trim()
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-300 text-gray-600 cursor-not-allowed'
          }`}
        >
          {submitted ? '✓ Debrief saved!' : 'Save Debrief Notes'}
        </button>
      </div>

      {/* Advanced Metrics Toggle */}
      <div className="text-center">
        <button
          onClick={() => setShowMetrics(!showMetrics)}
          className="text-xs text-gray-600 hover:text-gray-900 underline"
        >
          {showMetrics ? 'Hide' : 'Show'} Advanced Metrics
        </button>
      </div>

      {showMetrics && (
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-300 space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="font-semibold text-gray-700">RM Progress</p>
              <p className="text-gray-600">{metrics.progressMetrics.topEstimated1RM} kg</p>
              <p className={metrics.progressMetrics.rmTrend === 'up' ? 'text-green-600' : metrics.progressMetrics.rmTrend === 'down' ? 'text-red-600' : 'text-gray-600'}>
                {metrics.progressMetrics.rmTrend === 'up' ? '↑' : metrics.progressMetrics.rmTrend === 'down' ? '↓' : '→'} vs {metrics.progressMetrics.previousMax1RM} kg
              </p>
            </div>
            <div>
              <p className="font-semibold text-gray-700">Volume Trend</p>
              <p className="text-gray-600">{metrics.volumeProgression.trend}</p>
              <p className="text-gray-600">{metrics.volumeProgression.current.toLocaleString()} total</p>
            </div>
            <div>
              <p className="font-semibold text-gray-700">Density Trend</p>
              <p className="text-gray-600">{metrics.densityTrend.current} vol/min</p>
              <p className={`text-${metrics.densityTrend.trend === 'improving' ? 'green' : metrics.densityTrend.trend === 'declining' ? 'red' : 'gray'}-600`}>
                {metrics.densityTrend.trend}
              </p>
            </div>
            <div>
              <p className="font-semibold text-gray-700">Tempo Profile</p>
              <p className="text-gray-600">Strength: {metrics.tempoAnalysis.distribution.low} | Power: {metrics.tempoAnalysis.distribution.mid} | Hypertrophy: {metrics.tempoAnalysis.distribution.high}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
