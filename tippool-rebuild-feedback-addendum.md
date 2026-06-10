# TipPool Rebuild Feedback Addendum

Source plan: `tippool-rebuild-catalyst-plan.md`  
Source feedback: user notes from June 10, 2026.

This addendum updates and supersedes parts of the original rebuild catalyst plan. The main shift is that the rebuild should be more decisive: night-shift-first, cleaner UI/component execution, likely React/static-PWA, remove day-shift UI for now, preserve the math, and handle small-bill minimums using cumulative value logic while displaying them in normal bill-denomination language.

## 1. High-Level Direction Changes

### 1.1 Preferred rebuild style

The preferred direction is now closer to the original plan's Option C:

- Use a component-based rebuild if it gives the cleanest UI execution.
- React is acceptable and probably preferred if the final result still deploys as a free/static web app.
- The final app must be usable from an iPhone home-screen icon.
- The final app should be deployable by URL, not by copying an HTML file onto the phone.
- Offline capability is still desired.
- LocalStorage persistence is still desired.
- A database is not needed for the first rebuild.

Plain-language recommendation:

> Build a React/Vite static PWA, deploy it for free to a stable URL, and make sure it can be added to the iPhone home screen with offline caching and same-origin assets.

This gives the app the clean component structure needed for a real UI rebuild while still producing ordinary static HTML/CSS/JS files after build.

### 1.2 Deployment target

The target should not be "open `index.html` from Files on iPhone."

The target should be:

- Free web deployment.
- HTTPS URL.
- iPhone Safari compatible.
- Add to Home Screen works.
- LocalStorage persists per deployed URL.
- Service worker caches the app shell for offline use.

Best practical options to evaluate:

1. **Vercel**
   - Very easy GitHub-connected deploys.
   - Free for this kind of app.
   - Good for React/Vite.

2. **Netlify**
   - Very easy GitHub-connected deploys.
   - Free for this kind of app.
   - Often simple for static PWAs.

3. **GitHub Pages**
   - Free and already close to the repository.
   - Can work well.
   - Needs more care with path/base configuration if the app is served from a subpath.

Initial recommendation:

- Use Vite + React.
- Deploy first to **Vercel** for simplest mobile URL testing.
- Add PWA manifest and service worker.
- Test on the actual iPhone early.
- Avoid `file://` entirely to prevent mobile CORS/loading issues.
- Keep all assets same-origin or bundled to avoid offline and CORS surprises.

Decision from follow-up:

- Use Vercel as the first deployment target.
- Offline support can start with app-shell caching plus localStorage persistence.
- Full guaranteed offline caching for every font/asset is nice, but not a first-pass blocker.

### 1.3 Day shift scope

The first rebuild should remove day-shift UI from the active product.

Later, day-shift-like behavior should return as a more general "multiple pools" feature:

- Same staff list.
- Multiple tip pools.
- Each pool can optionally define:
  - Start time.
  - End time.
  - Included roles, such as bar only or bar + servers.
  - Support settings.
  - Pool-specific cash.

This is different from keeping the current day-shift implementation. The current day-shift code should not constrain the first rebuild.

Recommended first-rebuild treatment:

- Do not show a day/night toggle.
- Do not port current day-shift screens into the initial UI.
- Keep the domain idea in mind so the data model is not hostile to future pools.
- Treat multi-pool support as a later feature, after the night-shift flow is excellent.

## 2. Staff Section Updates

### 2.1 Crew summary should be less closer-centric

The original plan suggested collapsed staff summary values like:

- 5 staff.
- 2 closers assumed.
- 2 missing out times.

This overemphasizes closers/non-closers. In the real workflow, closers matter for math, but the manager mostly needs fast crew entry and confidence that the close time placeholder is being applied correctly.

Updated collapsed staff summary should emphasize:

- Number of people.
- Whether there are typed out times.
- Whether blank out times are using the global close time.
- Whether any time values are invalid or unusual.

Better examples:

```text
5 staff | close time 2:30 | 3 blank outs using close time
```

```text
5 staff | 2 typed outs | all times valid
```

```text
5 staff | one out time later than close time
```

Closer count can be shown as a secondary detail or visual cue, but it should not dominate the collapsed staff summary.

### 2.2 Blank out times

Decision:

