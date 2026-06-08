import React from 'react';

/**
 * TipPool MoneyValue — the canonical way to show a dollar figure: mono,
 * tabular, gold, with an optional uppercase eyebrow above it. Zero amounts
 * render muted. `size` maps onto the type scale.
 */
export function MoneyValue({ amount, label = null, size = 'xl', bright = false, style = {} }) {
  const sizes = {
    sm: '0.84rem', md: '1.05rem', lg: '1.22rem', xl: '1.4rem', '2xl': '1.65rem', hero: '2.5rem',
  };
  const isZero = !amount || Number(amount) === 0;
  const formatted = typeof amount === 'number'
    ? '$' + amount.toLocaleString('en-US')
    : amount;

  return (
    <div style={{ ...style }}>
      {label ? (
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.5rem',
          fontWeight: 700,
          letterSpacing: '1.4px',
          textTransform: 'uppercase',
          color: 'var(--muted)',
          marginBottom: '5px',
        }}>{label}</div>
      ) : null}
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: sizes[size],
        fontWeight: 800,
        lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
        color: isZero ? 'var(--muted-2)' : (bright ? 'var(--gold-2)' : 'var(--gold)'),
      }}>{formatted}</div>
    </div>
  );
}
