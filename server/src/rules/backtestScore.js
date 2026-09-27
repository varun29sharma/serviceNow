/**
 * Backtest scoring — one implementation, three consumers.
 *
 * `backtest/backtest.js` (the CLI), `GET /api/rules/score` (the Rules Console
 * against the live API) and the offline browser demo all must agree about how
 * good a config is. If they had separate copies of this maths, the console
 * would eventually show a number the harness contradicts — which is exactly
 * what an audience notices when you claim "measured on a backtest".
 *
 * The maths lives in backtestScorePure.js; this module only loads the labelled
 * set from disk and delegates. The browser uses the generated mirror of that
 * same set (client/src/lib/backtestCases.generated.js) and is checked against
 * this file by a test.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { scoreCases } from './backtestScorePure.js';

const here = path.dirname(fileURLToPath(import.meta.url));

let cachedCases = null;

/** Load the labelled backtest set (36 Cases) once. */
export function loadTestCases() {
  if (cachedCases) return cachedCases;
  const file = path.join(here, '..', '..', '..', 'backtest', 'testCases.json');
  const parsed = JSON.parse(readFileSync(file, 'utf8'));
  cachedCases = parsed.cases || [];
  return cachedCases;
}

/** evaluateConfig(config) -> metrics, scored against the on-disk labelled set. */
export function evaluateConfig(config) {
  return scoreCases(loadTestCases(), config);
}

export default evaluateConfig;