- Blank out time means closer by default.
- Blank out time also means "use the global close time for calculations."
- Blank out fields should remain visually blank in the input row.
- The placeholder should show the global close time.
- The calculation should use the placeholder close time.
- Summary/detail views can display the effective close time normally.
- Staff edit views can style placeholder-derived times more subtly.

Important behavior:

- Changing the global close time updates blank out-time placeholders.
- Changing the global close time changes calculations for blank out-time rows.
- It should not write values into the blank fields.

### 2.3 Closer detection and warnings

Decisions:

- Usually, closers are the latest out-time people.
- Any blank out-time person uses the global close time.
- If an explicitly typed out time is later than the global close time, show a warning.
- The system can infer closer status from latest effective out time.
- Manual closer override should be possible.
- If a user deselects a blank-out-time person as closer, warn or visually question it.
- If a user marks someone with an earlier out time as closer, allow it but make the override visible.
- A minimum of two closers is normal and should be expected.
- If only one closer is detected, show a warning.

Not needed for first rebuild:

- Supporting a person who has an out time but still earns closer bonus for closing work.

## 3. Remainder, Bonus, and "Chump" Terminology

The original plan used "remainder" too broadly. The user-facing language should separate three concepts:

1. **Raw remainder**
   - The difference after flooring each person's hours-based exact payout.
   - Example:
     - Total tips: 1934.
     - Sum of floored person bases: 1931.
     - Raw remainder: 3.

2. **Closer bonus**
   - The per-closer amount from the raw remainder.
   - Formula:
     - `perCloserBonus = floor(rawRemainder / closerCount)`.
   - Example:
     - Raw remainder 3.
     - 2 closers.
     - Each closer gets 1.
     - Total closer bonus paid: 2.

3. **Chump**
   - The final undistributed leftover after closer bonus.
   - Formula:
     - `chump = rawRemainder - (perCloserBonus * closerCount)`.
   - Example:
     - Raw remainder 3.
     - 2 closers get 1 each.
     - Chump = 1.

User-facing decision:

- Use **Chump** for the final low-importance undistributed amount.
- Treat Chump as its own distribution row for bill assignment, like a pseudo-person.
- Show Chump in a non-primary/low-importance area.
- Show closer bonus on person cards when relevant.
- Put detailed raw-remainder math in a secondary detail sheet, not the main summary.

Future possible feature:

- Add settings for different rounding/bonus behavior.
- Example: if someone's exact payout is `433.98`, a threshold setting could round them up before closer-bonus allocation.
- If rounded up this way, that person may become ineligible for the later closer-bonus pass depending on the configured rule.
- This is not MVP.

## 4. Time Input and Storage Updates

### 4.1 Time granularity

Decision:

- All times should be 15-minute interval values.
- Valid examples:
  - `5:00`
  - `5:15`
  - `5:30`
  - `5:45`
  - `6:00`
- In-times are usually on the hour or half hour.
- Weird cases like `5:45` or `6:15` should still work.

Recommended behavior:

- Store time internally in a clean numeric format, probably integer quarter-hour units from a shift-day anchor.
- Avoid repeatedly doing math on display strings.
- Validate against 15-minute increments.
- If a user types a non-15-minute value, treat it as invalid input for MVP. Do not build a separate warning or nearest-rounding flow first.

### 4.2 Input style

The current pain point is mobile time fields with multiple sub-fields. Avoid `hh` / `mm` / `am-pm` segmented typing.

Preferred input model:

- A single active field accepts quick numeric/decimal entry.
- While focused, it behaves like a simple numeric input.
- On blur, it parses and displays a clean clock time.

Examples:

```text
User types: 5
Display after blur: 5:00 PM
```

```text
User types: 2.5
Display after blur: 2:30 AM
```

```text
User types: 6.25
Display after blur: 6:15 PM
```

Keep decimal entry because the current user has learned it, but display clock time afterward.

### 4.3 AM/PM assumptions

The app should use shift-aware assumptions instead of asking for AM/PM on every input.

For typical night-shift in-times:

- Values such as `4`, `5`, `6`, `7`, `8` should mean PM.
- Values from around `9` to before `12` may need an AM interpretation depending on field/context.
- `12` should not be treated carelessly; noon/midnight assumptions need explicit rules.

