import React from 'react';
import { ChevronLeft, Medal } from 'lucide-react';

/**
 * Shared analytics visual language — Analytics 3.0.
 *
 * PRESENTATION ONLY. No domain logic, no calculations, no data fetching.
 * Every export is a thin Tailwind wrapper so Statistics, History, Session
 * Detail and Exercise Detail read as one product.
 *
 * Conventions locked here:
 * - Page headers: sticky, 4xl black title + eyebrow (matches Exercises).
 * - Section cards: one gradient surface, p-4/p-5, h2 SectionTitle + hint.
 * - PR: ALWAYS amber (bg-amber-500/15, text-amber-300, border-amber-500/30)
 *   with a Medal icon. Never yellow-500, never emoji.
 * - Actual (logged) = blue family. Recommended (prescribed) = emerald family.
 * - Interactive targets: min 44px height (Apple HIG).
 */

export const SURFACE_CARD =
  'bg-slate-800/40 border border-slate-700/50 rounded-xl';

export const ROW_CARD =
  'bg-slate-800/40 border border-slate-700/50 rounded-lg';

export const PR_BADGE =
  'bg-amber-500/15 text-amber-300 border-amber-500/30';

export const ACTUAL_PILL =
  'bg-blue-500/15 text-blue-300 border-blue-500/30';

export const RECOMMENDED_PILL =
  'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';

/** Sticky top-level page header (Statistics, History — matches Exercises). */
export const AnalyticsHeader = ({ eyebrow, title, sub, actions }) => (
  <div className="bg-black/95 backdrop-blur border-b border-white/10 p-4 sticky top-0 z-20 shadow-2xl">
    <div className="flex items-center justify-between gap-3">
      <h1 className="text-4xl font-black truncate">{title}</h1>
      {actions && <div className="flex gap-1 shrink-0">{actions}</div>}
    </div>
    {(eyebrow || sub) && (
      <p className="text-xs text-slate-400 mt-2 font-semibold tracking-widest">
        {eyebrow || sub}
      </p>
    )}
  </div>
);

/** Detail header with back navigation (Session Detail, Exercise Detail). */
export const AnalyticsDetailHeader = ({ eyebrow, title, sub, onBack, actions, titleSuffix }) => (
  <div className="bg-black/95 backdrop-blur border-b border-white/10 p-4 flex items-center justify-between gap-4 sticky top-0 z-20 shadow-2xl">
    <div className="flex items-center gap-3 min-w-0">
      <button
        onClick={onBack}
        aria-label="Back"
        className="p-2 hover:bg-white/10 rounded-lg transition shrink-0 min-w-[44px] min-h-[44px] inline-flex items-center justify-center"
      >
        <ChevronLeft size={24} />
      </button>
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-xs text-slate-400 font-semibold tracking-widest">{eyebrow}</p>
        )}
        <h1 className="text-2xl font-black truncate leading-tight">
          {title}
          {titleSuffix}
        </h1>
        {sub && (
          <p className="text-xs text-slate-500 font-semibold mt-0.5 truncate">{sub}</p>
        )}
      </div>
    </div>
    {actions}
  </div>
);

/** One analytics section: card surface + h2 title + optional hint. */
export const AnalyticsSection = ({ title, hint, action, children, tight }) => (
  <section className={`${SURFACE_CARD} ${tight ? 'p-4' : 'p-4 sm:p-5'}`}>
    <div className="flex items-start justify-between gap-3 mb-4">
      <h2 className="text-sm font-black text-slate-300 uppercase tracking-widest">
        {title}
        {hint && (
          <span className="block text-[11px] font-semibold text-slate-500 normal-case tracking-normal mt-1">
            {hint}
          </span>
        )}
      </h2>
      {action}
    </div>
    {children}
  </section>
);

/** Sub-heading inside a section (h3 — never a styled <p>). */
export const AnalyticsSubTitle = ({ children }) => (
  <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest">{children}</h3>
);

/** Flat-section title (h2 + hint) for views that don't use cards. */
export const AnalyticsTitle = ({ id, children, hint }) => (
  <h2 id={id} className="text-sm font-black text-slate-300 uppercase tracking-widest">
    {children}
    {hint && (
      <span className="block text-[11px] font-semibold text-slate-500 normal-case tracking-normal mt-1">
        {hint}
      </span>
    )}
  </h2>
);

/** Segmented range selector. Options: [{ value, label }]. */
export const RangeSelector = ({ options, value, onChange, label = 'Range' }) => (
  <div className="flex gap-2" role="group" aria-label={label}>
    {options.map((opt) => (
      <button
        key={opt.value}
        onClick={() => onChange(opt.value)}
        aria-pressed={value === opt.value}
        className={`flex-1 min-h-[44px] px-2 rounded-lg font-bold text-xs uppercase transition-all ${
          value === opt.value
            ? 'accent-bg text-white shadow-lg accent-shadow'
            : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'
        }`}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

/** The single PR signal used on every analytics surface. */
export const PRBadge = ({ count, className = '' }) => (
  <span
    className={`shrink-0 inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-bold border ${PR_BADGE} ${className}`}
  >
    <Medal size={12} aria-hidden="true" />
    {count} PR{count === 1 ? '' : 's'}
  </span>
);

/** Actual (logged) vs Recommended (prescribed) semantic pills. */
export const ActualPill = () => (
  <span className={`ml-auto text-[11px] font-black uppercase tracking-widest px-2 py-1 rounded-full border shrink-0 ${ACTUAL_PILL}`}>
    Actual
  </span>
);

export const RecommendedPill = () => (
  <span className={`ml-auto text-[11px] font-black uppercase tracking-widest px-2 py-1 rounded-full border shrink-0 ${RECOMMENDED_PILL}`}>
    Recommended
  </span>
);

/** Labeled horizontal bar (top muscles, workload splits). */
export const BarRow = ({ label, display, pct, barClass = 'bg-blue-500' }) => (
  <div className="flex items-center gap-3">
    <span className="text-sm font-bold text-white w-24 shrink-0 truncate">{label}</span>
    <div className="flex-1 h-2 bg-slate-800/50 rounded-full overflow-hidden border border-slate-700/50">
      <div
        className={`h-full rounded-full transition-all duration-500 ${barClass}`}
        style={{ width: `${Math.max(0, Math.min(100, Math.round(pct)))}%` }}
      />
    </div>
    <span className="text-xs font-semibold text-slate-400 w-14 text-right shrink-0 tabular-nums">{display}</span>
  </div>
);

/** Intentional empty state — never a giant blank box. */
export const AnalyticsEmpty = ({ title, hint }) => (
  <div className="text-center py-8" role="status">
    <p className="text-slate-300 text-sm font-bold">{title}</p>
    {hint && <p className="text-slate-500 text-xs mt-2 font-semibold">{hint}</p>}
  </div>
);

/** Small metric cell for secondary numbers (label over value). */
export const StatCell = ({ label, value, accent }) => (
  <div className={`${ROW_CARD} p-3 text-center min-w-0`}>
    <p className={`text-lg font-black truncate tabular-nums ${accent || 'text-white'}`}>{value}</p>
    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">{label}</p>
  </div>
);
