**StatCard** — the tappable metric tile from the home dashboard. Card surface with the top-left sheen, uppercase eyebrow, big value, optional sub-line, and a `›` chevron when it navigates.

```jsx
<StatCard label="Cash on Hand" value="$1,284" sub="42 bills" onClick={goCash} />
<StatCard label="Staff" value="6" sub="employees" tone="neutral" onClick={goStaff} />
```

`tone="money"` (default) colors the value gold; `tone="neutral"` uses primary text for counts. Lay two side-by-side in a flex row with `gap: var(--space-4)`.
