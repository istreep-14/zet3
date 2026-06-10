import type { BillCounts, SmallBillRequirements } from './types';

interface RequirementTarget {
  amount: number;
}

export function getSmallBillRequirements(
  targets: RequirementTarget[],
  pool: BillCounts,
  closerCount = 0,
): SmallBillRequirements {
  const oddTenTargets = targets.filter((target) => Math.floor(target.amount / 10) % 2 !== 0);
  const fiftyEligibleOddTenCount = oddTenTargets.filter((target) => target.amount >= 50).length;
  const fiftyCoverage = Math.min(pool[50], fiftyEligibleOddTenCount);

  const minOnes = targets.reduce((sum, target) => sum + (target.amount % 5), 0) + Math.max(0, closerCount - 1);
  const minOneFiveValue = targets.reduce((sum, target) => sum + (target.amount % 10), 0);
  const minOneFiveTenRaw = targets.reduce((sum, target) => sum + (target.amount % 20), 0);
  const minOneFiveTenValue = Math.max(minOneFiveValue, minOneFiveTenRaw - fiftyCoverage * 10);

  const availableOnes = pool[1];
  const availableOneFiveValue = availableOnes + pool[5] * 5;
  const availableOneFiveTenValue = availableOneFiveValue + pool[10] * 10;

  return {
    minOnes,
    availableOnes,
    onesShort: Math.max(0, minOnes - availableOnes),
    minOneFiveValue,
    availableOneFiveValue,
    oneFiveShort: Math.max(0, minOneFiveValue - availableOneFiveValue),
    minOneFiveTenValue,
    availableOneFiveTenValue,
    oneFiveTenShort: Math.max(0, minOneFiveTenValue - availableOneFiveTenValue),
    oddTenCount: oddTenTargets.length,
    fiftyEligibleOddTenCount,
    fiftyCoverage,
    fiftyCoverageValue: fiftyCoverage * 10,
  };
}

export function smallBillStatus(requirements: SmallBillRequirements): 'covered' | 'short' {
  return requirements.onesShort || requirements.oneFiveShort || requirements.oneFiveTenShort ? 'short' : 'covered';
}

export function parsedKeepTargets(requirements: SmallBillRequirements): { ones: number; fives: number; tens: number } {
  const oneFiveGap = Math.max(0, requirements.minOneFiveValue - requirements.minOnes);
  const oneFiveTenGap = Math.max(0, requirements.minOneFiveTenValue - requirements.minOneFiveValue);

  return {
    ones: requirements.minOnes,
    fives: Math.ceil(oneFiveGap / 5),
    tens: Math.ceil(oneFiveTenGap / 10),
  };
}
