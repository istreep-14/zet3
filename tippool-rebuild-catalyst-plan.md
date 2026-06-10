# TipPool Rebuild Catalyst Plan

Source spec: `tippool-product-spec.md`  
Companion context reviewed: `README.md`, `docs/overview.md`, `docs/design-assessment.md`, `docs/audit.md`, `index.html`, and the current `js/` and `css/` layout.

## 1. Executive Direction

The next major TipPool rebuild should be a focused night-shift-first redesign, not a math rewrite. The current app already contains working distribution formulas, bill allocation logic, local persistence, import/export, and a useful summary renderer. The rebuild should preserve those proven parts while replacing the user-facing flow and project structure around them.

The product should feel like a single mobile worksheet for a tired manager closing a bar, not like a multi-tab admin app. The user's real deliverable is still:

> Each person's name, final payout, and the exact bills to hand them.

Everything else should either help collect the minimum information needed for that answer, explain why the answer is not yet exact, or guide the manager through physical bill exchanges while the register is still available.

## 2. What Should Stay Stable

### Math and engine behavior to preserve

These pieces should be treated as trusted core logic unless a specific bug is found:

- `js/engine.js`
  - Bill distribution pipeline.
  - Small-bill preflight checks.
  - DFS fallback and rebalancing.
  - Shortage/trade preview helpers.
- `js/utils.js`
  - Time parsing.
  - Whole-number parsing.
  - Money/hour formatting helpers.
- Existing engine tests in `js/tests/`.
- Night-shift payout formulas:
  - Hours-based proportional split.
  - Floor base payouts to whole dollars.
  - Allocate remainder to closers.
  - Leave final non-distributable dollars in drawer.
- Local-only/offline operating model.
- Static deployability.
- No login, no server, no database requirement.

### Visual language to preserve and refine

The existing design direction is appropriate for the environment:

- Dark, high-contrast mobile UI.
- Gold money values.
- Mono/tabular numeric styling.
- Card-based person summaries.
- Bottom-sheet details for secondary information.
- 480px-ish phone-first layout.
- 44px minimum touch targets.

The rebuild should reuse or evolve `css/variables.css` and the design-system references instead of inventing a new brand language.

## 3. Current App Assessment

### Current strengths

- The app is simple to run: no build step, no dependencies, no server.
- The distribution engine is already isolated enough to test.
- `calculator.js` has started moving toward an explicit compute -> distribute -> render pipeline.
- Summary person cards are close to the desired final output format.
- The current app supports localStorage persistence and session export/import.
- The current app has useful secondary tools: close-time exploration, person profile sheet, remainder allocation, and distribution table.

### Current problems the rebuild should solve

1. Primary navigation is backwards for the real use case.
   - The app currently has Home, Cash, Staff, Summary, and Dist as peer tabs.
   - The spec says Summary is the app's reason to exist.
   - Summary should be primary/default, with inputs collapsed around it.

2. Home dashboard duplicates work without matching the closing workflow.
   - The home cards provide status and shortcuts, but the user is not trying to navigate a dashboard.
   - At 2:30am, the user needs the final cards and the unresolved blockers.

3. Staff and cash are separate destinations instead of inline inputs.
   - A manager may learn staff times, total tips, bill counts, and close time in any order.
   - The UI should support partial entry without implying a required sequence.

4. Small-bill shortage is not visually urgent enough.
   - Shortage blocks physical distribution and may require immediate register action.
   - Surplus/consolidation is useful but optional.
   - The current Dist tab can make these feel equally important.

5. State is still mostly DOM-shaped.
   - Staff records are read from rows.
   - Closer state is read from button class names.
   - Persistence serializes DOM fields.
   - Rebuild work will be easier if state becomes data-first.

6. Day-shift features are mixed into the night-shift product surface.
   - The product spec explicitly defers day shift.
   - Current files include `engine_day.js`, `cash_day.js`, `summary_day.js`, day pools, support roles, and shift toggles.
   - These can remain in the repository, but they should not drive the rebuild's primary UI.

7. Script-tag globals and manual load order limit maintainability.
   - The current architecture works, but it makes dependencies implicit.
   - A "nearly full rebuild" should introduce clearer file boundaries and data ownership.

## 4. Rebuild Product Principles

### Principle 1: One primary screen

The rebuilt night-shift app should have one main screen:

- Header.
- Session status.
- Collapsible Staff input section.
- Collapsible Cash input section.
- Always-present Summary section.
- Secondary sheets for advanced/detail actions.

No separate Home tab. No primary tab bar. No wizard.

