// Core calculation engine — pure functions, no DOM access

function blankBills() {
  return { 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 0 };
}

function normalizePool(pool) {
  const out = blankBills();
  DENOMS.forEach(d => {
    const parsed = parseWholeNumberString(pool?.[d] ?? '');
    out[d] = parsed.valid ? parsed.value : 0;
  });
  return out;
}

function calculateV19Pipeline(staffArr, poolIn, leftoverAmount) {
  const pool = normalizePool(poolIn);
  const slots = staffArr.map(p => ({
    ref: p,
    orig: p.final,
    target: p.final,
    bills: blankBills(),
    isRemainder: false
  }));

  if (leftoverAmount > 0) {
    slots.push({
      ref: null,
      orig: leftoverAmount,
      target: leftoverAmount,
      bills: blankBills(),
      isRemainder: true
    });
  }

  const preflight = runPreflight(slots, pool);
  if (!preflight.ok) return { success: false, msg: preflight.msg, poolAfter: pool, remainderBills: blankBills() };

  const preferred = buildPreferredPath(slots, pool);
  const poolAfterSieve = preferred ? null : runCascadingSieve(slots, pool);
  const paths = preferred ? [preferred] : runDFS(slots, poolAfterSieve);
  if (!paths.length) {
    return { success: false, msg: 'Exact change impossible with current bills. Adjust bill counts in Cash.', poolAfter: poolAfterSieve, remainderBills: blankBills() };
  }

  const best = preferred || gradePaths(paths);
  best.slots.forEach(s => {
    if (s.isRemainder) return;
    s.ref.bills = { ...s.bills };
    s.ref.rem = 0;
  });

  const remainderSlot = best.slots.find(s => s.isRemainder);
  return {
    success: true,
    msg: '',
    poolAfter: best.leftoverPool,
    remainderBills: remainderSlot ? { ...remainderSlot.bills } : blankBills()
  };
}