For out-times:

- Interpret the entered out time as the next logical occurrence after the in time.
- Example:
  - In `5` means 5:00 PM.
  - Out `2.5` means 2:30 AM.
- If the out value is greater than the in value in the same evening context, it can remain PM.
- Example:
  - In `2.25` means 2:15 PM.
  - Out `2.5` means 2:30 PM.
  - Out `2` could mean 2:00 AM the next day if that is the next logical close-time occurrence.

Override options to consider later:

- Accept 24-hour-style values like `21` for 9:00 PM.
- Accept values above 12 for explicit next-day/long-shift interpretation.
- Add an override in the person detail sheet instead of cluttering the quick row.
- Be careful with text suffixes like `9a`, because they may force the iPhone keyboard away from number pad.

### 4.4 Display style

Possible display rules:

- Compact views can show `2:30`.
- Staff/person detail can show `2:30 AM`.
- Placeholder-derived close times can use subtle color in staff edit rows.
- Summary can show effective times normally so the payout cards are easy to read.

## 5. Roster and Default Start Updates

### 5.1 Roster scope

Decisions:

- The rebuild should know about all roles eventually.
- Bar/bartender flow is the main default and should stay minimal.
- Servers/support can exist in the model later but should not clutter the first night-shift UI.

### 5.2 Roster save behavior

Decision:

- New typed names should auto-save to roster.
- For MVP, keep this simple: remember names automatically and do not attach remembered start-time assumptions to those names.
- If auto-save could surprise users, show a lightweight notice or undo later.

### 5.3 Crew selection

The roster picker should eventually support a grid/card selection flow:

- Tap multiple saved names.
- Apply them to tonight's session quickly.
- Sort by likely/frequent/recent names.

This does not have to be perfect in MVP, but the plan should leave room for it.

### 5.4 Start-time templates

Updated MVP decision:

- Do not implement start-time template logic in the first rebuild.
- Remembering names is useful now; remembering or generating start times is less likely to be reliable enough yet.
- Keep all start times user-entered or placeholder-driven for MVP.

Later idea:

- Day-of-week crew/start templates may become useful after the core UI is stable.
- If added, they should create editable placeholders, not rigid schedules.

Base template knowledge:

| Day | Base start template |
| --- | --- |
| Monday | 1 person at 4, 2 at 5 |
| Tuesday | 1 person at 4, 2 at 5 |
| Wednesday | 1 person at 4, 2 at 5 |
| Thursday | 1 at 4, 1 at 5, 2 at 6 |
| Friday | 2 at 5, 2 at 6 |
| Saturday | 4 at 5 |
| Sunday | 3 at 5 |

Important constraints:

- These are base/minimum patterns, not rigid rules.
- The user may add one or two more people at normal or odd start times.
- Private parties can introduce varied start times.
- All generated rows must remain editable.
- Auto-fill should feel like a convenience, not scheduling software.

### 5.5 Roster deletion

Support both:

- Delete from roster.
- Mark inactive.

Use confirmation/alert for destructive roster actions.

New Session should preserve roster/settings by default.

## 6. Cash Entry Updates

### 6.1 Default cash mode

Decision:

- Per-bill count should remain the default.
- The current cash-mode selection UI is not good enough; rebuild it as a mobile-friendly control that stays out of the way.
- Net total is rare and should look secondary.

### 6.2 Net-total mode

Net total should be treated as an estimate/planning tool unless exact bills are confirmed.

Useful net-total additions:

- Allow optional known count of `$50s`.
- Allow optional known count of `$100s`.
- Possibly allow known count of `$20s` if relevant.
- Use known high denominations to improve the minimum small-bill estimate.
- Make it clear that generated bill mix is not real counted cash.

Reason:

- $50s affect the need for $10s.
- $100s and $50s are often known or not changeable.
- The manager often wants to know how many small bills to keep before final exact count.

### 6.3 Partial-known mode

Partial-known mode is lower priority/backburner.

If later added, it should focus on the realistic use case:

- Known `$100s`.
- Known `$50s`.
- Sometimes known `$20s`.
- Unknown or not-final `$10s`, `$5s`, `$1s`.

Partial-known mode is only useful once at least staff count and rough payout targets exist. Without person values, it cannot say much.

