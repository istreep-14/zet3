// Cash tab — accordion of pool cards. One pool reads like the old night
// shift; "+ Add Pool" appends another with its own window/roles/cash.
// Structural changes re-render; keystrokes patch totals in place.

import { DENOMS, escapeHTML, poolValue, parseWholeNumber } from '../util.js';
import { fmtTimeAbs } from '../time.js';

const $ = id => document.getElementById(id);

let lastSignature = '';

function poolTotal(resolvedPools, id) {
  const pool = resolvedPools.find(p => p.id === id);
  return pool ? pool.total : 0;
}

function windowSub(pool, vmPool) {
  const start = pool.window.start.trim();
  const end = pool.window.end.trim();
  if (!start && !end) return 'whole shift';
  const fmt = (raw, abs) => raw ? escapeHTML(raw) : (abs != null ? fmtTimeAbs(abs) : '?');
  return fmt(start, vmPool?.startAbs) + ' – ' + fmt(end, vmPool?.endAbs);
}

function roleChipsHTML(pool) {
  const chips = [
    { key: 'bartender', label: 'Bar', on: pool.roles.bartender },
    { key: 'server', label: 'Srv', on: pool.roles.server },
    { key: 'support', label: 'Sup', on: pool.includeSupport },
  ];
  return chips.map(c =>
    `<button class="sup-cut-chip${c.on ? ' active' : ''}" onclick="App.poolRole('${pool.id}','${c.key}')">${c.label}</button>`
  ).join('');
}

function cardHTML(pool, vm, isOpen, removable) {
  const vmPool = vm.pools.find(p => p.id === pool.id);
  const total = vmPool ? vmPool.total : 0;
  const mode = pool.cash.entryMode;

  const perBillRows = DENOMS.map(d => {
    const v = pool.cash.billCounts[d] ?? '';
    const parsed = parseWholeNumber(v);
    const sub = parsed.valid ? parsed.value * d : 0;
    return `<div class="dp-denom-row">
      <div class="dp-denom-label">$${d}</div>
      <input class="dp-denom-input" data-bill="${d}" type="number" min="0" step="1" placeholder="0" inputmode="numeric"
        value="${escapeHTML(String(v))}" oninput="App.poolBill('${pool.id}','${d}',this.value)">
      <div class="dp-subtotal${sub > 0 ? '' : ' zero'}" data-sub="${d}">${parsed.valid ? (sub > 0 ? '$' + sub : '—') : '!'}</div>
    </div>`;
  }).join('');

  const netRow = `<div class="dp-net-row">
    <span class="dp-net-sign">$</span>
    <input type="number" class="dp-net-input" data-net min="0" step="1" placeholder="0" inputmode="numeric"
      value="${escapeHTML(pool.cash.netTotal)}" oninput="App.poolNet('${pool.id}',this.value)">
  </div>`;

  const removeBtn = removable
    ? `<button class="dp-remove-party-btn" onclick="App.removePool('${pool.id}')" title="Remove pool">✕</button>`
    : '';

  return `<div class="dp-pool-card${isOpen ? ' dp-pool-card--open' : ''}" data-pid="${pool.id}">
    <button class="dp-pool-card-hdr" onclick="App.selectPool('${pool.id}')">
      <div class="dp-pool-card-left">
        <span class="dp-pool-card-name" data-pool-name>${escapeHTML(pool.label)}</span>
        <span class="dp-window-auto" data-window-sub>${windowSub(pool, vmPool)}</span>
      </div>
      <div class="dp-pool-hdr-right">
        <span class="dp-pool-total${total ? '' : ' zero'}" data-pool-total>$${total}</span>
        <span class="dp-pool-chevron"></span>
      </div>
    </button>
    <div class="dp-pool-body"${isOpen ? '' : ' style="display:none"'}>
      <div class="dp-window-row">
        <div class="dp-window-field">
          <span class="dp-window-lbl">Label</span>
          <input class="dp-window-input" type="text" value="${escapeHTML(pool.label)}"
            oninput="App.poolLabel('${pool.id}',this.value)">
        </div>
        ${removeBtn}
      </div>
      <div class="dp-window-row">
        <div class="dp-window-field">
          <span class="dp-window-lbl">Start</span>
          <input class="dp-window-input" type="text" inputmode="decimal" placeholder="open"
            value="${escapeHTML(pool.window.start)}" oninput="App.poolWindow('${pool.id}','start',this.value)">
        </div>
        <span class="dp-window-sep">–</span>
        <div class="dp-window-field">
          <span class="dp-window-lbl">End</span>
          <input class="dp-window-input" type="text" inputmode="decimal" placeholder="close"
            value="${escapeHTML(pool.window.end)}" oninput="App.poolWindow('${pool.id}','end',this.value)">
        </div>
      </div>
      <div class="pool-role-row">${roleChipsHTML(pool)}</div>
      ${mode === 'perbill' ? perBillRows : netRow}
      <div class="cash-mode-toggle cash-mode-toggle--bottom">
        <button class="cmt-btn${mode === 'nettotal' ? ' active' : ''}" onclick="App.poolMode('${pool.id}','nettotal')">Net Total</button>
        <button class="cmt-btn${mode === 'perbill' ? ' active' : ''}" onclick="App.poolMode('${pool.id}','perbill')">Bill Counts</button>
      </div>
    </div>
  </div>`;
}

