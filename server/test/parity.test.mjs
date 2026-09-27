/**
 * Parity test — offline demo mode vs the live API.
 *
 * This is the highest-value test in the suite, because the bug it guards
 * against already shipped once: the server seeder inserted bare documents
 * while the browser demo built rich ones, so the live path had empty activity
 * streams, all-'Routine' sentiment, and a dashboard that quietly fell back to
 * invented numbers. Offline demo mode is the primary stage surface, so any
 * divergence means the demo and the "real" system tell different stories.
 *
 * Method: seed a throwaway database with the shared builder, boot the real
 * server against it, and compare `/api/dashboard` with what demo mode computes
 * from the same builder. Same data in, same numbers out — or this fails.
 *
 * Run with: npm test (from server/)
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const serverDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4637;
const BASE = `http://localhost:${PORT}`;
const MONGO_URI = `mongodb://127.0.0.1:27017/triagenow_parity_${Date.now()}`;

let child = null;

/**
 * Minimal browser shims so demoApi.js can be imported under Node.
 * It only touches sessionStorage and window.location.
 */
function installBrowserShims() {
  const store = new Map();
  globalThis.sessionStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
  globalThis.window = {
    location: { search: '', hash: '', href: 'http://localhost/' },
    addEventListener() {},
    removeEventListener() {},
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    dispatchEvent() {},
  };
  globalThis.document = { documentElement: { dataset: {} } };
  return { store };
}

async function api(pathname) {
  const res = await fetch(`${BASE}${pathname}`);
  return { status: res.status, body: await res.json().catch(() => null) };
}

