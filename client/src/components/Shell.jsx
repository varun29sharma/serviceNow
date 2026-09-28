/**
 * Shell — the chrome the workspace routes wear.
 *
 * Home does NOT use this. The landing page is a standalone surface with no top
 * bar and no sidebar, so nothing competes with the hero and the sandbox. Every
 * other route gets this.
 *
 * The shape follows the workspace references: ONE navigation column that is
 * LABELLED when there is room for it, ICON-ONLY when there is not, and a
 * slide-over drawer below that. One column rather than a rail plus a sidebar,
 * because the two references show those as alternatives at different widths,
 * and a rail duplicating the icon next to the sidebar's own icon is just two
 * controls for one destination.
 *
 * The column is `position: sticky` rather than `fixed`, so the whole shell is
 * one scroll container and the sticky top strip inside the content column can
 * never be overlapped by the nav — which is what made the old topbar swallow
 * clicks on controls underneath it.
 */
import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

import { ConnectionChip, DismissibleConnectionBanner } from './ConnectionChip.jsx';
import { IconClose, IconLogout, IconMenu, routeIcon } from './icons.jsx';
import { ROLE_META } from '../auth/roles.js';
import { useLiveUrgency } from '../lib/liveStatus.js';

const OFF_NAV_TITLES = [
  ['/submit', 'Raise a Case'],
  ['/status', 'Case tracker'],
  ['/login', 'Sign in'],
  ['/student', 'Student Service Portal'],
];

/** The page name for a route that is not in the current role's navigation. */
function titleForPath(pathname) {
  const hit = OFF_NAV_TITLES.find(([prefix]) => pathname.startsWith(prefix));
  return hit ? hit[1] : 'TriageNow';
}

/** Initials for the user chip, e.g. "Dr. Elena Vance" -> "EV". */
function initialsOf(name = '') {
  return (
    String(name)
      .replace(/\b(dr|mr|mrs|ms|prof)\.?\s/gi, '')
      .split(/[\s,]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || '··'
  );
}

export default function Shell({
  links,
  session,
  onSignOut,
  presentation,
  setPresentation,
  children,
}) {
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const urgency = useLiveUrgency();

  // A route change closes the drawer. Leaving it open would hide the page the
  // user just asked for.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // While the drawer is open on a small screen, the page behind it must not
  // scroll — otherwise a swipe scrolls the list you cannot see.
  useEffect(() => {
    if (!drawerOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [drawerOpen]);

  const active = links.find((link) =>
    link.end ? location.pathname === link.to : location.pathname.startsWith(link.to)
  );

  /**
   * Not every route is in the nav — the public intake form, the student tracker
   * and the login doors are reachable by anyone, and a mediator's nav has no
   * entry for them. Without this the strip would title those pages "TriageNow",
   * which reads like the page failed to load rather than like a name.
   */
  const title = active?.label || titleForPath(location.pathname);

  const sessionBlock = session ? (
    <div className="side-session">
      <span className="side-avatar" aria-hidden="true">
        {initialsOf(session.name)}
      </span>
      <span className="side-session-text">
        <span className="side-session-name">{session.name}</span>
        <span className="side-session-role">
          {ROLE_META[session.role]?.label || session.role}
          {session.group ? ` · ${session.group}` : ''}
        </span>
      </span>
    </div>
  ) : null;

  return (
    <div className="shell">
      {/* ------------------------------------------------------- nav column */}
      <aside className={`side${drawerOpen ? ' side-open' : ''}`} aria-label="Primary navigation">
        <div className="side-top">
          <NavLink to="/" className="side-brand">
            <span className="brand-mark">NOW</span>
            <span className="side-brand-text">
              <span className="side-brand-name">TriageNow</span>
              <span className="side-brand-sub">Student Case triage</span>
            </span>
          </NavLink>
          <button
            type="button"
            className="side-close"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close navigation"
          >
            <IconClose />
          </button>
        </div>

        <nav className="side-nav">
          {links.map((link) => {
            const Icon = routeIcon(link.to);
            const label = link.label;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                title={label}
                className={({ isActive }) => `side-link${isActive ? ' active' : ''}`}
              >
                <span className="side-link-icon">
                  <Icon />
                </span>
                <span className="side-link-label">{label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="side-foot">
          {sessionBlock}
          {session ? (
            <button type="button" className="side-signout" onClick={onSignOut}>
              <IconLogout />
              <span>Sign out</span>
            </button>
          ) : (
            <NavLink to="/login" className="side-signout">
              <IconLogout />
              <span>Sign in</span>
            </NavLink>
          )}
        </div>
      </aside>

      {/* The veil only exists on small screens; on desktop the nav column is
          part of the layout and there is nothing to dismiss. */}
      <button
        type="button"
        className="side-veil"
        aria-label="Close navigation"
        tabIndex={drawerOpen ? 0 : -1}
        onClick={() => setDrawerOpen(false)}
      />

      {/* ---------------------------------------------------- content column */}
      <div className="shell-body">
        <header className="topstrip">
          <button
            type="button"
            className="topstrip-menu"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
            aria-expanded={drawerOpen}
          >
            <IconMenu />
          </button>

          {/* The old topbar centred this claim between the brand and the nav.
              It is the single most important honest statement the product
              makes about itself, so it moved here rather than being dropped
              with the topbar. */}
          <div className="topstrip-titles">
            <h1 className="topstrip-title">{title}</h1>
            <span className="topstrip-sub">
              Deterministic rules engine · no model calls ·{' '}
              {urgency === 'None' ? 'queue clear' : `peak urgency ${urgency}`}
            </span>
          </div>

          <div className="topstrip-right">
            <ConnectionChip />

            <button
              type="button"
              className="presentation-btn"
              aria-pressed={presentation}
              title="Lifts every surface for low-contrast projectors"
              onClick={() => setPresentation((on) => !on)}
            >
              {presentation ? '☀ Projector' : '☾ Standard'}
            </button>

            {session && (
              <span className="user-chip" title={`${session.name} — ${session.title || ''}`}>
                <span className="user-chip-avatar" aria-hidden="true">
                  {initialsOf(session.name)}
                </span>
                <span className="user-chip-text">
                  <span className="user-chip-name">{session.name}</span>
                  <span className="user-chip-role">
                    {ROLE_META[session.role]?.label || session.role}
                  </span>
                </span>
              </span>
            )}
          </div>
        </header>

        <DismissibleConnectionBanner />

        <main className="main">{children}</main>

        <footer className="footer">
          <div className="footer-inner">
            <div>
              <strong>Case</strong> · <strong>assignmentGroup</strong> ·{' '}
              <strong>Assignment Rule</strong> · <strong>SLA target</strong> — routing logic as a
              configurable record, not compiled code.
            </div>
            <div className="footer-vocab">
              Statuses strictly: <code>New</code> · <code>Assigned</code> · <code>In Progress</code>{' '}
              · <code>Resolved</code>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
