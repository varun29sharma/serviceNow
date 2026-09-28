/**
 * Auth context — who is signed in, and how they sign out.
 *
 * The session is JSON in localStorage under `triagenow.session`, so a reload
 * mid-demo does not throw the presenter back to the login screen. It carries
 * only what the shell needs to decide what to render: role, group, display name
 * and the alias Cases should be authored as.
 *
 * Again, honestly: this is a client-side role switch, not authentication. See
 * auth/accounts.js for the full statement of what it does and does not do.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ROLE, roleHome } from './roles.js';
import { verifyCredentials } from './accounts.js';

const SESSION_KEY = 'triagenow.session';

const AuthContext = createContext(null);

function readStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // A session without a recognised role is worse than none: it would render a
    // shell with no nav at all. Treat it as signed out.
    if (!parsed || !Object.values(ROLE).includes(parsed.role)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredSession(session) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage unavailable — the session still holds for this tab */
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readStoredSession);

  useEffect(() => {
    writeStoredSession(session);
  }, [session]);

  /**
   * Attempt a sign-in. Returns `{ ok, session }` or `{ ok: false, error }` —
   * never throws, because the login screens render the reason inline.
   */
  const login = useCallback(({ username, password, role }) => {
    if (!username || !String(username).trim()) {
      return { ok: false, error: 'Enter your username.' };
    }
    if (!password) {
      return { ok: false, error: 'Enter your password.' };
    }
    const next = verifyCredentials({ username, password, role });
    if (!next) {
      return {
        ok: false,
        error: 'Those credentials do not match a seeded account for this role.',
      };
    }
    setSession(next);
    return { ok: true, session: next };
  }, []);

  const logout = useCallback(() => setSession(null), []);

  /** Sign in directly with an account record (used by the demo credential chips). */
  const loginAs = useCallback((account) => {
    const next = verifyCredentials({
      username: account.username,
      password: account.password,
      role: account.role,
    });
    if (!next) return { ok: false, error: 'Seeded account is not usable.' };
    setSession(next);
    return { ok: true, session: next };
  }, []);

  const value = useMemo(
    () => ({
      session,
      login,
      loginAs,
      logout,
      home: roleHome(session),
      isSignedIn: Boolean(session),
    }),
    [session, login, loginAs, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}

export { SESSION_KEY };
