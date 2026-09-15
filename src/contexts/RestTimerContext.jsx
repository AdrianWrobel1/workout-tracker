import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import { createRestTimer, addRestSeconds, skipRestTimer } from '../domain/restTimer';

/**
 * Transient rest-timer state. Deliberately separate from WorkoutContext:
 * the countdown is UI state, not workout history data, and nothing here
 * is persisted (only user *settings* like restDurationSec persist, via the
 * existing IndexedDB settings infrastructure in App.jsx).
 *
 * Render isolation: this provider holds only the timestamp object and
 * updates it solely on user actions (start / adjust / skip / complete).
 * The per-second display tick lives inside RestTimerBar's local state,
 * so the countdown never rerenders the app tree.
 */
export const RestTimerContext = createContext(null);

export const RestTimerProvider = ({ children }) => {
  const [timer, setTimer] = useState(null);
  const [finished, setFinished] = useState(null); // { at, totalSec } — completion flash
  const completedForRef = useRef(null); // single-fire guard per timer instance

  const timerKey = (t) => (t ? `${t.startedAt}:${t.endsAt}` : null);

  /** Start (or restart) rest. Replaces any running timer — single timer only. */
  const startRest = useCallback((durationSec, source = null) => {
    const next = createRestTimer(durationSec, Date.now(), source);
    completedForRef.current = null;
    setFinished(null);
    setTimer(next);
    return next !== null;
  }, []);

  /** Shift remaining time by deltaSec; consumes to a skip at/below zero. */
  const adjustRest = useCallback((deltaSec) => {
    setTimer((prev) => {
      if (!prev) return prev;
      return addRestSeconds(prev, deltaSec, Date.now());
    });
  }, []);

  /** Skip immediately. Never touches workout data. */
  const skipRest = useCallback(() => {
    completedForRef.current = null;
    setFinished(null);
    setTimer(skipRestTimer());
  }, []);

  const dismissFinished = useCallback(() => {
    setFinished(null);
  }, []);

  /**
   * Called by RestTimerBar when it observes endsAt passing. Fires exactly
   * once per timer instance; late/duplicate calls are ignored so completion
   * feedback (sound, haptics, flash) never repeats.
   */
  const notifyTimerComplete = useCallback(() => {
    const key = timerKey(timer);
    if (!timer || key === null) return false;
    if (Date.now() < Number(timer.endsAt)) return false;
    if (completedForRef.current === key) return false;
    completedForRef.current = key;
    setFinished({ at: Date.now(), totalSec: Number(timer.totalSec) || 0 });
    setTimer(null);
    return true;
  }, [timer]);

  const value = useMemo(() => ({
    timer,
    finished,
    startRest,
    adjustRest,
    skipRest,
    dismissFinished,
    notifyTimerComplete
  }), [timer, finished, startRest, adjustRest, skipRest, dismissFinished, notifyTimerComplete]);

  return (
    <RestTimerContext.Provider value={value}>
      {children}
    </RestTimerContext.Provider>
  );
};

export const useRestTimer = () => {
  const context = useContext(RestTimerContext);
  if (!context) {
    throw new Error('useRestTimer must be used within RestTimerProvider');
  }
  return context;
};
