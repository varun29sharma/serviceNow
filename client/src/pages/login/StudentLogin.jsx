/**
 * Student sign-in.
 *
 * Tuned as the calmest of the three: the student may well be in distress when
 * they open this page, so the copy leads with what happens after they sign in
 * rather than with the credential form, and the crisis line is on the screen
 * before it is needed.
 */
import { Link } from 'react-router-dom';
import { ROLE } from '../../auth/roles.js';
import { accountsForRole } from '../../auth/accounts.js';
import { LoginForm, LoginShell } from './parts.jsx';

export default function StudentLogin() {
  return (
    <LoginShell
      role={ROLE.STUDENT}
      title="You don’t have to work out how urgent this is."
      lede="Sign in, describe what is happening in your own words, and the Assignment Rule decides where it goes and how fast someone answers."
      extra={
        <div className="login-crisis-strip">
          <div className="login-crisis-title">In crisis right now?</div>
          <p>
            You do not need to sign in to get help. Call or text <strong>988</strong>, or reach the
            campus 24/7 crisis team on <strong>(555) 019-9000</strong> (option 2).
          </p>
          <div className="login-crisis-links">
            <a href="tel:988" className="btn-crisis">
              📞 Call 988
            </a>
            <Link className="ghost login-crisis-alt" to="/submit">
              Raise a Case without signing in
            </Link>
          </div>
        </div>
      }
    >
      <LoginForm
        role={ROLE.STUDENT}
        accounts={accountsForRole(ROLE.STUDENT)}
        intro="Student Service Portal"
      />
    </LoginShell>
  );
}
