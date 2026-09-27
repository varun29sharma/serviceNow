#!/usr/bin/env node
/**
 * TriageNow Backtest Harness — CLI dev tool. Never imported by the app.
 *
 * Imports the REAL triageRequest, grid-searches candidate triage configs over
 * backtest/testCases.json, and prints a ranked leaderboard plus the winning
 * config as a ready-to-paste DEFAULT_CONFIG block. The winner becomes the
 * production config — the API runs on backtested values, not hand-tuning.
 *
 * Usage:
 *   node backtest/backtest.js
 *   node backtest/backtest.js --all          # also rank every config, not just top 10
 *   node backtest/backtest.js --export       # write winner to backtest/winner.json
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Scoring and the labelled set live in the server, so this harness and the
// Rules Console's GET /api/rules/score can never disagree about how good a
// config is. The CLI is the source of truth; the API re-uses it verbatim.
import { evaluateConfig, loadTestCases } from '../server/src/rules/backtestScore.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const cases = loadTestCases();

// ---------------------------------------------------------------------------
// Search space — small, legible, and explainable on stage. The triage module
// stays fixed; only these knobs vary.
// ---------------------------------------------------------------------------
const BASE_URGENCIES = [
  { 'Mental Health': 'Medium', Academic: 'Low', Financial: 'Medium', Housing: 'Medium', Other: 'Low' },
  { 'Mental Health': 'Low', Academic: 'Low', Financial: 'Low', Housing: 'Low', Other: 'Low' },
  { 'Mental Health': 'High', Academic: 'Medium', Financial: 'Medium', Housing: 'Medium', Other: 'Low' },
];

const CRISIS_TERMS = ['suicide', 'kill myself', 'self harm', 'hurt myself', 'cant go on'];
const ACUTE_TERMS = ['evicted', 'homeless', 'no place to sleep', 'cant eat', 'hungry', 'out of food', 'panic attack', 'hurting', 'final notice', 'shut off'];
const PRESSURE_TERMS = ['failing', 'overdue', 'dropping out', 'drop out', 'eviction', 'past due', 'bills', 'counseling', 'anxious', 'depressed', 'behind', 'unprepared', 'probation', 'urgent', 'ignoring'];

// Weight candidates for each tier — the grid covers "keywords off" through
// "crisis language dominates".
const WEIGHT_SETS = [
  { crisis: 0, acute: 0, pressure: 0 },
  { crisis: 1, acute: 1, pressure: 1 },
  { crisis: 3, acute: 2, pressure: 1 },
  { crisis: 3, acute: 1, pressure: 1 },
  { crisis: 2, acute: 2, pressure: 1 },
  { crisis: 4, acute: 2, pressure: 1 },
  { crisis: 3, acute: 2, pressure: 0 },
];

const THRESHOLDS = [
  { high: 2, medium: 1 },
  { high: 3, medium: 1 },
  { high: 3, medium: 2 },
  { high: 4, medium: 2 },
  { high: 2, medium: 0 }, // any match at least Medium
];

function buildConfig({ base, weights, thresholds }) {
  const keywords = {};
  for (const t of CRISIS_TERMS) keywords[t] = weights.crisis;
  for (const t of ACUTE_TERMS) keywords[t] = weights.acute;
  for (const t of PRESSURE_TERMS) keywords[t] = weights.pressure;
  return { categoryBaseUrgency: base, keywords, thresholds };
}

// ---------------------------------------------------------------------------
// Scoring — imported from server/src/rules/backtestScore.js. Accuracy, with
// High-recall weighted extra: the costly error is triaging a crisis as Low,
// not mislabelling a Low as Medium.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Run the grid
// ---------------------------------------------------------------------------
const all = [];
for (const base of BASE_URGENCIES) {
  for (const weights of WEIGHT_SETS) {
    for (const thresholds of THRESHOLDS) {
      const config = buildConfig({ base, weights, thresholds });
      const result = evaluateConfig(config);
      all.push({ config, result });
    }
  }
}
all.sort((a, b) => b.result.score - a.result.score);

const topN = process.argv.includes('--all') ? all.length : 10;
console.log(`Backtest: ${cases.length} labeled Cases × ${all.length} candidate configs`);
console.log(`Score = accuracy*100 + HighRecall*30 + HighPrecision*10 + withinOne*5\n`);
console.log(' #  exact  HighRec  HighPrec  within1  score  | base        weights (c/a/p)  thresholds');

all.slice(0, topN).forEach((entry, i) => {
  const { config, result } = entry;
  const baseTag =
    config.categoryBaseUrgency['Mental Health'][0] +
    config.categoryBaseUrgency.Academic[0] +
    config.categoryBaseUrgency.Financial[0] +
    config.categoryBaseUrgency.Housing[0] +
    config.categoryBaseUrgency.Other[0];
  const w = Object.values(config.keywords);
  const weightsTag = `${w[0]}/${w[CRISIS_TERMS.length]}/${w[CRISIS_TERMS.length + ACUTE_TERMS.length]}`;
  console.log(
    String(i + 1).padStart(2) + '  ' +
    `${String(result.exact).padStart(2)}/${result.n}`.padEnd(7) +
    `${(result.highRecall * 100).toFixed(0).padStart(6)}%`.padEnd(9) +
    `${(result.highPrecision * 100).toFixed(0).padStart(6)}%`.padEnd(10) +
    `${String(result.withinOne).padStart(4)}/${result.n}`.padEnd(9) +
    result.score.toFixed(1).padStart(7) + '  | ' +
    baseTag.padEnd(11) + weightsTag.padEnd(18) +
    `H>=${config.thresholds.high} M>=${config.thresholds.medium}`
  );
});

// Show the misses of the best config — explainable failures for rehearsal.
const winner = all[0];
console.log(`\nWinner's misses (${winner.result.misses.length}):`);
if (winner.result.misses.length === 0) {
  console.log('  none — exact on every labeled Case');
} else {
  for (const m of winner.result.misses) {
    console.log(`  [${m.alias}] ${m.category}: expected ${m.expected}, got ${m.got}${m.matched.length ? ` (matched: ${m.matched.join(', ')})` : ' (no keywords matched)'}`);
  }
}

// ---------------------------------------------------------------------------
// Emit the winning config as a paste-ready DEFAULT_CONFIG
// ---------------------------------------------------------------------------
const winnerConfig = winner.config;
const block =
  'export const DEFAULT_CONFIG = ' +
  JSON.stringify(winnerConfig, null, 2).replace(/"([^"]+)":/g, "'$1':") +
  ';';
console.log('\nPaste this into server/src/triage/triageRequest.js as DEFAULT_CONFIG:\n');
console.log(block);

if (process.argv.includes('--export')) {
  writeFileSync(path.join(here, 'winner.json'), JSON.stringify(winnerConfig, null, 2) + '\n');
  console.log('\nWrote backtest/winner.json');
}
