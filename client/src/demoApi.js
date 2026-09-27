/**
 * Demo mode — the full product running in the browser against sessionStorage.
 *
 * Offline demo mode is the PRIMARY stage surface, so this is not a cut-down
 * mock: it implements every operation the live API does, using the same
 * imported modules the server uses. That is why the parity test exists —
 * anything the server can do and this cannot is a hole in the demo, and the
 * demo is what the judges watch.
 *
 * Shared with the server (and therefore guaranteed consistent):
 *   - server/src/seedCases.js            one seed builder for both backends
 *   - server/src/triage/triageRequest.js the Assignment Rule
 *   - server/src/rules/ruleSchema.js     config defaults + validation
 *   - server/src/rules/backtestScorePure.js  config scoring
 *   - client/src/lib/backtestCases.generated.js  the labelled set
 */
import { triageRequest } from '../../server/src/triage/triageRequest.js';
import { SLA_HOURS, STATUSES, ASSIGNMENT_GROUPS, CATEGORIES } from '../../server/src/constants.js';
import {
  analyzeCaseIntent,
  findDeflectionArticles,
  KNOWLEDGE_BASE,
} from '../../server/src/triage/nowAssistEngine.js';
import {
  deriveImpactAndPriority,
  derivePriority,
} from '../../server/src/triage/priorityMatrix.js';
import {
  buildSeedCases,
  buildSeedDeflections,
  demoHexId,
  DEFLECTION_MINUTES,
} from '../../server/src/seedCases.js';
import { builtInConfig, validateConfig, configMeta } from '../../server/src/rules/ruleSchema.js';
import { scoreCases } from '../../server/src/rules/backtestScorePure.js';
import { BACKTEST_CASES } from './lib/backtestCases.generated.js';

const CASES_KEY = 'triagenow.demo.cases.v3';
const DEFLECT_KEY = 'triagenow.demo.deflections.v3';
const RULES_KEY = 'triagenow.demo.rules.v3';
const MINUTES_SAVED_PER_TRIAGE = 9;
const WEEKS_PER_YEAR = 52;

// --- storage helpers --------------------------------------------------------

function readJson(key, fallback) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — the session still works, just not across reloads */
  }
}

const iso = (date) => new Date(date).toISOString();

