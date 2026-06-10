function getTotal() {
  return getVal('b100') * 100 + getVal('b50') * 50 + getVal('b20') * 20
       + getVal('b10') * 10  + getVal('b5')  * 5  + getVal('b1');
}

function getInputPool() {
  return { 100: getVal('b100'), 50: getVal('b50'), 20: getVal('b20'),
           10:  getVal('b10'),  5:  getVal('b5'),  1:  getVal('b1') };
}

function readBillInputSnapshot() {
  const snap = {};
  DENOMS.forEach(d => { snap[d] = $('b' + d)?.value ?? ''; });
  return snap;
}

function writeBillInputSnapshot(snap) {
  DENOMS.forEach(d => {
    const el = $('b' + d);
    if (el) el.value = snap?.[d] ?? '';
  });
}

function snapshotCurrentCashMode() {
  if (cashMode === 'nettotal') {
    netTotalSnapshot = $('net-total-input')?.value ?? '';
    netBillSnapshot = readBillInputSnapshot();
  } else {
    perBillSnapshot = readBillInputSnapshot();
  }
}

function refreshCashTotals(total) {
  const ptop = $('cash-page-total');
  if (ptop) { ptop.textContent = '$' + total; ptop.className = 'cash-page-total' + (total ? '' : ' zero'); }
  const pbot = $('cash-total-bottom');
  if (pbot) { pbot.textContent = '$' + total; pbot.className = 'cash-total-val' + (total ? '' : ' zero'); }
}

function setCashError(message) {
  const el = $('cash-error');
  if (!el) return;
  el.textContent = message || '';
  el.classList.toggle('visible', !!message);
}

function validateCashInputs() {
  let valid = true;
  let total = 0;

  if (cashMode === 'nettotal') {
    const el = $('net-total-input');
    const parsed = parseWholeNumberString(el?.value ?? '');
    valid = parsed.valid;
    total = parsed.valid ? parsed.value : 0;
    setInputInvalid(el, !parsed.valid);
    DENOMS.forEach(d => setInputInvalid($('b' + d), false));
    setCashError(valid ? '' : 'Net total must be a whole-dollar amount.');
    return { valid, total, message: 'Net total must be a whole-dollar amount.' };
  }

  setInputInvalid($('net-total-input'), false);
  DENOMS.forEach(d => {
    const el = $('b' + d);
    const parsed = parseWholeNumberString(el?.value ?? '');
    setInputInvalid(el, !parsed.valid);
    if (!parsed.valid) valid = false;
    total += parsed.valid ? parsed.value * d : 0;
  });
  setCashError(valid ? '' : 'Bill counts must be whole numbers.');
  return { valid, total, message: 'Bill counts must be whole numbers.' };
}

function onBillsChange() {
  if (cashMode === 'nettotal') return;
  perBillSnapshot = readBillInputSnapshot();
  const validation = validateCashInputs();
  const total = validation.total;
  DENOMS.forEach(d => {
    const parsed = parseWholeNumberString($('b' + d)?.value ?? '');
    const n = parsed.valid ? parsed.value : 0, sub = n * d;
    const el = $('sub' + d);
    if (el) {
      el.textContent = parsed.valid ? (sub > 0 ? '$' + sub : '—') : '!';
      el.className = 'cash-denom-subtotal' + (sub > 0 && parsed.valid ? '' : ' zero');
    }
  });
  refreshCashTotals(total);
  updateStockCards(); updateTabIndicators(); scheduleCalculate();
}

function setCashMode(mode) {
  if (mode !== cashMode) snapshotCurrentCashMode();
  cashMode = mode;
  document.querySelector('.cash-mode-toggle')?.classList.remove('open');
  const perBillEl  = $('cash-per-bill');
  const netEl      = $('cash-net-total');
  const btnPer     = $('cmb-perbill');
  const btnNet     = $('cmb-nettotal');
  if (perBillEl) perBillEl.style.display  = mode === 'perbill'  ? '' : 'none';
  if (netEl)     netEl.style.display      = mode === 'nettotal' ? '' : 'none';
  if (btnPer)    btnPer.classList.toggle('active',  mode === 'perbill');
  if (btnNet)    btnNet.classList.toggle('active',  mode === 'nettotal');
  if (mode === 'nettotal') {
    const inp = $('net-total-input');
    if (inp) inp.value = netTotalSnapshot || '';
    onNetTotalChange({ fromModeSwitch: true });
    setTimeout(() => $('net-total-input')?.focus(), 50);
  } else {
    writeBillInputSnapshot(perBillSnapshot);
    onBillsChange();
  }
}

