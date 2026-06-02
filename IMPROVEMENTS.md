# Tip Pool — Improvements & Known Issues

Ordered by impact. Fix infrastructure and trust issues before adding features.

---

## Priority 1 — Fix before next use

These issues can cause data loss, silent wrong results, or confuse users into trusting stale output.

### Stale Summary/Dist after invalid staff hours

**Files:** `js/calculator.js`, `js/staff.js`

If you enter names and cash, get a valid calculation, then change hours to something invalid, `calculate()` returns early — but the Summary and Dist tabs still show the previous results. The stale banner only appears in some code paths.

Fix: whenever `blockCalculation()` is called and `lastStaff.length > 0`, always show the stale banner on both Summary and Dist. Consider clearing the rendered content instead of leaving old output visible.

---

### Date change not saved until another field fires

**Files:** `index.html`, `js/persist.js`, `js/main.js`

The date input has a `change` listener added in `main.js`, but no `input` listener. On some browsers/OS date pickers the `change` event only fires when the picker closes. If a user changes the date then immediately reloads without touching anything else, the new date can be lost.

Fix: already partially done in `main.js` — the `addEventListener('change', saveState)` line is there. Verify it fires reliably across iOS Safari and Android Chrome date pickers. Add an `input` listener as a belt-and-suspenders fallback.

---

### Warnings say "go to Dist tab to fix" but Dist is read-only

**Files:** `js/summary.js`, `js/dist.js`, `js/calculator.js`

When the engine can't make exact change, the warning message tells the user to go to the Dist tab. The Dist tab has no editing UI — it just shows the same error.

Fix: change the message to explain *what* is missing (e.g. "Need 3 more $1 bills — adjust counts in Cash") and point to the Cash tab, not Dist. The preflight result in `runPreflight()` already computes the exact shortage; surface that.

---

### Tests fail from the repository root

**File:** `js/engine.test.js`

`engine.test.js` already uses `path.join(__dirname, 'utils.js')` correctly, so running `node js/engine.test.js` from the repo root works. If the test is run from a different working directory it still fails. This is already resolved in the current code, but worth confirming with a `package.json` script so there's one canonical command.

Fix: add a minimal `package.json`:

```json
{
  "scripts": {
    "test": "node js/engine.test.js && node js/utils.test.js"
  }
}
```

Then `npm test` works from the repo root regardless of how the repo is checked out.

---

## Priority 2 — Phone UX fixes

### Bottom tab bar keyboard and safe-area handling

**Files:** `css/tabs.css`, `css/base.css`, `js/main.js`

The tab bar uses `position: sticky` at the bottom of the flex layout. The `visualViewport.resize` handler in `main.js` lifts the bar above the keyboard, but:

- `visualViewport.scroll` is not listened to, so the bar can drift when the user scrolls while the keyboard is open.
- Content below focused inputs has no dynamic bottom padding, so the last staff row or bill input can sit partially hidden behind the bar.
- On iOS the bar height plus `--safe-bottom` may not be predictable across all devices.

Fix: switch the tab bar to `position: fixed; bottom: 0` inside the app shell. Add a spacer div (or `padding-bottom`) to `.content` whose height tracks `--tab-h + --safe-bottom`. Update the `visualViewport` listener to adjust both the bar and the content padding together.

---

### Distribution table overflows on narrow screens

**Files:** `js/dist.js`, `css/dist.css`

The Dist table has a Name column plus six denomination columns plus a Total column — nine columns total. On a 375px screen these columns get crushed. The wrapper has `overflow: hidden`, so content is clipped with no scroll affordance.

Fix: change `.dist-tbl-wrap` to `overflow-x: auto` and add a subtle horizontal scroll shadow. Alternatively, collapse the table into person cards on screens below ~420px using a CSS media query, showing each person's bill allocation as a compact inline chip row (the same format already used in Summary).

---

### Tab switching auto-focuses fields and opens the keyboard

**Files:** `js/tabs.js`, `js/cash.js`

`switchTab()` immediately focuses the first empty name field when switching to Staff, and `setCashMode()` focuses the net-total input after 50ms. On phones this pops the keyboard open even when the user only tapped a tab to inspect the content.

