/**
 * End-to-end API smoke test.
 *
 * Spawns the real server against a throwaway database, exercises every route
 * including the Assignment Rule console, and asserts the behaviour the pitch
 * depends on. Uses its own port and a unique database per run, so it is
 * idempotent and safe to run while a dev server is up.
 *
 *   npm run smoke        (from server/, or the repo root)
 *
 * Exits non-zero on any failure.
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const serverDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4594;
const BASE = `http://localhost:${PORT}`;

let passed = 0;
let failed = 0;

function check(name, condition, extra = '') {
  if (condition) {
    passed += 1;
    console.log(`  ok    ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${extra ? ` — ${extra}` : ''}`);
  }
}

async function api(pathname, options = {}) {
  const res = await fetch(`${BASE}${pathname}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* leave null */
  }
  return { status: res.status, body };
}

const post = (pathname, payload) =>
  api(pathname, { method: 'POST', body: JSON.stringify(payload || {}) });
const patch = (pathname, payload) =>
  api(pathname, { method: 'PATCH', body: JSON.stringify(payload || {}) });
const put = (pathname, payload) =>
  api(pathname, { method: 'PUT', body: JSON.stringify(payload || {}) });

const createCase = (studentAlias, category, description) =>
  post('/api/requests', { studentAlias, category, description });

const RANK = { Low: 0, Medium: 1, High: 2 };

