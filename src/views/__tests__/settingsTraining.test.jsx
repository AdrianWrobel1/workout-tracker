import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { SettingsView } from '../SettingsView';

const noop = () => {};
const textOf = (html) => String(html).replace(/<!--[\s\S]*?-->/g, '');

const baseProps = {
  weeklyGoal: 4,
  onWeeklyGoalChange: noop,
  onExport: noop,
  onImport: noop,
  onReset: noop,
  showExportModal: false,
  setShowExportModal: noop,
  exportType: 'all',
  setExportType: noop,
  exportPeriod: 'all',
  setExportPeriod: noop,
  exportStartDate: '',
  setExportStartDate: noop,
  exportEndDate: '',
  setExportEndDate: noop,
  exportExerciseId: null,
  setExportExerciseId: noop,
  exercisesDB: [],
  onOpenExportData: noop,
  defaultStatsRange: '3months',
  onDefaultStatsRangeChange: noop,
  enablePerformanceAlerts: true,
  onEnablePerformanceAlertsChange: noop,
  enableHapticFeedback: false,
  onEnableHapticFeedbackChange: noop,
  reduceAnimations: false,
  onReduceAnimationsChange: noop,
  restDurationSec: 90,
  onRestDurationChange: noop,
  restAutoStart: true,
  onRestAutoStartChange: noop,
  restSoundEnabled: true,
  onRestSoundEnabledChange: noop
};

describe('Training 3.0: settings keeps every control after regrouping', () => {
  it('renders all functional groups with their controls', () => {
    const html = textOf(renderToString(<SettingsView {...baseProps} />));
    for (const needle of [
      'Training',
      'Weekly goal',
      'Statistics range',
      'Feedback',
      'Performance alerts',
      'Haptic feedback',
      'Reduce animations',
      'Rest timer',
      'Auto-start',
      'Default rest',
      'Completion sound',
      'Data',
      'Export Data',
      'Import JSON',
      'Appearance',
      'Accent color',
      'Danger zone',
      'Reset App'
    ]) {
      expect(html).toContain(needle);
    }
  });

  it('reset stays visually separated from ordinary settings', () => {
    const html = textOf(renderToString(<SettingsView {...baseProps} />));
    expect(html).toContain('ui-danger-card');
    expect(html).toContain('cannot be undone');
  });
});
