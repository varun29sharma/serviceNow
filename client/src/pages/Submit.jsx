/**
 * Student Service Portal — Case intake.
 *
 * The student picks a category and describes their situation. They never pick
 * a priority: urgency, impact and priority are all derived by the Assignment
 * Rule, which is the product's core claim.
 *
 * Three behaviours sit on this screen:
 *   - crisis language raises an immediate support banner WITHOUT blocking
 *     submission (a blocked form is the worst possible outcome here)
 *   - verified Knowledge Base articles surface as the student types, so some
 *     requests are answered before they ever reach a counselor
 *   - the Assignment Rule runs in a LIVE PREVIEW beside the form, so the student
 *     watches their own words decide the urgency, the assignmentGroup, the SLA
 *     target and the matched trigger words before they submit anything.
 *
 * That preview is the answer to "is the keyword matching working?" — it used to
 * be invisible until after a Case existed, which made a working engine look like
 * a broken one.
 */
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  CATEGORIES,
  createCase,
  previewRule,
  searchDeflection,
  recordDeflection,
} from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { PriorityBadge, UrgencyBadge } from '../components/ui.jsx';
import { EmptyState, SkeletonBlock } from '../components/Skeleton.jsx';
// The crisis lexicon is shared with the routing engine so the banner the student
// sees and the crisisDetected flag the Case is routed on can never disagree.
import { detectCrisis } from '../../../server/src/triage/nowAssistEngine.js';

const DEMO_SCENARIOS = [
  {
    label: '🚨 Severe crisis (Mental Health)',
    alias: 'Jordan P.',
    category: 'Mental Health',
    description:
      'I have been having severe panic attacks every night and thoughts of suicide. I feel like I cannot go on and need help immediately.',
  },
  {
    label: '🏠 Emergency eviction (Housing)',
    alias: 'Morgan D.',
    category: 'Housing',
    description:
      'I got evicted yesterday and I am currently homeless with no safe place to sleep tonight. I am also completely out of food.',
  },
  {
    label: '💳 Final tuition notice (Financial)',
    alias: 'Casey T.',
    category: 'Financial',
    description:
      'Got a final notice of class cancellation due to overdue tuition balance. My financial aid has not disbursed and utilities are shut off.',
  },
  {
    label: '📚 Failing & probation (Academic)',
    alias: 'Alex K.',
    category: 'Academic',
    description:
      'I am failing two engineering classes and received an academic probation warning. I might drop out if I cannot get tutoring.',
  },
];