before(async () => {
  installBrowserShims();

  const mongoose = (await import('mongoose')).default;
  const Case = (await import('../src/models/Case.js')).default;
  const Deflection = (await import('../src/models/Deflection.js')).default;
  const { buildSeedCases, buildSeedDeflections } = await import('../src/seedCases.js');

  // Everything shares one timestamp, so SLA boundaries cannot drift between
  // the two computations.
  const now = new Date();

  await mongoose.connect(MONGO_URI);
  await Case.deleteMany({});
  await Deflection.deleteMany({});
  await Case.insertMany(buildSeedCases({ now }));
  await Deflection.insertMany(buildSeedDeflections({ now }));
  await mongoose.disconnect();

  child = spawn('node', ['src/index.js'], {
    cwd: serverDir,
    env: { ...process.env, PORT: String(PORT), MONGODB_URI: MONGO_URI },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', (chunk) => process.stderr.write(`[parity api] ${chunk}`));

  let ready = false;
  for (let i = 0; i < 40 && !ready; i += 1) {
    try {
      const { status } = await api('/api/health');
      ready = status === 200;
    } catch {
      await sleep(250);
    }
  }
  if (!ready) throw new Error('server never became ready for the parity test');
});

after(async () => {
  if (child) {
    child.kill('SIGTERM');
    await sleep(300);
    child.kill('SIGKILL');
  }
  const mongoose = (await import('mongoose')).default;
  try {
    await mongoose.connect(MONGO_URI);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  } catch {
    /* best effort cleanup */
  }
});

test('demo mode reproduces the API dashboard exactly', async () => {
  // Fresh sessionStorage -> demo mode seeds itself from the same builder.
  globalThis.sessionStorage.clear();
  const demo = await import('../../client/src/demoApi.js');

  const live = (await api('/api/dashboard')).body;
  const offline = await demo.getDashboard();

  const scalars = [
    'total',
    'overdue',
    'atRisk',
    'crisisCount',
    'unassignedCount',
    'resolvedCount',
    'deflectedCount',
    'deflectionRate',
    'slaComplianceRate',
    'hoursSaved',
    'hoursSavedProjectedAnnual',
  ];

  for (const key of scalars) {
    assert.equal(offline[key], live[key], `${key}: demo ${offline[key]} vs API ${live[key]}`);
  }

  for (const key of ['byUrgency', 'byAssignmentGroup', 'byStatus', 'bySentiment', 'byImpact']) {
    assert.deepEqual(offline[key], live[key], `${key} differs`);
  }

  for (const priority of [1, 2, 3, 4]) {
    assert.equal(
      offline.byPriority[priority],
      live.byPriority[priority],
      `byPriority[${priority}] differs`
    );
  }

  assert.equal(
    offline.topDeflectedArticles.length,
    live.topDeflectedArticles.length,
    'deflection leaderboard length differs'
  );
  assert.deepEqual(
    offline.topDeflectedArticles.map((a) => [a.articleId, a.count]),
    live.topDeflectedArticles.map((a) => [a.articleId, a.count]),
    'deflection leaderboard contents differ'
  );

  assert.equal(offline.deflectionTrend.length, 7);
  assert.equal(live.deflectionTrend.length, 7);
  const sum = (rows) => rows.reduce((n, row) => n + row.count, 0);
  assert.equal(sum(offline.deflectionTrend), sum(live.deflectionTrend), 'deflection trend differs');
  assert.equal(sum(offline.caseTrend), sum(live.caseTrend), 'case trend differs');
});

test('demo mode reproduces the API routing for every seeded Case', async () => {
  globalThis.sessionStorage.clear();
  const demo = await import('../../client/src/demoApi.js');

  const liveCases = (await api('/api/requests?group=All')).body;
  const offlineCases = await demo.listCasesByGroup('All');

  assert.equal(offlineCases.length, liveCases.length, 'case counts differ');

  const byName = (rows) => new Map(rows.map((row) => [row.studentAlias, row]));
  const live = byName(liveCases);
  const offline = byName(offlineCases);

  for (const [alias, liveCase] of live) {
    const offlineCase = offline.get(alias);
    assert.ok(offlineCase, `demo is missing ${alias}`);
    assert.equal(offlineCase.assignmentGroup, liveCase.assignmentGroup, `${alias} assignmentGroup`);
    assert.equal(offlineCase.urgency, liveCase.urgency, `${alias} urgency`);
    assert.equal(offlineCase.impact, liveCase.impact, `${alias} impact`);
    assert.equal(offlineCase.priority, liveCase.priority, `${alias} priority`);
    assert.equal(offlineCase.sentiment, liveCase.sentiment, `${alias} sentiment`);
    assert.equal(offlineCase.status, liveCase.status, `${alias} status`);
    assert.deepEqual(offlineCase.matchedKeywords, liveCase.matchedKeywords, `${alias} keywords`);
  }
});

test('demo mode reproduces the live queue ordering', async () => {
  globalThis.sessionStorage.clear();
  const demo = await import('../../client/src/demoApi.js');

  const liveCases = (await api('/api/requests?group=All')).body;
  const offlineCases = await demo.listCasesByGroup('All');

  assert.deepEqual(
    offlineCases.map((c) => c.studentAlias),
    liveCases.map((c) => c.studentAlias),
    'queue order differs between demo and API'
  );
});

test('the live API routes a new Case the same way demo mode does', async () => {
  globalThis.sessionStorage.clear();
  const demo = await import('../../client/src/demoApi.js');

  const request = {
    category: 'Housing',
    description: 'I have been evicted and I am homeless with no place to sleep tonight.',
  };

  const live = (await fetch(`${BASE}/api/requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentAlias: 'Parity Check', ...request }),
  }).then((r) => r.json()));

  const offline = await demo.createCase({ studentAlias: 'Parity Check', ...request });

  assert.equal(offline.assignmentGroup, live.assignmentGroup);
  assert.equal(offline.urgency, live.urgency);
  assert.equal(offline.impact, live.impact);
  assert.equal(offline.priority, live.priority);
  assert.equal(offline.sentiment, live.sentiment);
  assert.deepEqual(offline.matchedKeywords, live.matchedKeywords);
  assert.equal(offline.status, 'New');
});
