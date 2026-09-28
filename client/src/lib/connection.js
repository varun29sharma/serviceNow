/**
 * Connection store — the ONE place that decides which backend the app talks to.
 *
 * Why this module exists
 * ---------------------
 * The previous build decided the backend from a `?demo=1` query string that it
 * latched into sessionStorage. Three things went wrong with that, all of them
 * visible in a demo:
 *
 *   1. A fresh tab (no query string) always started in LIVE mode, even when no
 *      server was running — so every page rendered a raw
 *      "Cannot reach the TriageNow API" error with no way out.
 *   2. The topbar badge reported *intent*, not reality: it read "🟢 Live API"
 *      while the API was down and the app was throwing connection errors.
 *   3. The latch lived in sessionStorage, so closing the tab silently reset the
 *      choice, and the single-file `file://` build — which can never reach
 *      http://localhost:4000 — also defaulted to live.
 *
 * The fix is to actually ask the API whether it is there, and then tell the
 * truth about the answer:
 *
 *   - `probeApi()` calls `GET /api/health` with a hard timeout.
 *   - `resolveMode()` (pure) turns {override, deep-link, healthOk} into a mode.
 *   - When the probe fails we FALL BACK to the in-browser engine automatically
 *     and say so in the topbar, with a Reconnect control that re-probes.
 *
 * Live mode means the API answered. Nothing else claims to be live.
 */

export const API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) ||
  'http://localhost:4000';

import { useEffect, useState } from 'react';

export const MODE = { LIVE: 'live', DEMO: 'demo' };

/** How long we wait for /api/health before declaring the API absent. */
export const PROBE_TIMEOUT_MS = 2500;

/** A user's explicit choice. localStorage, so it survives closing the tab. */
const MODE_KEY = 'triagenow.mode';

/** The old ?demo=1 latch, still honoured as a deep link. */
const LEGACY_DEMO_KEY = 'triagenow.demo.force';

// ---------------------------------------------------------------------------
// Pure decision functions — unit-tested without a DOM or a network
// ---------------------------------------------------------------------------

/**
 * resolveMode({ override, queryWantsDemo, healthOk, isFileProtocol })
 *
 * Precedence, highest first:
 *   1. An explicit user choice.
 *      - "demo" is always honoured.
 *      - "live" is honoured only if the API actually answered; a user asking
 *        for live when nothing is listening still gets a working app (offline
 *        engine + an honest "unreachable" badge), not an error page.
 *   2. A `?demo=1` deep link — an explicit request for the offline engine.
 *   3. The health probe.
 * A `file://` build can never reach a localhost server, so it never probes.
 */
export function resolveMode({
  override = null,
  queryWantsDemo = false,
  healthOk = false,
  isFileProtocol = false,
} = {}) {
  if (override === MODE.DEMO) return MODE.DEMO;
  if (override === MODE.LIVE) return healthOk ? MODE.LIVE : MODE.DEMO;
  if (queryWantsDemo) return MODE.DEMO;
  if (isFileProtocol) return MODE.DEMO;
  return healthOk ? MODE.LIVE : MODE.DEMO;
}

/**
 * Why the app is in the mode it is in — the badge wording depends on this.
 *   'override'   the user chose it from the toggle
 *   'deep-link'  ?demo=1
 *   'file'       the single-file build, which has no server to talk to
 *   'probe'      we asked the API and it answered
 *   'fallback'   we asked the API and it did NOT answer → offline engine
 */
export function resolveReason({
  override = null,
  queryWantsDemo = false,
  healthOk = false,
  isFileProtocol = false,
} = {}) {
  if (override === MODE.DEMO) return 'override';
  if (override === MODE.LIVE) return healthOk ? 'override' : 'fallback';
  if (queryWantsDemo) return 'deep-link';
  if (isFileProtocol) return 'file';
  return healthOk ? 'probe' : 'fallback';
}

/**
 * Do we already know the answer without a round trip?
 *
 * Only ever true for the OFFLINE routes: an explicit demo choice, a ?demo=1
 * deep link, or a file:// build. Asking for live always probes, so "live" can
 * never be assumed — which is the whole point of this module.
 */
export function resolvesWithoutProbe({ override = null, queryWantsDemo = false, isFileProtocol = false } = {}) {
  if (override === MODE.DEMO) return true;
  if (override === MODE.LIVE) return false;
  return Boolean(queryWantsDemo || isFileProtocol);
}

