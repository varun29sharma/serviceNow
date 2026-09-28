/**
 * Login primitives shared by the three role pages.
 *
 * This is the plumbing, not the pages: each role's login screen supplies its own
 * headline, lede and extras, so `/login/student`, `/login/mediator` and
 * `/login/provider` are three different screens rather than one form with a
 * hidden role field.
 *
 * The credential panel is deliberately prominent. There is no way to sign in
 * that isn't a seeded demo account, so hiding the list would just make the
 * screen unusable; showing it makes the role model explorable in ten seconds.
 * The "not real authentication" note sits with it rather than in a footnote,
 * because it is the most important thing on the page.
 */
import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { verifyCredentials } from '../../auth/accounts.js';
import { ROLE_META, roleHome } from '../../auth/roles.js';

/** Resolve a post-login destination: the page they wanted, else the role home. */
export function resolveDestination(session, from) {
  if (from && from !== '/login' && !from.startsWith('/login')) return from;
  return roleHome(session);
}

export function LoginShell({ role, title, lede, children, extra }) {
  const { session } = useAuth();
  const location = useLocation();
  const meta = ROLE_META[role];

  // Already signed in as this role? There is nothing to do here.
  //
  // This has to honour `state.from` as well as the role home, because a
  // successful sign-in inside the form commits the session, which re-renders
  // this shell and redirects from HERE — before the form's own navigate() runs.
  if (session && session.role === role) {
    return <Navigate to={resolveDestination(session, location.state?.from)} replace />;
  }

  return (
    <div className={`login-page login-page-${role}`}>
      <div className="login-layout">
        <aside className="login-aside">
          <div className="login-role-chip">{meta.portal}</div>
          <h1 className="login-title">{title}</h1>
          <p className="login-lede">{lede}</p>

          <div className="login-block">
            <div className="login-block-head">This sign-in unlocks</div>
            <ul className="login-perms">
              {meta.permissions.map((permission) => (
                <li key={permission}>
                  <span className="login-check" aria-hidden="true">
                    ✓
                  </span>
                  {permission}
                </li>
              ))}
            </ul>
          </div>

          <div className="login-block">
            <div className="login-block-head">Deliberately out of reach</div>
            <ul className="login-cannot">
              {meta.cannot.map((item) => (
                <li key={item}>
                  <span className="login-cross" aria-hidden="true">
                    ✕
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {extra}
        </aside>

        <section className="login-main">{children}</section>
      </div>
    </div>
  );
}

export function LoginForm({ role, accounts, intro, requestGroup }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [group, setGroup] = useState(params.get('group') || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [filledFrom, setFilledFrom] = useState('');

  // A provider page can be deep-linked with ?group=Counseling, so prefill it.
  useEffect(() => {
    const requested = params.get('group');
    if (requested) setGroup(requested);
  }, [params]);

  const from = location.state?.from;

  function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);

    /**
     * Verify FIRST, commit second.
     *
     * The group check used to run after `login()`, which was unreachable:
     * committing the session re-renders <LoginShell>, which sees a session for
     * its own role and immediately redirects to the role home — so a provider
     * could pick Financial Aid, sign in with the Counseling account, and be let
     * straight through. Validating against the pure lookup before committing
     * keeps the check live, and keeps UI rules out of the auth layer.
     */
    const candidate = verifyCredentials({ username, password, role });
    if (!candidate) {
      setError('Those credentials do not match a seeded account for this role.');
      setBusy(false);
      return;
    }

    // A provider must sign in with the account that OWNS the group it picked;
    // otherwise the workspace would scope to a group they do not work in.
    if (requestGroup && group && candidate.group !== group) {
      setError(
        `That account works in ${candidate.group}, not ${group}. ` +
          `Pick ${candidate.group}, or sign in with the ${group} provider account below.`
      );
      setBusy(false);
      return;
    }

    const result = login({ username, password, role });
    if (!result.ok) {
      setError(result.error);
      setBusy(false);
      return;
    }

    navigate(resolveDestination(result.session, from), { replace: true });
  }

  function useCredential(account) {
    setUsername(account.username);
    setPassword(account.password);
    if (account.group) setGroup(account.group);
    setError('');
    setFilledFrom(account.username);
  }

  return (
    <form className="login-form card" onSubmit={submit}>
      <div className="login-form-head">
        <div className="workspace-badge">Sign in</div>
        <h2>{intro}</h2>
      </div>

      {from && (
        <div className="notice ok login-from-notice">
          Sign in to continue to <code>{from}</code>
        </div>
      )}

      <label htmlFor={`username-${role}`}>Username</label>
      <input
        id={`username-${role}`}
        value={username}
        autoComplete="username"
        placeholder="e.g. jordan.p"
        onChange={(e) => {
          setUsername(e.target.value);
          setFilledFrom('');
        }}
        required
      />

      <label htmlFor={`password-${role}`}>Password</label>
      <input
        id={`password-${role}`}
        type="password"
        value={password}
        autoComplete="current-password"
        placeholder="seeded demo password"
        onChange={(e) => {
          setPassword(e.target.value);
          setFilledFrom('');
        }}
        required
      />

      {requestGroup && (
        <div className="login-group-picker">
          <span className="login-group-label">assignmentGroup</span>
          <div className="login-group-options">
            {requestGroup.map((option) => (
              <button
                key={option}
                type="button"
                className={`login-group-chip${group === option ? ' active' : ''}`}
                onClick={() => setGroup(option)}
              >
                {option}
              </button>
            ))}
          </div>
          <div className="hint">
            Work {group ? <strong>{group}</strong> : 'a group'}. A provider session can only open the
            queue for its own assignmentGroup.
          </div>
        </div>
      )}

      {error && <div className="notice error login-error">{error}</div>}

      <button type="submit" className="btn-primary-large login-submit" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in →'}
      </button>

      <div className="login-demo-panel">
        <div className="login-demo-head">
          <span>Seeded demo credentials</span>
          <span className="login-demo-flag">not real authentication</span>
        </div>
        <p className="login-demo-note">
          There is no password hashing, no token and no server-side enforcement here — this is a
          role-routing demonstration, not a security boundary. Click any row to fill the form.
        </p>
        <div className="login-cred-list">
          {accounts.map((account) => (
            <button
              key={account.username}
              type="button"
              className={`login-cred-row${filledFrom === account.username ? ' active' : ''}`}
              onClick={() => useCredential(account)}
            >
              <span className="login-cred-who">
                <strong>{account.name}</strong>
                <span>{account.title}</span>
              </span>
              <span className="login-cred-secret">
                <code>{account.username}</code>
                <code>{account.password}</code>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="login-foot-links">
        <Link to="/login">← All three roles</Link>
        <Link to="/">Back to the home page</Link>
      </div>
    </form>
  );
}
