# TipPool Design System Assessment

Source reviewed: `tippool-design-system/` extracted from `TipPool Design System (3).zip`.

## What to keep

- **Tokenized dark palette**: the navy surfaces, hot-red accent, gold money values, green positive states, and blue staff indicators fit the existing back-of-house use case.
- **Compact mono numeric style**: money, bill counts, hours, tabs, and labels stay easier to scan when they use the design-system mono rules.
- **Card primitives**: home stat cards, summary person cards, badges, and segmented controls are strong improvements over flat rows.
- **Semantic token aliases**: aliases such as `--surface-card`, `--text-money`, `--intent-positive`, `--dur`, and `--ease` make the old CSS files easier to evolve without importing the React package.

## What not to carry over wholesale

- **React component packaging**: the live app is intentionally framework-free, so the JSX components are useful as visual references but should not become a runtime dependency.
- **Net-total-first cash entry**: it is a useful shortcut, but the original count-the-drawer workflow should remain the default because it matches how users physically count bills.
- **Over-collapsed primary flows**: compact toggles are good for secondary controls, but the first-run experience should show the concrete bill rows immediately.

## Hybrid implemented in this branch

- Kept the current static app and old file layout.
- Added the design-system semantic aliases, motion tokens, radii, shadows, and intent tokens to `css/variables.css`.
- Restored the old per-bill cash-entry layout as the fresh-session default.
- Kept the redesigned net-total helper as an alternate mode.
- Restored the visible cash header/total from the old page so bill counting has a clear page anchor.

## Suggested next passes

- Apply the semantic tokens gradually in existing CSS files as they are touched.
- Keep the summary/person-card and home-card styling; those are the strongest redesign wins.
- Revisit the staff role/day-shift controls separately from visual styling, since those are product-flow decisions rather than design-system polish.
