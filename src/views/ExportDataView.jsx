import React, { useMemo, useState } from 'react';
import { ChevronLeft, Download, CalendarRange, FileJson, FileText } from 'lucide-react';

export const ExportDataView = ({ onBack, onExport }) => {
  const [exportMode, setExportMode] = useState('period'); // 'period' | 'all'
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [format, setFormat] = useState('');

  const isDateRangeValid = useMemo(() => {
    if (exportMode === 'all') return true;
    if (!fromDate || !toDate) return false;
    return new Date(fromDate) <= new Date(toDate);
  }, [exportMode, fromDate, toDate]);

  const isValid = exportMode === 'all'
    ? Boolean(format)
    : Boolean(fromDate && toDate && format && isDateRangeValid);

  const handleExport = () => {
    if (!isValid) return;
    onExport({ fromDate, toDate, format, exportMode });
  };

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      <div className="sticky top-0 z-20 bg-gradient-to-b from-black to-black/80 border-b border-white/10 px-4 py-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-white/10 transition">
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-black">Export Data</h1>
            <p className="text-[11px] text-slate-400 font-semibold tracking-widest mt-0.5">CUSTOM EXPORT</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <CalendarRange size={16} className="text-slate-300" />
            <p className="text-xs font-semibold tracking-widest text-slate-400">SCOPE</p>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={() => setExportMode('period')}
              className={`text-left rounded-lg border px-3 py-2.5 transition ${
                exportMode === 'period'
                  ? 'accent-bg-light accent-border-light text-white'
                  : 'bg-slate-900/50 border-slate-700/60 text-slate-300 hover:border-slate-600/70'
              }`}
            >
              <p className="text-sm font-bold">Date range</p>
              <p className="text-[11px] opacity-80 mt-0.5">Export workouts from selected period</p>
            </button>
            <button
              onClick={() => setExportMode('all')}
              className={`text-left rounded-lg border px-3 py-2.5 transition ${
                exportMode === 'all'
                  ? 'accent-bg-light accent-border-light text-white'
                  : 'bg-slate-900/50 border-slate-700/60 text-slate-300 hover:border-slate-600/70'
              }`}
            >
              <p className="text-sm font-bold">Full backup</p>
              <p className="text-[11px] opacity-80 mt-0.5">Workouts + exercises + templates</p>
            </button>
          </div>
        </div>

        {exportMode === 'period' && (
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-xl p-4">
            <p className="text-xs font-semibold tracking-widest text-slate-400 mb-3">DATE RANGE</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 font-semibold mb-1.5">From</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(event) => setFromDate(event.target.value)}
                  className="w-full bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:accent-ring focus:border-accent transition"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 font-semibold mb-1.5">To</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(event) => setToDate(event.target.value)}
                  className="w-full bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:accent-ring focus:border-accent transition"
                />
              </div>
            </div>
            {!isDateRangeValid && fromDate && toDate && (
              <p className="text-xs text-rose-300 mt-2">Start date must be earlier than end date.</p>
            )}
          </div>
        )}

        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs font-semibold tracking-widest text-slate-400 mb-3">FORMAT</p>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => setFormat('txt')}
              className={`rounded-lg border px-3 py-3 transition ${
                format === 'txt'
                  ? 'accent-bg-light accent-border-light text-white'
                  : 'bg-slate-900/50 border-slate-700/60 text-slate-300 hover:border-slate-600/70'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <FileText size={16} />
                <span className="text-sm font-bold">TXT</span>
              </div>
            </button>
            <button
              onClick={() => setFormat('json')}
              className={`rounded-lg border px-3 py-3 transition ${
                format === 'json'
                  ? 'accent-bg-light accent-border-light text-white'
                  : 'bg-slate-900/50 border-slate-700/60 text-slate-300 hover:border-slate-600/70'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <FileJson size={16} />
                <span className="text-sm font-bold">JSON</span>
              </div>
            </button>
          </div>
        </div>

        <button
          onClick={handleExport}
          disabled={!isValid}
          className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
            isValid
              ? 'bg-gradient-accent text-white shadow-lg ui-press'
              : 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
          }`}
        >
          <Download size={18} />
          Export
        </button>

        <p className="text-[11px] text-slate-500 text-center">
          {format ? `Format: ${format.toUpperCase()}` : 'Choose format to continue'}
        </p>
      </div>
    </div>
  );
};
