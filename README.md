# TriageNow

ServiceNow-modelled student Case triage and routing. Built on authentic platform
concepts: **Case** · **assignmentGroup** · **Assignment Rule** · **SLA target** ·
impact × urgency **priority** · Work Notes vs public Comments. Statuses are
strictly **New / Assigned / In Progress / Resolved**.

---

## What this is

A student in distress writes one description. A configurable **Assignment Rule**
reads it, routes the **Case** to the right **assignmentGroup**, sets an **SLA
target**, and derives a **priority** from impact × urgency. Staff work a
priority-ordered queue with playbooks and an activity stream; leadership sees
operational analytics. Knowledge Base articles deflect some requests before they
ever become a Case.

Two positions define the build:

**1. Routing logic is a configurable record, not code.** That is the ServiceNow
model, and it is the demo: open **Assignment Rules**, change a keyword weight,
and the queue re-routes. Every edit is re-scored against a labelled backtest set
on the spot. The landing page puts the same thing on a slider.

**2. Routing is deterministic and auditable — there is no language model in the
decision path.** This is a deliberate engineering position, not a limitation.
A probabilistic model can hallucinate, cannot be replayed, and cannot be
audited; none of that is acceptable when the input may be a suicide disclosure.
A rules engine can be backtested, explained and reproduced — so the accuracy of
the rule *actually running* can be quoted, and every routing decision can be
justified to the student who wrote it.

Everything labelled "classification" or "template" in the UI is exactly what it
says: keyword matching and text templates. Nothing claims otherwise.

---

## Who signs in

Three roles, three doors — and genuinely different products behind each one.
Routes: `/login` (chooser) → `/login/student` · `/login/mediator` ·
`/login/provider`.

| Role | Username | Password | What it unlocks |
|---|---|---|---|
| **Student** | `jordan.p` | `student` | Their own Cases only: raise, track, and read *why* it routed where it did |
| Student | `nadia.f` | `student` | Same, with seeded history including a crisis Case |
| Student | `sam.r` | `student` | Same, with no history — for demoing the empty state |
| **Mediator** (triage supervisor) | `dana.whitfield` | `mediator` | Every assignmentGroup queue, the Assignment Rule console, escalation, the leadership dashboard |
| **Provider** — Counseling | `elena.vance` | `counseling` | The Counseling queue only |
| Provider — Academic Advising | `marcus.thorne` | `advising` | The Academic Advising queue only |
| Provider — Financial Aid | `sarah.jenkins` | `financial` | The Financial Aid queue only |
| Provider — Peer Support | `jordan.martinez` | `peer` | The Peer Support queue only |

**"Mediator" is not ServiceNow vocabulary**, so the build fixes its meaning: the
supervisor of the triage desk — the person who decides where a Case belongs when
the Assignment Rule needs a human, and who answers for the rule itself.

Provider identities are deliberately the same strings the seeder writes into
`assignedTo`, so a signed-in provider really is the person the Case was assigned
to, not a parallel cast invented for the login screen.

> **Honest scope.** There is no password hashing, no token and no server-side
> enforcement: passwords are compared client-side in `auth/accounts.js`, and the
> guards are React route guards. A determined visitor can bypass them from
> devtools. This is a demonstration of role-based **experience** — who sees which
> surface, and what the app does when the answer is "not you" — not a security
> boundary, and the login screens say so on screen.

A student session that opens another student's Case gets an explicit "this
belongs to another student" panel rather than a rendered record. Without a
server-side check that is the strongest honest claim available, so the app makes
it in words instead of implying it silently.

**`/submit` is public on purpose.** A person in crisis must never meet a login
wall, and the intake screen's own safety rule is that a blocked form is the worst
possible outcome.

---

## Headline numbers (reproduce them with `npm run seed`)

