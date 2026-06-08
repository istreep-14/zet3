import React from 'react';

/**
 * TipPool Badge — tiny uppercase mono labels. Covers role tags (bartender /
 * server / support), the closer marker, neutral tags, and the green bonus
 * pill. `pill` makes it fully rounded (used for "+$24" closer bonuses).
 */
export function Badge({ children, variant = 'neutral', pill = false, style = {}, ...rest }) {
  const variants = {
    neutral: { color: 'var(--muted)', borderColor: 'var(--border-2)', background: 'transparent' },
    bartender: { color: 'var(--role-bartender)', borderColor: 'var(--role-bartender-border)', background: 'var(--role-bartender-bg)' },
    server: { color: 'var(--role-server)', borderColor: 'var(--role-server-border)', background: 'var(--role-server-bg)' },
    support: { color: 'var(--role-support)', borderColor: 'var(--role-support-border)', background: 'var(--role-support-bg)' },
    closer: { color: 'var(--accent)', borderColor: 'var(--accent)', background: '#1a0608' },
    bonus: { color: 'var(--green)', borderColor: 'var(--green-border)', background: 'var(--green-bg)' },
  };

  const v = variants[variant] || variants.neutral;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.48rem',
        fontWeight: 700,
        letterSpacing: '0.7px',
        textTransform: 'uppercase',
        lineHeight: 1.4,
        padding: pill ? '1px 6px' : '1px 4px',
        borderRadius: pill ? 'var(--radius-pill)' : 'var(--radius-chip)',
        border: '1px solid',
        color: v.color,
        borderColor: v.borderColor,
        background: v.background,
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
