// Bill distribution engine — ported from the v3 engine.js pipeline.
// Pure: value in, value out. Callers' objects are never mutated; results come
// back as byPerson maps keyed by staff id.
//
// Pipeline: preflight → preferred path (proportional $100s/$50s, balanced
// sweep of lower denoms) → DFS fallback (≤100 paths, graded) → rebalancing.

import { DENOMS, parseWholeNumber, poolValue, blankBills } from './util.js';

function normalizePool(pool) {
  const out = blankBills();
  DENOMS.forEach(d => {
    const parsed = parseWholeNumber(pool?.[d] ?? '');
    out[d] = parsed.valid ? parsed.value : 0;
  });
  return out;
}

// people: [{ id, final }] — internal slots copy what they need.
function buildDistributionSlots(people, leftoverAmount) {
  const slots = people.map(p => ({
    id: p.id,
    orig: p.final,
    target: p.final,
    bills: blankBills(),
    isRemainder: false,
  }));

  if (leftoverAmount > 0) {
    slots.push({
      id: null,
      orig: leftoverAmount,
      target: leftoverAmount,
      bills: blankBills(),
      isRemainder: true,
    });
  }

  return slots;
}

function getSmallBillRequirementsForSlots(slots, poolIn) {
  const pool = normalizePool(poolIn);
  const targets = slots.map(s => s.orig);
  const oddTenSlots = slots.filter(s => Math.floor(s.orig / 10) % 2 !== 0);
  const fiftyEligibleOddTenSlots = oddTenSlots.filter(s => s.orig >= 50).length;
  const fiftyCoverage = Math.min(pool[50] || 0, fiftyEligibleOddTenSlots);
  const minOnes = targets.reduce((sum, target) => sum + (target % 5), 0);
  const minOneFiveValue = targets.reduce((sum, target) => sum + (target % 10), 0);
  const minOneFiveTenRaw = targets.reduce((sum, target) => sum + (target % 20), 0);
  const minOneFiveTenValue = Math.max(minOneFiveValue, minOneFiveTenRaw - fiftyCoverage * 10);
  const availableOnes = pool[1] || 0;
  const availableOneFiveValue = availableOnes + (pool[5] || 0) * 5;
  const availableOneFiveTenValue = availableOneFiveValue + (pool[10] || 0) * 10;

  return {
    minOnes,
    availableOnes,
    onesShort: Math.max(0, minOnes - availableOnes),
    minOneFiveValue,
    availableOneFiveValue,
    oneFiveShort: Math.max(0, minOneFiveValue - availableOneFiveValue),
    minOneFiveTenValue,
    availableOneFiveTenValue,
    oneFiveTenShort: Math.max(0, minOneFiveTenValue - availableOneFiveTenValue),
    oddTenCount: oddTenSlots.length,
    fiftyEligibleOddTenCount: fiftyEligibleOddTenSlots,
    fiftyCoverage,
    fiftyCoverageValue: fiftyCoverage * 10,
  };
}

export function getSmallBillRequirements(people, poolIn, leftoverAmount) {
  return getSmallBillRequirementsForSlots(buildDistributionSlots(people, leftoverAmount || 0), poolIn);
}

