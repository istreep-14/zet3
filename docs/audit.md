# TipPool — Full Codebase Audit

Generated from: state.js, utils.js, engine.js, engine\_day.js, cash.js, cash\_day.js, staff.js, cards.js, tabs.js, modals.js, persist.js, calculator.js, summary.js, summary\_day.js, dist.js, person.js, shift.js, main.js

---

## 1\. Global State (js/state.js)

All variables below are implicit globals — no import/export, no encapsulation. Every JS file can read or write any of them silently.

| Variable | Type | Purpose |
| :---- | :---- | :---- |
| `staffId` | number | Auto-increment ID for night/bartender staff rows |
| `serverStaffId` | number | Auto-increment ID for server rows (starts at 1000\) |
| `livePool` | object | Bill counts currently in the drawer |
| `lastStaff` | array | Last computed night-shift staff array |
| `lastTotal` | number | Last computed cash total |
| `lastTotH` | number | Last computed total hours |
| `lastRate` | number | Last computed $/hr rate |
| `lastLeftover` | number | Dollars left in drawer after payout |
| `lastPoolAfter` | object | Bill counts remaining after distribution |
| `lastRemainderBills` | object | Bill breakdown of leftover amount |
| `lastDistributionError` | string | Error message from last distribution run |
| `_lastDistStaff` | array | Staff array with bills assigned (used by dist \+ person modal) |
| `cashMode` | string | `'perbill'` or `'nettotal'` |
| `perBillSnapshot` | object | Saved per-bill input values |
| `netBillSnapshot` | object | Saved net-total-derived bill values |
| `netTotalSnapshot` | string | Saved net-total input value |
| `isRestoringState` | bool | Suppresses saveState during load |
| `isSwitchingCashMode` | bool | Set during mode switch — never read anywhere |
| `isUpdatingNetTotal` | bool | Prevents re-entrant net total refresh |
| `currentInputError` | string | Current validation error for home status card |
| `shiftMode` | string | `'night'` or `'day'` |
| `dayPools` | object | Per-pool cash state for day shift |
| `selectedDayPool` | string | Which day pool accordion card is open |
| `lastDayResult` | object | Last computed day-shift result |
| `$` | function | `document.getElementById` alias |
| `DENOMS` | array | `[100, 50, 20, 10, 5, 1]` |

---

## 2\. Function Inventory

### js/utils.js — Pure helpers, no DOM, no state

| Function | Reads State | Writes State | DOM | Calls |
| :---- | :---- | :---- | :---- | :---- |
| `parseWholeNumberString(raw)` | — | — | — | — |
| `parseTimeString(raw)` | — | — | — | — |
| `setInputInvalid(el, invalid)` | — | — | toggles `.input-invalid` on el | — |
| `getVal(id)` | — | — | reads `#id.value` | `parseWholeNumberString`, `$` |
| `poolValue(pool)` | `DENOMS` | — | — | — |
| `escapeHTML(v)` | — | — | — | — |
| `fmtHrs(h)` | — | — | — | — |
| `fmtTime(t, inTime, wrapped)` | — | — | — | — |
| `fmtClock(t)` | — | — | — | — ⚠️ DEAD |
| `addClockMinutes(t, minutes)` | — | — | — | — ⚠️ DEAD |

---

### js/engine.js — Pure distribution engine, no DOM, no state writes

