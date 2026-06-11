// Unified time model — decimal 12-hour entry resolved onto one true 24h+ axis.
//
// Entry stays decimal 12-hour ('5', '10.5', '2'). Resolution is fixed, NOT
// anchor-relative:
//
//   IN times:  9 ≤ t < 12 → AM (t);  else → PM (t < 12 ? t+12 : t).
//              So 9–11:59 read as morning; 12 reads as noon; 1–8:59 as 1p–8:59p.
//   OUT times: the next occurrence of that clock reading after the person's own
//              In — nextAfter(reading, inAbs). 5p in, 2 out → 2a (next day).
//
// The axis is real hours past midnight on the open day: 9–11 = 9a–11a, 12 = noon,
// 13–23 = 1p–11p, 24 = midnight, 25–32 = 1a–8a next day.

export function parseTime(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return { valid: true, empty: true, value: null };
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(text)) return { valid: false, empty: false, value: null };
  const value = Number(text);
  const inRange = Number.isFinite(value) && value >= 0 && value < 13;
  return {
    valid: inRange,
    empty: false,
    value: inRange ? value : null,
  };
}

// Resolve an IN time (decimal 12-hour reading) to the absolute axis.
// 9:00–11:59 → AM; everything else → PM (noon stays 12, 1–8:59 → 13–20:59).
export function resolveIn(t) {
  if (t >= 9 && t < 12) return t;   // 9a–11:59a
  if (t >= 12) return t;            // 12p–12:59p (noon hour)
  return t + 12;                    // 1p–8:59p (and <1, an edge)
}

// First absolute time matching clock reading `t` that is strictly after `afterAbs`.
// Used for OUT times: the next time that clock reads `t` after the person clocks in.
export function nextAfter(t, afterAbs) {
  let v = t;
  while (v <= afterAbs) v += 12;
  return v;
}

// First absolute time matching reading `t` at or after `fromAbs` (≥, not >).
// Used for pool window bounds, which may sit exactly on the shift open.
export function atOrAfter(t, fromAbs) {
  let v = t;
  while (v < fromAbs) v += 12;
  return v;
}

// Format an absolute-axis time for display: "5p", "10:30a", "2a", "12a" (midnight).
export function fmtTimeAbs(tAbs) {
  let h = ((tAbs % 24) + 24) % 24;
  let hr = Math.floor(h), mn = Math.round((h - hr) * 60);
  if (mn === 60) { hr = (hr + 1) % 24; mn = 0; }
  const am = hr < 12;
  let h12 = hr % 12;
  if (h12 === 0) h12 = 12;
  return h12 + (mn > 0 ? ':' + (mn < 10 ? '0' : '') + mn : '') + (am ? 'a' : 'p');
}

// Overlap of [inAbs, outAbs) with [startAbs, endAbs) in hours.
export function overlapHours(inAbs, outAbs, startAbs, endAbs) {
  const start = Math.max(inAbs, startAbs);
  const end = Math.min(outAbs, endAbs);
  return Math.max(0, end - start);
}
