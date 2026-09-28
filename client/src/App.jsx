/**
 * App shell.
 *
 * Three jobs, and the third is new:
 *
 *   1. Render the role-aware navigation. The nav is now derived from the
 *      session, so a student never sees an "Assignment Rules" link and an
 *      anonymous visitor is never offered a queue. The previous build showed
 *      every staff surface to everyone.
 *   2. Report the connection HONESTLY. The badge reports whether the API
 *      actually answered, not which backend was requested. When the probe fails
 *      the app falls back to the in-browser engine and says so, with a
 *      Reconnect control — this is the fix for "the LIVE API isn't working".
 *   3. Hold a boot screen until that probe settles, so no page ever mounts
 *      against a backend that turns out not to exist.
 */
import { useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useNavigate } from 'react-router-dom';

import Home from './pages/Home.jsx';
import Submit from './pages/Submit.jsx';
import Status from './pages/Status.jsx';
import Queue from './pages/Queue.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Rules from './pages/Rules.jsx';
import StudentHome from './pages/StudentHome.jsx';
import NotFound from './pages/NotFound.jsx';
import LoginIndex from './pages/login/LoginIndex.jsx';
import StudentLogin from './pages/login/StudentLogin.jsx';
import MediatorLogin from './pages/login/MediatorLogin.jsx';
import ProviderLogin from './pages/login/ProviderLogin.jsx';

import Aura from './components/Aura.jsx';
import { useAuth } from './auth/AuthContext.jsx';
import RequireRole from './auth/RequireRole.jsx';
import { ROLE, ROLE_META } from './auth/roles.js';
import { resetDemoData } from './demoApi.js';
import { useLiveUrgency } from './lib/liveStatus.js';
import { readPresentationMode, setPresentationMode } from './lib/motion.js';
import {
  MODE,
  chooseMode,
  describeConnection,
  reconnect,
  useConnection,
} from './lib/connection.js';

/** The links each role is allowed to see. Derived, not filtered ad hoc. */
function navLinksFor(session) {
  if (!session) {
    return [
      { to: '/', label: 'Home', end: true },
      { to: '/submit', label: 'Raise a Case' },
      { to: '/login', label: 'Sign in' },
    ];
  }

  if (session.role === ROLE.STUDENT) {
    return [
      { to: '/', label: 'Home', end: true },
      { to: '/student', label: 'My Cases' },
      { to: '/submit', label: 'Raise a Case' },
    ];
  }

  if (session.role === ROLE.MEDIATOR) {
    return [
      { to: '/', label: 'Home', end: true },
      { to: '/queue/All', label: 'Agent Workspace' },
      { to: '/rules', label: 'Assignment Rules' },
      { to: '/dashboard', label: 'Dashboard' },
    ];
  }

  // Provider — scoped to one assignmentGroup, and no leadership analytics.
  return [
    { to: '/', label: 'Home', end: true },
    { to: `/queue/${encodeURIComponent(session.group || 'All')}`, label: `${session.group} queue` },
  ];
}

function BootScreen() {
  return (
    <div className="boot-screen">
      <div className="boot-mark">NOW</div>
      <div className="boot-text">
        Looking for the TriageNow API<span className="boot-dots" aria-hidden="true" />
      </div>
      <div className="boot-sub">
        If nothing answers, the in-browser engine takes over automatically — you will not be left on
        an error page.
      </div>
    </div>
  );
}

