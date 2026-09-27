/**
 * Priority derivation — the ServiceNow impact x urgency lookup.
 *
 * In ServiceNow, `urgency` answers "how soon does this need attention?" and
 * `impact` answers "how bad is it if we get it wrong?". `priority` is not a
 * third judgement call — it is a *derived* lookup over the two. Copying
 * urgency into priority (as the previous build did) is the single most
 * recognisable authenticity error in an ITSM/CSM demo, because every
 * ServiceNow admin has edited this matrix at least once.
 *
 * Pure module: no Mongo, no Express. Imported by the API, the seed builder,
 * the backtest-adjacent tooling and the browser demo, so all four agree.
 */

/** Impact levels, ordered worst-first for display. */
export const IMPACTS = ['High', 'Medium', 'Low'];

/** Urgency levels — must match the URGENCIES vocabulary exactly. */
export const URGENCY_KEYS = ['High', 'Medium', 'Low'];

/**
 * The matrix itself. Rows = impact, columns = urgency, values = priority.
 * Values match ServiceNow's default priority lookup:
 *   P1 Critical  — impact High   + urgency High
 *   P2 High      — impact High   + urgency Medium, impact Medium + urgency High
 *   P3 Moderate  — impact High   + urgency Low, impact Medium + urgency Medium,
 *                  impact Low    + urgency High
 *   P4 Low       — everything else
 */
export const DEFAULT_PRIORITY_MATRIX = {
  High: { High: 1, Medium: 2, Low: 3 },
  Medium: { High: 2, Medium: 3, Low: 4 },
  Low: { High: 3, Medium: 4, Low: 4 },
};

export const PRIORITY_LABELS = {
  1: 'P1 · Critical',
  2: 'P2 · High',
  3: 'P3 · Moderate',
  4: 'P4 · Low',
};

export const PRIORITY_SHORT = { 1: 'P1', 2: 'P2', 3: 'P3', 4: 'P4' };

/**
 * derivePriority(impact, urgency, matrix) -> 1 | 2 | 3 | 4
 *
 * Falls back to P4 on any unknown input rather than throwing: a routing engine
 * must never fail to produce a Case because a rule was edited badly.
 */
export function derivePriority(impact, urgency, matrix = DEFAULT_PRIORITY_MATRIX) {
  const row = (matrix && matrix[impact]) || DEFAULT_PRIORITY_MATRIX.Medium;
  const value = row && row[urgency];
  return typeof value === 'number' && value >= 1 && value <= 4 ? value : 4;
}

/**
 * deriveImpact — the impact half of the pair, from signals we actually have.
 *
 * Deliberately *not* a restatement of urgency. Urgency comes from what the
 * student wrote and how fast it must be handled; impact comes from the domain
 * and the known risk profile — the consequence of getting it wrong. That is
 * what makes the 3x3 grid worth showing: a student who calls a routine
 * academic question "urgent" is urgency High / impact Low, which is P3, not P1.
 *
 *   Mental Health  -> always High impact (safety domain)
 *   Housing        -> High if acute, else Medium
 *   Financial      -> Medium
 *   Academic/Other -> Medium when acute, else Low
 */
export function deriveImpact({ category, urgency, crisisDetected = false, riskTier } = {}) {
  if (crisisDetected || riskTier === 'Critical') return 'High';
  if (category === 'Mental Health') return 'High';
  if (category === 'Housing') return urgency === 'High' ? 'High' : 'Medium';
  if (category === 'Financial') return 'Medium';
  if (urgency === 'High') return 'Medium';
  return 'Low';
}

/** Full derivation in one call — used by the API, seed builder and demo. */
export function deriveImpactAndPriority(
  { category, urgency, crisisDetected, riskTier } = {},
  matrix = DEFAULT_PRIORITY_MATRIX
) {
  const impact = deriveImpact({ category, urgency, crisisDetected, riskTier });
  return { impact, priority: derivePriority(impact, urgency, matrix) };
}

export default deriveImpactAndPriority;