| Function | Reads State | Writes State | DOM | Calls |
| :---- | :---- | :---- | :---- | :---- |
| `blankBills()` | — | — | — | — |
| `normalizePool(pool)` | `DENOMS` | — | — | `parseWholeNumberString` |
| `buildDistributionSlots(staffArr, leftoverAmount)` | — | — | — | `blankBills` |
| `getSmallBillRequirementsForSlots(slots, poolIn)` | — | — | — | `normalizePool` |
| `getSmallBillRequirements(staffArr, poolIn, leftoverAmount)` | — | — | — | `getSmallBillRequirementsForSlots`, `buildDistributionSlots` |
| `previewSmallBillTrades(staffArr, poolIn, leftoverAmount)` | — | — | — | `normalizePool`, `buildDistributionSlots`, `blankBills`, `calculateV19Pipeline`, `getSmallBillRequirementsForSlots`, `poolValue` |
| `calculateV19Pipeline(staffArr, poolIn, leftoverAmount)` | — | — | — | `normalizePool`, `buildDistributionSlots`, `runPreflight`, `buildPreferredPath`, `runCascadingSieve`, `runDFS`, `gradePaths`, `blankBills` |
| `runPreflight(slots, pool)` | — | — | — | `getSmallBillRequirementsForSlots`, `poolValue` |
| `runCascadingSieve(slots, poolIn)` | — | — | — | `normalizePool` |
| `cloneDistributionSlots(slots)` | — | — | — | — |
| `apportionDenomCounts(slots, denom, available)` | — | — | — | — |
| `buildPreferredPath(slotsIn, poolIn)` | — | — | — | `cloneDistributionSlots`, `normalizePool`, `apportionDenomCounts`, `applyBestFiftyPlan`, `assignLowerDenomsBalanced` |
| `applyBestFiftyPlan(slots, pool)` | — | — | — | — |
| `applyBestFlipperPlan(slots, pool)` | — | — | — | — ⚠️ DEAD (never called) |
| `assignLowerDenomsBalanced(slots, pool)` | — | — | — | `assignDenomBalanced` |
| `assignDenomBalanced(slots, pool, denom)` | — | — | — | — |
| `smallBillCount(s)` | — | — | — | — |
| `smallBillValue(s)` | — | — | — | — |
| `removeSmallValueWithOrder(s, value, order)` | — | — | — | `blankBills` |
| `removeSmallValue(s, value)` | — | — | — | `removeSmallValueWithOrder` |
| `addSmallBundle(s, bundle)` | — | — | — | — |
| `smallSpreadScore(slots)` | — | — | — | `smallBillValue`, `smallBillCount` |
| `rebalanceTwentiesAndSmallBills(slots)` | — | — | — | `smallSpreadScore`, `removeSmallValue`, `addSmallBundle`, `rebalanceSmallDenominationBundles` |
| `subtractSmallBundle(s, bundle)` | — | — | — | — |
| `rebalanceSmallDenominationBundles(slots)` | — | — | — | `smallSpreadScore`, `removeSmallValueWithOrder`, `addSmallBundle`, `subtractSmallBundle` |
| `runDFS(slots, poolIn)` | — | — | — | `normalizePool` |
| `gradePaths(paths)` | — | — | — | — |
| `solveDistribution(slots, poolIn)` | — | — | — | `calculateV19Pipeline`, `blankBills` |
| `distributeBills(staff, available, leftover)` | — | `lastRemainderBills`, `lastDistributionError`, `lastPoolAfter` | — | `calculateV19Pipeline`, `blankBills`, `normalizePool` |

---

### js/engine\_day.js — Pure day-shift engine

| Function | Reads State | Writes State | DOM | Calls |
| :---- | :---- | :---- | :---- | :---- |
| `dayShiftAbsolute(t)` | — | — | — | — |
| `overlapHours(personIn, personOut, poolStart, poolEnd)` | — | — | — | — |
| `deriveDayShiftWindows(bartenders, servers)` | — | — | — | — |
| `normaliseDayStaff(rawRows, role, defaultInAbs, defaultOutAbs)` | — | — | — | `parseTimeString`, `dayShiftAbsolute` |
| `calculateDayShift(bartenderRows, serverRows, poolCash, partyConfig)` | — | — | — | `normaliseDayStaff`, `deriveDayShiftWindows`, `overlapHours`, `parseTimeString`, `dayShiftAbsolute` |

---

### js/cash.js — Night shift cash input handling

