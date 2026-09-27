# TriageNow — DESIGN.md

**Art direction:** *Editorial Case Desk*, after studiors.be.

This file is the contract. If a value is not in here, it does not go in the
build. It exists so that three people writing frontend the night before a
hackathon produce one coherent product instead of three portfolios.

Reference: [studiors.be](https://studiors.be) — Romain Savigny's portfolio.
Its language: a warm near-black canvas, bone text, warm-gray meta, one
expressive serif, pill-shaped controls, sharp content panels, hairline rules,
and chroma spent only where it carries meaning.

---

## 1. Why this direction

The product is a **routing engine for student crisis**, and the judges are
designers-adjacent professionals. studiors proves the register that reads as
*crafted* rather than *generated*: editorial typography on a warm black, flat
surfaces separated by hairlines, generous section rhythm, and restraint —
colour appears only when it is data.

Two consequences drive everything below:

1. **Warm dark surfaces.** Near-black with a faint ochre cast (`#0e0e0d`,
   not `#0a0a12`). Cool blacks read as "tech template"; warm blacks read as
   print. Urgency signals stay the brightest thing on screen.
2. **Restraint.** Colour is a data channel, not decoration. Bone is chrome.
   Green means *signal/healthy*, amber means *degraded*, red means *a human is
   in danger*. If everything glows, nothing means anything.

---

## 2. The two governing technical rules

**Rule 1 — Hairlines over shadows.**
studiors separates surfaces with 1px lines, not elevation stacks. Panels are
flat and sharp; depth comes from luminance steps between `--ink-*` values.
Inner top highlights survive only on interactive controls.

**Rule 2 — Numerals never jitter.**
Every counter, countdown, SLA timestamp, `sys_id`, Case number and correlation
id uses `font-variant-numeric: tabular-nums`, and identifiers additionally use
the mono stack. A live SLA countdown that reflows its own width every second is
the single most obvious "unpolished" tell on a projected screen.

---

## 3. Tokens

All tokens live in `client/src/styles/tokens.css`. **Components consume semantic
roles only.** `--ink-800` is a primitive; `--panel` is a role. If you find
yourself writing `#20201e` in a component, you are doing it wrong.

### 3.1 Surfaces

| Primitive | Hex | Role |
|---|---|---|
| `--ink-950` | `#0e0e0d` | page canvas (studiors' exact body background) |
| `--ink-900` | `#161614` | shell, topbar, rails |
| `--ink-800` | `#20201e` | panel — default card background |
| `--ink-700` | `#2e2e2a` | raised panel, hover state |
| `--carbon`  | `#090908` | near-black used *on* bone surfaces (inverted panels) |

### 3.2 Bone — the light

| Token | Hex | Role |
|---|---|---|
| `--bone` | `#ece9e2` | primary text; filled controls (studiors' exact foreground) |
| `--bone-dim` | `#b9b6ae` | secondary text, avatar fill |
| `--bone-faint` | `#8d8a83` | meta text (studiors' exact meta gray) |

### 3.3 Hairlines

`--line-1` (subtle divider) · `--line-2` (card border) · `--line-3` (strong /
control outline) · `--line-4` (emphasis / hover). All are bone at low alpha —
on dark, separation is a light line, never a shadow.

### 3.4 Text

| Token | Value | Contrast on panel | Use |
|---|---|---|---|
| `--text-hi` | bone | 14.9:1 | headings, values, primary content |
| `--text-mid` | bone-dim | 8.6:1 | body copy, secondary info |
| `--text-lo` | bone-faint | 5.0:1 | meta, timestamps, hints |
| `--text-xlo` | `#5f5c55` | 3.4:1 | decorative only — never information |

Body text targets **7:1**. Nothing informational goes below 4.5:1.

### 3.5 Data colour (the only place saturation is allowed)

| Channel | Tokens | Meaning |
|---|---|---|
| Signal | `--signal` `#62d98c` | brand, healthy, live indicators |
| Accent | `--accent` `#d9b36a` | warm ochre: staff comments, editorial touches |
| Urgency | `--urg-h` `#e5484d` · `--urg-m` `#d9a03f` · `--urg-l` `#6fcf97` | triage output |
| Status | `--st-new` `#7fb3e3` · `--st-assigned` `#b7a4e3` · `--st-inprogress` `#d9a03f` · `--st-resolved` `#6fcf97` | the four mandated states |
| Sentiment | `--snt-severe` `#e5484d` · `--snt-distressed` `#e07a45` · `--snt-concerned` `#d9b36a` · `--snt-routine` `#6fcf97` | rules-engine classification |
| Priority | `--pri-1..4` | impact x urgency matrix |

Data hues are detuned ~8% toward the warm cast of the canvas so badges sit
*inside* the palette instead of vibrating on top of it. The ServiceNow green
remains the brand signal, dimmed to a tone that belongs on warm black.

### 3.6 Space, radii, type

- Space is a **4px rhythm**: `--s-1` (4) through `--s-12` (128). Section gaps
  use `--s-12` — studiors' 128px section rhythm.
- Radii: `--r-xs` 3 · `--r-sm` 5 · `--r-md` 8 · `--r-lg` 12. **Surfaces are
  sharp** (`--r-sm` on panels); **controls are pills** (`--r-pill` 99px) — the
  studiors signature contrast.
- Type scale: kicker 10.5 · label 11.5 · mono 12 · body 13.5 · body-lg 15 ·
  title 20 · display 32 · hero 44.

**Type roles (not optional):**
- **Display — Cabinet Grotesk 800** — headings and KPI numerals,
  `letter-spacing:-.02em`.
- **UI — General Sans 500–700** — all interface text, labels, controls.
- **Serif — Zodiak** — the student's own words: submission quotes, case
  statements, conversation copy. The single strongest signal that this was
  *designed*, borrowed directly from studiors' Zodiak body text.
- **Kicker** — uppercase, 10.5px, `letter-spacing:.14em`, `--text-lo`. Labels a
  region. Always above a title, never inline.
- **Mono** — every identifier and every number that changes on screen.

### 3.7 Typography: self-hosted Fontshare faces

General Sans, Cabinet Grotesk and Zodiak ship from
[Fontshare](https://www.fontshare.com) (free licence, by ITF). Six woff2
subsets (~126 KB raw, ~169 KB base64) live in
`client/src/styles/fonts/` and are inlined into `fonts.css` so the single-file
offline bundle stays self-contained. Bundle budget after the change:
~526 KB — above the old 400 KB ceiling, an accepted trade for a fully
art-directed stage presence with zero network dependency.

---

## 4. Motion

**Motion encodes state change. It never decorates.** If an animation does not
tell the user that something *happened*, delete it.

| Token | Duration | Used for |
|---|---|---|
| `--dur-micro` | 120ms | hover, focus, chip press |
| `--dur-state` | 200ms | values changing, tints, badge swaps |
| `--dur-surface` | 320ms | panels entering, route transitions |

One curve, always: `--ease: cubic-bezier(.22,.61,.36,1)`.

**Required behaviours**
- A live SSE update flashes the changed row once (`--dur-state` tint fade).
- Entering the at-risk SLA window starts a *breathing* pulse — a signal, not
  a loop for its own sake.
- The ambient aura shifts hue with the highest live urgency present.
- Queue rows stagger in on mount, 24ms apart, capped at 8 rows.

**Prohibited**
- Animating text the user is currently reading (numbers must not count up
  mid-sentence — count-up is for dashboard KPIs on load only).
- Parallax, bounce, spring overshoot, or decorative looping shimmer that is not
  a loading state.
- Anything above 400ms.

**`prefers-reduced-motion: reduce` is honoured globally**: all durations
collapse to 1ms, the aura stops animating, pulses become static, and stagger
is removed. The `#/design` gallery has a toggle so the whole team can check.

---

## 5. Signature set pieces

These are the wow budget. Each one has to *mean* something.

1. **Ambient urgency aura** — warm ochre-to-red radial gradients behind the
   shell whose hue moves calm bone-warmth -> amber -> red with the highest live
   urgency. Driven by the `--aura-*` custom properties from app state.
   Atmosphere that is also a status readout.
2. **Routing flow** — an SVG rail: *Category -> Assignment Rule ->
   assignmentGroup -> SLA target*, with a token travelling the path on submit
   and re-travelling when a rule changes. It explains the entire product in
   three seconds and becomes the backdrop of the Rules Console.
3. **Priority matrix** — a real 3x3 impact x urgency heat grid (ServiceNow's
   actual priority derivation), with the selected Case plotted as a pulsing
   marker and a live impact override.
4. **SLA ring** — SVG `stroke-dashoffset` countdown, breathing as it nears
   breach, label in tabular mono.
5. **Activity timeline** — a connecting rail, staggered entry, live-flash on
   SSE, with internal **Work Notes** (amber) distinct from public **Comments**
   (warm ochre accent).
6. **Lifecycle stepper** — the four mandated statuses as a timeline with
   per-stage SLA markers, not a generic numbered stepper.
7. **Editorial serif quotes** — the student's words set in Zodiak italic inside
   statement boxes and the conversation feed. studiors' voice, carrying the
   product's empathy.

---

## 6. Components and required states

Every interactive primitive defines: **rest · hover · focus-visible · active ·
disabled · loading**, plus **empty** and **error** where it renders data.

- **Focus** — `2px solid var(--signal-line)` with a 2px offset.
  Browser defaults are never acceptable; a projected demo is judged on keyboard
  focus staying visible.
- **Buttons** — all pills (`--r-pill`), uppercase 12.5px with wide tracking:
  primary (bone fill, carbon ink — the studiors "Continuer" button), secondary
  (hairline outline), ghost, danger-outline (urgency red). The signal green
  fills only live-status affordances, never the primary CTA.
- **Inputs** — carbon well (`--carbon`) with `--line-2`, bone border on focus.
  Labels are always visible; placeholders are never the only label.
- **Badges** — pill, `--r-full`, tinted background + 1px line + coloured text.
  The urgency badge carries a dot; on `High` the dot pulses.
- **Cards** — `--ink-800`, `--r-sm`, hairline border, `--s-5` padding, no
  shadow stack.
- **Empty / loading / error** — designed per surface. Skeletons shimmer in
  bone tones; an empty state names the surface and the next action.

`#/design` renders every token and every component in every state. It is the
guardrail, and it doubles as evidence of design-system rigour.

---

## 7. Vocabulary (non-negotiable)

The ServiceNow vocabulary mandate outranks every visual decision. Never rename,
never abbreviate, never "improve" these:

- **Case** — never Request, Ticket or Issue.
- **assignmentGroup** — never department, team or queue-owner.
- **Assignment Rule** — the triage lookup.
- **SLA target** — never deadline, due date or timer.
- Statuses are exactly **New / Assigned / In Progress / Resolved**. Four, and
  only four. Do not add "Awaiting Info" as a status — model waiting states as a
  flag so the vocabulary stays intact.

Categories (5) and assignmentGroups (4) are fixed business vocabulary. The
Rules Console may change *mappings, keywords and thresholds* — never the
vocabulary itself.

---

## 8. Rules (do / don't)

**Do**
- Pull every value from a token.
- Use one mono face for all identifiers and changing numbers.
- Reserve saturated colour for data; keep chrome bone.
- Design the empty, loading and error state before the happy path.
- Keep one vertical rhythm per screen; use `--s-12` between sections.

**Don't**
- Write raw hex, raw px spacing, or hand-rolled shadows in a component.
- Introduce a second accent hue "for variety".
- Animate text being read, or exceed 400ms.
- Let a number on screen be a hardcoded placeholder. Every figure the UI shows
  must be computed from real data — a judge who catches one invented number
  stops believing all of them.
- Claim a capability the code does not have.
- Put a cool blue-black or a pure white anywhere. The palette is warm.
