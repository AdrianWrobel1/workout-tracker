import { Medal, Trophy, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

const RECORD_META = {
  heaviestWeight: {
    label: 'Heaviest Weight',
    tone: 'from-amber-500/95 via-orange-500/90 to-yellow-500/90',
    border: 'border-amber-200/40',
    icon: Trophy
  },
  bestSetVolume: {
    label: 'Best Set Volume',
    tone: 'from-cyan-500/95 via-sky-500/90 to-blue-500/90',
    border: 'border-cyan-200/40',
    icon: Sparkles
  },
  best1RM: {
    label: 'Best 1RM',
    tone: 'from-emerald-500/95 via-green-500/90 to-teal-500/90',
    border: 'border-emerald-200/40',
    icon: Medal
  }
};

const RECORD_PRIORITY = {
  heaviestWeight: 0,
  bestSetVolume: 1,
  best1RM: 2
};

const buildQueue = (prData) => {
  if (!prData?.recordTypes?.length) return [];
  const uniqueSorted = [...new Set(prData.recordTypes)].sort(
    (a, b) => (RECORD_PRIORITY[a] ?? 99) - (RECORD_PRIORITY[b] ?? 99)
  );

  return uniqueSorted.map((recordType) => ({
    exerciseName: prData.exerciseName || 'Exercise',
    recordType,
    meta: RECORD_META[recordType] || RECORD_META.best1RM
  }));
};

export const PRBanner = ({ prData, isVisible, onAutoClose }) => {
  const queue = useMemo(
    () => (isVisible && prData ? buildQueue(prData) : []),
    [prData, isVisible]
  );
  const queueKey = useMemo(
    () => queue.map(item => item.recordType).join('|') + `:${queue[0]?.exerciseName || ''}`,
    [queue]
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [phase, setPhase] = useState('pre'); // pre | enter | exit
  const [mounted, setMounted] = useState(false);
  const timersRef = useRef([]);
  const onAutoCloseRef = useRef(onAutoClose);
  const sequenceRef = useRef(0);

  useEffect(() => {
    onAutoCloseRef.current = onAutoClose;
  }, [onAutoClose]);

  const clearTimers = () => {
    timersRef.current.forEach(id => clearTimeout(id));
    timersRef.current = [];
  };

  useEffect(() => {
    sequenceRef.current += 1;
    const sequenceId = sequenceRef.current;
    clearTimers();
    if (!isVisible || queue.length === 0) {
      const hide = setTimeout(() => {
        if (sequenceRef.current !== sequenceId) return;
        setMounted(false);
        setActiveIndex(0);
        setPhase('pre');
      }, 0);
      timersRef.current.push(hide);
      return undefined;
    }

    const stepMs = 1950;
    const enterDelayMs = 70;
    const exitAtMs = 1380;
    const closeAtMs = queue.length * stepMs + 120;
    const schedule = (fn, delay) => {
      const id = setTimeout(() => {
        if (sequenceRef.current !== sequenceId) return;
        fn();
      }, delay);
      timersRef.current.push(id);
    };

    schedule(() => {
      setMounted(true);
      setActiveIndex(0);
      setPhase('pre');
    }, 0);

    for (let i = 0; i < queue.length; i += 1) {
      const base = i * stepMs;
      schedule(() => {
        setActiveIndex(i);
        setPhase('pre');
      }, base);
      schedule(() => setPhase('enter'), base + enterDelayMs);
      schedule(() => setPhase('exit'), base + exitAtMs);
    }

    schedule(() => {
      setMounted(false);
      onAutoCloseRef.current?.();
    }, closeAtMs);

    return () => clearTimers();
  }, [isVisible, queue.length, queueKey]);

  const current = queue[activeIndex] || null;
  const queueLabel = useMemo(() => {
    if (!current) return '';
    return `${activeIndex + 1}/${queue.length}`;
  }, [activeIndex, queue.length, current]);

  if (!isVisible || !mounted || !current) return null;

  const Icon = current.meta.icon;

  return (
    <div
      className={`fixed bottom-20 left-4 right-4 z-50 transition-all duration-300 ease-out will-change-transform ${
        phase === 'enter'
          ? 'opacity-100 translate-y-0 scale-100'
          : phase === 'exit'
          ? 'opacity-0 translate-y-10 scale-[0.98]'
          : 'opacity-0 translate-y-16 scale-[0.96]'
      }`}
    >
      <div className={`rounded-2xl border ${current.meta.border} bg-gradient-to-r ${current.meta.tone} p-[1px] shadow-2xl`}>
        <div className="rounded-[14px] bg-black/50 backdrop-blur-sm px-4 py-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-black/30 border border-white/25 flex items-center justify-center flex-shrink-0 shadow-lg">
                <Icon size={21} className="text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-white/85 font-semibold tracking-[0.18em] uppercase">New Personal Record</p>
                <p className="text-[15px] font-black text-white truncate leading-tight mt-0.5">{current.exerciseName}</p>
                <div className="mt-1 inline-flex items-center px-2 py-0.5 rounded-full bg-black/35 border border-white/20">
                  <p className="text-[11px] font-bold text-white/95">{current.meta.label}</p>
                </div>
              </div>
            </div>

            <div className="text-right flex-shrink-0">
              <p className="text-[10px] text-white/80 font-black tracking-wider">{queueLabel}</p>
            </div>
          </div>

          <div className="mt-2.5 flex items-center gap-1">
            {queue.map((_, index) => (
              <span
                key={`dot-${index}`}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  index === activeIndex ? 'w-4 bg-white/85' : 'w-1.5 bg-white/35'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PRBanner;