export function previewSmallBillTrades(people, poolIn, leftoverAmount) {
  const sourcePool = normalizePool(poolIn);
  const targetTotal = people.reduce((sum, p) => sum + (p.final || 0), 0) + (leftoverAmount || 0);
  if (poolValue(sourcePool) !== targetTotal) return null;

  const adjustedPool = normalizePool(sourcePool);
  const deltas = blankBills();
  const trades = [];
  const slots = buildDistributionSlots(people, leftoverAmount || 0);

  function describeBundle(bundle) {
    return DENOMS
      .filter(d => (bundle[d] || 0) > 0)
      .map(d => (bundle[d] || 0) + ' x $' + d)
      .join(' + ');
  }

  function applyBreak(from, bundle) {
    if ((adjustedPool[from] || 0) <= 0) return false;
    adjustedPool[from]--;
    deltas[from]--;
    DENOMS.forEach(d => {
      const count = bundle[d] || 0;
      if (count <= 0) return;
      adjustedPool[d] += count;
      deltas[d] += count;
    });
    trades.push('Break 1 x $' + from + ' into ' + describeBundle(bundle) + '.');
    return true;
  }

  function breakForOnes(from) {
    const bundle = blankBills();
    if (from === 5) bundle[1] = 5;
    if (from === 10) { bundle[5] = 1; bundle[1] = 5; }
    if (from === 20) { bundle[10] = 1; bundle[5] = 1; bundle[1] = 5; }
    if (from === 50) { bundle[20] = 2; bundle[5] = 1; bundle[1] = 5; }
    if (from === 100) { bundle[50] = 1; bundle[20] = 2; bundle[5] = 1; bundle[1] = 5; }
    return applyBreak(from, bundle);
  }

  function breakForFives(from) {
    const bundle = blankBills();
    if (from === 10) bundle[5] = 2;
    if (from === 20) { bundle[10] = 1; bundle[5] = 2; }
    if (from === 50) { bundle[20] = 2; bundle[5] = 2; }
    if (from === 100) { bundle[50] = 1; bundle[20] = 2; bundle[5] = 2; }
    return applyBreak(from, bundle);
  }

  function breakForTens(from) {
    const bundle = blankBills();
    if (from === 20) bundle[10] = 2;
    if (from === 50) bundle[10] = 5;
    if (from === 100) { bundle[50] = 1; bundle[10] = 5; }
    return applyBreak(from, bundle);
  }

  function chooseDonor(candidates) {
    return candidates.find(d => (adjustedPool[d] || 0) > 0) || null;
  }

  function trySolve() {
    const result = runPipeline(people, adjustedPool, leftoverAmount || 0);
    if (!result.success) return null;
    return {
      byPerson: result.byPerson,
      pool: { ...adjustedPool },
      poolAfter: result.poolAfter,
      remainderBills: result.remainderBills || blankBills(),
      deltas: { ...deltas },
      trades: [...trades],
      requirementsBefore: getSmallBillRequirementsForSlots(slots, sourcePool),
      requirementsAfter: getSmallBillRequirementsForSlots(slots, adjustedPool),
    };
  }

  let guard = 0;
  while (getSmallBillRequirementsForSlots(slots, adjustedPool).onesShort > 0 && guard++ < 40) {
    const donor = chooseDonor([5, 10, 20, 50, 100]);
    if (!donor || !breakForOnes(donor)) return null;
  }

  while (getSmallBillRequirementsForSlots(slots, adjustedPool).oneFiveShort > 0 && guard++ < 80) {
    const donor = chooseDonor([10, 20, 50, 100]);
    if (!donor || !breakForFives(donor)) return null;
  }

  while (getSmallBillRequirementsForSlots(slots, adjustedPool).oneFiveTenShort > 0 && guard++ < 120) {
    const donor = chooseDonor([20, 50, 100]);
    if (!donor || !breakForTens(donor)) return null;
  }

  const solved = trySolve();
  if (solved) return solved;

  const fallbackBreaks = [
    { from: 5, bundle: { 1: 5 } },
    { from: 10, bundle: { 5: 2 } },
    { from: 20, bundle: { 10: 2 } },
    { from: 50, bundle: { 10: 5 } },
    { from: 100, bundle: { 20: 5 } },
  ];

  for (let i = 0; i < 30; i++) {
    const next = fallbackBreaks.find(item => (adjustedPool[item.from] || 0) > 0);
    if (!next || !applyBreak(next.from, { ...blankBills(), ...next.bundle })) break;
    const retry = trySolve();
    if (retry) return retry;
  }

  return null;
}