function onCashModeButtonClick(mode) {
  const toggle = document.querySelector('.cash-mode-toggle');
  if (mode === cashMode && toggle && !toggle.classList.contains('open')) {
    toggle.classList.add('open');
    return;
  }
  setCashMode(mode);
}

function getIdealTargetsForTotal(total) {
  const rows = document.querySelectorAll('#staffList .staff-row-modal, #nightServerList .staff-row-modal');
  const rawData = [];
  const gcIn = $('gc-in')?.value.trim() || '', gcOut = $('gc-out')?.value.trim() || '';
  rows.forEach(r => {
    const name = r.querySelector('[data-field="name"]')?.value.trim();
    if (!name) return;
    const rowId  = r.id.replace('staff', '');
    const inStr  = r.querySelector('[data-field="in"]')?.value.trim()  || '';
    const outStr = r.querySelector('[data-field="out"]')?.value.trim() || '';
    const role = (typeof getRoleForList === 'function' && typeof _listIdForRowId === 'function')
      ? getRoleForList(_listIdForRowId(rowId))
      : 'bartender';
    const rDef = roleDefaults[role] || {};
    rawData.push({ inStr, outStr, hasOut: !!outStr, rowId, role, rDef });
  });
  if (!rawData.length) return [total];

  rawData.forEach(r => {
    r.effIn = r.inStr || r.rDef.in || gcIn;
    r.effOut = r.outStr || r.rDef.out || gcOut;
  });
  let maxEo = 0;
  rawData.forEach(r => {
    if (!r.effIn || !r.effOut) return;
    const inParsed = parseTimeString(r.effIn), outParsed = parseTimeString(r.effOut);
    if (!inParsed.valid || !outParsed.valid || inParsed.empty || outParsed.empty) return;
    const i = inParsed.value, o = outParsed.value;
    const eo = o < i ? o + 12 : o;
    if (eo > maxEo) maxEo = eo;
  });

  const defaultIn = 5;
  const defaultOut = maxEo > 0 ? (maxEo > 12 ? maxEo - 12 : maxEo) : 2;
  const staff = rawData.map(r => {
    const inParsed = parseTimeString(r.effIn);
    const outParsed = parseTimeString(r.effOut);
    if (!inParsed.valid || !outParsed.valid) return null;
    const inVal = inParsed.empty ? defaultIn : inParsed.value;
    const outVal = outParsed.empty ? defaultOut : outParsed.value;
    let h = outVal - inVal;
    if (h < 0) h += 12;
    if (h <= 0 || h > 12) return null;
    const ctEl = document.getElementById('ct' + r.rowId);
    const manualCloser = ctEl ? ctEl.classList.contains('on') : false;
    return { h, closer: manualCloser || !r.hasOut };
  }).filter(Boolean);

  const totH = staff.reduce((s, p) => s + p.h, 0);
  if (totH <= 0) return [total];

  const rate = total / totH;
  staff.forEach(p => { p.base = Math.floor(p.h * rate); p.bonus = 0; });
  const floored = staff.reduce((s, p) => s + p.base, 0);
  const remainder = total - floored;
  const closers = staff.filter(p => p.closer);
  const perCloser = closers.length ? Math.floor(remainder / closers.length) : 0;
  const leftover = remainder - perCloser * closers.length;
  closers.forEach(p => { p.bonus = perCloser; });

  const targets = staff.map(p => p.base + p.bonus);
  if (leftover > 0) targets.push(leftover);
  return targets.filter(v => v > 0);
}

