import { describe, expect, it } from 'vitest';
import { calculateSession, createDefaultSession } from '../domain/session';
import { distributeTargets } from '../domain/distribution';
import { getSmallBillRequirements, parsedKeepTargets, smallBillStatus } from '../domain/smallBills';
import { blankBills, poolValue } from '../domain/money';
import { parseTimeInput } from '../domain/time';

describe('time parsing', () => {
  it('accepts 15-minute decimal values', () => {
    expect(parseTimeInput('5').valid).toBe(true);
    expect(parseTimeInput('2.5').valid).toBe(true);
    expect(parseTimeInput('6.25').valid).toBe(true);
  });

  it('rejects non-quarter-hour values', () => {
    expect(parseTimeInput('6.2').valid).toBe(false);
    expect(parseTimeInput('13').valid).toBe(false);
  });
});

describe('small bill requirements', () => {
  it('uses cumulative one-plus-five value so extra ones can cover five-dollar needs', () => {
    const pool = { ...blankBills(), 1: 14, 5: 1, 10: 4 };
    const requirements = getSmallBillRequirements([{ amount: 394 }, { amount: 395 }, { amount: 395 }, { amount: 395 }], pool);

    expect(requirements.minOnes).toBe(4);
    expect(requirements.minOneFiveValue).toBe(19);
    expect(requirements.availableOneFiveValue).toBe(19);
    expect(requirements.oneFiveShort).toBe(0);
    expect(smallBillStatus(requirements)).toBe('covered');
  });

  it('parses cumulative requirements back into friendly keep targets', () => {
    const pool = { ...blankBills(), 1: 22, 5: 5, 10: 2 };
    const requirements = getSmallBillRequirements([{ amount: 399 }, { amount: 390 }, { amount: 385 }], pool);
    const keep = parsedKeepTargets(requirements);

    expect(keep.ones).toBeGreaterThan(0);
    expect(keep.fives).toBeGreaterThanOrEqual(0);
    expect(keep.tens).toBeGreaterThanOrEqual(0);
  });
});

describe('night shift session calculation', () => {
  it('uses blank out times as close-time closers and creates Chump', () => {
    const session = createDefaultSession();
    session.cash.billCounts = { 100: '1', 50: '', 20: '', 10: '', 5: '', 1: '' };
    session.staff = [
      { id: 'a', name: 'Alex', inTime: '5', outTime: '1', closerOverride: 'auto' },
      { id: 's', name: 'Sam', inTime: '5', outTime: '', closerOverride: 'auto' },
    ];

    const result = calculateSession(session);

    expect(result.total).toBe(100);
    expect(result.staff.find((person) => person.name === 'Sam')?.isCloser).toBe(true);
    expect(result.rawRemainder).toBeGreaterThanOrEqual(result.chump);
    expect(result.chump).toBe(0);
  });
});

describe('bill chart distribution', () => {
  it('allocates every target exactly in a representative high-cash pool', () => {
    const targets = [439, 487, 475, 390, 488].map((target, index) => ({
      id: String(index),
      name: `Person ${index + 1}`,
      target,
    }));
    const result = distributeTargets(targets, { 100: 8, 50: 4, 20: 62, 10: 1, 5: 4, 1: 11 });

    expect(result.ok).toBe(true);
    expect(result.slots).toHaveLength(targets.length);
    result.slots.forEach((slot) => {
      expect(poolValue(slot.bills)).toBe(slot.target);
    });
  });

  it('keeps Chump as a pseudo-person in the bill chart', () => {
    const result = distributeTargets(
      [
        { id: 'a', name: 'Alex', target: 9 },
        { id: 'chump', name: 'Chump', target: 1, isChump: true },
      ],
      { ...blankBills(), 5: 1, 1: 5 },
    );

    expect(result.ok).toBe(true);
    expect(result.slots.find((slot) => slot.id === 'chump')?.isChump).toBe(true);
    expect(poolValue(result.slots.find((slot) => slot.id === 'chump')!.bills)).toBe(1);
  });
});