function runPreflight(slots, pool) {
  const targetTotal = slots.reduce((sum, s) => sum + s.target, 0);
  const cashTotal = poolValue(pool);
  if (cashTotal < targetTotal) {
    return { ok: false, msg: 'Cash on hand is short $' + (targetTotal - cashTotal) + '.' };
  }

  const minOnes = slots.reduce((sum, s) => sum + (s.target % 5), 0);
  const minMod10Val = slots.reduce((sum, s) => sum + (s.target % 10), 0);
  const availableSmallVal = (pool[1] || 0) + (pool[5] || 0) * 5;

  if ((pool[1] || 0) < minOnes) {
    return { ok: false, msg: 'Need ' + (minOnes - (pool[1] || 0)) + ' more $1s.' };
  }
  if (availableSmallVal < minMod10Val) {
    return { ok: false, msg: 'Need $' + (minMod10Val - availableSmallVal) + ' more in $1s/$5s.' };
  }

  return {
    ok: true,
    ideals: {
      1: minOnes,
      5: Math.max(0, (minMod10Val - minOnes) / 5),
      10: Math.max(0, slots.filter(s => Math.floor(s.target / 10) % 2 !== 0).length - (pool[50] || 0))
    }
  };
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
    ref: s.ref,
    orig: s.orig,
    target: s.target,
    bills: { ...s.bills },
    isRemainder: !!s.isRemainder
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
    raw: (s.orig || 0) / totalOrig * count
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
    leftoverPool: pool
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

function applyBestFlipperPlan(slots, pool) {
  const plan = [];
  const best = { score: Infinity, plan: null };
  let explored = 0;
  const maxPaths = 100000;

  const choicesBySlot = slots.map(s => {
    const choices = [];
    const max50 = Math.min(pool[50] || 0, Math.floor(s.target / 50));
    for (let n50 = 0; n50 <= max50; n50++) {
      const max10 = Math.min(pool[10] || 0, Math.floor((s.target - n50 * 50) / 10));
      for (let n10 = 0; n10 <= max10; n10++) {
        const rem = s.target - n50 * 50 - n10 * 10;
        if (rem >= 0 && rem % 20 === 0) choices.push({ n50, n10, rem });
      }
    }
    return choices.sort((a, b) => (b.n50 * 50 + b.n10 * 10) - (a.n50 * 50 + a.n10 * 10));
  });

  function scorePlan(candidate) {
    const used50 = candidate.reduce((sum, choice) => sum + choice.n50, 0);
    const used10 = candidate.reduce((sum, choice) => sum + choice.n10, 0);
    const needed20 = candidate.reduce((sum, choice) => sum + choice.rem / 20, 0);
    const unusedValue = (pool[50] - used50) * 50 + (pool[10] - used10) * 10 + (pool[20] - needed20) * 20;
    const staffSlots = slots.filter(s => !s.isRemainder);
    const totalOrig = staffSlots.reduce((sum, s) => sum + (s.orig || 0), 0) || 1;
    const high50 = staffSlots.map(s => {
      const i = slots.indexOf(s);
      return (s.bills[100] || 0) * 100 + ((candidate[i]?.n50 || 0) * 50);
    });
    const totalHigh50 = high50.reduce((sum, value) => sum + value, 0);
    let proportionalPenalty = 0;

    staffSlots.forEach((s, i) => {
      const ideal = (s.orig || 0) / totalOrig * totalHigh50;
      proportionalPenalty += Math.abs(high50[i] - ideal);
    });

    return Math.max(0, unusedValue) * 1000 + proportionalPenalty;
  }

  function search(idx, used50, used10) {
    if (explored > maxPaths) return;
    if (idx === slots.length) {
      explored++;
      const needed20 = plan.reduce((sum, choice) => sum + choice.rem / 20, 0);
      if (needed20 > (pool[20] || 0)) return;
      const score = scorePlan(plan);
      if (score < best.score) {
        best.score = score;
        best.plan = plan.map(choice => ({ ...choice }));
      }
      return;
    }

    for (const choice of choicesBySlot[idx]) {
      if (used50 + choice.n50 > (pool[50] || 0)) continue;
      if (used10 + choice.n10 > (pool[10] || 0)) continue;
      plan[idx] = choice;
      search(idx + 1, used50 + choice.n50, used10 + choice.n10);
    }
  }

  search(0, 0, 0);
  if (!best.plan) return false;

  best.plan.forEach((choice, i) => {
    if (choice.n50 > 0) {
      slots[i].bills[50] += choice.n50;
      slots[i].target -= choice.n50 * 50;
      pool[50] -= choice.n50;
    }
    if (choice.n10 > 0) {
      slots[i].bills[10] += choice.n10;
      slots[i].target -= choice.n10 * 10;
      pool[10] -= choice.n10;
    }
  });

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

function smallBillCount(s) {
  return (s.bills[1] || 0) + (s.bills[5] || 0) + (s.bills[10] || 0);
}

function smallBillValue(s) {
  return (s.bills[1] || 0) + (s.bills[5] || 0) * 5 + (s.bills[10] || 0) * 10;
}

function removeSmallValueWithOrder(s, value, order) {
  const removed = blankBills();
  let remaining = value;
  for (const d of order) {
    const use = Math.min(s.bills[d] || 0, Math.floor(remaining / d));
    if (use <= 0) continue;
    s.bills[d] -= use;
    removed[d] = use;
    remaining -= use * d;
  }
  if (remaining !== 0) {
    for (const d of [1, 5, 10]) {
      s.bills[d] += removed[d];
    }
    return null;
  }
  return removed;
}

function removeSmallValue(s, value) {
  return removeSmallValueWithOrder(s, value, [10, 5, 1]);
}

function addSmallBundle(s, bundle) {
  [1, 5, 10].forEach(d => { s.bills[d] += bundle[d] || 0; });
}

function smallSpreadScore(slots) {
  const staffSlots = slots.filter(s => !s.isRemainder);
  const range = values => Math.max(...values) - Math.min(...values);
  const totalOrig = staffSlots.reduce((sum, s) => sum + (s.orig || 0), 0) || 1;
  const totalSmallValue = staffSlots.reduce((sum, s) => sum + smallBillValue(s), 0);
  const valuePenalty = staffSlots.reduce((sum, s) => {
    const ideal = (s.orig || 0) / totalOrig * totalSmallValue;
    return sum + Math.abs(smallBillValue(s) - ideal);
  }, 0);

  return valuePenalty * 10000
    + range(staffSlots.map(smallBillValue)) * 1000
    + range(staffSlots.map(smallBillCount)) * 100
    + range(staffSlots.map(s => s.bills[10] || 0)) * 100
    + range(staffSlots.map(s => s.bills[5] || 0)) * 100
    + range(staffSlots.map(s => s.bills[1] || 0));
}

function rebalanceTwentiesAndSmallBills(slots) {
  let improved = true;
  while (improved) {
    improved = false;
    const currentScore = smallSpreadScore(slots);
    let best = null;

    for (const smallHeavy of slots.filter(s => !s.isRemainder && smallBillValue(s) >= 20)) {
      for (const twentyDonor of slots.filter(s => !s.isRemainder && s !== smallHeavy && (s.bills[20] || 0) > 0)) {
        const bundle = removeSmallValue(smallHeavy, 20);
        if (!bundle) continue;
        smallHeavy.bills[20]++;
        twentyDonor.bills[20]--;
        addSmallBundle(twentyDonor, bundle);

        const score = smallSpreadScore(slots);
        if (score < currentScore && (!best || score < best.score)) {
          best = { smallHeavy, twentyDonor, bundle: { ...bundle }, score };
        }

        [1, 5, 10].forEach(d => { twentyDonor.bills[d] -= bundle[d] || 0; });
        twentyDonor.bills[20]++;
        smallHeavy.bills[20]--;
        addSmallBundle(smallHeavy, bundle);
      }
    }

    if (best) {
      const bundle = removeSmallValue(best.smallHeavy, 20);
      best.smallHeavy.bills[20]++;
      best.twentyDonor.bills[20]--;
      addSmallBundle(best.twentyDonor, bundle);
      improved = true;
    }
  }
  rebalanceSmallDenominationBundles(slots);
}

function subtractSmallBundle(s, bundle) {
  [1, 5, 10].forEach(d => { s.bills[d] -= bundle[d] || 0; });
}

function rebalanceSmallDenominationBundles(slots) {
  let improved = true;
  while (improved) {
    improved = false;
    const currentScore = smallSpreadScore(slots);
    let best = null;

    for (const swapValue of [20, 10, 5]) {
      for (const highBundleSlot of slots.filter(s => !s.isRemainder && smallBillValue(s) >= swapValue)) {
        for (const lowBundleSlot of slots.filter(s => !s.isRemainder && s !== highBundleSlot && smallBillValue(s) >= swapValue)) {
          const highBundle = removeSmallValueWithOrder(highBundleSlot, swapValue, [10, 5, 1]);
          if (!highBundle) continue;
          const lowBundle = removeSmallValueWithOrder(lowBundleSlot, swapValue, [1, 5, 10]);
          if (!lowBundle) {
            addSmallBundle(highBundleSlot, highBundle);
            continue;
          }

          addSmallBundle(highBundleSlot, lowBundle);
          addSmallBundle(lowBundleSlot, highBundle);

          const score = smallSpreadScore(slots);
          if (score < currentScore && (!best || score < best.score)) {
            best = {
              highBundleSlot,
              lowBundleSlot,
              highBundle: { ...highBundle },
              lowBundle: { ...lowBundle },
              swapValue,
              score
            };
          }

          subtractSmallBundle(lowBundleSlot, highBundle);
          subtractSmallBundle(highBundleSlot, lowBundle);
          addSmallBundle(lowBundleSlot, lowBundle);
          addSmallBundle(highBundleSlot, highBundle);
        }
      }
    }

    if (best) {
      const highBundle = removeSmallValueWithOrder(best.highBundleSlot, best.swapValue, [10, 5, 1]);
      const lowBundle = removeSmallValueWithOrder(best.lowBundleSlot, best.swapValue, [1, 5, 10]);
      addSmallBundle(best.highBundleSlot, lowBundle);
      addSmallBundle(best.lowBundleSlot, highBundle);
      improved = true;
    }
  }
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
        leftoverPool: { ...pool }
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

function solveDistribution(slots, poolIn) {
  const fauxStaff = slots.map(s => ({ final: s.rem, bills: blankBills(), rem: s.rem }));
  const result = calculateV19Pipeline(fauxStaff, poolIn, 0);
  fauxStaff.forEach((p, i) => {
    slots[i].bills = { ...p.bills };
    slots[i].rem = result.success ? 0 : slots[i].rem;
  });
  return result.poolAfter;
}

function distributeBills(staff, available, leftover) {
  staff.forEach(p => { p.bills = blankBills(); p.rem = p.final; });
  const result = calculateV19Pipeline(staff, available, leftover || 0);
  lastRemainderBills = result.remainderBills || blankBills();
  lastDistributionError = result.success ? '' : result.msg;
  lastPoolAfter = result.poolAfter || normalizePool(available);
  return lastPoolAfter;
}
