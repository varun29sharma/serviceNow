import { useEffect, useState } from 'react';
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';

import Submit from './pages/Submit.jsx';
import Status from './pages/Status.jsx';
import Queue from './pages/Queue.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Rules from './pages/Rules.jsx';
import Design from './pages/Design.jsx';

import Aura from './components/Aura.jsx';
import { isDemoMode } from './api.js';
import { resetDemoData } from './demoApi.js';
import { useLiveUrgency } from './lib/liveStatus.js';
import { readPresentationMode, setPresentationMode } from './lib/motion.js';

/**
 * Pitch guide.
 *
 * Rewritten to say only what the build can prove. Every figure here is one the
 * app computes, and every claim matches what the code does — this is a
 * deterministic rules engine, not a model, and the backtest numbers are the
 * ones the harness prints.
 */
function PitchGuide({ onClose }) {
  return (
    <div className="pitch-cheat-modal" onClick={onClose}>
      <div className="pitch-cheat-inner card" onClick={(e) => e.stopPropagation()}>
        <div className="pitch-cheat-header">
          <h3>🏆 Pitch flow</h3>
          <button className="ghost-sm" type="button" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="pitch-cheat-steps">
          <div className="step-point">
            <strong>1. The premise.</strong> Students in distress email five inboxes or suffer in
            silence; staff manually triage crisis alongside parking questions. Every request becomes
            a <em>Case</em> the moment it is written.
          </div>

          <div className="step-point">
            <strong>2. Student Portal.</strong> Click a scenario, then submit. The student never
            picks a priority — the <em>Assignment Rule</em> reads the description, routes to an{' '}
            <em>assignmentGroup</em>, and sets an <em>SLA target</em>. Point at the routing flow to
            show the decision path.
          </div>

          <div className="step-point">
            <strong>3. Assignment Rules.</strong> This is the ServiceNow concept admins use daily:
            rules are <em>configurable records, not code</em>. Change a keyword weight and the queue
            re-routes live. Then show the evidence — our shipped config is the winner of{' '}
            <em>105 configs scored against 36 labelled Cases</em>: 30/36 exact, 100% High-urgency
            recall. Zero the crisis keywords and watch recall fall to 77%. Revert.
          </div>

          <div className="step-point">
            <strong>4. Agent Workspace.</strong> Priority-ordered queue, Student 360 profile,
            impact × urgency <em>priority matrix</em>, Work Notes vs public Comments, guided
            playbook, SLA ring.
          </div>

          <div className="step-point">
            <strong>5. Leadership.</strong> Dashboard: 54% deflection, 77% SLA adherence, 3 Cases
            breached, 8.7 advisor hours saved this week. Every number is derived from stored records.
          </div>

          <div className="step-point">
            <strong>The line that lands.</strong> <em>"We did not route a suicide disclosure through
            a language model."</em> Routing is deterministic, reproducible and auditable — which is
            the only defensible design for safety-critical triage. That is why it can be backtested,
            and why we can show you the accuracy of the rule the system is actually running.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const demo = isDemoMode();
  const navigate = useNavigate();
  const [guideOpen, setGuideOpen] = useState(false);
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
              Student Portal
            </NavLink>
            <NavLink to="/queue/All">Agent Workspace</NavLink>
            <NavLink to="/dashboard">Dashboard</NavLink>
            <NavLink to="/rules">Assignment Rules</NavLink>
            <NavLink to="/design">Design System</NavLink>

            <button
              type="button"
              className="pitch-guide-btn"
              onClick={() => setGuideOpen(true)}
            >
              🎯 Pitch guide
            </button>

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

      {guideOpen && <PitchGuide onClose={() => setGuideOpen(false)} />}

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
          <Route path="/" element={<Submit />} />
          <Route path="/status/:id" element={<Status />} />
          <Route path="/queue/:group" element={<Queue />} />
          <Route path="/queue" element={<Queue />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/rules" element={<Rules />} />
          <Route path="/design" element={<Design />} />
          <Route path="*" element={<Submit />} />
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
