import { DENOMS, type BillCounts, type Denomination } from './types';

export function blankBills(): BillCounts {
  return { 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 0 };
}

export function parseWholeNumber(raw: string | number | null | undefined): { valid: boolean; value: number } {
  const text = String(raw ?? '').trim();
  if (!text) return { valid: true, value: 0 };
  if (!/^\d+$/.test(text)) return { valid: false, value: 0 };
  const value = Number(text);
  return { valid: Number.isSafeInteger(value), value: Number.isSafeInteger(value) ? value : 0 };
}

export function normalizeBillCounts(counts: Partial<Record<Denomination, string | number>>): BillCounts {
  return DENOMS.reduce((next, denom) => {
    const parsed = parseWholeNumber(counts[denom]);
    next[denom] = parsed.valid ? parsed.value : 0;
    return next;
  }, blankBills());
}

export function poolValue(pool: BillCounts): number {
  return DENOMS.reduce((sum, denom) => sum + pool[denom] * denom, 0);
}

export function addBills(a: BillCounts, b: BillCounts): BillCounts {
  return DENOMS.reduce((next, denom) => {
    next[denom] = a[denom] + b[denom];
    return next;
  }, blankBills());
}

export function subtractBills(a: BillCounts, b: BillCounts): BillCounts {
  return DENOMS.reduce((next, denom) => {
    next[denom] = a[denom] - b[denom];
    return next;
  }, blankBills());
}

export function hasNegativeBillCount(pool: BillCounts): boolean {
  return DENOMS.some((denom) => pool[denom] < 0);
}

export function formatMoney(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

export function billLabel(bills: BillCounts): string {
  const parts = DENOMS
    .filter((denom) => bills[denom] > 0)
    .map((denom) => `${bills[denom]} x $${denom}`);
  return parts.length ? parts.join(', ') : 'No bills';
}
