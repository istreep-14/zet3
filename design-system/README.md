# TipPool Design System

This folder contains the TipPool React component library and visual-language documentation.

## Relationship to the app

The production app in the repository root is framework-free and does not import this package at runtime. Treat this directory as a design artifact: React components document the intended visual language, and `_ds_bundle.js` powers the static preview cards in `guidelines/` and `components/`.

## React component source

React consumers should import components through the package entry point:

```js
import {
  Badge,
  Button,
  DayPoolCashCard,
  DenomRow,
  MoneyValue,
  PersonCard,
  SegmentedControl,
  StaffInputRow,
  StatCard,
} from './design-system/index.js';
```

The aggregate `index.js` and `index.d.ts` files intentionally mirror `_adherence.oxlintrc.json`, which warns against importing component internals directly.

## Styles and tokens

Link `styles.css` once to load fonts and tokens:

```css
@import url('./design-system/styles.css');
```

Token files keep the original static-app variable names (`--surface2`, `--gold2`, `--muted2`) and expose canonical aliases (`--surface-2`, `--gold-2`, `--muted-2`) so both the reference app and exported components can share the same palette.
