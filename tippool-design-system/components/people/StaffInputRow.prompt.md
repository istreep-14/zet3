**StaffInputRow** — compact staff entry for name, in/out times, computed hours,
closer state, and support cut chips. Names use sans; numeric fields use mono
with tabular figures.

```jsx
<StaffInputRow
  role="bartender"
  name="Maya"
  inTime="5"
  outTime="2"
  hours={9}
  isCloser
  onToggleCloser={toggleCloser}
/>

<StaffInputRow
  role="support"
  name="Sam"
  supportCuts={['Day', 'P1']}
  hours={6.5}
/>
```

Use the row as a scan-first input card: name left, time wells center, hours
right. Avoid adding more columns; secondary actions should be chips or slide
actions.