function runPipeline(people, poolIn, leftoverAmount) {
  const pool = normalizePool(poolIn);
  const slots = buildDistributionSlots(people, leftoverAmount || 0);

  const preflight = runPreflight(slots, pool);
  if (!preflight.ok) return { success: false, msg: preflight.msg, poolAfter: pool, remainderBills: blankBills(), byPerson: {} };

  const preferred = buildPreferredPath(slots, pool);
  const poolAfterSieve = preferred ? null : runCascadingSieve(slots, pool);
  const paths = preferred ? [preferred] : runDFS(slots, poolAfterSieve);
  if (!paths.length) {
    return { success: false, msg: 'Exact change impossible with current bills. Adjust bill counts in Cash.', poolAfter: poolAfterSieve, remainderBills: blankBills(), byPerson: {} };
  }

  const best = preferred || gradePaths(paths);

  const byPerson = {};
  best.slots.forEach(s => {
    if (s.isRemainder) return;
    byPerson[s.id] = { ...s.bills };
  });

  const remainderSlot = best.slots.find(s => s.isRemainder);
  return {
    success: true,
    msg: '',
    poolAfter: best.leftoverPool,
    remainderBills: remainderSlot ? { ...remainderSlot.bills } : blankBills(),
    byPerson,
  };
}

function runPreflight(slots, pool) {
  const targetTotal = slots.reduce((sum, s) => sum + s.target, 0);
  const cashTotal = poolValue(pool);
  if (cashTotal < targetTotal) {
    return { ok: false, msg: 'Cash on hand is short $' + (targetTotal - cashTotal) + '.' };
  }

  const needs = getSmallBillRequirementsForSlots(slots, pool);

  if (needs.onesShort > 0) {
    return { ok: false, msg: 'Need ' + needs.onesShort + ' more $1s.' };
  }
  if (needs.oneFiveShort > 0) {
    return { ok: false, msg: 'Need $' + needs.oneFiveShort + ' more in $1s/$5s.' };
  }
  if (needs.oneFiveTenShort > 0) {
    return { ok: false, msg: 'Need $' + needs.oneFiveTenShort + ' more in $1s/$5s/$10s after $50s.' };
  }

  return { ok: true };
}

function runCascadingSieve(slots, poolIn) {
  const p = normalizePool(poolIn);

  slots.forEach(s => {
    const ones = s.target % 5;
    if (ones > 0) {
      s.bills[1] += ones;
      p[1] -= ones;
      s.target -= ones;
    }
  });

  let bundledOnes = Math.floor((p[1] || 0) / 5);
  slots.forEach(s => {
    if (s.target % 10 !== 5) return;
    if (bundledOnes > 0) {
      s.bills[1] += 5;
      p[1] -= 5;
      bundledOnes--;
      s.target -= 5;
    } else if ((p[5] || 0) > 0) {
      s.bills[5] += 1;
      p[5] -= 1;
      s.target -= 5;
    }
  });

  let bundledFives = Math.floor(((p[5] || 0) + bundledOnes) / 2);
  slots.forEach(s => {
    const isOddTens = Math.floor(s.target / 10) % 2 !== 0;
    if (!isOddTens || bundledFives <= 0) return;
    if ((p[5] || 0) >= 2) {
      s.bills[5] += 2;
      p[5] -= 2;
      s.target -= 10;
      bundledFives--;
    } else if ((p[5] || 0) === 1 && (p[1] || 0) >= 5) {
      s.bills[5] += 1;
      p[5] -= 1;
      s.bills[1] += 5;
      p[1] -= 5;
      s.target -= 10;
      bundledFives--;
    } else if ((p[1] || 0) >= 10) {
      s.bills[1] += 10;
      p[1] -= 10;
      s.target -= 10;
      bundledFives--;
    }
  });

  function assignSmallBundle(s, value) {
    const maxFives = Math.min(Math.floor(value / 5), p[5] || 0);
    for (let fives = maxFives; fives >= 0; fives--) {
      const ones = value - fives * 5;
      if ((p[1] || 0) < ones) continue;
      s.bills[5] += fives;
      p[5] -= fives;
      s.bills[1] += ones;
      p[1] -= ones;
      s.target -= value;
      return true;
    }
    return false;
  }

  [20, 10].forEach(value => {
    let assigned = true;
    while (assigned) {
      assigned = false;
      const next = slots.filter(s => s.target >= value).sort((a, b) => a.target - b.target)[0];
      if (next && assignSmallBundle(next, value)) assigned = true;
    }
  });

  return p;
}

function cloneDistributionSlots(slots) {
  return slots.map(s => ({
    id: s.id,
    orig: s.orig,
    target: s.target,
    bills: { ...s.bills },
    isRemainder: !!s.isRemainder,
  }));
}

