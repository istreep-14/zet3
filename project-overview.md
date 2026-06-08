# TipPool — Project Overview & Improvement Guide

This file summarizes every file in the app, what it does (in both technical and plain-language terms), and concrete ways to simplify, improve, and restructure it. It builds on `tippool-audit.md`, which documents the current state in detail — read that for the full function-by-function inventory.

---

## What this app is (plain language)

TipPool is a single-page web tool used at the end of a bar/restaurant shift to:
1. Count the cash in the drawer (by bill denomination).
2. Enter who worked, when, and what role.
3. Automatically split the tip pool fairly among staff based on hours worked.
4. Show exactly which physical bills to hand to each person, so the payout matches the math with real cash.

It supports two modes — a **night shift** (one shared cash pool, bartenders + servers) and a **day shift** (multiple simultaneous "party pools" with overlapping staff windows).

---

## File-by-file summary

### Markup & entry
- **`index.html`** — The single page: tabs for Home, Cash, Staff, Summary, Distribution; modals for person details and session import/export.
  - *Technical:* Static DOM scaffold that JS wires up at runtime; no templating engine.
  - *Plain:* The actual screen layout — every button, input box, and panel users see and tap.
- **`old/v1_index.html`** — Earlier version of the page, kept for reference/history.
- **`package.json`** — Defines the `npm test` script that runs the three `*.test.js` files with plain Node (no test framework/bundler).

### Core logic (pure, no DOM) — the "math" layer
- **`js/engine.js`** — The tip/bill distribution solver: figures out which physical bills (100s, 50s, 20s, etc.) go to each staff member so totals match.
  - *Technical:* Multi-stage pipeline (preflight → preferred path → cascading sieve → DFS → grading) plus rebalancing helpers for small bills.
  - *Plain:* The "brain" that decides who gets which bills out of the drawer.
- **`js/engine_day.js`** — Same idea but for day shift: computes overlapping work windows across multiple pools and splits each pool's cash by hours worked in that window.
- **`js/utils.js`** — Small pure helper functions: parsing numbers/times, formatting hours/clock times, escaping HTML, computing a pool's dollar value.
- **`js/engine.test.js`, `js/engine_day.test.js`, `js/utils.test.js`** — Hand-written Node test scripts (no framework) that assert the above logic produces correct results.

### State
- **`js/state.js`** — Declares ~25 global variables (e.g. `lastStaff`, `livePool`, `cashMode`, `dayPools`) that every other file reads and writes directly, with no encapsulation.
  - *Plain:* The app's shared "memory" — what was last calculated, what mode you're in, what's in the drawer right now.

### UI / DOM glue layers
- **`js/cash.js`** — Night-shift cash entry: reads bill-count inputs, validates them, computes totals, switches between "enter bills" and "enter net total" modes.
- **`js/cash_day.js`** — Same job as `cash.js` but for the day-shift's multiple simultaneous cash pools (party pools), including enabling/disabling pools and tracking each one's time window.
- **`js/staff.js`** — Adds/removes staff rows, computes each person's hours from clock-in/out times, tracks closer status, keeps tab order and section counts in sync.
- **`js/cards.js`** — Updates the small "stock card" stat tiles (total cash, bill count, staff count) and the home-tab live summary dashboard.
- **`js/tabs.js`** — Switches between the Home/Cash/Staff/Summary/Distribution tabs and updates the little notification dots/subtitles on tab buttons.
- **`js/modals.js`** — Generic open/close logic for popup dialogs (person profile, import/export menu).
- **`js/shift.js`** — Toggles between night-shift and day-shift mode, showing/hiding the relevant sections and re-running the calculation.
- **`js/persist.js`** — Saves/restores app state to `localStorage`, and exports/imports a session as a downloadable JSON file.
- **`js/person.js`** — Powers the "person profile" modal where you can view/edit one staff member's hours and see their bill assignment.

### Orchestration & rendering
- **`js/calculator.js`** — The hub: gathers all inputs (staff rows, cash totals), decides whether it's safe to calculate, calls the engines, and triggers all the renderers. `autoCalculate()` is invoked from ~15 different input handlers across the app.
- **`js/summary.js`** — Renders the night-shift "Summary" tab (per-person totals, hours, leftover cash).
- **`js/summary_day.js`** — Renders the day-shift summary, the day-shift bill-distribution table, and the home-tab live dashboard for day mode.
- **`js/dist.js`** — Renders the night-shift "Distribution" tab: the bill-by-bill breakdown table, small-bill trade previews, and requirement cards.
- **`js/main.js`** — Bootstrap script that runs once on page load: sets the date, restores saved state, wires up global listeners (viewport resize for mobile keyboards, date field changes), and kicks off the first calculation.

### Styling
- **`css/*.css`** — One stylesheet per UI area (cash, staff, summary, dist, modals, tabs, shift, header, home, person-modal) plus `variables.css` (design tokens/colors/spacing) and `base.css`/`defaults.css`/`components.css` for shared primitives.

---

## Ways to simplify, improve, and restructure

### 1. Eliminate the global-state grab bag (`state.js`)
- **Technical:** Replace ~25 bare globals with a single state object/store (or even just a module-scoped object passed explicitly), and stop letting every file mutate it directly. Introduce simple pub/sub or just explicit return values so renderers don't reach into globals (`lastDistributionError`, `lastRemainderBills`, `livePool`, etc.).
- **Plain language:** Right now almost any part of the app can secretly change "the current numbers," which makes bugs hard to trace — something on the Staff tab can silently break the Cash tab. Centralizing this into one clearly-owned place means each part of the app gets exactly the data it needs, nothing more, and changes are traceable.

