// Unified time model — decimal 12-hour entry resolved onto one absolute axis.
//
// Entry stays decimal 12-hour ('5', '10.5', '2'). Internally everything is
// resolved against the shift anchor (the "open" time):
//
//   abs(t) = t >= anchorRaw ? t : t + 12
//
// Night (open 5p): 5→5, 6→6, 2→14. Day (open 10a): 10→10, 12→12, 1→13, 6→18.
// One wrap rule; constraint carried over: a session spans < 12h.

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

export function toAbs(t, anchorRaw) {
  return t >= anchorRaw ? t : t + 12;
}

// Display heuristic only: an anchor (shift open) in [8, 12) reads as a
// morning open (8a–11:59a); anything else reads as an afternoon/evening open.
export function anchorIsAm(anchorRaw) {
  return anchorRaw >= 8 && anchorRaw < 12;
}

// Format an absolute-axis time for display: "5p", "10:30a", "2a".
// Times that wrapped past 12 sit in the opposite half of the day from the anchor.
export function fmtTimeAbs(tAbs, anchorRaw) {
  let t = tAbs;
  let wrapped = false;
  if (t > 12) { t -= 12; wrapped = true; }
  let hr = Math.floor(t), mn = Math.round((t - hr) * 60);
  if (mn === 60) { hr++; mn = 0; }
  let h12 = hr % 12;
  if (h12 === 0) h12 = 12;
  const am = anchorIsAm(anchorRaw) !== wrapped;
  return h12 + (mn > 0 ? ':' + (mn < 10 ? '0' : '') + mn : '') + (am ? 'a' : 'p');
}

// Overlap of [inAbs, outAbs) with [startAbs, endAbs) in hours.
export function overlapHours(inAbs, outAbs, startAbs, endAbs) {
  const start = Math.max(inAbs, startAbs);
  const end = Math.min(outAbs, endAbs);
  return Math.max(0, end - start);
}
