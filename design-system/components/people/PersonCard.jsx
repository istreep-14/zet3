import React from 'react';
import { Badge } from '../core/Badge.jsx';

/**
 * TipPool PersonCard — a per-person payout row from the Summary tab. Avatar
 * with initials, name + optional closer badge, an hours block (gold-2 value
 * over the in/out times), and the payout column (gold) with a base/bonus
 * sub-line. Tapping opens the person profile (pass onClick).
 */
function initials(name) {
  return (name || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

export function PersonCard({
  name,
  hours,
  inTime = null,
  outTime = null,
  payout,
  basePay = null,
  bonus = null,
  isCloser = false,
  onClick = null,
  style = {},
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color var(--dur) var(--ease), background var(--dur) var(--ease)',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '10px 11px' }}>
        {/* Avatar */}
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'var(--surface-3)', border: '1px solid var(--border-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-2)', flexShrink: 0,
          fontFamily: 'var(--font-mono)',
        }}>{initials(name)}</div>

        {/* Name */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>{name}</span>
            {isCloser ? <Badge variant="closer">Closer</Badge> : null}
          </div>
        </div>

        {/* Hours */}
        <div style={{ textAlign: 'right', flexShrink: 0, width: 74, fontVariantNumeric: 'tabular-nums' }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--gold-2)', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{hours}h</div>
          {inTime && outTime ? (
            <div style={{ fontSize: '0.54rem', color: 'var(--text-2)', fontFamily: 'var(--font-mono)', marginTop: '2px', whiteSpace: 'nowrap' }}>{inTime}–{outTime}</div>
          ) : null}
        </div>

        {/* Payout */}
        <div style={{ textAlign: 'right', flexShrink: 0, width: 62, fontVariantNumeric: 'tabular-nums' }}>
          <div style={{ fontSize: '1.22rem', fontWeight: 800, color: 'var(--gold)', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>${payout}</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', marginTop: '2px', minHeight: 14 }}>
            {bonus ? (
              <Badge variant="bonus" pill>+${bonus}</Badge>
            ) : basePay != null ? (
              <span style={{ fontSize: '0.58rem', color: 'var(--muted-2)', fontFamily: 'var(--font-mono)' }}>${basePay}</span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
