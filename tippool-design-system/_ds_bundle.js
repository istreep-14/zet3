/* @ds-bundle: {"format":3,"namespace":"TipPoolDesignSystem_bcb6c4","components":[{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"SegmentedControl","sourcePath":"components/core/SegmentedControl.jsx"},{"name":"DenomRow","sourcePath":"components/money/DenomRow.jsx"},{"name":"MoneyValue","sourcePath":"components/money/MoneyValue.jsx"},{"name":"StatCard","sourcePath":"components/money/StatCard.jsx"},{"name":"PersonCard","sourcePath":"components/people/PersonCard.jsx"}],"sourceHashes":{"components/core/Badge.jsx":"2cbc31b15b6b","components/core/Button.jsx":"21deac1195e5","components/core/SegmentedControl.jsx":"6c8369ca7e3e","components/money/DenomRow.jsx":"67526676472f","components/money/MoneyValue.jsx":"49e6d742e853","components/money/StatCard.jsx":"77a12d9ac44c","components/people/PersonCard.jsx":"81714643d083"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.TipPoolDesignSystem_bcb6c4 = window.TipPoolDesignSystem_bcb6c4 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * TipPool Badge — tiny uppercase mono labels. Covers role tags (bartender /
 * server / support), the closer marker, neutral tags, and the green bonus
 * pill. `pill` makes it fully rounded (used for "+$24" closer bonuses).
 */
function Badge({
  children,
  variant = 'neutral',
  pill = false,
  style = {},
  ...rest
}) {
  const variants = {
    neutral: {
      color: 'var(--muted)',
      borderColor: 'var(--border-2)',
      background: 'transparent'
    },
    bartender: {
      color: 'var(--role-bartender)',
      borderColor: 'var(--role-bartender-border)',
      background: 'var(--role-bartender-bg)'
    },
    server: {
      color: 'var(--role-server)',
      borderColor: 'var(--role-server-border)',
      background: 'var(--role-server-bg)'
    },
    support: {
      color: 'var(--role-support)',
      borderColor: 'var(--role-support-border)',
      background: 'var(--role-support-bg)'
    },
    closer: {
      color: 'var(--accent)',
      borderColor: 'var(--accent)',
      background: '#1a0608'
    },
    bonus: {
      color: 'var(--green)',
      borderColor: 'var(--green-border)',
      background: 'var(--green-bg)'
    }
  };
  const v = variants[variant] || variants.neutral;
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
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
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * TipPool Button — mono-label, uppercase, with a tactile press state.
 * Variants: accent (red, primary action), gold (money/confirm), secondary
 * (raised surface), ghost (bare), danger (destructive), dashed (add-row).
 */
function Button({
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
    sm: {
      padding: '7px 11px',
      fontSize: '0.6rem'
    },
    md: {
      padding: '9px 14px',
      fontSize: '0.7rem'
    },
    lg: {
      padding: '12px 18px',
      fontSize: '0.8rem'
    }
  };
  const variants = {
    accent: {
      background: 'var(--accent)',
      color: '#1a0608',
      border: '1px solid var(--accent)'
    },
    gold: {
      background: 'var(--gold)',
      color: '#1a1508',
      border: '1px solid var(--gold)'
    },
    secondary: {
      background: 'var(--surface-2)',
      color: 'var(--text)',
      border: '1px solid var(--border-2)'
    },
    ghost: {
      background: 'transparent',
      color: 'var(--muted)',
      border: '1px solid transparent'
    },
    danger: {
      background: '#2a1018',
      color: 'var(--accent-2)',
      border: '1px solid var(--accent)'
    },
    dashed: {
      background: 'transparent',
      color: 'var(--muted)',
      border: '1px dashed var(--border-2)'
    }
  };
  return /*#__PURE__*/React.createElement("button", _extends({
    disabled: disabled,
    style: {
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
      ...style
    },
    onMouseDown: e => {
      if (!disabled) e.currentTarget.style.transform = 'scale(0.97)';
    },
    onMouseUp: e => {
      e.currentTarget.style.transform = 'scale(1)';
    },
    onMouseLeave: e => {
      e.currentTarget.style.transform = 'scale(1)';
    }
  }, rest), icon ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      width: 14,
      height: 14
    }
  }, icon) : null, children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/SegmentedControl.jsx
