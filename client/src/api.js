/**
 * Shared API layer.
 *
 * Every function dispatches to either the live Express API or the in-browser
 * demo. The offline engine is the primary stage surface, so the rule console,
 * the deflection loop and the priority matrix must all work with no server at
 * all — that parity is a hard requirement, not a nice-to-have.
 *
 * Which backend is used is decided per call, from the connection store in
 * lib/connection.js. That store probes /api/health once at boot and falls back
 * to the offline engine when nothing answers, so by the time any of these
 * functions run the mode is settled and truthful.
 */
import * as demo from './demoApi.js';
import { API_BASE, isOfflineEngine, reconnect } from './lib/connection.js';

// Re-exported for the components that report connection state in the topbar.
export { API_BASE, reconnect };

export const CATEGORIES = ['Mental Health', 'Academic', 'Financial', 'Housing', 'Other'];
export const ASSIGNMENT_GROUPS = ['Counseling', 'Academic Advising', 'Financial Aid', 'Peer Support'];
export const URGENCIES = ['Low', 'Medium', 'High'];
export const STATUSES = ['New', 'Assigned', 'In Progress', 'Resolved'];

/**
 * True when the in-browser engine is serving this call.
 *
 * Kept under the historical name because it is referenced from several
 * components; the decision itself now lives in lib/connection.js.
 */
export const isDemoMode = isOfflineEngine;

const useDemo = () => isOfflineEngine();

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch {
    throw new Error(
      `Lost the connection to the TriageNow API at ${API_BASE} mid-session. ` +
        `Reconnect from the topbar, or keep working against the offline engine.`
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    if (data.errors) err.validation = data.errors;
    throw err;
  }
  return data;
}

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

/** POST /api/requests — create a Case. Returns the routed Case. */
export function createCase({ studentAlias, category, description }) {
  if (useDemo()) return demo.createCase({ studentAlias, category, description });
  return request('/api/requests', {
    method: 'POST',
    body: JSON.stringify({ studentAlias, category, description }),
  });
}

/** GET /api/requests/:id — one Case. */
export function getCase(id) {
  if (useDemo()) return demo.getCase(id);
  return request(`/api/requests/${id}`);
}

/** GET /api/requests?group=X — one assignmentGroup's queue. */
export function listCasesByGroup(group) {
  if (useDemo()) return demo.listCasesByGroup(group);
  return request(`/api/requests?group=${encodeURIComponent(group)}`);
}

/** PATCH /api/requests/:id — status, assignee, impact override, or notes. */
export function updateCaseStatus(id, updatePayload) {
  if (useDemo()) return demo.updateCaseStatus(id, updatePayload);
  const body = typeof updatePayload === 'object' ? updatePayload : { status: updatePayload };
  return request(`/api/requests/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

/** POST /api/requests/:id/notes — append a Work Note or public Comment. */
export function addCaseNote(id, { type = 'work_note', author = 'Staff Agent', text }) {
  if (useDemo()) return demo.addCaseNote(id, { type, author, text });
  return request(`/api/requests/${id}/notes`, {
    method: 'POST',
    body: JSON.stringify({ type, author, text }),
  });
}

/** POST /api/requests/:id/escalate — expedite the Case and raise its tier. */
export function escalateCase(id) {
  if (useDemo()) return demo.escalateCase(id);
  return request(`/api/requests/${id}/escalate`, { method: 'POST' });
}

// ---------------------------------------------------------------------------
// Knowledge Base deflection
// ---------------------------------------------------------------------------

/** Search Knowledge Base articles for self-service deflection. */
export function searchDeflection(q, category) {
  if (useDemo()) return demo.searchDeflection(q, category);
  return request(
    `/api/requests/deflection?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}`
  );
}

/**
 * Record that an article solved the student's issue.
 *
 * Carries the article id so the dashboard leaderboard is derived from real
 * events rather than a hardcoded array.
 */
export function recordDeflection(articleId, category) {
  if (useDemo()) return demo.recordDeflection(articleId, category);
  return request('/api/requests/deflection/deflect', {
    method: 'POST',
    body: JSON.stringify({ articleId, category }),
  });
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

/** GET /api/dashboard — derived operational metrics. */
export function getDashboard() {
  if (useDemo()) return demo.getDashboard();
  return request('/api/dashboard');
}

// ---------------------------------------------------------------------------
// Assignment Rule configuration (the Rules Console)
// ---------------------------------------------------------------------------

/** GET /api/rules — active config, backtest winner, and both scores. */
export function getRules() {
  if (useDemo()) return demo.getRules();
  return request('/api/rules');
}

/** PUT /api/rules — validate and persist a new config. */
export function saveRules(config, updatedBy = 'System Administrator') {
  if (useDemo()) return demo.saveRules(config, updatedBy);
  return request('/api/rules', { method: 'PUT', body: JSON.stringify({ config, updatedBy }) });
}

/** POST /api/rules/reset — restore the backtest winner. */
export function resetRules() {
  if (useDemo()) return demo.resetRules();
  return request('/api/rules/reset', { method: 'POST' });
}

/**
 * POST /api/rules/preview — what would this description route to?
 *
 * `config` is an optional candidate config, so the Rules Console can test
 * unsaved edits. Never persisted.
 */
export function previewRule(category, description, config) {
  if (useDemo()) return demo.previewRule(category, description, config);
  return request('/api/rules/preview', {
    method: 'POST',
    body: JSON.stringify({ category, description, config }),
  });
}

// ---------------------------------------------------------------------------
// Live updates
// ---------------------------------------------------------------------------

/** Real-time SSE event listener (no-op in demo mode). */
export function subscribeToCaseEvents(callback) {
  if (useDemo()) return () => {};
  try {
    const source = new EventSource(`${API_BASE}/api/requests/stream`);
    source.addEventListener('case_created', (e) => {
      try {
        callback({ type: 'case_created', data: JSON.parse(e.data) });
      } catch {
        /* ignore malformed frame */
      }
    });
    source.addEventListener('case_updated', (e) => {
      try {
        callback({ type: 'case_updated', data: JSON.parse(e.data) });
      } catch {
        /* ignore malformed frame */
      }
    });
    return () => source.close();
  } catch {
    return () => {};
  }
}
