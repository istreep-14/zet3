export interface ParsedTime {
  valid: boolean;
  empty: boolean;
  value: number | null;
}

export function parseTimeInput(raw: string | null | undefined): ParsedTime {
  const text = String(raw ?? '').trim();
  if (!text) return { valid: true, empty: true, value: null };
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(text)) return { valid: false, empty: false, value: null };

  const value = Number(text);
  const quarterHours = value * 4;
  const inRange = Number.isFinite(value) && value >= 0 && value < 13;
  const onQuarter = Number.isInteger(Math.round(quarterHours * 1000000) / 1000000);

  return {
    valid: inRange && onQuarter,
    empty: false,
    value: inRange && onQuarter ? value : null,
  };
}

export function effectiveOutValue(inValue: number, outValue: number): number {
  return outValue <= inValue ? outValue + 12 : outValue;
}

export function shiftHours(inValue: number, outValue: number): number {
  return effectiveOutValue(inValue, outValue) - inValue;
}

export function formatHours(hours: number): string {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

export function formatClock(value: number, period: 'pm' | 'am' = 'pm'): string {
  let hour = Math.floor(value);
  let minutes = Math.round((value - hour) * 60);
  if (minutes === 60) {
    hour += 1;
    minutes = 0;
  }
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const suffix = period === 'am' ? ' AM' : ' PM';
  return `${hour12}:${String(minutes).padStart(2, '0')}${suffix}`;
}