function apportionDenomCounts(slots, denom, available) {
  const caps = slots.map(s => Math.floor(s.target / denom));
  const totalCap = caps.reduce((sum, cap) => sum + cap, 0);
  const count = Math.min(Math.max(0, available || 0), totalCap);
  const counts = slots.map(() => 0);
  if (count <= 0) return counts;

  const totalOrig = slots.reduce((sum, s) => sum + (s.orig || 0), 0) || 1;
  const shares = slots.map((s, i) => ({
    i,
    raw: (s.orig || 0) / totalOrig * count,
  }));

  let assigned = 0;
  for (const share of shares) {
    counts[share.i] = Math.min(caps[share.i], Math.floor(share.raw));
    assigned += counts[share.i];
  }

  while (assigned < count) {
    const before = assigned;
    for (const next of shares
      .filter(share => counts[share.i] < caps[share.i])
      .sort((a, b) => {
        const aFrac = a.raw - Math.floor(a.raw);
        const bFrac = b.raw - Math.floor(b.raw);
        return bFrac - aFrac
          || (slots[b.i].orig || 0) - (slots[a.i].orig || 0)
          || (slots[b.i].target || 0) - (slots[a.i].target || 0)
          || a.i - b.i;
      })) {
      if (assigned >= count) break;
      counts[next.i]++;
      assigned++;
    }
    if (assigned === before) break;
  }

  return counts;
}

// Preferred exact path: apportion $100s/$50s first, then solve lower
// denominations in descending order so each stage leaves balanced remainders.
// If it cannot solve exactly, the DFS below still handles the edge case.
function buildPreferredPath(slotsIn, poolIn) {
  const slots = cloneDistributionSlots(slotsIn);
  const pool = normalizePool(poolIn);

  function give(s, d, n) {
    const use = Math.min(n, pool[d] || 0, Math.floor(s.target / d));
    if (use <= 0) return 0;
    s.bills[d] += use;
    pool[d] -= use;
    s.target -= use * d;
    return use;
  }

  const hundredCounts = apportionDenomCounts(slots, 100, pool[100] || 0);
  hundredCounts.forEach((count, i) => give(slots[i], 100, count));

  if (!applyBestFiftyPlan(slots, pool)) return null;

  if (!assignLowerDenomsBalanced(slots, pool)) return null;

  return {
    slots,
    leftoverPool: pool,
  };
}

function applyBestFiftyPlan(slots, pool) {
  const count = pool[50] || 0;
  if (count <= 0) return true;

  const caps = slots.map(s => Math.floor(s.target / 50));
  if (caps.reduce((sum, cap) => sum + cap, 0) < count) return false;

  const counts = slots.map(() => 0);
  let best = null;

  function lowerCapacityOk(residuals) {
    if (residuals.reduce((sum, rem) => sum + Math.floor(rem / 20), 0) < (pool[20] || 0)) return false;
    if (residuals.reduce((sum, rem) => sum + Math.floor(rem / 10), 0) < (pool[10] || 0)) return false;
    if (residuals.reduce((sum, rem) => sum + Math.floor(rem / 5), 0) < (pool[5] || 0)) return false;
    return true;
  }

  function scorePlan() {
    const staffSlots = slots.filter(s => !s.isRemainder);
    const totalOrig = staffSlots.reduce((sum, s) => sum + (s.orig || 0), 0) || 1;
    const high50 = staffSlots.map(s => {
      const i = slots.indexOf(s);
      return (s.bills[100] || 0) * 100 + counts[i] * 50;
    });
    const totalHigh50 = high50.reduce((sum, value) => sum + value, 0);
    return staffSlots.reduce((sum, s, i) => {
      const ideal = (s.orig || 0) / totalOrig * totalHigh50;
      return sum + Math.abs(high50[i] - ideal);
    }, 0);
  }

  function search(i, remaining) {
    if (i === slots.length) {
      if (remaining !== 0) return;
      const residuals = slots.map((s, idx) => s.target - counts[idx] * 50);
      if (!lowerCapacityOk(residuals)) return;
      const score = scorePlan();
      if (!best || score < best.score) best = { counts: [...counts], score };
      return;
    }

    const restCap = caps.slice(i + 1).reduce((sum, cap) => sum + cap, 0);
    const minUse = Math.max(0, remaining - restCap);
    const maxUse = Math.min(caps[i], remaining);
    for (let use = minUse; use <= maxUse; use++) {
      counts[i] = use;
      search(i + 1, remaining - use);
    }
    counts[i] = 0;
  }

  search(0, count);
  if (!best) return false;

  best.counts.forEach((n, i) => {
    slots[i].bills[50] += n;
    slots[i].target -= n * 50;
  });
  pool[50] = 0;
  return true;
}