### Principle 2: Useful at every information state

The app must show a useful partial answer for each known-information state:

| State | Known data | Primary UI response |
| --- | --- | --- |
| Pre-shift | Staff names and expected start times | Crew list ready; summary says tips missing |
| Mid-shift rough | Staff plus rough total | Estimated payout preview and small-bill range |
| Close range | Total near final, close time uncertain | Close-time range cards and delta highlights |
| Bills known, times partial | Exact bill counts, some out times missing | Attempt distribution; show unknowns that matter |
| Complete | All bill counts and times known | Exact person cards and exact bill chips |

### Principle 3: Inputs can arrive in any order

The app should never force "step 1, step 2, step 3." Instead:

- Staff can be entered before cash.
- Cash can be entered before all out times are known.
- Close time can be exact or a range.
- Some bill denominations can be known while others remain unknown.
- Late tips can be added after initial totals.
- Corrections can happen after distribution.

### Principle 4: Errors should be tied to physical action

Do not show abstract validation if the user needs physical guidance.

Example:

- Bad: "Distribution failed."
- Better: "Need 4 more $1s. Break one $20 into 10 x $1 and 2 x $5 if register is still open."

### Principle 5: Preserve trust in the math

The UI should explain enough that managers trust it, but not expose algorithmic complexity unless requested.

Good visible concepts:

- Total pool.
- Total hours.
- Rate per hour.
- Base payout.
- Closer bonus.
- Final payout.
- Exact bills.
- Missing small bills.
- Drawer remainder.

Secondary or hidden concepts:

- DFS fallback.
- Internal distribution scoring.
- Path grading.
- Rebalance passes.

## 5. Target User Flow

### 5.1 Pre-shift / early shift

The manager opens the app and sees:

1. Header with date and session menu.
2. "Tonight's crew" collapsed or partially open.
3. Saved roster chips or rows.
4. Summary placeholder:
   - "Add cash when tips are known."
   - Staff can already be visible as pending cards.

Recommended interactions:

- Tap roster names to add them to tonight.
- Start times auto-fill from day-of-week defaults.
- Out times stay blank.
- Blank out time means "likely closer / close-time dependent" until proven otherwise.

### 5.2 Mid-shift rough check

The manager can enter a rough total:

- Set total: `$800`
- Or incremental entry: `+18`, `+42`, `+150`

Summary shows:

- Estimated payouts with `~` labels.
- Small-bill minimum range when possible.
- Which missing out times could materially change payouts.

### 5.3 Last check / final count

The manager counts bucket + booklet:

- Bill-count mode for exact denomination entry.
- Net-total mode for known total without exact bills.
- Partial-known mode for "I know there are 2 x $50 and 4 x $100 but haven't counted smalls yet."

Cash section shows:

- Total known.
- Unknown denominations.
- Minimum $1/$5/$10 needs.
- Shortage state if current known small bills cannot satisfy exact payouts.
- Optional surplus exchange action below the urgent guidance.

### 5.4 Distribution

Summary section becomes the primary working area:

- One card per person.
- Name and closer badge.
- Time window and hours.
- Final payout in large text.
- Bill chips: `2 x $100`, `1 x $50`, `3 x $20`, etc.
- Tap card for detail/edit sheet.

Distribution table is not primary. It should be accessible from:

- "Distribution detail" sheet.
- Person card detail.
- Troubleshooting/verification action.

### 5.5 Post-distribution correction

When corrections occur:

- The app should preserve an "original distribution snapshot."
- User enters changed fact:
  - Bill count changed.
  - Late tip added.
  - Person out time corrected.
  - Close time changed.
- App computes deltas:
  - "Alex owes $3."
  - "Sam is owed $4."
  - "Use existing bills: Alex gives Sam 3 x $1."

This should be a separate correction mode/sheet because it changes the mental model from "hand out envelopes" to "settle already-handed cash."

## 6. Proposed Screen Architecture

### 6.1 Main page skeleton

```text
+----------------------------------------+
| Header: Tip Pool | date | session menu |
+----------------------------------------+
| Status strip                           |
| "Night shift - partial estimate"       |
+----------------------------------------+
| Staff section                          |
| [collapsed/expanded inline editor]     |
+----------------------------------------+
| Cash section                           |
| [mode switch + bill/total entry]       |
| [small-bill requirement component]     |
+----------------------------------------+
| Summary                                |
| [total/rate/paid/remainder]            |
| [person card]                          |
| [person card]                          |
| [person card]                          |
| [detail actions]                       |
+----------------------------------------+
```

### 6.2 Header

Keep header compact:

