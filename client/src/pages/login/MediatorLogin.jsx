/**
 * Mediator sign-in — the triage supervision desk.
 *
 * The most technical of the three screens, because this is the role that owns
 * routing: the aside lists what the supervisor is accountable for, and the page
 * says plainly that editing the Assignment Rule is theirs alone.
 */
import { ROLE } from '../../auth/roles.js';
import { accountsForRole } from '../../auth/accounts.js';
import { LoginForm, LoginShell } from './parts.jsx';

export default function MediatorLogin() {
  return (
    <LoginShell
      role={ROLE.MEDIATOR}
      title="Own the routing, not just the queue."
      lede="The mediator is the supervisor of the triage desk: you see every assignmentGroup at once, move work that the Assignment Rule got wrong, and answer for the rule itself."
      extra={
        <div className="login-scope-list">
          <div className="login-block-head">Your surfaces</div>
          <ul className="login-surface-list">
            <li>
              <code>/queue/All</code> — every assignmentGroup, priority ordered
            </li>
            <li>
              <code>/rules</code> — the Assignment Rule console, re-scored as you type
            </li>
            <li>
              <code>/dashboard</code> — deflection, SLA adherence, hours saved
            </li>
          </ul>
          <p className="hint">
            Rule edits are global. In ServiceNow an Assignment Rule is a configurable record an
            admin owns — this console is that record, and changing it re-routes work immediately.
          </p>
        </div>
      }
    >
      <LoginForm
        role={ROLE.MEDIATOR}
        accounts={accountsForRole(ROLE.MEDIATOR)}
        intro="Triage Supervision Desk"
      />
    </LoginShell>
  );
}
