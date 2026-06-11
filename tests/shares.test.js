import assert from 'node:assert';
import { resolveStaff, resolvePools } from '../src/resolve.js';
import { computeShares, shareTargets } from '../src/shares.js';

function mkState({ staff, pools, defaults, bonuses }) {
  return {
    meta: { date: '' },
    staff,
    defaults: {
      global: { in: '5', out: '2' },
      byRole: { bartender: { in: '', out: '' }, server: { in: '', out: '' }, support: { in: '', out: '' } },
      ...(defaults || {}),
    },
    pools,
    overrides: { bonuses: bonuses || {} },
  };
}

function mkPool(over) {
  return {
    id: 'p1', label: 'Pool',
    window: { start: '', end: '' },
    roles: { bartender: true, server: true },
    includeSupport: false,
    cash: { entryMode: 'nettotal', billCounts: { 100: '', 50: '', 20: '', 10: '', 5: '', 1: '' }, netTotal: '' },
    ...over,
  };
}

function run(state) {
  const resolved = resolveStaff(state);
  assert.deepStrictEqual(resolved.errors, []);
  const { pools, errors } = resolvePools(state, resolved);
  assert.deepStrictEqual(errors, []);
  return computeShares(pools, resolved.staff, state.overrides);
}

// ── Single pool = old night shift behavior ──
{
  const state = mkState({
    staff: [
      { id: 's1', name: 'A', role: 'bartender', in: '5', out: '', closerOverride: false },
      { id: 's2', name: 'B', role: 'bartender', in: '6', out: '1', closerOverride: false },
    ],
    pools: [mkPool({ cash: { entryMode: 'nettotal', billCounts: {}, netTotal: '500' } })],
  });
  const shares = run(state);

  // A: 5→2a = 9h, B: 6→1a = 7h, total 16h, rate 31.25
  assert.strictEqual(shares.totalCash, 500);
  assert.strictEqual(shares.totalHours, 16);
  assert.strictEqual(shares.rate, 31.25);

  const [a, b] = shares.perPerson;
  assert.strictEqual(a.base, Math.floor(9 * 31.25)); // 281
  assert.strictEqual(b.base, Math.floor(7 * 31.25)); // 218
  assert.strictEqual(shares.remainder, 1);

  // A is sole closer (blank out at close 2a > B's 1a) → bonus 1, no chump
  assert.strictEqual(a.closer, true);
  assert.strictEqual(b.closer, false);
  assert.strictEqual(a.bonus, 1);
  assert.strictEqual(a.final, 282);
  assert.strictEqual(b.final, 218);
  assert.strictEqual(shares.leftover, 0);
  assert.strictEqual(a.final + b.final + shares.leftover, 500);

  assert.deepStrictEqual(shareTargets(shares).sort((x, y) => x - y), [218, 282]);
}

// ── Manual bonus overrides replace the closer split ──
{
  const state = mkState({
    staff: [
      { id: 's1', name: 'A', role: 'bartender', in: '5', out: '', closerOverride: false },
      { id: 's2', name: 'B', role: 'bartender', in: '5', out: '', closerOverride: false },
    ],
    pools: [mkPool({ cash: { entryMode: 'nettotal', billCounts: {}, netTotal: '101' } })],
    bonuses: { s2: 1 },
  });
  const shares = run(state);
  // 9h each, rate 101/18 → base 50 each, remainder 1 → manual: all to B
  assert.strictEqual(shares.bonusMode, 'manual');
  assert.strictEqual(shares.perPerson[0].final, 50);
  assert.strictEqual(shares.perPerson[1].final, 51);
  assert.strictEqual(shares.leftover, 0);
}

// ── Multi-pool: overlapping windows, single floor across pools ──
{
  // Day-style session: open 10a close 6p.
  // Morning cut [10→2]: bar+srv. Middle cut [2→6]: bar only.
  const state = mkState({
    staff: [
      { id: 's1', name: 'Bar', role: 'bartender', in: '10', out: '', closerOverride: false },
      { id: 's2', name: 'Srv', role: 'server', in: '10', out: '2', closerOverride: false },
    ],
    pools: [
      mkPool({ id: 'p1', label: 'Morning', window: { start: '', end: '2' }, cash: { entryMode: 'nettotal', billCounts: {}, netTotal: '200' } }),
      mkPool({ id: 'p2', label: 'Middle', window: { start: '2', end: '' }, roles: { bartender: true, server: false }, cash: { entryMode: 'nettotal', billCounts: {}, netTotal: '100' } }),
    ],
    defaults: { global: { in: '10', out: '6' } },
  });
  const shares = run(state);

  // Morning: both 4h → $100 raw each. Middle: bar alone 4h → $100 raw.
  const bar = shares.perPerson.find(p => p.id === 's1');
  const srv = shares.perPerson.find(p => p.id === 's2');
  assert.strictEqual(bar.perPool.p1.hours, 4);
  assert.strictEqual(bar.perPool.p2.hours, 4);
  assert.strictEqual(srv.perPool.p2, undefined);
  assert.strictEqual(bar.exact, 200);
  assert.strictEqual(srv.exact, 100);
  assert.strictEqual(bar.final + srv.final + shares.leftover, 300);
  assert.strictEqual(bar.closer, true);
  assert.strictEqual(srv.closer, false);
}

// ── Support inclusion: ordinary participant by overlap hours ──
{
  const state = mkState({
    staff: [
      { id: 's1', name: 'A', role: 'bartender', in: '5', out: '', closerOverride: false },
      { id: 's2', name: 'Sup', role: 'support', in: '5', out: '', closerOverride: false },
    ],
    pools: [mkPool({ includeSupport: true, cash: { entryMode: 'nettotal', billCounts: {}, netTotal: '180' } })],
  });
  const shares = run(state);
  // both 9h → $90 each; support earns a full proportional share
  const sup = shares.perPerson.find(p => p.id === 's2');
  assert.strictEqual(sup.exact, 90);
  assert.strictEqual(sup.closer, false);

  // excluded when includeSupport off
  const state2 = mkState({
    staff: state.staff,
    pools: [mkPool({ includeSupport: false, cash: { entryMode: 'nettotal', billCounts: {}, netTotal: '180' } })],
  });
  const shares2 = run(state2);
  const sup2 = shares2.perPerson.find(p => p.id === 's2');
  assert.strictEqual(sup2.exact, 0);
  assert.strictEqual(shares2.perPerson.find(p => p.id === 's1').exact, 180);
}

// ── Pool with cash but no participants → warning, cash falls to remainder ──
{
  const state = mkState({
    staff: [{ id: 's1', name: 'A', role: 'bartender', in: '5', out: '', closerOverride: false }],
    pools: [
      mkPool({ cash: { entryMode: 'nettotal', billCounts: {}, netTotal: '90' } }),
      mkPool({ id: 'p2', label: 'Ghost', roles: { bartender: false, server: true }, cash: { entryMode: 'nettotal', billCounts: {}, netTotal: '50' } }),
    ],
  });
  const shares = run(state);
  assert.ok(shares.perPool[1].warning.includes('no participants'));
  assert.strictEqual(shares.remainder, 50); // ghost pool's $50 falls through
  assert.strictEqual(shares.perPerson[0].final, 140); // closer absorbs it
}

console.log('shares tests passed');
