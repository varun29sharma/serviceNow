/**
 * App — routing, the role-aware navigation, and the connection handshake.
 *
 * Four jobs:
 *
 *   1. Render the role-aware navigation. The nav is derived from the session,
 *      so a student never sees "Assignment Rules" and an anonymous visitor is
 *      never offered a queue.
 *   2. Report the connection HONESTLY — see lib/connection.js. The badge reports
 *      whether the API actually answered, not which backend was requested.
 *   3. Hold a boot screen until that probe settles, so no page ever mounts
 *      against a backend that turns out not to exist.
 *   4. Give the LANDING PAGE its own layout. `/` renders Home with no top bar,
 *      no sidebar and no footer; every other route is wrapped in <Shell />.
 *      That split is the whole point of the marketing surface — a nav bar over
 *      a hero is the fastest way to make a hero look like a dashboard.
 */
import { useEffect, useState } from 'react';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';

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
import Shell from './components/Shell.jsx';
import { useAuth } from './auth/AuthContext.jsx';
import RequireRole from './auth/RequireRole.jsx';
import { ROLE } from './auth/roles.js';
import { useConnection } from './lib/connection.js';
import { useLiveUrgency } from './lib/liveStatus.js';
import { readPresentationMode, setPresentationMode } from './lib/motion.js';

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
    {
      to: `/queue/${encodeURIComponent(session.group || 'All')}`,
      label: `${session.group} queue`,
    },
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
  const location = useLocation();
  const { session, logout } = useAuth();
  const connection = useConnection();
  const urgency = useLiveUrgency();

  const [presentation, setPresentation] = useState(readPresentationMode());

  useEffect(() => {
    setPresentationMode(presentation);
  }, [presentation]);

  if (!connection.checked) {
    return (
      <div className="app">
        <Aura urgency="None" live={false} />
        <BootScreen />
      </div>
    );
  }

  const links = navLinksFor(session);

  function signOut() {
    logout();
    navigate('/');
  }

  /**
   * The landing page is its own world. It renders outside <Shell />, with no
   * navigation column, no top strip and no footer — the only chrome it carries
   * is whatever it draws itself.
   */
  if (location.pathname === '/') {
    return (
      <div className="app app-bare">
        <Aura urgency={urgency} live={urgency !== 'None'} />
        <Home />
      </div>
    );
  }

  return (
    <div className="app">
      <Aura urgency={urgency} live={urgency !== 'None'} />
      <Shell
        links={links}
        session={session}
        onSignOut={signOut}
        presentation={presentation}
        setPresentation={setPresentation}
      >
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginIndex />} />
          <Route path="/login/student" element={<StudentLogin />} />
          <Route path="/login/mediator" element={<MediatorLogin />} />
          <Route path="/login/provider" element={<ProviderLogin />} />

          {/* Public on purpose: a person in crisis must never meet a login wall.
              Submit.jsx's crisis-safety rule says a blocked form is the worst
              outcome, so intake stays open to everyone. */}
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
      </Shell>
    </div>
  );
}
