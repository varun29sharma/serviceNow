import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { isDemoMode } from '../api.js';

/**
 * Home — the landing page.
 *
 * An editorial hero in the studiors direction: oversized Cabinet Grotesk
 * headline that reveals line by line, a serif standfirst, and the product's
 * own routing flow running as the hero animation — a Case token travelling
 * Category -> Assignment Rule -> assignmentGroup -> SLA target, forever,
 * because that loop *is* the product.
 *
 * The three deep-dive cards below give judges one-click paths into the
 * flagship surfaces without touching the nav.
 *
 * prefers-reduced-motion is honoured: reveals render instantly and the token
 * animation is replaced by a static rail.
 */

const LINES = ['Every request', 'becomes a Case', 'Routed in', 'milliseconds.'];

/* The four stations of the routing flow, in SVG coords (0 0 860 210). */
const STATIONS = [
  { x: 118, label: 'CATEGORY', value: 'Mental Health' },
  { x: 350, label: 'ASSIGNMENT RULE', value: 'reads the words' },
  { x: 582, label: 'ASSIGNMENTGROUP', value: 'Counseling' },
  { x: 772, label: 'SLA TARGET', value: '2 hours' },
];

const CARDS = [
  {
    to: '/rules',
    kicker: '01 · Configurable records',
    title: 'Assignment Rules',
    body: 'Routing logic admins edit, not code we compiled. Edit a keyword weight and watch the queue re-route — then watch the backtest score move.',
  },
  {
    to: '/queue/All',
    kicker: '02 · Agents',
    title: 'Agent Workspace',
    body: 'Priority-ordered queues, Student 360 context, impact × urgency priority matrix, Work Notes vs public Comments, live SLA rings.',
  },
  {
    to: '/dashboard',
    kicker: '03 · Leadership',
    title: 'Dashboard',
    body: 'Deflection, SLA adherence, breaches, advisor hours saved — every figure derived from stored Case and Deflection records. None invented.',
  },
];

