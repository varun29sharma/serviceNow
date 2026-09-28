/**
 * Home — the landing page.
 *
 * Editorial hero in the studiors direction: an oversized Cabinet Grotesk
 * headline that reveals line by line, a Zodiak standfirst, and then — instead of
 * an illustration OF the product — the product itself, running.
 *
 * Three things make this page interactive rather than decorative:
 *
 *   1. <TriageSandbox /> runs the real Assignment Rule on every keystroke. The
 *      visitor types, and the assignmentGroup, urgency, SLA target, priority and
 *      matched trigger words all move. This is the whole system in one widget,
 *      and it needs no login and no Case.
 *   2. <ScoreLab /> puts the backtest on a slider: drag a keyword weight and the
 *      measured accuracy of the rule moves with it. Same scoring module the CLI
 *      harness and the Rules Console use.
 *   3. The three role doors show what each sign-in actually unlocks, so the role
 *      model is legible before anyone commits to an account.
 *
 * prefers-reduced-motion is honoured throughout: reveals render instantly, the
 * sandbox's self-typing scenarios paste instead of typing, and the counters snap.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import TriageSandbox from '../components/TriageSandbox.jsx';
import { CountUp } from '../lib/viz.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { ROLE, ROLE_ORDER, ROLE_META, roleHome } from '../auth/roles.js';
import { builtInConfig } from '../../../server/src/rules/ruleSchema.js';
import { scoreCases } from '../../../server/src/rules/backtestScorePure.js';
import { BACKTEST_CASES } from '../lib/backtestCases.generated.js';

const LINES = ['Every request', 'becomes a Case', 'Routed in', 'milliseconds.'];

const ROLE_DOOR_COPY = {
  [ROLE.STUDENT]: {
    headline: 'I need help',
    body: 'Raise a Case in your own words. Track it, and see why it went where it went.',
    action: 'Student sign-in',
  },
  [ROLE.MEDIATOR]: {
    headline: 'I route the work',
    body: 'Every queue at once, the Assignment Rule console, escalation, and the numbers.',
    action: 'Mediator sign-in',
  },
  [ROLE.PROVIDER]: {
    headline: 'I answer the Cases',
    body: 'Your assignmentGroup’s queue with Student 360, the playbook and the SLA clock.',
    action: 'Provider sign-in',
  },
};

/** Keywords worth letting a visitor break, spanning all three weights. */
const LAB_KEYWORDS = [
  { keyword: 'suicide', label: 'suicide', note: 'weight 3 — crisis language' },
  { keyword: 'evicted', label: 'evicted', note: 'weight 2 — acute need' },
  { keyword: 'failing', label: 'failing', note: 'weight 1 — pressure signal' },
  { keyword: 'urgent', label: 'urgent', note: 'weight 1 — pressure signal' },
];

