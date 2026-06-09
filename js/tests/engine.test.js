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
    + fs.readFileSync(path.join(__dirname, '../engine.js'), 'utf8'),
  ctx
);

function totalBills(bills) {
  return [100, 50, 20, 10, 5, 1].reduce((sum, d) => sum + (bills[d] || 0) * d, 0);
}

function runExample(pool) {
  const names = ['a', 'bc', 'c', 'd', 'aa'];
  const finals = [439, 487, 475, 390, 488];
  const staff = finals.map((final, i) => ({ n: names[i], final }));
  const result = ctx.distributeBills(staff, pool, 1);
  const remainderBills = result.remainderBills;

  staff.forEach(person => {
    assert.strictEqual(totalBills(person.bills), person.final, person.n + ' total');
  });
  assert.strictEqual(totalBills(remainderBills), 1, 'remainder total');

  return staff;
}

function highHundredsAndFifties(person) {
  return (person.bills[100] || 0) * 100 + (person.bills[50] || 0) * 50;
}

function smallBillCount(person) {
  return (person.bills[1] || 0) + (person.bills[5] || 0) + (person.bills[10] || 0);
}

function assertSmallSpread(staff, maxSpread, label) {
  const counts = staff.map(smallBillCount);
  assert.ok(
    Math.max(...counts) - Math.min(...counts) <= maxSpread,
    label + ' small bills should be rebalanced, got ' + counts.join(', ')
  );
}

function assertDenomSpread(staff, denom, maxSpread, label) {
  const counts = staff.map(person => person.bills[denom] || 0);
  assert.ok(
    Math.max(...counts) - Math.min(...counts) <= maxSpread,
    label + ' $' + denom + 's should be split, got ' + counts.join(', ')
  );
}

{
  const staff = runExample({ 100: 8, 50: 4, 20: 62, 10: 1, 5: 4, 1: 10 });
  const a = staff.find(p => p.n === 'a');
  const aa = staff.find(p => p.n === 'aa');
  const bc = staff.find(p => p.n === 'bc');

  assert.strictEqual(aa.bills[100], 2, 'largest payout keeps a proportional $100 share');
  assert.strictEqual(highHundredsAndFifties(a), 200, '$439 is not left at $150 progress');
  assert.strictEqual(highHundredsAndFifties(bc), 200, '$487 does not jump ahead of $439 on $50 progress');
  assert.strictEqual(highHundredsAndFifties(aa), 200, '$488 remains balanced with the adjacent top payouts');
}

{
  const staff = runExample({ 100: 7, 50: 6, 20: 62, 10: 1, 5: 4, 1: 10 });
  const a = staff.find(p => p.n === 'a');
  const aa = staff.find(p => p.n === 'aa');
  const bc = staff.find(p => p.n === 'bc');

  assert.strictEqual(aa.bills[100], 2, '$488 keeps two $100s with extra flippers available');
  assert.strictEqual(bc.bills[100], 2, '$487 keeps two $100s with extra flippers available');
  assert.strictEqual(highHundredsAndFifties(a), 200, '$439 receives a proportional second $50');
  assert.strictEqual(highHundredsAndFifties(bc), 200, '$487 stays balanced after $100s/$50s');
  assert.strictEqual(highHundredsAndFifties(aa), 200, '$488 stays balanced after $100s/$50s');
}

{
  const staff = runExample({ 100: 7, 50: 6, 20: 60, 10: 5, 5: 4, 1: 10 });
  const a = staff.find(p => p.n === 'a');
  const bc = staff.find(p => p.n === 'bc');
  const aa = staff.find(p => p.n === 'aa');

  assert.strictEqual(highHundredsAndFifties(a), 200, '$439 should be lifted from $150 to $200');
  assert.strictEqual(highHundredsAndFifties(bc), 200, '$487 should not sit at $250 when $439 is $150');
  assert.strictEqual(highHundredsAndFifties(aa), 200, '$488 remains proportionally aligned with $487');
}

{
  const names = ['a', 'bc', 'c', 'd', 'aa'];
  const finals = [438, 485, 473, 388, 486];
  const staff = finals.map((final, i) => ({ n: names[i], final }));
  ctx.distributeBills(staff, { 100: 7, 50: 6, 20: 61, 10: 1, 5: 4, 1: 20 }, 0);

  staff.forEach(person => {
    assert.strictEqual(totalBills(person.bills), person.final, person.n + ' latest screenshot total');
    assert.strictEqual(
      highHundredsAndFifties(person),
      200,
      person.n + ' should share $100+$50 progress evenly when constraints allow'
    );
  });
}

{
  const names = ['a', 'bc', 'c', 'd', 'aa'];
  const finals = [438, 485, 473, 388, 486];
  const staff = finals.map((final, i) => ({ n: names[i], final }));
  ctx.distributeBills(staff, { 100: 7, 50: 4, 20: 62, 10: 0, 5: 2, 1: 120 }, 0);

  staff.forEach(person => {
    assert.strictEqual(totalBills(person.bills), person.final, person.n + ' no tens extreme total');
  });
  assertSmallSpread(staff, 12, 'no tens extreme');
  assertDenomSpread(staff, 5, 2, 'no tens extreme');
  assert.ok((staff.find(p => p.n === 'd').bills[1] || 0) < 40, 'd should not absorb almost all $1s');
}

{
  const names = ['a', 'bc', 'c', 'd', 'aa'];
  const finals = [438, 485, 473, 388, 486];
  const staff = finals.map((final, i) => ({ n: names[i], final }));
  ctx.distributeBills(staff, { 100: 5, 50: 4, 20: 62, 10: 10, 5: 22, 1: 120 }, 0);

  staff.forEach(person => {
    assert.strictEqual(totalBills(person.bills), person.final, person.n + ' many small bills extreme total');
  });
  assertSmallSpread(staff, 12, 'many small bills extreme');
  assertDenomSpread(staff, 10, 3, 'many small bills extreme');
  assertDenomSpread(staff, 5, 3, 'many small bills extreme');
  assert.ok((staff.find(p => p.n === 'd').bills[1] || 0) < 40, 'd should not absorb almost all $1s');
}

console.log('engine distribution tests passed');