| Metric | Value |
|---|---|
| Seeded Cases | 13, across all 4 assignmentGroups, all 4 statuses, P1–P4 |
| Knowledge deflections | 15 across 6 articles (7-day history, real records) |
| Deflection rate | **54%** — 15 of 28 inbound requests answered without a Case |
| SLA adherence | **77%** — 10 of 13 inside target; 3 breached, 2 at risk |
| Advisor time saved | **8.7h / week** ≈ 453h per academic year |
| Backtest, shipped config | **30/36 exact**, 100% High-urgency recall, 87% precision, 36/36 within one level |
| Backtest, crisis keywords removed | 27/36 exact, **77%** High-urgency recall |

Every figure on the dashboard is computed from stored records. There are no
placeholder fallbacks: a zero renders as a zero.

---

## Quickstart

```bash
npm run setup          # installs server/ and client/ dependencies
npm run seed           # optional — see the note below
npm run dev            # Express API on :4000 and the React app on :5173
```

Needs MongoDB on `127.0.0.1:27017` (`mongodb://127.0.0.1:27017/triagenow`), or
set `USE_MEMORY_DB=1` for an in-memory instance.

`npm run seed` is **optional now**: the API seeds an empty database on boot, so
starting it against a fresh Mongo gives you the full 13-Case dataset instead of a
dashboard of zeroes. That boot-time seed is additive only — it never wipes — so
restarting the API cannot destroy Cases created during a demo. Disable it with
`SEED_ON_EMPTY=0`.

**Offline engine** — the stage surface. Add `?demo=1` to any URL, or click the
mode badge in the topbar. The Assignment Rule, priority matrix and backtest
scoring all run in the browser against the same shared modules the server uses,
with no backend at all.

**Single-file build** — `npm run build` produces one standalone
`client/dist/index.html` (~590 kB) that runs from `file://`, no server, no
network.

---

## Which backend am I talking to?

This used to be a bug worth explaining, so the fix is documented rather than
hidden.

The app decides once, at boot, in `client/src/lib/connection.js`:

1. It probes `GET /api/health` with a 2.5s timeout.
2. If the API answers, it runs **live**.
3. If nothing answers, it **falls back to the in-browser engine automatically**
   and says so — the badge reads `🟠 API unreachable · offline` and a banner
   offers **Reconnect**.
4. An explicit choice, or `?demo=1`, or a `file://` build skips the probe
   entirely, because the answer is already known.

The topbar badge reports **connectivity, not intent**: it says `🟢 Live API` only
when the API actually answered. A brief boot screen holds until the probe
settles, so no page ever mounts against a backend that turns out not to exist.
The chosen mode persists in `localStorage`, so closing the tab no longer resets
it.

The three states, and the honest wording for each, are unit-tested in
`client/test/connection.test.mjs`.

---

## Commands

| Command | What it does |
|---|---|
| `npm run setup` | installs both packages |
| `npm run seed` | wipes + re-seeds Cases and the deflection history |
| `npm run backtest` | the 36-Case × 105-config grid search |
| `npm test` | 30 server unit + parity tests, then 24 client role/connection tests |
| `npm run smoke` | 97 end-to-end API assertions |
| `npm run verify` | sync cases → backtest → tests → smoke |
| `npm run sync:cases` | regenerates the browser mirror of the backtest set |
| `npm run build` | single-file production build |
| `npm run dev` | API + client together |

---

## API

| Route | Purpose | Who |
|---|---|---|
| `POST /api/requests` | create a Case (the active Assignment Rule runs here) | public |
| `GET /api/requests?group=X` | one assignmentGroup queue, or `group=All` | staff |
| `GET /api/requests/:id` | one Case with profile and activity stream | public by link |
| `PATCH /api/requests/:id` | status, assignee, **impact** override, notes | staff |
| `POST /api/requests/:id/notes` | append a Work Note or public Comment | staff |
| `POST /api/requests/:id/escalate` | expedite the SLA target and raise the tier | staff |
| `GET /api/requests/deflection` | Knowledge Base search for self-service | public |
| `POST /api/requests/deflection/deflect` | record a deflection (persisted) | public |
| `GET /api/requests/stream` | Server-Sent Events live feed | staff |
| `GET /api/dashboard` | derived analytics: rates, trends, leaderboards | mediator |
| `GET /api/rules` | active config, backtest winner, both scores | mediator |
| `PUT /api/rules` | validate and save a new config | mediator |
| `POST /api/rules/preview` | evaluate a description (optionally against unsaved edits) | mediator |
| `POST /api/rules/reset` | restore the backtest winner | mediator |
| `GET /api/rules/score` | re-score the active config | mediator |
| `GET /api/health` | liveness probe the client uses to pick a backend | public |

