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
on the spot.

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

## Headline numbers (reproduce them with `npm run seed`)

| Metric | Value |
|---|---|
| Seeded Cases | 13, across all 4 assignmentGroups, all 4 urgenties, P1–P4 |
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
npm run seed           # wipes + inserts 13 demo Cases and the deflection history
npm run dev            # Express API on :4000 and the React app on :5173
```

Needs MongoDB on `127.0.0.1:27017` (`mongodb://127.0.0.1:27017/triagenow`), or
set `USE_MEMORY_DB=1` for an in-memory instance.

**Offline demo mode** — the primary stage surface. Add `?demo=1` to any URL, or
click the mode badge in the topbar. The Assignment Rule, priority matrix and
backtest scoring all run in the browser against the same shared modules the
server uses, with no backend at all.

**Single-file build** — `npm run build` produces one standalone
`client/dist/index.html` (~354 kB) that runs from `file://`, no server, no
network.

---

## Commands

| Command | What it does |
|---|---|
| `npm run setup` | installs both packages |
| `npm run seed` | seeds Cases + deflection history |
| `npm run backtest` | the 36-Case × 105-config grid search |
| `npm test` | 30 unit + parity tests |
| `npm run smoke` | 92 end-to-end API assertions |
| `npm run verify` | sync cases → backtest → tests → smoke |
| `npm run sync:cases` | regenerates the browser mirror of the backtest set |
| `npm run build` | single-file production build |
| `npm run dev` | API + client together |

---

## API

| Route | Purpose |
|---|---|
| `POST /api/requests` | create a Case (the active Assignment Rule runs here) |
| `GET /api/requests?group=X` | one assignmentGroup queue, or `group=All`; priority ordered |
| `GET /api/requests/:id` | one Case with profile and activity stream |
| `PATCH /api/requests/:id` | status, assignee, **impact** override, notes |
| `POST /api/requests/:id/notes` | append a Work Note or public Comment |
| `POST /api/requests/:id/escalate` | expedite the SLA target and raise the tier |
| `GET /api/requests/deflection` | Knowledge Base search for self-service |
| `POST /api/requests/deflection/deflect` | record a deflection (persisted) |
| `GET /api/requests/stream` | Server-Sent Events live feed |
| `GET /api/dashboard` | derived analytics: rates, trends, leaderboards |
| `GET /api/rules` | active config, backtest winner, both scores |
| `PUT /api/rules` | validate and save a new config |
| `POST /api/rules/preview` | evaluate a description (optionally against unsaved edits) |
| `POST /api/rules/reset` | restore the backtest winner |
| `GET /api/rules/score` | re-score the active config |

There is no authentication, per the project scope. The queue group selector is
the only access control, and rule editing is unprotected — it is a hackathon
build, not a deployment.

---

## Layout

```
client/src/
  styles/tokens.css          the design system's only source of truth
  styles/fonts.css           self-hosted Cabinet Grotesk / General Sans / Zodiak
  styles.css                 token-driven editorial case desk
  lib/{viz,motion,liveStatus,backtestCases.generated}
  components/                aura, routing flow, priority matrix, SLA ring,
                             activity timeline, skeletons, shared UI atoms
  pages/                     Submit · Status · Queue · Dashboard · Rules · Design
server/src/
  triage/triageRequest.js    the Assignment Rule (pure)
  triage/priorityMatrix.js   impact x urgency -> priority (pure)
  triage/nowAssistEngine.js  KB search, classification, templates, payload
  rules/ruleSchema.js        config defaults + vocabulary validation (pure)
  rules/configStore.js       persistence for the editable config
  rules/backtestScore[Pure]  scoring, shared by CLI, API and browser
  seedCases.js               the one seed builder both backends use
backtest/                    labelled cases + the grid-search harness
docs/DESIGN.md               the written design system
docs/share-back.md           the presentation script
```

### Why the shared modules matter

`client/src/demoApi.js` imports the *real* triage module, priority matrix, rule
schema, scoring and seed builder from `server/src`. Demo mode is therefore not a
mock — it is the same engine with a different storage backend, which is why
`npm test` can assert that demo mode and the live API return identical
dashboards, identical routing and identical queue ordering for identical data.
(An early version had them diverge: the server seeder inserted bare documents
while the demo built rich ones, so the live path had empty activity streams and
the dashboard fell back to invented numbers. That class of bug is now a failing
test.)

---

## Design system

The art direction is an **editorial case desk**, after studiors.be: warm
near-black canvas, bone text, Cabinet Grotesk display / General Sans UI /
Zodiak serif for the student's own words, pill controls on sharp panels, hairlines
over shadows, mono identifiers with tabular numerals, and motion that encodes
state change only.

- `docs/DESIGN.md` — the written contract: tokens, type roles, elevation recipe,
  motion policy, component states, and the rules.
- `#/design` — the gallery. Renders every token (read live from the CSS custom
  properties, so it cannot drift), every component state, every set piece, and
  toggles for reduced motion and projector mode.

Reduced motion is honoured globally, including for JS/SMIL animation that CSS
media queries cannot reach.

---

## Known limitations

- No authentication; rule editing is open.
- Rule state is global, not per-user or per-group.
- The Knowledge Base is a fixed in-repo article set, not administered in-app.
- Deflection matching is keyword overlap, not semantic search.
- `PATCH /api/requests/:id` accepts an impact override but not a bulk update.
- State codes in the Table API payload are TriageNow's mapping; instances
  configure their own choice values.
