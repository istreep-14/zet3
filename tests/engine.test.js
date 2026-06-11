// Regression gate — same scenarios as the v3 engine.test.js, against the
// ported pure distribute() API.
import assert from 'node:assert';
import { distribute } from '../src/engine.js';

function totalBills(bills) {
  return [100, 50, 20, 10, 5, 1].reduce((sum, d) => sum + (bills[d] || 0) * d, 0);
}

function runExample(pool) {
  const ids = ['a', 'bc', 'c', 'd', 'aa'];
  const finals = [439, 487, 475, 390, 488];
  const people = finals.map((final, i) => ({ id: ids[i], final }));
  const dist = distribute(people, pool, 1);

  assert.strictEqual(dist.error, '', 'distribution should succeed');
  people.forEach(p => {
    assert.strictEqual(totalBills(dist.byPerson[p.id]), p.final, p.id + ' total');
  });
  assert.strictEqual(totalBills(dist.remainderBills), 1, 'remainder total');

  return dist.byPerson;
}

function highHundredsAndFifties(bills) {
  return (bills[100] || 0) * 100 + (bills[50] || 0) * 50;
}

{
  const by = runExample({ 100: 8, 50: 4, 20: 62, 10: 1, 5: 4, 1: 10 });
  assert.strictEqual(by.aa[100], 2, 'largest payout keeps a proportional $100 share');
  assert.strictEqual(highHundredsAndFifties(by.a), 200, '$439 is not left at $150 progress');
  assert.strictEqual(highHundredsAndFifties(by.bc), 200, '$487 does not jump ahead of $439 on $50 progress');
  assert.strictEqual(highHundredsAndFifties(by.aa), 200, '$488 remains balanced with the adjacent top payouts');
}

{
  const by = runExample({ 100: 7, 50: 6, 20: 62, 10: 1, 5: 4, 1: 10 });
  assert.strictEqual(by.aa[100], 2, '$488 keeps two $100s with extra flippers available');
  assert.strictEqual(by.bc[100], 2, '$487 keeps two $100s with extra flippers available');
  assert.strictEqual(highHundredsAndFifties(by.a), 200, '$439 receives a proportional second $50');
  assert.strictEqual(highHundredsAndFifties(by.bc), 200, '$487 stays balanced after $100s/$50s');
  assert.strictEqual(highHundredsAndFifties(by.aa), 200, '$488 stays balanced after $100s/$50s');
}

{
  const by = runExample({ 100: 7, 50: 6, 20: 60, 10: 5, 5: 4, 1: 10 });
  assert.strictEqual(highHundredsAndFifties(by.a), 200, '$439 should be lifted from $150 to $200');
  assert.strictEqual(highHundredsAndFifties(by.bc), 200, '$487 should not sit at $250 when $439 is $150');
  assert.strictEqual(highHundredsAndFifties(by.aa), 200, '$488 remains proportionally aligned with $487');
}

{
  const ids = ['a', 'bc', 'c', 'd', 'aa'];
  const finals = [438, 485, 473, 388, 486];
  const people = finals.map((final, i) => ({ id: ids[i], final }));
  const dist = distribute(people, { 100: 7, 50: 6, 20: 61, 10: 1, 5: 4, 1: 20 }, 0);

  people.forEach(p => {
    assert.strictEqual(totalBills(dist.byPerson[p.id]), p.final, p.id + ' latest screenshot total');
    assert.strictEqual(
      highHundredsAndFifties(dist.byPerson[p.id]),
      200,
      p.id + ' should share $100+$50 progress evenly when constraints allow',
    );
  });
}

function smallBillCount(bills) {
  return (bills[1] || 0) + (bills[5] || 0) + (bills[10] || 0);
}

function assertSmallSpread(byPerson, ids, maxSpread, label) {
  const counts = ids.map(id => smallBillCount(byPerson[id]));
  assert.ok(
    Math.max(...counts) - Math.min(...counts) <= maxSpread,
    label + ' small bills should be balanced, got ' + counts.join(', '),
  );
}

function assertDenomSpread(byPerson, ids, denom, maxSpread, label) {
  const counts = ids.map(id => byPerson[id][denom] || 0);
  assert.ok(
    Math.max(...counts) - Math.min(...counts) <= maxSpread,
    label + ' $' + denom + 's should be split, got ' + counts.join(', '),
  );
}

{
  const ids = ['a', 'bc', 'c', 'd', 'aa'];
  const finals = [438, 485, 473, 388, 486];
  const people = finals.map((final, i) => ({ id: ids[i], final }));
  const dist = distribute(people, { 100: 7, 50: 4, 20: 62, 10: 0, 5: 2, 1: 120 }, 0);

  people.forEach(p => {
    assert.strictEqual(totalBills(dist.byPerson[p.id]), p.final, p.id + ' no tens extreme total');
  });
  assertSmallSpread(dist.byPerson, ids, 12, 'no tens extreme');
  assertDenomSpread(dist.byPerson, ids, 5, 2, 'no tens extreme');
  assert.ok((dist.byPerson.d[1] || 0) < 40, 'd should not absorb almost all $1s');
}

{
  const ids = ['a', 'bc', 'c', 'd', 'aa'];
  const finals = [438, 485, 473, 388, 486];
  const people = finals.map((final, i) => ({ id: ids[i], final }));
  const dist = distribute(people, { 100: 5, 50: 4, 20: 62, 10: 10, 5: 22, 1: 120 }, 0);

  people.forEach(p => {
    assert.strictEqual(totalBills(dist.byPerson[p.id]), p.final, p.id + ' many small bills extreme total');
  });
  assertSmallSpread(dist.byPerson, ids, 12, 'many small bills extreme');
  assertDenomSpread(dist.byPerson, ids, 10, 3, 'many small bills extreme');
  assertDenomSpread(dist.byPerson, ids, 5, 3, 'many small bills extreme');
  assert.ok((dist.byPerson.d[1] || 0) < 40, 'd should not absorb almost all $1s');
}

// Preflight failure surfaces an error instead of bills
{
  const dist = distribute([{ id: 'a', final: 99 }], { 100: 1 }, 0);
  assert.ok(dist.error.length > 0, 'short on $1s should error');
  assert.deepStrictEqual(dist.byPerson, {});
}

console.log('engine distribution tests passed');
