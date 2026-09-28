/**
 * Service provider sign-in — scoped to ONE assignmentGroup.
 *
 * The difference from the other two screens is structural: the group is part of
 * the credential, not a view filter. A Counseling session cannot open the
 * Financial Aid queue, and the form says so before you sign in rather than after.
 */
import { ASSIGNMENT_GROUPS } from '../../api.js';
import { ROLE } from '../../auth/roles.js';
import { accountsForRole } from '../../auth/accounts.js';
import { LoginForm, LoginShell } from './parts.jsx';

const GROUP_FOCUS = {
  Counseling: 'Crisis language, safety protocol and the 2-hour High-urgency window.',
  'Academic Advising': 'Academic standing, probation recovery and late-drop petitions.',
  'Financial Aid': 'Holds, deferrals and emergency micro-grants before disenrollment.',
  'Peer Support': 'Housing instability, food insecurity and general navigation.',
};

export default function ProviderLogin() {
  return (
    <LoginShell
      role={ROLE.PROVIDER}
      title="One assignmentGroup. Everything you need to work it."
      lede="Providers sign in already scoped: your queue is your group’s queue, and the Assignment Rule has been routing to you since intake."
      extra={
        <div className="login-group-brief">
          <div className="login-block-head">The four groups</div>
          {ASSIGNMENT_GROUPS.map((group) => (
            <div className="login-group-brief-row" key={group}>
              <span className="login-group-brief-name">{group}</span>
              <span className="login-group-brief-note">{GROUP_FOCUS[group]}</span>
            </div>
          ))}
        </div>
      }
    >
      <LoginForm
        role={ROLE.PROVIDER}
        accounts={accountsForRole(ROLE.PROVIDER)}
        intro="Assignment Group Workspace"
        requestGroup={ASSIGNMENT_GROUPS}
      />
    </LoginShell>
  );
}