try { (() => {
/**
 * TipPool SegmentedControl — the toggle pattern used for shift mode, staff
 * role, and cash-entry mode. Options are uppercase mono labels; the active
 * segment lifts onto a raised surface with an optional accent color. An
 * optional `accentMap` tints the active label per option (e.g. role colors).
 */
function SegmentedControl({
  options,
  value,
  onChange = () => {},
  accentMap = null,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      background: 'var(--surface-2)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
      padding: '3px',
      gap: '3px',
      ...style
    }
  }, options.map(opt => {
    const val = typeof opt === 'string' ? opt : opt.value;
    const label = typeof opt === 'string' ? opt : opt.label;
    const active = val === value;
    const accent = accentMap && accentMap[val];
    return /*#__PURE__*/React.createElement("button", {
      key: val,
      onClick: () => onChange(val),
      style: {
        flex: 1,
        background: active ? 'var(--surface-3)' : 'none',
        border: active ? '1px solid var(--border-2)' : '1px solid transparent',
        borderColor: active && accent ? accent.border : active ? 'var(--border-2)' : 'transparent',
        color: active ? accent ? accent.color : 'var(--text)' : 'var(--muted)',
        padding: '8px 6px',
        borderRadius: '7px',
        cursor: 'pointer',
        fontSize: '0.64rem',
        fontWeight: 700,
        letterSpacing: '0.6px',
        textTransform: 'uppercase',
        fontFamily: 'var(--font-mono)',
        transition: 'all var(--dur) var(--ease)'
      }
    }, label);
  }));
}
Object.assign(__ds_scope, { SegmentedControl });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/SegmentedControl.jsx", error: String((e && e.message) || e) }); }

// components/money/DenomRow.jsx
try { (() => {
/**
 * TipPool DenomRow — a single denomination row from the cash-entry screen.
 * A gold denomination label on a raised cap, a big centered count input, and
 * a right-aligned subtotal cap. Focus tints the border gold. Used stacked in
 * the per-bill cash counter.
 */
function DenomRow({
  denom,
  count = '',
  subtotal = null,
  onCountChange = () => {},
  style = {}
}) {
  const isZero = !count || Number(count) === 0;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      overflow: 'hidden',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
      transition: 'border-color var(--dur) var(--ease)',
      ...style
    },
    onFocus: e => {
      e.currentTarget.style.borderColor = 'var(--gold-dim)';
    },
    onBlur: e => {
      e.currentTarget.style.borderColor = 'var(--border)';
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '50px',
      flexShrink: 0,
      textAlign: 'center',
      fontFamily: 'var(--font-mono)',
      fontSize: '0.92rem',
      fontWeight: 800,
      color: 'var(--gold)',
      borderRight: '1px solid var(--border)',
      padding: '11px 6px',
      background: 'var(--surface-2)'
    }
  }, "$", denom), /*#__PURE__*/React.createElement("input", {
    type: "number",
    inputMode: "numeric",
    min: "0",
    step: "1",
    placeholder: "0",
    value: count,
    onChange: e => onCountChange(e.target.value),
    style: {
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
      minWidth: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      width: '62px',
      flexShrink: 0,
      textAlign: 'right',
      padding: '11px 10px',
      fontFamily: 'var(--font-mono)',
      fontSize: '0.8rem',
      fontWeight: 700,
      color: isZero ? 'var(--muted-2)' : 'var(--text-2)',
      borderLeft: '1px solid var(--border)',
      background: 'var(--surface-2)'
    }
  }, subtotal == null ? '—' : isZero ? '—' : subtotal));
}
Object.assign(__ds_scope, { DenomRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/money/DenomRow.jsx", error: String((e && e.message) || e) }); }

// components/money/MoneyValue.jsx
try { (() => {
/**
 * TipPool MoneyValue — the canonical way to show a dollar figure: mono,
 * tabular, gold, with an optional uppercase eyebrow above it. Zero amounts
 * render muted. `size` maps onto the type scale.
 */
function MoneyValue({
  amount,
  label = null,
  size = 'xl',
  bright = false,
  style = {}
}) {
  const sizes = {
    sm: '0.84rem',
    md: '1.05rem',
    lg: '1.22rem',
    xl: '1.4rem',
    '2xl': '1.65rem',
    hero: '2.5rem'
  };
  const isZero = !amount || Number(amount) === 0;
  const formatted = typeof amount === 'number' ? '$' + amount.toLocaleString('en-US') : amount;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      ...style
    }
  }, label ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: '0.5rem',
      fontWeight: 700,
      letterSpacing: '1.4px',
      textTransform: 'uppercase',
      color: 'var(--muted)',
      marginBottom: '5px'
    }
  }, label) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: sizes[size],
      fontWeight: 800,
      lineHeight: 1,
      fontVariantNumeric: 'tabular-nums',
      color: isZero ? 'var(--muted-2)' : bright ? 'var(--gold-2)' : 'var(--gold)'
    }
  }, formatted));
}
Object.assign(__ds_scope, { MoneyValue });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/money/MoneyValue.jsx", error: String((e && e.message) || e) }); }

