/**
 * Coaching V2 — deterministic prioritizer (the genuinely new system).
 *
 * Jobs: rank candidates, eliminate duplicates, suppress low-confidence
 * noise, prefer higher-value signals, preserve surface context, enforce a
 * hard cap. Pure + stable: same input → same output, every time.
 *
 * Caps: global ≤ 3. Home = 1 primary + ≤2 secondary (same 3, split).
 */

import { INSIGHT_TYPES, INSIGHT_CONFIDENCE, REASON_CODES } from './interpret';

export const GLOBAL_CAP = 3;
export const HOME_PRIMARY_COUNT = 1;
export const HOME_SECONDARY_CAP = 2;

const CONFIDENCE_RANK = { STRONG: 3, NORMAL: 2, LIMITED: 1, NONE: 0 };

const isValidCandidate = (c) => {
  if (!c || typeof c !== 'object') return false;
  if (!INSIGHT_TYPES.includes(c.type)) return false;
  if (typeof c.scope !== 'string' || !c.scope) return false;
  if (typeof c.title !== 'string' || !c.title.trim()) return false;
  if (typeof c.message !== 'string' || !c.message.trim()) return false;
  if (!REASON_CODES.includes(c.reasonCode)) return false;
  if (!c.evidence || typeof c.evidence !== 'object') return false;
  if (!INSIGHT_CONFIDENCE.includes(c.confidence)) return false;
  if (!Number.isInteger(c.priority) || c.priority < 1) return false;
  if (!c.freshness || typeof c.freshness.generatedAt !== 'string') return false;
  return true;
};

/**
 * Merge two candidates describing the same concept (same dedupKey):
 * keep the stronger signal, union sourceFns, keep the better (lower) priority
 * and stronger confidence. Never fabricates numbers — baseline/current come
 * from the winning candidate.
 */
const mergeDuplicates = (winner, loser) => {
  const wConf = CONFIDENCE_RANK[winner.confidence] ?? 0;
  const lConf = CONFIDENCE_RANK[loser.confidence] ?? 0;
  const wSessions = Number(winner.evidence?.sessions) || 0;
  const lSessions = Number(loser.evidence?.sessions) || 0;
  // Winner: lower priority number wins; ties → stronger confidence → more sessions.
  let keep = winner;
  let drop = loser;
  if (loser.priority < winner.priority
    || (loser.priority === winner.priority && (lConf > wConf
      || (lConf === wConf && lSessions > wSessions)))) {
    keep = loser;
    drop = winner;
  }
  const sourceFns = Array.from(new Set([
    ...((keep.evidence?.sourceFns) || []),
    ...((drop.evidence?.sourceFns) || [])
  ]));
  return {
    ...keep,
    evidence: { ...keep.evidence, sourceFns, mergedFrom: ((keep.evidence?.mergedFrom) || 1) + 1 }
  };
};

const dedupKeyOf = (c, index) => {
  if (typeof c.dedupKey === 'string' && c.dedupKey) return c.dedupKey;
  return `${c.type}:${c.scope}:${c.reasonCode}:${index}`;
};

/**
 * Rank + dedupe + cap. Options: { limit = 3, surface = null }.
 * surface filters to candidates listing that surface (home|exercise|session);
 * candidates without a surfaces array are treated as global (kept).
 */
export const prioritizeInsights = (candidates, { limit = GLOBAL_CAP, surface = null } = {}) => {
  const list = Array.isArray(candidates) ? candidates : [];
  const valid = list.filter(isValidCandidate).filter((c) => c.confidence !== 'NONE' && c.priority <= 3);

  const scoped = surface
    ? valid.filter((c) => !Array.isArray(c.surfaces) || c.surfaces.includes(surface))
    : valid;

  // Collapse semantic duplicates (plateau + flat mover → one stagnation).
  const byKey = new Map();
  for (let i = 0; i < scoped.length; i += 1) {
    const c = scoped[i];
    const key = dedupKeyOf(c, i);
    if (!byKey.has(key)) byKey.set(key, c);
    else byKey.set(key, mergeDuplicates(byKey.get(key), c));
  }

  const deduped = [...byKey.values()];
  deduped.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    const ca = CONFIDENCE_RANK[a.confidence] ?? 0;
    const cb = CONFIDENCE_RANK[b.confidence] ?? 0;
    if (cb !== ca) return cb - ca;
    const sa = Number(a.evidence?.sessions) || 0;
    const sb = Number(b.evidence?.sessions) || 0;
    if (sb !== sa) return sb - sa;
    if (a.reasonCode !== b.reasonCode) return a.reasonCode < b.reasonCode ? -1 : 1;
    if (a.scope !== b.scope) return a.scope < b.scope ? -1 : 1;
    return a.title < b.title ? -1 : 1;
  });

  const cap = Number.isInteger(limit) && limit >= 0 ? Math.min(limit, GLOBAL_CAP) : GLOBAL_CAP;
  return deduped.slice(0, cap);
};

/**
 * Home split: 1 primary + ≤2 secondary from the same prioritized list.
 * No separate Home engine — same candidates, same ordering, same cap.
 */
export const splitHomeInsights = (prioritized) => {
  const list = Array.isArray(prioritized) ? prioritized.slice(0, GLOBAL_CAP) : [];
  return {
    primary: list.length > 0 ? list[0] : null,
    secondary: list.slice(HOME_PRIMARY_COUNT, HOME_PRIMARY_COUNT + HOME_SECONDARY_CAP)
  };
};
