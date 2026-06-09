**PersonCard** — the per-person payout row on the Summary tab. Initials avatar, name (+ closer badge), an hours block over the in/out times, and the gold payout with a base-pay or green bonus sub-line.

```jsx
<PersonCard name="Maya Rodriguez" hours={8.5} inTime="5:00" outTime="2:00"
  payout={214} bonus={24} isCloser onClick={openProfile} />
<PersonCard name="Devon Clarke" hours={6} inTime="6:00" outTime="12:00"
  payout={151} basePay={151} />
```

Closers get the red `Closer` badge and a green `+$24` bonus pill; non-closers show their base pay muted. Imports `Badge` internally. Stack rows with `gap: var(--space-3)`.
