import React from 'react';
import { Button } from '../core/Button.jsx';
import { MoneyValue } from '../money/MoneyValue.jsx';

/**
 * TipPool DayPoolCashCard — the day-shift cash accordion. It keeps the pool
 * total visible in the header, opens into either a net-total input or custom
 * children, and gives optional party pools their start/end window fields.
 */
export function DayPoolCashCard({
  label,
  subtitle,
  total = 0,
  isOpen = false,
  optional = false,
  windowStart = '',
  windowEnd = '',
  netTotal = '',
  supportTipOut = null,
  onToggle = () => {},
  onWindowStartChange = () => {},
  onWindowEndChange = () => {},
  onNetTotalChange = () => {},
  onRemove = null,
  onSupportTipOut = null,
  children = null,
  style = {},
}) {
  const headerSubtitle = optional
    ? `${windowStart || '?'} - ${windowEnd || '?'}`
    : subtitle;

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
        ...style,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '10px 12px',
          background: 'var(--surface-2)',
          border: 0,
          borderBottom: isOpen ? '1px solid var(--border)' : 0,
          color: 'inherit',
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            display: 'block',
            color: 'var(--text-2)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.64rem',
            fontWeight: 700,
            letterSpacing: '1px',
            textTransform: 'uppercase',
            marginBottom: 4,
          }}>{label}</span>
          {headerSubtitle ? (
            <span style={{
              color: 'var(--muted)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.56rem',
              lineHeight: 1.4,
            }}>{headerSubtitle}</span>
          ) : null}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <MoneyValue amount={total} size="lg" />
          <span style={{
            color: 'var(--muted)',
            fontSize: '0.9rem',
            transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform var(--dur) var(--ease)',
          }}>›</span>
        </div>
      </button>

      {isOpen ? (
        <div style={{ padding: optional ? '8px' : 0 }}>
          {optional ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
              <WindowInput label="Start" value={windowStart} onChange={onWindowStartChange} />
              <span style={{ color: 'var(--muted-2)', fontFamily: 'var(--font-mono)' }}>-</span>
              <WindowInput label="End" value={windowEnd} onChange={onWindowEndChange} />
              {onRemove ? (
                <button
                  type="button"
                  onClick={onRemove}
                  style={{
                    background: 'transparent',
                    border: '1px solid transparent',
                    color: 'var(--muted)',
                    borderRadius: 'var(--radius-chip)',
                    cursor: 'pointer',
                    padding: '5px 7px',
                  }}
                >x</button>
              ) : null}
            </div>
          ) : null}

          {children || (
            <div style={{ display: 'flex', alignItems: 'center', padding: '4px 8px' }}>
              <span style={{
                color: 'var(--gold)',
                fontFamily: 'var(--font-mono)',
                fontSize: '1.5rem',
                fontWeight: 800,
                padding: '0 10px 0 4px',
              }}>$</span>
              <input
                value={netTotal}
                onChange={(e) => onNetTotalChange(e.target.value)}
                inputMode="numeric"
                placeholder="0"
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: 'transparent',
                  border: 0,
                  outline: 'none',
                  color: 'var(--text)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '1.7rem',
                  fontWeight: 700,
                  padding: '12px 0',
                  fontVariantNumeric: 'tabular-nums',
                }}
              />
            </div>
          )}

          {onSupportTipOut ? (
            <Button
              variant="dashed"
              size="sm"
              fullWidth
              onClick={onSupportTipOut}
              style={{
                marginTop: 6,
                color: supportTipOut ? 'var(--role-support)' : 'var(--muted)',
                borderColor: supportTipOut ? 'var(--role-support-border)' : 'var(--border-2)',
              }}
            >
              {supportTipOut ? `Support Tip-Out · $${supportTipOut} out` : 'Support Tip-Out'}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function WindowInput({ label, value, onChange }) {
  return (
    <label style={{
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      flex: 1,
      minWidth: 0,
      background: 'var(--surface)',
      border: '1px solid var(--border-2)',
      borderRadius: 6,
      padding: '4px 8px',
    }}>
      <span style={{
        color: 'var(--muted)',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.46rem',
        fontWeight: 700,
        letterSpacing: '0.8px',
        textTransform: 'uppercase',
      }}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        placeholder="--"
        style={{
          flex: 1,
          minWidth: 0,
          width: 40,
          background: 'transparent',
          border: 0,
          outline: 'none',
          color: 'var(--text)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.82rem',
          fontWeight: 700,
          textAlign: 'center',
          fontVariantNumeric: 'tabular-nums',
        }}
      />
    </label>
  );
}