### 6.4 Incremental tips

Decision:

- Incremental tip entry should keep a log.
- The log should be editable later if possible.

Example:

```text
Base total: 700
+42 booklet
+100 late card cash
=842
```

### 6.5 Combined cash pool

Decision:

- Treat bucket + booklet as one combined cash pool for now.
- Do not split the UI into separate bucket/booklet pools in MVP.

### 6.6 Bill count input

Current number-pad keyboard entry is good.

Later enhancements:

- Steppers.
- Swipe/drag edits.
- Strong visual feedback showing what changed.
- Non-input mode for reviewing bill counts without accidental edits.

### 6.7 Rubber-banded stacks and fixed-person bills

Rubber-band stack entry is not a major MVP need.

Possible later stack shortcuts:

- `50 x $1`.
- Maybe `30 x $5`.

A more useful later feature may be fixed-person bill constraints:

- Example distribution shows:
  - Person A has 19 ones.
  - Person B has 21 ones.
  - Person C has 20 ones.
  - Person D has 20 ones.
  - Chump has 1 one.
- User wants to give a full bundle to A.
- User can set Person A to exactly 59 ones.
- App recalculates the remaining distribution around that fixed assignment.

This is advanced and not MVP, but it is more aligned with real physical handling than generic rubber-band entry.

## 7. Small-Bill Logic Correction

This is the most important functional correction to the original plan.

### 7.1 Core rule

The app should not decide shortage/safety using isolated denomination counts like:

```text
need 4 ones, have 14 ones -> ok
need 3 fives, have 1 five -> short
```

That can be wrong because extra ones can cover some five-dollar needs.

The math should use cumulative value thresholds:

1. `$1s`
   - Minimum exact ones required.

2. `$1s + $5s`
   - Cumulative value needed in ones and fives.

3. `$1s + $5s + $10s`
   - Cumulative value needed in ones, fives, and tens.
   - $50s can cover odd-tens requirements where applicable.

The UI can still parse this back into friendly rows labelled `$1s`, `$5s`, `$10s`, but the pass/fail logic must use cumulative values.

### 7.2 Simple example

If the app displays:

```text
Need 4 ones
Need 3 fives
```

and the drawer has:

```text
14 ones
1 five
```

The app should not blindly say "short 2 fives."

Why:

- Minimum exact ones = 4.
- Minimum one-plus-five value = `4 + 3*5 = 19`.
- Available one-plus-five value = `14 + 1*5 = 19`.
- Therefore the small-bill value is covered.

The display can still say something like:

```text
$1s: need 4 exact, have 14
$5s: target 3 if keeping only 4 ones, but covered by extra ones
```

or a shorter mobile version:

```text
$1s       keep at least 4      have 14
$1+$5     need $19 value       have $19 covered
parsed: 4 ones + 3 fives, or extra ones can substitute
```

### 7.3 Range aggregation rule

For close-time ranges or multiple possible totals, calculate cumulative requirements for each scenario first.

For each scenario:

```text
onesMin
oneFiveValueMin = onesMin + fivesMin * 5
oneFiveTenValueMin = oneFiveValueMin + tensMin * 10
```

Then take maximums across scenarios:

```text
safeOnes = max(onesMin)
safeOneFiveValue = max(oneFiveValueMin)
safeOneFiveTenValue = max(oneFiveTenValueMin)
```

Then parse back into friendly bill counts:

```text
displayOnes = safeOnes
displayFives = ceil((safeOneFiveValue - safeOnes) / 5)
displayTenTierValue = safeOneFiveTenValue - safeOneFiveValue
displayTensConservative = ceil(displayTenTierValue / 10)
```

This produces a safe "keep this much" display without over-keeping fives just because one scenario individually had more fives but fewer ones.

Important display caution:

- `displayTenTierValue` may not always divide cleanly by 10 after range maximums are combined.
- In that case, the UI should not pretend the cumulative math naturally produced "0.5 of a $10."
- It should either:
  - show the cumulative value gap directly, or
  - round to a conservative whole-bill display while explaining that extra lower bills or $50 coverage can satisfy the same cumulative requirement.

### 7.4 User example captured

Scenario A:

```text
ones 19, fives 3, tens 1
1s value = 19
1+5 value = 19 + 3*5 = 34
1+5+10 value = 34 + 1*10 = 44
```

