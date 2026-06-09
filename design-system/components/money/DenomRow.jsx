import React from 'react';

/**
 * TipPool DenomRow — a single denomination row from the cash-entry screen.
 * A gold denomination label on a raised cap, a big centered count input, and
 * a right-aligned subtotal cap. Focus tints the border gold. Used stacked in
 * the per-bill cash counter.
 */
export function DenomRow({ denom, count = '', subtotal = null, onCountChange = () => {}, style = {} }) {
  const isZero = !count || Number(count) === 0;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        transition: 'border-color var(--dur) var(--ease)',
        ...style,
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--gold-dim)'; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
    >
      <div style={{
        width: '50px',
        flexShrink: 0,
        textAlign: 'center',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.92rem',
        fontWeight: 800,
        color: 'var(--gold)',
        borderRight: '1px solid var(--border)',
        padding: '11px 6px',
        background: 'var(--surface-2)',
      }}>${denom}</div>
      <input
        type="number"
        inputMode="numeric"
        min="0"
        step="1"
        placeholder="0"
        value={count}
        onChange={(e) => onCountChange(e.target.value)}
        style={{
          flex: 1,
          background: 'transparent',
          border: 'none',
          color: 'var(--text)',
          textAlign: 'center',
          padding: '11px 8px',
          fontSize: '1.35rem',
          fontWeight: 700,
          outline: 'none',
          fontFamily: 'var(--font-mono)',
          minWidth: 0,
        }}
      />
      <div style={{
        width: '62px',
        flexShrink: 0,
        textAlign: 'right',
        padding: '11px 10px',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.8rem',
        fontWeight: 700,
        color: isZero ? 'var(--muted-2)' : 'var(--text-2)',
        borderLeft: '1px solid var(--border)',
        background: 'var(--surface-2)',
      }}>{subtotal == null ? '—' : (isZero ? '—' : subtotal)}</div>
    </div>
  );
}
