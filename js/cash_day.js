// Day shift multi-pool cash entry handlers

function getDayPoolActiveIds() {
  const ids = ['morning', 'middle'];
  if (dayPools.party1.enabled) ids.push('party1');
  if (dayPools.party2.enabled) ids.push('party2');
  return ids;
}

// ── Per-pool bill input handlers ──────────────────────────────────────────────

function onDayPoolBillsChange(poolId) {
  const pool = dayPools[poolId];
  if (!pool || pool.cashMode === 'nettotal') return;

  DENOMS.forEach(d => {
    const el    = $('dp-b' + d + '-' + poolId);
    const subEl = $('dp-sub' + d + '-' + poolId);
    if (!el || !subEl) return;
    const parsed = parseWholeNumberString(el.value ?? '');
    const n      = parsed.valid ? parsed.value : 0;
    const sub    = n * d;
    subEl.textContent  = parsed.valid ? (sub > 0 ? '$' + sub : '—') : '!';
    subEl.className    = 'dp-subtotal' + (sub > 0 && parsed.valid ? '' : ' zero');
    setInputInvalid(el, !parsed.valid);
  });

  refreshDayPoolTotal(poolId);
  autoCalculate();
}

function onDayPoolNetTotalChange(poolId) {
  const pool = dayPools[poolId];
  if (!pool) return;

  const el      = $('dp-net-' + poolId);
  const parsed  = parseWholeNumberString(el?.value ?? '');
  const total   = parsed.valid ? parsed.value : 0;

  setInputInvalid(el, !parsed.valid);
  pool.netTotalSnapshot = el?.value || '';

  if (parsed.valid && total > 0) {
    const ideal = computeIdealFromTotal(total);
    DENOMS.forEach(d => {
      const hiddenEl = $('dp-b' + d + '-' + poolId);
      if (hiddenEl) hiddenEl.value = (ideal.pool[d] || 0) > 0 ? ideal.pool[d] : '';
    });
    pool.netBillSnapshot = {};
    DENOMS.forEach(d => { pool.netBillSnapshot[d] = $('dp-b' + d + '-' + poolId)?.value ?? ''; });
  } else {
    DENOMS.forEach(d => {
      const hiddenEl = $('dp-b' + d + '-' + poolId);
      if (hiddenEl) hiddenEl.value = '';
    });
    pool.netBillSnapshot = { 100: '', 50: '', 20: '', 10: '', 5: '', 1: '' };
  }

  refreshDayPoolTotal(poolId);
  autoCalculate();
}

function refreshDayPoolTotal(poolId) {
  const total = getDayPoolTotal(poolId);
  const el    = $('dp-total-' + poolId);
  if (el) {
    el.textContent = '$' + total;
    el.className   = 'dp-pool-total' + (total ? '' : ' zero');
  }
}

function setDayPoolCashMode(poolId, mode) {
  const pool = dayPools[poolId];
  if (!pool) return;
  pool.cashMode = mode;

  const perBillEl  = $('dp-perbill-'  + poolId);
  const netEl      = $('dp-nettotal-' + poolId);
  const btnPer     = $('dp-cmb-per-'  + poolId);
  const btnNet     = $('dp-cmb-net-'  + poolId);

  if (perBillEl)  perBillEl.style.display  = mode === 'perbill'  ? '' : 'none';
  if (netEl)      netEl.style.display      = mode === 'nettotal' ? '' : 'none';
  if (btnPer)     btnPer.classList.toggle('active',  mode === 'perbill');
  if (btnNet)     btnNet.classList.toggle('active',  mode === 'nettotal');

  if (mode === 'nettotal') {
    const netInput = $('dp-net-' + poolId);
    if (netInput) netInput.value = pool.netTotalSnapshot || '';
    onDayPoolNetTotalChange(poolId);
  } else {
    DENOMS.forEach(d => {
      const el = $('dp-b' + d + '-' + poolId);
      if (el) el.value = pool.perBillSnapshot?.[d] ?? '';
    });
    onDayPoolBillsChange(poolId);
  }
}

// ── Party pool toggle ─────────────────────────────────────────────────────────

function togglePartyPool(pid) {
  dayPools[pid].enabled = !dayPools[pid].enabled;
  renderDayPoolCashPanels();
  autoCalculate();
}

function onPartyWindowChange(pid, field) {
  const el = $('dp-pw-' + field + '-' + pid);
  if (!el) return;
  dayPools[pid]['window' + (field === 'start' ? 'Start' : 'End')] = el.value.trim();
  autoCalculate();
}

// ── Render the day shift cash tab ─────────────────────────────────────────────

