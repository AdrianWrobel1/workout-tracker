import { Medal, Trophy, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

const RECORD_META = {
  heaviestWeight: {
    label: 'Heaviest Weight',
    tone: 'from-amber-900 via-orange-800 to-amber-700',
    border: 'border-amber-300/50',
    icon: Trophy
  },
  bestSetVolume: {
    label: 'Best Set Volume',
    tone: 'from-cyan-500 via-sky-500 to-blue-500',
    border: 'border-cyan-200/40',
    icon: Sparkles
  },
  best1RM: {
    label: 'Best 1RM',
    tone: 'from-emerald-500 via-green-500 to-teal-500',
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

  const queueKey = useMemo(() => {
    if (!queue.length) return '';
    return `${prData?.eventId || ''}:${queue.map((item) => item.recordType).join('|')}:${queue[0]?.exerciseName || ''}`;
  }, [prData?.eventId, queue]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [phase, setPhase] = useState('badge-pre'); // badge-pre | badge-in | expand | exit
  const [mounted, setMounted] = useState(false);
  const [slideDirection, setSlideDirection] = useState('up'); // up | left | right

  const timersRef = useRef([]);
  const onAutoCloseRef = useRef(onAutoClose);
  const sequenceRef = useRef(0);

  useEffect(() => {
    onAutoCloseRef.current = onAutoClose;
  }, [onAutoClose]);

  const clearTimers = () => {
    timersRef.current.forEach((id) => clearTimeout(id));
    timersRef.current = [];
  };

  useEffect(() => {
    sequenceRef.current += 1;
    const sequenceId = sequenceRef.current;
    clearTimers();

    if (!isVisible || queue.length === 0) {
      const hideId = setTimeout(() => {
        if (sequenceRef.current !== sequenceId) return;
        setMounted(false);
        setActiveIndex(0);
        setPhase('badge-pre');
        setSlideDirection('up');
      }, 0);
      timersRef.current.push(hideId);
      return () => clearTimers();
    }

    const ITEM_MS = 2400;
    const BADGE_IN_DELAY = 40;
    const EXPAND_AT = 300;
    const EXIT_AT = 2050;
    const CLOSE_AT = queue.length * ITEM_MS + 120;

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
      setPhase('badge-pre');
      setSlideDirection('up');
    }, 0);

    for (let i = 0; i < queue.length; i += 1) {
      const base = i * ITEM_MS;
      schedule(() => {
        setActiveIndex(i);
        setPhase('badge-pre');
        if (i === 0) {
          setSlideDirection('up');
        } else {
          setSlideDirection(i % 2 === 0 ? 'left' : 'right');
        }
      }, base);

      schedule(() => setPhase('badge-in'), base + BADGE_IN_DELAY);
      schedule(() => setPhase('expand'), base + EXPAND_AT);
      schedule(() => setPhase('exit'), base + EXIT_AT);
    }

    schedule(() => {
      setMounted(false);
      setPhase('badge-pre');
      onAutoCloseRef.current?.();
    }, CLOSE_AT);

    return () => clearTimers();
  }, [isVisible, queue.length, queueKey]);

  const current = queue[activeIndex] || null;

  if (!isVisible || !mounted || !current) return null;

  const Icon = current.meta.icon;
  const isExpanded = phase === 'expand' || phase === 'exit';

  const exitClass = slideDirection === 'left'
    ? 'opacity-0 -translate-x-10 scale-[0.97]'
    : slideDirection === 'right'
    ? 'opacity-0 translate-x-10 scale-[0.97]'
    : 'opacity-0 -translate-y-1 scale-[0.97]';

  const shellMotionClass = phase === 'expand'
    ? 'opacity-100 translate-x-0 translate-y-0 scale-100'
    : phase === 'exit'
    ? exitClass
    : phase === 'badge-in'
    ? 'opacity-100 translate-x-0 translate-y-0 scale-100'
    : 'opacity-0 translate-y-2 scale-[0.9]';

  const shellSizeClass = isExpanded
    ? 'w-[min(94vw,368px)] h-[64px] rounded-[999px] px-3'
    : 'w-12 h-12 rounded-full px-0';

  return (
    <div className="fixed top-[56px] left-0 right-0 z-50 pointer-events-none px-2">
      <div className="relative mx-auto w-[min(94vw,368px)] h-[84px] flex items-start justify-center">
        <div className={`transition-all duration-300 ease-out will-change-transform ${shellMotionClass}`}>
          <div className={`border ${current.meta.border} bg-gradient-to-r ${current.meta.tone} shadow-2xl transition-all duration-280 ease-out ${shellSizeClass}`}>
            <div
              className={`h-full w-full flex items-center transition-all duration-280 ease-out ${
                isExpanded ? 'rounded-[999px] justify-start' : 'rounded-full justify-center'
              }`}
            >
              <div className={`rounded-full bg-black/15 border border-white/35 flex items-center justify-center flex-shrink-0 ${
                isExpanded ? 'w-[38px] h-[38px]' : 'w-[40px] h-[40px]'
              }`}>
                <Icon size={isExpanded ? 15 : 17} className="text-white" />
              </div>

              <div className={`overflow-hidden transition-all duration-280 ease-out ${
                isExpanded ? 'max-w-[262px] opacity-100 ml-3' : 'max-w-0 opacity-0 ml-0'
              }`}>
                <div className="min-w-0">
                  <p className="text-[8px] text-white/95 font-semibold tracking-[0.18em] uppercase leading-none">New Personal Record</p>
                  <p className="text-[14px] font-black text-white truncate leading-tight mt-0.5">{current.exerciseName}</p>
                  <p className="text-[11px] text-white/95 font-semibold mt-0.5">{current.meta.label}</p>
                </div>
              </div>

              <div className={`ml-auto text-[10px] text-white/90 font-black tracking-wider transition-opacity duration-200 ${
                isExpanded ? 'opacity-100' : 'opacity-0'
              }`}>
                {activeIndex + 1}/{queue.length}
              </div>
            </div>
          </div>

          <div className={`mt-1 flex items-center justify-center gap-1 transition-opacity duration-200 ${
            isExpanded ? 'opacity-100' : 'opacity-0'
          }`}>
            {queue.map((_, index) => (
              <span
                key={`dot-${index}`}
                className={`h-1 rounded-full transition-all duration-200 ${
                  index === activeIndex ? 'w-3.5 bg-white/95' : 'w-1 bg-white/45'
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


