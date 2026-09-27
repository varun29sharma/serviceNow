/**
 * triageRequest — the Assignment Rule.
 *
 * Pure rules module (no Mongo, no Express): maps an incoming request to an
 * assignmentGroup and an urgency, using a swappable config. The config shape
 * is what the backtest harness (backtest/backtest.js) searches over; the
 * winning config from the backtest is pasted in as DEFAULT_CONFIG below, so
 * the API runs on backtested values — never hand-tuned ones.
 *
 * Exported for the app, the seed script and the backtest harness alike:
 *   triageRequest(request, config) -> { assignmentGroup, urgency, matchedKeywords, score }
 *   DEFAULT_CONFIG                 -> the production config
 */

// ---------------------------------------------------------------------------
// Assignment Rule: category -> assignmentGroup lookup.
// This mapping is fixed business vocabulary, not something the backtest tunes.
// ---------------------------------------------------------------------------
export const ASSIGNMENT_RULE = {
  'Mental Health': 'Counseling',
  Academic: 'Academic Advising',
  Financial: 'Financial Aid',
  Housing: 'Peer Support',
  Other: 'Peer Support', // catch-all routes to the generalist group
};

/**
 * DEFAULT_CONFIG — production triage config.
 *
 * These are the WINNING values from `npm run backtest` (36 labeled Cases ×
 * 105 candidate configs): 30/36 exact, 100% High recall, 87% High precision,
 * 36/36 within one urgency level. The grid chose all-Low category bases with
 * keyword weights carrying the urgency — i.e. urgency comes from what the
 * student wrote, not which box they ticked. Re-run the harness after editing
 * testCases.json; don't hand-tune past it. Structure:
 *   categoryBaseUrgency : starting urgency per category
 *   keywords            : { [keyword]: weight } — matched against the
 *                         apostrophe-stripped, lowercased description
 *   thresholds          : score >= high -> High, >= medium -> Medium, else Low
 */
export const DEFAULT_CONFIG = {
  categoryBaseUrgency: {
    'Mental Health': 'Low',
    Academic: 'Low',
    Financial: 'Low',
    Housing: 'Low',
    Other: 'Low',
  },
  keywords: {
    // weight 3 — crisis language, jump straight toward High
    'suicide': 3,
    'kill myself': 3,
    'self harm': 3,
    'hurt myself': 3,
    'cant go on': 3,
    // weight 2 — acute need
    'evicted': 2,
    'homeless': 2,
    'no place to sleep': 2,
    'cant eat': 2,
    'hungry': 2,
    'out of food': 2,
    'panic attack': 2,
    'hurting': 2,
    'final notice': 2,
    'shut off': 2,
    // weight 1 — pressure signals
    'failing': 1,
    'overdue': 1,
    'dropping out': 1,
    'drop out': 1,
    'eviction': 1,
    'past due': 1,
    'bills': 1,
    'counseling': 1,
    'anxious': 1,
    'depressed': 1,
    'behind': 1,
    'unprepared': 1,
    'probation': 1,
    'urgent': 1,
    'ignoring': 1,
  },
  thresholds: { high: 2, medium: 1 },
};

const URGENCY_ORDER = { Low: 0, Medium: 1, High: 2 };
const URGENCY_BY_LEVEL = ['Low', 'Medium', 'High'];

/**
 * Score a description against the config keywords.
 * Returns { score, matchedKeywords } where matchedKeywords preserves order
 * of appearance so the UI can explain the decision.
 */
export function scoreDescription(description, config) {
  // Normalize before matching: lowercase and strip apostrophes so students
  // writing "can't eat" still hit the "cant eat" keyword. (Found by the
  // backtest — free-text apostrophes were silently killing acute matches.)
  const text = String(description || '').toLowerCase().replace(/['’]/g, '');
  const score = { total: 0, matchedKeywords: [] };

  for (const [keyword, weight] of Object.entries(config.keywords)) {
    // A zero weight means "keep this keyword visible in the Rules Console but
    // do not score it" — so it must not appear in matchedKeywords either, or
    // the UI would explain a decision with a trigger that contributed nothing.
    if (!weight) continue;
    // Word-boundary match so "ill" doesn't hit inside "brilliant". An optional
    // plural suffix catches word families ("panic attacks" as well as "panic
    // attack") — plurals were silently missing before this was added.
    const pattern = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:s|es)?\\b`, 'i');
    if (pattern.test(text)) {
      score.total += weight;
      score.matchedKeywords.push(keyword);
    }
  }
  return score;
}

/**
 * triageRequest(request, config) — the Assignment Rule entry point.
 *
 * @param {{ category: string, description: string }} request  incoming request fields
 * @param {object} [config]  triage config; defaults to DEFAULT_CONFIG
 * @returns {{ assignmentGroup: string, urgency: string, matchedKeywords: string[], score: number }}
 *
 * The config may also carry an `assignmentRule` map (the Rules Console edits
 * it). That makes the category -> assignmentGroup mapping configurable, which
 * is the whole point of an Assignment Rule — but the *vocabulary* is fixed:
 * an unknown category still falls back to the catch-all group.
 */
export function triageRequest(request, config = DEFAULT_CONFIG) {
  const category = request && request.category;
  const description = request && request.description;

  const rule = (config && config.assignmentRule) || ASSIGNMENT_RULE;
  const assignmentGroup = rule[category] || rule.Other || ASSIGNMENT_RULE.Other;

  const { total, matchedKeywords } = scoreDescription(description, config);
  const base = config.categoryBaseUrgency[category] || 'Low';
  const baseLevel = URGENCY_ORDER[base] ?? 0;

  // Urgency = max(category base level, level reached via keyword score).
  // Keywords can pull a case UP toward High; the score thresholds govern
  // exactly where the lines sit — that's what the backtest tunes.
  const scoreLevel =
    total >= config.thresholds.high ? 2 : total >= config.thresholds.medium ? 1 : 0;
  const level = Math.max(baseLevel, scoreLevel);

  return {
    assignmentGroup,
    urgency: URGENCY_BY_LEVEL[level],
    matchedKeywords,
    score: total,
  };
}

export default triageRequest;
