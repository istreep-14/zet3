// ── Shared helpers ────────────────────────────────────────────────────────────

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
  if (lastStaff.length || (lastDayResult) || options.showPlaceholder) {
    renderBlockedPlaceholders(reason);
  }
}

// ── Night shift (existing logic, unchanged) ───────────────────────────────────

function collectNamedStaffRows() {
  const rows = document.querySelectorAll('#staffList .staff-row-modal');
  const gcIn = $('gc-in').value.trim(), gcOut = $('gc-out').value.trim();
  const errors = [];
  const gcInParsed = parseTimeString(gcIn), gcOutParsed = parseTimeString(gcOut);
  setInputInvalid($('gc-in'), !!gcIn && !gcInParsed.valid);
  setInputInvalid($('gc-out'), !!gcOut && !gcOutParsed.valid);
  if (gcIn && !gcInParsed.valid) errors.push('Default In must be a valid 0–12 time.');
  if (gcOut && !gcOutParsed.valid) errors.push('Default Out must be a valid 0–12 time.');

  const rawData = [];
  rows.forEach(r => {
    const name   = r.querySelector('[data-field="name"]').value.trim();
    const inEl   = r.querySelector('[data-field="in"]');
    const outEl  = r.querySelector('[data-field="out"]');
    const inStr  = inEl.value.trim();
    const outStr = outEl.value.trim();
    const inParsed = parseTimeString(inStr);
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
  const { rawData, gcIn, gcOut, errors } = collectNamedStaffRows();
  if (!rawData.length) {
    blockCalculation('Add staff with names.');
    if (!silent) alert('Add staff with names');
    return;
  }
  if (errors.length) {
    blockCalculation(errors[0], { inputError: true, showPlaceholder: true });
    if (!silent) alert(errors[0]);
    return;
  }
  rawData.forEach(r => { r.effIn = r.inStr || gcIn; r.effOut = r.outStr || gcOut; });

  let maxEo = 0;
  rawData.forEach(r => {
    if (r.effIn && r.effOut) {
      const i = parseTimeString(r.effIn).value, o = parseTimeString(r.effOut).value;
      const eo = o < i ? o + 12 : o;
      if (eo > maxEo) maxEo = eo;
    }
  });
  const defaultIn  = 5;
  const defaultOut = maxEo > 0 ? (maxEo > 12 ? maxEo - 12 : maxEo) : 2;

  const staff = rawData.map(r => {
    const inParsed  = parseTimeString(r.effIn);
    const outParsed = parseTimeString(r.effOut);
    const inVal  = inParsed.empty  ? defaultIn  : inParsed.value;
    const outVal = outParsed.empty ? defaultOut : outParsed.value;
    let h = outVal - inVal; if (h < 0) h += 12;
    const eo         = outVal < inVal ? outVal + 12 : outVal;
    const autoCloser = !r.hasOut;
    return { n: r.name, i: inVal, o: outVal, h, eo, _rowId: r.rowId, _autoCloser: autoCloser,
             bills: { 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 0 } };
  });

  const invalidStaff = staff.find(p => p.h <= 0 || p.h > 12);
  if (invalidStaff) {
    const message = invalidStaff.n + ' has invalid shift hours.';
    blockCalculation(message, { inputError: true, showPlaceholder: true });
    if (!silent) alert(message);
    return;
  }

  const total = getTotal();
  const totH  = staff.reduce((s, p) => s + p.h, 0);
  if (totH <= 0) {
    blockCalculation('Add valid staff hours.', { inputError: true, showPlaceholder: true });
    if (!silent) alert('Add valid staff hours');
    return;
  }

  const rate = total / totH;
  staff.forEach(p => {
    p.exact = p.h * rate; p.base = Math.floor(p.exact); p.bonus = 0;
    const ctEl = document.getElementById('ct' + p._rowId);
    p.closer   = (ctEl ? ctEl.classList.contains('on') : false) || p._autoCloser;
  });

  const floored   = staff.reduce((s, p) => s + p.base, 0);
  const remainder = total - floored;
  const closers   = staff.filter(p => p.closer);
  const perCloser = closers.length ? Math.floor(remainder / closers.length) : 0;
  const leftover  = remainder - perCloser * closers.length;
  closers.forEach(p => { p.bonus = perCloser; });
  staff.forEach(p => { p.final = p.base + p.bonus; p.rem = p.final; });

  livePool     = getInputPool();
  lastStaff    = staff;
  lastTotal    = total;
  lastTotH     = totH;
  lastRate     = rate;
  lastLeftover = leftover;

  renderAll(staff, total, totH, rate, leftover);
  if (!silent) switchTab('summary', $('tb-summary'));
}

function renderAll(staff, total, totH, rate, leftover) {
  currentInputError = '';
  const sc = staff.map(p => ({ ...p, bills: {}, rem: p.final }));
  const pa = distributeBills(sc, { ...livePool }, leftover);
  renderSummary(sc, staff, total, totH, rate, leftover, pa);
  renderDist(sc, pa);
  updateHomeLive(staff);
}

// ── Day shift orchestration ───────────────────────────────────────────────────

function collectDayStaffRows(listId, role) {
  const rows = document.querySelectorAll('#' + listId + ' .staff-row-modal');
  const gcIn  = ($('gc-in').value  || '').trim();
  const gcOut = ($('gc-out').value || '').trim();
  const result = [];

  rows.forEach(r => {
    const name   = r.querySelector('[data-field="name"]').value.trim();
    const inEl   = r.querySelector('[data-field="in"]');
    const outEl  = r.querySelector('[data-field="out"]');
    const inStr  = inEl.value.trim() || gcIn;
    const outStr = outEl.value.trim() || gcOut;
    const ctEl   = r.querySelector('.sri-closer');

    if (!name) return;

    result.push({
      name,
      inStr,
      outStr,
      rowId:  r.id.replace('staff', '').replace('server', ''),
      closer: ctEl ? ctEl.classList.contains('on') : false,
      role,
    });
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
  // Read from the pool's bill inputs (prefixed with poolId)
  const pool = dayPools[poolId];
  if (!pool) return 0;
  if (pool.cashMode === 'nettotal') {
    const el = $('dp-net-' + poolId);
    const parsed = parseWholeNumberString(el?.value ?? '');
    return parsed.valid ? parsed.value : 0;
  }
  return ['100','50','20','10','5','1'].reduce((sum, d) => {
    const el = $('dp-b' + d + '-' + poolId);
    const parsed = parseWholeNumberString(el?.value ?? '');
    return sum + (parsed.valid ? parsed.value * Number(d) : 0);
  }, 0);
}

function getDayPoolBills(poolId) {
  const pool = dayPools[poolId];
  if (!pool) return { 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 0 };
  if (pool.cashMode === 'nettotal') {
    // Use the ideal breakdown stored in netBillSnapshot
    const snap = pool.netBillSnapshot || {};
    const out = {};
    DENOMS.forEach(d => {
      const parsed = parseWholeNumberString(snap[d] ?? '');
      out[d] = parsed.valid ? parsed.value : 0;
    });
    return out;
  }
  const out = {};
  DENOMS.forEach(d => {
    const el = $('dp-b' + d + '-' + poolId);
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

function autoCalculateDay() {
  const bartenderRows = collectDayStaffRows('staffList',   'bartender');
  const serverRows    = collectDayStaffRows('serverList',  'server');

  const partyConfig = {
    party1: { enabled: dayPools.party1.enabled, start: dayPools.party1.windowStart, end: dayPools.party1.windowEnd },
    party2: { enabled: dayPools.party2.enabled, start: dayPools.party2.windowStart, end: dayPools.party2.windowEnd },
  };

  const poolCash = getDayPoolCash();

  if (!bartenderRows.length && !serverRows.length) {
    currentInputError = '';
    updateHomeLiveDay(null);
    clearStaleBanners();
    if (lastDayResult) renderBlockedPlaceholders('Add day shift staff.');
    saveState();
    return;
  }

  const result = calculateDayShift(bartenderRows, serverRows, poolCash, partyConfig);

  if (result.error) {
    blockCalculation(result.error, { inputError: true, showPlaceholder: true });
    saveState();
    return;
  }

  // Merge all active pool bills for distribution
  const activePoolIds = ['morning', 'middle'];
  if (dayPools.party1.enabled) activePoolIds.push('party1');
  if (dayPools.party2.enabled) activePoolIds.push('party2');
  const mergedBills = mergeBillPools(activePoolIds);

  // Run bill distribution on combined cash
  const sc = result.people.map(p => ({ ...p, bills: { 100:0,50:0,20:0,10:0,5:0,1:0 }, rem: p.final }));
  distributeBills(sc, mergedBills, result.leftover);

  // Copy bills back to result.people
  result.people.forEach((p, i) => { p.bills = { ...sc[i].bills }; });

  lastDayResult = result;
  livePool      = mergedBills;
  currentInputError = '';

  renderDaySummary(result);
  renderDayDist(result);
  updateHomeLiveDay(result);
  saveState();
}
