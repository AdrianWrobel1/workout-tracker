import React, { useMemo, useState } from 'react';
import { formatDate } from '../domain/calculations';
import { SimpleLineChart } from '../components/SimpleLineChart';

export const ProfileView = ({ workouts = [], exercisesDB = [] }) => {
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showStatsModal, setShowStatsModal] = useState(false);

  const statsByGroup = useMemo(() => {
    const map = {};

    workouts.forEach(w => {
      (w.exercises || []).forEach(ex => {
        const exDef = exercisesDB.find(d => d.id === ex.exerciseId) || {};
        const groups = (exDef.muscles && exDef.muscles.length > 0) ? exDef.muscles : [ex.category || 'Other'];

        // volume = sum of completed kg * reps
        const vol = (ex.sets || []).filter(s => s.completed).reduce((suma, s) => suma + (s.kg * s.reps), 0);
        const reps = (ex.sets || []).filter(s => s.completed).reduce((suma, s) => suma + (s.reps || 0), 0);

        groups.forEach(g => {
          if (!map[g]) map[g] = { volume: 0, reps: 0, sessions: 0 };
          map[g].volume += vol;
          map[g].reps += reps;
          if (vol > 0) map[g].sessions += 1;
        });
      });
    });

    return Object.entries(map)
      .map(([group, data]) => ({ group, ...data }))
      .sort((a, b) => b.volume - a.volume);
  }, [workouts, exercisesDB]);

  return (
    <div className="min-h-screen bg-zinc-900 text-white pb-40">
      <div className="bg-zinc-800 p-4 mb-4">
        <h1 className="text-2xl font-bold">Profile</h1>
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-zinc-800 rounded-2xl p-4 border border-zinc-700">
          <h2 className="text-sm text-zinc-400 mb-3 font-semibold">Statistics — Volume by Muscle/Category</h2>

          {statsByGroup.length === 0 && (
            <div className="text-zinc-500 text-sm">No training data yet.</div>
          )}

          {statsByGroup.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {statsByGroup.slice(0, 12).map((s) => (
                  <button key={s.group} onClick={() => { setSelectedGroup(s.group); setShowStatsModal(true); }} className="text-left bg-zinc-900/30 p-3 rounded-lg border border-zinc-700 flex justify-between items-center hover:bg-zinc-900/50">
                    <div>
                      <div className="font-semibold">{s.group}</div>
                      <div className="text-xs text-zinc-400">{s.sessions} sessions</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-rose-400">{s.volume} kg</div>
                      <div className="text-xs text-zinc-400">{s.reps} reps</div>
                    </div>
                  </button>
                ))}
            </div>
          )}
        </div>

        <div className="bg-zinc-800 rounded-2xl p-4 border border-zinc-700">
          <h2 className="text-sm text-zinc-400 mb-3 font-semibold">Personal Info</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Your name"
              className="w-full bg-zinc-900 rounded-xl p-3 text-white border border-transparent focus:border-rose-500 outline-none"
            />
            <input
              type="number"
              placeholder="Age"
              className="w-full bg-zinc-900 rounded-xl p-3 text-white border border-transparent focus:border-rose-500 outline-none"
            />
            <input
              type="number"
              placeholder="Weight (kg)"
              className="w-full bg-zinc-900 rounded-xl p-3 text-white border border-transparent focus:border-rose-500 outline-none"
            />
          </div>
        </div>
      </div>
      {showStatsModal && selectedGroup && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center p-4">
          <div className="w-full max-w-2xl bg-zinc-900 rounded-2xl p-4 border border-zinc-800 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">{selectedGroup} — Weekly Statistics</h3>
              <button onClick={() => setShowStatsModal(false)} className="text-zinc-400">Close</button>
            </div>

            {/* Aggregate weekly data for selected group */}
            {(() => {
              const getWeekStart = (dateStr) => {
                const d = new Date(dateStr);
                const day = d.getDay();
                const diff = d.getDate() - ((day + 6) % 7);
                const ws = new Date(d);
                ws.setDate(diff);
                ws.setHours(0,0,0,0);
                return ws;
              };

              const map = {};
              workouts.forEach(w => {
                (w.exercises || []).forEach(ex => {
                  const exDef = exercisesDB.find(d => d.id === ex.exerciseId) || {};
                  const groups = (exDef.muscles && exDef.muscles.length > 0) ? exDef.muscles : [ex.category || 'Other'];
                  if (!groups.includes(selectedGroup)) return;
                  const ws = getWeekStart(w.date);
                  const key = ws.toISOString().substring(0,10);
                  const vol = (ex.sets || []).filter(s => s.completed).reduce((suma, s) => suma + (s.kg * s.reps), 0);
                  if (!map[key]) map[key] = { start: ws, volume: 0, duration: 0 };
                  map[key].volume += vol;
                  map[key].duration += (w.duration || 0);
                });
              });

              const weeks = Object.values(map).sort((a,b)=>a.start-b.start).map(w=>({ date: w.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), value: w.volume, duration: w.duration }));

              // Summary counts for last week/month/quarter/year
              const now = new Date();
              const startOfThisWeek = (()=>{ const d=new Date(now); const day=d.getDay(); const diff=d.getDate()-((day+6)%7); d.setDate(diff); d.setHours(0,0,0,0); return d; })();
              const startOfLastWeek = new Date(startOfThisWeek); startOfLastWeek.setDate(startOfThisWeek.getDate()-7);
              const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
              const startOfLastMonth = new Date(now.getFullYear(), now.getMonth()-1, 1);
              const startOfThisQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth()/3)*3, 1);
              const startOfThisYear = new Date(now.getFullYear(),0,1);

              const periodTotals = (start, end) => {
                let count=0, duration=0, volume=0;
                workouts.forEach(w=>{
                  const wd = new Date(w.date);
                  if (wd >= start && wd <= (end||now)) {
                    const vol = (w.exercises||[]).reduce((sum,ex)=>{
                      const exDef = exercisesDB.find(d => d.id === ex.exerciseId) || {};
                      const groups = (exDef.muscles && exDef.muscles.length>0)?exDef.muscles:[ex.category||'Other'];
                      if (!groups.includes(selectedGroup)) return sum;
                      return sum + (ex.sets||[]).filter(s=>s.completed).reduce((s2,s)=>s2+(s.kg*s.reps),0);
                    },0);
                    if (vol>0) { count++; volume+=vol; duration+= (w.duration||0); }
                  }
                });
                return { count, volume, duration };
              };

              const lastWeekTotals = periodTotals(startOfLastWeek, new Date(startOfThisWeek.getTime()-1));
              const lastMonthTotals = periodTotals(startOfLastMonth, new Date(startOfThisMonth.getTime()-1));
              const quarterTotals = periodTotals(startOfThisQuarter, now);
              const yearTotals = periodTotals(startOfThisYear, now);

              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-zinc-800 p-4 rounded-xl border border-zinc-700">
                      <div className="text-xs text-zinc-400 mb-2">Volume — weekly</div>
                      <SimpleLineChart data={weeks.map(w=>({date:w.date,value:w.value}))} color="#f59e0b" unit="kg" />
                    </div>
                    <div className="bg-zinc-800 p-4 rounded-xl border border-zinc-700">
                      <div className="text-xs text-zinc-400 mb-2">Training time — weekly (minutes)</div>
                      <SimpleLineChart data={weeks.map(w=>({date:w.date,value:w.duration}))} color="#60a5fa" unit="min" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="bg-zinc-900/20 p-3 rounded-lg text-center">
                      <div className="text-xs text-zinc-400">Last week</div>
                      <div className="font-bold text-white">{lastWeekTotals.count} sessions</div>
                      <div className="text-sm text-rose-400">{lastWeekTotals.volume} kg</div>
                    </div>
                    <div className="bg-zinc-900/20 p-3 rounded-lg text-center">
                      <div className="text-xs text-zinc-400">Last month</div>
                      <div className="font-bold text-white">{lastMonthTotals.count} sessions</div>
                      <div className="text-sm text-rose-400">{lastMonthTotals.volume} kg</div>
                    </div>
                    <div className="bg-zinc-900/20 p-3 rounded-lg text-center">
                      <div className="text-xs text-zinc-400">This quarter</div>
                      <div className="font-bold text-white">{quarterTotals.count} sessions</div>
                      <div className="text-sm text-rose-400">{quarterTotals.volume} kg</div>
                    </div>
                    <div className="bg-zinc-900/20 p-3 rounded-lg text-center">
                      <div className="text-xs text-zinc-400">This year</div>
                      <div className="font-bold text-white">{yearTotals.count} sessions</div>
                      <div className="text-sm text-rose-400">{yearTotals.volume} kg</div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};