Scenario B:

```text
ones 9, fives 6, tens 0
1s value = 9
1+5 value = 9 + 6*5 = 39
1+5+10 value = 39 + 0*10 = 39
```

Scenario C:

```text
ones 4, fives 5, tens 1
1s value = 4
1+5 value = 4 + 5*5 = 29
1+5+10 value = 29 + 1*10 = 39
```

Safe cumulative maximums:

```text
safeOnes = max(19, 9, 4) = 19
safeOneFiveValue = max(34, 39, 29) = 39
safeOneFiveTenValue = max(44, 39, 39) = 44
```

Parsed display:

```text
ones = 19
fives = (39 - 19) / 5 = 4
ten-tier value gap = 44 - 39 = 5
simple whole-bill display may show 1 x $10, but the authoritative rule is cumulative value coverage
```

Important note:

- The implementation must be careful with ten-tier value parsing and $50 substitution.
- If $50s are covering odd-tens needs, the displayed `$10s` target may be lower than a naive parse.
- The safest implementation should keep cumulative values as the authoritative data and display parsed bill rows as explanatory UI, not as the source of truth.

### 7.5 Display recommendation

Show both:

1. Friendly parsed rows.
2. The cumulative value check, at least in compact form.

Example:

```text
Small bills to keep
$1s   19 exact ones
$5s   4 if keeping 19 ones
$10s  1 or covered by $50s

Coverage
$1 value          need 19  have 22
$1+$5 value       need 39  have 47
$1+$5+$10 value   need 44  have 67
```

Mobile compact version:

```text
Keep: 19 x $1, 4 x $5, 1 x $10
Covered by current $1/$5/$10/$50 mix
```

### 7.6 Shortage and surplus behavior

Shortage:

- Show strongly in distribution/detail.
- Show a smaller alert in summary.
- Keep suggestions denomination/value-based.
- Do not over-explain "engine failed vs impossible" unless this becomes a real issue.

Surplus:

- Always confirmation before applying.
- Consolidate small-bill surplus up to `$20s`.
- Do not optimize into `$50s` or `$100s` for MVP.
- Later add manual trade editor:
  - User can choose a weird/partial trade if the automatic one is not physically convenient.
  - Example: auto says add 3 twenties by giving up many small bills, but user only wants to make 1 twenty.

## 8. Summary and Distribution UI Updates

### 8.1 Person cards

Bill chips on person cards are optional depending on room.

Priorities:

1. Name.
2. Final payout.
3. Clear closer cue if relevant.
4. Time/hours.
5. Maybe bill chips if they fit.

Full bill distinction belongs in the distribution page/sheet/popup.

### 8.2 Distribution table

Do not add paid checkboxes or distribution step tracking.

The user wants:

- Show the chart.
- Let the user physically distribute.
- Avoid extra interaction steps.

Sorting:

- Keep input order for now.
- Do not group closers.
- Make closer visuals obvious where relevant.

### 8.3 "Advanced verification" wording

The phrase "advanced verification" is not ideal.

Use clearer wording:

- "Full distribution table."
- "Bill chart."
- "View all bills."

Meaning:

- A full person-by-denomination table for checking all bill counts.
- It is not a separate expert mode.

### 8.4 Receipt/image export

Later feature:

- Export a receipt-looking image.
- Should work well on iPhone.
- Ideally allow save to Photos or share sheet.
- If image save is hard, export/share to Notes or Files.

Not MVP.

## 9. Corrections and Snapshots

The original plan overemphasized correction trades.

Updated direction:

- Ignore complex post-distribution correction mode for now.
- Do not build person-to-person trade guidance in MVP.
- Every edit simply updates the current distribution.
- If a snapshot/delta feature is added later, make it a simple old/delta/new grid.

Possible later delta view:

```text
Name      Old   Delta   New
Alex      440   +5      445
Sam       390   -2      388
Chump     1     -1      0
```

No paid checkboxes. No settlement workflow. No bill-trade correction guide for now.

## 10. Persistence and History Updates

### 10.1 Old sessions

Decision:

- Fresh storage is fine.
- Do not spend first-rebuild effort migrating old `tippool_v1` sessions.

### 10.2 Session storage

