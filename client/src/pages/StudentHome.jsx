/**
 * Student portal home — what a student session lands on.
 *
 * The student's own Cases, filtered to their alias, with the SLA state of each
 * open one and a single obvious action. This is what makes signing in as a
 * student mean something: before this page, the student login led to the same
 * staff-shaped nav everyone else got.
 *
 * Deliberately no queue, no dashboard and no totals across the institution — a
 * student seeing the aggregate queue would be a privacy problem, not a feature.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { listCasesByGroup } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { StatusBadge, SlaPill, UrgencyBadge } from '../components/ui.jsx';
import { EmptyState, SkeletonList } from '../components/Skeleton.jsx';
import { formatDateTime } from '../format.js';
import { reportQueueUrgency } from '../lib/liveStatus.js';

const OPEN_STATUSES = ['New', 'Assigned', 'In Progress'];

export default function StudentHome() {
  const { session } = useAuth();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const all = await listCasesByGroup('All');
      // Scoped by alias: in this build the alias IS the student's identity.
      const mine = all.filter((c) => c.studentAlias === session.alias);
      setCases(mine);
      reportQueueUrgency(mine);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session.alias]);

  useEffect(() => {
    load();
  }, [load]);

  const open = cases.filter((c) => OPEN_STATUSES.includes(c.status));
  const resolved = cases.filter((c) => c.status === 'Resolved');

  return (
    <div className="student-home">
      <div className="student-hero card">
        <div className="student-hero-main">
          <div className="portal-badge">Student Service Portal</div>
          {/* No trailing period: aliases like "Jordan P." already carry one. */}
          <h1>Hello, {session.name}</h1>
          <p>
            Anything you raise here is read by the Assignment Rule, routed to the right campus team
            and given an SLA target for a reply. You never have to judge how urgent your own
            situation is — the wording does that.
          </p>
          <div className="student-hero-actions">
            <Link to="/submit" className="btn-primary-large">
              Raise a Case →
            </Link>
            <button className="secondary" type="button" onClick={load}>
              ↻ Refresh my Cases
            </button>
          </div>
        </div>

        <div className="student-hero-stats">
          <div className="student-stat">
            <span className="student-stat-num">{open.length}</span>
            <span className="student-stat-label">open</span>
          </div>
          <div className="student-stat">
            <span className="student-stat-num">{resolved.length}</span>
            <span className="student-stat-label">resolved</span>
          </div>
          <div className="student-stat">
            <span className="student-stat-num">{cases.length}</span>
            <span className="student-stat-label">total with us</span>
          </div>
        </div>
      </div>

      {error && <div className="notice error">{error}</div>}

      <div className="card">
        <div className="card-subhead">My Cases</div>

        {loading ? (
          <SkeletonList rows={3} />
        ) : cases.length === 0 ? (
          <EmptyState
            icon="📨"
            title="You have no open Cases"
            hint="Nothing is on file for you yet. Raise a Case and it will appear here with its SLA target."
          />
        ) : (
          <div className="student-case-list">
            {cases.map((item) => (
              <Link key={item._id} to={`/status/${item._id}`} className="student-case-row">
                <div className="student-case-main">
                  <div className="student-case-num">
                    CASE #{String(item._id).slice(-6).toUpperCase()}
                    <span className="case-group-tag">· {item.assignmentGroup}</span>
                  </div>
                  <div className="student-case-desc">{item.description}</div>
                  <div className="student-case-meta">
                    Raised {formatDateTime(item.createdAt)}
                    {item.assignedTo && item.assignedTo !== 'Unassigned' && (
                      <>
                        {' · '}
                        <strong>{item.assignedTo}</strong>
                      </>
                    )}
                  </div>
                </div>
                <div className="student-case-side">
                  <StatusBadge status={item.status} />
                  <UrgencyBadge urgency={item.urgency} pulse={item.urgency === 'High'} />
                  <SlaPill slaTarget={item.slaTarget} status={item.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="card student-vocab-card">
        <div className="card-subhead">What the statuses mean</div>
        <div className="student-vocab-grid">
          <div>
            <strong>New</strong>
            <span>Received, routed by the Assignment Rule, waiting for an owner.</span>
          </div>
          <div>
            <strong>Assigned</strong>
            <span>A named specialist in your assignmentGroup owns it now.</span>
          </div>
          <div>
            <strong>In Progress</strong>
            <span>Someone is actively working it and will post an update here.</span>
          </div>
          <div>
            <strong>Resolved</strong>
            <span>Closed, usually inside the SLA target. You can reopen by replying.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