function computeIdealFromTotal(total) {
  const pool = { 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 0 };
  if (total <= 0) return { pool, targets: [], minimums: { ones: 0, fives: 0, tens: 0 } };

  const targets = getIdealTargetsForTotal(total);
  const minOnes = targets.reduce((sum, amt) => sum + (amt % 5), 0);
  const minMod10Val = targets.reduce((sum, amt) => sum + (amt % 10), 0);
  const minFives = Math.max(0, (minMod10Val - minOnes) / 5);
  const minTens = targets.filter(amt => Math.floor(amt / 10) % 2 !== 0).length;
  const reserved = minOnes + minFives * 5 + minTens * 10;

  if (reserved <= total) {
    pool[1] = minOnes;
    pool[5] = minFives;
    pool[10] = minTens;
    pool[20] = Math.floor((total - reserved) / 20);
    return { pool, targets, minimums: { ones: minOnes, fives: minFives, tens: minTens } };
  }

  let rem = total;
  pool[20] = Math.floor(rem / 20); rem -= pool[20] * 20;
  pool[10] = Math.floor(rem / 10); rem -= pool[10] * 10;
  pool[5]  = Math.floor(rem / 5);  rem -= pool[5] * 5;
  pool[1]  = rem;
  return { pool, targets, minimums: { ones: pool[1], fives: pool[5], tens: pool[10] } };
}

// Compute ideal bill breakdown for a given total and explicit target array.
// Unlike computeIdealFromTotal, this takes targets directly (no DOM read).
function computeIdealBillsForTargets(total, targets) {
  const pool = { 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 0 };
  if (total <= 0 || !targets.length) return pool;

  const minOnes     = targets.reduce((s, amt) => s + (amt % 5), 0);
  const minMod10Val = targets.reduce((s, amt) => s + (amt % 10), 0);
  const minFives    = Math.max(0, (minMod10Val - minOnes) / 5);
  const minTens     = targets.filter(amt => Math.floor(amt / 10) % 2 !== 0).length;
  const reserved    = minOnes + minFives * 5 + minTens * 10;

  if (reserved <= total) {
    pool[1]  = minOnes;
    pool[5]  = minFives;
    pool[10] = minTens;
    pool[20] = Math.floor((total - reserved) / 20);
    return pool;
  }
  // fallback: greedy
  let rem  = total;
  pool[20] = Math.floor(rem / 20); rem -= pool[20] * 20;
  pool[10] = Math.floor(rem / 10); rem -= pool[10] * 10;
  pool[5]  = Math.floor(rem / 5);  rem -= pool[5]  * 5;
  pool[1]  = rem;
  return pool;
}

function renderNetBreakdown(total, ideal) {
  const bd = $('net-breakdown');
  if (!bd) return;
  if (total <= 0) {
    bd.innerHTML = '<div class="net-empty-hint">Enter total above to see ideal breakdown</div>';
    return;
  }

  const labels = {
    20: 'fill after minimums',
    1:  'minimum $1s',
    5:  'minimum $5s',
    10: 'minimum $10s'
  };
  const denomRows = [20, 1, 5, 10].map(d => {
    const n = ideal.pool[d] || 0;
    if (!n) return '';
    const sub = n * d;
    return `<div class="net-denom-row"><span class="ndr-lbl">$${d}</span><span class="ndr-times">×</span><span class="ndr-count">${n}<span class="ndr-note">${labels[d]}</span></span><span class="ndr-sub">$${sub}</span></div>`;
  }).filter(Boolean).join('');
  const targetLabel = ideal.targets.length > 1 ? ideal.targets.length + ' targets incl. remainder' : 'single total target';
  bd.innerHTML = `<div class="net-breakdown-hdr">Ideal breakdown · $${total} total · ${targetLabel}</div>${denomRows || '<div class="net-empty-hint">—</div>'}`;
}

function refreshNetTotalBreakdown() {
  if (cashMode !== 'nettotal') return;
  isUpdatingNetTotal = true;
  onNetTotalChange();
  isUpdatingNetTotal = false;
}

// ── Bill trade helpers ────────────────────────────────────────────────────────

