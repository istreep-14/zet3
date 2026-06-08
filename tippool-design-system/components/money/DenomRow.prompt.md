**DenomRow** — one denomination row from the cash counter: a gold `$100` cap, a big centered count input, and a right-aligned subtotal cap. The border tints gold on focus.

```jsx
{[100,50,20,10,5,1].map(d => (
  <DenomRow key={d} denom={d}
    count={counts[d]}
    subtotal={counts[d] ? '$' + (counts[d]*d).toLocaleString() : null}
    onCountChange={(v) => setCount(d, v)} />
))}
```

Stack them in a `display:flex; flex-direction:column; gap: var(--space-3)` list. Subtotal shows `—` when the count is zero/empty.
