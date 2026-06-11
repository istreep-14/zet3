// idealBills — derive an ideal bill breakdown for a cash total given the
// distribution targets (per-person finals + chump). Reserves the minimum
// $1s/$5s/$10s the targets require, fills the rest with $20s.

import { blankBills } from './util.js';

export function idealBills(total, targets) {
  const pool = blankBills();
  if (total <= 0 || !targets.length) return pool;

  const minOnes = targets.reduce((s, amt) => s + (amt % 5), 0);
  const minMod10Val = targets.reduce((s, amt) => s + (amt % 10), 0);
  const minFives = Math.max(0, (minMod10Val - minOnes) / 5);
  const minTens = targets.filter(amt => Math.floor(amt / 10) % 2 !== 0).length;
  const reserved = minOnes + minFives * 5 + minTens * 10;

  if (reserved <= total) {
    pool[1] = minOnes;
    pool[5] = minFives;
    pool[10] = minTens;
    pool[20] = Math.floor((total - reserved) / 20);
    return pool;
  }

  // Fallback: greedy small-bill fill when minimums exceed the total.
  let rem = total;
  pool[20] = Math.floor(rem / 20); rem -= pool[20] * 20;
  pool[10] = Math.floor(rem / 10); rem -= pool[10] * 10;
  pool[5] = Math.floor(rem / 5); rem -= pool[5] * 5;
  pool[1] = rem;
  return pool;
}

// Merge per-bill pools into one combined drawer; null if any pool entered as
// a net total (the caller derives ideal bills instead).
export function mergedBillCounts(pools) {
  const merged = blankBills();
  for (const pool of pools) {
    if (!pool.billCounts) return null;
    for (const d of [100, 50, 20, 10, 5, 1]) merged[d] += pool.billCounts[d] || 0;
  }
  return merged;
}