Keep localStorage persistence.

Possible later feature:

- Save multiple dated sessions locally.
- Provide a table or calendar view.
- Open, edit, delete, or update past sessions.

Database sync is not required now.

Future database idea:

- Store locally first.
- Later manually sync or batch-sync sessions online if local storage becomes limiting.
- This is optional and not part of MVP.

### 10.3 Export/import

Session export/import:

- Keep as failsafe.
- Use the new session schema.
- Include copied names and IDs.

Roster export/import:

- Separate from session export/import.
- CSV would be useful because roster changes are infrequent and easier to inspect/edit.

## 11. Architecture Questions 67-75, Expanded in Plain Language

The original questions were too compressed. This section restates them in simpler terms with practical choices.

### 11.1 Build tool or no build tool?

Question:

- Is it okay if developers run a build command, as long as the final app is just static files on a URL?

Plain meaning:

- A React/Vite app is not one handwritten HTML file.
- But after build, it becomes normal static files.
- Those files can be deployed for free.
- Users only see a URL and an app icon.

Recommendation:

- Yes, use a build tool if React is chosen.
- The final user experience can still be simple and free.

### 11.2 ES modules without bundler?

Question:

- Should the browser load many JS files directly, or should a build tool bundle them?

Plain meaning:

- Direct browser modules are cleaner than old script globals.
- But direct modules can be annoying with `file://` and mobile browser quirks.
- A bundler usually avoids those issues.

Recommendation:

- If choosing React/Vite, let Vite bundle.
- Do not optimize for opening local files on iPhone.
- Optimize for a deployed URL.

### 11.3 TypeScript vs JSDoc

Question:

- How strict should the code be about data shapes?

Options:

1. JavaScript only.
   - Fastest.
   - Easiest to write.
   - More runtime mistakes possible.

2. JavaScript with JSDoc.
   - Some editor/type help.
   - Less setup.
   - Good middle ground.

3. TypeScript.
   - Best protection for state shapes and future features.
   - More setup and stricter code.

Recommendation:

- Use TypeScript if doing a fresh React/Vite rebuild.
- If that feels too heavy, use JSDoc for all key data models.

### 11.4 Design-system React components

Question:

- Should the existing design-system components remain examples, or become real app components?

Recommendation:

- If rebuilding in React, use them as visual/component seeds.
- Do not blindly import everything.
- Rebuild production components around the actual TipPool state and workflow.

### 11.5 What to do with day-shift code?

Options:

1. Delete from active rebuild.
2. Park under legacy.
3. Keep in the app but hidden.

Recommendation:

- Remove from active UI.
- Park useful concepts in documentation or legacy reference.
- Rebuild future multi-pool support from clean night-shift foundations.

### 11.6 Test runner

Question:

- Keep plain `node` tests or use a test runner?

Recommendation for React/Vite:

- Use Vitest or similar.
- Keep engine tests.
- Add tests for:
  - payout calculation.
  - cumulative small-bill requirements.
  - time parsing.
  - persistence validation.

### 11.7 CSS organization

Question:

- Should CSS be organized by old screen names or by reusable components?

Recommendation:

- Use shared tokens.
- Use component-level CSS for real UI pieces:
  - PersonCard.
  - CashEntry.
  - StaffRow.
  - SmallBillStatus.
  - Sheet.
- Keep global layout/base styles separate.

### 11.8 HTML strings vs components

Question:

- Should the app keep building UI with HTML strings?

Recommendation:

- If React is chosen, use JSX components.
- This is one of the main reasons to choose React.
- It will make sheets, cards, collapsed sections, and partial states easier to maintain.

### 11.9 State management

Question:

- Should the app use Redux/Zustand/etc.?

Recommendation:

- Start simple.
- Use React state plus a reducer or small custom store.
- Do not add Redux unless the app becomes much more complex.

### 11.10 Named actions

Question:

- Should every state change have a clear action name?

Recommendation:

- Yes.
- Examples:
  - `staff/addFromRoster`
  - `staff/updateTime`
  - `cash/updateBillCount`
  - `cash/addIncrement`
  - `session/setCloseTime`
  - `distribution/recalculate`

Why:

- Easier debugging.
- Easier undo/delta features later.
- Cleaner event tracking inside the code.

