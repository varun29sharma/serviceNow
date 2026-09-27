/**
 * Unit tests for the routing core.
 *
 * These pin the behaviour the whole product rests on, so the refactors that
 * made routing configurable cannot silently change what gets routed where:
 *   - the Assignment Rule mapping and urgency derivation
 *   - the specific text-normalisation bugs the backtest originally exposed
 *     (apostrophes, plurals) — regressions here are invisible until a student
 *     writes "can't eat" and gets triaged Low
 *   - the vocabulary guard that stops a rule edit corrupting the fixed words
 *   - the priority matrix, including the anti-pattern of priority == urgency
 *
 * Run with: npm test (from server/)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { triageRequest, DEFAULT_CONFIG, ASSIGNMENT_RULE } from '../src/triage/triageRequest.js';
import {
  deriveImpact,
  deriveImpactAndPriority,
  derivePriority,
  DEFAULT_PRIORITY_MATRIX,
  IMPACTS,
} from '../src/triage/priorityMatrix.js';
import { builtInConfig, validateConfig } from '../src/rules/ruleSchema.js';
import { scoreCases } from '../src/rules/backtestScorePure.js';
import { buildSeedCases, buildSeedDeflections, SEED_DEFLECTION_PLAN } from '../src/seedCases.js';
import { CATEGORIES, ASSIGNMENT_GROUPS, URGENCIES, STATUSES } from '../src/constants.js';
import { BACKTEST_CASES } from '../../client/src/lib/backtestCases.generated.js';

const triage = (category, description) => triageRequest({ category, description });

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

test('crisis language is triaged High and routed to Counseling', () => {
  const result = triage('Mental Health', 'I am having thoughts of suicide and need help now');
  assert.equal(result.urgency, 'High');
  assert.equal(result.assignmentGroup, 'Counseling');
});

test('apostrophes do not break keyword matching', () => {
  // The backtest originally surfaced this: "can't eat" failed to match the
  // "cant eat" keyword and an acute case was triaged too low.
  const result = triage('Financial', "I can't eat until my refund arrives");
  assert.equal(result.urgency, 'High');
  assert.ok(result.matchedKeywords.includes('cant eat'));
});

test('plurals match their singular keyword', () => {
  const result = triage('Mental Health', 'I keep having panic attacks in class');
  assert.ok(result.matchedKeywords.includes('panic attack'));
});

test('a routine question is triaged Low', () => {
  const result = triage('Other', 'Where can I print posters for my club?');
  assert.equal(result.urgency, 'Low');
  assert.equal(result.score, 0);
});

test('an empty or malformed request never throws and defaults Low', () => {
  for (const input of [undefined, null, {}, { category: 'Nonsense', description: '' }]) {
    const result = triageRequest(input);
    assert.equal(result.urgency, 'Low');
    assert.ok(URGENCIES.includes(result.urgency));
  }
});

test('every category maps to a valid assignmentGroup', () => {
  for (const category of CATEGORIES) {
    const result = triage(category, 'I would like some general information');
    assert.ok(
      ASSIGNMENT_GROUPS.includes(result.assignmentGroup),
      `${category} -> ${result.assignmentGroup}`
    );
  }
});

test('the category -> group mapping is configurable', () => {
  const config = { ...DEFAULT_CONFIG, assignmentRule: { ...ASSIGNMENT_RULE, Academic: 'Peer Support' } };
  const result = triageRequest({ category: 'Academic', description: 'I am failing' }, config);
  assert.equal(result.assignmentGroup, 'Peer Support');
});

test('adding crisis language never lowers the derived urgency', () => {
  const base = triage('Academic', 'I am a bit behind on one assignment');
  const escalated = triage('Academic', 'I am a bit behind on one assignment and I am failing');
  const order = { Low: 0, Medium: 1, High: 2 };
  assert.ok(order[escalated.urgency] >= order[base.urgency]);
});

// ---------------------------------------------------------------------------
// Priority — impact x urgency, never a copy of urgency
// ---------------------------------------------------------------------------

test('the priority matrix matches ServiceNow defaults', () => {
  const expected = {
    'High-High': 1, 'High-Medium': 2, 'High-Low': 3,
    'Medium-High': 2, 'Medium-Medium': 3, 'Medium-Low': 4,
    'Low-High': 3, 'Low-Medium': 4, 'Low-Low': 4,
  };
  for (const [key, value] of Object.entries(expected)) {
    const [impact, urgency] = key.split('-');
    assert.equal(derivePriority(impact, urgency, DEFAULT_PRIORITY_MATRIX), value, key);
  }
});

test('an unknown impact falls back to a valid priority instead of throwing', () => {
  const value = derivePriority('Catastrophic', 'High', DEFAULT_PRIORITY_MATRIX);
  assert.ok(value >= 1 && value <= 4);
});

test('priority is not a restatement of urgency', () => {
  // The anti-pattern this guards against: priority := urgency. A routine
  // Mental Health enquiry is Low urgency but High impact, so it is P3 — and an
  // academic case called "urgent" is High urgency with Medium impact, so P2.
  const mentalHealth = deriveImpactAndPriority({ category: 'Mental Health', urgency: 'Low' });
  assert.equal(mentalHealth.impact, 'High');
  assert.equal(mentalHealth.priority, 3);

  const academic = deriveImpactAndPriority({ category: 'Academic', urgency: 'High' });
  assert.equal(academic.impact, 'Medium');
  assert.equal(academic.priority, 2);
});

test('crisis detection forces High impact', () => {
  const impact = deriveImpact({ category: 'Academic', urgency: 'Low', crisisDetected: true });
  assert.equal(impact, 'High');
});

test('every derived priority is within range for all category and urgency pairs', () => {
  for (const category of CATEGORIES) {
    for (const urgency of URGENCIES) {
      const { impact, priority } = deriveImpactAndPriority({ category, urgency });
      assert.ok(IMPACTS.includes(impact), `${category}/${urgency} impact`);
      assert.ok(priority >= 1 && priority <= 4, `${category}/${urgency} priority`);
    }
  }
});

// ---------------------------------------------------------------------------
// Vocabulary guard
// ---------------------------------------------------------------------------

test('the built-in config is valid', () => {
  assert.deepEqual(validateConfig(builtInConfig()), []);
});

test('validation rejects an unknown assignmentGroup', () => {
  const config = builtInConfig();
  config.assignmentRule.Academic = 'Department of Vibes';
  assert.equal(validateConfig(config).length, 1);
});

test('validation rejects an unknown category and a missing one', () => {
  const config = builtInConfig();
  config.assignmentRule.Cryptocurrency = 'Peer Support';
  delete config.assignmentRule.Housing;
  const errors = validateConfig(config);
  assert.ok(errors.some((e) => e.includes('unknown category')));
  assert.ok(errors.some((e) => e.includes('missing category "Housing"')));
});

test('validation rejects out-of-range weights and inverted thresholds', () => {
  const weights = builtInConfig();
  weights.keywords.suicide = 9;
  assert.ok(validateConfig(weights).some((e) => e.includes('between 0 and 5')));

  const thresholds = builtInConfig();
  thresholds.thresholds = { high: 1, medium: 4 };
  assert.ok(validateConfig(thresholds).some((e) => e.includes('greater than or equal')));
});

test('validation rejects a broken priority matrix', () => {
  const config = builtInConfig();
  delete config.priorityMatrix.High;
  assert.ok(validateConfig(config).some((e) => e.includes('missing impact "High"')));

  const bad = builtInConfig();
  bad.priorityMatrix.Low.High = 7;
  assert.ok(validateConfig(bad).some((e) => e.includes('between 1 and 4')));
});

test('vocabulary constants are exactly the fixed sets', () => {
  assert.deepEqual(CATEGORIES, ['Mental Health', 'Academic', 'Financial', 'Housing', 'Other']);
  assert.deepEqual(ASSIGNMENT_GROUPS, ['Counseling', 'Academic Advising', 'Financial Aid', 'Peer Support']);
  assert.deepEqual(STATUSES, ['New', 'Assigned', 'In Progress', 'Resolved']);
});

// ---------------------------------------------------------------------------
// Backtest regression
// ---------------------------------------------------------------------------

test('the shipped config still scores 30/36 with 100% High-urgency recall', () => {
  const metrics = scoreCases(BACKTEST_CASES, builtInConfig());
  assert.equal(metrics.n, 36);
  assert.equal(metrics.exact, 30, `exact dropped to ${metrics.exact}`);
  assert.equal(metrics.highRecallPct, 100);
  assert.equal(metrics.highPrecisionPct, 87);
});

test('breaking the crisis keywords visibly degrades recall', () => {
  // This is the live demo moment, asserted so it cannot quietly stop working.
  const broken = builtInConfig();
  for (const keyword of ['suicide', 'kill myself', 'self harm', 'hurt myself', 'cant go on']) {
    broken.keywords[keyword] = 0;
  }
  const metrics = scoreCases(BACKTEST_CASES, broken);
  assert.ok(metrics.exact < 30, 'breaking the rule should lose accuracy');
  assert.ok(metrics.highRecallPct < 100, 'breaking the rule should lose High recall');
});

test('the mirrored backtest cases match the source of truth', async () => {
  const { loadTestCases } = await import('../src/rules/backtestScore.js');
  assert.deepEqual(loadTestCases(), BACKTEST_CASES);
});

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

test('the seed builder produces complete Cases', () => {
  const cases = buildSeedCases({ withIds: true });
  assert.equal(cases.length, 13);

  for (const item of cases) {
    assert.ok(item.studentAlias, 'studentAlias');
    assert.ok(CATEGORIES.includes(item.category), `category ${item.category}`);
    assert.ok(URGENCIES.includes(item.urgency), `urgency ${item.urgency}`);
    assert.ok(ASSIGNMENT_GROUPS.includes(item.assignmentGroup), 'assignmentGroup');
    assert.ok(STATUSES.includes(item.status), `status ${item.status}`);
    assert.ok(IMPACTS.includes(item.impact), `impact ${item.impact}`);
    assert.ok(item.priority >= 1 && item.priority <= 4, 'priority');
    assert.ok(!Number.isNaN(new Date(item.slaTarget).getTime()), 'slaTarget parses');
    assert.ok(item.snSysId && item.snSysId.length === 32, 'sys_id');
    assert.equal(item._id.length, 24, '24-char hex id');
    assert.match(item._id, /^[0-9a-f]{24}$/);

    // The bug this guards against: the server seeder used to insert bare
    // documents, so sentiment defaulted to 'Routine' and the activity stream
    // was empty — leaving the flagship screens blank on the live path.
    assert.ok(item.sentiment, 'sentiment present');
    assert.ok(item.activityStream.length > 0, 'activity stream populated');
    assert.ok(Array.isArray(item.matchedKeywords), 'matchedKeywords array');
    assert.ok(item.studentProfile && item.studentProfile.riskTier, 'student profile');
  }
});

test('the seed set covers every sentiment, priority and group', () => {
  const cases = buildSeedCases({});
  const sentiments = new Set(cases.map((c) => c.sentiment));
  const priorities = new Set(cases.map((c) => c.priority));
  const groups = new Set(cases.map((c) => c.assignmentGroup));

  for (const sentiment of ['Severe Crisis', 'Distressed', 'Concerned', 'Routine']) {
    assert.ok(sentiments.has(sentiment), `seed is missing sentiment ${sentiment}`);
  }
  for (const priority of [1, 2, 3, 4]) {
    assert.ok(priorities.has(priority), `seed is missing priority P${priority}`);
  }
  assert.equal(groups.size, ASSIGNMENT_GROUPS.length);
});

test('the seed includes cases inside, at risk of, and past their SLA target', () => {
  const now = new Date();
  const cases = buildSeedCases({ now });
  const overdue = cases.filter((c) => new Date(c.slaTarget) < now && c.status !== 'Resolved');
  const atRisk = cases.filter((c) => {
    const remaining = new Date(c.slaTarget) - now;
    return remaining > 0 && remaining <= 3600000 && c.status !== 'Resolved';
  });

  assert.ok(overdue.length > 0, 'expected at least one breached Case');
  assert.ok(atRisk.length > 0, 'expected at least one at-risk Case');
  // Not every old Case should breach, or the compliance figure is meaningless.
  assert.ok(overdue.length < cases.length / 2, 'too many breaches to be a credible demo');
});

test('seed deflections match the declared plan', () => {
  const deflections = buildSeedDeflections({});
  const planned = SEED_DEFLECTION_PLAN.reduce((n, entry) => n + entry.count, 0);
  assert.equal(deflections.length, planned);
  assert.ok(deflections.every((d) => d.articleId && d.avoidedMinutes > 0));
  assert.equal(new Set(deflections.map((d) => d.articleId)).size, SEED_DEFLECTION_PLAN.length);
});