Fix: remove the auto-focus from `switchTab()`. If a focus hint is needed, use the existing `pulse-hint` animation approach (already implemented for the initial load) instead of actual focus. Remove the `setTimeout(() => focus(), 50)` in `setCashMode()`.

---

### Staff row is cramped on small phones

**Files:** `css/staff.css`, `js/staff.js`

Each staff row puts name, In, Out, hours display, closer toggle, and delete on one line. The 44px minimum touch targets help tapping but make the row tall and visually dense.

Fix: on screens narrower than ~400px, stack the time fields below the name in a second line. A media query in `css/staff.css` can switch the row from `display: flex` single-line to a two-line grid without changing any JS.

---

## Priority 3 — Correctness and code quality

### Silent calculation hides validation feedback

**File:** `js/calculator.js`

`autoCalculate()` always calls `calculate(true)` (silent mode). The non-silent code paths that show `alert()` for missing names or invalid hours are never reached because there is no manual Calculate button. Invalid input fails quietly.

Fix: either add inline validation messages below the relevant inputs (preferred — more mobile-friendly than alerts), or add a visible Calculate button that calls `calculate(false)`. The inline approach is already partially in place via the `.input-message` and `.input-invalid` CSS classes; wire them up to the validation errors returned from `collectNamedStaffRows()`.

---

### Debounce expensive recalculation

**Files:** `js/calculator.js`, `js/cash.js`, `js/staff.js`

Every keypress in any input calls `autoCalculate()`, which rerenders Summary, Dist, Home, and writes to localStorage. With five or more staff this is noticeable on low-end phones.

Fix: wrap `autoCalculate()` with a 150–200ms debounce. A simple version:

```js
let _calcTimer = null;
function scheduleCalculate() {
  clearTimeout(_calcTimer);
  _calcTimer = setTimeout(autoCalculate, 180);
}
```

Replace direct `autoCalculate()` calls in `oninput` handlers with `scheduleCalculate()`. Keep `autoCalculate()` for `onchange` (blur) events where you want immediate feedback.

---

### Import validation is shallow for nested fields

**Files:** `js/persist.js`, `js/main.js`

`validateSessionSnapshot()` now validates bill snapshots and staff arrays correctly. The remaining gap is that `main.js` reads `_saved.staff` directly without checking for invalid time strings before passing them to `addStaff()`. If a field contains a value that passes the string check but is nonsensical as a time (e.g. `"999"`), it gets written to the input and `calcHours()` shows `?` without surfacing a clear restore error.

Fix: add a normalization pass in `main.js` between load and restore — clamp or blank any time values that `parseTimeString()` would reject.

---

### `renderAll` and `rerenderAfterTrade` are nearly identical

**File:** `js/calculator.js`

`rerenderAfterTrade()` clones the staff array, redistributes bills, and rerenders Summary and Dist — exactly what `renderAll()` does. `rerenderAfterTrade()` is not called anywhere.

Fix: delete `rerenderAfterTrade()`. If a trade/swap workflow is added later, extend `renderAll()` rather than maintaining a separate path.

---

### Cash state has redundant snapshots

**Files:** `js/cash.js`, `js/persist.js`, `js/main.js`

Persistence stores `bills`, `perBillBills`, and `netBillBills` with overlapping content. `bills` is a legacy field kept for v1 compatibility; `perBillBills` and `netBillBills` are the canonical fields since v2.

Fix: remove `bills` from new saves (or always write it as a copy of whichever mode is active). Add a migration in `loadState()` that promotes `bills` → `perBillBills` when only `bills` is present. Document the v1 → v2 schema difference in a comment.

---

## Priority 4 — Accessibility

**Files:** `index.html`, `js/modals.js`, `css/modals.css`

The app has no ARIA roles, no focus trapping in modals, no `aria-modal`, and tab buttons don't declare `role="tab"` or `aria-selected`. Screen reader and keyboard-only users cannot use the app reliably.

Minimum viable fixes:

