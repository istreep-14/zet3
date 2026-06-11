import assert from 'node:assert';
import { parseTime, resolveIn, nextAfter, atOrAfter, fmtTimeAbs, overlapHours } from '../src/time.js';
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

// IN times — fixed rule: 9–11:59 → AM, else PM (noon stays 12)
assert.strictEqual(resolveIn(9), 9);     // 9a
assert.strictEqual(resolveIn(11), 11);   // 11a
assert.strictEqual(resolveIn(11.5), 11.5);
assert.strictEqual(resolveIn(12), 12);   // 12p (noon)
assert.strictEqual(resolveIn(12.5), 12.5);
assert.strictEqual(resolveIn(1), 13);    // 1p
assert.strictEqual(resolveIn(5), 17);    // 5p
assert.strictEqual(resolveIn(8), 20);    // 8p

// OUT times — next occurrence of the reading after In
assert.strictEqual(nextAfter(2, 17), 26);   // 5p in, 2 out → 2a next day
assert.strictEqual(nextAfter(11, 17), 23);  // 5p in, 11 out → 11p
assert.strictEqual(nextAfter(6, 10), 18);   // 10a in, 6 out → 6p
assert.strictEqual(nextAfter(12, 17), 24);  // 5p in, 12 out → midnight

// Pool bounds — at-or-after the open (≥, so the open itself is allowed)
assert.strictEqual(atOrAfter(5, 17), 17);   // 5 == open
assert.strictEqual(atOrAfter(9, 17), 21);   // 9p
assert.strictEqual(atOrAfter(2, 17), 26);   // 2a

// Formatting on the true 24h+ axis (no anchor)
assert.strictEqual(fmtTimeAbs(17), '5p');
assert.strictEqual(fmtTimeAbs(22.5), '10:30p');
assert.strictEqual(fmtTimeAbs(26), '2a');
assert.strictEqual(fmtTimeAbs(12), '12p');
assert.strictEqual(fmtTimeAbs(24), '12a'); // midnight
assert.strictEqual(fmtTimeAbs(10), '10a');
assert.strictEqual(fmtTimeAbs(13), '1p');
assert.strictEqual(fmtTimeAbs(18), '6p');

// Overlap math
assert.strictEqual(overlapHours(5, 14, 5, 14), 9);
assert.strictEqual(overlapHours(5, 10, 8, 14), 2);
assert.strictEqual(overlapHours(5, 8, 8, 14), 0);
assert.strictEqual(overlapHours(10, 14, 5, 9), 0);

console.log('time tests passed');