// Computes a "trade-up" plan: convert excess $1s/$5s/$10s into $20s.
// Returns { newPool, delta, new20s } or null if no $20s can be gained.
function computeTradeUp(pool, req) {
  const minFives = Math.max(0, (req.minOneFiveValue - req.minOnes) / 5);
  const minTens  = Math.max(0, (req.minOneFiveTenValue - req.minOneFiveValue) / 10);

  const excessOnes  = Math.max(0, (pool[1]  || 0) - req.minOnes);
  const excessFives = Math.max(0, (pool[5]  || 0) - minFives);
  const excessTens  = Math.max(0, (pool[10] || 0) - minTens);
  const totalExcess = excessOnes + excessFives * 5 + excessTens * 10;

  const new20s = Math.floor(totalExcess / 20);
  if (new20s <= 0) return null;

  // Distribute remaining excess (< $20) back into smallest denominations
  let rem = totalExcess - new20s * 20;
  const keepExtra10 = Math.min(excessTens,  Math.floor(rem / 10)); rem -= keepExtra10 * 10;
  const keepExtra5  = Math.min(excessFives, Math.floor(rem / 5));  rem -= keepExtra5 * 5;

  // Build new pool by removing only the excess that was traded, then adding back kept amounts.
  // Using pool[d] - excess[d] + kept[d] instead of min[d] + kept[d] prevents phantom bills
  // when pool[d] < min[d] (distribution still succeeded via other denominations).
  const newPool = {
    100: pool[100] || 0,
    50:  pool[50]  || 0,
    20:  (pool[20] || 0) + new20s,
    10:  (pool[10] || 0) - excessTens  + keepExtra10,
    5:   (pool[5]  || 0) - excessFives + keepExtra5,
    1:   (pool[1]  || 0) - excessOnes  + rem,
  };

  const delta = {};
  DENOMS.forEach(d => { delta[d] = (newPool[d] || 0) - (pool[d] || 0); });

  return { newPool, delta, new20s };
}

// Writes a new bill count pool to the per-bill inputs and triggers recalculation.
// Switches to per-bill mode if currently in net-total mode.
function applyBillTradeToInputs(newPool) {
  if (cashMode !== 'perbill') setCashMode('perbill');
  DENOMS.forEach(d => {
    const el = $('b' + d);
    if (el) el.value = (newPool[d] || 0) > 0 ? String(newPool[d]) : '';
  });
  perBillSnapshot = readBillInputSnapshot();
  onBillsChange();
}

function onNetTotalChange() {
  const validation = validateCashInputs();
  const total = validation.total;
  netTotalSnapshot = $('net-total-input').value || '';
  if (!validation.valid) {
    DENOMS.forEach(d => { const el = $('b' + d); if (el) el.value = ''; });
    netBillSnapshot = readBillInputSnapshot();
    refreshCashTotals(0);
    updateStockCards(); updateTabIndicators();
    renderNetBreakdown(0, { pool: {}, targets: [] });
    if (!isUpdatingNetTotal) scheduleCalculate();
    return;
  }
  const ideal = computeIdealFromTotal(total);
  const pool = ideal.pool;
  DENOMS.forEach(d => { const el = $('b' + d); if (el) el.value = (pool[d] || 0) > 0 ? pool[d] : ''; });
  netBillSnapshot = readBillInputSnapshot();
  refreshCashTotals(total);
  updateStockCards(); updateTabIndicators();
  renderNetBreakdown(total, ideal);
  if (!isUpdatingNetTotal) scheduleCalculate();
}

function renderCashSmallBills() {
  const el = $('cash-small-bills');
  if (!el || shiftMode !== 'night' || cashMode !== 'perbill') {
    if (el) el.innerHTML = '';
    return;
  }

  if (!lastStaff || !lastStaff.length || !getTotal()) {
    el.innerHTML = '<div class="cash-small-bills-empty">Add staff and bill counts to see small-bill guidance.</div>';
    return;
  }

  const pool = getInputPool();
  const req = getSmallBillRequirements(lastStaff, pool, lastLeftover || 0);
  el.innerHTML = renderRequirementSummary(req, pool, { compact: true });
}
