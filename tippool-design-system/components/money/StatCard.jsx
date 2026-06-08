import React from 'react';

/**
 * TipPool StatCard — the tappable metric tile from the home dashboard
 * ("Cash on Hand", "Staff"). Card surface with the signature top-left sheen,
 * an uppercase eyebrow, a big value, and a small sub-line. A `›` chevron in
 * the corner signals it navigates. `tone` colors the value (gold for money,
 * text for counts).
 */
export function StatCard({ label, value, sub = null, tone = 'money', onClick = null, style = {} }) {
  const valueColor = tone === 'money' ? 'var(--gold)' : 'var(--text)';
  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '10px 12px',
        minHeight: '68px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color var(--dur) var(--ease), background var(--dur) var(--ease)',
        ...style,
      }}
    >
      <div style={{ position: 'absolute', inset: 0, background: 'var(--sheen)', pointerEvents: 'none' }} />
      {onClick ? (
        <span style={{ position: 'absolute', top: 7, right: 9, fontSize: '0.65rem', color: 'var(--accent)', fontWeight: 700 }}>›</span>
      ) : null}
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '0.5rem',
        fontWeight: 700,
        letterSpacing: '1.4px',
        textTransform: 'uppercase',
        color: 'var(--muted)',
        marginBottom: '3px',
      }}>{label}</div>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '1.4rem',
        fontWeight: 800,
        lineHeight: 1,
        color: valueColor,
        fontVariantNumeric: 'tabular-nums',
      }}>{value}</div>
      {sub ? (
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.58rem',
          color: 'var(--muted)',
          marginTop: '2px',
        }}>{sub}</div>
      ) : null}
    </div>
  );
}
