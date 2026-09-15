import React from 'react';
import { Download, Upload, X, Check, TriangleAlert } from 'lucide-react';

const SettingToggle = ({ pressed, onToggle, label }) => (
  <button
    onClick={onToggle}
    role="switch"
    aria-checked={Boolean(pressed)}
    aria-label={label}
    className={`w-12 h-7 rounded-full transition-all flex items-center px-1 shrink-0 ${
      pressed ? 'bg-emerald-600' : 'bg-slate-600'
    }`}
  >
    <span className={`w-5 h-5 rounded-full bg-white transition-transform ui-toggle-thumb-spring ${pressed ? 'translate-x-5' : ''}`} aria-hidden="true" />
  </button>
);

export const SettingsView = ({
  weeklyGoal,
  onWeeklyGoalChange,
  onExport,
  onImport,
  onReset,
  showExportModal,
  setShowExportModal,
  exportType,
  setExportType,
  exportPeriod,
  setExportPeriod,
  exportStartDate,
  setExportStartDate,
  exportEndDate,
  setExportEndDate,
  exportExerciseId,
  setExportExerciseId,
  exercisesDB = [],
  onOpenExportData,
  defaultStatsRange = '3months',
  onDefaultStatsRangeChange,
  enablePerformanceAlerts = true,
  onEnablePerformanceAlertsChange,
  enableHapticFeedback = false,
  onEnableHapticFeedbackChange,
  reduceAnimations = false,
  onReduceAnimationsChange,
  restDurationSec = 90,
  onRestDurationChange,
  restAutoStart = true,
  onRestAutoStartChange,
  restSoundEnabled = true,
  onRestSoundEnabledChange,
  // display prefs
}) => {
  const formatRestDuration = (sec) => {
    const s = Math.max(0, Math.round(Number(sec)) || 0);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
  const applyAccentColor = (hex) => {
    const root = document.documentElement;
    root.classList.add('ui-accent-transition');
    root.style.setProperty('--accent', hex);
    localStorage.setItem('accentColor', hex);
    window.setTimeout(() => root.classList.remove('ui-accent-transition'), 220);
  };
  const currentAccent = (() => {
    try {
      return localStorage.getItem('accentColor');
    } catch {
      return null;
    }
  })();

  return (
    <div className="bg-black text-white pb-16">
      {/* Header */}
      <div className="bg-black/95 backdrop-blur border-b border-white/10 p-4 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto">
          <h1 className="ui-display">Settings</h1>
          <p className="ui-micro mt-1">App configuration</p>
        </div>
      </div>

      <div className="p-4 space-y-6 max-w-2xl mx-auto">
        {/* TRAINING */}
        <section aria-label="Training settings">
          <div className="ui-section-head">
            <h2 className="ui-micro">Training</h2>
          </div>
          <div className="ui-surface-secondary p-4 space-y-4">
            <div>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="ui-card-title">Weekly goal</p>
                  <p className="ui-secondary mt-0.5">Target workouts per week · now {weeklyGoal}</p>
                </div>
              </div>
              <label className="sr-only" htmlFor="weekly-goal">Target workouts per week</label>
              <input
                id="weekly-goal"
                type="number"
                min="1"
                max="14"
                value={weeklyGoal}
                onChange={(e) => onWeeklyGoalChange(parseInt(e.target.value) || 1)}
                className="touch-input mt-2 w-full bg-slate-800/60 border border-slate-600/50 rounded-xl text-white font-bold focus:border-accent focus:outline-none transition"
                placeholder="Target workouts per week"
              />
            </div>
            <hr className="ui-divider" />
            <div>
              <label className="ui-card-title" htmlFor="stats-range">Statistics range</label>
              <p className="ui-secondary mt-0.5">Default window for Profile and Statistics</p>
              <select
                id="stats-range"
                value={defaultStatsRange}
                onChange={(e) => onDefaultStatsRangeChange && onDefaultStatsRangeChange(e.target.value)}
                className="touch-input mt-2 w-full bg-slate-800/60 border border-slate-600/50 rounded-xl text-white font-bold focus:border-accent focus:outline-none transition"
              >
                <option value="1week">7 Days</option>
                <option value="1month">30 Days</option>
                <option value="3months">3 Months</option>
                <option value="1year">1 Year</option>
              </select>
            </div>
          </div>
        </section>

        {/* FEEDBACK */}
        <section aria-label="Feedback settings">
          <div className="ui-section-head">
            <h2 className="ui-micro">Feedback</h2>
          </div>
          <div className="ui-surface-secondary divide-y divide-slate-700/30">
            <div className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="ui-card-title">Performance alerts</p>
                <p className="ui-secondary mt-0.5">Heaviest weight · best volume · best 1RM, from your 2nd session on</p>
              </div>
              <SettingToggle
                pressed={enablePerformanceAlerts}
                onToggle={() => onEnablePerformanceAlertsChange && onEnablePerformanceAlertsChange(!enablePerformanceAlerts)}
                label="Enable performance alerts"
              />
            </div>
            <div className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="ui-card-title">Haptic feedback</p>
                <p className="ui-secondary mt-0.5">Vibrate on PR and rest events</p>
              </div>
              <SettingToggle
                pressed={enableHapticFeedback}
                onToggle={() => onEnableHapticFeedbackChange && onEnableHapticFeedbackChange(!enableHapticFeedback)}
                label="Enable haptic feedback"
              />
            </div>
            <div className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="ui-card-title">Reduce animations</p>
                <p className="ui-secondary mt-0.5">Calmer motion for slower devices</p>
              </div>
              <SettingToggle
                pressed={reduceAnimations}
                onToggle={() => onReduceAnimationsChange && onReduceAnimationsChange(!reduceAnimations)}
                label="Reduce animations"
              />
            </div>
          </div>
        </section>

        {/* REST TIMER */}
        <section aria-label="Rest timer settings">
          <div className="ui-section-head">
            <h2 className="ui-micro">Rest timer</h2>
          </div>
          <div className="ui-surface-secondary p-4">
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-700/30">
              <div className="min-w-0">
                <p className="ui-card-title">Auto-start</p>
                <p className="ui-secondary mt-0.5">After work sets · never after warm-ups</p>
              </div>
              <SettingToggle
                pressed={restAutoStart}
                onToggle={() => onRestAutoStartChange && onRestAutoStartChange(!restAutoStart)}
                label="Toggle automatic rest timer"
              />
            </div>

            <p className="ui-micro mt-4">Default rest</p>
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => onRestDurationChange && onRestDurationChange(Number(restDurationSec) - 15)}
                className="ui-action-secondary flex-1 py-3 font-black min-h-[48px] ui-press"
                aria-label="Decrease default rest by 15 seconds"
              >
                −15s
              </button>
              <div
                className="flex-1 text-center font-mono text-2xl font-black text-white ui-metric"
                aria-label={`Default rest duration ${formatRestDuration(restDurationSec)}`}
                aria-live="polite"
              >
                {formatRestDuration(restDurationSec)}
              </div>
              <button
                onClick={() => onRestDurationChange && onRestDurationChange(Number(restDurationSec) + 15)}
                className="ui-action-secondary flex-1 py-3 font-black min-h-[48px] ui-press"
                aria-label="Increase default rest by 15 seconds"
              >
                +15s
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1.5 mt-2">
              {[60, 90, 120, 180].map((preset) => (
                <button
                  key={preset}
                  onClick={() => onRestDurationChange && onRestDurationChange(preset)}
                  className={`py-2.5 min-h-[44px] rounded-lg text-xs font-bold border transition ui-press ${
                    Number(restDurationSec) === preset
                      ? 'accent-bg text-white accent-border'
                      : 'bg-slate-800/50 border-slate-700/50 text-slate-300 hover:bg-slate-700/50'
                  }`}
                  aria-label={`Set default rest to ${formatRestDuration(preset)}`}
                  aria-pressed={Number(restDurationSec) === preset}
                >
                  {formatRestDuration(preset)}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-slate-700/30">
              <div className="min-w-0">
                <p className="ui-card-title">Completion sound</p>
                <p className="ui-secondary mt-0.5">Chime when rest ends</p>
              </div>
              <SettingToggle
                pressed={restSoundEnabled}
                onToggle={() => onRestSoundEnabledChange && onRestSoundEnabledChange(!restSoundEnabled)}
                label="Toggle rest completion sound"
              />
            </div>
          </div>
        </section>

        {/* DATA */}
        <section aria-label="Data management">
          <div className="ui-section-head">
            <h2 className="ui-micro">Data</h2>
          </div>
          <div className="ui-surface-secondary p-4">
            <div className="flex gap-2">
              <button
                onClick={onOpenExportData}
                className="ui-action-secondary flex-1 p-4 font-bold flex flex-col items-center gap-2 transition min-h-[76px] ui-press"
              >
                <Download size={20} aria-hidden="true" />
                <span className="text-xs font-semibold">Export Data</span>
              </button>
              <label className="ui-action-secondary flex-1 p-4 font-bold flex flex-col items-center gap-2 cursor-pointer transition min-h-[76px] ui-press">
                <Upload size={20} aria-hidden="true" />
                <span className="text-xs font-semibold">Import JSON</span>
                <input type="file" accept=".json" onChange={onImport} className="hidden" aria-label="Import JSON file" />
              </label>
            </div>
          </div>
        </section>

        {/* APPEARANCE */}
        <section aria-label="Appearance">
          <div className="ui-section-head">
            <h2 className="ui-micro">Appearance</h2>
          </div>
          <div className="ui-surface-secondary p-4">
            <p className="ui-card-title">Accent color</p>
            <p className="ui-secondary mt-0.5">Used for primary actions and highlights</p>
            <div className="grid grid-cols-2 gap-2 mt-3" role="radiogroup" aria-label="Accent color">
              {[
                { name: 'Emerald', hex: '#059669' },
                { name: 'Orchid', hex: '#a855f7' },
                { name: 'Crimson', hex: '#dc2626' },
                { name: 'Rose Magenta', hex: '#db2777' },
                { name: 'Deep Purple', hex: '#7c3aed' },
                { name: 'Indigo', hex: '#4f46e5' },
                { name: 'Slate Steel', hex: '#64748b' },
                { name: 'Deep Ocean', hex: '#0369a1' }
              ].map(color => {
                const selected = currentAccent === color.hex;
                return (
                  <button
                    key={color.hex}
                    role="radio"
                    aria-checked={selected}
                    onClick={() => applyAccentColor(color.hex)}
                    aria-label={`${color.name} accent${selected ? ', selected' : ''}`}
                    className={`p-3 rounded-xl border-2 text-left transition-all ui-press min-h-[64px] ${
                      selected ? '' : 'border-slate-700/50 hover:border-slate-600'
                    }`}
                    style={{
                      backgroundColor: `${color.hex}20`,
                      borderColor: selected ? color.hex : undefined
                    }}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-white truncate">{color.name}</span>
                      <span className="w-4 h-4 rounded-full shrink-0 border border-white/20" style={{ backgroundColor: color.hex }} aria-hidden="true" />
                    </span>
                    <span className="mt-1 flex items-center gap-1 text-[11px] text-slate-400 font-semibold">
                      <span>{color.hex}</span>
                      {selected && <Check size={12} className="text-emerald-300" aria-hidden="true" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* DANGER ZONE */}
        <section aria-label="Danger zone">
          <div className="ui-section-head">
            <h2 className="ui-micro !text-red-300/80">Danger zone</h2>
          </div>
          <div className="ui-danger-card p-4">
            <div className="flex items-start gap-2.5">
              <TriangleAlert size={18} className="text-red-300 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="min-w-0">
                <p className="ui-card-title !text-red-200">Reset app</p>
                <p className="ui-secondary mt-0.5 !text-red-200/70">Erases workouts, exercises, templates and settings. This cannot be undone.</p>
              </div>
            </div>
            <button
              onClick={onReset}
              className="w-full mt-3 rounded-xl p-4 min-h-[52px] font-bold transition bg-red-600/20 border border-red-500/40 text-red-200 hover:bg-red-600/30 ui-press"
            >
              Reset App
            </button>
          </div>
        </section>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 ui-backdrop-in">
          <div className="bg-[#0b1220] text-white p-6 rounded-2xl w-full max-w-md border border-white/10 shadow-2xl ui-sheet-rise-anim max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5 pb-4 border-b border-white/10">
              <h3 className="ui-section-title">Export data</h3>
              <button onClick={() => setShowExportModal(false)} aria-label="Close export dialog" className="p-2 hover:bg-white/10 rounded-lg transition text-slate-400 min-w-[44px] min-h-[44px] flex items-center justify-center">
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Export Type */}
              <div>
                <label className="ui-micro" htmlFor="export-type">Type</label>
                <select
                  id="export-type"
                  value={exportType}
                  onChange={(e) => setExportType(e.target.value)}
                  className="touch-input mt-1.5 w-full bg-slate-800/60 border border-slate-600/50 rounded-lg text-white font-semibold focus:border-accent focus:outline-none transition"
                >
                  <option value="all">All Data</option>
                  <option value="workouts">Workouts Only</option>
                  <option value="exercises">Exercises Data</option>
                  <option value="singleExercise">Single Exercise</option>
                </select>
              </div>

              {/* Time Period */}
              <div>
                <label className="ui-micro" htmlFor="export-period">Time period</label>
                <select
                  id="export-period"
                  value={exportPeriod}
                  onChange={(e) => setExportPeriod(e.target.value)}
                  className="touch-input mt-1.5 w-full bg-slate-800/60 border border-slate-600/50 rounded-lg text-white font-semibold focus:border-accent focus:outline-none transition"
                >
                  <option value="all">All Time</option>
                  <option value="last7">Last 7 Days</option>
                  <option value="last30">Last 30 Days</option>
                  <option value="last90">Last 90 Days</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>

              {/* Custom Date Range */}
              {exportPeriod === 'custom' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="ui-micro" htmlFor="export-from">From</label>
                    <input
                      id="export-from"
                      type="date"
                      value={exportStartDate}
                      onChange={(e) => setExportStartDate(e.target.value)}
                      className="touch-input mt-1.5 w-full bg-slate-800/60 border border-slate-600/50 rounded-lg text-white font-semibold focus:border-accent focus:outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="ui-micro" htmlFor="export-to">To</label>
                    <input
                      id="export-to"
                      type="date"
                      value={exportEndDate}
                      onChange={(e) => setExportEndDate(e.target.value)}
                      className="touch-input mt-1.5 w-full bg-slate-800/60 border border-slate-600/50 rounded-lg text-white font-semibold focus:border-accent focus:outline-none transition"
                    />
                  </div>
                </div>
              )}

              {/* Exercise Selection */}
              {exportType === 'singleExercise' && (
                <div>
                  <label className="ui-micro" htmlFor="export-exercise">Exercise</label>
                  <select
                    id="export-exercise"
                    value={exportExerciseId || ''}
                    onChange={(e) => setExportExerciseId(e.target.value ? parseInt(e.target.value) : null)}
                    className="touch-input mt-1.5 w-full bg-slate-800/60 border border-slate-600/50 rounded-lg text-white font-semibold focus:border-accent focus:outline-none transition"
                  >
                    <option value="">Choose an exercise...</option>
                    {exercisesDB && exercisesDB.map((ex, index) => (
                      <option key={ex?.id || `exercise-${index}`} value={ex?.id || ''}>{ex?.name || 'Unknown'}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Export Button */}
              <button
                onClick={onExport}
                className="ui-finish-primary w-full p-4 font-bold transition min-h-[52px] ui-press mt-2"
              >
                Export
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