- Title: `TIP POOL`
- Date input.
- Status pill:
  - `Estimate`
  - `Needs times`
  - `Needs small bills`
  - `Ready`
- Overflow menu:
  - New session.
  - Export JSON.
  - Import JSON.
  - Roster manager.
  - Settings.

Do not make day/night shift a primary header control in the night-shift rebuild. If day shift remains, move it behind a settings/advanced mode gate until it has its own product spec.

### 6.3 Staff section

Default behavior:

- Starts expanded when no crew exists.
- Collapses after named staff exist.
- Shows a compact crew summary when collapsed:
  - `5 staff`
  - `2 closers assumed`
  - `2 missing out times`

Expanded contents:

- Roster picker row:
  - Saved names as chips.
  - "Add new person."
  - "Manage roster."
- Tonight rows:
  - Name.
  - In time.
  - Out time.
  - Closer indicator.
  - Hours.
  - Delete/swipe action.

Recommended row behavior:

- Name field can autocomplete from roster.
- Out time blank means "close-time dependent."
- Manual closer override exists but is visually secondary.
- Time inputs open the time picker sheet instead of numeric keyboard by default.
- Long press or secondary action can expose raw decimal entry for speed/power users.

### 6.4 Cash section

Default behavior:

- Starts expanded until some cash is entered.
- Collapses when summary is ready, but the small-bill status remains visible.

Cash modes:

1. Bill counts
   - Default for final count.
   - Denomination rows from $100 to $1.
   - Quantity, subtotal, and quick increment/decrement controls.

2. Net total
   - Useful for rough totals.
   - Shows ideal/minimum bill guidance.
   - Clearly marked as estimate if exact bills are unknown.

3. Partial known
   - User can enter known denominations and mark the rest unknown.
   - Example: `$100: 4`, `$50: 2`, `$20: unknown`, `$10: unknown`, `$5: unknown`, `$1: unknown`.
   - App should show possible minimums and "need to confirm" messages.

4. Incremental add
   - Not exactly a separate mode; it should be an action within total entry.
   - Examples:
     - `Set total: 842`
     - `Add: +18`
     - Running log: `700 + 42 + 100 = 842`

### 6.5 Summary section

Summary is the anchor of the product.

Top summary metrics:

- Total pool.
- Total hours.
- Rate/hour.
- Paid out.
- Remainder.
- Confidence/status:
  - Exact.
  - Estimate.
  - Range.
  - Blocked.

Person card hierarchy:

1. Name and closer/role badge.
2. Final payout.
3. Exact bills if available.
4. Hours/time window.
5. Base + bonus breakdown.
6. Tap target for edit/detail.

Person cards should support multiple confidence states:

- Exact:
  - `$445`
  - bill chips visible.
- Estimate:
  - `~$445`
  - bill chips hidden or labelled "not final."
- Range:
  - `$432-$451`
  - "depends on close time."
- Blocked:
  - payout known but bills not solvable.
  - missing denominations shown.

### 6.6 Secondary sheets

Use sheets, not tabs, for details:

| Sheet | Purpose |
| --- | --- |
| Person detail | Edit name/times, show exact pay math and bill assignment |
| Distribution detail | Full bill-by-bill table for verification |
| Remainder adjustment | Manual closer bonus/rem allocation |
| Close-time explorer | Compare payout and small-bill effects across possible close times |
| Roster manager | Add/edit/remove saved people and default times |
| Settings | Start-time defaults, time format, optional day-shift mode |
| Correction mode | Post-distribution delta settlement |

## 7. Small-Bill Requirement Redesign

### 7.1 Component purpose

This component should move out of the Dist tab and live near cash entry plus summary warnings.

It answers:

- What is the minimum needed?
- What do we have?
- Are we short?
- If short, what should be broken?
- If surplus, how much can be exchanged away safely?

### 7.2 Display states

#### Exact and covered

```text
Minimum small bills
$1s   need 6    have 14   covered, 8 extra
$5s   need 3    have 5    covered, 2 extra
$10s  need 2    have 2    covered
```

#### Shortage

```text
Need small bills before paying out
$1s   need 6    have 2    short 4
$5s   need 3    have 3    covered
$10s  need 2    have 0    short 2

Suggested register action:
Break 1 x $20 into 2 x $10, 1 x $5, and 5 x $1.
```

#### Partial/range

```text
Minimum small bills, estimated
$1s   need 4-7  have 14   safe if final need <= 14
$5s   need 2-4  unknown   count before payout
$10s  need 1-3  have 2    possible shortage if final need is 3
```