// Ideal-bill breakdown card — shown for single-pool net-total sessions, like
// the old night shift cash tab.
function breakdownHTML(vm) {
  if (vm.state.pools.length !== 1) return '';
  if (vm.state.pools[0].cash.entryMode !== 'nettotal') return '';
  if (!vm.bills || vm.totalCash <= 0) return '';

  const labels = { 20: 'fill after minimums', 1: 'minimum $1s', 5: 'minimum $5s', 10: 'minimum $10s' };
  const rows = [20, 1, 5, 10].map(d => {
    const n = vm.bills[d] || 0;
    if (!n) return '';
    return `<div class="net-denom-row"><span class="ndr-lbl">$${d}</span><span class="ndr-times">×</span><span class="ndr-count">${n}<span class="ndr-note">${labels[d]}</span></span><span class="ndr-sub">$${n * d}</span></div>`;
  }).filter(Boolean).join('');
  const nTargets = vm.people.length + (vm.shares && vm.shares.leftover > 0 ? 1 : 0);
  const targetLabel = nTargets > 1 ? nTargets + ' targets incl. remainder' : 'single total target';
  return `<div class="net-breakdown">
    <div class="net-breakdown-hdr">Ideal breakdown · $${vm.totalCash} total · ${targetLabel}</div>
    ${rows || '<div class="net-empty-hint">—</div>'}
  </div>`;
}

export function renderPools(vm) {
  const container = $('pools-content');
  if (!container) return;
  const state = vm.state;

  const errEl = $('cash-error');
  if (errEl) {
    const cashError = vm.inputError && /total|count|window/i.test(vm.blocked) ? vm.blocked : '';
    errEl.textContent = cashError;
    errEl.classList.toggle('visible', !!cashError);
  }

  const signature = state.pools.map(p =>
    p.id + ':' + p.cash.entryMode + ':' + (p.roles.bartender ? 1 : 0) + (p.roles.server ? 1 : 0) + (p.includeSupport ? 1 : 0)
  ).join('|') + '|' + state.ui.selectedPool + '|' + (state.pools.length === 1 ? 'bd' : '');

  if (signature !== lastSignature) {
    lastSignature = signature;
    container.innerHTML = state.pools.map(pool =>
      cardHTML(pool, vm, state.ui.selectedPool === pool.id, state.pools.length > 1)
    ).join('')
      + `<button class="dp-add-party-btn" onclick="App.addPool()">+ Add Pool</button>`
      + `<div id="pool-breakdown">${breakdownHTML(vm)}</div>`;
    return;
  }

  // Patch pass: totals, subtotals, window subtitle, names, breakdown.
  state.pools.forEach(pool => {
    const card = container.querySelector(`[data-pid="${pool.id}"]`);
    if (!card) return;
    const vmPool = vm.pools.find(p => p.id === pool.id);
    const total = vmPool ? vmPool.total : 0;

    const totalEl = card.querySelector('[data-pool-total]');
    if (totalEl) {
      totalEl.textContent = '$' + total;
      totalEl.className = 'dp-pool-total' + (total ? '' : ' zero');
    }
    const nameEl = card.querySelector('[data-pool-name]');
    if (nameEl && nameEl.textContent !== pool.label) nameEl.textContent = pool.label;
    const subEl = card.querySelector('[data-window-sub]');
    if (subEl) subEl.innerHTML = windowSub(pool, vmPool);

    if (pool.cash.entryMode === 'perbill') {
      DENOMS.forEach(d => {
        const subCell = card.querySelector(`[data-sub="${d}"]`);
        if (!subCell) return;
        const parsed = parseWholeNumber(pool.cash.billCounts[d] ?? '');
        const sub = parsed.valid ? parsed.value * d : 0;
        subCell.textContent = parsed.valid ? (sub > 0 ? '$' + sub : '—') : '!';
        subCell.className = 'dp-subtotal' + (sub > 0 && parsed.valid ? '' : ' zero');
      });
    }
  });

  const bd = $('pool-breakdown');
  if (bd) bd.innerHTML = breakdownHTML(vm);
}

export function invalidatePools() {
  lastSignature = '';
}
