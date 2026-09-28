/**
 * Seeded demo accounts.
 *
 * HOW FAR THIS GOES — read before describing it anywhere:
 *
 *   Passwords are compared in plain text, client-side. There is no hash, no
 *   token, no session on the server, and no server-side enforcement: a
 *   determined visitor can bypass every guard with a devtools one-liner.
 *
 *   This is a demonstration of role-based EXPERIENCE — who sees which surface,
 *   and what the shell does when the answer is "not you". It is not
 *   authentication, and the login screens say so in as many words. Presenting
 *   it as a security boundary would be the dishonest move; presenting it as
 *   what it is (role routing, honestly labelled) is the interesting one.
 *
 * The provider identities are deliberately the SAME strings the seeded Cases
 * already carry in `assignedTo` and the seeder uses as `GROUP_OWNER`, so a
 * signed-in provider is genuinely the person the Case was assigned to — not a
 * parallel cast of characters invented for the login screen.
 *
 * The two student aliases match seeded Cases too, so a student who signs in
 * immediately has a real Case history to look at.
 */
import { ASSIGNMENT_GROUPS } from '../../../server/src/constants.js';
import { ROLE } from './roles.js';

export const DEMO_ACCOUNTS = [
  // ---------------------------------------------------------------- students
  {
    username: 'jordan.p',
    password: 'student',
    role: ROLE.STUDENT,
    name: 'Jordan P.',
    alias: 'Jordan P.',
    title: 'Undergraduate · Psychology',
  },
  {
    username: 'nadia.f',
    password: 'student',
    role: ROLE.STUDENT,
    name: 'Nadia F.',
    alias: 'Nadia F.',
    title: 'Undergraduate · Nursing',
  },
  {
    // The only account with no seeded history — useful for demoing an empty
    // "My Cases" state without having to clear anything.
    username: 'sam.r',
    password: 'student',
    role: ROLE.STUDENT,
    name: 'Sam R.',
    alias: 'Sam R.',
    title: 'Undergraduate · Business Administration',
  },

  // ---------------------------------------------------------------- mediator
  {
    // Deliberately NOT one of the four group owners: the supervisor oversees
    // the groups, so their identity stays outside them.
    username: 'dana.whitfield',
    password: 'mediator',
    role: ROLE.MEDIATOR,
    name: 'Dana Whitfield',
    alias: 'Dana Whitfield',
    title: 'Triage Supervisor · Dean of Students Office',
  },

  // --------------------------------------------------------------- providers
  {
    username: 'elena.vance',
    password: 'counseling',
    role: ROLE.PROVIDER,
    name: 'Dr. Elena Vance',
    alias: 'Dr. Elena Vance, LCSW',
    title: 'Licensed Clinical Social Worker',
    group: 'Counseling',
  },
  {
    username: 'marcus.thorne',
    password: 'advising',
    role: ROLE.PROVIDER,
    name: 'Marcus Thorne',
    alias: 'Marcus Thorne, Academic Advisor',
    title: 'Academic Advisor',
    group: 'Academic Advising',
  },
  {
    username: 'sarah.jenkins',
    password: 'financial',
    role: ROLE.PROVIDER,
    name: 'Sarah Jenkins',
    alias: 'Sarah Jenkins, Financial Aid Lead',
    title: 'Financial Aid Lead',
    group: 'Financial Aid',
  },
  {
    username: 'jordan.martinez',
    password: 'peer',
    role: ROLE.PROVIDER,
    name: 'Jordan Martinez',
    alias: 'Jordan Martinez, Student Advocate',
    title: 'Student Advocate',
    group: 'Peer Support',
  },
];

/** The seeded credentials for one role, for the login screens' help panel. */
export function accountsForRole(role) {
  return DEMO_ACCOUNTS.filter((a) => a.role === role);
}

/** Provider accounts grouped by assignmentGroup — used by the provider login. */
export function providerGroups() {
  return ASSIGNMENT_GROUPS;
}

/**
 * verifyCredentials({ username, password, role })
 *
 * Returns a session object on success, or `null`. Deliberately returns null
 * rather than "wrong password" vs "no such user" — not for security theatre,
 * but because the login screen has no honest way to distinguish them anyway.
 */
export function verifyCredentials({ username, password, role } = {}) {
  const user = String(username || '').trim().toLowerCase();
  const pass = String(password || '');

  const account = DEMO_ACCOUNTS.find(
    (a) => a.username.toLowerCase() === user && a.password === pass
  );
  if (!account) return null;
  // Signing in on one role's page with another role's account is a mistake
  // worth naming, so this is a null with the reason attached by the caller.
  if (role && account.role !== role) return null;

  return toSession(account);
}

export function toSession(account) {
  return {
    role: account.role,
    username: account.username,
    name: account.name,
    alias: account.alias || account.name,
    title: account.title || '',
    group: account.group || null,
    issuedAt: new Date().toISOString(),
  };
}

/** Find an account by username regardless of password (used for hints/errors). */
export function accountExists(username) {
  const user = String(username || '').trim().toLowerCase();
  return DEMO_ACCOUNTS.some((a) => a.username.toLowerCase() === user);
}

/**
 * The assignable staff roster, DERIVED from the accounts rather than hardcoded
 * in the Agent Workspace. Keeps the assignee dropdown and the login screen from
 * inventing different people.
 */
export function staffRoster() {
  return [
    'Unassigned',
    ...DEMO_ACCOUNTS.filter((a) => a.role === ROLE.PROVIDER).map((a) => a.alias),
  ];
}