function randomHex(length = 32) {
  return Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

// --- state ------------------------------------------------------------------

function allCases() {
  const stored = readJson(CASES_KEY, null);
  if (stored) return stored;
  const seeded = buildSeedCases({ withIds: true });
  writeJson(CASES_KEY, seeded);
  return seeded;
}

function saveCases(cases) {
  writeJson(CASES_KEY, cases);
}

function allDeflections() {
  const stored = readJson(DEFLECT_KEY, null);
  if (stored) return stored;
  const seeded = buildSeedDeflections({});
  writeJson(DEFLECT_KEY, seeded);
  return seeded;
}

function getActiveRules() {
  const stored = readJson(RULES_KEY, null);
  if (stored && validateConfig(stored).length === 0) return stored;
  return builtInConfig();
}

function summarize(metrics) {
  return {
    exact: metrics.exact,
    n: metrics.n,
    exactPct: metrics.exactPct,
    highRecallPct: metrics.highRecallPct,
    highPrecisionPct: metrics.highPrecisionPct,
    withinOnePct: metrics.withinOnePct,
    score: Number(metrics.score.toFixed(1)),
    misses: metrics.misses,
  };
}

function rulesResponse(active) {
  const builtIn = builtInConfig();
  return {
    active,
    builtIn,
    meta: configMeta(active),
    activeScore: summarize(scoreCases(BACKTEST_CASES, active)),
    builtInScore: summarize(scoreCases(BACKTEST_CASES, builtIn)),
  };
}

/**
 * isDemoMode — checked per call, not once at import.
 *
 * Demo mode is detected from `?demo=1` (in the search string or the hash) and
 * then LATCHED into sessionStorage.
 *
 * The latch is essential, not an optimisation. `?demo=1` lives in the hash
 * because the app uses HashRouter, and any internal navigation rewrites the
 * hash without it — so after the very first `navigate()` (submitting a Case
 * does exactly that) the query string is gone. Without the latch the app
 * silently falls back to the live API mid-flow and, offline, throws
 * "Cannot reach the TriageNow API" on the student's own status screen. That is
 * a demo-ending bug on stage, so the flag is written the moment demo mode is
 * first seen.
 *
 * Toggling the mode badge removes the flag, which is the way back to live.
 */
export function isDemoMode() {
  try {
    if (sessionStorage.getItem('triagenow.demo.force') === '1') return true;

    const viaQuery =
      new URLSearchParams(window.location.search).get('demo') === '1' ||
      new URLSearchParams(window.location.hash.split('?')[1] || '').get('demo') === '1';

    if (viaQuery) {
      sessionStorage.setItem('triagenow.demo.force', '1');
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// --- Cases ------------------------------------------------------------------

export function createCase({ studentAlias, category, description }) {
  const config = getActiveRules();
  const triage = triageRequest({ category, description: String(description) }, config);
  const analysis = analyzeCaseIntent(description, category);
  const { impact, priority } = deriveImpactAndPriority(
    { category, urgency: triage.urgency, crisisDetected: analysis.crisisDetected },
    config.priorityMatrix
  );

  const now = new Date();
  const createdAt = iso(now);
  const slaTarget = iso(now.getTime() + SLA_HOURS[triage.urgency] * 3600e3);

  const activityStream = [
    {
      type: 'system',
      author: 'Automated Assignment Rule',
      text:
        `Intake verified. Routed to ${triage.assignmentGroup} with ${triage.urgency} urgency ` +
        `(SLA target ${SLA_HOURS[triage.urgency]}h) and priority P${priority} ` +
        `(impact ${impact} x urgency ${triage.urgency}).`,
      timestamp: createdAt,
    },
  ];

  if (analysis.crisisDetected) {
    activityStream.push({
      type: 'system',
      author: 'Crisis Sentinel Alert',
      text: 'SAFETY PROTOCOL ENGAGED: Severe crisis language detected. On-call crisis clinician notified.',
      timestamp: createdAt,
    });
  }

  const doc = {
    // 24-char hex so the Case number and sys_id render exactly as they do for
    // a server-generated Case.
    _id: demoHexId(Math.floor(Math.random() * 0xffff)),
    studentAlias: String(studentAlias).trim(),
    category,
    description: String(description).trim(),
    urgency: triage.urgency,
    impact,
    priority,
    assignmentGroup: triage.assignmentGroup,
    status: 'New',
    createdAt,
    updatedAt: createdAt,
    slaTarget,
    sentiment: analysis.sentiment,
    intent: analysis.intent,
    confidence: analysis.confidence,
    matchedKeywords: triage.matchedKeywords,
    assignedTo: 'Unassigned',
    escalationLevel: analysis.crisisDetected ? 1 : 0,
    snSysId: randomHex(32),
    studentProfile: {
      gpa: /failing|probation/i.test(description) ? '2.18' : triage.urgency === 'High' ? '3.12' : '3.65',
      year: 'Junior',
      program: 'Undergraduate Studies',
      priorCasesCount: triage.urgency === 'High' ? 1 : 0,
      riskTier: analysis.crisisDetected ? 'Critical' : triage.urgency === 'High' ? 'Elevated' : 'Standard',
    },
    activityStream,
  };

  saveCases([doc, ...allCases()]);
  return Promise.resolve(doc);
}

export function getCase(id) {
  const found = allCases().find((c) => c._id === id);
  return found ? Promise.resolve({ ...found }) : Promise.reject(new Error('Case not found'));
}

export function listCasesByGroup(group) {
  if (group !== 'All' && !ASSIGNMENT_GROUPS.includes(group)) {
    return Promise.reject(
      new Error(`group query param must be one of: ${ASSIGNMENT_GROUPS.join(', ')} or All`)
    );
  }
  const rank = { High: 2, Medium: 1, Low: 0 };
  const cases = allCases();
  const rows = (group === 'All' ? cases : cases.filter((c) => c.assignmentGroup === group))
    .slice()
    .sort(
      (a, b) =>
        (a.priority ?? 4) - (b.priority ?? 4) ||
        (rank[b.urgency] ?? 0) - (rank[a.urgency] ?? 0) ||
        new Date(a.createdAt) - new Date(b.createdAt)
    );
  return Promise.resolve(rows);
}

function lookupPriority(impact, urgency, matrix) {
  const row = matrix && matrix[impact];
  const value = row && row[urgency];
  return typeof value === 'number' && value >= 1 && value <= 4 ? value : null;
}

export function updateCaseStatus(id, updatePayload) {
  const cases = allCases();
  const found = cases.find((c) => c._id === id);
  if (!found) return Promise.reject(new Error('Case not found'));

  const payload = typeof updatePayload === 'object' ? updatePayload : { status: updatePayload };
  const { status, assignedTo, workNote, comment, escalationLevel, impact, author } = payload;

  if (status && !STATUSES.includes(status)) {
    return Promise.reject(new Error(`status must be one of: ${STATUSES.join(', ')}`));
  }

  const now = iso(new Date());
  const config = getActiveRules();

  if (status && status !== found.status) {
    found.status = status;
    found.activityStream.push({
      type: 'system',
      author: author || 'Staff Agent',
      text: `Status changed to ${status}`,
      timestamp: now,
    });
  }

  if (assignedTo && assignedTo !== found.assignedTo) {
    found.assignedTo = assignedTo;
    found.activityStream.push({
      type: 'system',
      author: author || 'Supervisor',
      text: `Assigned to ${assignedTo}`,
      timestamp: now,
    });
  }

  // Agents override impact; priority re-derives from the matrix. Never both.
  if (impact && impact !== found.impact) {
    const previousImpact = found.impact;
    const previousPriority = found.priority;
    const lookedUp = lookupPriority(impact, found.urgency, config.priorityMatrix);
    found.impact = impact;
    if (lookedUp !== null) found.priority = lookedUp;
    found.activityStream.push({
      type: 'system',
      author: author || 'Staff Agent',
      text:
        `Impact overridden from ${previousImpact} to ${impact}. ` +
        `Priority re-derived from P${previousPriority} to P${found.priority} ` +
        `(impact ${impact} x urgency ${found.urgency}).`,
      timestamp: now,
    });
  }

  if (typeof escalationLevel === 'number') {
    found.escalationLevel = escalationLevel;
    found.activityStream.push({
      type: 'system',
      author: author || 'Staff Agent',
      text: `Escalation level set to Tier ${escalationLevel}`,
      timestamp: now,
    });
  }

  if (workNote && String(workNote).trim()) {
    found.activityStream.push({
      type: 'work_note',
      author: author || 'Staff Work Note',
      text: String(workNote).trim(),
      timestamp: now,
    });
  }

  if (comment && String(comment).trim()) {
    found.activityStream.push({
      type: 'comment',
      author: author || 'Student Care Team',
      text: String(comment).trim(),
      timestamp: now,
    });
  }

  found.updatedAt = now;
  saveCases(cases);
  return Promise.resolve({ ...found });
}

export function addCaseNote(id, { type = 'work_note', author = 'Staff Agent', text }) {
  const cases = allCases();
  const found = cases.find((c) => c._id === id);
  if (!found) return Promise.reject(new Error('Case not found'));

  const now = iso(new Date());
  found.activityStream.push({
    type: type === 'comment' ? 'comment' : 'work_note',
    author,
    text,
    timestamp: now,
  });
  found.updatedAt = now;
  saveCases(cases);
  return Promise.resolve({ ...found });
}

/**
 * Escalate — mirrors the server exactly, including the honest SLA log.
 *
 * The previous demo (and the server) logged "SLA target expedited" without
 * changing slaTarget. Now the target genuinely compresses to a one-hour window
 * and the note records the real before -> after (or says plainly that it was
 * already inside the window).
 */
export function escalateCase(id) {
  const cases = allCases();
  const found = cases.find((c) => c._id === id);
  if (!found) return Promise.reject(new Error('Case not found'));

  const config = getActiveRules();
  const now = new Date();
  const previousTarget = new Date(found.slaTarget);
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
  const expedited = oneHourFromNow < previousTarget ? oneHourFromNow : previousTarget;
  const changed = expedited.getTime() !== previousTarget.getTime();

  const previousUrgency = found.urgency;
  const previousPriority = found.priority;

  found.escalationLevel = Math.min(2, (found.escalationLevel || 0) + 1);
  found.urgency = 'High';
  found.slaTarget = iso(expedited);
  const rederived = lookupPriority(found.impact, 'High', config.priorityMatrix);
  if (rederived !== null) found.priority = rederived;

  const targetLine = changed
    ? `SLA target expedited from ${previousTarget.toISOString()} to ${expedited.toISOString()} (one-hour window).`
    : `SLA target already inside the one-hour expedited window (${previousTarget.toISOString()}) — unchanged.`;

  found.activityStream.push({
    type: 'system',
    author: 'Executive Escalation Protocol',
    text:
      `EMERGENCY ESCALATION: Case raised to Tier ${found.escalationLevel}. ` +
      `Urgency ${previousUrgency} -> High. Priority P${previousPriority} -> P${found.priority}. ` +
      `${targetLine} Dean of Students notified.`,
    timestamp: iso(now),
  });

  found.updatedAt = iso(now);
  saveCases(cases);
  return Promise.resolve({ ...found });
}

// --- Knowledge Base deflection ---------------------------------------------

export function searchDeflection(q, category) {
  return Promise.resolve({
    articles: findDeflectionArticles(q, category),
    deflectedTotal: allDeflections().length,
  });
}

export function recordDeflection(articleId, category) {
  const article = KNOWLEDGE_BASE.find((a) => a.id === articleId);
  const records = allDeflections();
  records.push({
    articleId: article ? article.id : 'KB-UNLINKED',
    articleTitle: article ? article.title : 'Knowledge Base article',
    category: category || (article && article.category) || 'Other',
    avoidedMinutes:
      article && article.urgency === 'High' ? DEFLECTION_MINUTES.High : DEFLECTION_MINUTES.Default,
    createdAt: iso(new Date()),
  });
  writeJson(DEFLECT_KEY, records);
  return Promise.resolve({ ok: true, deflectedCount: records.length });
}

// --- Assignment Rule console ------------------------------------------------

export function getRules() {
  return Promise.resolve(rulesResponse(getActiveRules()));
}

export function saveRules(config, updatedBy = 'System Administrator') {
  const errors = validateConfig(config);
  if (errors.length > 0) {
    const err = new Error(errors[0]);
    err.validation = errors;
    return Promise.reject(err);
  }
  writeJson(RULES_KEY, config);
  return Promise.resolve(rulesResponse(config));
}

export function resetRules() {
  const config = builtInConfig();
  writeJson(RULES_KEY, config);
  return Promise.resolve(rulesResponse(config));
}

export function previewRule(category, description, candidate) {
  if (!CATEGORIES.includes(category)) {
    return Promise.reject(new Error(`category must be one of: ${CATEGORIES.join(', ')}`));
  }
  if (!description || !String(description).trim()) {
    return Promise.reject(new Error('description is required'));
  }

  // A candidate config lets the console test UNSAVED edits. Nothing is
  // persisted here either way.
  let config = getActiveRules();
  if (candidate) {
    const errors = validateConfig(candidate);
    if (errors.length > 0) {
      const err = new Error(errors[0]);
      err.validation = errors;
      return Promise.reject(err);
    }
    config = candidate;
  }
  const triaged = triageRequest({ category, description: String(description) }, config);
  const analysis = analyzeCaseIntent(description, category);
  const { impact, priority } = deriveImpactAndPriority(
    { category, urgency: triaged.urgency, crisisDetected: analysis.crisisDetected },
    config.priorityMatrix
  );

  return Promise.resolve({
    assignmentGroup: triaged.assignmentGroup,
    urgency: triaged.urgency,
    matchedKeywords: triaged.matchedKeywords,
    score: triaged.score,
    impact,
    priority,
    sentiment: analysis.sentiment,
    intent: analysis.intent,
    confidence: analysis.confidence,
    crisisDetected: analysis.crisisDetected,
    slaHours: SLA_HOURS[triaged.urgency],
  });
}

// --- Analytics --------------------------------------------------------------

/** Day buckets for the last seven days, oldest first. */
function lastSevenDays(records, dateField = 'createdAt') {
  const days = [];
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;

  for (let i = 6; i >= 0; i -= 1) {
    const day = new Date(now.getTime() - i * dayMs);
    const key = day.toISOString().slice(0, 10);
    const label = day.toLocaleDateString('en-US', { weekday: 'short' });
    // Compare via Date so demo mode and the server bucket identically — the
    // server holds Date objects here while demo mode holds ISO strings.
    const count = records.filter((r) => {
      const value = r && r[dateField];
      if (!value) return false;
      return new Date(value).toISOString().slice(0, 10) === key;
    }).length;
    days.push({ date: key, label, count });
  }
  return days;
}

export function getDashboard() {
  const cases = allCases();
  const deflections = allDeflections();
  const now = new Date();
  const atRiskThreshold = new Date(now.getTime() + 60 * 60 * 1000);

  const countBy = (field, keys) => {
    const map = Object.fromEntries(keys.map((k) => [k, 0]));
    for (const c of cases) if (c[field] in map) map[c[field]] += 1;
    return map;
  };

  const overdue = cases.filter((c) => new Date(c.slaTarget) < now && c.status !== 'Resolved').length;
  const atRisk = cases.filter(
    (c) =>
      new Date(c.slaTarget) >= now &&
      new Date(c.slaTarget) <= atRiskThreshold &&
      c.status !== 'Resolved'
  ).length;

  const resolved = cases.filter((c) => c.status === 'Resolved');
  const avgResolutionHours =
    resolved.length > 0
      ? Number(
          (
            resolved.reduce(
              (n, c) => n + (new Date(c.updatedAt) - new Date(c.createdAt)) / 3600000,
              0
            ) / resolved.length
          ).toFixed(1)
        )
      : 0;

  const deflected = deflections.length;
  const deflectedMinutes = deflections.reduce((n, d) => n + (d.avoidedMinutes || 0), 0);
  const total = cases.length;
  const inbound = total + deflected;

  const articleTally = new Map();
  for (const d of deflections) {
    const current = articleTally.get(d.articleId) || {
      articleId: d.articleId,
      title: d.articleTitle || 'Knowledge Base article',
      category: d.category || 'Other',
      count: 0,
    };
    current.count += 1;
    articleTally.set(d.articleId, current);
  }
  const topDeflectedArticles = [...articleTally.values()]
    .sort((a, b) => b.count - a.count || a.articleId.localeCompare(b.articleId))
    .slice(0, 5);

  const hoursSaved = (total * MINUTES_SAVED_PER_TRIAGE + deflectedMinutes) / 60;

  return Promise.resolve({
    byAssignmentGroup: countBy('assignmentGroup', ASSIGNMENT_GROUPS),
    byUrgency: countBy('urgency', ['High', 'Medium', 'Low']),
    byStatus: countBy('status', STATUSES),
    bySentiment: countBy('sentiment', ['Severe Crisis', 'Distressed', 'Concerned', 'Routine']),
    byImpact: countBy('impact', ['High', 'Medium', 'Low']),
    byPriority: {
      1: cases.filter((c) => c.priority === 1).length,
      2: cases.filter((c) => c.priority === 2).length,
      3: cases.filter((c) => c.priority === 3).length,
      4: cases.filter((c) => c.priority === 4).length,
    },

    total,
    overdue,
    atRisk,
    crisisCount: cases.filter((c) => c.sentiment === 'Severe Crisis').length,
    unassignedCount: cases.filter((c) => c.assignedTo === 'Unassigned').length,
    resolvedCount: resolved.length,
    avgResolutionHours,

    deflectedCount: deflected,
    deflectionRate: inbound > 0 ? Math.round((deflected / inbound) * 100) : 0,
    slaComplianceRate: total > 0 ? Math.round(((total - overdue) / total) * 100) : 100,
    topDeflectedArticles,

    deflectionTrend: lastSevenDays(deflections),
    caseTrend: lastSevenDays(cases),

    hoursSaved: Number(hoursSaved.toFixed(1)),
    hoursSavedProjectedAnnual: Math.round(hoursSaved * WEEKS_PER_YEAR),
    minutesSavedPerTriage: MINUTES_SAVED_PER_TRIAGE,
    deflectedMinutes,

    generatedAt: now.toISOString(),
  });
}

// --- Demo lifecycle ---------------------------------------------------------

/** Wipe and re-seed demo state. Called by the "Reset demo data" control. */
export function resetDemoData() {
  try {
    sessionStorage.removeItem(CASES_KEY);
    sessionStorage.removeItem(DEFLECT_KEY);
    sessionStorage.removeItem(RULES_KEY);
  } catch {
    /* ignore */
  }
  writeJson(CASES_KEY, buildSeedCases({ withIds: true }));
  writeJson(DEFLECT_KEY, buildSeedDeflections({}));
}
