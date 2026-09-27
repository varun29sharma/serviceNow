/**
 * Pure backtest scoring — no Node APIs, no filesystem.
 *
 * Split out of backtestScore.js specifically so the browser demo can use it.
 * The Rules Console is the centrepiece of the pitch and the primary stage
 * surface is offline demo mode, so "edit a rule and watch accuracy move" has
 * to work with no server at all. That means the scoring maths must be
 * importable into a bundle — hence no `node:fs` here.
 *
 * The labelled case set is injected rather than loaded, so:
 *   - the CLI passes the cases it read from backtest/testCases.json
 *   - the browser passes BACKTEST_CASES from the generated mirror
 *   - a test asserts those two are identical
 */
import { triageRequest } from '../triage/triageRequest.js';

const URGENCY_ORDER = { Low: 0, Medium: 1, High: 2 };

/**
 * scoreCases(cases, config) -> metrics
 *
 * Score = accuracy*100 + HighRecall*30 + HighPrecision*10 + withinOne*5.
 * Recall on High is weighted heaviest because for triage the costly error is
 * under-triaging someone in crisis, not over-triaging a routine request.
 */
export function scoreCases(cases, config) {
  const list = Array.isArray(cases) ? cases : [];
  let exact = 0;
  let highTP = 0;
  let highFN = 0;
  let highFP = 0;
  let withinOne = 0;
  const misses = [];

  for (const c of list) {
    const got = triageRequest({ category: c.category, description: c.description }, config);
    const want = c.expectedUrgency;

    if (got.urgency === want) exact += 1;
    if (Math.abs(URGENCY_ORDER[got.urgency] - URGENCY_ORDER[want]) <= 1) withinOne += 1;

    if (want === 'High' && got.urgency === 'High') highTP += 1;
    if (want === 'High' && got.urgency !== 'High') highFN += 1;
    if (want !== 'High' && got.urgency === 'High') highFP += 1;

    if (got.urgency !== want) {
      misses.push({
        alias: c.studentAlias,
        category: c.category,
        expected: want,
        got: got.urgency,
        matched: got.matchedKeywords,
      });
    }
  }

  const n = list.length || 1;
  const highRecall = highTP + highFN > 0 ? highTP / (highTP + highFN) : 1;
  const highPrecision = highTP + highFP > 0 ? highTP / (highTP + highFP) : 1;
  const score = (exact / n) * 100 + highRecall * 30 + highPrecision * 10 + (withinOne / n) * 5;

  return {
    exact,
    n: list.length,
    highRecall,
    highPrecision,
    withinOne,
    score,
    // Rounded forms are what the UI renders — kept here so the CLI, the API and
    // the offline demo all print identical numbers.
    exactPct: Math.round((exact / n) * 100),
    highRecallPct: Math.round(highRecall * 100),
    highPrecisionPct: Math.round(highPrecision * 100),
    withinOnePct: Math.round((withinOne / n) * 100),
    misses,
  };
}

export default scoreCases;
