import React from 'react';
import { Download, Upload, X } from 'lucide-react';

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
  onDefaultStatsRangeChange
}) => {
  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Header */}
      <div className="bg-gradient-to-b from-black to-black/80 border-b border-white/10 p-4 sticky top-0 z-20 shadow-2xl">
        <h1 className="text-4xl font-black">SETTINGS</h1>
        <p className="text-xs text-slate-400 mt-2 font-semibold tracking-widest">APP CONFIGURATION</p>
      </div>

      <div className="p-4 space-y-5">
        {/* Weekly Goal Card */}
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-xl p-6">
          <h3 className="font-black text-white mb-3">Weekly Goal</h3>
          <input
            type="number"
            value={weeklyGoal}
            onChange={(e) => onWeeklyGoalChange(parseInt(e.target.value) || 1)}
            className="w-full bg-slate-800/50 border border-slate-600/50 rounded-lg px-4 py-3 text-white font-bold focus:border-blue-500 focus:outline-none transition"
            placeholder="Target workouts per week"
          />
        </div>

        {/* Default Stats Range Card */}
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-xl p-6">
          <h3 className="font-black text-white mb-3">Default Statistics Range</h3>
          <select
            value={defaultStatsRange}
            onChange={(e) => onDefaultStatsRangeChange && onDefaultStatsRangeChange(e.target.value)}
            className="w-full bg-slate-800/50 border border-slate-600/50 rounded-lg px-4 py-3 text-white font-bold focus:border-blue-500 focus:outline-none transition"
          >
            <option value="1week">7 Days</option>
            <option value="1month">30 Days</option>
            <option value="3months">3 Months</option>
            <option value="1year">1 Year</option>
          </select>
          <p className="text-xs text-slate-400 mt-2">This setting applies to Profile and Statistics views</p>
        </div>

        {/* Data Management Card */}
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-xl p-6">
          <h3 className="font-black text-white mb-4">Data Management</h3>
          <div className="flex gap-3">
            <button
              onClick={onOpenExportData}
              className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-lg p-4 font-bold flex flex-col items-center gap-2 transition shadow-lg shadow-blue-600/50 ui-press"
            >
              <Download size={20} />
              <span className="text-xs font-semibold">Export Data</span>
            </button>
            <label className="flex-1 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white rounded-lg p-4 font-bold flex flex-col items-center gap-2 cursor-pointer transition shadow-lg shadow-purple-600/50 ui-press">
              <Upload size={20} />
              <span className="text-xs font-semibold">Import JSON</span>
              <input type="file" accept=".json" onChange={onImport} className="hidden" />
            </label>
          </div>
        </div>

        {/* Reset Button */}
        <button
          onClick={onReset}
          className="w-full bg-gradient-to-r from-red-600/20 to-red-700/20 border border-red-500/30 hover:from-red-600/30 hover:to-red-700/30 text-red-400 rounded-lg p-4 font-bold transition"
        >
          Reset App
        </button>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-slate-900/95 to-black/95 text-white p-6 rounded-2xl w-full max-w-md border border-slate-700/50 shadow-2xl ui-modal-scale ui-fade-scale-anim">
            <div className="flex justify-between items-center mb-5 pb-4 border-b border-slate-700/50">
              <h3 className="text-2xl font-black">EXPORT DATA</h3>
              <button onClick={() => setShowExportModal(false)} className="p-2 hover:bg-white/10 rounded-lg transition text-slate-400">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Export Type */}
              <div>
                <label className="block text-xs text-slate-400 font-bold uppercase tracking-wider mb-2.5">Type</label>
                <select
                  value={exportType}
                  onChange={(e) => setExportType(e.target.value)}
                  className="w-full bg-slate-800/50 border border-slate-600/50 rounded-lg px-4 py-2 text-white font-semibold focus:border-blue-500 focus:outline-none transition"
                >
                  <option value="all">All Data</option>
                  <option value="workouts">Workouts Only</option>
                  <option value="exercises">Exercises Data</option>
                  <option value="singleExercise">Single Exercise</option>
                </select>
              </div>

              {/* Time Period */}
              <div>
                <label className="block text-xs text-slate-400 font-bold uppercase tracking-wider mb-2.5">Time Period</label>
                <select
                  value={exportPeriod}
                  onChange={(e) => setExportPeriod(e.target.value)}
                  className="w-full bg-slate-800/50 border border-slate-600/50 rounded-lg px-4 py-2 text-white font-semibold focus:border-blue-500 focus:outline-none transition"
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
                    <label className="block text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">From</label>
                    <input
                      type="date"
                      value={exportStartDate}
                      onChange={(e) => setExportStartDate(e.target.value)}
                      className="w-full bg-slate-800/50 border border-slate-600/50 rounded-lg px-4 py-2 text-white font-semibold focus:border-blue-500 focus:outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">To</label>
                    <input
                      type="date"
                      value={exportEndDate}
                      onChange={(e) => setExportEndDate(e.target.value)}
                      className="w-full bg-slate-800/50 border border-slate-600/50 rounded-lg px-4 py-2 text-white font-semibold focus:border-blue-500 focus:outline-none transition"
                    />
                  </div>
                </div>
              )}

              {/* Exercise Selection */}
              {exportType === 'singleExercise' && (
                <div>
                  <label className="block text-xs text-slate-400 font-bold uppercase tracking-wider mb-2.5">Exercise</label>
                  <select
                    value={exportExerciseId || ''}
                    onChange={(e) => setExportExerciseId(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full bg-slate-800/50 border border-slate-600/50 rounded-lg px-4 py-2 text-white font-semibold focus:border-blue-500 focus:outline-none transition"
                  >
                    <option value="">Choose an exercise...</option>
                    {exercisesDB && exercisesDB.map(ex => (
                      <option key={ex?.id || Math.random()} value={ex?.id || ''}>{ex?.name || 'Unknown'}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Export Button */}
              <button
                onClick={onExport}
                className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-lg p-4 font-bold transition shadow-lg shadow-emerald-600/30 ui-press mt-2"
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