import assert from 'node:assert';
import { resolveStaff, resolvePools } from '../src/resolve.js';

function baseState(staff, pools, defaults) {
  return {
    meta: { date: '' },
    staff,
    defaults: {
      global: { in: '5', out: '2' },
      byRole: { bartender: { in: '', out: '' }, server: { in: '', out: '' }, support: { in: '', out: '' } },
      ...defaults,
    },
    pools: pools || [],
    overrides: { bonuses: {} },
  };
}

function person(over) {
  return { id: 'sX', name: 'X', role: 'bartender', in: '', out: '', closerOverride: false, ...over };
}

// ── Defaults resolution: explicit → role default → global ──
{
  const state = baseState([
    person({ id: 's1', name: 'A', in: '6', out: '1' }),
    person({ id: 's2', name: 'B' }),
    person({ id: 's3', name: 'C', role: 'server' }),
  ]);
  state.defaults.byRole.server = { in: '5.5', out: '11' };

  const r = resolveStaff(state);
  assert.deepStrictEqual(r.errors, []);
  assert.strictEqual(r.anchorRaw, 5);
  assert.strictEqual(r.closeAbs, 14); // global out 2 → 2a

  const [a, b, c] = r.staff;
  assert.strictEqual(a.inAbs, 6);
  assert.strictEqual(a.outAbs, 13);
  assert.deepStrictEqual(a.usedDefaults, { in: false, out: false });

  assert.strictEqual(b.inAbs, 5);   // global in
  assert.strictEqual(b.outAbs, 14); // inherits close time
  assert.strictEqual(b.usedCloseTime, true);
  assert.deepStrictEqual(b.usedDefaults, { in: true, out: true });

  assert.strictEqual(c.inAbs, 5.5); // role default
  assert.strictEqual(c.outAbs, 11); // role default out beats close inherit
}

// ── Closer rule: hybrid ──
{
  // Blank outs sit at close → all closers (tie)
  const r1 = resolveStaff(baseState([person({ id: 's1', name: 'A' }), person({ id: 's2', name: 'B' })]));
  assert.ok(r1.staff[0].closer && r1.staff[1].closer);

  // Typed past close → sole closer
  const r2 = resolveStaff(baseState([
    person({ id: 's1', name: 'A', out: '2.5' }),
    person({ id: 's2', name: 'B' }),
  ]));
  assert.strictEqual(r2.staff[0].closer, true);
  assert.strictEqual(r2.staff[1].closer, false);

  // Manual override forces closer
  const r3 = resolveStaff(baseState([
    person({ id: 's1', name: 'A', out: '12' }),
    person({ id: 's2', name: 'B' }),
  ]));
  assert.strictEqual(r3.staff[0].closer, false);
  const r4 = resolveStaff(baseState([
    person({ id: 's1', name: 'A', out: '12', closerOverride: true }),
    person({ id: 's2', name: 'B' }),
  ]));
  assert.strictEqual(r4.staff[0].closer, true);
  assert.strictEqual(r4.staff[0].autoCloser, false);

  // Support staff never auto-close
  const r5 = resolveStaff(baseState([
    person({ id: 's1', name: 'A' }),
    person({ id: 's2', name: 'B', role: 'support' }),
  ]));
  assert.strictEqual(r5.staff[1].closer, false);
}

// ── Errors ──
{
  const r1 = resolveStaff(baseState([person({ id: 's1', name: 'A', in: 'abc' })]));
  assert.ok(r1.errors.some(e => e.includes("A's In time")));

  // out before in → invalid hours
  const r2 = resolveStaff(baseState([person({ id: 's1', name: 'A', in: '8', out: '6' })]));
  assert.ok(r2.errors.some(e => e.includes('invalid shift hours')));

  // unnamed rows are ignored
  const r3 = resolveStaff(baseState([person({ id: 's1', name: '  ' })]));
  assert.strictEqual(r3.staff.length, 0);
}

// ── Day-anchored session ──
{
  const state = baseState([
    person({ id: 's1', name: 'A', in: '10', out: '4' }),
    person({ id: 's2', name: 'B', in: '11.5' }),
  ]);
  state.defaults.global = { in: '10', out: '6' };
  const r = resolveStaff(state);
  assert.strictEqual(r.anchorRaw, 10);
  assert.strictEqual(r.closeAbs, 18);
  assert.strictEqual(r.staff[0].outAbs, 16); // 4p
  assert.strictEqual(r.staff[1].inAbs, 11.5);
  assert.strictEqual(r.staff[1].outAbs, 18);
}

// ── Pools ──
{
  const pool = (over) => ({
    id: 'p1', label: 'Pool',
    window: { start: '', end: '' },
    roles: { bartender: true, server: true },
    includeSupport: false,
    cash: { entryMode: 'nettotal', billCounts: { 100: '', 50: '', 20: '', 10: '', 5: '', 1: '' }, netTotal: '' },
    ...over,
  });

  const state = baseState(
    [person({ id: 's1', name: 'A', in: '6' })],
    [pool({ cash: { entryMode: 'nettotal', billCounts: {}, netTotal: '500' } })],
  );
  const resolved = resolveStaff(state);
  const { pools, errors } = resolvePools(state, resolved);
  assert.deepStrictEqual(errors, []);
  assert.strictEqual(pools[0].startAbs, 6);   // blank start = earliest resolved in
  assert.strictEqual(pools[0].endAbs, 14);    // blank end = close time
  assert.strictEqual(pools[0].total, 500);
  assert.strictEqual(pools[0].billCounts, null);

  // Explicit window + per-bill cash
  const state2 = baseState(
    [person({ id: 's1', name: 'A' })],
    [pool({
      id: 'p2', label: 'Party',
      window: { start: '7', end: '11' },
      cash: { entryMode: 'perbill', billCounts: { 100: '2', 50: '', 20: '5', 10: '', 5: '', 1: '3' }, netTotal: '' },
    })],
  );
  const resolved2 = resolveStaff(state2);
  const r2 = resolvePools(state2, resolved2);
  assert.strictEqual(r2.pools[0].startAbs, 7);
  assert.strictEqual(r2.pools[0].endAbs, 11);
  assert.strictEqual(r2.pools[0].total, 303);
  assert.strictEqual(r2.pools[0].billCounts[20], 5);

  // Inverted window errors
  const state3 = baseState([person({ id: 's1', name: 'A' })], [pool({ window: { start: '11', end: '7' } })]);
  const r3 = resolvePools(state3, resolveStaff(state3));
  assert.ok(r3.errors.some(e => e.includes('window end')));
}

console.log('resolve tests passed');
