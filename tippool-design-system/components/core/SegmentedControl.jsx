import React from 'react';

/**
 * TipPool SegmentedControl — the toggle pattern used for shift mode, staff
 * role, and cash-entry mode. Options are uppercase mono labels; the active
 * segment lifts onto a raised surface with an optional accent color. An
 * optional `accentMap` tints the active label per option (e.g. role colors).
 */
export function SegmentedControl({
  options,
  value,
  onChange = () => {},
  accentMap = null,
  style = {},
}) {
  return (
    <div
      style={{
        display: 'flex',
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: '3px',
        gap: '3px',
        ...style,
      }}
    >
      {options.map((opt) => {
        const val = typeof opt === 'string' ? opt : opt.value;
        const label = typeof opt === 'string' ? opt : opt.label;
        const active = val === value;
        const accent = accentMap && accentMap[val];
        return (
          <button
            key={val}
            onClick={() => onChange(val)}
            style={{
              flex: 1,
              background: active ? 'var(--surface-3)' : 'none',
              border: active ? '1px solid var(--border-2)' : '1px solid transparent',
              borderColor: active && accent ? accent.border : (active ? 'var(--border-2)' : 'transparent'),
              color: active ? (accent ? accent.color : 'var(--text)') : 'var(--muted)',
              padding: '8px 6px',
              borderRadius: '7px',
              cursor: 'pointer',
              fontSize: '0.64rem',
              fontWeight: 700,
              letterSpacing: '0.6px',
              textTransform: 'uppercase',
              fontFamily: 'var(--font-mono)',
              transition: 'all var(--dur) var(--ease)',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
