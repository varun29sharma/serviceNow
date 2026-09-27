/**
 * Design system gallery (#/design).
 *
 * Renders every token and every component in every state, in one place.
 *
 * Two reasons this exists rather than being a nice-to-have:
 *   1. It is the guardrail. Three people writing frontend against a written
 *      spec still drift; three people looking at the same rendered gallery do
 *      not. Every value here is read from the live CSS custom properties, so
 *      the gallery cannot quietly fall out of date with tokens.css.
 *   2. Reduced-motion and presentation mode are switchable here, so the whole
 *      team can verify those states without changing OS or projector settings.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  readPresentationMode,
  setPresentationMode,
  setReducedMotion,
  useReducedMotion,
} from '../lib/motion.js';
import { CountUp, DistributionBars, Sparkline } from '../lib/viz.jsx';
import RoutingFlow from '../components/RoutingFlow.jsx';
import PriorityMatrix from '../components/PriorityMatrix.jsx';
import SlaRing from '../components/SlaRing.jsx';
import ActivityTimeline from '../components/ActivityTimeline.jsx';
import { EmptyState, SkeletonList } from '../components/Skeleton.jsx';
import {
  ImpactBadge,
  PriorityBadge,
  SentimentBadge,
  SlaPill,
  StatusBadge,
  StudentAvatar,
  UrgencyBadge,
} from '../components/ui.jsx';

const COLOR_TOKENS = [
  ['--ink-950', 'Canvas'],
  ['--ink-900', 'Shell'],
  ['--ink-800', 'Panel'],
  ['--ink-700', 'Raised panel'],
  ['--signal', 'Signal'],
  ['--accent', 'Accent (serif voice)'],
  ['--urg-h', 'Urgency High'],
  ['--urg-m', 'Urgency Medium'],
  ['--urg-l', 'Urgency Low'],
  ['--st-new', 'New'],
  ['--st-assigned', 'Assigned'],
  ['--st-inprogress', 'In Progress'],
  ['--st-resolved', 'Resolved'],
  ['--snt-severe', 'Severe Crisis'],
  ['--snt-distressed', 'Distressed'],
  ['--snt-concerned', 'Concerned'],
  ['--snt-routine', 'Routine'],
  ['--pri-1', 'Priority 1'],
  ['--pri-2', 'Priority 2'],
  ['--pri-3', 'Priority 3'],
  ['--pri-4', 'Priority 4'],
];

const TYPE_ROWS = [
  ['Hero', '--t-hero', 700],
  ['Display', '--t-display', 750],
  ['Title', '--t-title', 700],
  ['Body large', '--t-body-lg', 400],
  ['Body', '--t-body', 400],
  ['Label', '--t-label', 600],
  ['Kicker', '--t-kicker', 800],
];

const SPACE_TOKENS = Array.from({ length: 10 }, (_, i) => `--s-${i + 1}`);
const RADII = ['--r-xs', '--r-sm', '--r-md', '--r-lg', '--r-xl', '--r-full'];
const ELEVATIONS = ['--e-1', '--e-2', '--e-3'];

const SAMPLE_TIMELINE = [
  { type: 'system', author: 'Automated Assignment Rule', text: 'Intake verified. Routed to Counseling with High urgency (SLA target 2h) and priority P1.', timestamp: '2026-09-27T09:02:00.000Z' },
  { type: 'work_note', author: 'Dr. Elena Vance, LCSW', text: 'Safety protocol verified. Called student, walk-in slot held for 14:00.', timestamp: '2026-09-27T09:14:00.000Z' },
  { type: 'comment', author: 'Dr. Elena Vance, LCSW', text: 'Hello Jordan, we have a counselor ready to see you today. Please check your phone.', timestamp: '2026-09-27T09:22:00.000Z' },
];

const SAMPLE_TREND = [3, 1, 4, 2, 6, 4, 7];

function readTokens(names) {
  if (typeof window === 'undefined') return {};
  const styles = getComputedStyle(document.documentElement);
  const out = {};
  for (const name of names) out[name] = styles.getPropertyValue(name).trim();
  return out;
}

export default function Design() {
  const reduced = useReducedMotion();
  const [presentation, setPresentation] = useState(readPresentationMode());
  const [replay, setReplay] = useState(0);
  const [tokens, setTokens] = useState({});

  const names = [
    ...COLOR_TOKENS.map(([name]) => name),
    ...TYPE_ROWS.map(([, name]) => name),
    ...SPACE_TOKENS,
    ...RADII,
    ...ELEVATIONS,
  ];

  const refresh = useCallback(() => setTokens(readTokens(names)), []);

  useEffect(() => {
    refresh();
  }, [refresh, presentation]);

  useEffect(() => {
    setPresentationMode(presentation);
  }, [presentation]);

  const token = (name) => tokens[name] || '';

  return (
    <div className="design-wrap">
      <div className="portal-head">
        <div className="portal-badge">Design system</div>
        <h1>Editorial case desk</h1>
        <p>
          Every token, component state and set piece in the build. Values are read live from the CSS
          custom properties, so this page cannot drift from{' '}
          <code style={{ fontFamily: 'var(--font-mono)' }}>tokens.css</code>. The written spec is in{' '}
          <code style={{ fontFamily: 'var(--font-mono)' }}>docs/DESIGN.md</code>.
        </p>
      </div>

      {/* ------------------------------------------------------------- toggles */}
      <div className="ds-section">
        <div className="card">
          <div className="card-subhead">Global modes</div>
          <div className="ds-row">
            <button
              type="button"
              className="presentation-btn"
              aria-pressed={presentation}
              onClick={() => setPresentation((on) => !on)}
            >
              {presentation ? '☀ Projector mode on' : '☾ Projector mode off'}
            </button>
            <button
              type="button"
              className="presentation-btn"
              aria-pressed={reduced}
              onClick={() => setReducedMotion(!reduced)}
            >
              {reduced ? '⏸ Reduced motion on' : '▶ Reduced motion off'}
            </button>
            <button type="button" className="secondary btn-sm" onClick={() => setReplay((n) => n + 1)}>
              ↻ Replay motion demos
            </button>
          </div>
          <div className="hint">
            Projector mode lifts every surface one luminance step for low-contrast rooms. Reduced
            motion collapses all durations and stops the ambient aura — it also follows the OS
            setting automatically.
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------- colours */}
      <div className="ds-section">
        <div className="section-kicker">Colour tokens</div>
        <div className="ds-swatches">
          {COLOR_TOKENS.map(([name, label]) => (
            <div className="ds-swatch-card" key={name}>
              <div className="ds-swatch-chip" style={{ background: token(name) }} />
              <div className="ds-swatch-meta">
                <div className="ds-swatch-name">{label}</div>
                <div className="ds-swatch-hex">
                  {name} · {token(name)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ----------------------------------------------------------- typography */}
      <div className="ds-section">
        <div className="section-kicker">Type scale</div>
        <div className="card ds-type-sample">
          {TYPE_ROWS.map(([label, name, weight]) => (
            <div className="ds-type-row" key={name}>
              <div className="ds-type-token">
                {name} · {token(name)}
              </div>
              <div style={{ fontSize: token(name), fontWeight: weight, lineHeight: 1.2 }}>
                Triage routes a Case
              </div>
            </div>
          ))}
          <div className="ds-type-row">
            <div className="ds-type-token">mono · tabular</div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--t-body)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              CS000042 · 01:58 left · 3f9a1c… 9a1c
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------- space / radii / depth */}
      <div className="ds-section">
        <div className="section-kicker">Space, radii and elevation</div>
        <div className="card">
          <div className="viz-stack">
            {SPACE_TOKENS.map((name) => (
              <div className="ds-row" key={name}>
                <span className="ds-type-token" style={{ width: 64 }}>
                  {name}
                </span>
                <span className="ds-space-bar" style={{ width: token(name) }} />
                <span className="ds-type-token">{token(name)}</span>
              </div>
            ))}

            <div className="ds-row" style={{ marginTop: 'var(--s-5)' }}>
              {RADII.map((name) => (
                <div
                  key={name}
                  style={{
                    width: 74,
                    height: 52,
                    borderRadius: token(name),
                    background: 'var(--ink-700)',
                    border: '1px solid var(--line-2)',
                    display: 'grid',
                    placeItems: 'center',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    color: 'var(--text-lo)',
                  }}
                >
                  {token(name)}
                </div>
              ))}
            </div>

            <div className="ds-row" style={{ marginTop: 'var(--s-5)', alignItems: 'stretch' }}>
              {ELEVATIONS.map((name) => (
                <div key={name} className="ds-elev" style={{ boxShadow: token(name), flex: '1 1 160px' }}>
                  {name}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------- components */}
      <div className="ds-section">
        <div className="section-kicker">Components</div>

        <div className="card">
          <div className="card-subhead">Buttons — rest, hover, focus ring, disabled, loading</div>
          <div className="ds-row">
            <button type="button" className="btn-primary-large">
              Primary action
            </button>
            <button type="button" className="secondary">
              Secondary
            </button>
            <button type="button" className="ghost">
              Ghost
            </button>
            <button type="button" className="btn-accent-sm">
              ⚡ Accent
            </button>
            <button type="button" className="btn-danger-outline">
              🚨 Danger
            </button>
            <button type="button" className="secondary" disabled>
              Disabled
            </button>
            <button type="button" className="secondary">
              <span className="skeleton" style={{ width: 60, height: 10, display: 'inline-block' }} />
            </button>
          </div>
          <div className="hint">
            Tab through these to see the designed focus ring — a 2px signal outline at 40% with a 2px
            offset, never the browser default.
          </div>
        </div>

        <div className="card" style={{ marginTop: 'var(--s-5)' }}>
          <div className="card-subhead">Badges — urgency, status, sentiment, priority, impact</div>
          <div className="ds-row">
            <UrgencyBadge urgency="High" pulse />
            <UrgencyBadge urgency="Medium" />
            <UrgencyBadge urgency="Low" />
            {['New', 'Assigned', 'In Progress', 'Resolved'].map((s) => (
              <StatusBadge key={s} status={s} />
            ))}
            {['Severe Crisis', 'Distressed', 'Concerned', 'Routine'].map((s) => (
              <SentimentBadge key={s} sentiment={s} />
            ))}
            {[1, 2, 3, 4].map((p) => (
              <PriorityBadge key={p} priority={p} />
            ))}
            {['High', 'Medium', 'Low'].map((i) => (
              <ImpactBadge key={i} impact={i} />
            ))}
          </div>
          <div className="ds-row" style={{ marginTop: 'var(--s-4)' }}>
            <StudentAvatar name="Jordan P." />
            <SlaPill slaTarget={new Date(Date.now() + 45 * 60000).toISOString()} status="New" />
            <SlaPill slaTarget={new Date(Date.now() - 90 * 60000).toISOString()} status="New" />
            <SlaPill slaTarget={new Date().toISOString()} status="Resolved" />
          </div>
        </div>

        <div className="card" style={{ marginTop: 'var(--s-5)' }}>
          <div className="card-subhead">Forms, notices, empty and loading</div>
          <div className="ds-row" style={{ alignItems: 'flex-start' }}>
            <div style={{ flex: '1 1 240px' }}>
              <label htmlFor="ds-input">Text input</label>
              <input id="ds-input" type="text" placeholder="Placeholder text" />
            </div>
            <div style={{ flex: '1 1 240px' }}>
              <label htmlFor="ds-select">Select</label>
              <select id="ds-select" defaultValue="Counseling">
                {['Counseling', 'Academic Advising', 'Financial Aid', 'Peer Support'].map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="ds-row" style={{ marginTop: 'var(--s-4)' }}>
            <div className="notice" style={{ flex: '1 1 200px' }}>
              Neutral notice
            </div>
            <div className="notice ok" style={{ flex: '1 1 200px' }}>
              ✓ Saved successfully
            </div>
            <div className="notice error" style={{ flex: '1 1 200px' }}>
              Something went wrong
            </div>
          </div>
          <div className="ds-row" style={{ marginTop: 'var(--s-4)', alignItems: 'stretch' }}>
            <div style={{ flex: '1 1 240px' }}>
              <SkeletonList rows={2} />
            </div>
            <div style={{ flex: '1 1 240px' }}>
              <EmptyState
                icon="📖"
                title="No matching articles yet"
                hint="Empty states name the surface and the next action."
              />
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------ set pieces */}
      <div className="ds-section">
        <div className="section-kicker">Set pieces</div>

        <div className="card">
          <div className="card-subhead">Routing flow — Category → Assignment Rule → assignmentGroup → SLA target</div>
          <RoutingFlow
            category="Mental Health"
            ruleValue="2 triggers"
            assignmentGroup="Counseling"
            urgency="High"
            slaHours={2}
            priority={1}
            travelKey={replay}
            caption="The token travels the rail on every routing decision."
          />
        </div>

        <div className="rules-grid" style={{ marginTop: 'var(--s-5)' }}>
          <div className="card">
            <div className="card-subhead">Priority matrix — impact × urgency</div>
            <PriorityMatrix
              impact="High"
              urgency="High"
              counts={{ 1: 3, 2: 4, 3: 1, 4: 5 }}
            />
            <div className="hint">
              The active Case is plotted with a pulsing marker. Click a row to override impact; the
              priority re-derives from the grid.
            </div>
          </div>

          <div className="card">
            <div className="card-subhead">SLA ring — safe, at risk, breached, met</div>
            <div className="viz-stack">
              <SlaRing slaTarget={new Date(Date.now() + 90 * 60000).toISOString()} urgency="High" status="New" />
              <SlaRing slaTarget={new Date(Date.now() + 40 * 60000).toISOString()} urgency="High" status="New" />
              <SlaRing slaTarget={new Date(Date.now() - 30 * 60000).toISOString()} urgency="High" status="New" />
              <SlaRing slaTarget={new Date(Date.now() - 60000).toISOString()} urgency="High" status="Resolved" />
            </div>
          </div>
        </div>

        <div className="rules-grid" style={{ marginTop: 'var(--s-5)' }}>
          <div className="card">
            <div className="card-subhead">Activity timeline — Work Notes vs Comments</div>
            <ActivityTimeline items={SAMPLE_TIMELINE} filter="all" />
          </div>

          <div className="card">
            <div className="card-subhead">Data visualisation — no charting library</div>
            <div className="viz-stack">
              <div>
                <div className="kpi-num">
                  <CountUp value={54} suffix="%" />
                </div>
                <div className="kpi-label">Knowledge deflection rate</div>
                <Sparkline data={SAMPLE_TREND} height={64} />
              </div>
              <DistributionBars
                rows={[
                  { label: 'High', value: 6, tone: 'High' },
                  { label: 'Medium', value: 2, tone: 'Medium' },
                  { label: 'Low', value: 5, tone: 'Low' },
                ]}
              />
              <div className="viz-legend">
                <span className="viz-legend-item">
                  <span className="viz-swatch signal" /> Deflections
                </span>
                <span className="viz-legend-item">
                  <span className="viz-swatch cyan" /> Cases raised
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------- motion */}
      <div className="ds-section">
        <div className="section-kicker">Motion — 120 / 200 / 320ms, one easing curve</div>
        <div className="card">
          <div className="card-subhead">Motion demos (respect reduced motion)</div>
          <div className="viz-stack" key={replay}>
            <div className="ds-row">
              <span className="ds-type-token" style={{ width: 120 }}>
                rowIn · 320ms
              </span>
              <div className="card" style={{ animation: 'rowIn var(--dur-surface) var(--ease) both', flex: 1 }}>
                Panel entering
              </div>
            </div>
            <div className="ds-row">
              <span className="ds-type-token" style={{ width: 120 }}>
                liveFlash · 1.1s
              </span>
              <div
                className="timeline-item"
                style={{ animation: 'liveFlash 1.1s var(--ease)', flex: 1 }}
                data-kind="system"
              >
                Live update received
              </div>
            </div>
            <div className="ds-row">
              <span className="ds-type-token" style={{ width: 120 }}>
                breath · at risk
              </span>
              <span className="sla-pill at-risk">⚡ 41m left</span>
            </div>
          </div>
          <div className="hint">
            Motion encodes state change only: a Case updating, an SLA entering the at-risk window, a
            panel arriving. Nothing loops for decoration, and nothing exceeds 400ms.
          </div>
        </div>
      </div>
    </div>
  );
}