| Function | Reads State | Writes State | DOM | Calls |
| :---- | :---- | :---- | :---- | :---- |
| `getTotal()` | — | — | reads `#b100`–`#b1` | `getVal` |
| `getInputPool()` | — | — | reads `#b100`–`#b1` | `getVal` |
| `readBillInputSnapshot()` | `DENOMS` | — | reads `#b{d}` values | `$` |
| `writeBillInputSnapshot(snap)` | `DENOMS` | — | writes `#b{d}` values | `$` |
| `poolFromSnapshot(snap)` | `DENOMS` | — | — | `parseWholeNumberString` ⚠️ DEAD |
| `snapshotCurrentCashMode()` | `cashMode`, `DENOMS` | `netTotalSnapshot`, `netBillSnapshot`, `perBillSnapshot` | reads `#net-total-input`, `#b{d}` | `readBillInputSnapshot`, `$` |
| `refreshCashTotals(total)` | — | — | writes `#cash-page-total`, `#cash-total-bottom` | `$` |
| `setCashError(message)` | — | — | writes `#cash-error` | `$` |
| `validateCashInputs()` | `cashMode`, `DENOMS` | — | reads/marks inputs | `parseWholeNumberString`, `setInputInvalid`, `setCashError`, `$` |
| `onBillsChange()` | `cashMode`, `DENOMS` | `perBillSnapshot` | reads/writes bill inputs \+ subtotals | `readBillInputSnapshot`, `validateCashInputs`, `parseWholeNumberString`, `refreshCashTotals`, `updateStockCards`, `updateTabIndicators`, `autoCalculate`, `$` |
| `syncPoolToInputs(pool)` | `cashMode`, `DENOMS` | — | writes `#b{d}` | `onBillsChange`, `$` ⚠️ only called internally |
| `setCashMode(mode)` | `cashMode` | `cashMode`, `isSwitchingCashMode` | shows/hides sections, toggles buttons | `snapshotCurrentCashMode`, `writeBillInputSnapshot`, `onBillsChange`, `onNetTotalChange`, `$` |
| `getIdealTargetsForTotal(total)` | `DENOMS` | — | reads `#staffList` rows, `#gc-in/out`, `#ct{id}` | `parseTimeString`, `parseWholeNumberString`, `$` |
| `computeIdealFromTotal(total)` | — | — | — | `getIdealTargetsForTotal` |
| `renderNetBreakdown(total, ideal)` | — | — | writes `#net-breakdown` | `$` |
| `refreshNetTotalBreakdown()` | `cashMode`, `isUpdatingNetTotal` | `isUpdatingNetTotal` | — | `onNetTotalChange` |
| `onNetTotalChange()` | `cashMode`, `DENOMS`, `isUpdatingNetTotal` | `netTotalSnapshot`, `netBillSnapshot` | reads/writes net input \+ bill inputs | `validateCashInputs`, `readBillInputSnapshot`, `computeIdealFromTotal`, `refreshCashTotals`, `updateStockCards`, `updateTabIndicators`, `renderNetBreakdown`, `autoCalculate`, `$` |

---

### js/cash\_day.js — Day shift multi-pool cash handling

| Function | Reads State | Writes State | DOM | Calls |
| :---- | :---- | :---- | :---- | :---- |
| `getDayPoolActiveIds()` | `dayPools` | — | — | — |
| `onDayPoolBillsChange(poolId)` | `dayPools`, `DENOMS` | `dayPools[poolId].perBillSnapshot` | reads/writes pool bill inputs | `parseWholeNumberString`, `setInputInvalid`, `refreshDayPoolTotal`, `autoCalculate`, `$` |
| `onDayPoolNetTotalChange(poolId)` | `dayPools` | `dayPools[poolId].netTotalSnapshot`, `dayPools[poolId].netBillSnapshot` | reads/writes pool net input | `parseWholeNumberString`, `setInputInvalid`, `computeIdealFromTotal`, `refreshDayPoolTotal`, `autoCalculate`, `$` |
| `refreshDayPoolTotal(poolId)` | — | — | writes `#dp-total-{poolId}` | `getDayPoolTotal`, `$` |
| `setDayPoolCashMode(poolId, mode)` | `dayPools` | `dayPools[poolId].cashMode` | shows/hides sections, toggles buttons | `onDayPoolNetTotalChange`, `onDayPoolBillsChange`, `$` |
| `togglePartyPool(pid)` | `dayPools` | `dayPools[pid].enabled`, `selectedDayPool` | — | `renderDayPoolCashPanels`, `autoCalculate` |
| `onPartyWindowChange(pid, field)` | `dayPools` | `dayPools[pid].windowStart/End` | reads input, writes subtitle | `autoCalculate`, `$` |
| `selectDayPool(poolId)` | `selectedDayPool` | `selectedDayPool` | toggles `.dp-pool-card--open`, shows/hides body | — |
| `renderDayPoolCashPanels()` | `dayPools`, `selectedDayPool`, `DENOMS` | — | writes `#day-cash-panels` entirely | `getDayPoolTotal`, `escapeHTML`, `refreshDayPoolTotal`, `getDayPoolActiveIds`, `$` |
| `updateDayStockCards()` | `shiftMode` | — | writes `#sc-total`, `#sc-billcount`, `#sc-staffcount`, `#staffPageCount2` | `getDayPoolActiveIds`, `getDayPoolTotal`, `$` |

