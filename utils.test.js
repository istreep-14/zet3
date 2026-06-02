const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'utils.js'), 'utf8'), ctx);

assert.deepStrictEqual(ctx.parseWholeNumberString('').value, 0);
assert.strictEqual(ctx.parseWholeNumberString('12').valid, true);
assert.strictEqual(ctx.parseWholeNumberString('0012').value, 12);
assert.strictEqual(ctx.parseWholeNumberString('1.5').valid, false);
assert.strictEqual(ctx.parseWholeNumberString('5abc').valid, false);
assert.strictEqual(ctx.parseWholeNumberString('-1').valid, false);

assert.strictEqual(ctx.parseTimeString('').empty, true);
assert.strictEqual(ctx.parseTimeString('5').value, 5);
assert.strictEqual(ctx.parseTimeString('5.5').value, 5.5);
assert.strictEqual(ctx.parseTimeString('.5').value, 0.5);
assert.strictEqual(ctx.parseTimeString('12').valid, true);
assert.strictEqual(ctx.parseTimeString('12.5').valid, false);
assert.strictEqual(ctx.parseTimeString('5abc').valid, false);
assert.strictEqual(ctx.parseTimeString('-1').valid, false);

console.log('utility parsing tests passed');
