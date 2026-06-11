// buildViewModel — runs the whole pure pipeline (§5) and packages everything
// the renderers need. Renderers read ONLY the view model.

import { resolveStaff, resolvePools } from './resolve.js';
import { computeShares, shareTargets } from './shares.js';
import { mergedBillCounts, idealBills } from './ideal.js';
import { distribute, getSmallBillRequirements } from './engine.js';

export function buildViewModel(state, opts = {}) {
  const resolved = resolveStaff(state, opts);
  const poolsR = resolvePools(state, resolved);
  const errors = [...resolved.errors, ...poolsR.errors];

  const vm = {
    state,
    resolved,
    pools: poolsR.pools,
    errors,
    hasNamedStaff: resolved.staff.length > 0,
    totalCash: poolsR.pools.reduce((s, p) => s + p.total, 0),
    shares: null,
    bills: null,
    dist: null,
    people: [],
    req: null,
    blocked: '',
    inputError: false,
  };

  if (errors.length) {
    vm.blocked = errors[0];
    vm.inputError = true;
    return vm;
  }
  if (!vm.hasNamedStaff) {
    vm.blocked = 'Add staff with names.';
    return vm;
  }

  vm.shares = computeShares(poolsR.pools, resolved.staff, state.overrides);

  if (vm.totalCash === 0) {
    vm.blocked = 'Enter cash for at least one pool.';
    return vm;
  }

  const targets = shareTargets(vm.shares);
  vm.bills = mergedBillCounts(poolsR.pools) ?? idealBills(vm.totalCash, targets);

  vm.people = vm.shares.perPerson
    .filter(p => p.final > 0)
    .map(p => ({ id: p.id, name: p.name, role: p.role, closer: p.closer, final: p.final }));

  vm.dist = distribute(vm.people, vm.bills, vm.shares.leftover);
  vm.req = getSmallBillRequirements(vm.people, vm.bills, vm.shares.leftover);

  return vm;
}

// One shared computation for the Close Time sidebar: same pipeline, with the
// global Out swapped for a candidate close time. `drawerBills` is the actual
// current drawer (vm.bills) so the requirement rows show real coverage.
export function buildCloseTimeColumn(state, closeOverride, drawerBills) {
  const resolved = resolveStaff(state, { closeOverride });
  const poolsR = resolvePools(state, resolved);
  if (resolved.errors.length || poolsR.errors.length || !resolved.staff.length) return null;
  const shares = computeShares(poolsR.pools, resolved.staff, state.overrides);
  if (shares.totalCash === 0 || shares.totalHours === 0) return null;
  const people = shares.perPerson
    .filter(p => p.final > 0)
    .map(p => ({ id: p.id, final: p.final }));
  const req = getSmallBillRequirements(people, drawerBills || {}, shares.leftover);
  return { shares, req };
}