---

### js/staff.js — Staff row management

| Function | Reads State | Writes State | DOM | Calls |
| :---- | :---- | :---- | :---- | :---- |
| `reindexTabOrder()` | — | — | writes tabIndex \+ placeholder on all staff inputs | `$` |
| `addStaff(focusNew, listId)` | `shiftMode` | `staffId` or `serverStaffId` | appends row to list, focuses if requested | `reindexTabOrder`, `calcHours`, `updateSectionCounts`, `saveState`, `$` |
| `onStaffNameInput()` | `shiftMode` | — | — | `updateDayStockCards` or `updateStockCards`, `updateTabIndicators`, `autoCalculate` |
| `delStaff(id, listId)` | `shiftMode` | — | removes `#staff{id}` | `reindexTabOrder`, `updateSectionCounts`, `updateStockCards`/`updateDayStockCards`, `updateTabIndicators`, `autoCalculate`, `saveState`, `$` |
| `toggleCloser(id)` | — | — | toggles `.on` on `#ct{id}` | `autoCalculate`, `$` |
| `updateSectionCounts()` | `shiftMode` | — | writes `#bartender-count`, `#server-count`, `#staffPageCount`, `#staffPageCount2` | `$` |
| `onDefaultTimesChange()` | — | — | — | `reindexTabOrder`, `calcHours`, `autoCalculate` |
| `onTimeInput(id, field)` | — | — | removes `.using-default` from input | `calcHours`, `$` |
| `calcHours(id)` | — | — | writes `#hrs{id}`, toggles `.using-default`, `.input-invalid`, `.err` | `parseTimeString`, `setInputInvalid`, `fmtHrs`, `updateStockCards`/`updateDayStockCards`, `$` |
| `collectStaffInputRows()` | — | — | reads `#staffList` rows | `$` ⚠️ DEAD (superseded by `collectNamedStaffRows`) |

---

### js/cards.js — Home tab stock cards \+ live dashboard

| Function | Reads State | Writes State | DOM | Calls |
| :---- | :---- | :---- | :---- | :---- |
| `updateStockCards()` | `DENOMS`, `shiftMode` | — | writes `#sc-total`, `#sc-billcount`, `#sc-staffcount`, `#staffPageCount` | `getTotal`, `getVal`, `fmtHrs`, `$` |
| `updateHomeLive(staffArr)` | `lastRate`, `lastTotH`, `lastLeftover`, `lastDistributionError`, `currentInputError` | — | writes `#home-live-section` entirely | `getTotal`, `fmtHrs`, `$` |

---

### js/tabs.js — Tab switching \+ indicator updates

| Function | Reads State | Writes State | DOM | Calls |
| :---- | :---- | :---- | :---- | :---- |
| `switchTab(name, btn)` | — | — | toggles `.active` on panels \+ buttons, scrolls content, focuses first empty input | `$` |
| `updateTabIndicators()` | — | — | writes `#tab-dot-cash`, `#tab-sub-cash`, `#tab-dot-staff`, `#tab-sub-staff` | `getTotal`, `$` |

---

### js/modals.js — Modal open/close

| Function | Reads State | Writes State | DOM | Calls |
| :---- | :---- | :---- | :---- | :---- |
| `openModal(id)` | — | — | adds `.open`, sets `body.overflow` | `$` |
| `closeModal(id)` | — | — | removes `.open`, clears `body.overflow` | `updateStockCards`, `autoCalculate`, `$` |
| `modalBgClose(e, id)` | — | — | — | `closeModal`, `$` |

---

### js/persist.js — localStorage \+ import/export

