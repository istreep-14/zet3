# TipPool Design System

This folder contains the extracted TipPool design-system package.

## Static app reference

The production app in the repository root is framework-free and already matches the files under `reference/`:

- `reference/index.html`
- `reference/css/*.css`
- `reference/manifest.json`
- `assets/brand/icon-192.png`
- `assets/brand/icon-512.png`

Use those files as the source of truth when checking whether the live static app has drifted from the design.

## React component source

React consumers should import components through the package entry point:

```js
import {
  Badge,
  Button,
  DenomRow,
  MoneyValue,
  PersonCard,
  SegmentedControl,
  StatCard,
} from './tippool-design-system/index.js';
```

The aggregate `index.js` and `index.d.ts` files intentionally mirror `_adherence.oxlintrc.json`, which warns against importing component internals directly.

## Styles and tokens

Link `styles.css` once to load fonts and tokens:

```css
@import url('./tippool-design-system/styles.css');
```

Token files keep the original static-app variable names (`--surface2`, `--gold2`, `--muted2`) and expose canonical aliases (`--surface-2`, `--gold-2`, `--muted-2`) so both the reference app and exported components can share the same palette.
