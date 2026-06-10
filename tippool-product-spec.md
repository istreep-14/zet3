# TipPool — Night Shift Product Specification
**Version 1.0 — Night Shift Focus**
*Day shift deferred for future revision*

---

## 1. What This App Is

A mobile-first, offline-capable web app for a bar manager or lead bartender to split and physically distribute tip pool cash among staff at close of night shift. No server, no login, no install. Works from a phone in a dimly lit bar at 2:30am.

The single deliverable is: **each person's name and the exact bills they receive from the drawer.**

---

## 2. The Real-World Context

### The environment
- Phone in hand, behind a bar, end of shift
- Physical tip bucket: holds $20s and larger
- Guest check booklet: holds $1s, $5s, $10s accumulated through the shift
- POS register: source of bill exchanges during the shift; **emptied by manager at close** (small window to exchange bills after last check closes)
- Slips of paper: staff who leave early write their time window on a slip and drop it in the tip bucket

### The people
- **Bartenders** — 2 to ~8 per shift, staggered start times
  - Sun–Wed: first bartender in at 3pm
  - Thu–Sat: first bartender in at 4pm
  - Additional staff stagger: +1h, +2h, etc. based on expected volume
- **Closers** — the last staff standing; always minimum 2; earn the closer bonus (remainder after floor splits)
- **Non-closers** — leave early, write their out-time slip and drop it in the bucket; may leave at different times through the night

### The physical bill flow
Tips come in as mixed denominations. Throughout the night:
1. $1/$5/$10s land in the guest check booklet next to register
2. Manager or lead exchanges small bills from booklet into register for $20s/$50s/$100s — this cleans up the tip bucket and reduces small bill volume
3. Sometimes the tip bucket itself is reorganized mid-shift: $20s exchanged up to $50s/$100s where possible
4. At close: last check settled, final tips added. Register emptied by manager. **Short window** to make final bill exchanges.

---

## 3. The Core Problem — The Information State Spectrum

This is the central design challenge. At any point during a shift, the manager may know:

```
ZERO INFO                                                    COMPLETE INFO
─────────────────────────────────────────────────────────────────────────
   │           │              │              │                    │
Pre-shift   Mid-shift     Last check       Bills &          Exact count,
staff set,   rough         closed,         some times       all out times,
no tips      count only    tip range       known            close time set
```

The app must be **useful and non-blocking at every point on this spectrum.** It should never require complete information to show something helpful.

### The five knowledge states

| State | What's known | What the app should show |
|---|---|---|
| **Pre-shift** | Staff names, expected start times. No tips. | Staff entry ready; defaults pre-filled; tip fields blank but ready |
| **Mid-shift rough** | Staff set; maybe a rough total ("about $800"); maybe some out-times from slips in bucket | Rough split preview; minimum small bill guidance with partial info |
| **Close range** | Tips approaching final; know close time is "2:30 or 2:45"; may not know all out times | Range of splits across possible close times; small bill minimum for the range |
| **Bills known, times partial** | Exact bill count in bucket + booklet; some non-closer out times unknown | Full distribution attempt with closer placeholders; surface which unknowns matter |
| **Complete** | All bills counted, all out times known, close time confirmed | Exact per-person payout and exact bills to hand each person |

---

## 4. Detailed Workflow

