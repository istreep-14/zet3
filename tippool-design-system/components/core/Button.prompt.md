**Button** — the mono-label, uppercase action control used across TipPool chrome (add staff, session actions, confirm).

```jsx
<Button variant="accent" size="md" onClick={save}>Calculate</Button>
<Button variant="dashed" fullWidth>+ Add Bartender</Button>
<Button variant="danger" size="sm">New Session</Button>
```

Variants: `accent` (red primary), `gold` (money/confirm), `secondary` (raised surface — the default), `ghost` (bare), `danger` (destructive, dark-red fill), `dashed` (the add-row pattern). Sizes `sm | md | lg`. Pass `icon` for a leading inline SVG. Labels are auto-uppercased — write them in normal case.
