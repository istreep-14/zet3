// Day shift multi-pool engine — pure functions, no DOM access
// Depends on utils.js (parseTimeString, poolValue) and engine.js (distributeBills)

// ── Time helpers ──────────────────────────────────────────────────────────────

// Convert a decimal time value to an absolute hour offset.
// Day shift times: 0–12 treated as AM (0=midnight, 12=noon), values >12 treated
// as-is (24h). We store day shift times as decimals where:
//   10   = 10:00 AM
//   2    = 2:00 PM (but context-shifted — see dayShiftAbsolute)
//
// Day shift runs roughly 10am–6pm. We apply the same "pm unless it would be
// before open" heuristic as night shift but anchored to 10am open.
// Anything >= 10 and <= 12 = AM, anything < 10 = PM (afternoon).
// So: 10=10am, 11=11am, 12=noon, 1=1pm, 2=2pm … 6=6pm.
function dayShiftAbsolute(t) {
  // t is a decimal 0–12 from parseTimeString
  if (t >= 10) return t;          // 10am–12pm
  return t + 12;                  // 1pm–9pm  (1→13, 2→14 … 9→21)
}

// Overlap of [personIn, personOut) with [poolStart, poolEnd) in hours.
// All values are absolute hours (dayShiftAbsolute applied).
function overlapHours(personIn, personOut, poolStart, poolEnd) {
  const start = Math.max(personIn, poolStart);
  const end   = Math.min(personOut, poolEnd);
  return Math.max(0, end - start);
}

// ── Pool window derivation ────────────────────────────────────────────────────

// Returns { morningStart, morningEnd, middleEnd } or null with an error.
// morningStart = min of all staff absolute in-times
// morningEnd   = max of server absolute out-times (only servers with explicit out)
// middleEnd    = max of bartender absolute out-times (only bartenders with explicit out)
function deriveDayShiftWindows(bartenders, servers) {
  const allStaff = [...bartenders, ...servers];

  // Absolute in-times for all staff
  const inTimes = allStaff
    .map(p => p.inAbs)
    .filter(t => t !== null && t !== undefined);

  if (!inTimes.length) return { error: 'No staff in-times.' };

  const morningStart = Math.min(...inTimes);

  // Morning end = max of server EXPLICIT out-times only
  const serverOutTimes = servers
    .filter(p => p.hasExplicitOut)
    .map(p => p.outAbs);

  if (!serverOutTimes.length) return { error: 'Need at least one server with an Out time to define the Morning Cut end.' };

  const morningEnd = Math.max(...serverOutTimes);

  if (morningEnd <= morningStart) return { error: 'Morning Cut end must be after start.' };

  // Middle end = max of bartender EXPLICIT out-times
  const bartOutTimes = bartenders
    .filter(p => p.hasExplicitOut)
    .map(p => p.outAbs);

  if (!bartOutTimes.length) return { error: 'Need at least one bartender with an Out time to define the Middle Cut end.' };

  const middleEnd = Math.max(...bartOutTimes);

  if (middleEnd <= morningEnd) return { error: 'Middle Cut end must be after Morning Cut end.' };

  return { morningStart, morningEnd, middleEnd, error: null };
}

// ── Staff normalisation ───────────────────────────────────────────────────────

// Takes raw staff input rows and resolves absolute times.
// defaultInAbs: fallback absolute in-time if field blank
// defaultOutAbs: fallback absolute out-time if field blank AND not a closer
// Returns array of normalised staff objects.
function normaliseDayStaff(rawRows, role, defaultInAbs, defaultOutAbs) {
  return rawRows.map(r => {
    const inParsed  = parseTimeString(r.inStr  || '');
    const outParsed = parseTimeString(r.outStr || '');

    const inAbs  = (!inParsed.empty  && inParsed.valid)
      ? dayShiftAbsolute(inParsed.value)
      : defaultInAbs;

    const hasExplicitOut = !outParsed.empty && outParsed.valid;
    const isAutoCloser   = !hasExplicitOut;

    // For closers we set outAbs to middleEnd later once windows are known.
    // For now store null — resolved below in calculateDayShift.
    const outAbs = hasExplicitOut
      ? dayShiftAbsolute(outParsed.value)
      : null;

    return {
      n:             r.name,
      role,          // 'bartender' | 'server'
      _rowId:        r.rowId,
      inAbs,
      outAbs,
      hasExplicitOut,
      isAutoCloser,
      closer:        r.closer || isAutoCloser,
      rawShares:     {},   // poolId → raw dollar share (pre-floor)
      rawTotal:      0,
      final:         0,
      bonus:         0,
      bills:         { 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 0 },
    };
  });
}

// ── Core calculation ──────────────────────────────────────────────────────────