const child = spawn('node', ['src/index.js'], {
  cwd: serverDir,
  env: {
    ...process.env,
    PORT: String(PORT),
    MONGODB_URI: `mongodb://127.0.0.1:27017/triagenow_smoke_${Date.now()}`,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
child.stdout.on('data', () => {});
child.stderr.on('data', (data) => process.stderr.write(`[api] ${data}`));

try {
  let up = false;
  for (let i = 0; i < 40 && !up; i += 1) {
    try {
      const { status } = await api('/api/health');
      up = status === 200;
    } catch {
      await sleep(250);
    }
  }
  if (!up) throw new Error('API never became ready on /api/health');

  // ---------------------------------------------------------------- intake
  console.log('\nPOST /api/requests — intake and derivation');
  const crisis = await createCase(
    'Smoke Crisis',
    'Mental Health',
    'I am having thoughts of suicide and need help now'
  );
  check('crisis Case created (201)', crisis.status === 201 && !!crisis.body?._id, `got ${crisis.status}`);
  check('crisis -> High urgency', crisis.body?.urgency === 'High', `got ${crisis.body?.urgency}`);
  check('Mental Health -> Counseling', crisis.body?.assignmentGroup === 'Counseling');
  check('crisis -> High impact', crisis.body?.impact === 'High');
  check('High impact x High urgency -> P1', crisis.body?.priority === 1, `got P${crisis.body?.priority}`);
  check('status starts New', crisis.body?.status === 'New');
  check('sentiment is Severe Crisis', crisis.body?.sentiment === 'Severe Crisis');
  check('sys_id is 32 hex chars', /^[0-9a-f]{32}$/.test(crisis.body?.snSysId || ''));
  check('activity stream seeded', (crisis.body?.activityStream || []).length >= 2);
  check(
    'crisis activity names the safety protocol',
    (crisis.body?.activityStream || []).some((a) => /SAFETY PROTOCOL/.test(a.text))
  );

  const apostrophe = await createCase(
    'Smoke Apostrophe',
    'Financial',
    "I can't eat until my refund comes and I got a final notice"
  );
  check("apostrophe text (can't eat) -> High", apostrophe.body?.urgency === 'High', `got ${apostrophe.body?.urgency}`);
  check('matchedKeywords reported', (apostrophe.body?.matchedKeywords || []).includes('cant eat'));
  check('Financial -> Financial Aid', apostrophe.body?.assignmentGroup === 'Financial Aid');
  check(
    'Financial impact is Medium -> P2',
    apostrophe.body?.impact === 'Medium' && apostrophe.body?.priority === 2,
    `got ${apostrophe.body?.impact}/P${apostrophe.body?.priority}`
  );

  // The 2x2 proof: urgency is not priority.
  const academic = await createCase(
    'Smoke Academic',
    'Academic',
    'I am failing two classes and I am urgently behind on my coursework'
  );
  check('academic acute -> High urgency', academic.body?.urgency === 'High');
  check(
    'academic impact stays Medium -> P2, not P1',
    academic.body?.impact === 'Medium' && academic.body?.priority === 2,
    `got ${academic.body?.impact}/P${academic.body?.priority}`
  );

  const low = await createCase('Smoke Low', 'Other', 'Where can I print posters for my club?');
  check('routine -> Low urgency', low.body?.urgency === 'Low', `got ${low.body?.urgency}`);
  check('routine -> P4', low.body?.priority === 4, `got P${low.body?.priority}`);

  console.log('\nPOST /api/requests — validation');
  check('bad category -> 400', (await createCase('X', 'Bogus', 'hi')).status === 400);
  check('missing description -> 400', (await post('/api/requests', { studentAlias: 'X', category: 'Other' })).status === 400);
  check('missing alias -> 400', (await post('/api/requests', { category: 'Other', description: 'hi' })).status === 400);

  // ------------------------------------------------------------------- SLA
  console.log('\nSLA targets');
  const highWindow = new Date(crisis.body.slaTarget) - new Date(crisis.body.createdAt);
  const lowWindow = new Date(low.body.slaTarget) - new Date(low.body.createdAt);
  check('High SLA ~ 2h', Math.abs(highWindow - 2 * 3600e3) < 5000, `${Math.round(highWindow / 6e4)}min`);
  check('Low SLA ~ 72h', Math.abs(lowWindow - 72 * 3600e3) < 5000, `${Math.round(lowWindow / 36e5)}h`);

  // ----------------------------------------------------------------- queue
  console.log('\nGET /api/requests?group= — queues');
  const finQueue = await api('/api/requests?group=Financial%20Aid');
  check('Financial Aid queue lists the apostrophe Case', Array.isArray(finQueue.body) && finQueue.body.some((c) => c._id === apostrophe.body._id));
  check('unknown group -> 400', (await api('/api/requests?group=Nope')).status === 400);

  const all = await api('/api/requests?group=All');
  const rows = all.body || [];
  check('group=All returns every Case', rows.length === 4, `got ${rows.length}`);
  const priorityOrdered = rows.every((c, i) => i === 0 || rows[i - 1].priority <= c.priority);
  check('queue is priority ordered', priorityOrdered, rows.map((c) => `P${c.priority}`).join(','));
  const lastP1 = rows.map((c) => c.priority).lastIndexOf(1);
  const firstP2 = rows.map((c) => c.priority).indexOf(2);
  check('P1 Cases precede P2 Cases', lastP1 === -1 || firstP2 === -1 || lastP1 < firstP2);
  check(
    'within a priority, urgency is descending',
    rows.every((c, i) => i === 0 || rows[i - 1].priority !== c.priority || RANK[rows[i - 1].urgency] >= RANK[c.urgency])
  );

  // -------------------------------------------------------------- one Case
  console.log('\nGET /api/requests/:id');
  const one = await api(`/api/requests/${crisis.body._id}`);
  check('fetches one Case', one.status === 200 && one.body._id === crisis.body._id);
  check('unknown id -> 404', (await api('/api/requests/aaaaaaaaaaaaaaaaaaaaaaaa')).status === 404);
  check('malformed id -> 400', (await api('/api/requests/not-an-id')).status === 400);

  // --------------------------------------------------------------- lifecycle
  console.log('\nPATCH /api/requests/:id — lifecycle');
  const progressed = await patch(`/api/requests/${crisis.body._id}`, { status: 'In Progress' });
  check('status updated', progressed.body?.status === 'In Progress', `got ${progressed.body?.status}`);
  check('bad status -> 400', (await patch(`/api/requests/${crisis.body._id}`, { status: 'Done' })).status === 400);
  check('bad impact -> 400', (await patch(`/api/requests/${crisis.body._id}`, { impact: 'Enormous' })).status === 400);

  const reassigned = await patch(`/api/requests/${academic.body._id}`, {
    assignedTo: 'Marcus Thorne, Academic Advisor',
    status: 'Assigned',
  });
  check('assignee updated', reassigned.body?.assignedTo === 'Marcus Thorne, Academic Advisor');

  // Impact override: priority must re-derive from the matrix.
  const overridden = await patch(`/api/requests/${academic.body._id}`, { impact: 'Low' });
  check(
    'impact override re-derives priority (Low impact x High urgency -> P3)',
    overridden.body?.priority === 3,
    `got P${overridden.body?.priority}`
  );
  check(
    'override is written to the activity stream',
    (overridden.body?.activityStream || []).some((a) => /Priority re-derived/.test(a.text))
  );

  console.log('\nPOST /api/requests/:id/notes — work notes vs comments');
  const workNote = await post(`/api/requests/${crisis.body._id}/notes`, {
    type: 'work_note',
    author: 'Smoke Tester',
    text: 'Internal safety check completed.',
  });
  check(
    'work note appended as type work_note',
    (workNote.body?.activityStream || []).some((a) => a.type === 'work_note' && /safety check/.test(a.text))
  );
  const comment = await post(`/api/requests/${crisis.body._id}/notes`, {
    type: 'comment',
    author: 'Student Care Team',
    text: 'We have a counselor ready to see you.',
  });
  check(
    'public comment appended as type comment',
    (comment.body?.activityStream || []).some((a) => a.type === 'comment' && /counselor ready/.test(a.text))
  );
  check('empty note -> 400', (await post(`/api/requests/${crisis.body._id}/notes`, { text: '' })).status === 400);

  // -------------------------------------------------------------- escalation
  console.log('\nPOST /api/requests/:id/escalate — expedites the SLA target for real');
  const targetBefore = new Date(reassigned.body.slaTarget).getTime();
  const escalated = await post(`/api/requests/${academic.body._id}/escalate`);
  const targetAfter = new Date(escalated.body.slaTarget).getTime();
  check('escalation raises the tier', escalated.body?.escalationLevel >= 1);
  check('escalation forces High urgency', escalated.body?.urgency === 'High');
  check('escalation does not loosen the SLA target', targetAfter <= targetBefore, `${targetBefore} -> ${targetAfter}`);
  check(
    'escalation log states the real before -> after',
    (escalated.body?.activityStream || []).some((a) => /SLA target expedited from|already inside the one-hour expedited window/.test(a.text))
  );
  const earlyEscalation = await post(`/api/requests/${academic.body._id}/escalate`);
  check(
    'a second escalation is honest that the target did not change',
    (earlyEscalation.body?.activityStream || []).some((a) => /unchanged/.test(a.text))
  );

  // -------------------------------------------------------------- deflection
  console.log('\nKnowledge Base deflection');
  const search = await api(`/api/requests/deflection?q=${encodeURIComponent('I am out of food and hungry')}&category=Housing`);
  check('deflection search returns articles', Array.isArray(search.body?.articles) && search.body.articles.length > 0);
  check('deflection total starts at zero', search.body?.deflectedTotal === 0, `got ${search.body?.deflectedTotal}`);

  const articleId = search.body.articles[0].id;
  const recorded = await post('/api/requests/deflection/deflect', { articleId });
  check('deflect records an event', recorded.body?.deflectedCount === 1, `got ${recorded.body?.deflectedCount}`);
  const afterDeflect = await api('/api/requests/deflection?q=food');
  check('deflection count is persisted', afterDeflect.body?.deflectedTotal === 1);

  // --------------------------------------------------------------- dashboard
  console.log('\nGET /api/dashboard');
  const dash = (await api('/api/dashboard')).body;
  check('byAssignmentGroup has all 4 groups', dash?.byAssignmentGroup && Object.keys(dash.byAssignmentGroup).length === 4);
  check('byUrgency has 3 levels', dash?.byUrgency && Object.keys(dash.byUrgency).length === 3);
  check('byImpact has 3 levels', dash?.byImpact && Object.keys(dash.byImpact).length === 3);
  check('byPriority has 4 levels', dash?.byPriority && Object.keys(dash.byPriority).length === 4);
  check('byStatus has 4 statuses', dash?.byStatus && Object.keys(dash.byStatus).length === 4);
  check('total counts 4 smoke Cases', dash?.total === 4, `got ${dash?.total}`);
  check('deflectedCount is 1', dash?.deflectedCount === 1, `got ${dash?.deflectedCount}`);
  check('deflectionRate is derived (20%)', dash?.deflectionRate === 20, `got ${dash?.deflectionRate}%`);
  check('slaComplianceRate is 100 with no breaches', dash?.slaComplianceRate === 100, `got ${dash?.slaComplianceRate}%`);
  check('topDeflectedArticles reflects the real event', dash?.topDeflectedArticles?.[0]?.articleId === articleId);
  check('deflectionTrend is 7 days', dash?.deflectionTrend?.length === 7);
  check('caseTrend is 7 days', dash?.caseTrend?.length === 7);
  check('hoursSaved is a number, not a fallback', typeof dash?.hoursSaved === 'number' && dash.hoursSaved > 0);
  check('no undefined KPI values', Object.values(dash || {}).every((v) => v !== undefined && v !== null));

  // ------------------------------------------------------------------- rules
  console.log('\nGET /api/rules — configuration and provenance');
  const rules = await api('/api/rules');
  check('rules load (200)', rules.status === 200);
  check('unmodified on a fresh database', rules.body?.meta?.isModified === false);
  check('active config matches the built-in winner', JSON.stringify(rules.body?.active) === JSON.stringify(rules.body?.builtIn));
  check('shipped config scores 30/36', rules.body?.builtInScore?.exact === 30, `got ${rules.body?.builtInScore?.exact}`);
  check('shipped config has 100% High recall', rules.body?.builtInScore?.highRecallPct === 100);
  check('config carries the assignmentRule mapping', !!rules.body?.active?.assignmentRule);
  check('config carries the priorityMatrix', !!rules.body?.active?.priorityMatrix);
  check('keyword count reported', rules.body?.meta?.keywordCount === 30, `got ${rules.body?.meta?.keywordCount}`);

  console.log('\nPOST /api/rules/preview — decision without persisting a Case');
  const preview = await post('/api/rules/preview', {
    category: 'Housing',
    description: 'I have been evicted and I am homeless with nowhere to sleep',
  });
  check('preview returns a decision', preview.status === 200);
  check('preview routes to the configured group', preview.body?.assignmentGroup === 'Peer Support');
  check('preview reports High urgency', preview.body?.urgency === 'High');
  check('preview reports an SLA window', preview.body?.slaHours === 2);
  check('preview reports derived priority', preview.body?.priority === 1, `got P${preview.body?.priority}`);
  check('preview lists matched keywords', (preview.body?.matchedKeywords || []).length > 0);
  check('preview does not create a Case', (await api('/api/requests?group=All')).body.length === 4);
  check('preview with unknown category -> 400', (await post('/api/rules/preview', { category: 'Nope', description: 'hi' })).status === 400);
  check('preview with no description -> 400', (await post('/api/rules/preview', { category: 'Academic' })).status === 400);

  console.log('\nPUT /api/rules — validation protects the vocabulary');
  const invalid = structuredClone(rules.body.active);
  invalid.assignmentRule.Academic = 'Department of Vibes';
  const rejected = await put('/api/rules', { config: invalid });
  check('invalid assignmentGroup -> 400', rejected.status === 400, `got ${rejected.status}`);
  check('400 response lists the errors', Array.isArray(rejected.body?.errors) && rejected.body.errors.length > 0);

  const badThresholds = structuredClone(rules.body.active);
  badThresholds.thresholds = { high: 1, medium: 4 };
  check('inverted thresholds -> 400', (await put('/api/rules', { config: badThresholds })).status === 400);

  console.log('\nPUT /api/rules — a saved change actually re-routes');
  const rerouted = structuredClone(rules.body.active);
  rerouted.assignmentRule.Academic = 'Peer Support';
  const saved = await put('/api/rules', { config: rerouted });
  check('valid config saved (200)', saved.status === 200, `got ${saved.status}`);
  check('meta now reports the config as modified', saved.body?.meta?.isModified === true);

  const reroutedCase = await createCase('Smoke Reroute', 'Academic', 'I need help planning my classes');
  check(
    'new Academic Case routes to the edited group',
    reroutedCase.body?.assignmentGroup === 'Peer Support',
    `got ${reroutedCase.body?.assignmentGroup}`
  );

  const broken = structuredClone(rules.body.active);
  for (const keyword of ['suicide', 'kill myself', 'self harm', 'hurt myself', 'cant go on']) {
    broken.keywords[keyword] = 0;
  }
  const brokenScore = await put('/api/rules', { config: broken });
  check(
    'zeroing crisis keywords lowers the measured score',
    brokenScore.body?.activeScore?.exact < 30,
    `got ${brokenScore.body?.activeScore?.exact}`
  );
  check(
    'zeroing crisis keywords lowers High recall',
    brokenScore.body?.activeScore?.highRecallPct < 100,
    `got ${brokenScore.body?.activeScore?.highRecallPct}%`
  );

  console.log('\nPOST /api/rules/reset — restore the winner');
  const restored = await post('/api/rules/reset');
  check('reset restores the backtest winner', restored.body?.activeScore?.exact === 30);
  check('reset clears the modified flag', restored.body?.meta?.isModified === false);
  const afterReset = await createCase('Smoke After Reset', 'Academic', 'I need help planning my classes');
  check(
    'routing returns to the winner mapping',
    afterReset.body?.assignmentGroup === 'Academic Advising',
    `got ${afterReset.body?.assignmentGroup}`
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
} catch (err) {
  console.error('SMOKE ERROR:', err.message);
  process.exitCode = 1;
} finally {
  child.kill('SIGTERM');
  await sleep(300);
  child.kill('SIGKILL');
}
