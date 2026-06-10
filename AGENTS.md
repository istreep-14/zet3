# AGENTS.md

## Cursor Cloud specific instructions

TipPool has **two frontends**:

| Entry | Stack | Purpose |
| --- | --- | --- |
| `index.html` | Legacy vanilla JS (`js/`, `css/`) | Production app today — static, no build |
| `prototype.html` | React 19 + Vite + TypeScript (`src/`) | Night-shift rebuild per `tippool-*.md` specs |

### React rebuild (primary dev target for migration work)

- **Dev server:** `npm run dev` — opens `/prototype.html` on port 5173
- **Build:** `npm run build` → `dist/` (entry `prototype.html`)
- **Preview production build:** `npm run preview`
- **Tests:** `npm test` — Vitest (`src/test/`) + legacy Node engine tests (`js/tests/`)

No backend, database, or Docker. Client-only app with `localStorage`.

### Legacy app (parity reference)

Serve repo root statically if you need the old tab-based UI:

```bash
npx serve .
# or
python3 -m http.server
```

### PWA / deploy notes

- PWA manifest and service worker live in `public/`; SW registers in production builds only (`src/main.tsx`).
- Target deploy: **Vercel** (`vercel.json` at repo root). Built app is static files after `npm run build`.
- Rebuild specs: `tippool-product-spec.md`, `tippool-rebuild-catalyst-plan.md`, `tippool-rebuild-feedback-addendum.md`.

### Gotchas

- `npm run dev` hot-reloads React code; legacy `index.html` does not use Vite.
- Session storage keys: `tippool_session_v2` (session), `tippool_roster_v1` (remembered names). Legacy uses `tippool_v1`.
- Time fields accept decimal quarter-hours (`5`, `2.5`, `6.25`); blur formats to clock display in the React app.
- Do not modify `js/engine.js` unless fixing a verified bug — distribution math is tested and trusted.
