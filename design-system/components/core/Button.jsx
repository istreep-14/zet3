import React from 'react';

/**
 * TipPool Button — mono-label, uppercase, with a tactile press state.
 * Variants: accent (red, primary action), gold (money/confirm), secondary
 * (raised surface), ghost (bare), danger (destructive), dashed (add-row).
 */
export function Button({
  children,
  variant = 'secondary',
  size = 'md',
  icon = null,
  disabled = false,
  fullWidth = false,
  style = {},
  ...rest
}) {
  const sizes = {
    sm: { padding: '7px 11px', fontSize: '0.6rem' },
    md: { padding: '9px 14px', fontSize: '0.7rem' },
    lg: { padding: '12px 18px', fontSize: '0.8rem' },
  };

  const variants = {
    accent: { background: 'var(--accent)', color: '#1a0608', border: '1px solid var(--accent)' },
    gold: { background: 'var(--gold)', color: '#1a1508', border: '1px solid var(--gold)' },
    secondary: { background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border-2)' },
    ghost: { background: 'transparent', color: 'var(--muted)', border: '1px solid transparent' },
    danger: { background: '#2a1018', color: 'var(--accent-2)', border: '1px solid var(--accent)' },
    dashed: { background: 'transparent', color: 'var(--muted)', border: '1px dashed var(--border-2)' },
  };

  return (
    <button
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '7px',
        width: fullWidth ? '100%' : 'auto',
        borderRadius: 'var(--radius-sm)',
        fontFamily: 'var(--font-mono)',
        fontWeight: 700,
        letterSpacing: '0.6px',
        textTransform: 'uppercase',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'filter var(--dur) var(--ease), transform var(--dur) var(--ease)',
        ...sizes[size],
        ...variants[variant],
        ...style,
      }}
      onMouseDown={(e) => { if (!disabled) e.currentTarget.style.transform = 'scale(0.97)'; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      {...rest}
    >
      {icon ? <span style={{ display: 'inline-flex', width: 14, height: 14 }}>{icon}</span> : null}
      {children}
    </button>
  );
}
