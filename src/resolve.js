// resolveStaff / resolvePools — raw state strings → absolute-axis numbers.
//
// Resolution order per person:
//   in  = explicit || roleDefault.in  || global.in   → abs
//   out = explicit || roleDefault.out || closeTime   → abs   (blank inherits close)
// Closers (hybrid rule): closerOverride || out ≥ peak out across tipped staff.
// Blank-out people sit at close time, so they're closers via latest-out
// naturally — someone typed *past* close becomes the closer, ties share.

import { parseTime, toAbs, overlapHours } from './time.js';
import { parseWholeNumber, poolValue, DENOMS } from './util.js';

const EPS = 1e-9;

function parseField(raw, label, errors) {
  const p = parseTime(raw);
  if (!p.valid) errors.push(label + ' is not a valid time (e.g. 5, 11, 12.5).');
  return p;
}

// opts.closeOverride: raw decimal close time replacing defaults.global.out
// (the Close Time sidebar varies this one value and re-runs the pipeline).
export function resolveStaff(state, opts = {}) {
  const errors = [];
  const defaults = state.defaults;

  const globalIn = parseField(defaults.global.in, 'Default In', errors);
  const globalOutRaw = opts.closeOverride != null ? String(opts.closeOverride) : defaults.global.out;
  const globalOut = parseField(globalOutRaw, 'Default Out', errors);

  const named = state.staff.filter(p => (p.name || '').trim());

  // Effective raw in per person (explicit → role default → global)
  const effIns = named.map(p => {
    const roleDef = defaults.byRole[p.role] || {};
    return String(p.in || '').trim() || String(roleDef.in || '').trim() || (globalIn.empty ? '' : String(defaults.global.in));
  });

  // Anchor = resolved global In, else earliest raw In among staff, else 5.
  let anchorRaw = 5;
  if (globalIn.valid && !globalIn.empty) {
    anchorRaw = globalIn.value;
  } else {
    const rawIns = effIns
      .map(s => parseTime(s))
      .filter(p => p.valid && !p.empty)
      .map(p => p.value);
    if (rawIns.length) anchorRaw = Math.min(...rawIns);
  }

  // Close time = resolved global Out on the absolute axis. Fallback: latest
  // explicit out across staff (so a session without a Default Out still works).
  let closeAbs = null;
  if (globalOut.valid && !globalOut.empty) {
    closeAbs = toAbs(globalOut.value, anchorRaw);
  } else {
    for (const p of named) {
      const out = parseTime(p.out);
      if (out.valid && !out.empty) {
        const abs = toAbs(out.value, anchorRaw);
        if (closeAbs === null || abs > closeAbs) closeAbs = abs;
      }
    }
  }

  const staff = named.map((p, idx) => {
    const roleDef = defaults.byRole[p.role] || {};
    const name = p.name.trim();

    const explicitIn = String(p.in || '').trim();
    const explicitOut = String(p.out || '').trim();
    const inRaw = effIns[idx];
    const outRaw = explicitOut || String(roleDef.out || '').trim();

    const inParsed = parseField(inRaw, name + "'s In time", errors);
    let inAbs = null;
    if (inParsed.valid && !inParsed.empty) {
      inAbs = toAbs(inParsed.value, anchorRaw);
    } else if (inParsed.valid && inParsed.empty) {
      errors.push(name + ' needs an In time (or set a default).');
    }

    let outAbs = null;
    let usedCloseTime = false;
    if (outRaw) {
      const outParsed = parseField(outRaw, name + "'s Out time", errors);
      if (outParsed.valid && !outParsed.empty) outAbs = toAbs(outParsed.value, anchorRaw);
    } else if (closeAbs !== null) {
      outAbs = closeAbs;
      usedCloseTime = true;
    } else {
      errors.push(name + ' needs an Out time (or set a close time).');
    }

    let hours = 0;
    if (inAbs !== null && outAbs !== null) {
      hours = outAbs - inAbs;
      if (hours <= 0 || hours > 12) {
        errors.push(name + ' has invalid shift hours (' + parseFloat(hours.toFixed(2)) + 'h). Check In/Out times.');
      }
    }

    return {
      id: p.id,
      name,
      role: p.role,
      inAbs,
      outAbs,
      hours,
      closerOverride: !!p.closerOverride,
      usedDefaults: { in: !explicitIn, out: !explicitOut },
      usedCloseTime,
      closer: false,
    };
  });

  // Closer rule: latest effective out across tipped staff; ties → all.
  const tipped = staff.filter(p => p.role !== 'support' && p.outAbs !== null);
  const peak = tipped.length ? Math.max(...tipped.map(p => p.outAbs)) : null;
  staff.forEach(p => {
    const auto = p.role !== 'support' && peak !== null && p.outAbs !== null && p.outAbs >= peak - EPS;
    p.autoCloser = auto;
    p.closer = p.closerOverride || auto;
  });

  return { staff, anchorRaw, closeAbs, errors };
}

// Pool windows resolve like staff times: blank start = earliest resolved in,
// blank end = close time, explicit values → abs.
export function resolvePools(state, resolved) {
  const { staff, anchorRaw, closeAbs } = resolved;
  const errors = [];

  const earliestIn = staff.length
    ? Math.min(...staff.filter(p => p.inAbs !== null).map(p => p.inAbs))
    : anchorRaw;

  const pools = state.pools.map(pool => {
    const label = pool.label || 'Pool';

    let startAbs = earliestIn;
    const startStr = String(pool.window.start || '').trim();
    if (startStr) {
      const p = parseField(startStr, label + ' window start', errors);
      if (p.valid && !p.empty) startAbs = toAbs(p.value, anchorRaw);
    }

    let endAbs = closeAbs !== null ? closeAbs : earliestIn;
    const endStr = String(pool.window.end || '').trim();
    if (endStr) {
      const p = parseField(endStr, label + ' window end', errors);
      if (p.valid && !p.empty) endAbs = toAbs(p.value, anchorRaw);
    }

    if (endAbs <= startAbs) {
      errors.push(label + ' window end must be after its start.');
    }

    // Cash: per-bill counts sum directly; net total parses as whole dollars.
    let total = 0;
    let billCounts = null;
    if (pool.cash.entryMode === 'perbill') {
      billCounts = {};
      DENOMS.forEach(d => {
        const parsed = parseWholeNumber(pool.cash.billCounts[d]);
        if (!parsed.valid) errors.push(label + ' $' + d + ' count must be a whole number.');
        billCounts[d] = parsed.valid ? parsed.value : 0;
      });
      total = poolValue(billCounts);
    } else {
      const parsed = parseWholeNumber(pool.cash.netTotal);
      if (!parsed.valid) errors.push(label + ' net total must be a whole-dollar amount.');
      total = parsed.valid ? parsed.value : 0;
    }

    return {
      id: pool.id,
      label,
      startAbs,
      endAbs,
      roles: { ...pool.roles },
      includeSupport: !!pool.includeSupport,
      entryMode: pool.cash.entryMode,
      total,
      billCounts,
    };
  });

  return { pools, errors };
}

export function poolParticipants(pool, staff) {
  return staff
    .filter(p => pool.roles[p.role] || (p.role === 'support' && pool.includeSupport))
    .map(p => ({ person: p, hours: overlapHours(p.inAbs, p.outAbs, pool.startAbs, pool.endAbs) }))
    .filter(x => x.hours > 0);
}