The "Who" column describes the role the UI gates for. The API itself does **not**
enforce it — see the honest-scope note above. The queue group selector and the
route guards are the only access control.

---

## Layout

```
client/src/
  auth/                      roles, seeded accounts, AuthProvider, RequireRole
  lib/connection.js          the ONE place the backend is chosen (probe + fallback)
  lib/{viz,motion,liveStatus,useNow,backtestCases.generated}
  components/                aura, routing flow, priority matrix, SLA ring,
                             activity timeline, triage sandbox, skeletons, atoms
  pages/                     Home · Submit · Status · Queue · Dashboard · Rules ·
                             StudentHome · NotFound · login/{Index,Student,Mediator,Provider}
  styles/tokens.css          the design system's only source of truth
  styles/fonts.css           self-hosted Cabinet Grotesk / General Sans / Zodiak
  styles.css                 token-driven editorial case desk
client/test/                 24 unit tests for the role model and connection store
server/src/
  triage/triageRequest.js    the Assignment Rule (pure)
  triage/priorityMatrix.js   impact x urgency -> priority (pure)
  triage/nowAssistEngine.js  KB search, classification, templates, payload
  rules/ruleSchema.js        config defaults + vocabulary validation (pure)
  rules/configStore.js       persistence for the editable config
  rules/backtestScore[Pure]  scoring, shared by CLI, API and browser
  autoSeed.js                seed-on-boot for an empty database
  seedCases.js               the one seed builder both backends use
backtest/                    labelled cases + the grid-search harness
docs/DESIGN.md               the written design system
docs/share-back.md           the presentation script
```

### Why the shared modules matter

`client/src/demoApi.js` imports the *real* triage module, priority matrix, rule
schema, scoring and seed builder from `server/src`. So does the landing page's
sandbox, and so does the Assignment Rule preview on the student intake form.
The offline engine is therefore not a mock — it is the same engine with a
different storage backend, which is why `npm test` can assert that the two
return identical dashboards, identical routing and identical queue ordering for
identical data. (An early version had them diverge: the server seeder inserted
bare documents while the demo built rich ones, so the live path had empty
activity streams and the dashboard fell back to invented numbers. That class of
bug is now a failing test.)

---

## Design system

The art direction is an **editorial case desk**, after studiors.be: warm
near-black canvas, bone text, Cabinet Grotesk display / General Sans UI / Zodiak
serif for the student's own words, pill controls on sharp panels, hairlines over
shadows, mono identifiers with tabular numerals, and motion that encodes state
change only.

- `docs/DESIGN.md` — the written contract: tokens, type roles, elevation recipe,
  motion policy, component states, and the rules.
- `client/src/styles/tokens.css` — the enforced source of truth. It is the only
  file allowed to contain a raw colour or radius; `Aura`, the heat grid and every
  set piece consume semantic tokens rather than literals.

Reduced motion is honoured globally, including for JS/SMIL animation that CSS
media queries cannot reach.

---

## Known limitations

- No real authentication: passwords are compared client-side, unhashed, and the
  role guards are not enforced by the API. It demonstrates role-based experience,
  not security.
- Rule state is global, not per-user or per-group.
- The Knowledge Base is a fixed in-repo article set, not administered in-app.
- Deflection matching is keyword overlap, not semantic search.
- `PATCH /api/requests/:id` accepts an impact override but not a bulk update.
- State codes in the Table API payload are TriageNow's mapping; instances
  configure their own choice values.
- The ServiceNow Table API payload is an outbound preview with copy-as-cURL. It is
  never sent anywhere.
