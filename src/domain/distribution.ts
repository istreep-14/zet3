import { DENOMS, type BillCounts, type DistributionSlot } from './types';
import { blankBills, hasNegativeBillCount, poolValue, subtractBills } from './money';

interface TargetSlot {
  id: string;
  name: string;
  target: number;
  isChump?: boolean;
}

export function distributeTargets(targets: TargetSlot[], pool: BillCounts): { ok: boolean; error: string; slots: DistributionSlot[] } {
  const totalTarget = targets.reduce((sum, target) => sum + target.target, 0);
  if (poolValue(pool) < totalTarget) {
    return { ok: false, error: `Cash on hand is short $${totalTarget - poolValue(pool)}.`, slots: [] };
  }

  const allocations = findChartAllocation(targets, pool);
  if (!allocations) {
    return {
      ok: false,
      error: 'Exact bill chart is blocked. Check small-bill coverage or break larger bills.',
      slots: [],
    };
  }

  return {
    ok: true,
    error: '',
    slots: targets.map((target) => ({
      id: target.id,
      name: target.name,
      target: target.target,
      isChump: Boolean(target.isChump),
      bills: allocations.get(target.id) ?? blankBills(),
    })),
  };
}

function findChartAllocation(targets: TargetSlot[], pool: BillCounts): Map<string, BillCounts> | null {
  const orderedTargets = [...targets].sort((a, b) => {
    if (a.target !== b.target) return b.target - a.target;
    return a.name.localeCompare(b.name);
  });
  const failedStates = new Set<string>();

  function search(index: number, remainingPool: BillCounts): Map<string, BillCounts> | null {
    if (index >= orderedTargets.length) return new Map();

    const stateKey = `${index}|${poolSignature(remainingPool)}`;
    if (failedStates.has(stateKey)) return null;

    const target = orderedTargets[index];
    const candidates = findBillCandidatesForTarget(target.target, remainingPool);

    for (const candidate of candidates) {
      const nextPool = subtractBills(remainingPool, candidate);
      if (hasNegativeBillCount(nextPool)) continue;

      const rest = search(index + 1, nextPool);
      if (rest) {
        const result = new Map(rest);
        result.set(target.id, candidate);
        return result;
      }
    }

    failedStates.add(stateKey);
    return null;
  }

  return search(0, { ...pool });
}

function findBillCandidatesForTarget(target: number, pool: BillCounts): BillCounts[] {
  const candidates: BillCounts[] = [];

  function materialize(index: number, remaining: number, current: BillCounts): void {
    if (remaining === 0) {
      candidates.push({ ...current });
      return;
    }
    if (remaining < 0 || index >= DENOMS.length) return;

    const denom = DENOMS[index];
    const maxCount = Math.min(pool[denom], Math.floor(remaining / denom));
    for (let count = maxCount; count >= 0; count -= 1) {
      current[denom] = count;
      materialize(index + 1, remaining - count * denom, current);
      current[denom] = 0;
    }
  }

  materialize(0, target, blankBills());
  return candidates
    .map((candidate) => ({ ...blankBills(), ...candidate }))
    .sort((a, b) => scoreCandidate(target, a) - scoreCandidate(target, b));
}

function scoreCandidate(target: number, bills: BillCounts): number {
  const billCount = DENOMS.reduce((sum, denom) => sum + bills[denom], 0);
  const highValue = bills[100] * 100 + bills[50] * 50;
  const idealHighValue = Math.floor(target / 100) * 100;
  const smallCount = bills[1] + bills[5] + bills[10];

  return billCount * 8 + Math.abs(highValue - idealHighValue) + smallCount * 2;
}

function poolSignature(pool: BillCounts): string {
  return DENOMS.map((denom) => pool[denom]).join(',');
}