export default function App() {
  const navigate = useNavigate();
  const { session, logout, home } = useAuth();
  const connection = useConnection();
  const { mode, reachable } = connection;
  const offline = mode === MODE.DEMO;

  const [presentation, setPresentation] = useState(readPresentationMode());
  const [dismissedBanner, setDismissedBanner] = useState(false);
  const urgency = useLiveUrgency();

  useEffect(() => {
    setPresentationMode(presentation);
  }, [presentation]);

  const status = describeConnection(connection);
  const links = navLinksFor(session);

  if (!connection.checked) {
    return (
      <div className="app">
        <Aura urgency="None" live={false} />
        <BootScreen />
      </div>
    );
  }

  async function switchMode() {
    await chooseMode(offline ? MODE.LIVE : MODE.DEMO);
  }

  async function retryConnection() {
    setDismissedBanner(false);
    await reconnect();
  }

  return (
    <div className="app">
      <Aura urgency={urgency} live={urgency !== 'None'} />

      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            <span className="brand-mark">NOW</span>
            <div>
              <div className="brand-name">
                TriageNow <span className="brand-pill">OPS</span>
              </div>
              <div className="brand-sub">Student Case triage &amp; routing</div>
            </div>
          </div>

          <div className="topbar-center-status">
            <span className={`pulse-green-dot${offline ? ' dot-idle' : ''}`} />
            <span className="instance-text">
              Deterministic rules engine · no model calls ·{' '}
              {urgency === 'None' ? 'queue clear' : `peak urgency ${urgency}`}
            </span>
          </div>

          <nav className="nav">
            {links.map((link) => (
              <NavLink key={link.to} to={link.to} end={link.end}>
                {link.label}
              </NavLink>
            ))}

            {session && (
              <span className="session-chip" title={`Signed in as ${session.name}`}>
                <span className="session-chip-role">{ROLE_META[session.role]?.label}</span>
                <span className="session-chip-name">{session.name}</span>
                {session.group && <span className="session-chip-group">{session.group}</span>}
              </span>
            )}

            {session && (
              <button
                type="button"
                className="nav-action"
                onClick={() => {
                  logout();
                  navigate('/');
                }}
              >
                Sign out
              </button>
            )}

            <button
              type="button"
              className="presentation-btn"
              aria-pressed={presentation}
              title="Lifts every surface for low-contrast projectors"
              onClick={() => setPresentation((on) => !on)}
            >
              {presentation ? '☀ Projector' : '☾ Standard'}
            </button>

            <button
              type="button"
              className={`mode-badge mode-${status.tone}`}
              onClick={switchMode}
              title={`${status.title} — click to switch`}
            >
              {status.short}
            </button>
          </nav>
        </div>
      </header>

      {/* Connection banner: only when it is worth explaining something. */}
      {offline && !dismissedBanner && (
        <div className={`conn-banner conn-banner-${status.tone}`}>
          <span className="conn-banner-text">{status.detail}</span>
          <span className="conn-banner-actions">
            {reachable === 'unreachable' && (
              <button className="ghost conn-btn" type="button" onClick={retryConnection}>
                ↻ Reconnect
              </button>
            )}
            <button
              className="ghost conn-btn"
              type="button"
              onClick={() => {
                resetDemoData();
                window.location.reload();
              }}
            >
              Reset demo data
            </button>
            <button
              className="ghost conn-btn"
              type="button"
              onClick={() => setDismissedBanner(true)}
              aria-label="Dismiss connection notice"
            >
              ✕
            </button>
          </span>
        </div>
      )}

      <main className="main">
        <Routes>
          {/* Public */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<LoginIndex />} />
          <Route path="/login/student" element={<StudentLogin />} />
          <Route path="/login/mediator" element={<MediatorLogin />} />
          <Route path="/login/provider" element={<ProviderLogin />} />

          {/* Public on purpose: a person in crisis must never meet a login wall.
              The crisis-safety rule in Submit.jsx says a blocked form is the
              worst outcome, so intake stays open to everyone. */}
          <Route path="/submit" element={<Submit />} />
          <Route path="/status/:id" element={<Status />} />

          {/* Student-only */}
          <Route
            path="/student"
            element={
              <RequireRole allow={[ROLE.STUDENT]}>
                <StudentHome />
              </RequireRole>
            }
          />

          {/* Staff: mediator and providers */}
          <Route
            path="/queue"
            element={
              <RequireRole allow={[ROLE.MEDIATOR, ROLE.PROVIDER]}>
                <Queue />
              </RequireRole>
            }
          />
          <Route
            path="/queue/:group"
            element={
              <RequireRole allow={[ROLE.MEDIATOR, ROLE.PROVIDER]}>
                <Queue />
              </RequireRole>
            }
          />

          {/* Mediator only */}
          <Route
            path="/dashboard"
            element={
              <RequireRole allow={[ROLE.MEDIATOR]}>
                <Dashboard />
              </RequireRole>
            }
          />
          <Route
            path="/rules"
            element={
              <RequireRole allow={[ROLE.MEDIATOR]}>
                <Rules />
              </RequireRole>
            }
          />

          {/* A real 404, not a silent redirect to Home. */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <div>
            <strong>Case</strong> · <strong>assignmentGroup</strong> · <strong>Assignment Rule</strong> ·{' '}
            <strong>SLA target</strong> — routing logic as a configurable record, not compiled code.
          </div>
          <div className="footer-vocab">
            Statuses strictly: <code>New</code> · <code>Assigned</code> · <code>In Progress</code> ·{' '}
            <code>Resolved</code>
            {session ? (
              <>
                {' · '}
                <Link to={home}>My portal</Link>
              </>
            ) : (
              <>
                {' · '}
                <Link to="/login">Sign in</Link>
              </>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
