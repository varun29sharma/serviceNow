/**
 * Role and account tests.
 *
 * Two things worth asserting here, and neither is "the login works":
 *
 *   1. The seeded identities MATCH the ones the seeded Cases carry. The provider
 *      accounts use the same strings as the seeder's GROUP_OWNER, so a signed-in
 *      provider is genuinely the person the Case was assigned to. If those two
 *      ever drift apart the demo quietly stops making sense.
 *   2. The role scoping rules are what they claim. A provider locked to one
 *      assignmentGroup is a promise the whole Agent Workspace rests on.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEMO_ACCOUNTS,
  accountExists,
  accountsForRole,
  staffRoster,
  verifyCredentials,
} from '../src/auth/accounts.js';
import { ROLE, ROLE_META, ROLE_ORDER, canWorkQueues, roleHome, visibleGroups } from '../src/auth/roles.js';
import { ASSIGNMENT_GROUPS } from '../../server/src/constants.js';

test('there is exactly one account per provider group, and they are the group owners', () => {
  const providers = accountsForRole(ROLE.PROVIDER);
  assert.equal(providers.length, ASSIGNMENT_GROUPS.length, 'one provider per assignmentGroup');
  assert.deepEqual(
    providers.map((p) => p.group).sort(),
    [...ASSIGNMENT_GROUPS].sort()
  );
  // These aliases are the same strings the seeder writes into `assignedTo`.
  assert.ok(providers.some((p) => p.alias === 'Dr. Elena Vance, LCSW'));
  assert.ok(providers.some((p) => p.alias === 'Marcus Thorne, Academic Advisor'));
  assert.ok(providers.some((p) => p.alias === 'Sarah Jenkins, Financial Aid Lead'));
  assert.ok(providers.some((p) => p.alias === 'Jordan Martinez, Student Advocate'));
});

test('the mediator is not one of the group owners', () => {
  // A supervisor who also owned a group would make the "see every queue"
  // permission look like a conflict of interest.
  const mediator = accountsForRole(ROLE.MEDIATOR)[0];
  const ownerAliases = accountsForRole(ROLE.PROVIDER).map((p) => p.alias);
  assert.ok(!ownerAliases.includes(mediator.alias));
});

test('every seeded student alias exists in the seed data', () => {
  // A student account whose alias matches nothing would land on an empty portal
  // and look like a broken login rather than an empty one.
  const seededAliases = ['Jordan P.', 'Nadia F.', 'Sam R.'];
  for (const account of accountsForRole(ROLE.STUDENT)) {
    assert.ok(seededAliases.includes(account.alias), `${account.alias} should be a seeded alias`);
  }
});

test('an account verifies with its own credentials', () => {
  for (const account of DEMO_ACCOUNTS) {
    const session = verifyCredentials({
      username: account.username,
      password: account.password,
      role: account.role,
    });
    assert.ok(session, `${account.username} should sign in`);
    assert.equal(session.role, account.role);
    assert.equal(session.alias, account.alias);
    assert.ok(session.issuedAt);
  }
});

test('usernames are case-insensitive and whitespace-tolerant', () => {
  const session = verifyCredentials({ username: '  JORDAN.P ', password: 'student', role: ROLE.STUDENT });
  assert.ok(session);
  assert.equal(session.name, 'Jordan P.');
});

test('a wrong password, an unknown user, or a cross-role attempt all fail', () => {
  assert.equal(verifyCredentials({ username: 'jordan.p', password: 'nope', role: ROLE.STUDENT }), null);
  assert.equal(verifyCredentials({ username: 'nobody', password: 'student', role: ROLE.STUDENT }), null);
  // Signing in on the student door with the mediator's credentials.
  assert.equal(
    verifyCredentials({ username: 'dana.whitfield', password: 'mediator', role: ROLE.STUDENT }),
    null
  );
  assert.equal(verifyCredentials({}), null);
  assert.equal(accountExists('dana.whitfield'), true);
  assert.equal(accountExists('dana.whitfield '), true);
  assert.equal(accountExists('nobody'), false);
});

test('a provider session carries its group, a student session does not', () => {
  const provider = verifyCredentials({
    username: 'elena.vance',
    password: 'counseling',
    role: ROLE.PROVIDER,
  });
  assert.equal(provider.group, 'Counseling');
  assert.equal(roleHome(provider), '/queue/Counseling');

  const student = verifyCredentials({ username: 'jordan.p', password: 'student', role: ROLE.STUDENT });
  assert.equal(student.group, null);
  assert.equal(roleHome(student), '/student');
});

test('role homes land each role on a different product', () => {
  const homes = ROLE_ORDER.map((role) => roleHome({ role }));
  assert.equal(new Set(homes).size, ROLE_ORDER.length, 'no two roles share a home');
  assert.equal(roleHome({ role: ROLE.MEDIATOR }), '/queue/All');
  assert.equal(roleHome(null), '/login');
});

test('every role declares where an unauthenticated visitor should be sent', () => {
  for (const role of ROLE_ORDER) {
    assert.ok(ROLE_META[role].loginPath.startsWith('/login/'), `${role} needs a login path`);
    assert.ok(ROLE_META[role].permissions.length > 0);
    assert.ok(ROLE_META[role].cannot.length > 0);
  }
});

test('a provider sees exactly one assignmentGroup, a mediator sees all four', () => {
  const provider = { role: ROLE.PROVIDER, group: 'Financial Aid' };
  assert.deepEqual(visibleGroups(provider, ASSIGNMENT_GROUPS), ['Financial Aid']);

  const mediator = { role: ROLE.MEDIATOR };
  assert.deepEqual(visibleGroups(mediator, ASSIGNMENT_GROUPS), ASSIGNMENT_GROUPS);

  // A student can see no queue at all — this is the promise the role split makes.
  assert.deepEqual(visibleGroups({ role: ROLE.STUDENT }, ASSIGNMENT_GROUPS), []);
  assert.deepEqual(visibleGroups(null, ASSIGNMENT_GROUPS), []);
});

test('only staff roles may open the Agent Workspace', () => {
  assert.equal(canWorkQueues({ role: ROLE.MEDIATOR }), true);
  assert.equal(canWorkQueues({ role: ROLE.PROVIDER, group: 'Counseling' }), true);
  assert.equal(canWorkQueues({ role: ROLE.STUDENT }), false);
  assert.equal(canWorkQueues(null), false);
});

test('the assignable roster is derived from the provider accounts', () => {
  const roster = staffRoster();
  assert.equal(roster[0], 'Unassigned');
  for (const provider of accountsForRole(ROLE.PROVIDER)) {
    assert.ok(roster.includes(provider.alias), `${provider.alias} should be assignable`);
  }
  // Nothing invented beyond Unassigned + the four providers.
  assert.equal(roster.length, ASSIGNMENT_GROUPS.length + 1);
});
