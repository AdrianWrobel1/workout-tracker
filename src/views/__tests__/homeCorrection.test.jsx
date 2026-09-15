// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { HomeView } from '../HomeView';
import { CalendarModal } from '../../components/CalendarModal';
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

const today = new Date();
const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

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

const sectionOrder = (host) => {
  const nodes = Array.from(host.querySelectorAll('header, section'));
  const idx = (sel) => nodes.findIndex((n) => n.matches(sel));
  return {
    header: idx('header'),
    start: idx('section[aria-label="Start training"]'),
    qi: idx('section[aria-labelledby="qi-heading"]'),
    notes: idx('section[aria-labelledby="notes-heading"]'),
    row: idx('section[aria-label="Templates and calendar"]'),
    recent: idx('section[aria-labelledby="recent-heading"]'),
    monthly: idx('section[aria-labelledby="monthly-heading"]'),
  };
};

describe('Home correction: consistency character', () => {
  it('restores athletic hero without inventing metrics', () => {
    const host = render(withWorkoutCtx(<HomeView {...baseProps()} />));
    const text = host.textContent;
    expect(text).toContain('Keep moving');
    expect(text).toContain('This week');
    expect(text).toContain('1-week streak');
    expect(text).toContain('25%');
    const bar = host.querySelector('[role="progressbar"]');
    expect(bar).not.toBeNull();
    expect(bar.getAttribute('aria-valuenow')).toBe('1');
    expect(bar.getAttribute('aria-valuemax')).toBe('4');
  });
});

describe('Home correction: required section order', () => {
  it('orders consistency, start, templates/calendar, notes, insights, recent, monthly', () => {
    const host = render(withWorkoutCtx(<HomeView {...baseProps()} />));
    const o = sectionOrder(host);
    for (const [k, v] of Object.entries(o)) {
      expect(v, `${k} section must exist`).toBeGreaterThanOrEqual(0);
    }
    expect(o.header).toBeLessThan(o.start);
    expect(o.start).toBeLessThan(o.row);
    expect(o.row).toBeLessThan(o.notes);
    expect(o.notes).toBeLessThan(o.qi);
    expect(o.qi).toBeLessThan(o.recent);
    expect(o.recent).toBeLessThan(o.monthly);
  });

  it('Templates and Calendar row keeps both handlers working', () => {
    const props = baseProps();
    const host = render(withWorkoutCtx(<HomeView {...props} />));
    const row = host.querySelector('section[aria-label="Templates and calendar"]');
    expect(row).not.toBeNull();
    const buttons = Array.from(row.querySelectorAll('button'));
    buttons.find((b) => b.textContent === 'Templates').click();
    expect(props.onManageTemplates).toHaveBeenCalledTimes(1);
    buttons.find((b) => b.textContent === 'Calendar').click();
    expect(props.onOpenCalendar).toHaveBeenCalledTimes(1);
  });

  it('Quick Insights stays selective: 1 primary + up to 3 supporting', () => {
    const host = render(withWorkoutCtx(<HomeView {...baseProps()} />));
    expect(host.querySelector('article[aria-label^="Primary insight"]')).not.toBeNull();
    const supporting = host.querySelectorAll('ul[aria-label="Supporting signals"] > li');
    expect(supporting.length).toBeLessThanOrEqual(3);
    expect(host.querySelector('section[aria-labelledby="notes-heading"]')).not.toBeNull();
  });
});

describe('Home correction: training notes preserved after move', () => {
  it('notes stay collapsed until requested, then edit and persist via handler', () => {
    const props = baseProps();
    const host = render(withWorkoutCtx(<HomeView {...props} />));
    expect(host.querySelector('#home-training-notes')).toBeNull();
    act(() => {
      host.querySelector('button[aria-label="Add training notes"]').click();
    });
    const area = host.querySelector('#home-training-notes');
    expect(area).not.toBeNull();
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      setter.call(area, 'test cue');
      area.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(props.onTrainingNotesChange).toHaveBeenCalledWith('test cue');
  });
});

describe('Home correction: calendar contract', () => {
  const dayNum = String(today.getDate());

  it('a day with a workout selects and closes; an empty day does nothing', () => {
    const onSelectDate = vi.fn();
    const onClose = vi.fn();
    // CalendarModal portals to document.body, so query the body (not the host).
    render(
      <CalendarModal workouts={[workout]} onClose={onClose} onSelectDate={onSelectDate} />
    );
    const dayButtons = Array.from(document.body.querySelectorAll('button')).filter(
      (b) => b.textContent === dayNum
    );
    expect(dayButtons.length).toBeGreaterThan(0);
    // First match in DOM order belongs to the current month block.
    act(() => { dayButtons[0].click(); });
    expect(onSelectDate).toHaveBeenCalledWith(todayStr);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('empty dates never navigate to an empty detail', () => {
    const onSelectDate = vi.fn();
    const onClose = vi.fn();
    render(
      <CalendarModal workouts={[]} onClose={onClose} onSelectDate={onSelectDate} />
    );
    const dayButtons = Array.from(document.body.querySelectorAll('button')).filter(
      (b) => b.textContent === dayNum
    );
    expect(dayButtons.length).toBeGreaterThan(0);
    act(() => { dayButtons[0].click(); });
    expect(onSelectDate).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('tolerates malformed workout entries without crashing', () => {
    const onSelectDate = vi.fn();
    const onClose = vi.fn();
    render(
      <CalendarModal workouts={[null, undefined, workout]} onClose={onClose} onSelectDate={onSelectDate} />
    );
    expect(document.body.textContent).toContain('SELECT DATE');
    const dayButtons = Array.from(document.body.querySelectorAll('button')).filter(
      (b) => b.textContent === dayNum
    );
    act(() => { dayButtons[0].click(); });
    expect(onSelectDate).toHaveBeenCalledWith(todayStr);
  });
});