#### Surplus

```text
Optional cleanup
You can exchange up to $80 of extra small bills into $20s.
[Show cleanup plan]
```

Surplus should never look like a blocking alert.

### 7.3 Calculation boundary

Keep the small-bill math close to `engine.js` or a pure calculation module. UI components should receive a structured object like:

```js
{
  status: "covered" | "short" | "range" | "unknown",
  rows: [
    { denom: 1, need: 6, have: 14, short: 0, extra: 8 },
    { denom: 5, need: 3, have: 5, short: 0, extra: 2 },
    { denom: 10, need: 2, have: 2, short: 0, extra: 0 }
  ],
  suggestedTrades: []
}
```

## 8. Information Architecture and Data Model

### 8.1 Separate durable roster from session state

Use separate localStorage keys:

- `tippool_session_v2`
- `tippool_roster_v1`
- `tippool_settings_v1`

Reason:

- New Session should clear tonight's data.
- New Session should not erase saved staff.
- Settings should survive session resets.

### 8.2 Target session state shape

```js
{
  version: 2,
  savedAt: 0,
  date: "2026-06-10",
  mode: "night",
  staff: [
    {
      id: "person-session-id",
      rosterId: "optional-roster-id",
      name: "Alex",
      role: "bartender",
      inTime: "4:00",
      outTime: "",
      closerOverride: "auto" // "auto" | "closer" | "not_closer"
    }
  ],
  cash: {
    mode: "billCounts", // "billCounts" | "netTotal" | "partialKnown"
    billCounts: { "100": "", "50": "", "20": "", "10": "", "5": "", "1": "" },
    netTotal: "",
    partialKnown: {
      "100": { value: "", known: true },
      "50": { value: "", known: true },
      "20": { value: "", known: false },
      "10": { value: "", known: false },
      "5": { value: "", known: false },
      "1": { value: "", known: false }
    },
    additions: [
      { id: "entry-id", amount: 18, note: "late tip", createdAt: 0 }
    ]
  },
  closeTime: {
    type: "exact", // "exact" | "range"
    exact: "2:30",
    start: "",
    end: ""
  },
  remainderOverrides: null,
  distributionSnapshot: null
}
```

### 8.3 Target roster shape

```js
{
  version: 1,
  people: [
    {
      id: "roster-id",
      name: "Alex",
      role: "bartender",
      defaultStartByDay: {
        "0": "3:00",
        "1": "3:00",
        "2": "3:00",
        "3": "3:00",
        "4": "4:00",
        "5": "4:00",
        "6": "4:00"
      },
      active: true
    }
  ]
}
```

### 8.4 Target settings shape

```js
{
  version: 1,
  defaultStartByDay: {
    "0": "3:00",
    "1": "3:00",
    "2": "3:00",
    "3": "3:00",
    "4": "4:00",
    "5": "4:00",
    "6": "4:00"
  },
  defaultCloseTime: "2:30",
  timeInputMode: "wheel", // "wheel" | "decimal"
  showDayShiftMode: false
}
```

## 9. Recommended Project Structure

The current root-level static app can remain static and dependency-free, but the rebuild should use clearer folders and file ownership.

### 9.1 Option A: Framework-free ES modules (recommended first rebuild path)

This keeps the no-build ethos while introducing explicit dependencies.

```text
index.html
manifest.json
package.json

src/
  app/
    bootstrap.js
    app-controller.js
    events.js
  state/
    store.js
    selectors.js
    actions.js
    migrations.js
  domain/
    night-calculator.js
    cash-requirements.js
    close-time-range.js
    corrections.js
    roster-model.js
  engine/
    engine.js
    utils.js
    engine-day.js
  persistence/
    session-storage.js
    roster-storage.js
    import-export.js
  ui/
    render-main.js
    render-staff.js
    render-cash.js
    render-summary.js
    render-small-bills.js
    render-sheets.js
    render-roster.js
    time-picker.js
  legacy/
    day-shift/
      cash-day.js
      summary-day.js

styles/
  tokens.css
  base.css
  layout.css
  components.css
  staff.css
  cash.css
  summary.css
  sheets.css
  time-picker.css
  roster.css

tests/
  engine.test.js
  utils.test.js
  night-calculator.test.js
  cash-requirements.test.js
  persistence.test.js
```

Pros:

- Preserves static deployment.
- Removes script-tag global load-order risk.
- Lets the rebuild happen incrementally.
- Avoids importing the React design-system runtime.

Cons:

