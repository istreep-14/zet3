// resolveStaff / resolvePools — raw state strings → absolute-axis numbers.
//
// Resolution order per person:
//   in  = explicit || roleDefault.in  || global.in   → resolveIn (fixed am/pm)
//   out = explicit || roleDefault.out || closeTime   → nextAfter(reading, inAbs)
// In times use the fixed 9–11:59=AM rule; out times are the next occurrence of
// their reading after that person's own In (so they always fall after In).
// Closers (hybrid rule): closerOverride || out ≥ peak out across tipped staff.
// Blank-out people sit at close time, so they're closers via latest-out
// naturally — someone typed *past* close becomes the closer, ties share.

import { parseTime, resolveIn, nextAfter, atOrAfter, overlapHours } from './time.js';
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

  // Anchor (shift open) on the absolute axis: resolved global In, else earliest
  // resolved staff In, else 5p.
  let anchorAbs;
  if (globalIn.valid && !globalIn.empty) {
    anchorAbs = resolveIn(globalIn.value);
  } else {
    const ins = effIns
      .map(s => parseTime(s))
      .filter(p => p.valid && !p.empty)
      .map(p => resolveIn(p.value));
    anchorAbs = ins.length ? Math.min(...ins) : resolveIn(5);
  }

  // Pass 1: resolve each person's In (fixed am/pm rule) and any explicit/role
  // Out (next occurrence of its reading after that person's own In).
  const partial = named.map((p, idx) => {
    const roleDef = defaults.byRole[p.role] || {};
    const name = p.name.trim();
    const explicitIn = String(p.in || '').trim();
    const explicitOut = String(p.out || '').trim();
    const outRaw = explicitOut || String(roleDef.out || '').trim();

    const inParsed = parseField(effIns[idx], name + "'s In time", errors);
    let inAbs = null;
    if (inParsed.valid && !inParsed.empty) inAbs = resolveIn(inParsed.value);
    else if (inParsed.valid && inParsed.empty) errors.push(name + ' needs an In time (or set a default).');

    let outAbs = null;
    if (outRaw) {
      const outParsed = parseField(outRaw, name + "'s Out time", errors);
      if (outParsed.valid && !outParsed.empty) {
        outAbs = inAbs !== null ? nextAfter(outParsed.value, inAbs) : resolveIn(outParsed.value);
      }
    }
    return { p, name, role: p.role, explicitIn, explicitOut, hasOut: !!outRaw, inAbs, outAbs };
  });

  // Close time = resolved global Out (next occurrence after the anchor). Fallback:
  // latest explicit out across staff, so a session without a Default Out works.
  let closeAbs = null;
  if (globalOut.valid && !globalOut.empty) {
    closeAbs = nextAfter(globalOut.value, anchorAbs);
  } else {
    for (const r of partial) {
      if (r.hasOut && r.outAbs !== null && (closeAbs === null || r.outAbs > closeAbs)) closeAbs = r.outAbs;
    }
  }

  // Pass 2: blank-out people inherit the close time; finalize hours.
  const staff = partial.map(r => {
    let outAbs = r.outAbs;
    let usedCloseTime = false;
    if (!r.hasOut) {
      if (closeAbs !== null) { outAbs = closeAbs; usedCloseTime = true; }
      else errors.push(r.name + ' needs an Out time (or set a close time).');
    }

    let hours = 0;
    if (r.inAbs !== null && outAbs !== null) {
      hours = outAbs - r.inAbs;
      if (hours <= 0 || hours > 12) {
        errors.push(r.name + ' has invalid shift hours (' + parseFloat(hours.toFixed(2)) + 'h). Check In/Out times.');
      }
    }

    return {
      id: r.p.id,
      name: r.name,
      role: r.role,
      inAbs: r.inAbs,
      outAbs,
      hours,
      closerOverride: !!r.p.closerOverride,
      usedDefaults: { in: !r.explicitIn, out: !r.explicitOut },
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

  return { staff, anchorAbs, closeAbs, errors };
}

// Pool windows resolve onto the same axis: blank start = earliest resolved in,
// blank end = close time, explicit values = next occurrence at/after the open.
export function resolvePools(state, resolved) {
  const { staff, anchorAbs, closeAbs } = resolved;
  const errors = [];

  const earliestIn = staff.length
    ? Math.min(...staff.filter(p => p.inAbs !== null).map(p => p.inAbs))
    : anchorAbs;

  const pools = state.pools.map(pool => {
    const label = pool.label || 'Pool';

    let startAbs = earliestIn;
    const startStr = String(pool.window.start || '').trim();
    if (startStr) {
      const p = parseField(startStr, label + ' window start', errors);
      if (p.valid && !p.empty) startAbs = atOrAfter(p.value, anchorAbs);
    }

    let endAbs = closeAbs !== null ? closeAbs : earliestIn;
    const endStr = String(pool.window.end || '').trim();
    if (endStr) {
      const p = parseField(endStr, label + ' window end', errors);
      if (p.valid && !p.empty) endAbs = atOrAfter(p.value, anchorAbs);
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
