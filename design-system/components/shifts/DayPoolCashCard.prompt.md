**DayPoolCashCard** — the day-shift cash accordion. Use it for Morning Cut,
Middle Cut, and optional party pools. The header always shows pool name,
window subtitle, and gold total; the body holds net-total input or custom
cash-entry children.

```jsx
<DayPoolCashCard
  label="Morning Cut"
  subtitle="Earliest in -> last server out"
  total={420}
  isOpen
  netTotal={420}
  onNetTotalChange={setMorningTotal}
  supportTipOut={32}
  onSupportTipOut={openSupportTipOut}
/>

<DayPoolCashCard
  label="Party 1"
  optional
  windowStart="11"
  windowEnd="3"
  total={180}
  isOpen
  onRemove={removeParty}
/>
```

Keep this pattern compact: one visible pool total, one cash entry surface, and
only show party window inputs for optional party pools.
