/**
 * 404.
 *
 * The previous build routed `*` to the home page, which meant a mistyped or
 * stale URL looked like a page that had simply failed to load its content — the
 * single most confusing failure mode there is. This says what happened, shows
 * the path that missed, and offers the routes that exist.
 */
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { ROLE, roleHome } from '../auth/roles.js';

export default function NotFound() {
  const location = useLocation();
  const { session } = useAuth();

  const links = [
    { to: '/', label: 'Home' },
    { to: '/submit', label: 'Raise a Case' },
  ];

  if (session) {
    links.push({ to: roleHome(session), label: 'My portal' });
  } else {
    links.push({ to: '/login', label: 'Sign in' });
  }

  if (session && session.role === ROLE.MEDIATOR) {
    links.push({ to: '/rules', label: 'Assignment Rules' });
    links.push({ to: '/dashboard', label: 'Dashboard' });
  }

  return (
    <div className="notfound-wrap">
      <div className="card notfound-card">
        <div className="notfound-code">404</div>
        <h1>No screen at that address</h1>
        <p>
          TriageNow could not find a route for <code className="notfound-path">{location.pathname}</code>.
          Nothing is broken — the address just does not match a surface in this build.
        </p>
        <div className="notfound-links">
          {links.map((link) => (
            <Link key={link.to} to={link.to} className="secondary btn-sm">
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
