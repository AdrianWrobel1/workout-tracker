import React, { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { presetPlans, createPlan } from '../domain/templatePlans';

export const TemplatePlansEditor = ({ template, onClose, onSave }) => {
  const [plans, setPlans] = useState(template.plans || []);
  const [showPresets, setShowPresets] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    intensityLevel: 'moderate',
    percentageMin: 70,
    percentageMax: 85,
    repRange: '8-12',
    rirTarget: 2
  });

  const handleAddPlan = (preset = null) => {
    if (preset) {
      const newPlan = {
        id: Date.now().toString(),
        ...preset,
        createdAt: new Date().toISOString()
      };
      setPlans([...plans, newPlan]);
      setShowPresets(false);
    } else if (formData.name.trim()) {
      const newPlan = createPlan(
        formData.name,
        formData.intensityLevel,
        formData.percentageMin,
        formData.percentageMax,
        formData.repRange,
        formData.rirTarget
      );
      setPlans([...plans, newPlan]);
      resetForm();
    }
  };

  const handleDeletePlan = (index) => {
    setPlans(plans.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setFormData({
      name: '',
      intensityLevel: 'moderate',
      percentageMin: 70,
      percentageMax: 85,
      repRange: '8-12',
      rirTarget: 2
    });
  };

  const handleSave = () => {
    const updatedTemplate = {
      ...template,
      plans
    };
    onSave(updatedTemplate);
  };

  const getIntensityColor = (level) => {
    const colors = {
      light: 'bg-green-900/30 border-green-700/30',
      moderate: 'bg-blue-900/30 border-blue-700/30',
      high: 'bg-orange-900/30 border-orange-700/30',
      veryhigh: 'bg-red-900/30 border-red-700/30'
    };
    return colors[level] || 'bg-slate-900/30 border-slate-700/30';
  };

  const getIntensityLabel = (level) => {
    const labels = {
      light: 'Light',
      moderate: 'Moderate',
      high: 'High',
      veryhigh: 'Very High'
    };
    return labels[level] || level;
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Template Plans</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-800 rounded transition"
          >
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Existing Plans */}
          {plans.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-slate-400 font-semibold tracking-widest">YOUR PLANS ({plans.length})</p>
              {plans.map((plan, idx) => (
                <div
                  key={plan.id}
                  className={`border ${getIntensityColor(plan.intensityLevel)} rounded-lg p-3 flex items-start justify-between`}
                >
                  <div className="flex-1">
                    <p className="font-semibold text-white">{plan.name}</p>
                    <div className="grid grid-cols-3 gap-2 mt-2 text-[10px] text-slate-300">
                      <div>
                        <p className="text-slate-500">Intensity</p>
                        <p className="font-bold">{getIntensityLabel(plan.intensityLevel)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Weight %</p>
                        <p className="font-bold">{plan.percentageRange.min}-{plan.percentageRange.max}%</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Reps</p>
                        <p className="font-bold">{plan.repRange}</p>
                      </div>
                    </div>
                    {plan.description && (
                      <p className="text-[10px] text-slate-400 mt-2">{plan.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeletePlan(idx)}
                    className="ml-3 p-2 hover:bg-red-900/30 rounded transition text-red-400"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add New Plan */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
            <p className="text-xs text-slate-400 font-semibold tracking-widest mb-3">ADD NEW PLAN</p>

            {/* Quick Presets */}
            <div className="mb-4">
              <button
                onClick={() => setShowPresets(!showPresets)}
                className="w-full px-3 py-2 bg-slate-700/50 hover:bg-slate-700 rounded border border-slate-600 text-sm font-semibold text-white transition text-left flex items-center justify-between"
              >
                <span>Use Preset</span>
                <span className="text-xs text-slate-400">{showPresets ? '▼' : '▶'}</span>
              </button>

              {showPresets && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {Object.entries(presetPlans).map(([key, preset]) => (
                    <button
                      key={key}
                      onClick={() => handleAddPlan(preset)}
                      className="px-2 py-2 bg-slate-700/30 hover:bg-slate-700/50 rounded border border-slate-600 text-xs font-semibold text-white transition"
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Custom Form */}
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Plan name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-2.5 py-1.5 bg-slate-700/50 border border-slate-600 rounded text-white text-sm placeholder-slate-500 focus:border-blue-500 outline-none transition"
              />

              <select
                value={formData.intensityLevel}
                onChange={(e) => setFormData({ ...formData, intensityLevel: e.target.value })}
                className="w-full px-2.5 py-1.5 bg-slate-700/50 border border-slate-600 rounded text-white text-sm focus:border-blue-500 outline-none transition"
              >
                <option value="light">Light</option>
                <option value="moderate">Moderate</option>
                <option value="high">High</option>
                <option value="veryhigh">Very High</option>
              </select>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400">Min %</label>
                  <input
                    type="number"
                    min="20"
                    max="100"
                    value={formData.percentageMin}
                    onChange={(e) => setFormData({ ...formData, percentageMin: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 bg-slate-700/50 border border-slate-600 rounded text-white text-sm focus:border-blue-500 outline-none transition"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400">Max %</label>
                  <input
                    type="number"
                    min="20"
                    max="100"
                    value={formData.percentageMax}
                    onChange={(e) => setFormData({ ...formData, percentageMax: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 bg-slate-700/50 border border-slate-600 rounded text-white text-sm focus:border-blue-500 outline-none transition"
                  />
                </div>
              </div>

              <input
                type="text"
                placeholder="Rep range (e.g., 8-12)"
                value={formData.repRange}
                onChange={(e) => setFormData({ ...formData, repRange: e.target.value })}
                className="w-full px-2.5 py-1.5 bg-slate-700/50 border border-slate-600 rounded text-white text-sm placeholder-slate-500 focus:border-blue-500 outline-none transition"
              />

              <div>
                <label className="text-[10px] text-slate-400">RIR Target</label>
                <input
                  type="number"
                  min="0"
                  max="5"
                  value={formData.rirTarget}
                  onChange={(e) => setFormData({ ...formData, rirTarget: Number(e.target.value) })}
                  className="w-full px-2.5 py-1.5 bg-slate-700/50 border border-slate-600 rounded text-white text-sm focus:border-blue-500 outline-none transition"
                />
              </div>

              <button
                onClick={() => handleAddPlan()}
                disabled={!formData.name.trim()}
                className="w-full mt-3 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded font-semibold text-white text-sm transition flex items-center justify-center gap-2"
              >
                <Plus size={16} />
                Add Plan
              </button>
            </div>
          </div>

          {/* Info */}
          <div className="bg-slate-800/30 border border-slate-700/50 rounded p-3">
            <p className="text-[10px] text-slate-400 mb-1">💡 TIP</p>
            <p className="text-[10px] text-slate-300 leading-relaxed">
              Create multiple plans for different training phases. Users can select
              which plan to use for each workout session.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-slate-900 border-t border-slate-700 p-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded font-semibold text-white transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 rounded font-semibold text-white transition"
          >
            Save Plans
          </button>
        </div>
      </div>
    </div>
  );
};

export default TemplatePlansEditor;
