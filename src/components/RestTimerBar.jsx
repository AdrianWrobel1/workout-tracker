import React, { useEffect, useState } from 'react';
import { X, Plus, Minus, RotateCcw, Timer } from 'lucide-react';
import { useRestTimer } from '../contexts/RestTimerContext';
import { useSettings } from '../contexts/SettingsContext';
import { getRemainingSec, formatRestTime, REST_ADJUST_STEP_SEC } from '../domain/restTimer';
import { playRestChime } from '../utils/restSound';

/**
 * Floating rest-timer bar. Rendered once at App level whenever a timer is
 * running or the completion flash is visible, so it survives minimizing the
 * workout and navigating between views.
 *
 * Render isolation: the 1s display tick is local useState — only this
 * component rerenders each second. Completion feedback (sound/haptics)
 * fires exactly once per timer via the provider's single-fire guard.
 */
export const RestTimerBar = ({ bottomOffset = '12px' }) => {
  const { timer, finished, adjustRest, skipRest, dismissFinished, notifyTimerComplete, startRest } = useRestTimer();
  const { restDurationSec, restSoundEnabled, enableHapticFeedback } = useSettings();
  const [now, setNow] = useState(() => Date.now());

  // Clamp a stale tick to startedAt so the first paint after a start
  // can never display more than the configured total.
  const effectiveNow = timer ? Math.max(now, Number(timer.startedAt) || now) : now;
  const remaining = timer ? getRemainingSec(timer, effectiveNow) : 0;

  // Local display tick only (source of truth stays endsAt - now).
  // Completion is observed inside the interval/visibility callbacks —
  // never as a synchronous setState in an effect body — and the provider
  // single-fire guard makes late or duplicate observations harmless.
  useEffect(() => {
    if (!timer) return undefined;
    const id = setInterval(() => {
      setNow(Date.now());
      notifyTimerComplete();
    }, 1000);
    const onVisible = () => {
      if (!document.hidden) {
        setNow(Date.now());
        notifyTimerComplete();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [timer, notifyTimerComplete]);

  // Completion feedback: sound + haptics, once per finished flash.
  useEffect(() => {
    if (!finished) return;
    playRestChime(restSoundEnabled);
    try {
      if (enableHapticFeedback && navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }
    } catch {
      // Haptics must never break the workout.
    }
  }, [finished, restSoundEnabled, enableHapticFeedback]);

  // Let page content scroll clear of the floating bar (same idea as openGym's
  // body.resting), cleaned up when the timer leaves.
  useEffect(() => {
    const on = Boolean(timer || finished);
    document.body.classList.toggle('resting', on);
    return () => document.body.classList.remove('resting');
  }, [timer, finished]);

  if (!timer && !finished) return null;

  if (finished && !timer) {
    return (
      <div className="rest-timer-shell" style={{ bottom: bottomOffset }}>
        <section
          aria-label="Rest complete"
          role="status"
          className="rest-timer-card ui-sheet-rise-anim rest-timer-done"
        >
          <div className="flex items-center gap-3">
            <span className="rest-timer-done-dot" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-white">Rest complete</p>
              <p className="text-xs text-slate-400 font-semibold">Next set when ready</p>
            </div>
            <button
              type="button"
              onClick={() => startRest(restDurationSec, 'manual-restart')}
              className="rest-timer-btn rest-timer-btn-ghost ui-press"
              aria-label="Restart rest timer"
            >
              <RotateCcw size={16} aria-hidden="true" />
              <span>Again</span>
            </button>
            <button
              type="button"
              onClick={dismissFinished}
              className="rest-timer-btn rest-timer-btn-primary ui-press"
              aria-label="Dismiss rest complete"
            >
              <X size={16} aria-hidden="true" />
              <span>Done</span>
            </button>
          </div>
        </section>
      </div>
    );
  }

  const total = Math.max(1, Number(timer.totalSec) || 1);
  const pct = Math.max(0, Math.min(100, (remaining / total) * 100));

  return (
    <div className="rest-timer-shell" style={{ bottom: bottomOffset }}>
      <section aria-label="Rest timer" className="rest-timer-card ui-sheet-rise-anim">
        <div className="flex items-center gap-3">
          <Timer size={18} className="text-emerald-300 shrink-0" aria-hidden="true" />
          {/* aria-hidden: never announce every tick to screen readers. */}
          <div className="rest-timer-time font-mono" aria-hidden="true">
            {formatRestTime(remaining)}
          </div>
          <span className="sr-only">Rest time remaining</span>
          <div className="flex-1 min-w-0">
            <div
              className="rest-timer-track"
              role="progressbar"
              aria-label="Rest progress"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={remaining}
            >
              <div className="rest-timer-fill" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-[11px] text-slate-400 font-semibold mt-1">Recover — next set when ready</p>
          </div>
        </div>
        <div className="rest-timer-controls">
          <button
            type="button"
            onClick={() => adjustRest(-REST_ADJUST_STEP_SEC)}
            className="rest-timer-btn rest-timer-btn-ghost ui-press"
            aria-label="Subtract 15 seconds from rest"
          >
            <Minus size={15} aria-hidden="true" />
            <span>15s</span>
          </button>
          <button
            type="button"
            onClick={() => adjustRest(REST_ADJUST_STEP_SEC)}
            className="rest-timer-btn rest-timer-btn-ghost ui-press"
            aria-label="Add 15 seconds to rest"
          >
            <Plus size={15} aria-hidden="true" />
            <span>15s</span>
          </button>
          <button
            type="button"
            onClick={skipRest}
            className="rest-timer-btn rest-timer-btn-primary ui-press"
            aria-label="Skip rest timer"
          >
            <X size={15} aria-hidden="true" />
            <span>Skip</span>
          </button>
        </div>
      </section>
    </div>
  );
};
