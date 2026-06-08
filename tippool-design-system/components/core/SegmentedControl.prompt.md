**SegmentedControl** — the toggle used everywhere in TipPool: night/day shift, bartender/server/support role, net-total/bill-counts cash mode.

```jsx
const [shift, setShift] = React.useState('night');
<SegmentedControl
  options={[{value:'night',label:'Night Shift'},{value:'day',label:'Day Shift'}]}
  value={shift}
  onChange={setShift}
/>
```

Pass an `accentMap` to tint the active segment per option — the staff role toggle uses this so Bartender goes blue, Server gold, Support purple:

```jsx
<SegmentedControl options={roles} value={role} onChange={setRole}
  accentMap={{ bartender:{color:'var(--role-bartender)',border:'var(--role-bartender-border)'} }} />
```
