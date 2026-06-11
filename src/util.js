// Shared primitives — no DOM access.

export const DENOMS = [100, 50, 20, 10, 5, 1];

export function parseWholeNumber(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return { valid: true, empty: true, value: 0 };
  if (!/^\d+$/.test(text)) return { valid: false, empty: false, value: 0 };
  const value = Number(text);
  return {
    valid: Number.isSafeInteger(value),
    empty: false,
    value: Number.isSafeInteger(value) ? value : 0,
  };
}

export function blankBills() {
  return { 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 0 };
}

export function poolValue(pool) {
  return DENOMS.reduce((s, d) => s + (pool?.[d] || 0) * d, 0);
}

export function escapeHTML(v) {
  return String(v).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
  )[c]);
}

export function fmtHrs(h) {
  return parseFloat(h.toFixed(2)).toString();
}
