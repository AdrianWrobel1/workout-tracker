/**
 * Canonical Exercise → Muscle Attribution model (V2).
 *
 * THE single source of truth for "which muscles does this exercise train".
 * Every consumer — Statistics, Body Map, Finish, Session Detail, Exercise
 * Detail, Balance, Volume Landmarks, radar — resolves through
 * `resolveAttribution` below. No screen-specific interpretation.
 *
 * MODEL
 * -----
 *   primary   — exactly one canonical roll-up axis (or 'Other' = unknown).
 *   secondary — zero or more synergist axes, each credited fractionally.
 *   detail    — optional anatomical refinements; every tag rolls up to
 *               exactly one of the 7 axes (7-axis consumers ignore detail).
 *
 * WEIGHT SEMANTICS (centrally defined, deterministic)
 * ---------------------------------------------------
 *   PRIMARY_WEIGHT   = 1.0  — the main mover gets full credit.
 *   SECONDARY_WEIGHT = 0.5  — a synergist gets half credit.
 *
 * A listed secondary muscle NEVER receives 100% duplicated volume. Raw
 * physical accounting (total sets, total kg volume) is kept SEPARATE from
 * attributed muscle exposure: per-muscle numbers are weighted exposure
 * units, so their sums may legitimately differ from the raw session total.
 * They must never be presented as physical tonnage.
 *
 * FALLBACK PRECEDENCE (deterministic)
 * -----------------------------------
 *   stored V2 shape (`primary`)  >  canonical knowledge base (by name)
 *   > legacy `muscles[]`  >  workout `targetMuscles`  >  category  >  unknown.
 *
 * Rationale: legacy `muscles[]` rows predate review, so a knowledge-base
 * entry for a known exercise wins over them (this is how audited corrections
 * reach stored rows without destructive migration). Rows saved in V2 shape
 * (`primary` present) are post-review user data and always win.
 *
 * UNKNOWN = UNKNOWN: unresolvable input yields primary 'Other' with NO
 * axis weights. Consumers must report it as unknown — never smear it
 * across all seven axes.
 */

export const MUSCLE_AXES = ['Chest', 'Back', 'Legs', 'Shoulders', 'Biceps', 'Triceps', 'Core'];

export const AXIS_SET = new Set(MUSCLE_AXES);

/** Explicit unknown token. Carries no weights — it is a label, not data. */
export const UNKNOWN_MUSCLE = 'Other';

export const PRIMARY_WEIGHT = 1;

export const SECONDARY_WEIGHT = 0.5;

/** Movement-pattern sides derived from axes (balance pairs). Legs/Core belong to neither side. */
export const PUSH_AXES = ['Chest', 'Shoulders', 'Triceps'];
export const PULL_AXES = ['Back', 'Biceps'];

/**
 * Detail tags. Small and useful on purpose: each refines exactly one axis.
 * 7-axis consumers ignore detail; quad/ham balance reads the leg details.
 */
export const DETAIL_TO_AXIS = {
  'Upper Chest': 'Chest',
  Lats: 'Back',
  'Upper Back': 'Back',
  Quads: 'Legs',
  Hamstrings: 'Legs',
  Glutes: 'Legs',
  Calves: 'Legs',
  'Front Delts': 'Shoulders',
  'Side Delts': 'Shoulders',
  'Rear Delts': 'Shoulders',
  Abs: 'Core',
  Obliques: 'Core',
  'Lower Back': 'Core',
};

export const DETAIL_TAGS = Object.keys(DETAIL_TO_AXIS);

// --- text normalization -----------------------------------------------------

