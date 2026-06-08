// ── Debounced auto-calculate ──────────────────────────────────────────────────

let _calcTimer = null;
function scheduleCalculate() {
  if (_calcTimer) clearTimeout(_calcTimer);
  _calcTimer = setTimeout(autoCalculate, 120);
}

// ── Shared UI helpers ─────────────────────────────────────────────────────────

function setStaleBanners(reason) {
  const message = '⚠ ' + reason + ' Results below are outdated.';
  document.querySelectorAll('.stale-banner').forEach(b => {
    b.textContent = message;
    b.classList.add('visible');
  });
}

function clearStaleBanners() {
  document.querySelectorAll('.stale-banner').forEach(b => b.classList.remove('visible'));
}

function renderBlockedPlaceholders(reason) {
  const safe = escapeHTML(reason);
  const summary = $('summary-content');
  const dist    = $('dist-content');
  if (summary) summary.innerHTML = `<div class="warn-box">⚠ ${safe}</div>`;
  if (dist)    dist.innerHTML    = `<div class="warn-box">⚠ ${safe}</div>`;
}

function blockCalculation(reason, options = {}) {
  currentInputError = options.inputError ? reason : '';
  updateHomeLive(null);
  clearStaleBanners();
  if (lastStaff.length || lastDayResult || options.showPlaceholder) {
    renderBlockedPlaceholders(reason);
  }
}

// ── Input collection ──────────────────────────────────────────────────────────

function collectNamedStaffRows() {
  // Night shift: collect bartenders (staffList) + servers (nightServerList), exclude support
  const selectors = ['#staffList .staff-row-modal', '#nightServerList .staff-row-modal'];
  const allRows = selectors.flatMap(sel => [...document.querySelectorAll(sel)]);

  const gcIn = $('gc-in').value.trim(), gcOut = $('gc-out').value.trim();
  const errors = [];
  const gcInParsed = parseTimeString(gcIn), gcOutParsed = parseTimeString(gcOut);
  setInputInvalid($('gc-in'),  !!gcIn  && !gcInParsed.valid);
  setInputInvalid($('gc-out'), !!gcOut && !gcOutParsed.valid);
  if (gcIn  && !gcInParsed.valid)  errors.push('Default In must be a valid time (e.g. 5, 11, 12.5).');
  if (gcOut && !gcOutParsed.valid) errors.push('Default Out must be a valid time (e.g. 5, 11, 12.5).');
  ['bartender', 'server'].forEach(role => {
    const defs = roleDefaults[role] || {};
    const inParsed = parseTimeString(defs.in || '');
    const outParsed = parseTimeString(defs.out || '');
    if (defs.in && !inParsed.valid) errors.push(role + ' default In must be a valid time.');
    if (defs.out && !outParsed.valid) errors.push(role + ' default Out must be a valid time.');
  });

  const rawData = [];
  allRows.forEach(r => {
    const name    = r.querySelector('[data-field="name"]').value.trim();
    const inEl    = r.querySelector('[data-field="in"]');
    const outEl   = r.querySelector('[data-field="out"]');
    const inStr   = inEl.value.trim();
    const outStr  = outEl.value.trim();
    const inParsed  = parseTimeString(inStr);
    const outParsed = parseTimeString(outStr);
    setInputInvalid(inEl,  !!inStr  && !inParsed.valid);
    setInputInvalid(outEl, !!outStr && !outParsed.valid);
    if (!name) return;
    if (inStr  && !inParsed.valid)  errors.push(name + ' has an invalid In time.');
    if (outStr && !outParsed.valid) errors.push(name + ' has an invalid Out time.');
    rawData.push({ name, inStr, outStr, hasIn: !!inStr, hasOut: !!outStr, rowId: r.id.replace('staff', '') });
  });

  return { rawData, gcIn, gcOut, errors };
}

// ── Night shift: pure computation ─────────────────────────────────────────────
//
// Returns one of:
//   { ok: false, reason: string, inputError?: true }
//   { ok: true, staff, total, totH, rate, leftover, pool }
//
// No globals written. No DOM written. No renders triggered.