// ---------------------------------------------------------------------------
// Environment readers
// ---------------------------------------------------------------------------

export function isFileProtocol() {
  try {
    return typeof window !== 'undefined' && window.location.protocol === 'file:';
  } catch {
    return false;
  }
}

/** "?demo=1" in the search string OR the hash (the app uses HashRouter). */
export function queryWantsDemo() {
  try {
    const viaSearch = new URLSearchParams(window.location.search).get('demo') === '1';
    const viaHash =
      new URLSearchParams(window.location.hash.split('?')[1] || '').get('demo') === '1';
    const viaLatch = sessionStorage.getItem(LEGACY_DEMO_KEY) === '1';
    if (viaSearch || viaHash || viaLatch) {
      // Latch it, as before: HashRouter rewrites the hash on the first navigate
      // and would otherwise drop the deep link mid-flow.
      try {
        sessionStorage.setItem(LEGACY_DEMO_KEY, '1');
      } catch {
        /* storage unavailable */
      }
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function readOverride() {
  try {
    const value = localStorage.getItem(MODE_KEY);
    return value === MODE.LIVE || value === MODE.DEMO ? value : null;
  } catch {
    return null;
  }
}

export function writeOverride(mode) {
  try {
    if (mode === MODE.LIVE || mode === MODE.DEMO) localStorage.setItem(MODE_KEY, mode);
    else localStorage.removeItem(MODE_KEY);
  } catch {
    /* storage unavailable — the mode still applies for this session */
  }
}

// ---------------------------------------------------------------------------
// The probe
// ---------------------------------------------------------------------------

/** Does the API answer? Never throws; `false` means "not reachable". */
export async function probeApi({
  base = API_BASE,
  timeoutMs = PROBE_TIMEOUT_MS,
  fetchImpl,
} = {}) {
  const doFetch = fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
  if (!doFetch) return false;

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(() => {
    if (controller) controller.abort();
  }, timeoutMs);

  try {
    const res = await doFetch(`${base}/api/health`, {
      method: 'GET',
      cache: 'no-store',
      signal: controller ? controller.signal : undefined,
    });
    if (!res || !res.ok) return false;
    const body = await res.json().catch(() => null);
    // Confirm it is *our* API and not some unrelated thing on that port.
    return Boolean(body && body.ok === true);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const listeners = new Set();

/**
 * Synchronous current mode, read by every API call.
 *
 * Optimistic on first paint: an explicit choice or deep link is known without a
 * round trip; otherwise we assume live for the few milliseconds the probe takes.
 * `App` holds the boot screen until the probe settles, so no page ever mounts
 * against the wrong backend.
 */
let currentMode = MODE.LIVE;
let currentReason = 'probe';
let reachable = 'unknown'; // 'ok' | 'unreachable' | 'unknown'
let checked = false;

function emit() {
  const snapshot = getConnection();
  for (const listener of listeners) listener(snapshot);
}

function commit({ mode, reason, reach }) {
  const changed = mode !== currentMode || reason !== currentReason || reach !== reachable;
  currentMode = mode;
  currentReason = reason;
  reachable = reach;
  checked = true;
  if (changed) emit();
}

export function getConnection() {
  return { mode: currentMode, reason: currentReason, reachable, checked };
}

/** Synchronous — used by api.js on every call. */
export function isOfflineEngine() {
  return currentMode === MODE.DEMO;
}

export function subscribeConnection(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function inputsFromEnvironment() {
  return {
    override: readOverride(),
    queryWantsDemo: queryWantsDemo(),
    isFileProtocol: isFileProtocol(),
  };
}

async function runBoot() {
  const inputs = inputsFromEnvironment();

  if (resolvesWithoutProbe(inputs)) {
    // An explicit offline choice, a ?demo=1 deep link or a file:// build: the
    // answer is already known, so a wasted request here would be the most
    // visible kind.
    const reason = resolveReason(inputs);
    commit({ mode: MODE.DEMO, reason, reach: 'unknown' });
    return getConnection();
  }

  const healthOk = await probeApi();
  const resolved = { ...inputs, healthOk };
  commit({
    mode: resolveMode(resolved),
    reason: resolveReason(resolved),
    reach: healthOk ? 'ok' : 'unreachable',
  });
  return getConnection();
}

// React StrictMode mounts effects twice in development, which would otherwise
// mean two probes and two commits. The boot runs at most once per page load.
let bootPromise = null;

/**
 * Run the boot sequence once.
 *
 * Skips the probe entirely when the answer is already known (explicit offline
 * choice, ?demo=1 deep link, or a file:// build).
 */
export function initialiseConnection() {
  if (!bootPromise) bootPromise = runBoot();
  return bootPromise;
}

/**
 * Explicit user choice from the topbar. `live` still requires the API to
 * answer — asking for live with nothing listening resolves to the offline
 * engine plus an honest "unreachable" badge, never an error page.
 */
export async function chooseMode(mode) {
  writeOverride(mode);

  if (mode === MODE.DEMO) {
    commit({ mode: MODE.DEMO, reason: 'override', reach: getConnection().reachable });
    return getConnection();
  }

  const healthOk = await probeApi();
  const resolved = { ...inputsFromEnvironment(), override: MODE.LIVE, healthOk };
  commit({
    mode: resolveMode(resolved),
    reason: resolveReason(resolved),
    reach: healthOk ? 'ok' : 'unreachable',
  });
  return getConnection();
}

/**
 * Re-probe (the Reconnect control).
 *
 * Ignores a stale `?demo=1` deep link — asking to reconnect means "try to go
 * live" — but still respects an explicit offline choice.
 */
export async function reconnect() {
  const healthOk = await probeApi();
  const resolved = {
    override: readOverride(),
    queryWantsDemo: false,
    isFileProtocol: isFileProtocol(),
    healthOk,
  };
  commit({
    mode: resolveMode(resolved),
    reason: resolveReason(resolved),
    reach: healthOk ? 'ok' : 'unreachable',
  });
  return getConnection();
}

/** Test seam — reset the store between cases. */
export function __resetConnectionForTests() {
  currentMode = MODE.LIVE;
  currentReason = 'probe';
  reachable = 'unknown';
  checked = false;
  bootPromise = null;
  listeners.clear();
}

/**
 * React binding for the shell.
 *
 * `checked: false` means the boot probe has not settled yet — the shell holds a
 * brief boot screen so that no page ever mounts against the wrong backend and
 * then has to re-fetch after the fallback.
 */
export function useConnection() {
  const [state, setState] = useState(getConnection);

  useEffect(() => {
    let alive = true;
    const unsubscribe = subscribeConnection((snapshot) => {
      if (alive) setState(snapshot);
    });
    if (!getConnection().checked) {
      initialiseConnection().then((next) => {
        if (alive) setState(next);
      });
    }
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  return state;
}

/**
 * The plain-language state of the connection, used by the topbar badge and the
 * fallback banner. Kept here rather than in the component so the wording is
 * unit-testable.
 */
export function describeConnection({ mode, reason, reachable: reach } = {}) {
  if (mode === MODE.LIVE) {
    return {
      tone: 'live',
      short: '🟢 Live API',
      title: `Connected to the TriageNow API at ${API_BASE}`,
      detail: null,
    };
  }

  if (reach === 'unreachable') {
    return {
      tone: 'warning',
      short: '🟠 API unreachable · offline',
      title: `No API answered at ${API_BASE} — using the in-browser engine instead`,
      detail:
        `No API answered at ${API_BASE}, so TriageNow switched to its in-browser engine. ` +
        'Routing, the priority matrix and the backtest all still run — same shared modules, ' +
        'seeded data, no network.',
    };
  }

  if (reason === 'file') {
    return {
      tone: 'demo',
      short: '🟡 Offline engine',
      title: 'Standalone single-file build — no server to talk to',
      detail:
        'This is the standalone single-file build, so the in-browser engine is the only ' +
        'backend available. Everything works; nothing is sent anywhere.',
    };
  }

  if (reason === 'deep-link') {
    return {
      tone: 'demo',
      short: '🟡 Offline engine',
      title: 'Offline engine requested with ?demo=1',
      detail:
        'Offline engine active: the Assignment Rule, priority matrix and backtest scoring run ' +
        'in the browser against 13 seeded Cases and a 7-day deflection history. No server, no network.',
    };
  }

  return {
    tone: 'demo',
    short: '🟡 Offline engine',
    title: 'Running the in-browser engine against seeded data',
    detail:
      'Offline engine active: the Assignment Rule, priority matrix and backtest scoring run in ' +
      'the browser against 13 seeded Cases and a 7-day deflection history. No server, no network.',
  };
}
