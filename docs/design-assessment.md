# TipPool Design System Assessment

Source reviewed: `design-system/` extracted from `TipPool Design System (3).zip`.

## What to keep

- **Tokenized dark palette**: the navy surfaces, hot-red accent, gold money values, green positive states, and blue staff indicators fit the existing back-of-house use case.
- **Compact mono numeric style**: money, bill counts, hours, tabs, and labels stay easier to scan when they use the design-system mono rules.
- **Card primitives**: home stat cards, summary person cards, badges, and segmented controls are strong improvements over flat rows.
- **Semantic token aliases**: aliases such as `--surface-card`, `--text-money`, `--intent-positive`, `--dur`, and `--ease` make the old CSS files easier to evolve without importing the React package.

## What not to carry over wholesale

- **React component packaging**: the live app is intentionally framework-free, so the JSX components are useful as visual references but should not become a runtime dependency.
- **Net-total-first cash entry**: it is a useful shortcut, but the original count-the-drawer workflow should remain the default because it matches how users physically count bills.
- **Over-collapsed primary flows**: compact toggles are good for secondary controls, but the first-run experience should show the concrete bill rows immediately.

## React component assessment

The React package is strongest as a **visual source of truth**. The static app should mirror the component visuals in CSS, while keeping the existing plain-script architecture.

| React component | Visual verdict | Static app mapping |
| --- | --- | --- |
| `MoneyValue` | Keep. Heavy mono, tabular numerals, gold/nonzero and muted/zero states are exactly right for tip math. | `summary-hero-val`, `cash-page-total`, `cash-total-val`, home metrics, pool totals now use tabular money styling and tokenized sizes. |
| `StatCard` | Keep. Home cards are one of the best redesign pieces: compact, tappable, with a subtle top-left sheen and chevron. | `.mini-card` keeps the same layout, sheen, border, and now gets component-like press feedback. |
| `DenomRow` | Keep. It preserves the old bill-count workflow while making each row feel like a real component. | `.cash-denom-row` already matched it; this pass tightened motion, tabular numerals, and token usage. |
| `PersonCard` | Keep, with static markup. Avatar + name + hours + payout columns make summary scanning better. | `.person-card` remains the summary row pattern; closer badges now use the React red badge styling. |
| `Badge` | Keep. Role/closer/bonus badges are low-risk visual improvements and help scanning. | Role badges, closer badges, support chips, and bonus pills are styled toward the React badge variants. |
| `Button` | Keep the visual language, not the component runtime. Uppercase mono, dashed add buttons, danger buttons, and tactile press states work well. | Header/menu/default/add/action buttons now use tokenized transitions and press transforms. |
| `SegmentedControl` | Keep for secondary choices. It works well for shift mode, role selection, and cash mode. | Existing toggles were preserved and polished with stable borders and React-style active/press states. |
| `DayPoolCashCard` | Add. Day shift needed its own visual source of truth for pool accordions, party windows, and support tip-out actions. | Day cash cards now use a reset accordion header, visible gold total, chevron affordance, cleaner window fields, and support action styling. |
| `StaffInputRow` | Add. Staff entry is central enough to deserve a component reference separate from payout `PersonCard`. | Staff rows now get role-aware accents, clearer time wells, stronger closer badges, and tabular hours. |

### React runtime recommendation

Do **not** migrate this app to React just to get the visuals. The current app is offline, dependency-free, and heavily DOM/script-tag based. A React migration would be a product architecture project, not a styling pass. If a future rewrite happens, the extracted components are good seeds, but they would need state and engine boundaries redesigned first.

## Hybrid implemented in this branch

- Kept the current static app and old file layout.
- Added the design-system semantic aliases, motion tokens, radii, shadows, and intent tokens to `css/variables.css`.
- Restored the old per-bill cash-entry layout as the fresh-session default.
- Kept the redesigned net-total helper as an alternate mode.
- Restored the visible cash header/total from the old page so bill counting has a clear page anchor.
- Added React-inspired visual polish across the static CSS: type-scale aliases, tabular money numerals, tactile button/card press states, tokenized motion, menu/sheet shadows, and closer/bonus badge alignment.
- Added React references and preview cards for day-shift cash (`DayPoolCashCard`) and staff input (`StaffInputRow`) inside the redesign folder.
- Cleaned up static day-shift cash cards and staff input rows to match those new redesign references.

## Suggested next passes

- Apply the semantic tokens gradually in existing CSS files as they are touched.
- Keep the summary/person-card and home-card styling; those are the strongest redesign wins.
- Revisit the staff role/day-shift controls separately from visual styling, since those are product-flow decisions rather than design-system polish.