| Function | Reads State | Writes State | DOM | Calls |
| :---- | :---- | :---- | :---- | :---- |
| `saveState()` | `isRestoringState`, `shiftMode`, `cashMode`, `perBillSnapshot`, `netBillSnapshot`, `dayPools`, `DENOMS` | — | reads all staff rows, bill inputs, date, gc-in/out | `snapshotCurrentCashMode`, `readBillInputSnapshot`, `$` |
| `loadState()` | — | — | — | `validateSessionSnapshot` |
| `isPlainObject(value)` | — | — | — | — |
| `validateBillSnapshot(value, label)` | `DENOMS` | — | — | `parseWholeNumberString`, `isPlainObject` |
| `validateSessionSnapshot(snap)` | — | — | — | `validateBillSnapshot`, `isPlainObject`, `parseWholeNumberString` |
| `exportSession()` | — | — | creates/clicks `<a>` download | `saveState`, `$` |
| `importSession(file)` | — | — | — | `validateSessionSnapshot` |
| `clearSession()` | — | — | — | — |
| `triggerImport()` | — | — | clicks `#importFileInput` | `$` |
| `toggleSessionMenu()` | — | — | toggles `.hidden` on `#sessionMenu` | `$` |
| *(click listener)* | — | — | closes menu on outside click | — |

---

### js/calculator.js — Calculation orchestration

| Function | Reads State | Writes State | DOM | Calls |
| :---- | :---- | :---- | :---- | :---- |
| `setStaleBanners(reason)` | — | — | writes all `.stale-banner` text \+ adds `.visible` | — |
| `clearStaleBanners()` | — | — | removes `.visible` from all `.stale-banner` | — |
| `renderBlockedPlaceholders(reason)` | — | — | writes `#summary-content`, `#dist-content` | `escapeHTML`, `$` |
| `blockCalculation(reason, options)` | `lastStaff`, `lastDayResult` | `currentInputError` | — | `updateHomeLive`, `clearStaleBanners`, `renderBlockedPlaceholders` |
| `collectNamedStaffRows()` | `DENOMS` | — | reads `#staffList` rows, `#gc-in`, `#gc-out` | `parseTimeString`, `setInputInvalid`, `$` |
| `autoCalculate()` | `shiftMode`, `cashMode`, `isUpdatingNetTotal` | — | — | `autoCalculateDay`, `refreshNetTotalBreakdown`, `validateCashInputs`, `collectNamedStaffRows`, `updateStockCards`, `updateTabIndicators`, `blockCalculation`, `calculate`, `saveState` |
| `calculate(silent)` | `DENOMS` | `livePool`, `lastStaff`, `lastTotal`, `lastTotH`, `lastRate`, `lastLeftover` | reads `#ct{id}` closer buttons | `collectNamedStaffRows`, `blockCalculation`, `parseTimeString`, `getTotal`, `getInputPool`, `distributeBills`, `renderAll`, `switchTab`, `$` |
| `renderAll(staff, total, totH, rate, leftover)` | `livePool` | `currentInputError` | — | `distributeBills`, `renderSummary`, `renderDist`, `updateHomeLive` |
| `collectDayStaffRows(listId, role)` | — | — | reads staff rows from listId | `parseTimeString`, `$` |
| `getDayPoolCash()` | `dayPools` | — | reads pool net inputs | `getDayPoolTotal`, `$` |
| `getDayPoolTotal(poolId)` | `dayPools` | — | reads `#dp-net-{poolId}` or `#dp-b{d}-{poolId}` | `parseWholeNumberString`, `$` |
| `getDayPoolBills(poolId)` | `dayPools`, `DENOMS` | — | reads pool bill inputs | `parseWholeNumberString`, `$` |
| `mergeBillPools(poolIds)` | `DENOMS` | — | — | `getDayPoolBills` |
| `autoCalculateDay()` | `dayPools`, `lastDayResult` | `lastDayResult`, `livePool`, `currentInputError` | — | `collectDayStaffRows`, `getDayPoolCash`, `calculateDayShift`, `mergeBillPools`, `distributeBills`, `renderDaySummary`, `renderDayDist`, `updateHomeLiveDay`, `blockCalculation`, `clearStaleBanners`, `saveState` |

---

### js/summary.js — Night shift summary renderer

