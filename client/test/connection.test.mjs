/**
 * Connection store tests.
 *
 * These are the tests that would have caught the original bug. The old build
 * decided the backend from a query string and reported the *intent* in the
 * topbar, so a fresh tab with no server running showed a connection error while
 * the badge claimed "Live API". Every case below is about the module telling the
 * truth instead.
 *
 * `resolveMode` and `describeConnection` are pure on purpose, precisely so this
 * file needs no DOM, no browser and no network.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MODE,
  describeConnection,
  probeApi,
  resolveMode,
  resolveReason,
  resolvesWithoutProbe,
} from '../src/lib/connection.js';

test('a fresh tab with no server falls back to the offline engine', () => {
  // The exact scenario the user hit: no override, no query string, API down.
  assert.equal(resolveMode({ healthOk: false }), MODE.DEMO);
  assert.equal(resolveReason({ healthOk: false }), 'fallback');
});

test('a fresh tab with a healthy API uses the live API', () => {
  assert.equal(resolveMode({ healthOk: true }), MODE.LIVE);
  assert.equal(resolveReason({ healthOk: true }), 'probe');
});

test('an explicit offline choice is always honoured, healthy API or not', () => {
  assert.equal(resolveMode({ override: MODE.DEMO, healthOk: true }), MODE.DEMO);
  assert.equal(resolveMode({ override: MODE.DEMO, healthOk: false }), MODE.DEMO);
  assert.equal(resolveReason({ override: MODE.DEMO }), 'override');
});

test('asking for live without a server still yields a working app, not an error', () => {
  // This is the behaviour the badge wording depends on: mode falls back, but the
  // REASON must be 'fallback' rather than 'override', or the app would claim the
  // user chose offline when in fact the API was absent.
  assert.equal(resolveMode({ override: MODE.LIVE, healthOk: false }), MODE.DEMO);
  assert.equal(resolveReason({ override: MODE.LIVE, healthOk: false }), 'fallback');
  assert.equal(resolveMode({ override: MODE.LIVE, healthOk: true }), MODE.LIVE);
  assert.equal(resolveReason({ override: MODE.LIVE, healthOk: true }), 'override');
});

test('an explicit choice outranks a ?demo=1 deep link', () => {
  assert.equal(resolveMode({ override: MODE.LIVE, queryWantsDemo: true, healthOk: true }), MODE.LIVE);
});

test('the ?demo=1 deep link outranks a healthy API', () => {
  assert.equal(resolveMode({ queryWantsDemo: true, healthOk: true }), MODE.DEMO);
  assert.equal(resolveReason({ queryWantsDemo: true, healthOk: true }), 'deep-link');
});

test('a file:// build never claims to be live — it has no server to reach', () => {
  assert.equal(resolveMode({ isFileProtocol: true, healthOk: false }), MODE.DEMO);
  assert.equal(resolveReason({ isFileProtocol: true }), 'file');
});

test('only the offline routes skip the probe; asking for live always probes', () => {
  assert.equal(resolvesWithoutProbe({ override: MODE.DEMO }), true);
  assert.equal(resolvesWithoutProbe({ queryWantsDemo: true }), true);
  assert.equal(resolvesWithoutProbe({ isFileProtocol: true }), true);
  // The important one: 'live' must never be assumed without asking.
  assert.equal(resolvesWithoutProbe({ override: MODE.LIVE }), false);
  assert.equal(resolvesWithoutProbe({}), false);
});

test('the badge reports connectivity, never intent', () => {
  const live = describeConnection({ mode: MODE.LIVE, reason: 'probe', reachable: 'ok' });
  assert.match(live.short, /Live API/);
  assert.equal(live.tone, 'live');

  // Offline because the API did not answer is a WARNING, not a neutral choice.
  const fell = describeConnection({ mode: MODE.DEMO, reason: 'fallback', reachable: 'unreachable' });
  assert.equal(fell.tone, 'warning');
  assert.match(fell.short, /unreachable/i);
  assert.match(fell.detail, /in-browser engine/i);

  const chosen = describeConnection({ mode: MODE.DEMO, reason: 'override', reachable: 'unknown' });
  assert.equal(chosen.tone, 'demo');
  assert.match(chosen.short, /Offline engine/);

  const standalone = describeConnection({ mode: MODE.DEMO, reason: 'file', reachable: 'unknown' });
  assert.match(standalone.title, /single-file/i);
});

test('probeApi accepts only a health response from OUR api', async () => {
  const ok = await probeApi({
    fetchImpl: async () => ({ ok: true, json: async () => ({ ok: true, service: 'TriageNow API' }) }),
  });
  assert.equal(ok, true);

  // Something else is listening on the port: right status, wrong service.
  const impostor = await probeApi({
    fetchImpl: async () => ({ ok: true, json: async () => ({ hello: 'world' }) }),
  });
  assert.equal(impostor, false);
});

test('probeApi never throws — a refused connection is just false', async () => {
  const refused = await probeApi({
    fetchImpl: async () => {
      throw new TypeError('fetch failed');
    },
  });
  assert.equal(refused, false);

  const serverError = await probeApi({ fetchImpl: async () => ({ ok: false, status: 500 }) });
  assert.equal(serverError, false);

  const notJson = await probeApi({
    fetchImpl: async () => ({
      ok: true,
      json: async () => {
        throw new SyntaxError('not json');
      },
    }),
  });
  assert.equal(notJson, false);
});

test('probeApi gives up on a hanging server instead of blocking the app', async () => {
  const hanging = (_url, options) =>
    new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('aborted')));
    });

  const started = Date.now();
  const result = await probeApi({ timeoutMs: 40, fetchImpl: hanging });
  assert.equal(result, false);
  assert.ok(Date.now() - started < 1000, 'the timeout should fire promptly');
});
