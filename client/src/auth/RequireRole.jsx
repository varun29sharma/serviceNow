/**
 * RequireRole — the route guard.
 *
 * Two different failures, handled differently on purpose:
 *
 *   Not signed in      → send them to the right login page, remembering where
 *                        they were headed so signing in lands them there.
 *   Signed in, wrong role
 *                      → render an explanation IN PLACE. Bouncing them to a
 *                        different URL hides what happened; a student who opens
 *                        the Assignment Rules bookmarked by a teammate should be
 *                        told that editing the rule is the supervisor's job, not
 *                        silently teleported somewhere else.
 *
 * Client-side only. See auth/accounts.js for the honest scope of that.
 */
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import { ROLE_META } from './roles.js';

function WrongRolePanel({ allow, actual }) {
  const allowedLabels = allow.map((role) => ROLE_META[role]?.label || role).join(' or ');
  return (
    <div className="gate-panel card">
      <div className="gate-kicker">Role required</div>
      <h1 className="gate-title">This surface belongs to the {allowedLabels}</h1>
      <p className="gate-body">
        You are signed in as a <strong>{ROLE_META[actual]?.label || actual}</strong>. TriageNow keeps
        the three roles genuinely separate: a student never sees a queue, a provider never sees
        another assignmentGroup, and only the mediator edits the Assignment Rule.
      </p>
      <div className="gate-actions">
        <Link className="btn-primary-large" to="/student">
          Go to my portal
        </Link>
        <Link className="secondary" to="/login">
          Switch role
        </Link>
      </div>
    </div>
  );
}

export default function RequireRole({ allow = [], children }) {
  const { session } = useAuth();
  const location = useLocation();

  if (!session) {
    // One role in `allow` means we know exactly which door to open.
    const target =
      allow.length === 1 && ROLE_META[allow[0]] ? ROLE_META[allow[0]].loginPath : '/login';
    return (
      <Navigate to={target} replace state={{ from: `${location.pathname}${location.search}` }} />
    );
  }

  if (allow.length > 0 && !allow.includes(session.role)) {
    return <WrongRolePanel allow={allow} actual={session.role} />;
  }

  return children;
}
