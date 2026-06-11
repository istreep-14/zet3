// computeShares — THE tip split. Every consumer (live calc, Close Time
// sidebar, net-total ideal targets) runs this same function, so the closer
// rule cannot diverge between views.
//
// Per pool: participants share by overlap hours at rate = total / Σhours.
// Then ONCE across all pools (single-floor fairness):
//   exact = Σ rawShares;  base = floor(exact)
//   remainder = Σ poolTotals − Σ base
//   bonuses: manual overrides if any, else split among closers; leftover = chump

import { poolParticipants } from './resolve.js';

export function computeShares(pools, staff, overrides = {}) {
  const perPerson = staff.map(p => ({
    id: p.id,
    name: p.name,
    role: p.role,
    inAbs: p.inAbs,
    outAbs: p.outAbs,
    shiftHours: p.hours,
    closer: p.closer,
    autoCloser: p.autoCloser,
    usedDefaults: p.usedDefaults,
    usedCloseTime: p.usedCloseTime,
    perPool: {},
    hours: 0,
    exact: 0,
    base: 0,
    bonus: 0,
    final: 0,
  }));
  const byId = new Map(perPerson.map(p => [p.id, p]));

  const perPool = pools.map(pool => {
    const parts = poolParticipants(pool, staff);
    const hours = parts.reduce((s, x) => s + x.hours, 0);
    const rate = hours > 0 ? pool.total / hours : 0;

    const participants = parts.map(({ person, hours: h }) => {
      const raw = h * rate;
      const pp = byId.get(person.id);
      pp.perPool[pool.id] = { hours: h, raw };
      pp.hours += h;
      pp.exact += raw;
      return { id: person.id, name: person.name, role: person.role, hours: h, raw };
    });

    return {
      id: pool.id,
      label: pool.label,
      startAbs: pool.startAbs,
      endAbs: pool.endAbs,
      total: pool.total,
      hours,
      rate,
      participants,
      // Cash with nobody to earn it silently becomes remainder — surface it.
      warning: pool.total > 0 && !participants.length
        ? pool.label + ' has cash but no participants — its total falls into the remainder.'
        : '',
    };
  });

  perPerson.forEach(p => { p.base = Math.floor(p.exact); });

  const totalCash = pools.reduce((s, p) => s + p.total, 0);
  const totalHours = perPool.reduce((s, p) => s + p.hours, 0);
  const flooredSum = perPerson.reduce((s, p) => s + p.base, 0);
  const remainder = totalCash - flooredSum;

  const bonuses = overrides.bonuses || {};
  const hasOverrides = Object.keys(bonuses).length > 0;
  let leftover;
  if (hasOverrides) {
    let bonusSum = 0;
    perPerson.forEach(p => {
      p.bonus = bonuses[p.id] || 0;
      bonusSum += p.bonus;
    });
    leftover = Math.max(0, remainder - bonusSum);
  } else {
    const closers = perPerson.filter(p => p.closer);
    const perCloser = closers.length ? Math.floor(remainder / closers.length) : 0;
    closers.forEach(p => { p.bonus = perCloser; });
    leftover = remainder - perCloser * closers.length;
  }

  perPerson.forEach(p => { p.final = p.base + p.bonus; });

  return {
    perPerson,
    perPool,
    totalCash,
    totalHours,
    rate: totalHours > 0 ? totalCash / totalHours : 0,
    remainder,
    leftover,
    bonusMode: hasOverrides ? 'manual' : 'auto',
  };
}

// Distribution targets: every positive payout plus the chump (if any).
export function shareTargets(shares) {
  const targets = shares.perPerson.map(p => p.final).filter(v => v > 0);
  if (shares.leftover > 0) targets.push(shares.leftover);
  return targets;
}