- Browser module support means opening `index.html` directly from `file://` may become less reliable depending on imports/CORS behavior.
- Might require serving locally with `python3 -m http.server` or similar.
- UI rendering is still manual DOM/string rendering.

### 9.2 Option B: Lightweight Vite app

Use Vite with vanilla JS or TypeScript.

Pros:

- Better module ergonomics.
- Easy local dev server.
- Can use TypeScript/JSDoc and bundled assets.
- Cleaner tests possible.

Cons:

- Adds build step and dependency management.
- Moves away from "open index.html directly."
- Requires deciding deployment workflow.

### 9.3 Option C: React rebuild

Use the existing design-system components as seeds and build a React app.

Pros:

- Strong component model for sheets, cards, inputs, and state-driven UI.
- Easier conditional UI for partial/range/blocked states.
- Aligns with the design-system artifact.

Cons:

- Largest architectural jump.
- New runtime dependency.
- Current DOM-oriented code cannot be directly reused.
- Must be justified by long-term maintainability, not just visuals.

### 9.4 Recommendation

Choose Option A unless the team explicitly wants a broader platform migration. The user's request asks for "nearly full rebuild" mostly in UI and project structure, while keeping math/formulas. A framework-free ES-module rebuild gives most of the structural benefit without risking the product's offline/static simplicity.

## 10. Module Boundary Plan

### 10.1 Domain layer

Domain modules should not touch the DOM.

Recommended pure modules:

- `night-calculator.js`
  - Input: session staff, cash total, close time settings, remainder overrides.
  - Output: staff payouts, total hours, rate, leftovers, confidence.

- `cash-requirements.js`
  - Input: payouts, known/unknown bill pool.
  - Output: minimum small bills, shortage/surplus/range states, suggested exchange plans.

- `close-time-range.js`
  - Input: staff, cash total, close time start/end.
  - Output: payout range and small-bill range across endpoints or sampled increments.

- `corrections.js`
  - Input: original distribution snapshot and revised calculation.
  - Output: person deltas and simplest bill trades.

- `roster-model.js`
  - Input: roster, settings, selected date.
  - Output: suggested crew rows and default start times.

### 10.2 State layer

Create a single app state object and explicit actions:

- `addRosterPersonToSession(rosterId)`
- `updateStaffTime(sessionPersonId, field, value)`
- `setCashMode(mode)`
- `updateBillCount(denom, value)`
- `setNetTotal(value)`
- `addTipAmount(amount)`
- `setCloseTime(value)`
- `setCloseTimeRange(start, end)`
- `captureDistributionSnapshot()`
- `applyCorrectionInput(change)`

The UI should render from state. It should not be the source of truth.

### 10.3 Rendering layer

Each render function should receive data and return DOM or HTML, not read hidden globals.

Recommended render ownership:

- `render-main.js`
  - Main shell and section expansion state.

- `render-staff.js`
  - Roster chips.
  - Crew rows.
  - Staff section summary.

- `render-cash.js`
  - Cash mode controls.
  - Bill-count rows.
  - Net-total/incremental inputs.
  - Partial-known inputs.

- `render-small-bills.js`
  - Small-bill requirement component.
  - Shortage/surplus/range UI.

- `render-summary.js`
  - Summary hero.
  - Person cards.
  - Confidence states.
  - Primary actions.

- `render-sheets.js`
  - Shared sheet container and sheet routing.

### 10.4 Persistence layer

Persistence should serialize state objects, not scrape DOM.

Responsibilities:

- Validate snapshots.
- Migrate old session versions.
- Save session separate from roster/settings.
- Export/import session JSON.
- Export/import roster separately if needed.

## 11. Migration Strategy

### Phase 1: Planning and safety net

- Freeze `engine.js` and `utils.js` except for bug fixes.
- Expand tests around existing engine behavior if needed.
- Add tests for a pure `computeNightShift` equivalent.
- Document current storage schema and migration needs.

### Phase 2: Data-first state

- Introduce session state object while current UI still exists.
- Add adapters:
  - DOM -> session state for current code.
  - Session state -> existing engine inputs.
- Make persistence save the session object.
- Keep existing UI working during transition.

### Phase 3: New main screen shell

- Replace tab panels with a single scrollable main layout.
- Keep old renderers behind sheets or hidden dev routes as needed.
- Make Summary render by default.
- Move Cash and Staff into collapsible sections.

### Phase 4: New staff workflow

- Add roster storage.
- Add roster picker.
- Add day-of-week start defaults.
- Replace numeric time inputs with time picker affordance.
- Keep decimal fallback.

### Phase 5: New cash workflow