function assignLowerDenomsBalanced(slots, pool) {
  for (const d of [20, 10, 5]) {
    if (!assignDenomBalanced(slots, pool, d)) return false;
  }

  const onesNeeded = slots.reduce((sum, s) => sum + s.target, 0);
  if (onesNeeded !== (pool[1] || 0)) return false;
  for (const s of slots) {
    if (s.target < 0) return false;
    s.bills[1] += s.target;
    pool[1] -= s.target;
    s.target = 0;
  }

  return slots.every(s => s.target === 0);
}

function assignDenomBalanced(slots, pool, denom) {
  const count = pool[denom] || 0;
  if (count <= 0) return true;

  const caps = slots.map(s => Math.floor(s.target / denom));
  if (caps.reduce((sum, cap) => sum + cap, 0) < count) return false;

  const counts = slots.map(() => 0);
  let best = null;

  function lowerCapacityOk(residuals) {
    if (denom === 20 && residuals.reduce((sum, rem) => sum + Math.floor(rem / 10), 0) < (pool[10] || 0)) return false;
    if ((denom === 20 || denom === 10) && residuals.reduce((sum, rem) => sum + Math.floor(rem / 5), 0) < (pool[5] || 0)) return false;
    return true;
  }

  function scoreResiduals(residuals) {
    const scored = residuals.filter((_, i) => !slots[i].isRemainder);
    const avg = scored.reduce((sum, rem) => sum + rem, 0) / (scored.length || 1);
    const range = Math.max(...scored) - Math.min(...scored);
    const deviation = scored.reduce((sum, rem) => sum + Math.abs(rem - avg), 0);
    const billSpread = Math.max(...counts) - Math.min(...counts);
    return range * 10000 + deviation * 100 + billSpread;
  }

  function search(i, remaining) {
    if (i === slots.length) {
      if (remaining !== 0) return;
      const residuals = slots.map((s, idx) => s.target - counts[idx] * denom);
      if (!lowerCapacityOk(residuals)) return;
      const score = scoreResiduals(residuals);
      if (!best || score < best.score) best = { counts: [...counts], score };
      return;
    }

    const restCap = caps.slice(i + 1).reduce((sum, cap) => sum + cap, 0);
    const minUse = Math.max(0, remaining - restCap);
    const maxUse = Math.min(caps[i], remaining);
    for (let use = minUse; use <= maxUse; use++) {
      counts[i] = use;
      search(i + 1, remaining - use);
    }
    counts[i] = 0;
  }

  search(0, count);
  if (!best) return false;

  best.counts.forEach((n, i) => {
    slots[i].bills[denom] += n;
    slots[i].target -= n * denom;
  });
  pool[denom] = 0;
  return true;
}

function runDFS(slots, poolIn) {
  const validPaths = [];
  const bigDenoms = [100, 50, 20, 10];
  const pool = normalizePool(poolIn);
  const sortedIdxs = slots.map((_, i) => i).sort((a, b) => slots[b].target - slots[a].target);

  function search(pIdx) {
    if (validPaths.length >= 100) return;
    if (pIdx === slots.length) {
      validPaths.push({
        slots: slots.map(s => ({ ...s, bills: { ...s.bills } })),
        leftoverPool: { ...pool },
      });
      return;
    }

    const person = slots[sortedIdxs[pIdx]];
    if (person.target === 0) {
      search(pIdx + 1);
      return;
    }

    function fillPerson(targetVal, dIdx) {
      if (targetVal === 0) {
        search(pIdx + 1);
        return;
      }
      if (dIdx >= bigDenoms.length) return;

      const d = bigDenoms[dIdx];
      const maxUse = Math.min(pool[d] || 0, Math.floor(targetVal / d));
      for (let use = maxUse; use >= 0; use--) {
        person.bills[d] += use;
        pool[d] -= use;
        fillPerson(targetVal - use * d, dIdx + 1);
        person.bills[d] -= use;
        pool[d] += use;
      }
    }

    fillPerson(person.target, 0);
  }

  search(0);
  return validPaths;
}

