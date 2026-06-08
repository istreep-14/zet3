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

  // Snapshot so re-renders restore the live values
  pool.perBillSnapshot = {};
  DENOMS.forEach(d => {
    const el = $('dp-b' + d + '-' + poolId);
    pool.perBillSnapshot[d] = el ? (el.value || '') : '';
  });

  refreshDayPoolTotal(poolId);
  scheduleCalculate();
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
  scheduleCalculate();
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
  // Auto-open newly enabled party pools
  if (dayPools[pid].enabled) selectedDayPool = pid;
  renderDayPoolCashPanels();
  autoCalculate();
}

function onPartyWindowChange(pid, field) {
  const el = $('dp-pw-' + field + '-' + pid);
  if (!el) return;
  dayPools[pid]['window' + (field === 'start' ? 'Start' : 'End')] = el.value.trim();
  // Keep the collapsed-state header subtitle in sync while typing
  const card = $('dp-card-' + pid);
  if (card) {
    const sub = card.querySelector('.dp-window-auto');
    if (sub) {
      const pool = dayPools[pid];
      sub.textContent = (pool.windowStart || '?') + ' \u2013 ' + (pool.windowEnd || '?');
    }
  }
  autoCalculate();
}

// ── Accordion: expand one pool at a time without re-rendering ─────────────────

function selectDayPool(poolId) {
  if (selectedDayPool === poolId) return;
  selectedDayPool = poolId;
  document.querySelectorAll('#day-cash-panels .dp-pool-card').forEach(card => {
    const id   = card.id.replace('dp-card-', '');
    const open = id === poolId;
    card.classList.toggle('dp-pool-card--open', open);
    const body = card.querySelector('.dp-pool-body');
    if (body) body.style.display = open ? '' : 'none';
  });
}

// ── Render the day shift cash tab ─────────────────────────────────────────────

function renderDayPoolCashPanels() {
  const container = $('day-cash-panels');
  if (!container) return;

  const poolDefs = [
    { id: 'morning', label: 'Morning Cut', windowLabel: 'Earliest in \u2192 last server out',      optional: false },
    { id: 'middle',  label: 'Middle Cut',  windowLabel: 'Morning end \u2192 latest bartender out', optional: false },
    { id: 'party1',  label: 'Party 1',     windowLabel: null, optional: true },
    { id: 'party2',  label: 'Party 2',     windowLabel: null, optional: true },
  ];

  container.innerHTML = poolDefs.map(def => {
    const pool = dayPools[def.id];

    // Disabled optional pool — render an add-button placeholder
    if (def.optional && !pool.enabled) {
      return `<button class="dp-add-party-btn" onclick="togglePartyPool('${def.id}')">+ Add ${def.label}</button>`;
    }

    const isOpen = selectedDayPool === def.id;
    const total  = getDayPoolTotal(def.id);
    pool.cashMode = 'nettotal'; // day shift always uses net total

    // Header subtitle — auto label for fixed pools, live times for party pools
    const headerSub = def.optional
      ? escapeHTML((pool.windowStart || '?') + ' \u2013 ' + (pool.windowEnd || '?'))
      : def.windowLabel;

    // Window time inputs — only rendered inside the body of optional pools
    const windowBodyHTML = def.optional
      ? `<div class="dp-window-row">
          <div class="dp-window-field">
            <span class="dp-window-lbl">Start</span>
            <input class="dp-window-input" id="dp-pw-start-${def.id}" type="text" inputmode="decimal"
              placeholder="e.g. 11" value="${escapeHTML(pool.windowStart || '')}"
              oninput="onPartyWindowChange('${def.id}','start')">
          </div>
          <span class="dp-window-sep">&ndash;</span>
          <div class="dp-window-field">
            <span class="dp-window-lbl">End</span>
            <input class="dp-window-input" id="dp-pw-end-${def.id}" type="text" inputmode="decimal"
              placeholder="e.g. 3" value="${escapeHTML(pool.windowEnd || '')}"
              oninput="onPartyWindowChange('${def.id}','end')">
          </div>
          <button class="dp-remove-party-btn" onclick="togglePartyPool('${def.id}')" title="Remove">&#x2715;</button>
        </div>`
      : '';

    // Per-bill denomination rows
    const perBillRows = DENOMS.map(d =>
      `<div class="dp-denom-row">
        <div class="dp-denom-label">$${d}</div>
        <input class="dp-denom-input" id="dp-b${d}-${def.id}" type="number" min="0" step="1"
          placeholder="0" inputmode="numeric"
          value="${escapeHTML(pool.perBillSnapshot?.[d] ?? '')}"
          oninput="onDayPoolBillsChange('${def.id}')">
        <div class="dp-subtotal zero" id="dp-sub${d}-${def.id}">&mdash;</div>
      </div>`
    ).join('');

    // Net total input
    const netRow = `<div class="dp-net-row">
      <span class="dp-net-sign">$</span>
      <input type="number" id="dp-net-${def.id}" class="dp-net-input"
        min="0" step="1" placeholder="0" inputmode="numeric"
        value="${escapeHTML(pool.netTotalSnapshot || '')}"
        oninput="onDayPoolNetTotalChange('${def.id}')">
    </div>`;

    return `<div class="dp-pool-card${isOpen ? ' dp-pool-card--open' : ''}" id="dp-card-${def.id}">
      <button class="dp-pool-card-hdr" onclick="selectDayPool('${def.id}')">
        <div class="dp-pool-card-left">
          <span class="dp-pool-card-name">${escapeHTML(def.label)}</span>
          <span class="dp-window-auto">${headerSub}</span>
        </div>
        <div class="dp-pool-hdr-right">
          <span class="dp-pool-total${total ? '' : ' zero'}" id="dp-total-${def.id}">$${total}</span>
          <span class="dp-pool-chevron"></span>
        </div>
      </button>
      <div class="dp-pool-body"${isOpen ? '' : ' style="display:none"'}>
        ${windowBodyHTML}
        <div id="dp-perbill-${def.id}" style="display:none">${perBillRows}</div>
        <div id="dp-nettotal-${def.id}">${netRow}</div>
        <button class="dp-support-btn" id="dp-sup-btn-${def.id}" onclick="openSupportTipOutModal('${def.id}')" style="display:none">Support Tip-Out</button>
      </div>
    </div>`;
  }).join('');

  getDayPoolActiveIds().forEach(id => refreshDayPoolTotal(id));
}

// ── Support tip-out button visibility ────────────────────────────────────────

function updateSupportTipOutButtons() {
  const activeIds = getDayPoolActiveIds();
  activeIds.forEach(cutId => {
    const btn = $('dp-sup-btn-' + cutId);
    if (!btn) return;
    const rows = document.querySelectorAll('#supportList .staff-row-modal');
    const hasAssigned = [...rows].some(r => {
      const rowId = r.id.replace('staff', '');
      const name  = r.querySelector('[data-field="name"]').value.trim();
      return name && (supportCutAssignments[rowId] || []).includes(cutId);
    });
    btn.style.display = hasAssigned ? '' : 'none';
    if (hasAssigned) {
      const tipOuts = lastDayResult?.supportTipOuts?.[cutId] || [];
      const total   = tipOuts.reduce((s, x) => s + x.tipOut, 0);
      btn.textContent = total > 0
        ? 'Support Tip-Out · $' + total + ' out'
        : 'Support Tip-Out';
    }
  });
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
