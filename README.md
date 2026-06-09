# Tip Pool

A mobile-first, framework-free single-page app for calculating and distributing a cash tip pool among staff. Built for back-of-house use — no server, no login, no dependencies. Works offline from a local file.

---

## What it does

You count the cash in the drawer, enter your staff and their shift times, and the app tells each person exactly which bills to take. The distribution engine tries to make every envelope as fair as possible — balanced bill mix, proportional payout by hours, with a configurable closer bonus for the last person out.

---

## Running the app

Open `index.html` directly in any modern browser, or serve the repository root with any static file server:

```bash
npx serve .
# or
python3 -m http.server
```

No build step, no npm install, no bundler. Everything loads as plain `<script>` tags and CSS `<link>` tags in order.

---

## Features

### Cash entry — two modes

**Per Bill** lets you type the count of each denomination ($100 through $1). Subtotals update live and the total is shown at the bottom.

**Net Total** lets you type a single dollar figure. The app then computes an ideal bill breakdown that minimizes the number of small bills while guaranteeing exact change for every payout. Switch between modes freely — each mode remembers its own snapshot.

### Staff management

Add employees with a name, an In time, and an Out time. Times are entered as decimal hours on a 12-hour clock (e.g. `5` for 5 pm, `2` for 2 am, `10.5` for 10:30 pm). Fields left blank fall back to the global defaults set in the **Default Times** panel.

The **closer** toggle (the `c` button on each row) marks an employee as a closer. Any employee whose Out field is blank is automatically treated as a closer until they fill it in.

### Tip calculation

Tips are split proportionally by hours worked:

1. Each person's raw share is `hours × (total / totalHours)`.
2. Shares are floored to whole dollars.
3. The remainder goes to closers, split evenly and floored again.
4. Any final leftover dollar(s) stay in the drawer.

### Bill distribution engine

After calculating payouts, the engine figures out exactly which physical bills go to each person. This is a constrained exact-change problem. The pipeline runs in this order:

1. **Preflight check** — verifies cash on hand covers all payouts and that there are enough $1s and $5s to cover the fractional parts.
2. **Preferred path** — apportions $100s and $50s proportionally, then fills lower denominations in a balanced sweep. This succeeds for most realistic tip pools.
3. **DFS fallback** — if the preferred path can't find an exact solution, a depth-first search explores up to 100 valid paths and picks the one with the most even bill distribution.
4. **Rebalancing passes** — after the primary solve, the engine swaps $20s against small bills and shuffles $10/$5/$1 bundles between people to reduce variance in small-bill counts.

If no exact solution exists (not enough of a needed denomination), a warning is shown explaining what's missing.

### Summary tab

Shows the total pool, rate per hour, and a card for each person with their hours, base pay, closer bonus (if any), total payout, and the specific bills they receive. Tapping a card opens a full profile sheet with editable In/Out fields.

### Distribution (Dist) tab

A table showing every person's bill-by-bill allocation side by side, with column totals and a "Cash on Hand" footer row for verification.

### Home dashboard

A live status card that tells you whether the session is ready, pending, or needs attention. Metric tiles show the hourly rate, total paid out, and remainder. Four shortcut buttons navigate to each section.

---

## Persistence

The app auto-saves to `localStorage` on every meaningful change. Saved state includes:

- Date
- Cash mode and all bill counts (both per-bill and net-total snapshots kept separately)
- All staff rows (name, in, out, closer flag)
- Global default times

State is saved under the key `tippool_v1` and validated on load — malformed or incompatible data is discarded rather than crashing the app.

**Export / Import** (the `⋯` menu in the header) lets you save a session as a dated `.json` file and reload it later. Imported files go through the same schema validation before being accepted.

**New Session** clears localStorage and reloads the page.

---

## Project structure