function renderDayPoolCashPanels() {
  const container = $('day-cash-panels');
  if (!container) return;

  const poolDefs = [
    { id: 'morning', label: 'Morning Cut', windowLabel: 'Auto: earliest in → last server out', optional: false },
    { id: 'middle',  label: 'Middle Cut',  windowLabel: 'Auto: morning end → latest bartender out', optional: false },
    { id: 'party1',  label: 'Party 1',     windowLabel: null, optional: true },
    { id: 'party2',  label: 'Party 2',     windowLabel: null, optional: true },
  ];

  container.innerHTML = poolDefs.map(def => {
    const pool = dayPools[def.id];
    if (def.optional && !pool.enabled) {
      return `<div class="dp-add-party-row">
        <button class="dp-add-party-btn" onclick="togglePartyPool('${def.id}')">+ Add ${def.label}</button>
      </div>`;
    }

    const windowRow = def.optional
      ? `<div class="dp-window-row">
          <div class="dp-window-field">
            <span class="dp-window-lbl">Start</span>
            <input class="dp-window-input" id="dp-pw-start-${def.id}" type="text" inputmode="decimal"
              placeholder="e.g. 11" value="${escapeHTML(pool.windowStart || '')}"
              oninput="onPartyWindowChange('${def.id}','start')">
          </div>
          <span class="dp-window-sep">–</span>
          <div class="dp-window-field">
            <span class="dp-window-lbl">End</span>
            <input class="dp-window-input" id="dp-pw-end-${def.id}" type="text" inputmode="decimal"
              placeholder="e.g. 3" value="${escapeHTML(pool.windowEnd || '')}"
              oninput="onPartyWindowChange('${def.id}','end')">
          </div>
          <button class="dp-remove-party-btn" onclick="togglePartyPool('${def.id}')" title="Remove">✕</button>
        </div>`
      : `<div class="dp-window-auto">${def.windowLabel}</div>`;

    const isNet = pool.cashMode === 'nettotal';

    const perBillRows = DENOMS.map(d =>
      `<div class="dp-denom-row">
        <div class="dp-denom-label">$${d}</div>
        <input class="dp-denom-input" id="dp-b${d}-${def.id}" type="number" min="0" step="1"
          placeholder="0" inputmode="numeric"
          value="${escapeHTML(pool.perBillSnapshot?.[d] ?? '')}"
          oninput="onDayPoolBillsChange('${def.id}')">
        <div class="dp-subtotal zero" id="dp-sub${d}-${def.id}">—</div>
      </div>`
    ).join('');

    const netRow = `<div class="dp-net-row">
      <span class="dp-net-sign">$</span>
      <input type="number" id="dp-net-${def.id}" class="dp-net-input"
        min="0" step="1" placeholder="0" inputmode="numeric"
        value="${escapeHTML(pool.netTotalSnapshot || '')}"
        oninput="onDayPoolNetTotalChange('${def.id}')">
    </div>`;

    return `<div class="dp-pool-card" id="dp-card-${def.id}">
      <div class="dp-pool-card-hdr">
        <div class="dp-pool-card-left">
          <span class="dp-pool-card-name">${escapeHTML(def.label)}</span>
          ${windowRow}
        </div>
        <div class="dp-pool-total-wrap">
          <span class="dp-pool-total zero" id="dp-total-${def.id}">$0</span>
        </div>
      </div>
      <div class="dp-cash-mode-toggle">
        <button class="dp-cmt-btn ${!isNet ? 'active' : ''}" id="dp-cmb-per-${def.id}"
          onclick="setDayPoolCashMode('${def.id}','perbill')">Per Bill</button>
        <button class="dp-cmt-btn ${isNet ? 'active' : ''}" id="dp-cmb-net-${def.id}"
          onclick="setDayPoolCashMode('${def.id}','nettotal')">Net Total</button>
      </div>
      <div id="dp-perbill-${def.id}" ${isNet ? 'style="display:none"' : ''}>
        ${perBillRows}
      </div>
      <div id="dp-nettotal-${def.id}" ${!isNet ? 'style="display:none"' : ''}>
        ${netRow}
      </div>
    </div>`;
  }).join('');

  getDayPoolActiveIds().forEach(id => refreshDayPoolTotal(id));
}

// ── Day shift stock card update ───────────────────────────────────────────────

function updateDayStockCards() {
  const total = getDayPoolActiveIds().reduce((s, id) => s + getDayPoolTotal(id), 0);
  const sc = $('sc-total');
  if (sc) sc.textContent = '$' + total;
  const scSub = $('sc-billcount');
  if (scSub) scSub.textContent = total > 0 ? 'combined' : '—';

  // Use bartenderList for day-shift bartenders (not staffList, which is night-shift only)
  const bartRows = document.querySelectorAll('#bartenderList .staff-row-modal');
  const servRows = document.querySelectorAll('#serverList .staff-row-modal');
  let named = 0;
  [...bartRows, ...servRows].forEach(r => {
    if (r.querySelector('[data-field="name"]').value.trim()) named++;
  });
  const sc2 = $('sc-staffcount'); if (sc2) sc2.textContent = named;
  const spc = $('staffPageCount2'); if (spc) spc.textContent = named + (named === 1 ? ' person' : ' people');
}
