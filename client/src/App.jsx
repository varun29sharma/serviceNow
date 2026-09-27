import { useEffect, useState } from 'react';
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';

import Home from './pages/Home.jsx';
import Submit from './pages/Submit.jsx';
import Status from './pages/Status.jsx';
import Queue from './pages/Queue.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Rules from './pages/Rules.jsx';

import Aura from './components/Aura.jsx';
import { isDemoMode } from './api.js';
import { resetDemoData } from './demoApi.js';
import { useLiveUrgency } from './lib/liveStatus.js';
import { readPresentationMode, setPresentationMode } from './lib/motion.js';

export default function App() {
  const demo = isDemoMode();
  const navigate = useNavigate();
  const [presentation, setPresentation] = useState(readPresentationMode());
  const urgency = useLiveUrgency();

  useEffect(() => {
    setPresentationMode(presentation);
  }, [presentation]);

  function toggleDemoMode() {
    const url = new URL(window.location.href);
    // The force flag survives a reload; the query string does not.
    try {
      if (demo) sessionStorage.removeItem('triagenow.demo.force');
      else sessionStorage.setItem('triagenow.demo.force', '1');
    } catch {
      /* storage unavailable */
    }
    url.searchParams.delete('demo');
    url.hash = demo ? '#/' : '#/?demo=1';
    window.location.href = url.toString();
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
            <span className="pulse-green-dot" />
            <span className="instance-text">
              Deterministic rules engine · no model calls · {urgency === 'None' ? 'queue clear' : `peak urgency ${urgency}`}
            </span>
          </div>

          <nav className="nav">
            <NavLink to="/" end>
              Home
            </NavLink>
            <NavLink to="/submit">Student Portal</NavLink>
            <NavLink to="/queue/All">Agent Workspace</NavLink>
            <NavLink to="/dashboard">Dashboard</NavLink>
            <NavLink to="/rules">Assignment Rules</NavLink>

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
              className={`mode-badge ${demo ? 'demo-active' : 'live-active'}`}
              onClick={toggleDemoMode}
              title="Switch between the Express API and the in-browser engine"
            >
              {demo ? '🟡 Offline engine' : '🟢 Live API'}
            </button>
          </nav>
        </div>
      </header>

      {demo && (
        <div className="demo-banner">
          <span>
            <strong>Offline engine active:</strong> the Assignment Rule, priority matrix and
            backtest scoring run in the browser against 13 seeded Cases and a 7-day deflection
            history. No server, no network.
          </span>
          <button
            className="ghost demo-reset"
            type="button"
            onClick={() => {
              resetDemoData();
              window.location.reload();
            }}
          >
            Reset demo data
          </button>
        </div>
      )}

      <main className="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/submit" element={<Submit />} />
          <Route path="/status/:id" element={<Status />} />
          <Route path="/queue/:group" element={<Queue />} />
          <Route path="/queue" element={<Queue />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/rules" element={<Rules />} />
          <Route path="*" element={<Home />} />
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
          </div>
        </div>
      </footer>
    </div>
  );
}
