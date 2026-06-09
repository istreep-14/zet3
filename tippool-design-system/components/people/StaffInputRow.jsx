import React from 'react';
import { Badge } from '../core/Badge.jsx';

/**
 * TipPool StaffInputRow — the compact row used to enter staff names and
 * shift times. It separates human text (sans name input) from numeric fields
 * (mono time wells and hours), and can show closer/support cut states.
 */
export function StaffInputRow({
  name = '',
  inTime = '',
  outTime = '',
  hours = null,
  role = 'bartender',
  isCloser = false,
  supportCuts = [],
  error = false,
  onNameChange = () => {},
  onInTimeChange = () => {},
  onOutTimeChange = () => {},
  onToggleCloser = null,
  onDelete = null,
  style = {},
}) {
  const roleVariant = role === 'server' ? 'server' : role === 'support' ? 'support' : 'bartender';
  const hoursText = hours == null || hours === '' ? '-' : `${hours}h`;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 48px 48px 42px',
        alignItems: 'center',
        gap: 5,
        padding: 6,
        background: 'var(--surface)',
        border: `1px solid ${error ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
        position: 'relative',
        ...style,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Employee"
            style={{
              width: '100%',
              minWidth: 0,
              background: 'transparent',
              border: 0,
              outline: 'none',
              color: 'var(--text)',
              fontFamily: 'var(--font-sans)',
              fontSize: '0.9rem',
              fontWeight: 800,
              padding: '1px 2px 0',
            }}
          />
          {role ? <Badge variant={roleVariant}>{role}</Badge> : null}
          {isCloser ? <Badge variant="closer">Closer</Badge> : null}
        </div>
        <div style={{
          color: error ? 'var(--accent)' : 'var(--muted)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.48rem',
          fontWeight: 700,
          marginTop: 2,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {error ? 'Check shift times' : 'Add times to calculate hours'}
        </div>
      </div>

      <TimeField label="In" value={inTime} onChange={onInTimeChange} />
      <TimeField label="Out" value={outTime} onChange={onOutTimeChange} />

      <div style={{
        minHeight: 38,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        color: error ? 'var(--accent)' : hours ? 'var(--gold-2)' : 'var(--muted)',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.84rem',
        fontWeight: 800,
        fontVariantNumeric: 'tabular-nums',
      }}>{hoursText}</div>

      {supportCuts.length ? (
        <div style={{
          gridColumn: '1 / -1',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          paddingTop: 6,
          borderTop: '1px solid var(--border)',
        }}>
          {supportCuts.map((cut) => (
            <Badge key={cut} variant="support">{cut}</Badge>
          ))}
        </div>
      ) : null}

      {onToggleCloser ? (
        <button
          type="button"
          onClick={onToggleCloser}
          style={{
            gridColumn: '1 / -1',
            justifySelf: 'start',
            background: isCloser ? '#1a0608' : 'transparent',
            border: `1px solid ${isCloser ? 'var(--accent)' : 'var(--border-2)'}`,
            color: isCloser ? 'var(--accent)' : 'var(--muted)',
            borderRadius: 'var(--radius-chip)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.48rem',
            fontWeight: 700,
            letterSpacing: '0.7px',
            textTransform: 'uppercase',
            padding: '2px 6px',
            cursor: 'pointer',
          }}
        >
          Closer
        </button>
      ) : null}

      {onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          style={{
            position: 'absolute',
            right: 10,
            top: 10,
            bottom: 10,
            background: '#2a1018',
            border: '1px solid var(--accent)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--accent-2)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.62rem',
            fontWeight: 800,
            letterSpacing: '0.6px',
            textTransform: 'uppercase',
            padding: '0 12px',
            cursor: 'pointer',
          }}
        >
          Delete
        </button>
      ) : null}
    </div>
  );
}

function TimeField({ label, value, onChange }) {
  return (
    <label style={{
      minHeight: 38,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      background: 'var(--surface-input)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
    }}>
      <span style={{
        color: 'var(--muted-2)',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.42rem',
        letterSpacing: '0.5px',
        lineHeight: 1,
        paddingTop: 4,
        textTransform: 'uppercase',
      }}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        placeholder="-"
        style={{
          flex: 1,
          width: '100%',
          background: 'transparent',
          border: 0,
          outline: 'none',
          color: 'var(--text)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.86rem',
          fontWeight: 800,
          textAlign: 'center',
          padding: '1px 2px 4px',
          fontVariantNumeric: 'tabular-nums',
        }}
      />
    </label>
  );
}
