**MoneyValue** — the one true way to render a dollar amount in TipPool: gold, mono, tabular figures, with an optional eyebrow label. Zero renders muted automatically.

```jsx
<MoneyValue label="Pool total" amount={1284} size="hero" />
<MoneyValue amount={214} size="lg" />
<MoneyValue amount="$8.5h" bright />
```

`size` runs `sm → hero` on the type scale. Pass a number to auto-format (`1284` → `$1,284`) or a string for custom content. Use `bright` for the lighter `gold-2` when sitting next to hours.