- Add incremental total entry.
- Add partial-known mode.
- Move small-bill minimum component next to cash.
- Promote shortage to blocking state.
- Demote surplus cleanup to optional action.

### Phase 6: Range and uncertainty

- Add close-time exact/range state.
- Add range calculation output.
- Teach summary cards to show exact/estimate/range/blocked states.
- Make missing information explicit.

### Phase 7: Secondary sheets

- Move distribution table into sheet.
- Keep person profile sheet.
- Keep remainder adjustment sheet.
- Simplify close-time explorer.
- Add roster manager sheet.

### Phase 8: Correction mode

- Capture distribution snapshot.
- Build correction inputs.
- Compute person deltas.
- Suggest bill trades using already-distributed bills.

### Phase 9: Day shift decision

- Either leave day-shift code parked as legacy/deferred.
- Or write a separate product spec and rebuild it after night shift is stable.

## 12. Acceptance Criteria for the Rebuild

### Product acceptance

- A manager can open the app and start from staff, cash, or summary without being forced through a sequence.
- Summary is visible by default.
- The app remains useful with partial information.
- Exact distribution is clearly distinguishable from estimate/range output.
- Shortage states are visually urgent and actionable.
- Surplus cleanup is available but secondary.
- Roster survives New Session.
- New Session clears tonight's data without clearing roster/settings.
- App works offline.
- App remains usable on a phone in low light.

### Technical acceptance

- Core math remains covered by tests.
- New pure calculation modules have tests.
- Renderers do not compute payout math.
- Persistence does not scrape DOM as the source of truth.
- State changes flow through named actions.
- Day-shift code is isolated or explicitly deferred.
- Import/export validates schema versions.
- Existing sessions can either migrate safely or fail with a clear import message.

## 13. UI Details Worth Designing Explicitly

### 13.1 Section expansion rules

Staff section:

- Expanded if no named staff.
- Collapsed if staff exists and no staff errors.
- Auto-opens when a staff-related warning is tapped.

Cash section:

- Expanded if total is zero or cash has errors.
- Collapsed if exact total and no cash errors.
- Keeps small-bill status visible even when collapsed.

Summary section:

- Always visible.
- Never hidden behind navigation.

### 13.2 Confidence language

Use consistent labels:

- `Exact`
  - All required data known and bills solve.

- `Estimate`
  - Total may be rough or bill counts unknown.

- `Range`
  - Close time or missing out times produce multiple possible payouts.

- `Blocked`
  - Payout math may be known, but exact physical distribution cannot be completed.

- `Needs info`
  - Required data is missing for a meaningful result.

### 13.3 Time picker

Recommended UI:

- Bottom sheet opens when tapping a time field.
- Columns:
  - Hour.
  - Minute increments: `00`, `15`, `30`, `45`.
  - AM/PM or "pm/after midnight" context.
- Quick chips:
  - `3:00`
  - `4:00`
  - `10:00`
  - `12:00`
  - `2:00`
  - `2:30`
  - `clear`
- Decimal fallback:
  - Hidden under "type decimal."
  - Useful for users already trained on `10.5`.

### 13.4 Roster picker

Roster should reduce repeated typing:

- Show frequent staff first.
- Tap to add to tonight.
- Added people become selected/disabled in picker.
- Search/add row at end.
- New names typed into a session can prompt:
  - "Save to roster?"

### 13.5 Person card detail

Person detail sheet should include:

- Editable name.
- Editable in/out.
- Closer override.
- Hours.
- Base payout.
- Closer bonus.
- Final payout.
- Bills assigned.
- Change impact if editing after distribution snapshot exists.

## 14. Implementation Risks

### Risk: over-rebuilding the engine

The engine is not the main pain point. Rewriting it risks breaking the actual money behavior. Keep it as a pure dependency and wrap it with clearer input/output adapters.

### Risk: partial-known cash mode can confuse users

Partial-known mode must be visibly different from exact bill-count mode. If unknown denominations look like zero, the user may trust a false exact result.

### Risk: close-time ranges can produce too much information

Range output should highlight only meaningful changes:

- Payout delta per person.
- Small-bill minimum delta.
- Which people are affected.

Do not show a huge spreadsheet by default.

### Risk: direct file opening may conflict with ES modules

If preserving `file://` opening is non-negotiable, test ES-module behavior early. If it is not reliable enough, either keep script tags with better namespacing or adopt a tiny build step that outputs a single static bundle.

### Risk: day-shift code contaminates the rebuild

Night shift has a clear product spec. Day shift should not force UI compromises until its own workflows are re-specified.

### Risk: persistence migration