| Function | Reads State | Writes State | DOM | Calls |
| :---- | :---- | :---- | :---- | :---- |
| `renderSummary(staffWithBills, staffOrig, total, totH, rate, leftover, poolAfter)` | `lastDistributionError`, `lastRemainderBills`, `lastLeftover`, `livePool` | — | writes `#summary-content` entirely | `escapeHTML`, `fmtTime`, `fmtHrs`, `poolValue`, `getSmallBillRequirements`, `renderSmallBillRequirementCards`, `$` |

---

### js/summary\_day.js — Day shift summary \+ dist renderers \+ home live

| Function | Reads State | Writes State | DOM | Calls |
| :---- | :---- | :---- | :---- | :---- |
| `renderDaySummary(result)` | `lastDistributionError` | — | writes `#summary-content` entirely | `escapeHTML`, `fmtHrs`, `$` |
| `renderDayDist(result)` | `lastDistributionError`, `lastRemainderBills`, `DENOMS` | — | writes `#dist-content` entirely | `escapeHTML`, `poolValue`, `$` |
| `updateHomeLiveDay(result)` | `lastDistributionError`, `currentInputError` | — | writes `#home-live-section` entirely | `$` |

---

### js/dist.js — Night shift dist renderer

| Function | Reads State | Writes State | DOM | Calls |
| :---- | :---- | :---- | :---- | :---- |
| `renderDist(swb, pa)` | — | `_lastDistStaff` | — | `renderDistTable` |
| `renderDistTable(swb, poolAfter)` | `lastLeftover`, `lastDistributionError`, `lastRemainderBills`, `livePool` | — | writes `#dist-content`, clears `#stale-dist` | `getSmallBillRequirements`, `renderSmallBillRequirementCards`, `previewSmallBillTrades`, `renderTradePreview`, `renderDistTableMarkup`, `poolValue`, `escapeHTML`, `$` |
| `renderSmallBillRequirementCards(req)` | — | — | — | `escapeHTML` |
| `renderCountCell(count)` | — | — | — | — |
| `renderTradePreview(preview)` | `livePool`, `DENOMS` | — | — | `escapeHTML`, `renderDistTableMarkup` |
| `renderDistTableMarkup(swb, options)` | `DENOMS` | — | — | `escapeHTML` |

---

### js/person.js — Person profile modal

| Function | Reads State | Writes State | DOM | Calls |
| :---- | :---- | :---- | :---- | :---- |
| `openPersonModal(rowId)` | `lastStaff`, `_lastDistStaff`, `lastRate`, `DENOMS` | — | writes `#personModalLabel`, `#personModalBody` | `escapeHTML`, `fmtTime`, `fmtHrs`, `openModal` |
| `updatePersonFromModal(rowId)` | — | — | writes staff row in/out inputs | `calcHours`, `autoCalculate`, `openPersonModal`, `closeModal`(?), `$` |

---

### js/shift.js — Shift mode toggle

| Function | Reads State | Writes State | DOM | Calls |
| :---- | :---- | :---- | :---- | :---- |
| `setShiftMode(mode, skipConfirm)` | `shiftMode`, `lastStaff`, `lastDayResult` | `shiftMode`, `lastDayResult`, `lastStaff` | shows/hides night/day sections, toggles buttons, updates label | `getTotal`, `renderDayPoolCashPanels`, `clearStaleBanners`, `renderBlockedPlaceholders`, `updateShiftStockCards`, `autoCalculate`, `saveState`, `$` |
| `updateShiftStockCards()` | `shiftMode` | — | — | `updateDayStockCards` or `updateStockCards`, `updateTabIndicators` |
| `_updateStockCardsShiftAware()` | `shiftMode` | — | — | `updateDayStockCards` or `updateStockCards` |

---

### js/main.js — Bootstrap

Runs once on load. Not a function — top-level script. Actions:

- Sets today's date on `#tipDate`  
- Calls `loadState()`  
- Restores shift mode, cash mode, bill inputs, staff rows, day pool cash from saved state  
- Sets `isRestoringState = true` during restore to suppress `saveState` calls  
- Calls `setCashMode`, `renderDayPoolCashPanels`, `addStaff` as part of restore  
- Calls `reindexTabOrder`, `updateSectionCounts`, `updateTabIndicators`, `autoCalculate`  
- Adds `visualViewport` resize \+ scroll listeners for keyboard detection  
- Adds `change` \+ `input` listeners on `#tipDate`

