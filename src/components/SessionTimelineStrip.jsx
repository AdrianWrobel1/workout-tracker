import React, { useMemo } from 'react';
import { resolveSetType } from '../domain/workoutExtensions';

const TYPE_TONE = {
  warmup: 'bg-amber-500/45 border-amber-400/60',
  work: 'bg-slate-600/55 border-slate-500/60',
  drop: 'bg-violet-500/50 border-violet-400/60',
  failure: 'bg-rose-500/50 border-rose-400/60',
  tempo: 'bg-cyan-500/50 border-cyan-400/60',
  pause: 'bg-indigo-500/50 border-indigo-400/60'
};

export const SessionTimelineStrip = React.memo(({ activeWorkout }) => {
  const timelineSets = useMemo(() => {
    const items = [];
    const exercises = activeWorkout?.exercises || [];

    for (let exIndex = 0; exIndex < exercises.length; exIndex += 1) {
      const exercise = exercises[exIndex];
      const sets = exercise?.sets || [];
      for (let setIndex = 0; setIndex < sets.length; setIndex += 1) {
        const set = sets[setIndex];
        items.push({
          key: `${exercise.exerciseId || exercise.name || exIndex}:${setIndex}`,
          type: resolveSetType(set),
          completed: Boolean(set?.completed),
          isPr: Boolean(set?.isBest1RM || set?.isBestSetVolume || set?.isHeaviestWeight)
        });
      }
    }

    return items;
  }, [activeWorkout?.exercises]);

  if (!timelineSets.length) return null;

  const completed = timelineSets.filter(item => item.completed).length;

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-900/55 p-2.5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-semibold tracking-widest text-slate-400">SESSION TIMELINE</p>
        <p className="text-[10px] font-bold text-slate-300">{completed}/{timelineSets.length}</p>
      </div>

      <div className="overflow-x-auto pt-1">
        <div className="flex gap-1.5 min-w-max pb-1">
          {timelineSets.map((item, index) => {
            const tone = TYPE_TONE[item.type] || TYPE_TONE.work;
            return (
              <div
                key={item.key}
                title={`Set ${index + 1} - ${item.type}`}
                className={`relative w-4 h-6 rounded-md border overflow-visible ${tone} transition-all ${
                  item.completed ? 'opacity-100 scale-100' : 'opacity-50 scale-[0.97]'
                }`}
              >
                {item.isPr && (
                  <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-yellow-300 border border-yellow-200 shadow-[0_0_8px_rgba(253,224,71,0.75)] translate-x-[35%] -translate-y-[35%]" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

SessionTimelineStrip.displayName = 'SessionTimelineStrip';
