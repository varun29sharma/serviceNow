#!/usr/bin/env node
/**
 * Mirror backtest/testCases.json into a browser-importable module.
 *
 * The Rules Console must be able to show "this config scores 26/36" while
 * running fully offline in demo mode — and demo mode is the primary stage
 * surface. That means the labelled case set has to exist as an ES module the
 * bundler can inline, not a JSON file read with node:fs.
 *
 * This script generates that mirror. It is the only place the two copies are
 * allowed to touch: run `npm run sync:cases` after editing testCases.json.
 * `server/test/parity.test.mjs` fails the build if they ever drift apart.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');

const source = path.join(root, 'backtest', 'testCases.json');
const target = path.join(root, 'client', 'src', 'lib', 'backtestCases.generated.js');

const { cases } = JSON.parse(readFileSync(source, 'utf8'));
if (!Array.isArray(cases) || cases.length === 0) {
  console.error('[sync:cases] backtest/testCases.json has no cases — refusing to write.');
  process.exit(1);
}

// Emit every key in the source's own order, so the mirror is a strict,
// order-preserving copy. That is what lets the parity test compare the two
// with JSON.stringify instead of a lossy field-by-field walk.
const body = cases
  .map((c) => {
    const fields = Object.entries(c).map(([key, value]) => `${key}: ${JSON.stringify(value)}`);
    return `  { ${fields.join(', ')} },`;
  })
  .join('\n');

const output = `/**
 * GENERATED FILE — do not edit by hand.
 *
 * Mirror of backtest/testCases.json, produced by \`npm run sync:cases\`.
 * It exists so the browser demo can score a Rule config offline with the exact
 * same labelled set the CLI and the API use. server/test/parity.test.mjs
 * asserts this file matches the JSON source.
 */

export const BACKTEST_CASES = [
${body}
];

export default BACKTEST_CASES;
`;

mkdirSync(path.dirname(target), { recursive: true });
writeFileSync(target, output);
console.log(`[sync:cases] Wrote ${cases.length} labelled Cases to client/src/lib/backtestCases.generated.js`);
