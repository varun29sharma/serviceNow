# TriageNow — pitch script

**Format:** ~4 minutes, then questions.
**Vocabulary that must not slip:** **Case** (never request/ticket),
**assignmentGroup** (never department), **Assignment Rule**, **SLA target**,
**priority** (always derived, never "chosen"). Statuses: **New / Assigned /
In Progress / Resolved**.

Every number below is computed by the build. Check them live before you present
with `npm run seed` — the script and the screen must agree, or the room stops
believing the rest.

---

## Act 1 — The problem (40s)

> *"In higher education, a student in crisis does not know where to turn. They
> email five inboxes, or they say nothing at all. Meanwhile the same staff are
> manually sorting suicidal ideation alongside questions about parking permits —
> and the student who is worst off is usually the least able to describe how
> urgent their own situation is.*
>
> *We asked a different question: what if student support ran the way a service
> desk runs? Every request becomes a **Case** the moment it is written, routed
> to the right **assignmentGroup** by a configurable **Assignment Rule**, under a
> real **SLA target**, with a **priority** derived from impact and urgency —
> instead of guessed."*

---

## Act 2 — The student side (45s)

Open **Student Portal**.

1. Click **🚨 Severe crisis (Mental Health)**.
2. Two things happen at once, before they submit anything:
   - A **crisis intercept** appears with the 988 lifeline and the campus 24/7
     team. Point out that it **does not block submission** — a form that gets in
     the way here is the worst possible design.
   - The **Knowledge Base panel** starts matching on their own words.
3. Submit, and notice what the student never did: **they never picked a
   priority.** That is the whole thesis. The Assignment Rule reads "thoughts of
   suicide", raises urgency to High, sets a **2-hour SLA target**, flags
   sentiment **Severe Crisis**, and routes to **Counseling**.

> *"The student does not have to self-diagnose how urgent their own crisis is.
> That is exactly the judgement we cannot ask them to make."*

---

## Act 3 — The Case tracker: transparency (25s)

On the status screen, point at three things:

- **The lifecycle** — New → Assigned → In Progress → Resolved, on a timeline.
- **The SLA ring** — counting down against the 2-hour target, breathing as it
  approaches breach.
- **"Why it routed here"** — the decision path, with the exact words that caused
  it: *"you said 'suicide', so this went to Counseling at High urgency."*

> *"Most systems hide routing from the student. We show it, because a decision
> you can explain is a decision you can be held to."*

---

## Act 4 — The Rule Console — **the centrepiece** (70s)

Switch to **Assignment Rules**. This is the act that wins it.

> *"In ServiceNow, routing logic is not code. It is a record an administrator
> edits. So we built that."*

1. Point at the banner: **"Running the backtest winner."**
2. Point at the score strip:
   - **30 of 36 exact**, **100% recall on High urgency**, 87% precision,
     36/36 within one level — measured against 36 labelled Cases, chosen from
     **105 candidate configurations**. Not hand-tuned. Selected by search.
3. **Now break it live.** Set the five crisis keyword weights — `suicide`,
   `kill myself`, `self harm`, `hurt myself`, `cant go on` — to **0**.
   - Recall collapses **100% → 77%**.
   - Then click **Replay queue with these rules**: **"1 of 13 Cases would route
     differently"** — and that Case is *Nadia F., the one Severe Crisis Case in
     the queue*, dropping from **High to Low**.
   - Pause. Let that land.
4. Click **Reset to backtest winner**.
5. In the **Rule Tester**, type something that *sounds* dramatic but is not:
   *"I am failing two classes and I am urgently behind."* → **High urgency, but
   P2** — because impact is Medium. Use this to make the point explicit:

> *"Urgency is how soon. Impact is how bad if we get it wrong. Priority is
> derived from both — it is never a third human guess. The queue is ordered by
> that derivation."*

**The line that closes this act:**

> *"And here is the part we want you to hold us to: we did not route a suicide
> disclosure through a language model. Every classification here is
> deterministic keyword matching you can read, replay and audit. It has no
> hallucination path — which is the only defensible design for safety-critical
> triage, and the reason we can tell you the accuracy of the rule that is
> actually running."*

---

## Act 5 — Agent Workspace and leadership (45s)

**Agent Workspace.**

- The queue is **priority ordered**, with P1 first.
- The cockpit shows **impact and urgency as controls, and priority as a derived
  readout** — you can override impact, and priority re-derives and is written to
  the audit trail.
- **Work Notes** (internal, amber) are visually distinct from **Comments**
  (public, cyan). Click *Insert response template* to show the reviewable draft.
- Click **🚨 Escalate**: the SLA target genuinely compresses to a one-hour
  window, and the activity log records the real before → after.

**Dashboard.**

> *"13 Cases. **54% deflection** — 15 of 28 inbound requests were answered from
> the Knowledge Base and never reached a counselor. **77% SLA adherence**, with
> the 3 breaches shown rather than hidden. 8.7 advisor hours saved this week,
> about 453 over a year."*

> *"Every one of those numbers is computed from stored records. There is not a
> single hardcoded figure on that screen — and if there were, you would be right
> not to trust the rest."*

**Close:**

> *"TriageNow is the ServiceNow mental model applied where it matters most:
> Cases routing to assignmentGroups by rules you can edit, under SLAs you can
> measure, with priorities derived rather than guessed — and every decision
> explainable to the student on the other end. Thank you."*

---

## Q&A — prepare for these

**"Is the AI real, or is it faked?"**
Neither word. It is not AI and it is not faked — it is a deterministic rules
engine, deliberately. Keyword scoring, lookup tables and response templates. The
UI says so on screen. We think a probabilistic model in this path would be
indefensible, and we would rather defend that position than demo a black box.

**"Where does 54% deflection come from?"**
15 persisted deflection records over the last 7 days against 28 inbound
requests. Each record is written when a student clicks "this solved it", and
carries the article id — so the leaderboard and the rate are derived, and they
do not change if you restart the API.

**"Why only 77% SLA adherence?"**
Because 3 Cases breached before we shipped, and we show them. Two of the three
are deliberately seeded acute cases that were never assigned. A queue that
reports 100% is a queue that is not measuring.

**"What is the priority formula?"**
Impact × urgency through a 3×3 matrix, exactly as ServiceNow derives it. Impact
comes from the domain and risk profile — Mental Health is always High impact —
and urgency comes from what the student wrote. You can edit the matrix in the
Rules Console.

**"Does this scale? Would you really keyword-match?"**
The engine is a swappable config behind a pure function, which is why 105 of
them could be scored automatically. The next step is the same loop with a
trained classifier: keep the harness, keep the auditability, replace the scoring
function. What we would not do is remove the auditability.

**"What about privacy, with student mental-health data?"**
Fair, and out of scope for today. The shape is right — no third-party model
calls means nothing leaves the instance, and the activity stream gives a
complete audit trail. Real deployment needs authentication, role-based access to
Work Notes, and a retention policy.

---

## Demo-day checklist

- [ ] `npm run verify` — backtest, 30 tests, 92 smoke assertions all green.
- [ ] `npm run build`, then open `client/dist/index.html` from `file://` in a
      private window. This is the stage build: no server, no network.
- [ ] Add `?demo=1` (or click the mode badge) so it runs offline.
- [ ] Click **Reset demo data** so the numbers start at 13 Cases / 54%.
- [ ] Toggle **☀ Projector** if the room is washed out; toggle **Reduced motion**
      off before presenting.
- [ ] Rehearse Act 4 three times. It is the act that wins.
- [ ] Say **Case**, never "ticket".
- [ ] If a number on screen disagrees with this script, **the script is wrong** —
      read the screen.