### 2. Make `distributeBills` (and friends) return data instead of mutating globals
- **Technical:** `distributeBills` currently writes `lastRemainderBills`, `lastDistributionError`, `lastPoolAfter` as side effects; have it return `{ remainderBills, error, poolAfter, staffWithBills }` instead, and pass that explicitly to `renderSummary`/`renderDist`.
- **Plain:** Functions that calculate something should hand back an answer, not quietly scribble it on a shared whiteboard that other functions then have to go check. This makes the calculation testable and reusable in isolation (e.g., for a future export/print feature).

### 3. Separate computation from rendering in `calculator.js`
- **Technical:** Split `calculate()`/`autoCalculateDay()` into a pure "compute" step (returns a result object) and a "render" step (takes that object and updates the DOM). This lets you swap renderers (e.g., add a print view or PDF export) without touching calculation code.
- **Plain:** Currently "do the math" and "draw it on screen" are tangled together in one function. Separating them means you could add a printable receipt or export feature later without risking breaking the math.

### 4. Decouple staff identity from DOM element IDs
- **Technical:** `staffId`/`serverStaffId` are tied to `#staff{id}` elements, and closer status is read live from `#ct{id}.classList.contains('on')` during calculation. Move to a real data model (array of staff objects with `{id, name, in, out, isCloser, role}`) that the DOM is rendered *from*, not read *into*.
- **Plain:** Staff records currently only "exist" as HTML elements on the page — to know if someone is a closer, the code has to go check a button's CSS class. A proper data model would make staff data something you can save, load, validate, and test independently of what's drawn on screen.

### 5. Tame the `autoCalculate` fan-in
- **Technical:** ~15 input handlers across `cash.js`, `staff.js`, `cash_day.js`, `modals.js`, `shift.js` directly call `autoCalculate()`, which recomputes everything and writes to `localStorage` on every keystroke. Add a debounce (e.g., 150–250ms) and/or a single delegated input listener that funnels through one entry point.
- **Plain:** Every keystroke currently triggers a full recalculation, redraw, and disk save — this can feel laggy on slower devices/phones and wastes battery. Waiting briefly after the user stops typing before recalculating would feel just as instant but use far fewer resources.

### 6. Remove dead code (already identified in the audit)
- `fmtClock`, `addClockMinutes`, `poolFromSnapshot`, `syncPoolToInputs`, `isSwitchingCashMode`, `collectStaffInputRows`, `applyBestFlipperPlan`, the unused `ideals` return from `runPreflight`, and the orphaned CSS rules (`.home-live-row`, `.person-meta` family, `.info-box`).
- **Plain:** These are functions and styles nobody uses anymore — deleting them shrinks the codebase and removes the risk that someone "fixes" or relies on something that's actually inert.

### 7. Modularize with ES modules / a bundler
- **Technical:** Convert the `<script>`-tag globals-sharing setup into ES modules with explicit `import`/`export`. Optionally add a lightweight bundler (esbuild/Vite) so files can be split further without manual `<script>` ordering in `index.html`.
- **Plain:** Right now every JS file silently shares one big namespace and must be loaded in exactly the right order. Modules make dependencies explicit — you can see at a glance what each file needs and provides, and reordering `<script>` tags can no longer break things.

### 8. Consolidate the two parallel pipelines (night vs. day)
- **Technical:** `cash.js`/`cash_day.js`, `summary.js`/`summary_day.js`, and parts of `calculator.js` duplicate very similar logic for night vs. day shift. Consider a shared "pool" abstraction that both modes feed into, with mode-specific config rather than near-duplicate files.
- **Plain:** The app essentially has two near-copies of itself for the two shift types. Unifying the shared parts (cash counting, bill rendering) while keeping only the genuinely different bits (single pool vs. multiple overlapping pools) would cut the amount of code to maintain roughly in half.

### 9. Add structure/typing to catch bugs earlier
- **Technical:** Introduce JSDoc typedefs (or migrate to TypeScript) for the core data shapes — `StaffMember`, `Pool`, `DistributionResult`, `DayShiftResult` — so editors can flag mismatches before runtime.
- **Plain:** Adding lightweight type annotations means your editor can warn you the moment you pass the wrong kind of data somewhere, instead of the bug only showing up when a real user hits it.

### 10. Expand test coverage beyond the engines
- **Technical:** Currently only `engine.js`, `engine_day.js`, and `utils.js` have tests. Add tests for `calculator.js`'s compute step (once separated from rendering per #3) and for `persist.js`'s import/export validation.
- **Plain:** The "brain" of the app is tested, but the "glue" that wires inputs to that brain isn't — adding tests there would catch regressions when refactoring the DOM-coupled code (which is exactly the riskiest code to change).

---

## Suggested order of attack

1. Remove dead code (#6) — zero risk, immediate cleanup.
2. Separate compute from render in the calculator (#3) and make `distributeBills` return data (#2) — these two go together and unlock everything else.
3. Replace the global state object with a single store (#1) and a real staff data model (#4).
4. Add debouncing to `autoCalculate` (#5) — quick win for performance.
5. Convert to ES modules (#7), then tackle the night/day duplication (#8).
6. Layer in typing (#9) and broaden test coverage (#10) as the structure stabilizes.
