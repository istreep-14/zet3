import assert from 'node:assert';
import { idealBills, mergedBillCounts } from '../src/ideal.js';
import { poolValue } from '../src/util.js';

// Reserves exact minimum small bills, fills with $20s
{
  const targets = [282, 218];
  const pool = idealBills(500, targets);
  // ones: 2+3 = 5; fives: (mod10 sum 10 − ones 5)/5 = 1; odd-tens targets: 218 only
  assert.strictEqual(pool[1], 5);
  assert.strictEqual(pool[5], 1);
  assert.strictEqual(pool[10], 1);
  assert.strictEqual(poolValue(pool) <= 500, true);
  assert.strictEqual(pool[20], Math.floor((500 - (5 + 5 + 10)) / 20));
}

// Round targets need nothing small
{
  const pool = idealBills(400, [200, 200]);
  assert.strictEqual(pool[1], 0);
  assert.strictEqual(pool[5], 0);
  assert.strictEqual(pool[10], 0);
  assert.strictEqual(pool[20], 20);
}

// Zero / empty
assert.strictEqual(poolValue(idealBills(0, [1])), 0);
assert.strictEqual(poolValue(idealBills(100, [])), 0);

// mergedBillCounts: sums per-bill pools, null when any pool is nettotal
{
  const merged = mergedBillCounts([
    { billCounts: { 100: 1, 50: 0, 20: 2, 10: 0, 5: 0, 1: 3 } },
    { billCounts: { 100: 0, 50: 1, 20: 1, 10: 0, 5: 0, 1: 0 } },
  ]);
  assert.deepStrictEqual(merged, { 100: 1, 50: 1, 20: 3, 10: 0, 5: 0, 1: 3 });

  assert.strictEqual(mergedBillCounts([{ billCounts: { 100: 1 } }, { billCounts: null }]), null);
}

console.log('ideal tests passed');
