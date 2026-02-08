import React, { useMemo, useState } from 'react';
import { formatDate } from '../domain/calculations';
import { SimpleLineChart } from '../components/SimpleLineChart';

export const ProfileView = ({ workouts = [], exercisesDB = [], userWeight, onUserWeightChange }) => {
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showStatsModal, setShowStatsModal] = useState(false);

  const statsByGroup = useMemo(() => {
    const map = {};

    workouts.forEach(w => {
      (w.exercises || []).forEach(ex => {
        const exDef = exercisesDB.find(d => d.id === ex.exerciseId) || {};
        const groups = (exDef.muscles && exDef.muscles.length > 0) ? exDef.muscles : [ex.category || 'Other'];

        // volume = sum of completed (kg + bodyweight?) * reps
        const vol = (ex.sets || []).filter(s => s.completed).reduce((suma, s) => {
          const baseKg = Number(s.kg) || 0;
          const kg = baseKg + ((exDef.usesBodyweight && userWeight) ? Number(userWeight) : 0);
          const repsNum = Number(s.reps) || 0;
          return suma + (kg * repsNum);
        }, 0);
        const reps = (ex.sets || []).filter(s => s.completed).reduce((suma, s) => suma + (Number(s.reps) || 0), 0);

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
    <div className="min-h-screen bg-black text-white pb-40">
      {/* Header */}
      <div className="bg-gradient-to-b from-black to-black/80 border-b border-white/10 p-4 sticky top-0 z-20 shadow-2xl">
        <h1 className="text-4xl font-black">PROFILE</h1>
        <p className="text-xs text-slate-400 mt-2 font-semibold tracking-widest">YOUR STATS & INFO</p>
      </div>

      <div className="p-4 space-y-5">
        {/* Statistics Card */}
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-xl p-5">
          <h2 className="text-sm font-black text-slate-300 uppercase tracking-widest mb-4">Volume by Muscle/Category</h2>

          {statsByGroup.length === 0 ? (
            <div className="text-slate-500 text-sm py-6 text-center">No training data yet</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {statsByGroup.slice(0, 12).map((s) => (
                <button
                  key={s.group}
                  onClick={() => { setSelectedGroup(s.group); setShowStatsModal(true); }}
                  className="text-left bg-slate-800/40 hover:bg-slate-800/60 border border-slate-700/50 hover:border-slate-600/50 p-4 rounded-lg flex justify-between items-center transition-all ui-card-mount-anim"
                >
                  <div>
                    <div className="font-black text-white">{s.group}</div>
                    <div className="text-xs text-slate-500 mt-1 font-semibold">{s.sessions} sessions</div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-blue-400">{s.volume.toLocaleString()} kg</div>
                    <div className="text-xs text-slate-400 mt-1 font-semibold">{s.reps.toLocaleString()} reps</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Personal Info Card */}
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-xl p-5">
          <h2 className="text-sm font-black text-slate-300 uppercase tracking-widest mb-4">Personal Info</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Your name"
              className="w-full bg-slate-800/50 border border-slate-600/50 rounded-lg px-4 py-3 text-white font-semibold focus:border-blue-500 focus:outline-none transition placeholder:text-slate-600"
            />
            <input
              type="number"
              placeholder="Age"
              className="w-full bg-slate-800/50 border border-slate-600/50 rounded-lg px-4 py-3 text-white font-semibold focus:border-blue-500 focus:outline-none transition placeholder:text-slate-600"
            />
            <input
              type="number"
              placeholder="Weight (kg)"
              value={userWeight ?? ''}
              onChange={(e) => onUserWeightChange && onUserWeightChange(Number(e.target.value) || null)}
              className="w-full bg-slate-800/50 border border-slate-600/50 rounded-lg px-4 py-3 text-white font-semibold focus:border-blue-500 focus:outline-none transition placeholder:text-slate-600"
            />
          </div>
        </div>
      </div>

      {/* Stats Modal */}
      {showStatsModal && selectedGroup && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-start justify-center p-4 pt-20">
            <div className="w-full max-w-2xl bg-gradient-to-br from-slate-900/95 to-black/95 border border-slate-700/50 rounded-2xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto ui-modal-scale ui-fade-scale-anim">
            <div className="flex justify-between items-center mb-5 pb-4 border-b border-slate-700/50">
              <h3 className="text-2xl font-black">{selectedGroup}</h3>
              <button onClick={() => setShowStatsModal(false)} className="p-2 hover:bg-white/10 rounded-lg transition text-slate-400">
                <span className="text-xl">×</span>
              </button>
            </div>

            {/* Charts and Stats */}
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
                  {/* Charts */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-slate-800/40 border border-slate-700/50 p-4 rounded-lg">
                      <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-3">Volume — Weekly</div>
                      <SimpleLineChart data={weeks.map(w=>({date:w.date,value:w.value}))} color="#3b82f6" unit="kg" />
                    </div>
                    <div className="bg-slate-800/40 border border-slate-700/50 p-4 rounded-lg">
                      <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-3">Time — Weekly</div>
                      <SimpleLineChart data={weeks.map(w=>({date:w.date,value:w.duration}))} color="#8b5cf6" unit="min" />
                    </div>
                  </div>

                  {/* Period Totals */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/20 p-3 rounded-lg text-center">
                      <div className="text-xs text-slate-400 font-semibold mb-1">LAST WEEK</div>
                      <div className="font-black text-white text-lg">{lastWeekTotals.count}</div>
                      <div className="text-xs text-blue-400 font-bold mt-1">{lastWeekTotals.volume.toLocaleString()} kg</div>
                    </div>
                    <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 border border-emerald-500/20 p-3 rounded-lg text-center">
                      <div className="text-xs text-slate-400 font-semibold mb-1">LAST MONTH</div>
                      <div className="font-black text-white text-lg">{lastMonthTotals.count}</div>
                      <div className="text-xs text-emerald-400 font-bold mt-1">{lastMonthTotals.volume.toLocaleString()} kg</div>
                    </div>
                    <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border border-purple-500/20 p-3 rounded-lg text-center">
                      <div className="text-xs text-slate-400 font-semibold mb-1">Q THIS YEAR</div>
                      <div className="font-black text-white text-lg">{quarterTotals.count}</div>
                      <div className="text-xs text-purple-400 font-bold mt-1">{quarterTotals.volume.toLocaleString()} kg</div>
                    </div>
                    <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/10 border border-amber-500/20 p-3 rounded-lg text-center">
                      <div className="text-xs text-slate-400 font-semibold mb-1">THIS YEAR</div>
                      <div className="font-black text-white text-lg">{yearTotals.count}</div>
                      <div className="text-xs text-amber-400 font-bold mt-1">{yearTotals.volume.toLocaleString()} kg</div>
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