export default function Submit() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useAuth();
  // A signed-in student should not have to retype who they are.
  const [studentAlias, setStudentAlias] = useState(session?.alias || '');
  const [category, setCategory] = useState('Mental Health');
  const [description, setDescription] = useState('');

  // The home page's sandbox can hand its description over rather than making the
  // student retype it — one engine, demonstrated and then used for real.
  useEffect(() => {
    const handoff = location.state;
    if (!handoff || !handoff.description) return;
    if (handoff.category) setCategory(handoff.category);
    setDescription(handoff.description);
  }, [location.state]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [articles, setArticles] = useState([]);
  const [searching, setSearching] = useState(false);
  const [deflected, setDeflected] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const isCrisis = detectCrisis(description);

  // Debounced live preview of the ACTIVE Assignment Rule — the same config the
  // Rules Console edits, so the student sees the routing that will really happen.
  const [preview, setPreview] = useState(null);
  const [previewPending, setPreviewPending] = useState(false);

  useEffect(() => {
    const text = description.trim();
    if (text.length < 8) {
      setPreview(null);
      setPreviewPending(false);
      return undefined;
    }
    let alive = true;
    setPreviewPending(true);
    const timer = setTimeout(async () => {
      try {
        const result = await previewRule(category, text);
        if (alive) setPreview(result);
      } catch {
        // The connection banner already explains an unreachable API; a silent
        // preview is better than a second error inside the form.
        if (alive) setPreview(null);
      } finally {
        if (alive) setPreviewPending(false);
      }
    }, 240);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [description, category]);

  // Deflection search, debounced. Runs against the KB before a Case exists.
  useEffect(() => {
    if (!description || description.trim().length < 10) {
      setArticles([]);
      setSearching(false);
      return undefined;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await searchDeflection(description, category);
        setArticles(res.articles || []);
      } catch {
        setArticles([]);
      } finally {
        setSearching(false);
      }
    }, 280);
    return () => clearTimeout(timer);
  }, [description, category]);

  function loadScenario(scenario) {
    setStudentAlias(scenario.alias);
    setCategory(scenario.category);
    setDescription(scenario.description);
    setDeflected('');
    setError('');
  }

  async function handleDeflect(article) {
    try {
      await recordDeflection(article.id, article.category);
      setDeflected(article.title);
    } catch {
      setDeflected(article.title);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const created = await createCase({ studentAlias, category, description });
      navigate(`/status/${created._id}`);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="submit-page-wrap">
      <div className="portal-head">
        <div className="portal-badge">Student Service Portal</div>
        <h1>Get help &amp; raise a Case</h1>
        <p>
          Describe what is happening. The Assignment Rule reads your words, routes your Case to the
          right campus team, and sets an SLA target for a reply — you never have to work out how
          urgent your own situation is.
        </p>
      </div>

      <div className="scenario-bar card">
        <div className="scenario-title">⚡ Rehearsal scenarios (one click):</div>
        <div className="scenario-chips">
          {DEMO_SCENARIOS.map((scenario) => (
            <button
              key={scenario.label}
              type="button"
              className="scenario-chip"
              onClick={() => loadScenario(scenario)}
            >
              {scenario.label}
            </button>
          ))}
        </div>
      </div>

      {isCrisis && (
        <div className="crisis-intercept-card">
          <div className="crisis-icon">🚨</div>
          <div className="crisis-content">
            <h3>Immediate confidential support is available</h3>
            <p>
              If you are thinking about harming yourself, please reach out right now — you do not
              have to wait for this form.
            </p>
            <div className="crisis-buttons">
              <a href="tel:988" className="btn-crisis">
                📞 Call or text 988 — crisis lifeline
              </a>
              <a href="tel:5550199000" className="btn-crisis-secondary">
                🛡️ Campus 24/7 crisis team
              </a>
            </div>
            <p className="crisis-subnote">
              You can still submit this Case. Submitting raises a High-urgency Case with an
              immediate 2-hour SLA target and alerts the on-call clinician.
            </p>
          </div>
        </div>
      )}

      {deflected && (
        <div className="deflection-success-card">
          <div className="deflect-icon">✓</div>
          <div>
            <h3>Answered without raising a Case</h3>
            <p>
              &ldquo;{deflected}&rdquo; resolved your question directly from the campus Knowledge
              Base, so nothing was added to the counselor queue. This deflection is recorded in the
              operational analytics.
            </p>
            <button
              className="secondary btn-sm"
              type="button"
              onClick={() => {
                setDeflected('');
                setDescription('');
              }}
            >
              Start a new request
            </button>
          </div>
        </div>
      )}

      <div className="portal-grid">
        <form className="card portal-card" onSubmit={handleSubmit}>
          <h2>Case details</h2>

          <label htmlFor="studentAlias">Your name or preferred alias</label>
          <input
            id="studentAlias"
            value={studentAlias}
            onChange={(e) => setStudentAlias(e.target.value)}
            placeholder={'e.g. Jordan P. — or "Anonymous"'}
            required
          />

          <label htmlFor="category">What area do you need help with?</label>
          <select id="category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <label htmlFor="description">Describe your situation</label>
          <textarea
            id="description"
            rows={6}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Plain language is best. If it is urgent, say so — the Assignment Rule will raise the urgency and shorten the SLA target automatically."
            required
          />

          <div className="hint">
            <strong>You do not self-select priority.</strong> Urgency, impact and priority are
            derived from what you write. That is deliberate: students in crisis routinely
            under-report how urgent their situation is.
          </div>

          {/* Live Assignment Rule preview — the decision before the Case exists. */}
          <div className="rule-preview" aria-live="polite">
            <div className="rule-preview-head">
              <span>Assignment Rule — live preview</span>
              <span className={`rule-preview-state${preview ? ' settled' : ''}`}>
                {previewPending ? 'reading your words…' : preview ? 'decision ready' : 'waiting for text'}
              </span>
            </div>

            {preview ? (
              <>
                <div className="rule-preview-grid">
                  <div>
                    <dt>assignmentGroup</dt>
                    <dd>{preview.assignmentGroup}</dd>
                  </div>
                  <div>
                    <dt>urgency</dt>
                    <dd>
                      <UrgencyBadge urgency={preview.urgency} pulse={preview.urgency === 'High'} />
                    </dd>
                  </div>
                  <div>
                    <dt>SLA target</dt>
                    <dd>
                      <span className="rule-preview-sla">{preview.slaHours}h</span>
                    </dd>
                  </div>
                  <div>
                    <dt>priority</dt>
                    <dd>
                      <PriorityBadge priority={preview.priority} />
                    </dd>
                  </div>
                </div>

                <div className="rule-preview-triggers">
                  {preview.matchedKeywords && preview.matchedKeywords.length > 0 ? (
                    preview.matchedKeywords.map((keyword) => (
                      <span className="trigger-chip" key={keyword}>
                        #{keyword}
                      </span>
                    ))
                  ) : (
                    <span className="hint">
                      No trigger words matched yet, so urgency stays at the category baseline. Say
                      plainly what is happening — that is what the rule reads.
                    </span>
                  )}
                </div>
              </>
            ) : (
              <p className="hint rule-preview-empty">
                Start describing your situation. The Assignment Rule runs on every keystroke — no
                model, no guesswork — and shows you exactly which words raised your urgency.
              </p>
            )}
          </div>

          {error && <div className="notice error" style={{ marginTop: 'var(--s-4)' }}>{error}</div>}

          <div className="submit-btn-row">
            <button type="submit" className="btn-primary-large" disabled={submitting}>
              {submitting ? 'Running Assignment Rule…' : 'Submit Case →'}
            </button>
          </div>
        </form>

        <div className="portal-deflection-sidebar">
          <div className="card deflection-card">
            <div className="card-subhead-ai">
              <span>Self-service Knowledge Base</span>
              <span className="confidence-pill">Live</span>
            </div>
            <p className="deflection-explainer">
              Verified campus answers appear here as you type. If one resolves your question, it is
              recorded as a deflection and never reaches the queue.
            </p>

            {searching && articles.length === 0 ? (
              <SkeletonBlock lines={4} />
            ) : articles.length === 0 ? (
              <EmptyState
                icon="📖"
                title="No matching articles yet"
                hint="Keep typing — articles match on your own words, not keywords you have to guess."
              />
            ) : (
              <div className="deflection-articles-list">
                {articles.map((article) => {
                  const expanded = expandedId === article.id;
                  return (
                    <div key={article.id} className="deflection-item">
                      <div className="deflect-item-header">
                        <span className="kb-tag">{article.id}</span>
                        <span className="kb-rating">★ {article.helpfulRating}</span>
                      </div>
                      <div className="deflect-item-title">{article.title}</div>
                      <div className="deflect-item-summary">{article.summary}</div>

                      {expanded && (
                        <div className="deflect-expanded-solution">
                          <strong>Immediate steps</strong>
                          <pre className="solution-text">{article.solution}</pre>
                        </div>
                      )}

                      <div className="deflect-item-actions">
                        <button
                          type="button"
                          className="ghost-sm"
                          onClick={() => setExpandedId(expanded ? null : article.id)}
                        >
                          {expanded ? 'Hide steps' : 'View steps'}
                        </button>
                        <button
                          type="button"
                          className="btn-deflect-sm"
                          onClick={() => handleDeflect(article)}
                        >
                          ✓ This solved it
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