function computeNightShift() {
  const { rawData, gcIn, gcOut, errors } = collectNamedStaffRows();

  if (errors.length) {
    return { ok: false, reason: errors[0], inputError: true };
  }
  if (!rawData.length) {
    return { ok: false, reason: 'Add staff with names.' };
  }

  // Effective in/out: explicit value → role default → global default
  rawData.forEach(r => {
    const role = getRoleForList(_listIdForRowId(r.rowId));
    const rDef = roleDefaults[role] || {};
    r.effIn  = r.inStr  || rDef.in  || gcIn;
    r.effOut = r.outStr || rDef.out || gcOut;
  });

  let maxEo = 0;
  rawData.forEach(r => {
    if (r.effIn && r.effOut) {
      const i  = parseTimeString(r.effIn).value;
      const o  = parseTimeString(r.effOut).value;
      const eo = o < i ? o + 12 : o;
      if (eo > maxEo) maxEo = eo;
    }
  });
  const defaultIn  = 5;
  const defaultOut = maxEo > 0 ? (maxEo > 12 ? maxEo - 12 : maxEo) : 2;

  // First pass: build staff with times, no closer yet
  const staff = rawData.map(r => {
    const inParsed  = parseTimeString(r.effIn);
    const outParsed = parseTimeString(r.effOut);
    const inVal     = inParsed.empty  ? defaultIn  : inParsed.value;
    const outVal    = outParsed.empty ? defaultOut : outParsed.value;
    let h = outVal - inVal; if (h < 0) h += 12;
    const eo = outVal < inVal ? outVal + 12 : outVal;
    return {
      n: r.name, i: inVal, o: outVal, h, eo,
      _rowId: r.rowId, _autoCloser: false, closer: false,
      bills: { 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 0 },
    };
  });

  // Closer logic: the person(s) with the latest effective out time are closers.
  // Tied at the max → all are closers. Manual toggle (ct button) also forces closer.
  const peakEo = staff.length ? Math.max(...staff.map(p => p.eo)) : 0;
  staff.forEach(p => {
    const ctEl = document.getElementById('ct' + p._rowId);
    const manualOn = ctEl ? ctEl.classList.contains('on') : false;
    const autoClose = peakEo > 0 && p.eo >= peakEo;
    p._autoCloser = autoClose;
    p.closer = manualOn || autoClose;
  });

  const invalidStaff = staff.find(p => p.h <= 0 || p.h > 12);
  if (invalidStaff) {
    return { ok: false, reason: invalidStaff.n + ' has invalid shift hours.', inputError: true };
  }

  const total = getTotal();
  const totH  = staff.reduce((s, p) => s + p.h, 0);
  if (totH <= 0) {
    return { ok: false, reason: 'Add valid staff hours.', inputError: true };
  }

  const rate = total / totH;
  staff.forEach(p => { p.exact = p.h * rate; p.base = Math.floor(p.exact); p.bonus = 0; });

  const floored   = staff.reduce((s, p) => s + p.base, 0);
  const remainder = total - floored;
  const closers   = staff.filter(p => p.closer);
  const perCloser = closers.length ? Math.floor(remainder / closers.length) : 0;
  const leftover  = remainder - perCloser * closers.length;
  closers.forEach(p => { p.bonus = perCloser; });
  staff.forEach(p => { p.final = p.base + p.bonus; p.rem = p.final; });

  return { ok: true, staff, total, totH, rate, leftover, pool: getInputPool() };
}

// ── Night shift: distribution ─────────────────────────────────────────────────
//
// Runs distributeBills (which has side effects on globals) and captures its
// outputs into an explicit object returned to the caller.

function runDistribution(staff, pool, leftover) {
  const sc   = staff.map(p => ({ ...p, bills: {}, rem: p.final }));
  const dist = distributeBills(sc, { ...pool }, leftover);
  return {
    staffWithBills:    sc,
    poolAfter:         dist.poolAfter,
    remainderBills:    dist.remainderBills,
    distributionError: dist.distributionError,
  };
}

// ── Night shift: render ───────────────────────────────────────────────────────
//
// Receives all data explicitly — does not read globals for computation results.

function renderNightShift(computeResult, distResult) {
  const { staff, total, totH, rate, leftover, pool } = computeResult;
  const { staffWithBills, poolAfter, remainderBills, distributionError } = distResult;

  currentInputError = '';

  renderSummary(staffWithBills, staff, total, totH, rate, leftover, poolAfter,
    { remainderBills, distributionError, pool });

  renderDist(staffWithBills, poolAfter,
    { remainderBills, distributionError, leftover, pool });

  updateHomeLive(staff, { rate, totH, leftover, distributionError });
}

// ── Night shift: orchestration ────────────────────────────────────────────────

function autoCalculate() {
  if (shiftMode === 'day') {
    autoCalculateDay();
    return;
  }

  if (cashMode === 'nettotal' && !isUpdatingNetTotal) refreshNetTotalBreakdown();

  const cashValidation = validateCashInputs();
  if (!cashValidation.valid) {
    updateStockCards(); updateTabIndicators();
    blockCalculation(cashValidation.message, { inputError: true, showPlaceholder: true });
    saveState();
    return;
  }

  const { rawData } = collectNamedStaffRows();
  const hasName = rawData.length > 0;
  const total   = cashValidation.total;

  if (!hasName || total === 0) {
    currentInputError = '';
    updateStockCards(); updateTabIndicators(); updateHomeLive(null);
    clearStaleBanners();
    if (lastStaff.length) {
      renderBlockedPlaceholders(total === 0 ? 'Cash is zero.' : 'No named staff rows remain.');
    }
    saveState();
    return;
  }

  calculate(true);
  saveState();
}

