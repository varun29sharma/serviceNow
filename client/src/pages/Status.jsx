/**
 * Case tracker — the student's view.
 *
 * Shows the four mandated statuses as a timeline, the SLA target as a ring, and
 * — unusually for a student-facing screen — *why* the Case routed where it did.
 * That transparency is the point: "you said 'failing', so this went to Academic
 * Advising with a 2-hour target" is far more trust-building than a black box,
 * and it is only possible because routing is deterministic.
 */
import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

import { getCase, addCaseNote, subscribeToCaseEvents } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { ROLE } from '../auth/roles.js';
import {
  ImpactBadge,
  PriorityBadge,
  SentimentBadge,
  ServiceNowModal,
  SlaPill,
  StatusBadge,
  StudentAvatar,
  UrgencyBadge,
} from '../components/ui.jsx';
import ActivityTimeline from '../components/ActivityTimeline.jsx';
import RoutingFlow from '../components/RoutingFlow.jsx';
import SlaRing from '../components/SlaRing.jsx';
import { SkeletonBlock } from '../components/Skeleton.jsx';
import { formatDateTime } from '../format.js';
import { reportQueueUrgency } from '../lib/liveStatus.js';

const STEP_LABELS = ['New', 'Assigned', 'In Progress', 'Resolved'];