---

## 3\. Dependency Graph

main.js (bootstrap)

  └── loadState (persist.js)

  └── addStaff (staff.js)

  └── setCashMode (cash.js)

  └── renderDayPoolCashPanels (cash\_day.js)

  └── autoCalculate (calculator.js)

        ├── \[night\] calculate

        │     ├── collectNamedStaffRows

        │     ├── getTotal (cash.js)

        │     ├── getInputPool (cash.js)

        │     ├── distributeBills (engine.js)

        │     └── renderAll

        │           ├── distributeBills (engine.js)

        │           ├── renderSummary (summary.js)

        │           ├── renderDist (dist.js)

        │           └── updateHomeLive (cards.js)

        └── \[day\] autoCalculateDay

              ├── collectDayStaffRows

              ├── getDayPoolCash

              ├── calculateDayShift (engine\_day.js)

              ├── mergeBillPools

              ├── distributeBills (engine.js)

              ├── renderDaySummary (summary\_day.js)

              ├── renderDayDist (summary\_day.js)

              └── updateHomeLiveDay (summary\_day.js)

user input (any field)

  └── oninput handler (cash.js / staff.js / cash\_day.js)

        └── autoCalculate

              └── saveState (persist.js)

---

## 4\. Dead Code Summary

| Item | File | Reason |
| :---- | :---- | :---- |
| `fmtClock()` | utils.js | Never called |
| `addClockMinutes()` | utils.js | Never called |
| `poolFromSnapshot()` | cash.js | Never called externally |
| `syncPoolToInputs()` | cash.js | Only called in setCashMode |
| `isSwitchingCashMode` | state.js \+ cash.js | Set but never read |
| `collectStaffInputRows()` | staff.js | Superseded by `collectNamedStaffRows` |
| `rerenderAfterTrade()` | calculator.js | Never called (not in provided code but noted in IMPROVEMENTS.md) |
| `applyBestFlipperPlan()` | engine.js | Defined but never called |
| `runPreflight()` ideals return | engine.js | `ideals` object computed, never consumed by caller |
| `.home-live-row` etc. | home.css | Previous layout, replaced by dashboard |
| `.person-meta`, `.person-hrs`, `.person-times`, `.person-sep` | summary.css | Not in current markup |
| `.info-box` | components.css | Not referenced in HTML or JS |

---

## 5\. Key Coupling Problems

These are the hardest things to unpick in a rewrite:

**1\. `autoCalculate` is called from 15+ places** Every input `oninput` across cash.js, staff.js, cash\_day.js, modals.js, and shift.js calls it directly. There is no event bus or debounce — every keystroke triggers a full recalculate \+ render \+ localStorage write.

**2\. Renderers read global state directly** `renderSummary`, `renderDist`, `renderDistTable` read `lastDistributionError`, `lastRemainderBills`, `livePool`, `lastLeftover` directly from globals instead of receiving them as parameters. This makes the render functions impossible to call in isolation.

**3\. `distributeBills` has a side effect** It writes `lastRemainderBills`, `lastDistributionError`, `lastPoolAfter` as side effects. Callers don't receive this data as a return value — they read the globals afterward.

**4\. `calculate()` and `autoCalculateDay()` both write globals AND trigger renders** No separation between computation and display. Swapping the renderer requires touching the calculator.

**5\. Staff row IDs are DOM-coupled** Staff identity (`staffId`, `serverStaffId`) is tied to DOM element IDs (`#staff42`). The closer toggle state (`#ct42.classList.contains('on')`) is read from the DOM during calculation, not from a data model.

---

## 6\. What to Keep Unchanged in a Rewrite

| Item | Why |
| :---- | :---- |
| `engine.js` entirely | Pure functions, well-tested, no coupling |
| `engine_day.js` entirely | Same |
| `utils.js` (minus dead functions) | Pure, tested |
| `DENOMS` constant | Used everywhere correctly |
| CSS design tokens (`variables.css`) | Solid token system |
| Test files | Work correctly as-is |
| The calculation logic in `calculate()` | Correct math, just needs extracting from DOM code |

