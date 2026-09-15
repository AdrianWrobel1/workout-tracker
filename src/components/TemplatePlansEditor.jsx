import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { presetPlans, createPlan } from '../domain/templatePlans';
import { generateId } from '../domain/ids';

export const TemplatePlansEditor = ({ template, onClose, onSave }) => {
  const [plans, setPlans] = useState(template.plans || []);
  const [showPresets, setShowPresets] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    intensityLevel: 'moderate',
    percentageMin: 70,
    percentageMax: 85,
    repRange: '8-12',
    rirTarget: 2
  });

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleAddPlan = (preset = null) => {
    if (preset) {
      const newPlan = {
        ...preset,
        id: generateId(),
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
        formData.rirTarget,
        generateId
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
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 ui-backdrop-in">
      <div role="dialog" aria-modal="true" aria-label="Template plans editor" className="bg-[#0b1220] border border-white/10 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl ui-sheet-rise-anim">
        {/* Header */}
        <div className="sticky top-0 bg-[#0b1220]/95 backdrop-blur border-b border-white/10 p-4 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="ui-micro">Plan → workout → start</p>
            <h2 className="ui-section-title mt-0.5">Template plans</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close plans editor"
            className="p-2 hover:bg-white/10 rounded-lg transition min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Existing Plans */}
          {plans.length > 0 && (
            <div className="space-y-2">
              <p className="ui-micro">Your plans ({plans.length})</p>
              {plans.map((plan, idx) => (
                <div
                  key={plan.id}
                  className="ui-surface-secondary p-3 flex items-start justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="ui-card-title truncate">{plan.name}</p>
                    <p className="ui-secondary mt-1">
                      {getIntensityLabel(plan.intensityLevel)} · {plan.percentageRange.min}-{plan.percentageRange.max}% · {plan.repRange} reps
                    </p>
                    {plan.description && (
                      <p className="ui-secondary mt-1.5 !text-xs">{plan.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeletePlan(idx)}
                    aria-label={`Delete plan ${plan.name}`}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-[12px] text-red-300/80 hover:text-red-200 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition shrink-0"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add New Plan */}
          <div className="ui-surface-secondary p-3">
            <p className="ui-micro mb-3">Add new plan</p>

            {/* Quick Presets */}
            <div className="mb-4">
              <button
                onClick={() => setShowPresets(!showPresets)}
                aria-expanded={showPresets}
                className="ui-action-secondary w-full px-3 py-2.5 text-sm font-semibold text-white transition text-left flex items-center justify-between min-h-[44px]"
              >
                <span>Use preset</span>
                <span className="text-xs text-slate-400" aria-hidden="true">{showPresets ? '▾' : '▸'}</span>
              </button>

              {showPresets && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {Object.entries(presetPlans).map(([key, preset]) => (
                    <button
                      key={key}
                      onClick={() => handleAddPlan(preset)}
                      className="ui-action-secondary px-2 py-2.5 text-xs font-semibold text-white transition min-h-[44px]"
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Custom Form */}
            <div className="space-y-2">
              <label className="sr-only" htmlFor="plan-name">Plan name</label>
              <input
                id="plan-name"
                type="text"
                placeholder="Plan name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="touch-input w-full bg-slate-800/60 border border-slate-600/50 rounded-lg text-white text-sm placeholder-slate-500 focus:border-accent focus:outline-none transition"
              />

              <label className="sr-only" htmlFor="plan-intensity">Intensity level</label>
              <select
                id="plan-intensity"
                value={formData.intensityLevel}
                onChange={(e) => setFormData({ ...formData, intensityLevel: e.target.value })}
                className="touch-input w-full bg-slate-800/60 border border-slate-600/50 rounded-lg text-white text-sm focus:border-accent focus:outline-none transition"
              >
                <option value="light">Light</option>
                <option value="moderate">Moderate</option>
                <option value="high">High</option>
                <option value="veryhigh">Very High</option>
              </select>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="ui-micro" htmlFor="plan-min">Min %</label>
                  <input
                    id="plan-min"
                    type="number"
                    min="20"
                    max="100"
                    value={formData.percentageMin}
                    onChange={(e) => setFormData({ ...formData, percentageMin: Number(e.target.value) })}
                    className="touch-input mt-1 w-full bg-slate-800/60 border border-slate-600/50 rounded-lg text-white text-sm focus:border-accent focus:outline-none transition"
                  />
                </div>
                <div>
                  <label className="ui-micro" htmlFor="plan-max">Max %</label>
                  <input
                    id="plan-max"
                    type="number"
                    min="20"
                    max="100"
                    value={formData.percentageMax}
                    onChange={(e) => setFormData({ ...formData, percentageMax: Number(e.target.value) })}
                    className="touch-input mt-1 w-full bg-slate-800/60 border border-slate-600/50 rounded-lg text-white text-sm focus:border-accent focus:outline-none transition"
                  />
                </div>
              </div>

              <label className="sr-only" htmlFor="plan-reps">Rep range</label>
              <input
                id="plan-reps"
                type="text"
                placeholder="Rep range (e.g., 8-12)"
                value={formData.repRange}
                onChange={(e) => setFormData({ ...formData, repRange: e.target.value })}
                className="touch-input w-full bg-slate-800/60 border border-slate-600/50 rounded-lg text-white text-sm placeholder-slate-500 focus:border-accent focus:outline-none transition"
              />

              <div>
                <label className="ui-micro" htmlFor="plan-rir">RIR target</label>
                <input
                  id="plan-rir"
                  type="number"
                  min="0"
                  max="5"
                  value={formData.rirTarget}
                  onChange={(e) => setFormData({ ...formData, rirTarget: Number(e.target.value) })}
                  className="touch-input mt-1 w-full bg-slate-800/60 border border-slate-600/50 rounded-lg text-white text-sm focus:border-accent focus:outline-none transition"
                />
              </div>

              <button
                onClick={() => handleAddPlan()}
                disabled={!formData.name.trim()}
                className="ui-action-secondary w-full mt-1 px-3 py-2.5 font-semibold text-white text-sm transition flex items-center justify-center gap-2 min-h-[44px] disabled:opacity-50"
              >
                <Plus size={16} aria-hidden="true" />
                Add plan
              </button>
            </div>
          </div>

          {/* Info */}
          <div className="ui-surface-sub p-3">
            <p className="ui-micro mb-1">How plans work</p>
            <p className="ui-secondary !text-xs">
              Plans are intensity variants of one blueprint. Pick one when training — the template itself never changes.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-[#0b1220]/95 backdrop-blur border-t border-white/10 p-4 flex gap-2">
          <button
            onClick={onClose}
            className="ui-action-secondary flex-1 px-3 py-2.5 font-semibold text-white transition min-h-[44px]"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="ui-cta-primary flex-1 px-3 py-2.5 font-semibold text-white transition min-h-[44px] ui-press"
          >
            Save plans
          </button>
        </div>
      </div>
    </div>
  );
};

export default TemplatePlansEditor;
