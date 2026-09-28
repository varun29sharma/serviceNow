/**
 * Triage sandbox — the Assignment Rule, running as you type.
 *
 * This is the landing page's centrepiece and its strongest claim. It does not
 * illustrate the engine or replay a recording: it imports the SAME modules the
 * Express API imports, and runs them on every keystroke.
 *
 *   triageRequest()            server/src/triage/triageRequest.js
 *   analyzeCaseIntent()        server/src/triage/nowAssistEngine.js
 *   deriveImpactAndPriority()  server/src/triage/priorityMatrix.js
 *
 * So when a visitor types "I have been having thoughts of suicide" and watches
 * the assignmentGroup node swing to Counseling, the SLA node drop from 72h to
 * 2h, the priority cell move to P1 and the trigger chip `#suicide` appear — that
 * is the production routing decision, not a mock-up. It is also the fastest
 * possible answer to "is the keyword matching working?": the matched triggers are
 * on screen before anyone logs in or submits anything.
 *
 * Everything is local and synchronous, so it works identically in live mode and
 * in the offline engine. No network, no model, no debounce — 30 keyword regexes
 * against a few hundred characters is microseconds, and instant feedback is what
 * makes the thing feel alive.
 */
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { triageRequest } from '../../../server/src/triage/triageRequest.js';
import {
  analyzeCaseIntent,
  suggestedCategory,
} from '../../../server/src/triage/nowAssistEngine.js';
import {
  DEFAULT_PRIORITY_MATRIX,
  IMPACTS,
  URGENCY_KEYS,
  deriveImpactAndPriority,
  derivePriority,
  PRIORITY_SHORT,
} from '../../../server/src/triage/priorityMatrix.js';
import { SLA_HOURS } from '../../../server/src/constants.js';
import { useReducedMotion } from '../lib/motion.js';

/* ------------------------------------------------------------------ content */

const SCENARIOS = [
  {
    chip: '🚨 Crisis disclosure',
    category: 'Mental Health',
    description:
      'I have been having severe panic attacks every night and thoughts of suicide. I feel like I cannot go on.',
  },
  {
    chip: '🏠 Eviction tonight',
    category: 'Housing',
    description:
      'I got evicted yesterday and I am currently homeless with no safe place to sleep tonight.',
  },
  {
    chip: '💳 Tuition final notice',
    category: 'Financial',
    description:
      'Got a final notice of class cancellation due to an overdue tuition balance and my aid did not disburse.',
  },
  {
    chip: '📚 Failing, might drop out',
    category: 'Academic',
    description:
      'I am failing two engineering classes, I am behind on assignments and I might drop out.',
  },
  {
    chip: '🖨️ Routine enquiry',
    category: 'Other',
    description: 'Where can I print posters for my student club next week?',
  },
];

const STATIONS = [
  {
    key: 'category',
    kicker: 'CATEGORY',
    read: 'What the student picked. This — not the words — chooses the owning team. The words then decide how urgent it is, so nothing here is hand-set.',
  },
  {
    key: 'rule',
    kicker: 'ASSIGNMENT RULE',
    read: 'Reads the description against 30 weighted trigger words and sums a score.',
  },
  {
    key: 'group',
    kicker: 'ASSIGNMENTGROUP',
    read: 'The owning team. Configurable in the Rules Console, never hardcoded per Case.',
  },
  {
    key: 'sla',
    kicker: 'SLA TARGET',
    read: 'High 2h · Medium 24h · Low 72h from intake, plus the derived priority.',
  },
];

const IDLE = {
  ready: false,
  urgency: null,
  assignmentGroup: null,
  matchedKeywords: [],
  slaHours: null,
  priority: null,
  impact: null,
  sentiment: null,
  crisisDetected: false,
  suggestedCategory: null,
};

