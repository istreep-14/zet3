import { distributeTargets } from './distribution';
import { blankBills, normalizeBillCounts, parseWholeNumber, poolValue } from './money';
import { getSmallBillRequirements, smallBillStatus } from './smallBills';
import { effectiveOutValue, parseTimeInput, shiftHours } from './time';
import type { CalculationResult, CashState, ComputedPerson, Denomination, SessionState, StaffMember } from './types';

export const STORAGE_VERSION = 2;

export function createEmptyCash(): CashState {
  return {
    mode: 'billCounts',
    billCounts: { 100: '', 50: '', 20: '', 10: '', 5: '', 1: '' },
    netTotal: '',
    additions: [],
  };
}

export function createDefaultSession(): SessionState {
  return {
    version: STORAGE_VERSION,
    date: new Date().toISOString().slice(0, 10),
    closeTime: '2.5',
    staff: [
      createStaffMember('Alex', '5', ''),
      createStaffMember('Sam', '5', ''),
    ],
    cash: createEmptyCash(),
  };
}

export function createStaffMember(name = '', inTime = '', outTime = ''): StaffMember {
  return {
    id: crypto.randomUUID(),
    name,
    inTime,
    outTime,
    closerOverride: 'auto',
  };
}

export function calculateSession(session: SessionState): CalculationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const pool = normalizeBillCounts(session.cash.billCounts);
  const billTotal = poolValue(pool);
  const additionsTotal = session.cash.additions.reduce((sum, item) => {
    const parsed = parseWholeNumber(item.amount);
    if (!parsed.valid) warnings.push('One tip addition is not a whole dollar amount.');
    return sum + (parsed.valid ? parsed.value : 0);
  }, 0);
  const netParsed = parseWholeNumber(session.cash.netTotal);
  if (!netParsed.valid) errors.push('Net total must be a whole dollar amount.');

  const total = session.cash.mode === 'billCounts' ? billTotal : netParsed.value + additionsTotal;
  const closeParsed = parseTimeInput(session.closeTime);
  if (!closeParsed.valid || closeParsed.empty || closeParsed.value == null) {
    errors.push('Close time must be a 15-minute value such as 2.5.');
  }

  const namedStaff = session.staff.filter((person) => person.name.trim());
  if (namedStaff.length === 0) errors.push('Add at least one staff name.');
  if (total === 0) warnings.push('Cash is zero.');

  const staff: ComputedPerson[] = [];
  const closeValue = closeParsed.value;
  if (!errors.length && closeValue != null) {
    namedStaff.forEach((person) => {
      const inParsed = parseTimeInput(person.inTime);
      const outParsed = parseTimeInput(person.outTime);
      const inValue = inParsed.value;
      if (!inParsed.valid || inParsed.empty || inValue == null) {
        errors.push(`${person.name} needs a valid in time.`);
        return;
      }
      if (!outParsed.valid) {
        errors.push(`${person.name} has an invalid out time.`);
        return;
      }

      const outWasPlaceholder = outParsed.empty || outParsed.value == null;
      const outValue = outWasPlaceholder ? closeValue : outParsed.value;
      if (outValue == null) {
        errors.push(`${person.name} has an invalid out time.`);
        return;
      }
      const hours = shiftHours(inValue, outValue);
      if (hours <= 0 || hours > 12) {
        errors.push(`${person.name} has invalid shift hours.`);
        return;
      }

      staff.push({
        id: person.id,
        name: person.name.trim(),
        inValue,
        outValue,
        outWasPlaceholder,
        hours,
        effectiveOut: effectiveOutValue(inValue, outValue),
        isCloser: false,
        exact: 0,
        base: 0,
        bonus: 0,
        final: 0,
        bills: blankBills(),
      });
    });
  }

  if (errors.length || !staff.length || total === 0) {
    return emptyResult(errors.length ? 'blocked' : 'needsInfo', errors, warnings, total, billTotal, additionsTotal, pool);
  }

  const latestOut = Math.max(...staff.map((person) => person.effectiveOut));
  staff.forEach((person) => {
    const source = namedStaff.find((candidate) => candidate.id === person.id);
    const override = source?.closerOverride ?? 'auto';
    const inferredCloser = person.outWasPlaceholder || person.effectiveOut === latestOut;
    person.isCloser = override === 'closer' || (override === 'auto' && inferredCloser);
  });

  const closerCount = staff.filter((person) => person.isCloser).length;
  if (closerCount === 0) warnings.push('No closer detected; Chump will keep the remainder.');
  if (closerCount === 1) warnings.push('Only one closer detected.');

  const totalHours = staff.reduce((sum, person) => sum + person.hours, 0);
  const rate = total / totalHours;
  staff.forEach((person) => {
    person.exact = person.hours * rate;
    person.base = Math.floor(person.exact);
  });

  const flooredTotal = staff.reduce((sum, person) => sum + person.base, 0);
  const rawRemainder = total - flooredTotal;
  const perCloserBonus = closerCount > 0 ? Math.floor(rawRemainder / closerCount) : 0;
  staff.forEach((person) => {
    person.bonus = person.isCloser ? perCloserBonus : 0;
    person.final = person.base + person.bonus;
  });
  const chump = rawRemainder - perCloserBonus * closerCount;

  const targets = [
    ...staff.map((person) => ({ amount: person.final })),
    ...(chump > 0 ? [{ amount: chump }] : []),
  ];
  const requirements = getSmallBillRequirements(targets, pool);

  const distribution = session.cash.mode === 'billCounts'
    ? distributeTargets(
        [
          ...staff.map((person) => ({ id: person.id, name: person.name, target: person.final })),
          ...(chump > 0 ? [{ id: 'chump', name: 'Chump', target: chump, isChump: true }] : []),
        ],
        pool,
      )
    : { ok: false, error: 'Bill chart needs exact bill counts.', slots: [] };

  if (distribution.ok) {
    staff.forEach((person) => {
      person.bills = distribution.slots.find((slot) => slot.id === person.id)?.bills ?? blankBills();
    });
  }

  const blocked = session.cash.mode === 'billCounts' && (smallBillStatus(requirements) === 'short' || !distribution.ok);

  return {
    status: blocked ? 'blocked' : session.cash.mode === 'netTotal' ? 'estimate' : 'ready',
    warnings,
    errors,
    total,
    billTotal,
    additionsTotal,
    totalHours,
    rate,
    rawRemainder,
    perCloserBonus,
    chump,
    staff,
    pool,
    requirements,
    distribution,
  };
}

function emptyResult(
  status: CalculationResult['status'],
  errors: string[],
  warnings: string[],
  total: number,
  billTotal: number,
  additionsTotal: number,
  pool: Record<Denomination, number>,
): CalculationResult {
  return {
    status,
    warnings,
    errors,
    total,
    billTotal,
    additionsTotal,
    totalHours: 0,
    rate: 0,
    rawRemainder: 0,
    perCloserBonus: 0,
    chump: 0,
    staff: [],
    pool,
    requirements: null,
    distribution: { ok: false, error: '', slots: [] },
  };
}
