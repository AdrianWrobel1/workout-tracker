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
  exercisesDB = []
}) => {
  return (
    <div className="min-h-screen bg-zinc-900 text-white pb-24">
      <div className="bg-zinc-800 p-4 mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>
      <div className="p-6 space-y-6">
        <div className="bg-zinc-800 rounded-xl p-4">
          <h3 className="font-semibold mb-2">Weekly Goal</h3>
          <input
            type="number"
            value={weeklyGoal}
            onChange={(e) => onWeeklyGoalChange(parseInt(e.target.value) || 1)}
            className="w-full bg-zinc-700 rounded-lg p-3 text-white"
          />
        </div>

        <div className="bg-zinc-800 rounded-xl p-4">
          <h3 className="font-semibold mb-4">Data Management</h3>
          <div className="flex gap-4">
            <button onClick={() => setShowExportModal(true)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl p-4 font-semibold flex flex-col items-center gap-2">
              <Download size={24} />
              <span className="text-xs">Export Data</span>
            </button>
            <label className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white rounded-xl p-4 font-semibold flex flex-col items-center gap-2 cursor-pointer">
              <Upload size={24} />
              <span className="text-xs">Import JSON</span>
              <input type="file" accept=".json" onChange={onImport} className="hidden" />
            </label>
          </div>
        </div>

        <button
          onClick={onReset}
          className="w-full bg-red-900/50 text-red-400 border border-red-900 hover:bg-red-900/80 rounded-xl p-4 font-semibold"
        >
          Reset App
        </button>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 text-white p-6 rounded-xl w-full max-w-md border border-zinc-700">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Export Data</h3>
              <button onClick={() => setShowExportModal(false)} className="text-zinc-400 hover:text-white">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Export Type</label>
                <select
                  value={exportType}
                  onChange={(e) => setExportType(e.target.value)}
                  className="w-full bg-zinc-800 rounded-xl p-3 text-white border border-transparent focus:border-rose-500 outline-none"
                >
                  <option value="all">All Data</option>
                  <option value="workouts">Workouts Only</option>
                  <option value="exercises">Exercises Data</option>
                  <option value="singleExercise">Single Exercise</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Time Period</label>
                <select
                  value={exportPeriod}
                  onChange={(e) => setExportPeriod(e.target.value)}
                  className="w-full bg-zinc-800 rounded-xl p-3 text-white border border-transparent focus:border-rose-500 outline-none"
                >
                  <option value="all">All Time</option>
                  <option value="last7">Last 7 Days</option>
                  <option value="last30">Last 30 Days</option>
                  <option value="last90">Last 90 Days</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>

              {exportPeriod === 'custom' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">Start Date</label>
                    <input
                      type="date"
                      value={exportStartDate}
                      onChange={(e) => setExportStartDate(e.target.value)}
                      className="w-full bg-zinc-800 rounded-xl p-3 text-white border border-transparent focus:border-rose-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">End Date</label>
                    <input
                      type="date"
                      value={exportEndDate}
                      onChange={(e) => setExportEndDate(e.target.value)}
                      className="w-full bg-zinc-800 rounded-xl p-3 text-white border border-transparent focus:border-rose-500 outline-none"
                    />
                  </div>
                </div>
              )}

              {exportType === 'singleExercise' && (
                <div>
                  <label className="block text-sm text-zinc-400 mb-2">Select Exercise</label>
                  <select
                    value={exportExerciseId || ''}
                    onChange={(e) => setExportExerciseId(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full bg-zinc-800 rounded-xl p-3 text-white border border-transparent focus:border-rose-500 outline-none"
                  >
                    <option value="">Choose an exercise...</option>
                    {exercisesDB && exercisesDB.map(ex => (
                      <option key={ex?.id || Math.random()} value={ex?.id || ''}>{ex?.name || 'Unknown'}</option>
                    ))}
                  </select>
                </div>
              )}

              <button
                onClick={onExport}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl p-4 font-semibold"
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