Current storage key `tippool_v1` contains mixed session/day/role state. Migration to separate session/roster/settings keys should be explicit and tested.

## 15. Detailed Clarifying Questions and Choices

These questions are intentionally long and specific. They should be answered before or during the rebuild, because each one affects UI behavior, data shape, or migration strategy.

### 15.1 Product scope

1. Should the rebuild completely remove day-shift UI from the primary app for now, or should day shift remain accessible behind an "advanced/legacy" switch?

2. When you say "nearly full rebuild," do you want the app to remain framework-free and close to the current static-file model, or are you open to a Vite/React/TypeScript migration if it produces a cleaner long-term structure?

3. Is "open `index.html` directly from a phone/local file" still a hard requirement, or is "serve as a static offline-capable site/PWA" enough?

4. Should this rebuild prioritize one specific bar/night-shift process, or should it remain generic enough for other venues with different tip-pool rules?

5. Is the product still only for a single manager/lead bartender on one device, or do you eventually expect multi-device sharing, print/export, or audit history?

### 15.2 Night-shift rules

6. Is blank out time always intended to mean "closer," or does it sometimes mean "unknown non-closer out time not entered yet"?

7. If blank out time can mean either closer or unknown, what should the UI ask or infer so it does not overpay closers during mid-shift previews?

8. Should closers be the people with latest out time automatically, or should "closer" be a manual status that defaults from blank out time?

9. When there are more than two people with blank out times, should the app assume all are closers until out times are entered?

10. Is there always a minimum of two closers, and should the app warn if only one closer is detected?

11. Can a person have an out time and still receive closer bonus because they stayed for closing tasks after clocking out of tip eligibility?

12. Should closer bonus be shown as "remainder dollars" only, or should the UI explain the exact floor/base/remainder math on every closer card?

13. If final leftover dollars remain in the drawer after closer remainder split, should the app ever recommend assigning them manually, or always leave them as drawer remainder unless user opens adjustment?

### 15.3 Time input

14. Should times be stored internally as decimal hours, minutes-after-noon, ISO-like strings, or a custom `{hour, minute, meridiem}` object?

15. Do users think in 12-hour clock terms (`2:30am`) or decimal terms (`2.5`) when closing?

16. Should the UI still allow fast decimal entry for power users who already learned the current app?

17. What minute increments are actually needed: 5, 10, 15, or 30 minutes?

18. Should the time picker bias toward the night-shift range from 3pm to 3am instead of showing all 12 hours equally?

19. Should the app display `2:30a`, `2:30 AM`, or just `2:30` once the night-shift context is established?

20. Should close time be a global default out time, a separate session field, or both?

21. When close time changes, should it update blank out-time placeholders only, or should it actively change computed out times for blank rows?

### 15.4 Roster and defaults

22. Should roster entries include only bartenders for this rebuild, or also servers/support roles for future use?

23. Should roster save happen automatically when a new name is typed, or only after an explicit "save to roster" confirmation?

24. Should roster sort by most recently used, most frequently used, alphabetical, or manual pin order?

25. Should each roster person have day-of-week start defaults, or is a global day-of-week default enough for the first rebuild?

26. Should roster entries store typical role, typical start time, nickname/initials, and active/inactive status?

27. Should deleting someone from roster remove them forever, or mark them inactive so historical imports still recognize the person?

28. Should "New Session" preserve roster and settings with no confirmation, or ask separately whether to clear roster too?

### 15.5 Cash entry

29. Should exact per-bill count remain the default cash mode on a fresh session, or should the app start with a rough/net total prompt during mid-shift?

30. In net-total mode, should the generated ideal bill mix be treated as real cash, or clearly marked as a planning estimate until bill counts are confirmed?

31. In partial-known mode, should unknown denominations be allowed for only large bills, only small bills, or any denomination?

32. If the user enters only known $50s/$100s, should the app compute "maximum possible additional $10s needed" like the spec example, or wait for at least total/staff data?

33. Should partial-known mode allow "at least X" and "exactly X," or only exact known counts plus unknown rest?

34. Should incremental additions create an editable log, or should `+ amount` immediately merge into one total with undo?

35. Should late tips after distribution automatically enter correction mode, or just update the current total until the user marks distribution as complete?

36. Should the app distinguish bucket total and booklet total, or only the combined cash pool?

37. Should bill-count rows have plus/minus steppers for one-handed use, or is keyboard numeric entry enough?

38. Should rubber-banded stack entry support common bundle sizes, such as 25 x $1 or 20 x $5?

### 15.6 Small-bill guidance