## 12. Updated First-Rebuild MVP

The revised MVP should be:

1. React/Vite static PWA shell.
2. Vercel free URL deployment target.
3. iPhone home-screen support.
4. Offline app-shell caching.
5. Night-shift only active UI.
6. No day-shift toggle.
7. Data-first session state.
8. Per-bill cash entry as default.
9. Single-screen summary-first layout.
10. Staff and cash as collapsible inline sections.
11. Blank out times use global close-time placeholder.
12. Chump terminology for final undistributed leftover.
13. Small-bill requirements based on cumulative value thresholds.
14. Distribution table available as "Bill chart" or "Full distribution table."
15. LocalStorage persistence using a fresh schema.
16. Export/import as failsafe.
17. Literal `Chump` label in the UI as a test.
18. Simple 15-minute time validation without a separate warning/rounding flow.

Backburner:

- Partial-known mode.
- Full roster grid polish.
- Multi-pool/day-shift replacement.
- Receipt image export.
- Manual trade editor.
- Fixed-person bill constraints.
- Old/delta/new snapshot view.
- Database sync.

## 13. Remaining Questions to Discuss Next

These were the most important open questions. Follow-up answers are now captured inline.

1. Do you want the next implementation branch to start a React/Vite app immediately, or first make a smaller static prototype of the new layout?

   - Current answer: unsure, but the fastest path to the real app is preferred.
   - Working decision: start the actual React/Vite static-PWA rebuild rather than making a separate throwaway prototype.

2. Which free deploy target do you prefer to try first: Vercel, Netlify, or GitHub Pages?

   - Answer: Vercel.

3. For iPhone offline support, is "loads the app shell offline and keeps last localStorage data" enough, or do you need every asset and font guaranteed offline too?

   - Answer: app-shell offline plus localStorage data is fine for first pass.

4. Should time values that are not 15-minute increments be blocked, rounded, or allowed with a warning?

   - Answer: no separate warning/rounding UX.
   - Working decision: simple validation for 15-minute increments. Invalid values should be treated as invalid input; do not build a complex warning or auto-rounding flow first.

5. For Chump, should the UI literally label it `Chump`, or should that be configurable text later?

   - Answer: literal `Chump` as a test.

6. Should the MVP roster auto-save every typed name silently, or show "Saved to roster" with undo?

   - Answer: yes to auto-save direction.
   - Working decision: remember typed names automatically; avoid start-time logic for names in MVP.

7. Should start templates create blank name rows with start-time placeholders, or only suggest start chips after names are selected?

   - Updated answer: for now, no start-time template logic.
   - Reason: remembered names are likely useful; remembered start times are not likely useful yet.
   - Working decision: roster remembers names only in MVP. Start-time templates stay out of the first implementation.

8. Should the small-bill display always show cumulative coverage rows, or hide them behind a detail toggle unless there is a shortage/range?

   - Clarification of question: this asks whether the main screen should always show the deeper math rows like `$1 value`, `$1+$5 value`, and `$1+$5+$10 value`, or whether the main screen should mostly show the simple parsed bill targets and only reveal cumulative rows when needed.
   - Working recommendation: main visuals should show the simple bill language first. Show cumulative coverage more prominently when there is a shortage, range, or confusing substitution case.

9. Should $50 substitution for $10 needs be shown directly in the row, such as `$10s / $50 coverage`, or only in the detail explanation?

   - Answer: show the needed `$10s` as lower in the main visuals when $50s cover that need.
   - Working decision: main visuals should reflect the reduced `$10` need. A distinct visual cue can show that `$50s` are helping cover the ten-tier requirement, with more detail available in the expanded/detail view.

10. For the first React version, should the current engine be copied as-is into the new app, or imported from its existing location during transition?

   - Answer: implementer's choice.
   - Working decision: copy or move the current engine into the new `src/domain` or `src/engine` structure early, keep its behavior intact, and keep tests around it. Avoid a long-term import dependency on the old app layout.

## 14. One-Sentence Updated Product Target

Build TipPool as a free-deployed, iPhone-home-screen, offline-capable React static web app for night-shift tip distribution, with a summary-first UI, blank-time close placeholders, Chump handling, cumulative small-bill minimum logic, and a clean architecture that can later grow into multi-pool support.
