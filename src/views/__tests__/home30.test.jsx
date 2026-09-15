// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { HomeView } from '../HomeView';
import { pickPrimaryInsightKey } from '../homeInsights';
import { BottomNav } from '../../components/BottomNav';
import { WorkoutContext } from '../../contexts/WorkoutContext';

const roots = [];
afterEach(() => {
  while (roots.length) {
    const { root, host } = roots.pop();
    act(() => { root.unmount(); });
    host.remove();
  }
  document.body.innerHTML = '';
});

const render = (el) => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => { root.render(el); });
  roots.push({ root, host });
  return host;
};

const todayStr = new Date().toISOString().split('T')[0];

const workout = {
  id: 'w1',
  name: 'Push Day',
  date: todayStr,
  duration: 45,
  exercises: [
    { exerciseId: 'e1', name: 'Bench Press', sets: [{ kg: 100, reps: 5, completed: true, setType: 'work' }] }
  ]
};

const balancedPair = (a, b) => ({ sideA: a, sideB: b, sideAValue: 10, sideBValue: 9, ratio: 1.11, status: 'balanced' });

const baseProps = (overrides = {}) => ({
  workouts: [workout],
  weeklyGoal: 4,
  readiness: { readinessScore: 82, status: 'ready', ratio: 1.0, acuteLoad: 500, chronicLoad: 500, suggestion: 'Train as planned.' },
  muscleBalance: {
    week: { score: 80, pushPull: balancedPair('Push', 'Pull'), chestBack: balancedPair('Chest', 'Back'), quadHam: balancedPair('Quads', 'Ham') },
    block: { score: 75, pushPull: balancedPair('Push', 'Pull'), chestBack: balancedPair('Chest', 'Back'), quadHam: balancedPair('Quads', 'Ham') }
  },
  masteryData: { level: 3, title: 'Builder', masteryPoints: 120, nextMilestone: '200 for next tier', exercisesMastered: 2 },
  anomalyDetection: null,
  trainingNotes: '',
  onTrainingNotesChange: vi.fn(),
  onStartWorkout: vi.fn(),
  onManageTemplates: vi.fn(),
  onOpenCalendar: vi.fn(),
  onViewHistory: vi.fn(),
  onViewWorkoutDetail: vi.fn(),
  onOpenMonthlyProgress: vi.fn(),
  ...overrides
});

const withWorkoutCtx = (el) => (
  <WorkoutContext.Provider value={{ records: [] }}>{el}</WorkoutContext.Provider>
);

describe('UI 3.0 insight cascade (pure selector, no scoring engine)', () => {
  it('fatigue outranks everything', () => {
    expect(pickPrimaryInsightKey({ hasHistory: true, readinessStatus: 'fatigue', hasImbalance: true, weekPRCount: 5 })).toBe('readiness');
  });
  it('imbalance outranks PRs', () => {
    expect(pickPrimaryInsightKey({ hasHistory: true, readinessStatus: 'ready', hasImbalance: true, weekPRCount: 3 })).toBe('balance');
  });
  it('PRs surface when recovered and balanced', () => {
    expect(pickPrimaryInsightKey({ hasHistory: true, readinessStatus: 'ready', hasImbalance: false, weekPRCount: 2 })).toBe('records');
  });
  it('low readiness surfaces when nothing louder exists', () => {
    expect(pickPrimaryInsightKey({ hasHistory: true, readinessStatus: 'low', hasImbalance: false, weekPRCount: 0 })).toBe('readiness');
  });
  it('falls back to coaching, never to nothing', () => {
    expect(pickPrimaryInsightKey({ hasHistory: true, readinessStatus: 'ready', hasImbalance: false, weekPRCount: 0 })).toBe('coaching');
  });
  it('no history means no primary insight', () => {
    expect(pickPrimaryInsightKey({ hasHistory: false, readinessStatus: 'fatigue', hasImbalance: true, weekPRCount: 9 })).toBeNull();
  });
});

