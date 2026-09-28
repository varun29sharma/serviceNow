/**
 * The role chooser — "three doors".
 *
 * TriageNow has three audiences with genuinely different jobs, so it has three
 * sign-in screens rather than one form with a role dropdown. This page makes
 * that choice explicit and describes the consequence of each door before you
 * walk through it.
 */
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { ROLE, ROLE_META, ROLE_ORDER } from '../../auth/roles.js';
import { accountsForRole } from '../../auth/accounts.js';

const DOOR_DETAIL = {
  [ROLE.STUDENT]: {
    marker: '01',
    headline: 'I need help',
    body: 'Raise a Case, follow it, and read the Knowledge Base before a counselor ever gets involved.',
    stat: 'Sees only their own Cases',
  },
  [ROLE.MEDIATOR]: {
    marker: '02',
    headline: 'I route the work',
    body: 'Every queue at once, the Assignment Rule console, the escalation protocol and the leadership numbers.',
    stat: 'See all 4 assignmentGroups',
  },
  [ROLE.PROVIDER]: {
    marker: '03',
    headline: 'I answer the Cases',
    body: 'Your assignmentGroup’s queue with Student 360, the priority matrix and your guided playbook.',
    stat: 'Scoped to 1 assignmentGroup',
  },
};

export default function LoginIndex() {
  const { session, logout, home } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="login-index">
      <div className="login-index-head">
        <div className="workspace-badge">Access control</div>
        <h1>Three roles, three doors</h1>
        <p>
          TriageNow separates the student who needs help, the mediator who routes the work, and the
          service provider who answers it. Pick the role you are signing in as — each door leads to a
          different product.
        </p>
      </div>

      {session && (
        <div className="card login-current-session">
          <div>
            <div className="login-block-head">Currently signed in</div>
            <div className="login-session-line">
              <strong>{session.name}</strong>
              <span className="login-session-role">{ROLE_META[session.role]?.label}</span>
              {session.group && <span className="case-group-tag">· {session.group}</span>}
            </div>
          </div>
          <div className="login-session-actions">
            <button className="secondary btn-sm" type="button" onClick={() => navigate(home)}>
              Continue as {session.name}
            </button>
            <button
              className="ghost btn-sm"
              type="button"
              onClick={() => {
                logout();
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      )}

      <div className="login-doors">
        {ROLE_ORDER.map((role) => {
          const meta = ROLE_META[role];
          const detail = DOOR_DETAIL[role];
          const sample = accountsForRole(role)[0];
          return (
            <Link key={role} to={meta.loginPath} className={`login-door login-door-${role} card`}>
              <div className="login-door-top">
                <span className="login-door-marker">{detail.marker}</span>
                <span className="login-door-scope">{detail.stat}</span>
              </div>
              <div className="login-door-headline">{detail.headline}</div>
              <div className="login-door-role">{meta.label}</div>
              <p className="login-door-body">{detail.body}</p>
              <div className="login-door-foot">
                <span>
                  Demo as <strong>{sample.name}</strong>
                </span>
                <span className="login-door-arrow" aria-hidden="true">
                  →
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="card login-index-note">
        <strong>Honest note.</strong> There is no password hashing, no session on the server and no
        server-side enforcement in this build — the seeded accounts below are the only way in, and
        the guards are client-side. What is real is the role separation: each role genuinely gets a
        different product, and a student genuinely cannot open a queue.
      </div>
    </div>
  );
}
