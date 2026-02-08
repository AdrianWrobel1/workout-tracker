import React, { useState } from 'react';
import { ChevronLeft } from 'lucide-react';

export const ExportDataView = ({ onBack, onExport }) => {
  const [exportMode, setExportMode] = useState('period'); // 'period' | 'all'
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [format, setFormat] = useState('');

  const isValid = exportMode === 'all' 
    ? format 
    : (fromDate && toDate && format);
  const fromDateObj = new Date(fromDate);
  const toDateObj = new Date(toDate);
  const isDateRangeValid = exportMode === 'all' || (fromDateObj <= toDateObj);

  const handleExport = () => {
    if (isValid && isDateRangeValid) {
      onExport({ fromDate, toDate, format, exportMode });
    }
  };

  return (
    <div className="min-h-screen bg-zinc-900 text-white pb-24">
      {/* Header */}
      <div className="bg-zinc-800 p-4 flex items-center gap-4 sticky top-0 z-10 shadow-md">
        <button onClick={onBack} className="hover:text-zinc-300 transition">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">Eksport danych</h1>
      </div>

      <div className="p-6 space-y-6">
        {/* Export Mode Section */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Zakres eksportu</h2>
          
          <div className="space-y-2.5">
            {[
              { value: 'period', label: 'Treningi z zakresu dat' },
              { value: 'all', label: 'Wszystko (treningi + ćwiczenia + szablony)' }
            ].map(opt => (
              <label key={opt.value} className="flex items-center gap-3 p-4 rounded-lg bg-zinc-800 hover:bg-zinc-750 cursor-pointer transition border border-zinc-700 hover:border-zinc-600"
              >
                <input
                  type="radio"
                  name="exportMode"
                  value={opt.value}
                  checked={exportMode === opt.value}
                  onChange={(e) => setExportMode(e.target.value)}
                  className="w-4 h-4 cursor-pointer accent-rose-500"
                />
                <span className="text-sm text-white flex-1">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Date Range Section - visible only for period mode */}
        {exportMode === 'period' && (
          <div className="space-y-4 pt-4 border-t border-zinc-700">
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Zakres dat</h2>
            
            <div className="space-y-2">
              <label className="block text-xs text-zinc-400">Od</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-zinc-600 hover:border-zinc-600 transition"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs text-zinc-400">Do</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-zinc-600 hover:border-zinc-600 transition"
                />
            </div>

            {fromDate && toDate && !isDateRangeValid && (
              <div className="text-xs text-red-400 bg-red-500/10 p-2 rounded border border-red-500/20">
                Data początkowa nie może być po dacie końcowej
              </div>
            )}
          </div>
        )}

        {/* Format Section */}
        <div className="space-y-4 pt-4 border-t border-zinc-700">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Format</h2>
          
          <div className="space-y-2.5">
            {[
              { value: 'txt', label: 'Tekst' },
              { value: 'json', label: 'JSON' }
            ].map(opt => (
              <label key={opt.value} className="flex items-center gap-3 p-4 rounded-lg bg-zinc-800 hover:bg-zinc-750 cursor-pointer transition border border-zinc-700 hover:border-zinc-600"
              >
                <input
                  type="radio"
                  name="format"
                  value={opt.value}
                  checked={format === opt.value}
                  onChange={(e) => setFormat(e.target.value)}
                  className="w-4 h-4 cursor-pointer accent-rose-500"
                />
                <span className="text-sm text-white flex-1">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Export Button */}
        <div className="pt-6 border-t border-zinc-700">
          <button
            onClick={handleExport}
            disabled={!isValid || !isDateRangeValid}
            className={`w-full py-3 rounded-lg font-semibold transition text-white ${
              isValid && isDateRangeValid
                ? 'bg-rose-500 hover:bg-rose-600 ui-press cursor-pointer'
                : 'bg-zinc-700 text-zinc-500 cursor-not-allowed opacity-50'
            }`}
          >
            Eksportuj
          </button>
        </div>

        {/* Info */}
        <div className="text-xs text-zinc-500 text-center pt-4">
          {format && `Format: ${format.toUpperCase()}`}
          {format && fromDate && toDate && ` • Zakres: ${fromDate} do ${toDate}`}
        </div>
      </div>
    </div>
  );
};