39. Should shortage suggestions be purely denomination-based, or should they describe realistic register exchanges like "break one $20 into 10 ones and two fives"?

40. Should the app recommend the fewest number of register exchanges, the cleanest final envelopes, or the least disturbance to existing counted bills?

41. Should surplus cleanup ever be auto-applied, or should it always require explicit confirmation because it changes physical cash counts?

42. Should shortage warnings appear in both Cash and Summary, or only in Cash with Summary showing a compact blocker?

43. Should the app distinguish "mathematically impossible with current bills" from "distribution engine failed but a solution may exist"?

44. Should $50s be displayed as satisfying odd-tens requirements in the small-bill component, or should that remain an internal detail?

45. How much explanation should users see for the minimum $1/$5/$10 formulas?

### 15.7 Summary and distribution

46. Should person cards show bill chips directly on the card, or hide bill details until tapped to reduce clutter?

47. If bill chips are shown, should they use counts (`2 x $20`) or literal stacks (`$20 $20`)?

48. During distribution, should there be a "paid" checkbox per person, or would that add dangerous complexity?

49. Should summary cards be sorted by payout amount, staff order, out time, closer status, or the order entered?

50. Should closers always be grouped last/first, or simply badged in place?

51. Should the distribution table remain available for every session, or only behind an "advanced verification" action?

52. Should the app support a print/share text summary, or is on-screen distribution enough?

### 15.8 Corrections

53. At what point does the app consider cash "distributed" and capture the snapshot for correction mode?

54. Should the user explicitly tap "Mark distributed," or should opening correction mode create the snapshot from the last exact distribution?

55. What correction cases are most common: late tip, wrong bill count, wrong out time, forgotten staff member, or changed closer status?

56. Should correction mode assume everyone still has all bills originally handed to them, or allow marking a person's cash as unavailable?

57. Should correction trades optimize for fewest person-to-person exchanges, fewest bills moved, or easiest mental explanation?

58. Should correction mode be allowed to use drawer remainder bills, or only bills already in people's possession?

59. Should correction output ever recommend "manager pays/collects later," or only exact bill trades?

### 15.9 Persistence and import/export

60. Do old `tippool_v1` sessions need automatic migration, or can the rebuild start fresh with a new storage key?

61. Should imported old sessions migrate into the new schema, or should import only support new exported files?

62. Should roster export/import be separate from session export/import?

63. Should session export include roster names copied into the session, roster IDs, or both?

64. Should the app keep a recent session history locally, or only the current session?

65. Should "New Session" clear correction snapshots and incremental addition logs?

### 15.10 Technical architecture

66. Is adding a local dev/build dependency acceptable if the final app remains static and offline-capable?

67. If adopting ES modules without a bundler, is it acceptable that users may need to serve the app instead of opening it from `file://`?

68. Should TypeScript be introduced, or would JSDoc typedefs be enough for data-shape safety?

69. Should the current design-system React components remain documentation only, or become the basis of a React app?

70. Should day-shift files be moved into `legacy/day-shift`, left where they are, or removed from the active rebuild branch?

71. Should tests continue as plain Node scripts, or move to a test runner once modules are introduced?

72. Should CSS stay split by screen area, or move toward component files plus shared layout/tokens?

73. Should renderers generate HTML strings like the current app, or create DOM nodes through small helper functions?

74. Should app state use a tiny custom store, browser events, or a framework/store library?

75. Should all user actions be represented as named state actions for easier debugging and future undo/correction features?

## 16. Suggested First Implementation Brief

The first real rebuild branch should not attempt every feature. It should establish the new architecture and primary flow.

Recommended first build target:

1. Create new session state object.
2. Keep existing `engine.js` and `utils.js`.
3. Build new single-screen shell.
4. Render Summary by default.
5. Move current Staff and Cash into collapsible sections.
6. Move Dist table into a sheet.
7. Add small-bill requirement component near Cash.
8. Preserve localStorage session save/load.
9. Leave roster, partial-known cash, range close time, and correction mode as next-layer features once the shell is stable.

This creates the new product shape without trying to solve every future workflow at the same time.

## 17. Final Recommendation

Rebuild TipPool as a night-shift-first, single-screen, data-driven static app. Keep the math and bill engine intact. Replace tab navigation with collapsible inline inputs and an always-primary summary. Separate session, roster, and settings state. Treat shortage as urgent and surplus as optional. Move technical structure toward explicit modules and pure domain functions before layering in the largest new features.

The resulting app should feel less like navigating software and more like a smart closing worksheet that always shows the best answer possible with whatever the manager currently knows.