describe('Home 3.0 with normal data', () => {
  it('renders hierarchy: context, CTA, insights, recent, monthly', () => {
    const host = render(withWorkoutCtx(<HomeView {...baseProps()} />));
    const text = host.textContent;
    expect(text).toContain('This week');
    expect(host.querySelector('button[aria-label="Start new workout"]')).not.toBeNull();
    expect(text).toContain('Templates');
    expect(text).toContain('Calendar');
    expect(text).toContain('What matters now');
    expect(text).toContain('Push Day');
    expect(text).toContain('Last sessions');
    expect(host.querySelector('[role="progressbar"]')).not.toBeNull();
  });

  it('primary CTA calls the existing start flow exactly once', () => {
    const props = baseProps();
    const host = render(withWorkoutCtx(<HomeView {...props} />));
    host.querySelector('button[aria-label="Start new workout"]').click();
    expect(props.onStartWorkout).toHaveBeenCalledTimes(1);
  });

  it('Templates and Calendar call their existing handlers', () => {
    const props = baseProps();
    const host = render(withWorkoutCtx(<HomeView {...props} />));
    const buttons = Array.from(host.querySelectorAll('button'));
    buttons.find(b => b.textContent === 'Templates').click();
    expect(props.onManageTemplates).toHaveBeenCalledTimes(1);
    buttons.find(b => b.textContent === 'Calendar').click();
    expect(props.onOpenCalendar).toHaveBeenCalledTimes(1);
  });

  it('recent session opens detail with its date; View all opens history', () => {
    const props = baseProps();
    const host = render(withWorkoutCtx(<HomeView {...props} />));
    host.querySelector(`button[aria-label^="Open workout Push Day"]`).click();
    expect(props.onViewWorkoutDetail).toHaveBeenCalledWith(todayStr);
    host.querySelector('button[aria-label^="View all workout history"]').click();
    expect(props.onViewHistory).toHaveBeenCalledTimes(1);
  });

  it('monthly tiles open monthly progress with the right offset', () => {
    const props = baseProps();
    const host = render(withWorkoutCtx(<HomeView {...props} />));
    host.querySelector('button[aria-label^="Open this month progress"]').click();
    host.querySelector('button[aria-label^="Open last month progress"]').click();
    expect(props.onOpenMonthlyProgress).toHaveBeenNthCalledWith(1, 0);
    expect(props.onOpenMonthlyProgress).toHaveBeenNthCalledWith(2, -1);
  });

  it('fatigue becomes the primary insight with a details path', () => {
    const props = baseProps({ readiness: { readinessScore: 32, status: 'fatigue', ratio: 1.6, acuteLoad: 900, chronicLoad: 400, suggestion: 'Take it easy.' } });
    const host = render(withWorkoutCtx(<HomeView {...props} />));
    expect(host.querySelector('article[aria-label^="Primary insight"]').textContent).toContain('Fatigue is elevated');
  });

  it('training notes stay subordinate until requested', () => {
    const props = baseProps();
    const host = render(withWorkoutCtx(<HomeView {...props} />));
    expect(host.querySelector('#home-training-notes')).toBeNull();
    act(() => {
      host.querySelector('button[aria-label="Add training notes"]').click();
    });
    const area = host.querySelector('#home-training-notes');
    expect(area).not.toBeNull();
    expect(props.onTrainingNotesChange).not.toHaveBeenCalled();
  });
});

describe('Home 3.0 empty state (new user)', () => {
  it('welcomes, offers the CTA, and hides the history wall', () => {
    const props = baseProps({ workouts: [] });
    const host = render(withWorkoutCtx(<HomeView {...props} />));
    const text = host.textContent;
    expect(text).toContain('Your training starts here');
    expect(host.querySelector('button[aria-label="Start new workout"]')).not.toBeNull();
    expect(text).not.toContain('Last sessions');
    expect(text).not.toContain('What matters now');
    expect(text).toContain('after your first workout');
    host.querySelector('button[aria-label="Start new workout"]').click();
    expect(props.onStartWorkout).toHaveBeenCalledTimes(1);
  });
});

describe('BottomNav 3.0', () => {
  const tabs = [
    { id: 'profile', label: 'Statistics' },
    { id: 'history', label: 'History' },
    { id: 'home', label: 'Home' },
    { id: 'exercises', label: 'Exercises' },
    { id: 'settings', label: 'Settings' }
  ];

  it('marks exactly the active tab with aria-current and shows every label', () => {
    const host = render(<BottomNav activeTab="history" onTabChange={() => {}} />);
    const current = host.querySelectorAll('button[aria-current="page"]');
    expect(current).toHaveLength(1);
    expect(current[0].getAttribute('aria-label')).toBe('History');
    for (const { label } of tabs) {
      expect(host.textContent).toContain(label);
    }
  });

  it('routes through the existing tab-change handler', () => {
    const onTabChange = vi.fn();
    const host = render(<BottomNav activeTab="home" onTabChange={onTabChange} />);
    host.querySelector('button[aria-label="Exercises"]').click();
    expect(onTabChange).toHaveBeenCalledWith('exercises');
    expect(onTabChange).toHaveBeenCalledTimes(1);
  });
});
