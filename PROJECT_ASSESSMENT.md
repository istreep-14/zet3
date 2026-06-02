# Tip Pool Project Assessment

This assessment is based on a source review of the current single-page Tip Pool app and a quick verification run of the existing engine test file. The app is a mobile-first vanilla HTML/CSS/JavaScript calculator with local persistence, cash entry, staff hours, payout summary, and bill distribution views.

## High-level summary

- The project is small and understandable, with no build step and a clear split between HTML, CSS modules, and JavaScript modules.
- The main user risk is phone usability: the bottom tab bar, staff rows, and distribution table are dense for narrow screens.
- The calculation flow has useful automatic behavior, but some invalid or impossible states leave users without a clear recovery path.
- Several functions and styles appear to be leftovers from earlier designs and can be removed or consolidated after confirming they are not planned for near-term features.
- The only test file currently fails from the repository root because it reads `tippool/js/...` paths that do not exist in this checkout.

## Highest-priority issues

1. **Phone UI and bottom tab bar compatibility**
   - Files: `index.html`, `css/tabs.css`, `css/base.css`, `js/main.js`
   - The bottom tab bar contains five tabs. Cash and Staff also include a second sub-label line, while Home, Summary, and Dist do not. On small phones this creates a cramped bar with very small labels and uneven visual weight.
   - The tab bar uses `position: sticky` at the bottom of a flex layout. The app also manually moves it above the keyboard with `visualViewport.resize`, but does not listen for `visualViewport.scroll` or add extra content padding while the keyboard is open. On iOS Safari this can still cause focused fields or bottom content to sit under the keyboard or tab bar.
   - Suggested direction: make the tab bar fixed inside the app shell, standardize tab heights and labels, increase practical tap targets, and add a content bottom inset that tracks the bar and keyboard.

2. **Distribution view is likely too wide for phones**
   - Files: `js/dist.js`, `css/dist.css`
   - The Dist tab renders a table with Name, six denomination columns, and Total. The wrapper uses `overflow: hidden`, so narrow phones can clip the table with no horizontal scrolling or alternate card layout.
   - Suggested direction: use horizontal scroll with clear affordance, or convert distribution rows into compact person cards on small screens.

3. **Warnings point users to a fix that does not exist**
   - Files: `js/summary.js`, `js/dist.js`, `js/calculator.js`
   - Summary warnings say "go to Dist tab to fix", but the Dist tab is read-only. There is no bill-swap or manual adjustment UI exposed.
   - Suggested direction: change the message to explain what cash is missing, or add an actual adjustment/swap workflow.

4. **Tests are currently broken**
   - File: `js/engine.test.js`
   - Running `node js/engine.test.js` from `/workspace` fails because the test reads `tippool/js/utils.js` and `tippool/js/engine.js`.
   - Suggested direction: use paths relative to `__dirname`, then add a simple `package.json` script such as `npm test` if Node is the intended runner.

## Bugs and correctness risks

- **Stale Summary/Dist after invalid staff hours**
  - Files: `js/calculator.js`, `js/staff.js`
  - If names and cash exist but all staff rows filter out due to invalid hours, `calculate()` returns after setting the home preview to empty. Existing Summary and Dist content can remain visible, with stale banners only in some cases.
  - Impact: users may trust old payouts after changing hours to invalid values.

- **Date changes are not saved immediately**
  - Files: `index.html`, `js/persist.js`, `js/main.js`
  - The date input has no `change` or `input` handler. The selected date is persisted only when another action later calls `saveState()`.
  - Impact: a user can change the date, reload, and lose that date if no other field changed.

- **Silent calculation mode hides validation feedback**
  - File: `js/calculator.js`
  - `autoCalculate()` always calls `calculate(true)`. The non-silent alerts for missing staff names or valid hours are effectively unused because there is no manual calculate action.
  - Impact: invalid input can fail quietly instead of guiding the user.

- **Cash mode switching focuses inputs automatically**
  - Files: `js/cash.js`, `js/tabs.js`
  - Switching to Net Total focuses the net input after 50ms; switching to Staff or Cash focuses the first empty field. On phones this opens the keyboard even when users only wanted to inspect a tab.
  - Impact: the keyboard can cover content and make navigation feel jumpy.

- **Import validation is shallow**
  - Files: `js/persist.js`, `js/main.js`
  - Imported JSON is accepted if it is an object with version 1 or 2. Nested fields such as `staff` are not normalized before bootstrap reads them.
  - Impact: malformed but versioned JSON can cause restore-time errors.

- **Accessibility support is minimal**
  - Files: `index.html`, `js/modals.js`, `css/modals.css`
  - Tab buttons, icon-only controls, and modals do not define roles, selected state, focus trapping, `aria-modal`, or background inertness.
  - Impact: keyboard and screen-reader users will have difficulty using the app reliably.

## Improvements

- **Make the mobile shell more robust**
  - Files: `css/base.css`, `css/header.css`, `css/tabs.css`, `js/main.js`
  - Add top safe-area support for the header, make the bottom bar height predictable, and ensure scrollable content always has enough bottom padding for the bar and keyboard.

- **Improve small-screen staff row layout**
  - Files: `css/staff.css`, `js/staff.js`
  - Staff rows put name, in, out, hours, closer, and delete controls on one line. The global 44px minimum touch target rule helps tapping but makes the row even more cramped.
  - Consider a two-line row on narrow screens or a compact edit sheet for time and closer details.