export default function Status() {
  const { id } = useParams();
  const { session } = useAuth();
  const [kase, setKase] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getCase(id);
      setKase(data);
      reportQueueUrgency([data]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Live updates, so staff status changes appear here without a refresh.
  useEffect(() => {
    const unsubscribe = subscribeToCaseEvents(({ type, data }) => {
      if ((type === 'case_updated' || type === 'case_created') && data._id === id) {
        setKase((prev) => ({ ...prev, ...data }));
        reportQueueUrgency([data]);
      }
    });
    return () => unsubscribe();
  }, [id]);

  async function handleReply(event) {
    event.preventDefault();
    if (!reply.trim() || !kase) return;
    setSending(true);
    try {
      const updated = await addCaseNote(kase._id, {
        type: 'comment',
        author: kase.studentAlias || 'Student',
        text: reply,
      });
      setKase(updated);
      setReply('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="status-page-wrap">
        <div className="card status-header-card">
          <SkeletonBlock lines={3} />
        </div>
        <div className="card">
          <SkeletonBlock lines={5} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="notice error">
        {error} — <Link to="/submit">return to the Student Portal</Link>
      </div>
    );
  }

  if (!kase) return null;

  /**
   * Privacy, stated rather than implied.
   *
   * A student session that opens another student's Case gets an explanation,
   * not a rendered record. This is the strongest privacy claim the build can
   * honestly make: there is no server-side check (see auth/accounts.js), so the
   * screen says what happened instead of silently showing someone else's words.
   */
  if (session?.role === ROLE.STUDENT && kase.studentAlias !== session.alias) {
    return (
      <div className="gate-panel card">
        <div className="gate-kicker">Not your Case</div>
        <h1 className="gate-title">Case #{String(kase._id).slice(-6).toUpperCase()} belongs to another student</h1>
        <p className="gate-body">
          You are signed in as {session.name}. Student sessions only open their own Cases — the
          assignmentGroup, the description and the conversation here are not yours to read.
        </p>
        <div className="gate-actions">
          <Link className="btn-primary-large" to="/student">
            Back to my Cases
          </Link>
          <Link className="secondary" to="/login">
            Switch role
          </Link>
        </div>
      </div>
    );
  }

  const currentStep = STEP_LABELS.indexOf(kase.status);
  const publicEntries = (kase.activityStream || []).filter(
    (entry) => entry.type === 'comment' || entry.type === 'system'
  );
  const openHours = ((Date.now() - new Date(kase.createdAt)) / 3600000).toFixed(1);
  const ruleLabel =
    Array.isArray(kase.matchedKeywords) && kase.matchedKeywords.length > 0
      ? `${kase.matchedKeywords.length} trigger${kase.matchedKeywords.length > 1 ? 's' : ''}`
      : 'no triggers';

  return (
    <div className="status-page-wrap">
      <div className="card status-header-card">
        <div className="status-header-top">
          <div>
            <div className="status-case-num">
              CASE #{String(kase._id).slice(-6).toUpperCase()}
              <span className="case-group-tag">· {kase.assignmentGroup}</span>
            </div>
            <h1 className="status-title">
              {kase.category} request — {kase.studentAlias}
            </h1>
            <div className="status-submitted-meta">
              Raised {formatDateTime(kase.createdAt)} · open {openHours}h
            </div>
          </div>

          <div className="status-header-right">
            <button className="secondary btn-sm" type="button" onClick={load}>
              ↻ Refresh
            </button>
            <button className="btn-accent-sm" type="button" onClick={() => setModalOpen(true)}>
              🔗 Table API request
            </button>
          </div>
        </div>

        <div className="lifecycle-stepper">
          {STEP_LABELS.map((step, index) => {
            const completed = index < currentStep;
            const current = index === currentStep;
            return (
              <div
                key={step}
                className={`step-item${completed ? ' step-completed' : ''}${
                  current ? ' step-current' : ''
                }`}
              >
                <div className="step-circle">{completed ? '✓' : index + 1}</div>
                <div className="step-label">{step}</div>
                {current && <div className="step-note">{openHours}h in state</div>}
                {index < STEP_LABELS.length - 1 && <div className="step-connector" />}
              </div>
            );
          })}
        </div>
      </div>

      <div className="status-details-grid">
        <div className="card status-info-card">
          <h2>Case record</h2>

          <dl className="kv-grid">
            <dt>Status</dt>
            <dd>
              <StatusBadge status={kase.status} />
            </dd>

            <dt>Urgency</dt>
            <dd>
              <UrgencyBadge urgency={kase.urgency} pulse={kase.urgency === 'High'} />
            </dd>

            <dt>Impact</dt>
            <dd>
              <ImpactBadge impact={kase.impact} />
            </dd>

            <dt>Priority</dt>
            <dd>
              <PriorityBadge priority={kase.priority} />
            </dd>

            <dt>assignmentGroup</dt>
            <dd>
              <strong>{kase.assignmentGroup}</strong>
            </dd>

            <dt>Assigned specialist</dt>
            <dd>{kase.assignedTo || 'Unassigned — in the priority queue'}</dd>

            <dt>Sentiment</dt>
            <dd>
              <SentimentBadge sentiment={kase.sentiment} />
            </dd>

            <dt>sys_id</dt>
            <dd>
              <code className="sysid-code">
                {kase.snSysId || String(kase._id).padEnd(32, '0').slice(0, 32)}
              </code>
            </dd>
          </dl>

          <div style={{ marginBottom: 'var(--s-5)' }}>
            <SlaRing slaTarget={kase.slaTarget} urgency={kase.urgency} status={kase.status} />
            <div className="sla-sub">Target {formatDateTime(kase.slaTarget)}</div>
          </div>

          <div className="original-submission-box">
            <h3>Your words</h3>
            <p className="statement-text">&ldquo;{kase.description}&rdquo;</p>
          </div>

          <div style={{ marginTop: 'var(--s-5)' }}>
            <div className="card-subhead">Why it routed here</div>
            <RoutingFlow
              category={kase.category}
              ruleValue={ruleLabel}
              assignmentGroup={kase.assignmentGroup}
              urgency={kase.urgency}
              slaHours={{ High: 2, Medium: 24, Low: 72 }[kase.urgency]}
              priority={kase.priority}
              compact
            />
            {Array.isArray(kase.matchedKeywords) && kase.matchedKeywords.length > 0 && (
              <div className="hint">
                Matched triggers:{' '}
                <strong>{kase.matchedKeywords.join(', ')}</strong> — these raised your urgency. You
                did not have to judge how urgent your own situation was.
              </div>
            )}
          </div>
        </div>

        <div className="card status-convo-card">
          <div className="card-subhead">Updates from your advocate</div>
          <p className="convo-sub">
            Direct thread with the {kase.assignmentGroup} team. Replies here update the Case in real
            time.
          </p>

          <div style={{ maxHeight: 420, overflowY: 'auto', marginBottom: 'var(--s-4)' }}>
            <ActivityTimeline
              items={publicEntries}
              filter="all"
              emptyText="Your Case is queued. An advocate will post an update here shortly."
            />
          </div>

          <form className="convo-reply-form" onSubmit={handleReply}>
            <textarea
              rows={3}
              placeholder="Add more detail or reply to your advocate…"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              required
            />
            <div className="reply-btn-row">
              <span className="hint">Posts directly to your Case record</span>
              <button type="submit" disabled={sending || !reply.trim()}>
                {sending ? 'Sending…' : 'Send to advocate'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="status-footer-bar">
        <Link className="secondary btn-sm" to="/submit">
          ← Raise another Case
        </Link>
        <Link className="secondary btn-sm" to="/queue/All">
          Open the Agent Workspace →
        </Link>
      </div>

      <ServiceNowModal isOpen={modalOpen} onClose={() => setModalOpen(false)} kase={kase} />
    </div>
  );
}