- Add `role="tablist"` to `.tab-bar` and `role="tab"` + `aria-selected` to each `.tab-btn`.
- Add `role="dialog"` and `aria-modal="true"` to `.modal-overlay`.
- Trap focus inside open modals (cycle between focusable children on Tab/Shift+Tab).
- Return focus to the trigger element when a modal closes.
- Add `aria-label` to icon-only buttons (closer toggle, delete, session menu).

---

## Priority 5 — Dead code removal

Review each item before deleting — confirm no planned feature depends on it.

**`js/utils.js`**
- `fmtClock()` — formats a decimal time as `H:MM`, not used anywhere in the app.
- `addClockMinutes()` — adds minutes to a decimal time, not called.

**`js/cash.js`**
- `poolFromSnapshot()` — converts a bill snapshot to a pool object; not called after the snapshot system was simplified.
- `syncPoolToInputs()` — writes a pool back to the bill inputs; called only internally in `setCashMode()` and not exposed.
- `isSwitchingCashMode` — set in `setCashMode()` but never read by any conditional.

**`js/staff.js`**
- `collectStaffInputRows()` — returns a clean array of staff input data; superseded by `collectNamedStaffRows()` in `calculator.js`. The two functions should be merged.

**`js/calculator.js`**
- `rerenderAfterTrade()` — see note above; dead and duplicates `renderAll()`.

**`js/engine.js`**
- `runPreflight()` returns an `ideals` object that is computed but never consumed by the caller. The preflight is used only for its `ok` / `msg` result.
- `applyBestFlipperPlan()` — defined but not called from `calculateV19Pipeline()` or anywhere else. May be a partially-replaced predecessor to `applyBestFiftyPlan()`.
- Several rebalance helpers (`rebalanceTwentiesAndSmallBills`, `rebalanceSmallDenominationBundles`) are defined but trace through the call graph to confirm they are actually reachable from `calculateV19Pipeline()` before removing.

**`css/home.css`**
- `.home-live-row`, `.home-live-avatar`, `.closer-dot`, `.hlt-in`, `.hlt-sep`, `.hlt-out`, `.hlt-hrs`, `.home-live-tip`, `.home-live-empty` — styles for a previous list-style Home layout, replaced by the current dashboard. Confirm the dashboard renders correctly on all target devices then remove.

**`css/summary.css`**
- `.person-meta`, `.person-hrs`, `.person-times`, `.person-sep` — appear unused by current Summary markup. The current card uses `.person-hrs-block` / `.person-hrs-val` / `.person-hrs-times` instead.

**`css/components.css`**
- `.info-box` — a blue info panel style not referenced in any current HTML or JS.

---

## Future enhancements

### Bill adjustment workflow

The engine identifies exactly what's missing when exact change is impossible (e.g. "need 2 more $1s"). A useful next step is a UI that suggests bill swaps — "swap a $5 for five $1s from the drawer" — so the user can resolve the problem without leaving the app. The `runPreflight()` ideal counts are already computed; they just need to be surfaced.

### Installable PWA

A `manifest.json` and service worker would let staff install the app to their home screen and use it fully offline. Tip pooling often happens in walk-in coolers and break rooms with no signal.

```json
{
  "name": "Tip Pool",
  "short_name": "TipPool",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0a0f",
  "theme_color": "#0a0a0f"
}
```

### Merge Summary and Dist tabs

Five tabs is a lot for a phone-width app, and Dist is rarely needed on its own. Consider moving the distribution table into a collapsible section at the bottom of Summary, or behind a "Show bill breakdown" button. This reduces navigation overhead and makes the stale-state problem less likely since both views update together.

### Explicit validation summary

A compact banner at the top of the Staff tab listing which rows have errors (invalid hours, impossible shift) would let users fix problems without silently failing. The `collectNamedStaffRows()` function already returns a full `errors` array — it just needs to be rendered somewhere visible.

### Regression test coverage

After the path fix, the following cases have no tests:

- Invalid hours (zero, negative, > 12)
- All staff filtered out due to invalid hours
- Net Total ideal breakdown with various staff configurations
- Date persistence round-trip
- Remainder handling when there are no closers
- Import validation rejecting malformed JSON
- `validateSessionSnapshot()` edge cases (missing keys, wrong types)
