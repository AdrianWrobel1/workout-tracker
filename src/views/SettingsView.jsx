import React from 'react';
import { Download, Upload } from 'lucide-react';

export const SettingsView = ({ weeklyGoal, onWeeklyGoalChange, onExport, onImport, onReset }) => {
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
            <button onClick={onExport} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl p-4 font-semibold flex flex-col items-center gap-2">
              <Download size={24} />
              <span className="text-xs">Export JSON</span>
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
    </div>
  );
};