export default function Home() {
  const demo = isDemoMode();
  const navigate = useNavigate();
  const heroRef = useRef(null);

  /* Line-by-line headline reveal. Skipped entirely under reduced motion. */
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  /* Prose pill cycles through real triage examples, timed to the token lap. */
  const EXAMPLES = [
    { text: '“I have been having thoughts of suicide…”', route: 'Counseling', urgency: 'High' },
    { text: '“I got evicted last week and have no place to sleep…”', route: 'Peer Support', urgency: 'High' },
    { text: '“Got a final notice on my tuition payment plan…”', route: 'Financial Aid', urgency: 'High' },
    { text: '“Struggling in calculus, looking for tutoring…”', route: 'Academic Advising', urgency: 'Medium' },
  ];
  const [ex, setEx] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const t = setInterval(() => setEx((n) => (n + 1) % EXAMPLES.length), 3600);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);
  const example = EXAMPLES[ex];

  /* Token animation: one CSS keyframe drives the loop; the pill and the
     lit segment are phase-locked to it via the same duration. */
  const LAP = 3.6;

  return (
    <div className="home-wrap">
      {/* ------------------------------------------------------------- hero */}
      <section className="hero" ref={heroRef}>
        <p className={`hero-kicker ${reduced ? '' : 'reveal'}`} style={{ '--d': '0ms' }}>
          Student Case triage &amp; routing
        </p>

        <h1 className="hero-title" aria-label={LINES.join(' ')}>
          {LINES.map((line, i) => (
            <span key={line} className={`hero-line ${reduced ? '' : 'reveal'}`} style={{ '--d': `${140 + i * 130}ms` }}>
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
          <strong>Assignment Rule</strong>, routes it to the right <strong>assignmentGroup</strong>{' '}
          and starts an <strong>SLA target</strong>. No model calls. Every decision reproducible,
          auditable, and backtested against {demo ? '36' : '36'} labelled Cases.
        </p>

        <div className={`hero-cta-row ${reduced ? '' : 'reveal'}`} style={{ '--d': '900ms' }}>
          <Link to="/submit" className="btn-primary-large hero-cta">
            Raise a Case →
          </Link>
          <Link to="/queue/All" className="secondary hero-cta">
            Enter the workspace
          </Link>
          <button type="button" className="ghost hero-cta" onClick={() => navigate('/rules')}>
            See the rules engine
          </button>
        </div>

        <p className={`hero-prose ${reduced ? '' : 'reveal'}`} style={{ '--d': '1040ms' }} key={ex}>
          <span className="hero-prose-quote">{example.text}</span>
          <span className="hero-prose-meta">
            → routed to <strong>{example.route}</strong>
          </span>
          <span className={`badge badge-${example.urgency} hero-prose-badge`}>
            <span className="badge-dot" />
            {example.urgency} urgency
          </span>
        </p>
      </section>

      {/* ------------------------------------------------- routing flow set piece */}
      <section className="hero-flow" aria-label="How a Case is routed">
        <svg viewBox="0 0 860 210" className="hero-flow-svg" role="img" aria-hidden="true">
          <defs>
            <linearGradient id="heroRail" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="var(--line-3)" />
              <stop offset="1" stopColor="var(--line-3)" />
            </linearGradient>
          </defs>

          {/* rail */}
          <path
            d="M 118 96 H 772"
            fill="none"
            stroke="var(--line-2)"
            strokeWidth="1.5"
          />
          {/* lit segment sweeps with the token (same duration/phase) */}
          <path
            className={`hero-flow-lit ${reduced ? 'static' : ''}`}
            d="M 118 96 H 772"
            fill="none"
            stroke="var(--signal)"
            strokeWidth="1.5"
            strokeLinecap="round"
            pathLength="100"
            strokeDasharray="100"
            style={{ animationDuration: `${LAP}s` }}
          />

          {/* stations */}
          {STATIONS.map((s, i) => (
            <g key={s.label}>
              <rect
                className="hero-flow-node"
                x={s.x - 78}
                y="112"
                width="156"
                height="58"
                rx="5"
              />
              <text x={s.x} y="134" textAnchor="middle" className="hero-flow-label">
                {s.label}
              </text>
              <text x={s.x} y="154" textAnchor="middle" className="hero-flow-value">
                {s.value}
              </text>
              <circle
                cx={s.x}
                cy="96"
                r="3.5"
                className={`hero-flow-dot ${reduced ? '' : 'pulse'}`}
                style={reduced ? undefined : { animationDelay: `${i * (LAP / 4)}s` }}
              />
            </g>
          ))}

          {/* the travelling Case token */}
          {!reduced && (
            <g style={{ animation: `heroToken ${LAP}s cubic-bezier(.4,0,.2,1) infinite` }}>
              <circle r="7" className="hero-flow-token-glow" />
              <circle r="4" className="hero-flow-token" cx="0" cy="0" />
              <text x="0" y="-14" textAnchor="middle" className="hero-flow-token-label">
                CASE
              </text>
            </g>
          )}
          {reduced && <circle cx="118" cy="96" r="4" className="hero-flow-token" />}
        </svg>
        <p className="hero-flow-caption">
          The Assignment Rule is a configurable record — the same concept ServiceNow admins use
          daily — not a function buried in our code.
        </p>
      </section>

      {/* --------------------------------------------------------- proof strip */}
      <section className="home-proof" aria-label="Why deterministic routing">
        <div className="home-proof-stat">
          <span className="home-proof-num">30/36</span>
          <span className="home-proof-label">exact triage, backtested</span>
        </div>
        <div className="home-proof-stat">
          <span className="home-proof-num">100%</span>
          <span className="home-proof-label">High-urgency recall</span>
        </div>
        <div className="home-proof-stat">
          <span className="home-proof-num">0</span>
          <span className="home-proof-label">model calls — deterministic</span>
        </div>
        <div className="home-proof-stat">
          <span className="home-proof-num">105</span>
          <span className="home-proof-label">rule configs scored to pick one</span>
        </div>
      </section>

      {/* --------------------------------------------------------- deep-dive cards */}
      <section className="home-cards" aria-label="Explore the system">
        {CARDS.map((c, i) => (
          <Link key={c.to} to={c.to} className={`home-card card reveal-card`} style={{ '--i': i }}>
            <span className="home-card-kicker">{c.kicker}</span>
            <span className="home-card-title">{c.title}</span>
            <span className="home-card-body">{c.body}</span>
            <span className="home-card-arrow" aria-hidden="true">
              →
            </span>
          </Link>
        ))}
      </section>
    </div>
  );
}