const fold = (value) =>
  String(value || '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Canonical lookup key for exercise names: case/diacritic/punctuation-insensitive, parens stripped. */
export const normalizeExerciseKey = (name) =>
  fold(String(name || '').replace(/\(.*?\)/g, ' '));

// --- token aliases ----------------------------------------------------------
// value: [axis, detail|null]. `null` = recognized non-muscle token (movement
// pattern / bucket) — valid input that maps to nothing, never an axis.

const TOKEN_ALIASES = new Map([
  // Chest
  ['chest', ['Chest', null]],
  ['pec', ['Chest', null]],
  ['pecs', ['Chest', null]],
  ['pectoral', ['Chest', null]],
  ['pectorals', ['Chest', null]],
  ['upper chest', ['Chest', 'Upper Chest']],
  ['upper pec', ['Chest', 'Upper Chest']],
  ['upper pecs', ['Chest', 'Upper Chest']],
  // Back
  ['back', ['Back', null]],
  ['lat', ['Back', 'Lats']],
  ['lats', ['Back', 'Lats']],
  ['latissimus', ['Back', 'Lats']],
  ['upper back', ['Back', 'Upper Back']],
  ['traps', ['Back', 'Upper Back']],
  ['trapezius', ['Back', 'Upper Back']],
  ['rhomboid', ['Back', 'Upper Back']],
  ['rhomboids', ['Back', 'Upper Back']],
  ['middle back', ['Back', 'Upper Back']],
  // Legs
  ['legs', ['Legs', null]],
  ['leg', ['Legs', null]],
  ['thigh', ['Legs', null]],
  ['thighs', ['Legs', null]],
  ['quad', ['Legs', 'Quads']],
  ['quads', ['Legs', 'Quads']],
  ['quadricep', ['Legs', 'Quads']],
  ['quadriceps', ['Legs', 'Quads']],
  ['ham', ['Legs', 'Hamstrings']],
  ['hams', ['Legs', 'Hamstrings']],
  ['hamstring', ['Legs', 'Hamstrings']],
  ['hamstrings', ['Legs', 'Hamstrings']],
  ['glute', ['Legs', 'Glutes']],
  ['glutes', ['Legs', 'Glutes']],
  ['gluteal', ['Legs', 'Glutes']],
  ['calf', ['Legs', 'Calves']],
  ['calves', ['Legs', 'Calves']],
  // Shoulders
  ['shoulder', ['Shoulders', null]],
  ['shoulders', ['Shoulders', null]],
  ['delt', ['Shoulders', null]],
  ['delts', ['Shoulders', null]],
  ['deltoid', ['Shoulders', null]],
  ['deltoids', ['Shoulders', null]],
  ['front delt', ['Shoulders', 'Front Delts']],
  ['front delts', ['Shoulders', 'Front Delts']],
  ['anterior delt', ['Shoulders', 'Front Delts']],
  ['front shoulder', ['Shoulders', 'Front Delts']],
  ['side delt', ['Shoulders', 'Side Delts']],
  ['side delts', ['Shoulders', 'Side Delts']],
  ['lateral delt', ['Shoulders', 'Side Delts']],
  ['lateral delts', ['Shoulders', 'Side Delts']],
  ['medial delt', ['Shoulders', 'Side Delts']],
  ['middle delt', ['Shoulders', 'Side Delts']],
  ['rear delt', ['Shoulders', 'Rear Delts']],
  ['rear delts', ['Shoulders', 'Rear Delts']],
  ['posterior delt', ['Shoulders', 'Rear Delts']],
  ['rear shoulder', ['Shoulders', 'Rear Delts']],
  // Arms
  ['bicep', ['Biceps', null]],
  ['biceps', ['Biceps', null]],
  ['tricep', ['Triceps', null]],
  ['triceps', ['Triceps', null]],
  // Core (exact tokens — never substring matching, so 'cable' can never hit 'ab')
  ['core', ['Core', null]],
  ['cores', ['Core', null]],
  ['ab', ['Core', 'Abs']],
  ['abs', ['Core', 'Abs']],
  ['abdominal', ['Core', 'Abs']],
  ['abdominals', ['Core', 'Abs']],
  ['stomach', ['Core', 'Abs']],
  ['oblique', ['Core', 'Obliques']],
  ['obliques', ['Core', 'Obliques']],
  ['lower back', ['Core', 'Lower Back']],
  ['erector', ['Core', 'Lower Back']],
  ['erectors', ['Core', 'Lower Back']],
  ['lumbar', ['Core', 'Lower Back']],
  // Recognized non-muscles: valid buckets/patterns that attribute to nothing.
  ['push', null],
  ['pull', null],
  ['full body', null],
  ['fullbody', null],
  ['cardio', null],
  ['conditioning', null],
  ['general', null],
  ['other', null],
  ['unknown', null],
  ['upper body', null],
  ['lower body', null],
  ['arms', null],
  ['arm', null],
]);

/**
 * Normalize one free-text muscle token.
 * Returns { axis, detail } | { axis, detail: null } | null (unmapped/bucket).
 */
export function normalizeMuscleToken(token) {
  if (typeof token !== 'string') return null;
  const key = fold(token);
  if (!key) return null;
  if (!TOKEN_ALIASES.has(key)) return null;
  const hit = TOKEN_ALIASES.get(key);
  if (hit === null) return null;
  return { axis: hit[0], detail: hit[1] };
}

// --- category fallback ------------------------------------------------------

/**
 * Category → axes. Preserves the legacy mapping contract, with the Core
 * fix: 'core' (not only 'cores') resolves to Core instead of Other.
 * Returns axes (possibly ['Other'] = unknown).
 */
export function categoryToAxes(category) {
  if (category === null || category === undefined) return [UNKNOWN_MUSCLE];
  const cat = fold(category);
  if (!cat) return [UNKNOWN_MUSCLE];
  if (cat.includes('push')) return ['Chest', 'Shoulders', 'Triceps'];
  if (cat.includes('pull')) return ['Back', 'Biceps'];
  if (cat.includes('legs') || cat.includes('leg')) return ['Legs'];
  if (cat.includes('chest') || cat.includes('pec')) return ['Chest'];
  if (cat.includes('back') || cat.includes('lat')) return ['Back'];
  if (cat.includes('shoulder') || cat.includes('delt')) return ['Shoulders'];
  if (cat.includes('bicep')) return ['Biceps'];
  if (cat.includes('tricep') || cat.includes('trice')) return ['Triceps'];
  if (
    cat.includes('core') ||
    cat.includes('abs') ||
    cat.includes('obliq') ||
    cat.includes('abdominal') ||
    cat === 'ab'
  ) {
    return ['Core'];
  }
  return [UNKNOWN_MUSCLE];
}

/** Legacy alias kept for import compatibility (single taxonomy now). */
export function mapCategoryToMuscles(category) {
  return categoryToAxes(category);
}

// --- knowledge base ---------------------------------------------------------
// Canonical attribution for known exercises, keyed by normalized name.
// p = primary axis, s = secondary axes, d = detail tags, c = category
// override (only where stored categories are provably wrong).
// Deliberately absent: ambiguous customs (Narciarz, Nogi tył, Maszyna na
// plecy) — unknown is preserved, never invented.

const KB = new Map([
  // Presses
  ['bench press', { p: 'Chest', s: ['Triceps', 'Shoulders'], d: [], c: null }],
  ['barbell bench press', { p: 'Chest', s: ['Triceps', 'Shoulders'], d: [], c: null }],
  ['dumbbell bench press', { p: 'Chest', s: ['Triceps', 'Shoulders'], d: [], c: null }],
  ['incline bench press', { p: 'Chest', s: ['Triceps', 'Shoulders'], d: ['Upper Chest'], c: null }],
  ['incline barbell press', { p: 'Chest', s: ['Triceps', 'Shoulders'], d: ['Upper Chest'], c: null }],
  ['incline dumbbell press', { p: 'Chest', s: ['Triceps', 'Shoulders'], d: ['Upper Chest'], c: null }],
  ['incline press', { p: 'Chest', s: ['Triceps', 'Shoulders'], d: ['Upper Chest'], c: null }],
  ['decline bench press', { p: 'Chest', s: ['Triceps', 'Shoulders'], d: [], c: null }],
  ['overhead press', { p: 'Shoulders', s: ['Triceps'], d: ['Front Delts'], c: null }],
  ['overhead press smith machine', { p: 'Shoulders', s: ['Triceps'], d: ['Front Delts'], c: null }],
  ['dumbbell shoulder press', { p: 'Shoulders', s: ['Triceps'], d: ['Front Delts'], c: null }],
  ['barbell shoulder press', { p: 'Shoulders', s: ['Triceps'], d: ['Front Delts'], c: null }],
  ['shoulder press', { p: 'Shoulders', s: ['Triceps'], d: ['Front Delts'], c: null }],
  ['arnold press', { p: 'Shoulders', s: ['Triceps'], d: ['Front Delts'], c: null }],
  ['lateral raises', { p: 'Shoulders', s: [], d: ['Side Delts'], c: null }],
  ['lateral raise', { p: 'Shoulders', s: [], d: ['Side Delts'], c: null }],
  ['cable lateral raises', { p: 'Shoulders', s: [], d: ['Side Delts'], c: null }],
  ['front raise', { p: 'Shoulders', s: [], d: ['Front Delts'], c: null }],
  // Chest isolation / dips
  ['dips', { p: 'Chest', s: ['Triceps', 'Shoulders'], d: [], c: null }],
  ['dipy', { p: 'Chest', s: ['Triceps', 'Shoulders'], d: [], c: null }],
  ['chest dips', { p: 'Chest', s: ['Triceps', 'Shoulders'], d: [], c: null }],
  ['rozpietki', { p: 'Chest', s: ['Shoulders'], d: [], c: null }],
  ['fly', { p: 'Chest', s: ['Shoulders'], d: [], c: null }],
  ['flyes', { p: 'Chest', s: ['Shoulders'], d: [], c: null }],
  ['chest fly', { p: 'Chest', s: ['Shoulders'], d: [], c: null }],
  ['dumbbell flyes', { p: 'Chest', s: ['Shoulders'], d: [], c: null }],
  ['cable flyes', { p: 'Chest', s: ['Shoulders'], d: [], c: null }],
  ['pec deck', { p: 'Chest', s: ['Shoulders'], d: [], c: null }],
  // Triceps isolation
  ['cable triceps pushdown', { p: 'Triceps', s: [], d: [], c: null }],
  ['triceps pushdown', { p: 'Triceps', s: [], d: [], c: null }],
  ['pushdown', { p: 'Triceps', s: [], d: [], c: null }],
  ['overhead triceps extension', { p: 'Triceps', s: [], d: [], c: null }],
  ['french press', { p: 'Triceps', s: [], d: [], c: null }],
  ['bench triceps extension', { p: 'Triceps', s: [], d: [], c: null }],
  ['skullcrusher', { p: 'Triceps', s: [], d: [], c: null }],
  ['skullcrushers', { p: 'Triceps', s: [], d: [], c: null }],
  ['triceps siedzac na lawce odwrocony do wyciagu', { p: 'Triceps', s: [], d: [], c: null }],
  ['rope pushdown', { p: 'Triceps', s: [], d: [], c: null }],
  ['triceps kickback', { p: 'Triceps', s: [], d: [], c: null }],
  // Pull: vertical
  ['weighted pull ups', { p: 'Back', s: ['Biceps'], d: ['Lats'], c: null }],
  ['pull ups', { p: 'Back', s: ['Biceps'], d: ['Lats'], c: null }],
  ['pull up', { p: 'Back', s: ['Biceps'], d: ['Lats'], c: null }],
  ['pullups', { p: 'Back', s: ['Biceps'], d: ['Lats'], c: null }],
  ['chin up', { p: 'Back', s: ['Biceps'], d: ['Lats'], c: 'Pull' }],
  ['chin ups', { p: 'Back', s: ['Biceps'], d: ['Lats'], c: 'Pull' }],
  ['chinup', { p: 'Back', s: ['Biceps'], d: ['Lats'], c: 'Pull' }],
  ['lat pulldown', { p: 'Back', s: ['Biceps'], d: ['Lats'], c: null }],
  ['lat pulldowns', { p: 'Back', s: ['Biceps'], d: ['Lats'], c: null }],
  // Pull: horizontal / rear delts
  ['barbell row', { p: 'Back', s: ['Biceps'], d: ['Lats', 'Upper Back'], c: null }],
  ['dumbbell row', { p: 'Back', s: ['Biceps'], d: ['Lats', 'Upper Back'], c: null }],
  ['dumbbell rows', { p: 'Back', s: ['Biceps'], d: ['Lats', 'Upper Back'], c: null }],
  ['cable row', { p: 'Back', s: ['Biceps'], d: ['Lats', 'Upper Back'], c: null }],
  ['seated row', { p: 'Back', s: ['Biceps'], d: ['Lats', 'Upper Back'], c: null }],
  ['t bar row', { p: 'Back', s: ['Biceps'], d: ['Lats', 'Upper Back'], c: null }],
  ['pendlay row', { p: 'Back', s: ['Biceps'], d: ['Lats', 'Upper Back'], c: null }],
  ['face pull', { p: 'Shoulders', s: ['Back'], d: ['Rear Delts'], c: null }],
  ['tyl barku hantle na lawce', { p: 'Shoulders', s: [], d: ['Rear Delts'], c: 'Pull' }],
  ['rear delt fly', { p: 'Shoulders', s: [], d: ['Rear Delts'], c: 'Pull' }],
  ['rear delt raise', { p: 'Shoulders', s: [], d: ['Rear Delts'], c: 'Pull' }],
  ['reverse fly', { p: 'Shoulders', s: [], d: ['Rear Delts'], c: 'Pull' }],
  // Pull: curls
  ['barbell curl', { p: 'Biceps', s: [], d: [], c: null }],
  ['dumbbell curl', { p: 'Biceps', s: [], d: [], c: null }],
  ['hammer curl', { p: 'Biceps', s: [], d: [], c: null }],
  ['curl', { p: 'Biceps', s: [], d: [], c: null }],
  ['biceps na lince', { p: 'Biceps', s: [], d: [], c: null }],
  ['cable curl', { p: 'Biceps', s: [], d: [], c: null }],
  ['preacher curl', { p: 'Biceps', s: [], d: [], c: null }],
  ['concentration curl', { p: 'Biceps', s: [], d: [], c: null }],
  // Core
  ['ab wheel rollout', { p: 'Core', s: [], d: ['Abs'], c: 'Core' }],
  ['ab wheel', { p: 'Core', s: [], d: ['Abs'], c: 'Core' }],
  ['plank', { p: 'Core', s: [], d: ['Abs'], c: 'Core' }],
  ['crunch', { p: 'Core', s: [], d: ['Abs'], c: 'Core' }],
  ['cable crunch', { p: 'Core', s: [], d: ['Abs'], c: 'Core' }],
  ['hanging leg raise', { p: 'Core', s: [], d: ['Abs'], c: 'Core' }],
  ['russian twist', { p: 'Core', s: [], d: ['Obliques'], c: 'Core' }],
  ['back extension', { p: 'Core', s: [], d: ['Lower Back'], c: 'Core' }],
  ['hyperextension', { p: 'Core', s: [], d: ['Lower Back'], c: 'Core' }],
  // Legs
  ['back squat', { p: 'Legs', s: [], d: ['Quads', 'Glutes'], c: null }],
  ['squat', { p: 'Legs', s: [], d: ['Quads', 'Glutes'], c: null }],
  ['front squat', { p: 'Legs', s: [], d: ['Quads', 'Glutes'], c: null }],
  ['goblet squat', { p: 'Legs', s: [], d: ['Quads', 'Glutes'], c: null }],
  ['split squat', { p: 'Legs', s: [], d: ['Quads', 'Glutes'], c: null }],
  ['bulgarian split squat', { p: 'Legs', s: [], d: ['Quads', 'Glutes'], c: null }],
  ['hack squat', { p: 'Legs', s: [], d: ['Quads', 'Glutes'], c: null }],
  ['leg press', { p: 'Legs', s: [], d: ['Quads', 'Glutes'], c: null }],
  ['lunge', { p: 'Legs', s: [], d: ['Quads', 'Glutes'], c: null }],
  ['lunges', { p: 'Legs', s: [], d: ['Quads', 'Glutes'], c: null }],
  ['leg extension', { p: 'Legs', s: [], d: ['Quads'], c: null }],
  ['leg curl', { p: 'Legs', s: [], d: ['Hamstrings'], c: null }],
  ['lying leg curl', { p: 'Legs', s: [], d: ['Hamstrings'], c: null }],
  ['seated leg curl', { p: 'Legs', s: [], d: ['Hamstrings'], c: null }],
  ['hamstring curl', { p: 'Legs', s: [], d: ['Hamstrings'], c: null }],
  ['hip thrust', { p: 'Legs', s: [], d: ['Glutes'], c: null }],
  ['glute bridge', { p: 'Legs', s: [], d: ['Glutes'], c: null }],
  ['calf raise', { p: 'Legs', s: [], d: ['Calves'], c: null }],
  ['standing calf raise', { p: 'Legs', s: [], d: ['Calves'], c: null }],
  ['romanian deadlift', { p: 'Legs', s: ['Back'], d: ['Hamstrings', 'Glutes'], c: null }],
  ['rdl', { p: 'Legs', s: ['Back'], d: ['Hamstrings', 'Glutes'], c: null }],
  ['stiff leg deadlift', { p: 'Legs', s: ['Back'], d: ['Hamstrings', 'Glutes'], c: null }],
  ['good morning', { p: 'Legs', s: ['Back'], d: ['Hamstrings'], c: null }],
  ['deadlift', { p: 'Back', s: ['Legs'], d: ['Lats', 'Upper Back'], c: 'Pull' }],
]);

export function lookupKnownExercise(name) {
  const key = normalizeExerciseKey(name);
  if (!key) return null;
  return KB.get(key) || null;
}

// --- list normalization -----------------------------------------------------

function collectTokens(list) {
  const axes = [];
  const details = [];
  for (const token of Array.isArray(list) ? list : []) {
    const hit = normalizeMuscleToken(token);
    if (!hit) continue;
    if (!axes.includes(hit.axis)) axes.push(hit.axis);
    if (hit.detail && !details.includes(hit.detail)) details.push(hit.detail);
  }
  return { axes, details };
}

function toWeights(primary, secondary) {
  const weights = {};
  if (primary && primary !== UNKNOWN_MUSCLE) weights[primary] = PRIMARY_WEIGHT;
  for (const axis of secondary) {
    if (axis === primary || axis === UNKNOWN_MUSCLE || weights[axis] !== undefined) continue;
    weights[axis] = SECONDARY_WEIGHT;
  }
  return weights;
}

const unknownResolution = (category) => ({
  primary: UNKNOWN_MUSCLE,
  secondary: [],
  detail: [],
  weights: {},
  axes: [],
  tokens: [UNKNOWN_MUSCLE],
  source: 'unknown',
  category: typeof category === 'string' ? category : null,
});

// --- THE single resolver ----------------------------------------------------

/**
 * Canonical attribution for one workout exercise.
 *
 * @param {object} exercise — workout entry { exerciseId, name, category, targetMuscles }
 * @param {Map} exerciseMap — id → DB row (V2 `primary` shape or legacy `muscles[]`)
 * @returns {primary, secondary, detail, weights, axes, tokens, source, category}
 *   `weights` maps each attributed axis to 1.0 (primary) or 0.5 (secondary).
 *   `axes` is the inclusion list (primary + secondary). Unknown exercises
 *   yield empty weights/axes with primary 'Other' — never fabricated axes.
 */
export function resolveAttribution(exercise, exerciseMap) {
  const dbRow =
    exercise?.exerciseId !== null &&
    exercise?.exerciseId !== undefined &&
    exerciseMap
      ? exerciseMap.get(exercise.exerciseId) || null
      : null;
  const storedCategory =
    (typeof dbRow?.category === 'string' && dbRow.category) ||
    (typeof exercise?.category === 'string' && exercise.category) ||
    null;

  // 1. Stored V2 shape (post-review user data) always wins.
  if (dbRow && typeof dbRow.primary === 'string') {
    const primaryHit = normalizeMuscleToken(dbRow.primary);
    const primary = primaryHit && !primaryHit.detail ? primaryHit.axis : primaryHit?.axis || null;
    if (primary && AXIS_SET.has(primary)) {
      const secondary = [];
      for (const token of Array.isArray(dbRow.secondary) ? dbRow.secondary : []) {
        const hit = normalizeMuscleToken(token);
        if (hit && AXIS_SET.has(hit.axis) && hit.axis !== primary && !secondary.includes(hit.axis)) {
          secondary.push(hit.axis);
        }
      }
      const detail = [];
      for (const tag of Array.isArray(dbRow.detail) ? dbRow.detail : []) {
        if (
          typeof tag === 'string' &&
          DETAIL_TO_AXIS[tag] &&
          !detail.includes(tag) &&
          (DETAIL_TO_AXIS[tag] === primary || secondary.includes(DETAIL_TO_AXIS[tag]))
        ) {
          detail.push(tag);
        }
      }
      const weights = toWeights(primary, secondary);
      return {
        primary,
        secondary,
        detail,
        weights,
        axes: Object.keys(weights),
        tokens: Object.keys(weights),
        source: 'v2',
        category: storedCategory,
      };
    }
    // Corrupt V2 shape: fall through to the lower precedences.
  }

  // 2. Canonical knowledge base (audited corrections for known exercises).
  const known = lookupKnownExercise(dbRow?.name || exercise?.name);
  if (known) {
    const weights = toWeights(known.p, known.s);
    return {
      primary: known.p,
      secondary: [...known.s],
      detail: [...known.d],
      weights,
      axes: Object.keys(weights),
      tokens: Object.keys(weights),
      source: 'known',
      category: known.c || storedCategory,
    };
  }

  // 3. Legacy explicit muscles[] on the DB row.
  if (dbRow && Array.isArray(dbRow.muscles)) {
    const { axes, details } = collectTokens(dbRow.muscles);
    if (axes.length > 0) {
      const weights = toWeights(axes[0], axes.slice(1));
      return {
        primary: axes[0],
        secondary: axes.slice(1),
        detail: details.filter((tag) => weights[DETAIL_TO_AXIS[tag]] !== undefined),
        weights,
        axes: Object.keys(weights),
        tokens: Object.keys(weights),
        source: 'legacy',
        category: storedCategory,
      };
    }
  }

  // 4. Workout-specific targets (dormant in production data, honored if valid).
  if (Array.isArray(exercise?.targetMuscles)) {
    const { axes, details } = collectTokens(exercise.targetMuscles);
    if (axes.length > 0) {
      const weights = toWeights(axes[0], axes.slice(1));
      return {
        primary: axes[0],
        secondary: axes.slice(1),
        detail: details.filter((tag) => weights[DETAIL_TO_AXIS[tag]] !== undefined),
        weights,
        axes: Object.keys(weights),
        tokens: Object.keys(weights),
        source: 'workout',
        category: storedCategory,
      };
    }
  }

  // 5. Category fallback.
  const fallback = categoryToAxes(storedCategory);
  if (fallback.length > 0 && fallback[0] !== UNKNOWN_MUSCLE) {
    const weights = toWeights(fallback[0], fallback.slice(1));
    return {
      primary: fallback[0],
      secondary: fallback.slice(1),
      detail: [],
      weights,
      axes: Object.keys(weights),
      tokens: Object.keys(weights),
      source: 'category',
      category: storedCategory,
    };
  }

  // 6. Unknown stays unknown.
  return unknownResolution(storedCategory);
}

/** Compat inclusion list: attributed axes, or ['Other'] when unknown. */
export function resolveAxes(exercise, exerciseMap) {
  const res = resolveAttribution(exercise, exerciseMap);
  return res.axes.length > 0 ? res.axes : [UNKNOWN_MUSCLE];
}

/** Multiply an amount (sets, volume) across the resolution weights. */
export function attributeAmount(resolution, amount) {
  const out = {};
  const value = Number(amount) || 0;
  if (!(value > 0)) return out;
  for (const [axis, weight] of Object.entries(resolution?.weights || {})) {
    out[axis] = (out[axis] || 0) + value * weight;
  }
  return out;
}

/**
 * Detail exposure for balance pairs (quads/hamstrings): each detail tag
 * inherits the weight of its roll-up axis within this resolution.
 */
export function detailWeights(resolution) {
  const out = {};
  if (!resolution) return out;
  for (const tag of resolution.detail || []) {
    const axis = DETAIL_TO_AXIS[tag];
    const weight = resolution.weights?.[axis];
    if (axis && weight > 0) out[tag] = (out[tag] || 0) + weight;
  }
  return out;
}

/** Attribution for a stored DB row without a workout entry (selector, detail). */
export function resolveStoredAttribution(storedRow) {
  if (!storedRow || typeof storedRow !== 'object') return unknownResolution(null);
  return resolveAttribution(
    {
      exerciseId: storedRow.id ?? null,
      name: storedRow.name,
      category: storedRow.category,
      targetMuscles: storedRow.targetMuscles,
    },
    new Map(storedRow.id !== undefined && storedRow.id !== null ? [[storedRow.id, storedRow]] : [])
  );
}

/** Primary axis for grouping/display; 'Other' when unknown. */
export function primaryOf(storedRow) {
  return resolveStoredAttribution(storedRow).primary;
}

// --- storage sanitization ---------------------------------------------------

/**
 * Normalize one exercise record for storage (create/edit/import).
 * Pure additive sanitizer in the restSec/progression family: never throws,
 * never rejects the record, never touches category on V2-shape rows.
 * - V2 shape → validated in place, `muscles` synced as [primary, ...secondary].
 * - known legacy name → canonical V2 shape (+KB category fix for legacy rows).
 * - legacy `muscles[]` → derived V2 shape via alias normalization.
 * - nothing valid → `muscles` dropped so read-time category fallback applies.
 */
export function sanitizeMusclesForStorage(exercise) {
  if (!exercise || typeof exercise !== 'object') return exercise;
  const next = { ...exercise };

  const validAxis = (token) => {
    const hit = normalizeMuscleToken(token);
    return hit && AXIS_SET.has(hit.axis) ? hit.axis : null;
  };

  if (typeof next.primary === 'string') {
    const primary = validAxis(next.primary);
    if (primary) {
      const secondary = [];
      for (const token of Array.isArray(next.secondary) ? next.secondary : []) {
        const axis = validAxis(token);
        if (axis && axis !== primary && !secondary.includes(axis)) secondary.push(axis);
      }
      const detail = [];
      for (const tag of Array.isArray(next.detail) ? next.detail : []) {
        if (
          typeof tag === 'string' &&
          DETAIL_TO_AXIS[tag] &&
          !detail.includes(tag) &&
          (DETAIL_TO_AXIS[tag] === primary || secondary.includes(DETAIL_TO_AXIS[tag]))
        ) {
          detail.push(tag);
        }
      }
      next.primary = primary;
      next.secondary = secondary;
      next.detail = detail;
      next.muscles = [primary, ...secondary];
      return next;
    }
    delete next.primary;
  }

  const known = lookupKnownExercise(next.name);
  if (known) {
    next.primary = known.p;
    next.secondary = [...known.s];
    next.detail = [...known.d];
    next.muscles = [known.p, ...known.s];
    if (known.c && (typeof next.category !== 'string' || fold(next.category) !== fold(known.c))) {
      next.category = known.c;
    }
    return next;
  }

  if (Array.isArray(next.muscles)) {
    const { axes, details } = collectTokens(next.muscles);
    if (axes.length > 0) {
      next.primary = axes[0];
      next.secondary = axes.slice(1);
      next.detail = details.filter(
        (tag) => tag && (DETAIL_TO_AXIS[tag] === axes[0] || axes.slice(1).includes(DETAIL_TO_AXIS[tag]))
      );
      next.muscles = [...axes];
      return next;
    }
    delete next.muscles;
  }
  if ('muscles' in next && !Array.isArray(next.muscles)) delete next.muscles;
  if (!Array.isArray(next.secondary)) delete next.secondary;
  if (!Array.isArray(next.detail)) delete next.detail;
  return next;
}
