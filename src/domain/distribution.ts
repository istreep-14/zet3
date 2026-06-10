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

  let remainingPool = { ...pool };
  const allocations = new Map<string, BillCounts>();
  const largestFirst = [...targets].sort((a, b) => b.target - a.target);

  for (const target of largestFirst) {
    const bills = findBillsForTarget(target.target, remainingPool);
    if (!bills) {
      return {
        ok: false,
        error: `Exact bill chart is blocked for ${target.name}. Check small-bill coverage or break larger bills.`,
        slots: [],
      };
    }
    remainingPool = subtractBills(remainingPool, bills);
    if (hasNegativeBillCount(remainingPool)) {
      return { ok: false, error: 'Bill chart used more bills than cash on hand.', slots: [] };
    }
    allocations.set(target.id, bills);
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

function findBillsForTarget(target: number, pool: BillCounts): BillCounts | null {
  const memo = new Map<string, BillCounts | null>();

  function search(index: number, remaining: number): BillCounts | null {
    if (remaining === 0) return blankBills();
    if (remaining < 0 || index >= DENOMS.length) return null;

    const denom = DENOMS[index];
    const key = `${index}:${remaining}`;
    if (memo.has(key)) return memo.get(key) ?? null;

    const maxCount = Math.min(pool[denom], Math.floor(remaining / denom));
    for (let count = maxCount; count >= 0; count -= 1) {
      const rest = search(index + 1, remaining - count * denom);
      if (rest) {
        rest[denom] = count;
        memo.set(key, rest);
        return rest;
      }
    }

    memo.set(key, null);
    return null;
  }

  const result = search(0, target);
  return result ? { ...blankBills(), ...result } : null;
}