function calculateDayShift(bartenderRows, serverRows, poolCash, partyConfig) {
  // poolCash: { morning: number, middle: number, party1: number|null, party2: number|null }
  // partyConfig: { party1: {enabled, start, end}, party2: {enabled, start, end} }
  // All party start/end are raw string values from inputs.

  if (!bartenderRows.length && !serverRows.length) {
    return { error: 'Add day shift staff.' };
  }

  // Resolve default in/out — use 10am absolute as default in
  const defaultInAbs = 10;

  const bartenders = normaliseDayStaff(bartenderRows, 'bartender', defaultInAbs, null);
  const servers    = normaliseDayStaff(serverRows,    'server',    defaultInAbs, null);

  // Derive windows
  const windows = deriveDayShiftWindows(bartenders, servers);
  if (windows.error) return { error: windows.error };

  const { morningStart, morningEnd, middleEnd } = windows;

  // Resolve closer out-times now that we have middleEnd
  // Closers get outAbs = middleEnd (last possible shift end for day shift)
  [...bartenders, ...servers].forEach(p => {
    if (p.outAbs === null) p.outAbs = middleEnd;
  });

  // Validate: ensure all staff have positive shift hours
  for (const p of [...bartenders, ...servers]) {
    const h = p.outAbs - p.inAbs;
    if (h <= 0) {
      return { error: `${p.n} has invalid shift hours (${h}h). Check In/Out times.` };
    }
    p.totalHours = h;
  }

  // Build pool definitions
  const pools = [];

  // Morning cut: all staff, window [morningStart, morningEnd]
  pools.push({
    id:    'morning',
    label: 'Morning Cut',
    start: morningStart,
    end:   morningEnd,
    total: poolCash.morning || 0,
    who:   'all',       // bartenders + servers
  });

  // Middle cut: bartenders only, window [morningEnd, middleEnd]
  pools.push({
    id:    'middle',
    label: 'Middle Cut',
    start: morningEnd,
    end:   middleEnd,
    total: poolCash.middle || 0,
    who:   'bartenders',
  });

  // Party pools
  for (const pid of ['party1', 'party2']) {
    const cfg = partyConfig[pid];
    if (!cfg || !cfg.enabled) continue;

    const startParsed = parseTimeString(cfg.start || '');
    const endParsed   = parseTimeString(cfg.end   || '');

    if (!startParsed.valid || startParsed.empty) {
      return { error: `Party pool start time is invalid.` };
    }
    if (!endParsed.valid || endParsed.empty) {
      return { error: `Party pool end time is invalid.` };
    }

    const pStart = dayShiftAbsolute(startParsed.value);
    const pEnd   = dayShiftAbsolute(endParsed.value);

    if (pEnd <= pStart) return { error: `Party pool end must be after start.` };

    pools.push({
      id:    pid,
      label: pid === 'party1' ? 'Party 1' : 'Party 2',
      start: pStart,
      end:   pEnd,
      total: poolCash[pid] || 0,
      who:   'all',
    });
  }

  // Validate all pool totals
  for (const pool of pools) {
    if (pool.total < 0) return { error: `${pool.label} cash cannot be negative.` };
  }

  const totalCash = pools.reduce((s, p) => s + p.total, 0);
  if (totalCash === 0) return { error: 'Enter cash for at least one pool.' };

  // ── Compute raw shares ────────────────────────────────────────────────────

  const allStaff = [...bartenders, ...servers];
  const poolResults = [];

  for (const pool of pools) {
    const eligible = pool.who === 'bartenders'
      ? bartenders
      : allStaff;

    // Compute overlap hours per eligible person
    const participants = [];
    for (const p of eligible) {
      const hrs = overlapHours(p.inAbs, p.outAbs, pool.start, pool.end);
      if (hrs > 0) participants.push({ person: p, hours: hrs });
    }

    const poolTotalHours = participants.reduce((s, x) => s + x.hours, 0);

    const rate = poolTotalHours > 0 ? pool.total / poolTotalHours : 0;

    for (const { person, hours } of participants) {
      const raw = hours * rate;
      person.rawShares[pool.id] = (person.rawShares[pool.id] || 0) + raw;
    }

    poolResults.push({
      id:          pool.id,
      label:       pool.label,
      start:       pool.start,
      end:         pool.end,
      total:       pool.total,
      totalHours:  poolTotalHours,
      rate,
      participants: participants.map(({ person, hours }) => ({
        name:   person.n,
        role:   person.role,
        _rowId: person._rowId,
        hours,
        raw:    hours * rate,
      })),
    });
  }

  // ── Single floor per person ───────────────────────────────────────────────

  allStaff.forEach(p => {
    p.rawTotal = Object.values(p.rawShares).reduce((s, v) => s + v, 0);
    p.final    = Math.floor(p.rawTotal);
  });

  const totalFloored  = allStaff.reduce((s, p) => s + p.final, 0);
  const remainder     = totalCash - totalFloored;

  // Closer bonus: split remainder evenly among closers, floor
  const closers   = allStaff.filter(p => p.closer);
  const perCloser = closers.length ? Math.floor(remainder / closers.length) : 0;
  const leftover  = remainder - perCloser * closers.length;

  closers.forEach(p => { p.bonus = perCloser; p.final += perCloser; });

  // ── Bill distribution (combined pool) ────────────────────────────────────

  // Merge all pool bill snapshots into one combined pool
  // (caller passes mergedBills as the combined count object)
  // Distribution runs at the end — we return staff with final amounts,
  // caller calls distributeBills with merged bills.

  return {
    error:      null,
    pools:      poolResults,
    people:     allStaff,
    windows:    { morningStart, morningEnd, middleEnd },
    totalCash,
    totalPaid:  allStaff.reduce((s, p) => s + p.final, 0),
    leftover,
    remainder,
  };
}
