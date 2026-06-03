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
  const ptop = $('cash-page-total'), pbot = $('cash-total-bottom');
  if (ptop) { ptop.textContent = '$' + total; ptop.className = 'cash-page-total' + (total ? '' : ' zero'); }
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
  $('cash-per-bill').style.display  = mode === 'perbill'  ? '' : 'none';
  $('cash-net-total').style.display = mode === 'nettotal' ? '' : 'none';
  $('cmb-perbill').classList.toggle('active',  mode === 'perbill');
  $('cmb-nettotal').classList.toggle('active', mode === 'nettotal');
  if (mode === 'nettotal') {
    if ($('net-total-input')) $('net-total-input').value = netTotalSnapshot || '';
    onNetTotalChange({ fromModeSwitch: true });
    setTimeout(() => $('net-total-input').focus(), 50);
  } else {
    writeBillInputSnapshot(perBillSnapshot);
    onBillsChange();
  }
}

function getIdealTargetsForTotal(total) {
  const rows = document.querySelectorAll('#staffList .staff-row-modal');
  const rawData = [];
  const gcIn = $('gc-in')?.value.trim() || '', gcOut = $('gc-out')?.value.trim() || '';
  rows.forEach(r => {
    const name = r.querySelector('[data-field="name"]')?.value.trim();
    if (!name) return;
    const rowId  = r.id.replace('staff', '');
    const inStr  = r.querySelector('[data-field="in"]')?.value.trim()  || '';
    const outStr = r.querySelector('[data-field="out"]')?.value.trim() || '';
    rawData.push({ inStr, outStr, hasOut: !!outStr, rowId });
  });
  if (!rawData.length) return [total];

  rawData.forEach(r => { r.effIn = r.inStr || gcIn; r.effOut = r.outStr || gcOut; });
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