function calculate(silent) {
  const result = computeNightShift();

  if (!result.ok) {
    blockCalculation(result.reason, { inputError: !!result.inputError, showPlaceholder: true });
    if (!silent) alert(result.reason);
    return;
  }

  // Persist computation results to globals consumed by legacy callers
  // (person modal, tab indicators, home cards). This is the single place
  // globals are written for night shift.
  livePool     = result.pool;
  lastStaff    = result.staff;
  lastTotal    = result.total;
  lastTotH     = result.totH;
  lastRate     = result.rate;
  lastLeftover = result.leftover;

  const distResult = runDistribution(result.staff, result.pool, result.leftover);

  // Persist distribution outputs to globals consumed by person modal + dist tab.
  lastRemainderBills    = distResult.remainderBills;
  lastDistributionError = distResult.distributionError;
  lastPoolAfter         = distResult.poolAfter;
  _lastDistStaff        = distResult.staffWithBills;

  renderNightShift(result, distResult);

  if (!silent) switchTab('summary', $('tb-summary'));
}

function _listIdForRowId(rowId) {
  const lists = ['staffList','nightServerList','bartenderList','serverList','supportList'];
  for (const lid of lists) {
    const el = document.querySelector('#' + lid + ' #staff' + rowId);
    if (el) return lid;
  }
  return 'staffList';
}

// ── Day shift: input collection ───────────────────────────────────────────────

function collectDayStaffRows(listId, role) {
  const rows  = document.querySelectorAll('#' + listId + ' .staff-row-modal');
  const gcIn  = ($('gc-in').value  || '').trim();
  const gcOut = ($('gc-out').value || '').trim();
  // Use role-specific defaults, falling back to global
  const rDef   = (typeof roleDefaults !== 'undefined' && roleDefaults[role]) || {};
  const defIn  = rDef.in  || gcIn;
  const defOut = rDef.out || gcOut;
  const result = [];

  rows.forEach(r => {
    const name   = r.querySelector('[data-field="name"]').value.trim();
    const inEl   = r.querySelector('[data-field="in"]');
    const outEl  = r.querySelector('[data-field="out"]');
    const inStr  = inEl.value.trim()  || defIn;
    const outStr = outEl.value.trim() || defOut;
    const ctEl   = r.querySelector('.sri-closer');
    if (!name) return;
    result.push({ name, inStr, outStr, rowId: r.id.replace('staff', '').replace('server', ''),
      closer: ctEl ? ctEl.classList.contains('on') : false, role });
  });

  return result;
}

function getDayPoolCash() {
  return {
    morning: getDayPoolTotal('morning'),
    middle:  getDayPoolTotal('middle'),
    party1:  dayPools.party1.enabled ? getDayPoolTotal('party1') : null,
    party2:  dayPools.party2.enabled ? getDayPoolTotal('party2') : null,
  };
}

function getDayPoolTotal(poolId) {
  const pool = dayPools[poolId];
  if (!pool) return 0;
  if (pool.cashMode === 'nettotal') {
    const el     = $('dp-net-' + poolId);
    const parsed = parseWholeNumberString(el?.value ?? '');
    return parsed.valid ? parsed.value : 0;
  }
  return ['100','50','20','10','5','1'].reduce((sum, d) => {
    const el     = $('dp-b' + d + '-' + poolId);
    const parsed = parseWholeNumberString(el?.value ?? '');
    return sum + (parsed.valid ? parsed.value * Number(d) : 0);
  }, 0);
}

function getDayPoolBills(poolId) {
  const pool = dayPools[poolId];
  if (!pool) return { 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 0 };
  if (pool.cashMode === 'nettotal') {
    const snap = pool.netBillSnapshot || {};
    const out  = {};
    DENOMS.forEach(d => {
      const parsed = parseWholeNumberString(snap[d] ?? '');
      out[d] = parsed.valid ? parsed.value : 0;
    });
    return out;
  }
  const out = {};
  DENOMS.forEach(d => {
    const el     = $('dp-b' + d + '-' + poolId);
    const parsed = parseWholeNumberString(el?.value ?? '');
    out[d] = parsed.valid ? parsed.value : 0;
  });
  return out;
}

function mergeBillPools(poolIds) {
  const merged = { 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 0 };
  for (const id of poolIds) {
    const bills = getDayPoolBills(id);
    DENOMS.forEach(d => { merged[d] += bills[d] || 0; });
  }
  return merged;
}