// components/money/StatCard.jsx
try { (() => {
/**
 * TipPool StatCard — the tappable metric tile from the home dashboard
 * ("Cash on Hand", "Staff"). Card surface with the signature top-left sheen,
 * an uppercase eyebrow, a big value, and a small sub-line. A `›` chevron in
 * the corner signals it navigates. `tone` colors the value (gold for money,
 * text for counts).
 */
function StatCard({
  label,
  value,
  sub = null,
  tone = 'money',
  onClick = null,
  style = {}
}) {
  const valueColor = tone === 'money' ? 'var(--gold)' : 'var(--text)';
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    style: {
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
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'var(--sheen)',
      pointerEvents: 'none'
    }
  }), onClick ? /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 7,
      right: 9,
      fontSize: '0.65rem',
      color: 'var(--accent)',
      fontWeight: 700
    }
  }, "\u203A") : null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: '0.5rem',
      fontWeight: 700,
      letterSpacing: '1.4px',
      textTransform: 'uppercase',
      color: 'var(--muted)',
      marginBottom: '3px'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: '1.4rem',
      fontWeight: 800,
      lineHeight: 1,
      color: valueColor,
      fontVariantNumeric: 'tabular-nums'
    }
  }, value), sub ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: '0.58rem',
      color: 'var(--muted)',
      marginTop: '2px'
    }
  }, sub) : null);
}
Object.assign(__ds_scope, { StatCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/money/StatCard.jsx", error: String((e && e.message) || e) }); }

// components/people/PersonCard.jsx
try { (() => {
/**
 * TipPool PersonCard — a per-person payout row from the Summary tab. Avatar
 * with initials, name + optional closer badge, an hours block (gold-2 value
 * over the in/out times), and the payout column (gold) with a base/bonus
 * sub-line. Tapping opens the person profile (pass onClick).
 */
function initials(name) {
  return (name || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}
function PersonCard({
  name,
  hours,
  inTime = null,
  outTime = null,
  payout,
  basePay = null,
  bonus = null,
  isCloser = false,
  onClick = null,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    style: {
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
      overflow: 'hidden',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'border-color var(--dur) var(--ease), background var(--dur) var(--ease)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '9px',
      padding: '10px 11px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 28,
      height: 28,
      borderRadius: '50%',
      background: 'var(--surface-3)',
      border: '1px solid var(--border-2)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '0.62rem',
      fontWeight: 700,
      color: 'var(--text-2)',
      flexShrink: 0,
      fontFamily: 'var(--font-mono)'
    }
  }, initials(name)), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '5px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '1rem',
      fontWeight: 800,
      color: 'var(--text)',
      fontFamily: 'var(--font-sans)'
    }
  }, name), isCloser ? /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    variant: "closer"
  }, "Closer") : null)), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'right',
      flexShrink: 0,
      width: 74,
      fontVariantNumeric: 'tabular-nums'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '1.05rem',
      fontWeight: 800,
      color: 'var(--gold-2)',
      fontFamily: 'var(--font-mono)',
      lineHeight: 1
    }
  }, hours, "h"), inTime && outTime ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.54rem',
      color: 'var(--text-2)',
      fontFamily: 'var(--font-mono)',
      marginTop: '2px',
      whiteSpace: 'nowrap'
    }
  }, inTime, "\u2013", outTime) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'right',
      flexShrink: 0,
      width: 62,
      fontVariantNumeric: 'tabular-nums'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '1.22rem',
      fontWeight: 800,
      color: 'var(--gold)',
      fontFamily: 'var(--font-mono)',
      lineHeight: 1
    }
  }, "$", payout), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: '4px',
      marginTop: '2px',
      minHeight: 14
    }
  }, bonus ? /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    variant: "bonus",
    pill: true
  }, "+$", bonus) : basePay != null ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '0.58rem',
      color: 'var(--muted-2)',
      fontFamily: 'var(--font-mono)'
    }
  }, "$", basePay) : null))));
}
Object.assign(__ds_scope, { PersonCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/people/PersonCard.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.SegmentedControl = __ds_scope.SegmentedControl;

__ds_ns.DenomRow = __ds_scope.DenomRow;

__ds_ns.MoneyValue = __ds_scope.MoneyValue;

__ds_ns.StatCard = __ds_scope.StatCard;

__ds_ns.PersonCard = __ds_scope.PersonCard;

})();