function ScoreLab() {
  const [keyword, setKeyword] = useState('suicide');
  const [weight, setWeight] = useState(3);
  const baseline = useMemo(() => builtInConfig(), []);
  const originalWeight = baseline.keywords[keyword] ?? 0;

  /**
   * The same scoring module the CLI harness (`npm run backtest`) and the Rules
   * Console use. Not a re-implementation — a re-use, which is the only reason
   * quoting the number here is honest.
   */
  const scored = useMemo(() => {
    const draft = {
      ...baseline,
      keywords: { ...baseline.keywords, [keyword]: weight },
    };
    return scoreCases(BACKTEST_CASES, draft);
  }, [baseline, keyword, weight]);

  const drift = weight - originalWeight;

  return (
    <div className="score-lab card">
      <div className="score-lab-head">
        <div>
          <div className="card-subhead">Break the rule, on purpose</div>
          <p className="score-lab-sub">
            Routing logic is a configurable record, not compiled code — so here is the record, on a
            slider. Every position is re-scored against 36 labelled Cases by the same module{' '}
            <code>npm run backtest</code> uses.
          </p>
        </div>
        <span className={`score-lab-drift${drift === 0 ? '' : drift > 0 ? ' up' : ' down'}`}>
          {drift === 0 ? 'unchanged' : `${drift > 0 ? '+' : ''}${drift} vs shipped`}
        </span>
      </div>

      <div className="score-lab-controls">
        <div className="score-lab-keywords">
          {LAB_KEYWORDS.map((option) => (
            <button
              key={option.keyword}
              type="button"
              className={`score-lab-keyword${keyword === option.keyword ? ' active' : ''}`}
              onClick={() => {
                setKeyword(option.keyword);
                setWeight(baseline.keywords[option.keyword] ?? 0);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>

        <label className="score-lab-slider" htmlFor="score-lab-weight">
          <span className="score-lab-slider-label">
            keyword weight <strong>{weight}</strong>
            <span className="score-lab-slider-note">
              {LAB_KEYWORDS.find((o) => o.keyword === keyword)?.note}
            </span>
          </span>
          <input
            id="score-lab-weight"
            type="range"
            min="0"
            max="3"
            step="1"
            value={weight}
            onChange={(e) => setWeight(Number(e.target.value))}
          />
          <span className="score-lab-slider-scale">
            <span>0 — ignored</span>
            <span>3 — crisis-tier</span>
          </span>
        </label>
      </div>

      <div className="score-lab-results">
        <div className="score-lab-result">
          <span className="score-lab-num">
            {scored.exact}/{scored.n}
          </span>
          <span className="score-lab-label">exact triage</span>
        </div>
        <div className="score-lab-result">
          <span className="score-lab-num">{scored.highRecallPct}%</span>
          <span className="score-lab-label">High-urgency recall</span>
        </div>
        <div className="score-lab-result">
          <span className="score-lab-num">{scored.highPrecisionPct}%</span>
          <span className="score-lab-label">High precision</span>
        </div>
        <div className="score-lab-result">
          <span className="score-lab-num">{scored.withinOnePct}%</span>
          <span className="score-lab-label">within one level</span>
        </div>
      </div>

      <div className="score-lab-verdict">
        {weight === 0 ? (
          <>
            <strong>Ignoring “{keyword}”.</strong> Missed crises get routed late — watch the recall
            column. That asymmetry is exactly why the weight is 3 in the shipped config.
          </>
        ) : weight > originalWeight ? (
          <>
            <strong>Over-weighting “{keyword}”.</strong> Extra recall here is bought with precision:
            Cases that are not crises start arriving as High.
          </>
        ) : weight < originalWeight ? (
          <>
            <strong>Under-weighting “{keyword}”.</strong> Fewer false alarms, more missed ones — the
            wrong trade for a triage desk.
          </>
        ) : (
          <>
            <strong>This is the shipped config.</strong> Move the slider to see what the backtest was
            actually choosing between.
          </>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const { session, home } = useAuth();
  const heroRef = useRef(null);

  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  const proof = [
    { value: 30, suffix: '/36', label: 'exact triage, backtested' },
    { value: 100, suffix: '%', label: 'High-urgency recall' },
    { value: 0, suffix: '', label: 'model calls — deterministic' },
    { value: 105, suffix: '', label: 'rule configs scored to pick one' },
  ];

  return (
    <div className="home-wrap">
      {/* ------------------------------------------------------------- hero */}
      <section className="hero" ref={heroRef}>
        <p className={`hero-kicker ${reduced ? '' : 'reveal'}`} style={{ '--d': '0ms' }}>
          Student Case triage &amp; routing
        </p>

        <h1 className="hero-title" aria-label={LINES.join(' ')}>
          {LINES.map((line, i) => (
            <span
              key={line}
              className={`hero-line ${reduced ? '' : 'reveal'}`}
              style={{ '--d': `${140 + i * 130}ms` }}
            >
              {line}
              {i === 1 && (
                <span className="hero-accent" aria-hidden="true">
                  .
                </span>
              )}
            </span>
          ))}
        </h1>

        <p className={`hero-standfirst ${reduced ? '' : 'reveal'}`} style={{ '--d': '760ms' }}>
          Students in distress email five inboxes — or suffer in silence. TriageNow turns every
          message into a <strong>Case</strong>, reads it with a deterministic{' '}
          <strong>Assignment Rule</strong>, routes it to the right <strong>assignmentGroup</strong> and
          starts an <strong>SLA target</strong>. No model calls. Every decision reproducible,
          auditable, and backtested against 36 labelled Cases.
        </p>

        <div className={`hero-cta-row ${reduced ? '' : 'reveal'}`} style={{ '--d': '900ms' }}>
          <Link to="/submit" className="btn-primary-large hero-cta">
            Raise a Case →
          </Link>
          {session ? (
            <Link to={home} className="secondary hero-cta">
              Back to my portal
            </Link>
          ) : (
            <Link to="/login" className="secondary hero-cta">
              Sign in by role
            </Link>
          )}
          <Link to="/queue/All" className="ghost hero-cta">
            Peek at the workspace
          </Link>
        </div>

        {/* ---- three doors: what each sign-in actually unlocks ---- */}
        <div className={`hero-doors ${reduced ? '' : 'reveal'}`} style={{ '--d': '1000ms' }}>
          {ROLE_ORDER.map((role) => {
            const copy = ROLE_DOOR_COPY[role];
            const meta = ROLE_META[role];
            const isMe = session?.role === role;
            return (
              <Link
                key={role}
                to={isMe ? roleHome(session) : meta.loginPath}
                className={`hero-door hero-door-${role}${isMe ? ' hero-door-current' : ''}`}
              >
                <span className="hero-door-headline">{copy.headline}</span>
                <span className="hero-door-body">{copy.body}</span>
                <span className="hero-door-action">
                  {isMe ? 'Continue →' : copy.action}
                  <span aria-hidden="true"> ↗</span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* -------------------------------------------------- the live sandbox */}
      <section className="home-section">
        <TriageSandbox />
      </section>

      {/* ------------------------------------------------------- proof strip */}
      <section className="home-proof" aria-label="Why deterministic routing">
        {proof.map((stat) => (
          <div className="home-proof-stat" key={stat.label}>
            <span className="home-proof-num">
              <CountUp value={stat.value} suffix={stat.suffix} /> 
            </span>
            <span className="home-proof-label">{stat.label}</span>
          </div>
        ))}
      </section>

      {/* ----------------------------------------------------------- score lab */}
      <section className="home-section">
        <ScoreLab />
      </section>

      {/* ----------------------------------------------------- deep-dive cards */}
      <section className="home-cards" aria-label="Explore the system">
        <Link to="/rules" className="home-card card reveal-card" style={{ '--i': 0 }}>
          <span className="home-card-kicker">01 · Configurable records</span>
          <span className="home-card-title">Assignment Rules</span>
          <span className="home-card-body">
            Routing logic admins edit, not code we compiled. Edit a keyword weight and watch the
            queue re-route — then watch the backtest score move.
          </span>
          <span className="home-card-arrow" aria-hidden="true">
            →
          </span>
        </Link>

        <Link to="/queue/All" className="home-card card reveal-card" style={{ '--i': 1 }}>
          <span className="home-card-kicker">02 · Agents</span>
          <span className="home-card-title">Agent Workspace</span>
          <span className="home-card-body">
            Priority-ordered queues, Student 360 context, the impact × urgency matrix, Work Notes vs
            public Comments, and live SLA rings.
          </span>
          <span className="home-card-arrow" aria-hidden="true">
            →
          </span>
        </Link>

        <Link to="/dashboard" className="home-card card reveal-card" style={{ '--i': 2 }}>
          <span className="home-card-kicker">03 · Leadership</span>
          <span className="home-card-title">Dashboard</span>
          <span className="home-card-body">
            Deflection, SLA adherence, breaches, advisor hours saved — every figure derived from
            stored Case and Deflection records. None invented.
          </span>
          <span className="home-card-arrow" aria-hidden="true">
            →
          </span>
        </Link>
      </section>
    </div>
  );
}