function gradePaths(paths) {
  let bestPath = null;
  let lowestPenalty = Infinity;

  for (const path of paths) {
    let penalty = 0;
    const totalCounts = [];
    const smallBracketCounts = [];
    const mediumBracketCounts = [];

    for (const s of path.slots) {
      const idealBig = Math.floor(s.orig / 100);
      const actualBig = (s.bills[100] || 0) + ((s.bills[50] || 0) > 1 ? 1 : 0);
      penalty += Math.abs(idealBig - actualBig) * 2;

      const count1 = s.bills[1] || 0, count5 = s.bills[5] || 0, count10 = s.bills[10] || 0;
      const count20 = s.bills[20] || 0, count50 = s.bills[50] || 0, count100 = s.bills[100] || 0;
      totalCounts.push(count1 + count5 + count10 + count20 + count50 + count100);
      smallBracketCounts.push(count1 + count5 + count10);
      mediumBracketCounts.push(count1 + count5 + count10 + count20);
    }

    penalty += (Math.max(...totalCounts) - Math.min(...totalCounts)) * 10;
    penalty += (Math.max(...smallBracketCounts) - Math.min(...smallBracketCounts)) * 8;
    penalty += (Math.max(...mediumBracketCounts) - Math.min(...mediumBracketCounts)) * 5;

    if (penalty < lowestPenalty) {
      lowestPenalty = penalty;
      bestPath = path;
    }
  }

  return bestPath;
}

// Public entry point. people: [{ id, final }], bills: bill-count pool.
// Returns { byPerson: {id → bills}, remainderBills, poolAfter, error } — never
// mutates its inputs.
export function distribute(people, bills, leftover) {
  const result = runPipeline(people, bills, leftover || 0);
  return {
    byPerson: result.byPerson,
    poolAfter: result.poolAfter || normalizePool(bills),
    remainderBills: result.remainderBills || blankBills(),
    error: result.success ? '' : result.msg,
  };
}

// Trade-up plan: convert excess $1s/$5s/$10s into $20s.
// Returns { newPool, delta, new20s } or null if no $20s can be gained.
export function computeTradeUp(pool, req) {
  const minFives = Math.max(0, (req.minOneFiveValue - req.minOnes) / 5);
  const minTens = Math.max(0, (req.minOneFiveTenValue - req.minOneFiveValue) / 10);

  const excessOnes = Math.max(0, (pool[1] || 0) - req.minOnes);
  const excessFives = Math.max(0, (pool[5] || 0) - minFives);
  const excessTens = Math.max(0, (pool[10] || 0) - minTens);
  const totalExcess = excessOnes + excessFives * 5 + excessTens * 10;

  const new20s = Math.floor(totalExcess / 20);
  if (new20s <= 0) return null;

  let rem = totalExcess - new20s * 20;
  const keepExtra10 = Math.min(excessTens, Math.floor(rem / 10)); rem -= keepExtra10 * 10;
  const keepExtra5 = Math.min(excessFives, Math.floor(rem / 5)); rem -= keepExtra5 * 5;

  // Remove only the excess that was traded, then add back kept amounts —
  // prevents phantom bills when pool[d] < min[d].
  const newPool = {
    100: pool[100] || 0,
    50: pool[50] || 0,
    20: (pool[20] || 0) + new20s,
    10: (pool[10] || 0) - excessTens + keepExtra10,
    5: (pool[5] || 0) - excessFives + keepExtra5,
    1: (pool[1] || 0) - excessOnes + rem,
  };

  const delta = {};
  DENOMS.forEach(d => { delta[d] = (newPool[d] || 0) - (pool[d] || 0); });

  return { newPool, delta, new20s };
}
