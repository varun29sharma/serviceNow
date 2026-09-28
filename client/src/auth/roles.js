/**
 * Roles — the three people who use TriageNow, and what each is allowed to see.
 *
 * There are exactly three, and they are deliberately unequal:
 *
 *   Student   raises a Case and follows it. Cannot see a queue, a dashboard or
 *             the Assignment Rule — and specifically cannot see another
 *             student's Case.
 *   Mediator  the Triage SUPERVISOR. Owns routing: works every assignmentGroup
 *             queue, assigns Cases to providers, edits the Assignment Rule,
 *             runs the escalation protocol and reads the leadership dashboard.
 *   Provider  a service provider scoped to ONE assignmentGroup — Counseling,
 *             Academic Advising, Financial Aid or Peer Support. Works that
 *             group's queue and nothing else.
 *
 * "Mediator" is not ServiceNow vocabulary, so this module also fixes its
 * meaning in the product: the supervisor of the triage desk, the person who
 * decides where a Case belongs when the Assignment Rule needs a human.
 *
 * Gatekeeping is enforced by `<RequireRole>` on the client. There is no server
 * token and no password hashing — see accounts.js for exactly how far this
 * goes, which the login screens also state on screen.
 */
export const ROLE = {
  STUDENT: 'student',
  MEDIATOR: 'mediator',
  PROVIDER: 'provider',
};

export const ROLE_ORDER = [ROLE.STUDENT, ROLE.MEDIATOR, ROLE.PROVIDER];

export const ROLE_META = {
  [ROLE.STUDENT]: {
    id: ROLE.STUDENT,
    label: 'Student',
    portal: 'Student Service Portal',
    // Path used by RequireRole to send an unauthenticated visitor somewhere useful.
    loginPath: '/login/student',
    blurb: 'Raise a Case, follow it, and see exactly why it went where it went.',
    permissions: [
      'Raise a Case in plain language — never self-select priority',
      'Track your own Cases and the four mandated statuses',
      'See which trigger words raised your urgency, and the SLA target that follows',
      'Read Knowledge Base answers before a Case is even created',
    ],
    cannot: ['See another student’s Case', 'See any queue or dashboard', 'Edit the Assignment Rule'],
  },
  [ROLE.MEDIATOR]: {
    id: ROLE.MEDIATOR,
    label: 'Mediator',
    portal: 'Triage Supervision Desk',
    loginPath: '/login/mediator',
    blurb: 'Own routing across every assignmentGroup, and answer to leadership for it.',
    permissions: [
      'Work every assignmentGroup queue, not just one',
      'Assign Cases to service providers and re-scope mis-routed work',
      'Edit the Assignment Rule and re-score it against 36 labelled Cases',
      'Trigger the escalation protocol and read the leadership dashboard',
    ],
    cannot: ['Raise a Case as a student', 'See a student’s private thread as the student sees it'],
  },
  [ROLE.PROVIDER]: {
    id: ROLE.PROVIDER,
    label: 'Service Provider',
    portal: 'Assignment Group Workspace',
    loginPath: '/login/provider',
    blurb: 'Work one assignmentGroup’s queue, with Student 360 and the playbook in front of you.',
    permissions: [
      'Work your own assignmentGroup’s priority-ordered queue',
      'Override impact (priority re-derives — never set directly)',
      'Post Work Notes vs public Comments, and run the guided playbook',
      'Resolve the Case — pick the resolution that fits the situation and close it out',
    ],
    cannot: [
      'Escalate a Case — that is the mediator’s protocol, not a provider action',
      'See another assignmentGroup’s queue',
      'Edit the Assignment Rule',
      'See leadership analytics',
    ],
  },
};

/** Where each role lands after signing in. Providers land in their own queue. */
export function roleHome(session) {
  if (!session) return '/login';
  if (session.role === ROLE.STUDENT) return '/student';
  if (session.role === ROLE.MEDIATOR) return '/queue/All';
  if (session.role === ROLE.PROVIDER) {
    return session.group ? `/queue/${encodeURIComponent(session.group)}` : '/queue';
  }
  return '/';
}

/** Can this session open the Agent Workspace at all? */
export function canWorkQueues(session) {
  return Boolean(session && (session.role === ROLE.MEDIATOR || session.role === ROLE.PROVIDER));
}

/**
 * Which assignmentGroups may this session open?
 * A provider is locked to one; a mediator gets all four; nobody else gets any.
 */
export function visibleGroups(session, allGroups = []) {
  if (!session) return [];
  if (session.role === ROLE.MEDIATOR) return allGroups;
  if (session.role === ROLE.PROVIDER && session.group) return [session.group];
  return [];
}

/** Route guard paths for each role, used by the nav and RequireRole. */
export function landingFor(session) {
  return roleHome(session);
}