### Phase 1: Pre-shift / early shift (done before tips matter)
- Open app (or it's already open — localStorage restores session)
- Staff list already has frequent names from roster; add/confirm who's in tonight
- Set start times (defaults auto-fill by day of week: Sun–Wed = 3, Thu–Sat = 4)
- Out times left blank for now — closers auto-detected as "no out time entered"

### Phase 2: Mid-shift (opportunistic)
- When a non-closer leaves, they drop their slip in the bucket → enter their out time in app
- If rough tip total is visible, enter it to see a live preview of approximate split
- Use the minimum small bill calculator to decide what to keep vs. exchange into register

### Phase 3: Post-last-check (time-pressured)
- Count what's in the tip bucket + booklet
- Enter bill counts (or net total if not counted by denomination)
- Verify close time for non-closers who haven't submitted times
- App tells you exactly what minimum small bills you need; decide whether to exchange more
- If register still has bills: make final exchanges guided by app's "what you need" display

### Phase 4: Distribution
- All info entered; app shows per-person payout with exact bills
- Hand each person their bills

### Phase 5: Post-distribution correction (happens more than expected)
- A bill was miscounted → total is different → some people owe or are owed
- A late tip surfaces after envelopes are already handed out → extra money to distribute
- Someone's out time was written wrong on their slip → their hours change → payouts shift
- App computes the delta from the original distribution and shows the simplest person-to-person trades to settle it using only bills already in each person's possession

---

## 5. The Small Bill Minimum Logic

This is the mental math the manager does instinctively. The app should surface it explicitly and do it live.

### The rule
For a pool of N staff with C closers:

**Minimum $1s needed:**
```
sum(each_person_payout % 5)
+ max(0, C - 1)        ← one extra for remainder if closers > 1
```

**Minimum $5s needed:**
Approximately `sum(each_person_payout % 10) / 5`, rounded for $1 coverage already handled.

**Minimum $10s + $50s:**
One per person whose payout has an "odd tens digit" (i.e. `floor(payout / 10) % 2 !== 0`).
$50s substitute for $10s — a $50 covers one odd-tens-digit person (and provides $40 in implicit $20-equivalent coverage).

**Practical implication (what the manager checks):**
If I have more small bills than this minimum, I can exchange the surplus up to $20s/$50s/$100s before the register closes. If I have fewer, I need to break larger bills first.

### Example: 3 staff (2 closers), ~$1280 total
Approximate splits: $390, $445, $445
- Min $1s: `(390%5) + (445%5) + (445%5) + (2-1)` = 0 + 0 + 0 + 1 = **1 $1** (in this case minimal)
- If splits were $391, $444, $445: `1 + 4 + 0 + 1` = **6 $1s**
- Min $5s: depends on $1 coverage vs mod-10
- Min $10s/$50s: one per person with odd tens = depends on final splits

### The "I only know there are 2 $50s" case
Even with no other info, if there are 2 $50s and 3 workers:
- 2 $50s can cover 2 people's odd-tens digits
- Max additional $10s needed: 1 (for the third person's odd-tens, if applicable)
- This lets the manager decide: if register has $10s, maybe I don't need them

### Shortage vs. surplus — emphasis is not equal

These are two different problems with very different urgency:

**Shortage (no solution exists)** — the register window may already be closed. The distribution engine cannot produce exact change. This is a **blocking condition** that must be surfaced prominently, immediately, with a clear explanation of exactly what's missing and what to do about it (break a larger bill if any remain).

**Surplus (consolidation)** — you have more small bills than needed and could trade up to $20s for cleaner envelopes. This is a **luxury**. Nice to have, especially on high-small-bill nights, but never blocking and never urgent. It should be available as a secondary action, not front-and-center.

Current app gets this backwards: the trade cards are equally prominent. Shortage should read as an error state. Surplus should read as an optional tidying action.

---

## 6. UI Philosophy

### Core principle: **one primary screen, everything else secondary**
The Summary view — who gets what — is the app's reason for existing. It is the default view and the one the manager should never have to navigate away from during distribution.

### Input vs. view modes
The app has two modes, not tabs:
- **Input mode**: Staff names/times, bill counts — fast entry, minimal chrome
- **View mode / Summary**: The payout result — clear, readable, one card per person

Switching between them should feel like flipping a notepad, not navigating a menu.

### Navigation philosophy
- **No home screen** with metric tiles and shortcut buttons
- **No tab bar** as primary navigation
- **No wizard** (don't force a sequence)
- Input sections collapse/expand inline; summary always visible or one tap away
- Modals/bottom sheets for: bill distribution detail, bonus adjustment, individual person profile

### Time input
iPhone clock-style scroll wheel (or drum/slot picker) — fast for decimal hours, no keyboard required. Current number input is usable but slow on mobile for repeated edits.

### Bill entry
Three modes, switchable:
1. **Per-bill count** (current) — enter quantity of each denomination
2. **Net total** (current) — enter one number, app computes ideal bill breakdown
3. **Partial known** (new) — "I know there are [X] $50s, [Y] $100s" without counting everything — app computes minimum small bills needed and shows what's unknown

### Incremental tip entry (new)
Instead of only entering a final total, support:
- **Set total**: current behavior
- **Add amount**: `+ $18` appended to running total — useful when a late tip comes in or when transcribing from multiple sources (bucket + booklet)

---

## 7. Staff Management

### Roster (future feature, highest priority addition)
A saved list of all bartenders. At start of session, tap names to add them to tonight's crew. No retyping names that appear every week.

- Roster is stored in localStorage, separate from session state
- Each person has: name, typical start time (per day of week), role
- Tonight's session copies from roster; times can be edited per-session
- Roster management: add, edit, remove people

### Start time defaults
- Per-day-of-week defaults: Sun–Wed = 3, Thu–Sat = 4
- User-configurable; stored in localStorage
- Applied to new rows automatically; can override per person
- Also configurable per roster entry (person-specific defaults)

### Out times
- **Blank = closer** (auto-detected, no flag needed for standard case)
- Can mark as closer manually even with out time (override)
- Entry from slip in bucket: tap person, enter their written time
- Should be enterable at any point — before, during, or after bill entry

### Close time
- **Exact**: enter 2, 2.5, etc. (current)
- **Range** (new): enter "between 2 and 2.5" — app shows distribution for both endpoints and highlights where the answer changes

---

## 8. Features — Priority Order

### Must-have (core loop works without these being perfect, but they're central)

| # | Feature | Current state | Change needed |
|---|---|---|---|
| 1 | Per-person payout calculation | ✅ Working | Keep logic; improve display |
| 2 | Bill distribution engine | ✅ Working | Keep entirely |
| 3 | Closer bonus (remainder split) | ✅ Working | Keep; surface more clearly |
| 4 | localStorage session persistence | ✅ Working | Keep |
| 5 | Summary view (one card per person) | ✅ Working | Make primary/default view |
| 6 | Minimum small bill calculator | ⚠️ Buried in dist tab | Surface to input/cash view |

### High priority (significantly changes usability)

| # | Feature | Current state | Change needed |
|---|---|---|---|
| 7 | Roster / people list | ❌ Missing | Add: saved names, tap to add |
| 8 | Day-of-week start time defaults | ⚠️ Partial (global defaults) | Add per-day-of-week config |
| 9 | Incremental tip entry (+$X to total) | ❌ Missing | Add: accumulator mode |
| 10 | Range close time input | ❌ Missing | Add: min/max range, show both |
| 11 | "Partial bill known" entry mode | ❌ Missing | Add: enter only known denoms |
| 12 | Scroll-wheel time input | ❌ Missing | Replace number field for times |
| 13 | Post-distribution adjustment trades | ❌ Missing | New: see Section 14 |
| 14 | Bill shortage — prominent blocking state | ⚠️ Present but understated | Promote to error-level prominence |

### Medium priority (quality of life)

| # | Feature | Current state | Change needed |
|---|---|---|---|
| 15 | Close time exploration table | ⚠️ Clock modal (buried) | Simplify; link from summary |
| 16 | Per-person bill profile modal | ✅ Working | Keep; link from summary card |
| 17 | Export / import session (JSON) | ✅ Working | Keep as-is |
| 18 | Remainder manual adjustment | ✅ Working | Keep; simplify access |
| 19 | Bill exchange advisor — **shortage only** | ⚠️ In dist tab (trade cards) | Keep for shortage case only; simplify |
| 20 | Manager/office person bill preference | ❌ Missing | Add: see Section 15 |
| 21 | Rubber-banded stack entry | ❌ Missing | Add: bulk quantity shortcut for $1 stacks |

### Lower priority / deferred

| # | Feature | Current state | Note |
|---|---|---|---|
| 22 | Bill consolidation (surplus → $20s) | ✅ Working | **Demoted** — luxury feature; keep as secondary, never prominent |
| 23 | Day shift mode | ✅ Working | Deferred — reconsider separately |
| 24 | Support staff / tip-out | ✅ Working | Deferred with day shift |
| 25 | Distribution table (full view) | ✅ Working | Keep as modal/secondary |

---

## 9. Screen Architecture

### Proposed structure (replacing current tab model)

```
┌─────────────────────────────────────┐
│  HEADER: "Tip Pool" · date · ⋯ menu │
├─────────────────────────────────────┤
│                                     │
│  STAFF SECTION (collapsible)        │
│  [roster picker or name rows]       │
│  [time inputs per person]           │
│                                     │
│  CASH SECTION (collapsible)         │
│  [bill entry — per-bill or total]   │
│  [minimum small bill indicator]     │
│  [+ add amount button]              │
│                                     │
│  ─────────────── SUMMARY ────────── │
│  [always-visible; grows as data     │
│   fills in; cards per person]       │
│                                     │
│  [Distribution detail →] (modal)    │
│  [Remainder adjust →] (modal)       │
│                                     │
└─────────────────────────────────────┘
```

### Modal / sheet inventory
- **Distribution sheet**: bill-by-bill table; currently in dist tab → move to bottom sheet
- **Person profile sheet**: hours, tips, bills for one person; currently exists → keep
- **Remainder adjustment sheet**: manual bonus allocation; currently exists → keep
- **Close time explorer**: "what if close is 2:15 vs 2:30" table → keep as sheet, simplify
- **Roster manager**: add/edit/remove people from saved list → new sheet
- **Session menu** (⋯): export, import, new session → keep as-is

---

## 10. What Changes in the Code

### Files to keep unchanged
| File | Reason |
|---|---|
| `js/engine.js` | Pure distribution math; fully tested; do not touch |
| `js/utils.js` | Pure helpers; do not touch |
| `js/engine_day.js` | Keep for later; do not touch |
| `css/variables.css` | Design tokens are solid; extend but don't rewrite |
| Test files | Working; keep |

### Files to significantly rework

| File | What changes |
|---|---|
| `index.html` | Remove tab bar; restructure as single scrollable page with collapsible sections; remove home tab panel |
| `js/state.js` | Add: `rosterPeople`, `tipAccumulator`, `closeTimeRange`, `sessionCashMode:'partial'`; remove day-shift state (move to separate file) |
| `js/cash.js` | Add: incremental (`addToTotal`) mode; add partial-known mode (enter some denoms, leave others as "unknown"); surface min-small-bill result near cash entry |
| `js/staff.js` | Add: roster integration (tap-to-add); add scroll-wheel time input trigger; per-person out-time entry from anywhere in summary |
| `js/calculator.js` | Add: range-close-time computation (run twice, surface delta); add roster save-to-localStorage on name change |
| `js/cards.js` | Remove: home dashboard; home tab entirely |
| `js/tabs.js` | Remove: full tab system; replace with section scroll + anchor logic |
| `js/summary.js` | Make this the primary rendered section (always visible, updates live); no longer a "tab" |
| `js/dist.js` | Move distribution table to bottom sheet; remove as primary panel |
| `js/persist.js` | Add: roster persistence (separate key from session state) |

### New files needed

| File | Purpose |
|---|---|
| `js/roster.js` | Saved people list CRUD; tap-to-add to session; per-person defaults |
| `js/timepicker.js` | Scroll-wheel / drum-roll time input component |
| `css/roster.css` | Roster sheet styles |
| `css/timepicker.css` | Time picker styles |

### CSS changes

| File | What changes |
|---|---|
| `css/tabs.css` | Remove tab bar entirely or repurpose as section indicators |
| `css/home.css` | Remove entirely (home tab removed) |
| `css/summary.css` | Summary becomes primary content area; adjust margins and hero treatment |
| `css/staff.css` | Add roster picker row styles; add scroll-wheel input affordance |
| `css/cash.css` | Add partial-entry mode styles; add min-bill indicator component |

---

## 11. The Minimum Small Bill Component

This is a new UI element that lives in the cash section. It shows:

```
┌─ Minimum small bills needed ────────────────────────┐
│  $1s   6     have 14  ✓ +8 exchangeable             │
│  $5s   3     have 6   ✓ +3 exchangeable             │
│  $10s  2     have 5   ✓ +3 exchangeable             │
│                                                      │
│  [Exchange surplus →]  saves to dist engine          │
└──────────────────────────────────────────────────────┘
```

Updates live as:
- Bill counts change
- Staff times change (affects payout amounts → affects odd-digit counts)
- Close time changes

When information is incomplete (e.g., no out times yet), shows range:
```
│  $1s   4–7   have 14  ✓ safe to exchange down to 7  │
```

---

## 12. Key Design Decisions and Constraints

### What the app is not
- Not a POS system
- Not a payroll system
- Not a shift scheduling tool
- Not a "tips over time" tracker

### Constraints
- Must work offline (no network dependency)
- Must work on a phone screen (480px max-width, one-hand use)
- Must be fast — the manager is tired and time-pressured
- Cannot require input in a specific order
- Must show something useful with partial information

### The tolerance for ambiguity
Every field should have a meaningful fallback. The app should never show an error that blocks the user from seeing a partial answer. If some data is missing:
- Show the calculation with available data
- Indicate what's unknown (greyed out, dotted, "~" prefix on estimates)
- Do not require completing a "step" before proceeding

---

## 13. Open Questions (to resolve in next session)

1. **Scroll-wheel time input**: native `<input type="time">` or custom drum-roll component? Native is accessible but limited to 24h format and doesn't support decimal hours.
2. **Roster storage key**: Should roster live under its own localStorage key (survives `New Session`) or be part of session state? — **Recommendation: separate key, survives new session.**
3. **Partial bill entry**: When user enters only $100s and $50s in partial mode, should the "unknown" denoms be treated as zero or as "calculate minimum"? — **Recommendation: calculate minimum needed, flag that you still need to confirm small bills.**
4. **Range close time UX**: Two sliders? Two inputs? A single input with a ± tolerance? — **Recommendation: two inputs (from / to) that appear when you tap a "range" toggle next to the close time field.**
5. **Summary as default**: Should the summary auto-scroll into view once enough data is entered, or stay in its fixed position always? — **Recommendation: always in fixed position; let the input sections collapse once filled.**