// ── Day shift: orchestration ──────────────────────────────────────────────────

function autoCalculateDay() {
  const bartenderRows = collectDayStaffRows('bartenderList', 'bartender');
  const serverRows    = collectDayStaffRows('serverList',    'server');

  const partyConfig = {
    party1: { enabled: dayPools.party1.enabled, start: dayPools.party1.windowStart, end: dayPools.party1.windowEnd },
    party2: { enabled: dayPools.party2.enabled, start: dayPools.party2.windowStart, end: dayPools.party2.windowEnd },
  };

  const rawPoolCash = getDayPoolCash();

  // ── Support tip-outs: compute and subtract from each cut's total ──────────
  const supportRows    = collectSupportRows();
  const supportTipOuts = computeAllSupportTipOuts(rawPoolCash, partyConfig, supportRows);

  // Reduce each cut's cash by its support tip-out total
  const poolCash = { ...rawPoolCash };
  Object.entries(supportTipOuts).forEach(([cutId, items]) => {
    const totalTipOut = items.reduce((s, x) => s + x.tipOut, 0);
    if (cutId === 'morning' || cutId === 'middle' || cutId === 'party1' || cutId === 'party2') {
      if (poolCash[cutId] !== null && poolCash[cutId] !== undefined) {
        poolCash[cutId] = Math.max(0, (poolCash[cutId] || 0) - totalTipOut);
      }
    }
  });

  if (!bartenderRows.length && !serverRows.length) {
    currentInputError = '';
    updateHomeLiveDay(null);
    clearStaleBanners();
    if (lastDayResult) renderBlockedPlaceholders('Add day shift staff.');
    saveState();
    return;
  }

  // Pure computation — no side effects
  const engineResult = calculateDayShift(bartenderRows, serverRows, poolCash, partyConfig);

  if (engineResult.error) {
    blockCalculation(engineResult.error, { inputError: true, showPlaceholder: true });
    saveState();
    return;
  }

  const activePoolIds = ['morning', 'middle'];
  if (dayPools.party1.enabled) activePoolIds.push('party1');
  if (dayPools.party2.enabled) activePoolIds.push('party2');

  // Build support people for distribution (have final = sum of tip-outs across cuts)
  const supportForDist = aggregateSupportForDist(supportTipOuts);

  // Distribute bills across ALL people (tipped staff + support)
  const allPeople = [...engineResult.people, ...supportForDist];

  // Compute ideal merged bills from actual person targets so the distribution
  // engine always gets the right small-bill mix regardless of cash entry mode.
  // (Net-total mode fills hidden per-bill inputs with targets=[total], which
  // produces zero $1s/$5s — wrong. Use real person finals instead.)
  const totalCash = activePoolIds.reduce((s, id) => s + (rawPoolCash[id] || 0), 0);
  const targets   = [
    ...allPeople.map(p => p.final).filter(v => v > 0),
    ...(engineResult.leftover > 0 ? [engineResult.leftover] : []),
  ];
  const mergedBills = computeIdealBillsForTargets(totalCash, targets);
  const sc = allPeople.map(p => ({ ...p, bills: { 100:0,50:0,20:0,10:0,5:0,1:0 }, rem: p.final }));
  const dist = distributeBills(sc, mergedBills, engineResult.leftover);

  // Split sc back into regular staff and support
  const nRegular = engineResult.people.length;
  engineResult.people.forEach((p, i) => { p.bills = { ...sc[i].bills }; });
  const supportWithBills = supportForDist.map((p, i) => ({
    ...p,
    bills: { ...sc[nRegular + i].bills },
    rem:   sc[nRegular + i].rem,
  }));
  engineResult.supportPeople = supportWithBills;

  const distResult = {
    staffWithBills:    sc,       // all people including support (for dist tab)
    remainderBills:    dist.remainderBills,
    distributionError: dist.distributionError,
    poolAfter:         dist.poolAfter,
    mergedBills,
  };

  // Attach support tip-out data for rendering/modal use
  engineResult.supportTipOuts = supportTipOuts;
  engineResult.rawPoolCash    = rawPoolCash;

  // Write globals — single location for day shift
  lastDayResult         = engineResult;
  livePool              = mergedBills;
  currentInputError     = '';
  lastRemainderBills    = distResult.remainderBills;
  lastDistributionError = distResult.distributionError;
  lastPoolAfter         = distResult.poolAfter;
  // Expose all staff (including support) for person modal lookup
  _lastDistStaff = distResult.staffWithBills;

  // Render: pass data explicitly
  renderDaySummary(engineResult, distResult);
  renderDayDist(engineResult, distResult);
  updateHomeLiveDay(engineResult, distResult);
  updateSupportTipOutButtons();

  saveState();
}