- **Debounce expensive recalculation**
  - Files: `js/calculator.js`, `js/cash.js`, `js/staff.js`
  - Many input events call `autoCalculate()`, which can rerender Summary, Dist, Home, and persistence on every keystroke.
  - A short debounce or requestAnimationFrame scheduler would reduce jank with larger staff lists.

- **Extract shared staff parsing logic**
  - Files: `js/calculator.js`, `js/cash.js`, `js/staff.js`
  - Staff hours, default time behavior, closer detection, and payout target calculation are duplicated between actual calculation and Net Total ideal breakdown.
  - A shared helper would reduce drift between preview and final payout behavior.

- **Use event listeners instead of inline handlers over time**
  - Files: `index.html`, `js/*.js`
  - Most behavior is wired through inline `onclick`, `oninput`, and `onchange` attributes. This works, but it makes testing and refactoring harder and requires many globals.
  - Moving wiring into JavaScript modules would make the app easier to test and maintain.

- **Add project documentation**
  - Files: repository root
  - There is no README or package/test script. A short README should explain the app purpose, how to run it locally, how persistence works, and how to run tests.

## Enhancements

- **Add a real bill-swap or adjustment workflow**
  - Files: `js/engine.js`, `js/dist.js`, `js/summary.js`
  - The engine can identify exact-change failures, but the UI does not let users resolve them in-app.
  - A useful enhancement would show the missing denominations and suggest swaps, such as needing more `$1s` or `$5s`.

- **Convert the app into an installable PWA**
  - Files: `index.html`, new manifest/service worker files
  - Tip pooling is often done in back-of-house environments where connectivity can be poor. Offline installation and a theme color would improve reliability.

- **Add explicit validation feedback**
  - Files: `js/calculator.js`, `js/staff.js`, `index.html`
  - A compact validation summary could explain which rows have invalid hours, missing names, or impossible cash distribution.

- **Offer a simplified phone navigation mode**
  - Files: `index.html`, `css/tabs.css`, `js/tabs.js`
  - Five bottom tabs are a lot for a phone-width app. Consider merging Summary and Dist, moving Dist behind Summary, or hiding Dist until a calculation exists.

- **Add regression tests around calculation edge cases**
  - Files: `js/engine.test.js`, possible new tests
  - After fixing the test path, add cases for invalid hours, date persistence, Net Total preview, remainder handling, and exact-change failures.

## Simplifications

- **Decide whether calculation is automatic or manual**
  - File: `js/calculator.js`
  - The code has both silent and non-silent calculation behavior, but only the silent automatic path is currently used. Either add a visible Calculate button or simplify the API around automatic calculation and inline validation.

- **Merge duplicate render pipelines**
  - File: `js/calculator.js`
  - `renderAll()` and `rerenderAfterTrade()` do nearly the same work, and `rerenderAfterTrade()` is not referenced.
  - Removing or merging this path would make the render lifecycle clearer.

- **Consolidate cash state**
  - Files: `js/cash.js`, `js/persist.js`, `js/main.js`
  - Persistence stores `bills`, `perBillBills`, `netBillBills`, and `netTotal`. Some duplication exists for compatibility, but it increases mental overhead.
  - Consider one authoritative model per cash mode, plus a migration path for old saved data.

- **Reduce stylesheet fragmentation if the app remains static**
  - Files: `css/*.css`, `index.html`
  - The page loads many CSS files. That is easy to read during development, but without bundling it creates extra requests.
  - If no build step is planned, grouping related styles could simplify delivery.

## Legacy or dead-code cleanup candidates

Review these before deleting, but current references suggest they are unused or incomplete:

- `js/utils.js`
  - `fmtClock()`
  - `addClockMinutes()`

- `js/cash.js`
  - `poolFromSnapshot()`
  - `syncPoolToInputs()`
  - `isSwitchingCashMode` is set in `setCashMode()` but no logic reads it.

- `js/staff.js`
  - `collectStaffInputRows()`

- `js/calculator.js`
  - `rerenderAfterTrade()`

- `js/engine.js`
  - `runPreflight()` returns an `ideals` object that is not consumed.
  - Several later distribution/rebalance helpers appear not to be called from the active `calculateV19Pipeline()` path. They should be mapped before removal because the engine is the highest-risk part of the app.

- `css/home.css`
  - Old `.home-live-row`, `.home-live-avatar`, `.hlt-*`, and `.closer-dot` styles appear to be leftovers from the pre-dashboard Home layout.

- `css/summary.css`
  - `.person-meta`, `.person-hrs`, `.person-times`, and `.person-sep` appear unused by the current Summary markup.

- `css/components.css`
  - `.info-box` appears unused in current markup.

## Suggested implementation order

1. Fix the phone shell first: bottom tab bar sizing, safe-area handling, keyboard behavior, and Dist table overflow.
2. Fix correctness and trust issues: stale Summary/Dist states, date persistence, and misleading "go to Dist tab to fix" warnings.
3. Repair the test path and add a small documented test command.
4. Extract shared staff parsing/payout target logic.
5. Remove confirmed dead code and stale CSS after tests are in place.

## Verification notes

- Command run: `node js/engine.test.js`
- Result: failed before assertions because `js/engine.test.js` tries to open `tippool/js/utils.js`.
