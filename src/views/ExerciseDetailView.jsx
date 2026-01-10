import React, { useState, useMemo } from 'react';
import { ChevronLeft, Trophy } from 'lucide-react';
import { SimpleLineChart } from '../components/SimpleLineChart';
import { getExerciseHistory, getExerciseRecords } from '../domain/exercises';

export const ExerciseDetailView = ({ exerciseId, workouts, exercisesDB, onBack, onOpenWorkout, userWeight }) => {
  const [activeTab, setActiveTab] = useState('history');
  const [selectedWeek, setSelectedWeek] = useState(null);

  const exerciseDef = exercisesDB.find(e => e.id === exerciseId);
  const history = useMemo(() => getExerciseHistory(exerciseId, workouts), [exerciseId, workouts]);
  const records = useMemo(() => getExerciseRecords(exerciseId, workouts), [exerciseId, workouts]);
  const chartData = useMemo(() => {
    return [...history].reverse().map(h => ({
      date: new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: h.max1RM
    }));
  }, [history]);

  // Aggregate volume by week (week starting Monday)
  const weeklyVolume = useMemo(() => {
    const map = {}; // weekKey -> { start: Date, weight, reps }

    const getWeekStart = (dateStr) => {
      const d = new Date(dateStr);
      const day = d.getDay();
      const diff = d.getDate() - ((day + 6) % 7); // Monday as start
      const ws = new Date(d);
      ws.setDate(diff);
      ws.setHours(0,0,0,0);
      return ws;
    };

      [...history].reverse().forEach(h => {
      const ws = getWeekStart(h.date);
      const key = ws.toISOString().substring(0,10);
      const exDef = exercisesDB.find(d => d.id === exerciseId) || {};
      const totalWeight = h.sets.reduce((s, x) => {
        const baseKg = Number(x.kg) || 0;
        const kg = baseKg + ((exDef.usesBodyweight && userWeight) ? Number(userWeight) : 0);
        return s + (kg * x.reps);
      }, 0);
      const totalReps = h.sets.reduce((s, x) => s + (x.reps || 0), 0);
      if (!map[key]) map[key] = { start: ws, weight: 0, reps: 0 };
      map[key].weight += totalWeight;
      map[key].reps += totalReps;
    });

    return Object.values(map).sort((a,b) => a.start - b.start).map(w => {
      const start = w.start;
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      const label = `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}-${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      return { date: label, weight: w.weight, reps: w.reps, startISO: start.toISOString().substring(0,10), endISO: end.toISOString().substring(0,10) };
    });
  }, [history]);

  if (!exerciseDef) return null;

  return (
    <div className="min-h-screen bg-zinc-900 text-white flex flex-col">
      <div className="bg-zinc-800 p-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center gap-4 mb-4">
          <button onClick={onBack} className="p-2 bg-zinc-700 rounded-full hover:bg-zinc-600 transition">
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold leading-tight">{exerciseDef.name}</h1>
            <p className="text-xs text-zinc-400">
              {exerciseDef.category} • {exerciseDef.muscles?.join(', ')}
            </p>
          </div>
        </div>

        <div className="flex bg-zinc-900/50 p-1 rounded-xl">
          {['History', 'Charts', 'Records'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab.toLowerCase())}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all
                ${activeTab === tab.toLowerCase() ? 'bg-zinc-700 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>
      {selectedWeek && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center p-4">
          <div className="w-full max-w-xl bg-zinc-900 rounded-2xl p-4 border border-zinc-800 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Week {selectedWeek.date}</h3>
              <button onClick={() => setSelectedWeek(null)} className="text-zinc-400">Close</button>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {/* Build day-by-day breakdown */}
              {(() => {
                const days = [];
                const start = new Date(selectedWeek.startISO);
                for (let i = 0; i < 7; i++) {
                  const d = new Date(start);
                  d.setDate(start.getDate() + i);
                  const iso = d.toISOString().substring(0,10);
                  const dayWorkouts = workouts.filter(w => w.date === iso);
                  let vol = 0;
                  let mins = 0;
                  dayWorkouts.forEach(w => {
                    (w.exercises||[]).forEach(ex => {
                      const exEntry = ex;
                      const setsVol = (exEntry.sets||[]).filter(s=>s.completed).reduce((s2,s)=>s2+(s.kg*s.reps),0);
                      vol += setsVol;
                    });
                    mins += (w.duration||0);
                  });

                  days.push({ iso, label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), vol, mins, workouts: dayWorkouts });
                }

                const maxVol = Math.max(...days.map(d=>d.vol), 1);
                return days.map((day, idx) => (
                  <div key={idx} className="flex items-center gap-4 bg-zinc-800 p-3 rounded-lg">
                    <div className="w-28 text-xs text-zinc-400">{day.label}</div>
                    <div className="flex-1 h-8 bg-zinc-900 rounded overflow-hidden">
                      <div style={{ width: `${(day.vol/maxVol)*100}%` }} className="h-full bg-rose-400"></div>
                    </div>
                    <div className="w-28 text-right text-sm">
                      <div className="font-bold">{day.vol} kg</div>
                      <div className="text-xs text-zinc-400">{day.mins} min</div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      <div className="p-4 grow overflow-y-auto pb-24">
        {activeTab === 'history' && (
          <div className="space-y-6">
            {history.length === 0 && <div className="text-center text-zinc-500 mt-10">No history yet</div>}
              {history.map((item, i) => {
              const prevItem = history[i - 1];
              const currentMonth = item.date.substring(0, 7);
              const prevMonth = prevItem?.date.substring(0, 7);
              const showMonth = currentMonth !== prevMonth;

              return (
                <React.Fragment key={i}>
                  {showMonth && (
                    <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider sticky top-0 bg-zinc-900 py-2">
                      {new Date(item.date).toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                    </h3>
                  )}
                  <div className="bg-zinc-800 rounded-xl p-4 border border-zinc-700/50">
                    <div className="flex justify-between items-baseline mb-3">
                      <span className="font-semibold text-rose-400">
                        {new Date(item.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                      </span>
                      <span className="text-xs text-zinc-500">1RM: {item.max1RM} kg</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {item.sets.map((set, idx) => (
                        <button key={idx} onClick={() => onOpenWorkout && onOpenWorkout(item.date)} className="bg-zinc-900 px-3 py-1.5 rounded-lg text-sm border border-zinc-700 hover:bg-zinc-900/60">
                          <span className="font-bold text-white">{set.kg}</span>
                          <span className="text-zinc-500 text-xs mx-1">×</span>
                          <span className="text-zinc-300">{set.reps}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}

        {activeTab === 'charts' && (
          <div className="mt-4">
            <div className="bg-zinc-800 rounded-2xl p-4 mb-4 border border-zinc-700">
              <h3 className="text-sm text-zinc-400 mb-6 font-medium uppercase tracking-wider">
                Estimated 1RM Progress
              </h3>
              <SimpleLineChart data={chartData} />
            </div>
            <div className="bg-zinc-800 rounded-2xl p-4 mb-4 border border-zinc-700">
              <h3 className="text-sm text-zinc-400 mb-6 font-medium uppercase tracking-wider">Volume</h3>
              <div className="space-y-4">
                <SimpleLineChart data={weeklyVolume.map(d => ({ date: d.date, value: d.weight, startISO: d.startISO, endISO: d.endISO }))} color="#f59e0b" unit="kg" onPointClick={(i, item) => setSelectedWeek(item)} />
                <SimpleLineChart data={weeklyVolume.map(d => ({ date: d.date, value: d.reps, startISO: d.startISO, endISO: d.endISO }))} color="#60a5fa" unit="reps" onPointClick={(i, item) => setSelectedWeek(item)} />
              </div>
            </div>

            <p className="text-xs text-zinc-500 text-center px-4">
              Charts: top — estimated 1RM; Volume charts show total lifted weight (kg) and total reps per session.
            </p>
          </div>
        )}

        {activeTab === 'records' && (
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="col-span-2 bg-gradient-to-br from-amber-500/20 to-amber-600/5 border border-amber-500/30 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
              <Trophy className="text-amber-500 mb-2" size={32} />
              <div className="text-3xl font-bold text-white mb-1">
                {records.best1RM} <span className="text-base font-normal text-zinc-400">kg</span>
              </div>
              <div className="text-xs text-amber-400 uppercase font-bold tracking-wider">All-time Best 1RM</div>
              {records.best1RMDate && <div className="text-xs text-zinc-400 mt-2">Set on {new Date(records.best1RMDate).toLocaleDateString()}</div>}
            </div>

            <div className="bg-zinc-800 rounded-2xl p-5 border border-zinc-700">
              <div className="text-zinc-400 text-xs uppercase font-bold mb-2">Max Weight</div>
              <div className="text-2xl font-bold text-white">
                {records.maxWeight} <span className="text-sm font-normal text-zinc-500">kg</span>
                {records.maxWeightDate && <div className="text-xs text-zinc-500 mt-2">{new Date(records.maxWeightDate).toLocaleDateString()}</div>}
              </div>
            </div>

            <div className="bg-zinc-800 rounded-2xl p-5 border border-zinc-700">
              <div className="text-zinc-400 text-xs uppercase font-bold mb-2">Max Reps</div>
              <div className="text-2xl font-bold text-white">
                {records.maxReps} <span className="text-sm font-normal text-zinc-500">reps</span>
                {records.maxRepsDate && <div className="text-xs text-zinc-500 mt-2">{new Date(records.maxRepsDate).toLocaleDateString()}</div>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};