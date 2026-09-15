/**
 * Minimal WebAudio feedback for the rest timer. No dependencies.
 * Every call is guarded: audio unavailable must never break workout logging.
 */

let audioCtx = null;

const getContext = () => {
  try {
    if (audioCtx) return audioCtx;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
    return audioCtx;
  } catch {
    return null;
  }
};

const beep = (ctx, freq, durSec, delaySec = 0) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = freq;
  osc.type = 'sine';
  const t0 = ctx.currentTime + delaySec;
  gain.gain.setValueAtTime(0.001, t0);
  gain.gain.exponentialRampToValueAtTime(0.3, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + durSec);
  osc.start(t0);
  osc.stop(t0 + durSec + 0.05);
};

/** Two-tone chime fired once when rest completes. No-op when disabled. */
export const playRestChime = (enabled = true) => {
  if (enabled !== true) return;
  try {
    const ctx = getContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    beep(ctx, 880, 0.15, 0);
    beep(ctx, 880, 0.15, 0.22);
    beep(ctx, 1320, 0.4, 0.44);
  } catch {
    // Audio must never crash the workout.
  }
};