/** Run the three real modules over one description. Pure. */
export function evaluateDescription(description, category) {
  const text = String(description || '').trim();
  if (text.length < 4) return { ...IDLE };

  const triage = triageRequest({ category, description: text });
  const analysis = analyzeCaseIntent(text, category);
  const { impact, priority } = deriveImpactAndPriority({
    category,
    urgency: triage.urgency,
    crisisDetected: analysis.crisisDetected,
  });

  return {
    ready: true,
    urgency: triage.urgency,
    assignmentGroup: triage.assignmentGroup,
    matchedKeywords: triage.matchedKeywords,
    score: triage.score,
    slaHours: SLA_HOURS[triage.urgency],
    priority,
    impact,
    sentiment: analysis.sentiment,
    crisisDetected: analysis.crisisDetected,
    // What the words read as. Never used to route — only to point out that the
    // typed story and the picked category disagree, which is the single most
    // confusing thing about this sandbox and about the real intake form.
    suggestedCategory: suggestedCategory(text, category),
  };
}

/* ------------------------------------------------------------------ component */

export default function TriageSandbox() {
  const navigate = useNavigate();
  const reduced = useReducedMotion();

  const [category, setCategory] = useState('Academic');
  const [text, setText] = useState('');
  const [openStation, setOpenStation] = useState(null);
  const [activeScenario, setActiveScenario] = useState(null);

  const textareaRef = useRef(null);
  const typingRef = useRef(null);

  // The engine runs on every keystroke. No effect, no debounce, no network.
  const result = useMemo(() => evaluateDescription(text, category), [text, category]);

  const stopTyping = useCallback(() => {
    if (typingRef.current) {
      clearInterval(typingRef.current);
      typingRef.current = null;
    }
  }, []);

  useEffect(() => stopTyping, [stopTyping]);

  /** Scenario chips type themselves in, so the demo narrates itself. */
  const playScenario = useCallback(
    (scenario) => {
      stopTyping();
      setActiveScenario(scenario.chip);
      setCategory(scenario.category);

      if (reduced) {
        setText(scenario.description);
        return;
      }

      setText('');
      let i = 0;
      typingRef.current = setInterval(() => {
        i += 4;
        if (i >= scenario.description.length) {
          setText(scenario.description);
          stopTyping();
          return;
        }
        setText(scenario.description.slice(0, i));
      }, 16);
    },
    [reduced, stopTyping]
  );

  /** Keyboard affordances: `/` to focus, Escape to clear. */
  useEffect(() => {
    function onKeyDown(event) {
      const tag = (event.target && event.target.tagName) || '';
      const typingElsewhere = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if (event.key === '/' && !typingElsewhere) {
        event.preventDefault();
        textareaRef.current?.focus();
      }
      if (event.key === 'Escape' && event.target === textareaRef.current) {
        stopTyping();
        setText('');
        setActiveScenario(null);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [stopTyping]);

  function handleManualEdit(value) {
    stopTyping();
    setActiveScenario(null);
    setText(value);
  }

  /** Hand the description to the real intake form rather than duplicating it. */
  function raiseThisCase() {
    navigate('/submit', {
      state: { studentAlias: '', category, description: text },
    });
  }

  const stationValues = {
    category,
    rule: result.ready
      ? result.matchedKeywords.length > 0
        ? `${result.matchedKeywords.length} trigger${result.matchedKeywords.length > 1 ? 's' : ''} · score ${result.score}`
        : 'no triggers · baseline'
      : 'waiting for words',
    group: result.ready ? result.assignmentGroup : '—',
    sla: result.ready ? `${result.slaHours}h · P${result.priority}` : '— · P—',
  };

  const stationTone = result.ready ? result.urgency : null;

  return (
    <div className="sandbox">
      <div className="sandbox-head">
        <div className="sandbox-head-text">
          <div className="sandbox-kicker">Live Assignment Rule sandbox</div>
          <h2 className="sandbox-title">Type a situation. Watch it route.</h2>
          <p className="sandbox-sub">
            This runs the real routing module — the same file the API imports — on every keystroke.
            Nothing is sent anywhere and no Case is created until you ask for one.
          </p>
        </div>
        <div className="sandbox-hint-keys">
          <kbd>/</kbd> to focus · <kbd>Esc</kbd> to clear
        </div>
      </div>

      <div className="sandbox-inputs">
        <label className="sandbox-field" htmlFor="sandbox-category">
          <span>Category</span>
          <select
            id="sandbox-category"
            value={category}
            onChange={(event) => {
              setActiveScenario(null);
              setCategory(event.target.value);
            }}
          >
            {['Mental Health', 'Academic', 'Financial', 'Housing', 'Other'].map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="sandbox-field sandbox-field-grow" htmlFor="sandbox-text">
          <span>What is happening?</span>
          <textarea
            id="sandbox-text"
            ref={textareaRef}
            rows={3}
            value={text}
            placeholder="e.g. I am failing two classes and I am behind on everything…"
            onChange={(event) => handleManualEdit(event.target.value)}
          />
        </label>
      </div>

      <div className="sandbox-scenarios">
        <span className="sandbox-scenarios-label">Try:</span>
        {SCENARIOS.map((scenario) => (
          <button
            key={scenario.chip}
            type="button"
            className={`sandbox-scenario${activeScenario === scenario.chip ? ' active' : ''}`}
            onClick={() => playScenario(scenario)}
          >
            {scenario.chip}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------ interactive flow */}
      <div className="sandbox-flow">
        <svg viewBox="0 0 860 120" className="sandbox-flow-svg" role="img" aria-label="Routing decision">
          <defs>
            <linearGradient id="sandboxRail" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="var(--signal)" stopOpacity={result.ready ? '0.85' : '0.15'} />
              <stop offset="1" stopColor="var(--signal)" stopOpacity={result.ready ? '0.85' : '0.15'} />
            </linearGradient>
          </defs>

          <path
            d="M 110 46 H 750"
            fill="none"
            stroke={result.ready ? 'url(#sandboxRail)' : 'var(--line-2)'}
            strokeWidth="1.5"
            className="sandbox-rail"
          />

          {[
            { ...STATIONS[0], x: 110 },
            { ...STATIONS[1], x: 323 },
            { ...STATIONS[2], x: 536 },
            { ...STATIONS[3], x: 750 },
          ].map((station, index) => {
            const isOpen = openStation === station.key;
            const isLive = index === 2 && result.ready;
            return (
              <g
                key={station.key}
                className={`sandbox-station${isOpen ? ' open' : ''}${isLive ? ' live' : ''}`}
                onClick={() => setOpenStation(isOpen ? null : station.key)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setOpenStation(isOpen ? null : station.key);
                  }
                }}
                aria-label={`${station.kicker}: ${stationValues[station.key]}`}
              >
                <rect
                  className={`sandbox-station-box${isLive && stationTone ? ` urgency-${stationTone}` : ''}`}
                  x={station.x - 92}
                  y={20}
                  width={184}
                  height={52}
                  rx={6}
                />
                <circle cx={station.x} cy={46} r={4} className="sandbox-station-dot" />
                <text x={station.x - 82} y={40} className="sandbox-station-kicker">
                  {station.kicker}
                </text>
                <text x={station.x - 82} y={59} className="sandbox-station-value">
                  {truncate(stationValues[station.key], 24)}
                </text>
              </g>
            );
          })}
        </svg>

        {openStation && (
          <div className="sandbox-station-detail">
            <strong>{STATIONS.find((s) => s.key === openStation).kicker}</strong>
            <span>{STATIONS.find((s) => s.key === openStation).read}</span>
            {openStation === 'group' && result.ready && (
              <button
                type="button"
                className="ghost-sm"
                onClick={() => navigate(`/queue/${encodeURIComponent(result.assignmentGroup)}`)}
              >
                Open this queue →
              </button>
            )}
            {openStation === 'sla' && (
              <button type="button" className="ghost-sm" onClick={() => navigate('/dashboard')}>
                See SLA adherence →
              </button>
            )}
            {openStation === 'rule' && (
              <button type="button" className="ghost-sm" onClick={() => navigate('/rules')}>
                Edit the rule →
              </button>
            )}
            {openStation === 'category' && (
              <button type="button" className="ghost-sm" onClick={() => navigate('/submit')}>
                Raise a real Case →
              </button>
            )}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------- readout */}
      <div className="sandbox-readout" aria-live="polite">
        {result.ready ? (
          <>
            <div className="sandbox-metrics">
              <div className="sandbox-metric">
                <dt>assignmentGroup</dt>
                <dd className="sandbox-metric-strong">{result.assignmentGroup}</dd>
              </div>
              <div className="sandbox-metric">
                <dt>urgency</dt>
                <dd>
                  <span className={`badge badge-${result.urgency}`}>
                    <span className="badge-dot" />
                    {result.urgency}
                  </span>
                </dd>
              </div>
              <div className="sandbox-metric">
                <dt>SLA target</dt>
                <dd className="sandbox-metric-strong">{result.slaHours}h</dd>
              </div>
              <div className="sandbox-metric">
                <dt>priority</dt>
                <dd>
                  <span className="badge badge-priority" data-pri={result.priority}>
                    {PRIORITY_SHORT[result.priority]}
                  </span>
                </dd>
              </div>
              <div className="sandbox-metric">
                <dt>sentiment</dt>
                <dd className="sandbox-metric-strong">{result.sentiment}</dd>
              </div>
            </div>

            <div className="sandbox-triggers">
              <span className="sandbox-triggers-label">Matched triggers</span>
              {result.matchedKeywords.length > 0 ? (
                result.matchedKeywords.map((keyword) => (
                  <span className="trigger-chip" key={keyword}>
                    #{keyword}
                  </span>
                ))
              ) : (
                <span className="sandbox-triggers-none">
                  none — urgency stays at the category baseline
                </span>
              )}
            </div>

            {/* The honest catch: the words decide urgency, the pick decides the
                team. When they disagree, say so instead of letting the visitor
                conclude the router is broken. */}
            {result.suggestedCategory && result.suggestedCategory !== category && (
              <div className="sandbox-nudge">
                <span>
                  <strong>Your words read as {result.suggestedCategory}.</strong> The Assignment Rule
                  routes on the category the student files under — not on the words — so this Case went
                  to <strong>{result.assignmentGroup}</strong>. The triggers still raised the urgency.
                </span>
                <button
                  type="button"
                  className="ghost-sm"
                  onClick={() => {
                    setActiveScenario(null);
                    setCategory(result.suggestedCategory);
                  }}
                >
                  File it as {result.suggestedCategory} →
                </button>
              </div>
            )}

            {result.crisisDetected && (
              <div className="sandbox-crisis">
                <strong>Safety protocol.</strong> Crisis language detected — this Case would raise a
                Crisis Sentinel alert, force High impact and open the 2-hour window. If you are in
                crisis right now, call or text <a href="tel:988">988</a>.
              </div>
            )}

            <div className="sandbox-actions">
              <button type="button" className="btn-primary-large" onClick={raiseThisCase}>
                Raise this Case →
              </button>
              <span className="hint">
                Carries your words to the real intake form. Impact <strong>{result.impact}</strong> ×
                urgency <strong>{result.urgency}</strong> → <strong>P{result.priority}</strong>.
              </span>
            </div>

            {/* Priority is a LOOKUP, never a choice — show the grid it came from. */}
            <div className="sandbox-matrix-wrap">
              <div className="sandbox-matrix-label">
                Priority is looked up in the impact × urgency matrix — never set by hand
              </div>
              <div className="priority-matrix sandbox-matrix">
                <div className="pm-axis" />
                {URGENCY_KEYS.map((urgency) => (
                  <div key={urgency} className="pm-axis">
                    {urgency}
                  </div>
                ))}
                {IMPACTS.map((impact) => (
                  <Fragment key={impact}>
                    <div className="pm-axis">{impact}</div>
                    {URGENCY_KEYS.map((urgency) => {
                      const value = derivePriority(impact, urgency, DEFAULT_PRIORITY_MATRIX);
                      const isActive = result.impact === impact && result.urgency === urgency;
                      return (
                        <div
                          key={`${impact}-${urgency}`}
                          className={`pm-cell sandbox-matrix-cell${isActive ? ' active' : ''}`}
                          data-pri={value}
                        >
                          {PRIORITY_SHORT[value]}
                        </div>
                      );
                    })}
                  </Fragment>
                ))}
              </div>
            </div>
          </>
        ) : (
          <p className="sandbox-idle">
            Start typing — the decision appears immediately, with the trigger words that caused it.
          </p>
        )}
      </div>
    </div>
  );
}

function truncate(value, max) {
  const text = String(value ?? '—');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
