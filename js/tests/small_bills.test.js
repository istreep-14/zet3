const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console };
vm.createContext(ctx);
vm.runInContext(
  'const DENOMS=[100,50,20,10,5,1];\n'
    + 'const $ = () => null;\n'
    + fs.readFileSync(path.join(__dirname, '../utils.js'), 'utf8')
    + '\n'
    + fs.readFileSync(path.join(__dirname, '../engine.js'), 'utf8')
    + '\n'
    + fs.readFileSync(path.join(__dirname, '../small_bills.js'), 'utf8'),
  ctx
);

{
  const req = ctx.getSmallBillRequirementsForAmounts([394, 395, 395, 395], {
    100: 0, 50: 0, 20: 0, 10: 4, 5: 1, 1: 14
  });
  assert.strictEqual(req.minOnes, 4);
  assert.strictEqual(req.minOneFiveValue, 19);
  assert.strictEqual(req.availableOneFiveValue, 19);
  assert.strictEqual(req.oneFiveShort, 0);
}

{
  const req = ctx.getSmallBillRequirementsForAmounts([390, 450, 550], {
    100: 0, 50: 2, 20: 0, 10: 0, 5: 0, 1: 1
  });
  assert.strictEqual(req.fiftyCoverage, 2);
  assert.ok(req.minOneFiveTenValue < 50);
}

console.log('small bill module tests passed');
