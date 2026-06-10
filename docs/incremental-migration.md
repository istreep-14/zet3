# Incremental Migration Plan

The default app should stay on the working legacy `index.html` flow while the rebuild is migrated piece by piece.
The React/Vite work remains available at `prototype.html` as a reference and test bed, but it should not replace the full app until parity is proven.

## Migration rules

1. Keep `index.html` as the production entry until a migrated slice has feature parity.
2. Move one bounded behavior at a time, with tests around any money or time logic.
3. Preserve the existing `js/engine.js` behavior unless a specific bug is identified.
4. Prefer extracting pure modules from legacy code before replacing UI.
5. After each slice, verify:
   - legacy app still loads from `index.html`
   - `npm test` passes
   - prototype build still passes with `npm run build`

## Suggested next slices

1. Extract cumulative small-bill requirement display into a pure module used by the legacy Cash or Dist view.
2. Improve blank out-time and close-time placeholder behavior in the existing Staff/Summary flow.
3. Add Chump terminology to the legacy summary and distribution rendering.
4. Move the distribution table toward a sheet/modal while keeping the current table output available.
5. Only after those pieces are stable, revisit a larger React shell migration.