```
index.html          Entry point — markup, tab panels, modals, script load order
manifest.json       PWA manifest for the static app
package.json        Test script metadata

css/
  variables.css     Design tokens: colors, radii, spacing, font families
  base.css          Reset, body layout, safe-area handling, shared utilities
  header.css        App header and session menu
  tabs.css          Bottom tab bar, tab buttons, status dots
  components.css    Shared UI pieces: section headers, empty states, warning boxes
  home.css          Home dashboard: status card, metric grid, action buttons
  cash.css          Cash tab: per-bill rows, net-total input, ideal breakdown
  staff.css         Staff tab: employee rows, time fields, closer/delete controls
  defaults.css      Default Times modal panel
  summary.css       Summary tab: hero total, person cards, bill chips, totals strip
  dist.css          Distribution table and cash-on-hand footer
  modals.css        Bottom-sheet overlay and slide animation
  person-modal.css  Person profile sheet: avatar, hours block, tip grid, bill chips

js/
  state.js          Global mutable state variables and shared constants (DENOMS, $)
  persist.js        localStorage save/load, JSON export/import, session clear
  utils.js          Pure helpers: number/time parsing, HTML escaping, formatting
  engine.js         Distribution algorithm — pure functions, zero DOM access
  engine_day.js     Day-shift calculation engine
  modals.js         Modal open/close helpers
  tabs.js           Tab switching, content scroll reset, tab indicator updates
  cash.js           Cash input handling, net-total ideal breakdown, mode switching
  cash_day.js       Day-shift cash-pool input handling
  staff.js          Staff row add/remove/edit, hours display, tab-order management
  shift.js          Night/day mode switching
  cards.js          Home mini-cards and live dashboard rendering
  summary.js        Summary tab HTML generation
  summary_day.js    Day-shift summary and distribution rendering
  dist.js           Distribution table HTML generation
  remainder.js      Remainder and drawer-leftover rendering
  person.js         Person profile modal content and inline edit callback
  support.js        Support-role controls
  calculator.js     Calculation orchestration: collect inputs → engine → render
  main.js           Bootstrap: restore state, wire visualViewport, initial render

js/tests/
  engine.test.js    Distribution engine tests (Node.js)
  engine_day.test.js Day-shift engine tests (Node.js)
  utils.test.js     Utility parsing tests (Node.js)

docs/
  audit.md          Full codebase audit
  overview.md       Project overview and improvement guide
  design-assessment.md Design-system assessment notes

design-system/      Separate React design artifact and preview cards
```

Script load order in `index.html` matters: `state.js` first (globals), `main.js` last (bootstrap).

---

## Running tests

```bash
npm test
```

The test files use Node's built-in `assert` and `vm` modules — no test runner required. `engine.test.js` loads `utils.js` and `engine.js` into an isolated VM context and runs distribution scenarios covering bill proportionality, small-bill spread, and edge cases with unusual denominations.

---

## Design system

All visual tokens live in `css/variables.css`. Key values:

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0a0a0f` | Page background |
| `--surface` / `--surface2` / `--surface3` | dark navy layers | Cards, inputs, headers |
| `--accent` | `#e94560` | Red — errors, active states, closers |
| `--gold` / `--gold2` | `#f5c842` / `#ffd966` | Money values |
| `--green` | `#2ecc71` | Positive states, closer bonuses |
| `--blue2` | `#7ab8ff` | Staff count indicators |
| `--font-mono` | IBM Plex Mono | All numeric and label text |
| `--font-sans` | IBM Plex Sans | Names and body copy |
| `--tab-h` | `60px` | Tab bar height |
| `--hdr-h` | `52px` | Header height |
| `--safe-bottom` | `env(safe-area-inset-bottom)` | iPhone home bar clearance |

The app constrains itself to a `max-width: 480px` centered column and is designed entirely around a phone viewport. Minimum tap target size is 44px on interactive controls.

---

## Calculation notes

- Times are treated as 12-hour decimal values. `5` means 5:00 on whichever half-day context implies. Hours crossing midnight are handled by adding 12 when `out < in` (e.g. in at 5 pm, out at 2 am = 9 hours).
- If no In or Out is supplied and no global default is set, the app uses `5` (in) and a computed `out` based on the latest observed out time across all staff.
- Closer bonus: remainder after flooring all base pays is split equally among closers. Any residual after that sits in the drawer as a true leftover.
- The engine only distributes whole-dollar amounts. It never creates fractional bills.
