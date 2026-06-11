import assert from 'node:assert';
import { parseTime, toAbs, fmtTimeAbs, overlapHours, anchorIsAm } from '../src/time.js';
import { parseWholeNumber } from '../src/util.js';

// parseWholeNumber (carried over from utils.test.js)
assert.strictEqual(parseWholeNumber('').value, 0);
assert.strictEqual(parseWholeNumber('').empty, true);
assert.strictEqual(parseWholeNumber('12').valid, true);
assert.strictEqual(parseWholeNumber('0012').value, 12);
assert.strictEqual(parseWholeNumber('1.5').valid, false);
assert.strictEqual(parseWholeNumber('5abc').valid, false);
assert.strictEqual(parseWholeNumber('-1').valid, false);

// parseTime (carried over from utils.test.js)
assert.strictEqual(parseTime('').empty, true);
assert.strictEqual(parseTime('5').value, 5);
assert.strictEqual(parseTime('5.5').value, 5.5);
assert.strictEqual(parseTime('.5').value, 0.5);
assert.strictEqual(parseTime('12').valid, true);
assert.strictEqual(parseTime('12.5').valid, true);
assert.strictEqual(parseTime('13').valid, false);
assert.strictEqual(parseTime('5abc').valid, false);
assert.strictEqual(parseTime('-1').valid, false);

// Absolute axis — night anchored at 5 (5p): 5→5, 6→6, 2→14
assert.strictEqual(toAbs(5, 5), 5);
assert.strictEqual(toAbs(6, 5), 6);
assert.strictEqual(toAbs(11, 5), 11);
assert.strictEqual(toAbs(12, 5), 12);
assert.strictEqual(toAbs(2, 5), 14);
assert.strictEqual(toAbs(12.5, 5), 12.5);

// Day anchored at 10 (10a): 10→10, 12→12, 1→13, 6→18
assert.strictEqual(toAbs(10, 10), 10);
assert.strictEqual(toAbs(12, 10), 12);
assert.strictEqual(toAbs(1, 10), 13);
assert.strictEqual(toAbs(6, 10), 18);

// Anchor display heuristic: 8–11:59 opens read as AM
assert.strictEqual(anchorIsAm(10), true);
assert.strictEqual(anchorIsAm(5), false);
assert.strictEqual(anchorIsAm(12), false);

// Formatting on the absolute axis
assert.strictEqual(fmtTimeAbs(5, 5), '5p');
assert.strictEqual(fmtTimeAbs(10.5, 5), '10:30p');
assert.strictEqual(fmtTimeAbs(14, 5), '2a');
assert.strictEqual(fmtTimeAbs(12, 5), '12p'); // matches old night formatter
assert.strictEqual(fmtTimeAbs(10, 10), '10a');
assert.strictEqual(fmtTimeAbs(13, 10), '1p');
assert.strictEqual(fmtTimeAbs(18, 10), '6p');

// Overlap math
assert.strictEqual(overlapHours(5, 14, 5, 14), 9);
assert.strictEqual(overlapHours(5, 10, 8, 14), 2);
assert.strictEqual(overlapHours(5, 8, 8, 14), 0);
assert.strictEqual(overlapHours(10, 14, 5, 9), 0);

console.log('time tests passed');
