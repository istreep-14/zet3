# AGENTS.md

## Cursor Cloud specific instructions

TipPool has **two frontends**:

| Entry | Stack | Purpose |
| --- | --- | --- |
| `index.html` | React 19 + Vite + TypeScript (`src/`) | Production app — deployed to Vercel |
| `legacy.html` | Legacy vanilla JS (`js/`, `css/`) | Static reference; no build required |

### React app (production)

- **Dev server:** `npm run dev` — opens `http://localhost:5173/` (serves `index.html`)
- **Build:** `npm run build` → `dist/` (entry `index.html`)
- **Preview production build:** `npm run preview`
- **Tests:** `npm test` — Vitest (`src/test/`) + legacy Node engine tests (`js/tests/`)

No backend, database, or Docker. Client-only app with `localStorage`.

### Legacy app (parity reference)

Serve repo root statically if you need the old tab-based UI:

```bash
npx serve . --single legacy.html
# or open legacy.html directly in a browser
```

The legacy app does **not** go through Vite. It is framework-free.

### PWA / deploy notes

- PWA manifest lives in `public/manifest.json` with `start_url: "/"`.
- Service worker (`public/sw.js`) caches `/index.html` for offline use.
- Target deploy: **Vercel** (`vercel.json` at repo root). Built app is static files after `npm run build`.
- Rebuild specs: `tippool-product-spec.md`, `tippool-rebuild-catalyst-plan.md`, `tippool-rebuild-feedback-addendum.md`.

### Gotchas

- `npm run dev` hot-reloads React code (`index.html`); `legacy.html` does not use Vite.
- Session storage keys: `tippool_session_v2` (session), `tippool_roster_v1` (remembered names). Legacy uses `tippool_v1`.
- Time fields accept decimal quarter-hours (`5`, `2.5`, `6.25`); blur formats to clock display in the React app.
- Do not modify `js/engine.js` unless fixing a verified bug — distribution math is tested and trusted.
