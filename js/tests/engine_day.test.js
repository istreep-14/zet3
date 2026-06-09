const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console };
vm.createContext(ctx);
vm.runInContext(
  'const DENOMS=[100,50,20,10,5,1];\n'
    + fs.readFileSync(path.join(__dirname, '../utils.js'), 'utf8')
    + '\n'
    + fs.readFileSync(path.join(__dirname, '../engine.js'), 'utf8')
    + '\n'
    + fs.readFileSync(path.join(__dirname, '../engine_day.js'), 'utf8'),
  ctx
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function bartRow(name, inStr, outStr) {
  return { rowId: name, name, inStr: inStr || '', outStr: outStr || '', closer: false };
}

function servRow(name, inStr, outStr) {
  return { rowId: name, name, inStr: inStr || '', outStr: outStr || '', closer: false };
}

function run(barts, servs, poolCash, partyConfig) {
  return vm.runInContext(
    `calculateDayShift(
      ${JSON.stringify(barts)},
      ${JSON.stringify(servs)},
      ${JSON.stringify(poolCash)},
      ${JSON.stringify(partyConfig || { party1: { enabled: false }, party2: { enabled: false } })}
    )`,
    ctx
  );
}

// ── dayShiftAbsolute ──────────────────────────────────────────────────────────

{
  const abs = t => vm.runInContext(`dayShiftAbsolute(${t})`, ctx);
  assert.strictEqual(abs(10), 10,  '10 → 10am');
  assert.strictEqual(abs(12), 12,  '12 → noon');
  assert.strictEqual(abs(1),  13,  '1  → 1pm');
  assert.strictEqual(abs(9),  21,  '9  → 9pm');
}

// ── overlapHours ──────────────────────────────────────────────────────────────

{
  const overlap = (pIn, pOut, pStart, pEnd) =>
    vm.runInContext(`overlapHours(${pIn},${pOut},${pStart},${pEnd})`, ctx);

  assert.strictEqual(overlap(10, 14, 10, 14), 4,   'full overlap');
  assert.strictEqual(overlap(10, 12, 10, 14), 2,   'partial overlap (left)');
  assert.strictEqual(overlap(12, 14, 10, 14), 2,   'partial overlap (right)');
  assert.strictEqual(overlap(14, 16, 10, 14), 0,   'outside window');
  assert.strictEqual(overlap(10, 10, 10, 14), 0,   'zero-length person shift');
}

// ── No staff → error ──────────────────────────────────────────────────────────

{
  const r = run([], [], { morning: 100, middle: 100 });
  assert.ok(r.error, 'empty staff returns error');
}

// ── Zero cash → error ─────────────────────────────────────────────────────────

{
  const r = run(
    [bartRow('A', '10', '3')],
    [servRow('B', '10', '2')],
    { morning: 0, middle: 0 }
  );
  assert.ok(r.error, 'zero cash returns error');
  assert.ok(r.error.includes('cash'), 'error mentions cash');
}

// ── Missing server out-time → error ──────────────────────────────────────────

{
  const r = run(
    [bartRow('A', '10', '3')],
    [servRow('B', '10', '')],     // no out-time for server
    { morning: 200, middle: 100 }
  );
  assert.ok(r.error, 'missing server out returns error');
}

// ── Missing bartender out-time → error ───────────────────────────────────────

{
  const r = run(
    [bartRow('A', '10', '')],     // no out-time for bartender
    [servRow('B', '10', '2')],
    { morning: 200, middle: 100 }
  );
  assert.ok(r.error, 'missing bartender out returns error');
}

// ── Basic two-pool scenario ───────────────────────────────────────────────────

{
  // Bart in 10am, out 3pm (15); Server in 10am, out 2pm (14).
  // Morning cut [10,14]: both eligible. Middle cut [14,15]: bart only.
  const r = run(
    [bartRow('Bart', '10', '3')],
    [servRow('Serv', '10', '2')],
    { morning: 100, middle: 50 }
  );
  assert.strictEqual(r.error, null, 'no error');
  assert.strictEqual(r.totalCash, 150, 'totalCash');
  assert.strictEqual(r.totalPaid + r.leftover, r.totalCash,
    'totalPaid + leftover === totalCash');
  assert.ok(r.people.length === 2, '2 people');
  r.people.forEach(p => assert.ok(p.final >= 0, p.n + ' payout non-negative'));
}

// ── Closer auto-detection ─────────────────────────────────────────────────────

{
  // Bart has no out-time → auto-closer; server has explicit out.
  const r = run(
    [bartRow('CloserBart', '10', '')],
    [servRow('Serv', '10', '2')],
    { morning: 100, middle: 50 }
  );
  // Could still error if window derivation fails without bartender explicit out
  // (middleEnd needs at least one bartender explicit out). That's the expected behavior.
  assert.ok(r.error, 'missing bartender explicit out should error (window derivation)');
}

{
  // When bartender has explicit out, server has no out → server is auto-closer.
  const r = run(
    [bartRow('Bart', '10', '3')],
    [servRow('CloserServ', '10', '2'), servRow('AutoClose', '10', '')],
    { morning: 100, middle: 50 }
  );
  assert.strictEqual(r.error, null, 'no error with server auto-closer');
  const closer = r.people.find(p => p.n === 'AutoClose');
  assert.ok(closer.closer, 'AutoClose is marked as closer');
  assert.ok(closer.bonus >= 0, 'closer has non-negative bonus');
}

// ── Party pool inclusion ──────────────────────────────────────────────────────

{
  const r = run(
    [bartRow('Bart', '10', '3')],
    [servRow('Serv', '10', '2')],
    { morning: 100, middle: 50, party1: 60 },
    { party1: { enabled: true, start: '11', end: '1' }, party2: { enabled: false } }
  );
  assert.strictEqual(r.error, null, 'no error with party pool');
  assert.strictEqual(r.totalCash, 210, 'totalCash includes party pool');
  assert.strictEqual(r.totalPaid + r.leftover, r.totalCash,
    'totalPaid + leftover === totalCash with party');
  const partyPool = r.pools.find(p => p.id === 'party1');
  assert.ok(partyPool, 'party1 pool in results');
  assert.strictEqual(partyPool.total, 60, 'party1 total');
}

// ── Single bartender, single server ──────────────────────────────────────────

{
  const r = run(
    [bartRow('B', '10', '4')],
    [servRow('S', '11', '2')],
    { morning: 80, middle: 40 }
  );
  assert.strictEqual(r.error, null, 'minimal case no error');
  assert.strictEqual(r.totalPaid + r.leftover, r.totalCash, 'minimal: totals balance');
}

console.log('engine_day tests passed');
