// Bill distribution modal + Close Time sidebar.

import { DENOMS, escapeHTML, poolValue } from '../util.js';
import { parseTime } from '../time.js';
import { previewSmallBillTrades, computeTradeUp } from '../engine.js';
import { buildCloseTimeColumn } from '../viewmodel.js';
import { updatePool, setGlobalDefault } from '../store.js';

const $ = id => document.getElementById(id);

let currentVm = null;
let pendingTradeUp = null;
let pendingTradeDown = null;

// ── Requirement summary ───────────────────────────────────────────────────────

export function renderRequirementSummary(req, pool) {
  if (!req) return '';
  const minFives = Math.max(0, (req.minOneFiveValue - req.minOnes) / 5);
  const minTens = Math.max(0, (req.minOneFiveTenValue - req.minOneFiveValue) / 10);
  const shortFives = Math.max(0, minFives - (pool[5] || 0));
  const shortTens = Math.max(0, minTens - (pool[10] || 0));

  function reqRow(label, need, have, short) {
    const ok = short <= 0;
    const cls = ok ? 'req-row--ok' : 'req-row--short';
    const badge = ok
      ? '<span class="req-badge req-badge--ok">covered</span>'
      : `<span class="req-badge req-badge--short">short&nbsp;${short}</span>`;
    return `<div class="req-row ${cls}">
      <span class="req-row-lbl">${label}</span>
      <span class="req-row-need">${Math.ceil(need)}&nbsp;min</span>
      <span class="req-row-have">${have}&nbsp;have</span>
      ${badge}
    </div>`;
  }

  return `<div class="req-summary">
    <div class="req-summary-hdr">Minimum small bills</div>
    ${reqRow('$1s', req.minOnes, pool[1] || 0, req.onesShort)}
    ${reqRow('$5s', minFives, pool[5] || 0, shortFives)}
    ${reqRow('$10s', minTens, pool[10] || 0, shortTens)}
  </div>`;
}

// ── Distribution table markup ─────────────────────────────────────────────────

function renderCountCell(count) {
  return count > 0 ? `<td class="has-bills">${count}</td>` : '<td class="zero">—</td>';
}

export function renderDistTableMarkup(people, byPerson, options = {}) {
  const multiRole = people.some(p => p.role && p.role !== 'bartender');
  const hCols = DENOMS.map(d => `<th><span class="dist-tbl-denom">$${d}</span></th>`).join('')
    + '<th class="total-col"><span class="dist-tbl-denom" style="color:var(--text2)">TOT</span></th>';
  const sumRem = options.leftover || 0;
  const previewLabel = options.preview
    ? '<div class="dist-preview-label">Distribution after simple trades</div>'
    : '';

  const roleLbl = r => r === 'support' ? 'sup' : r === 'bartender' ? 'bar' : 'srv';
  const rows = people.map(p => {
    const bills = byPerson[p.id] || {};
    const safe = escapeHTML(p.name);
    const pt = poolValue(bills);
    const roleBadge = multiRole && p.role
      ? `<span class="role-badge role-${p.role}" style="margin-left:3px">${roleLbl(p.role)}</span>`
      : '';
    const dot = p.closer
      ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--accent);margin-left:3px;vertical-align:middle"></span>'
      : '';
    const cols = DENOMS.map(d => renderCountCell(bills[d] || 0)).join('');
    return `<tr><td>${safe}${roleBadge}${dot}</td>${cols}<td class="person-total">$${pt}</td></tr>`;
  }).join('');

  let remRow = '', remBills = {}, remAT = 0;
  if (sumRem > 0) {
    remBills = options.remainderBills || {};
    remAT = poolValue(remBills);
    const rc = DENOMS.map(d => {
      const n = remBills[d] || 0;
      return n > 0
        ? `<td style="color:var(--muted);font-weight:600;font-size:.74rem">${n}</td>`
        : `<td class="zero">—</td>`;
    }).join('');
    remRow = `<tr class="dist-rem-row"><td>Chump</td>${rc}<td style="color:var(--muted);font-weight:600;border-left:1px solid var(--border);font-size:.74rem">$${sumRem}</td></tr>`;
  }

  const dtCols = DENOMS.map(d => {
    const t = people.reduce((s, p) => s + ((byPerson[p.id] || {})[d] || 0), 0) + (remBills[d] || 0);
    return t > 0 ? `<td style="color:var(--gold)">${t}</td>` : `<td class="zero">—</td>`;
  }).join('');
  const dGT = people.reduce((s, p) => s + poolValue(byPerson[p.id] || {}), 0) + remAT;
  const totalRow = `<tr class="dist-totals-row"><td>Total</td>${dtCols}<td class="grand-total">$${dGT}</td></tr>`;

  return previewLabel
    + `<div class="dist-tbl-wrap"><table class="dist-tbl"><thead><tr><th>Name</th>${hCols}</tr></thead><tbody>${rows}${remRow}</tbody><tfoot>${totalRow}</tfoot></table></div>`;
}

// ── Trade cards ───────────────────────────────────────────────────────────────

function tradeTableHTML(nowPool, deltas, afterPool) {
  const nowCells = DENOMS.map(d => renderCountCell(nowPool[d] || 0)).join('');
  const deltaCells = DENOMS.map(d => {
    const delta = deltas[d] || 0;
    if (delta === 0) return '<td class="zero">—</td>';
    return `<td class="${delta > 0 ? 'delta-pos' : 'delta-neg'}">${delta > 0 ? '+' : ''}${delta}</td>`;
  }).join('');
  const afterCells = DENOMS.map(d => renderCountCell(afterPool[d] || 0)).join('');

  const nowTotal = poolValue(nowPool);
  const deltaTotal = DENOMS.reduce((s, d) => s + (deltas[d] || 0) * d, 0);
  const afterTotal = poolValue(afterPool);
  const deltaTotalCell = deltaTotal === 0
    ? '<td class="delta-pos grand-total">$0</td>'
    : `<td class="${deltaTotal > 0 ? 'delta-pos' : 'delta-neg'} grand-total">${deltaTotal > 0 ? '+$' : '-$'}${Math.abs(deltaTotal)}</td>`;

  return `<div class="dist-tbl-wrap dist-trade-table">
    <table class="dist-tbl">
      <thead><tr><th></th>${DENOMS.map(d => `<th><span class="dist-tbl-denom">$${d}</span></th>`).join('')}<th class="total-col"><span class="dist-tbl-denom" style="color:var(--text2)">TOT</span></th></tr></thead>
      <tbody>
        <tr><td>Now</td>${nowCells}<td class="person-total">$${nowTotal}</td></tr>
        <tr><td>Delta</td>${deltaCells}${deltaTotalCell}</tr>
        <tr><td>After</td>${afterCells}<td class="person-total">$${afterTotal}</td></tr>
      </tbody>
    </table>
  </div>`;
}

function renderTradeUpCard(tradeUp, pool) {
  return `<div class="trade-card trade-card--up">
    <div class="trade-card-hdr">
      <div class="trade-card-info">
        <div class="trade-card-title">↑ Consolidate → $20s</div>
        <div class="trade-card-sub">Swap excess small bills for ${tradeUp.new20s}&nbsp;×&nbsp;$20. Cash tab updates on apply.</div>
      </div>
      <button class="trade-apply-btn" onclick="App.applyTradeUp()">Apply</button>
    </div>
    ${tradeTableHTML(pool, tradeUp.delta, tradeUp.newPool)}
  </div>`;
}

function renderTradeDownCard(preview, pool) {
  if (!preview) return '';
  const tradeItems = preview.trades.length
    ? `<ul>${preview.trades.map(t => `<li>${escapeHTML(t)}</li>`).join('')}</ul>`
    : '';
  return `<div class="trade-card trade-card--down">
    <div class="trade-card-hdr">
      <div class="trade-card-info">
        <div class="trade-card-title">↓ Break Bills → Small Change</div>
        <div class="trade-card-sub">Counts not saved until applied.</div>
      </div>
      <button class="trade-apply-btn" onclick="App.applyTradeDown()">Apply</button>
    </div>
    <div class="trade-card-trades">${tradeItems}</div>
    ${tradeTableHTML(pool, preview.deltas, preview.pool)}
  </div>`;
}

// Trades write real bill counts back into the pool, so they only make sense
// when there is exactly one pool to write into.
function tradesEnabled(vm) {
  return vm.state.pools.length === 1;
}

function applyBillCountsToPool(vm, newPool) {
  const poolId = vm.state.pools[0].id;
  updatePool(poolId, pool => {
    pool.cash.entryMode = 'perbill';
    DENOMS.forEach(d => {
      pool.cash.billCounts[d] = (newPool[d] || 0) > 0 ? String(newPool[d]) : '';
    });
  });
}

export function applyPendingTradeUp() {
  if (currentVm && pendingTradeUp) applyBillCountsToPool(currentVm, pendingTradeUp.newPool);
}

export function applyPendingTradeDown() {
  if (currentVm && pendingTradeDown) applyBillCountsToPool(currentVm, pendingTradeDown.pool);
}

// ── Dist modal content ────────────────────────────────────────────────────────

export function renderDist(vm) {
  currentVm = vm;
  const el = $('dist-content');
  if (!el) return;

  if (vm.blocked || !vm.dist) {
    el.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
      <div class="empty-title">No distribution</div>
      ${escapeHTML(vm.blocked || 'Calculate first to see bill distribution')}
    </div>`;
    pendingTradeUp = pendingTradeDown = null;
    if ($('closeTimeSidebar')?.classList.contains('open')) renderCloseTimeSidebar();
    return;
  }

  const { dist, shares, people, bills, req } = vm;
  const unpaid = people.reduce((s, p) => s + Math.max(0, p.final - poolValue(dist.byPerson[p.id] || {})), 0);
  const remPV = poolValue(dist.remainderBills);
  const hasRemShort = shares.leftover > 0 && remPV !== shares.leftover;
  const hasErr = !!dist.error || unpaid > 0 || hasRemShort;
  const errMsg = dist.error
    || (unpaid > 0 ? 'Distribution short $' + unpaid : 'Remainder not representable by available bills');

  const reqHTML = renderRequirementSummary(req, bills);
  const canTrade = tradesEnabled(vm);

  pendingTradeDown = hasErr && canTrade ? previewSmallBillTrades(people, bills, shares.leftover) : null;
  pendingTradeUp = !hasErr && canTrade ? computeTradeUp(bills, req) : null;

  const ctBtn = '<button class="ct-open-btn" onclick="App.openCloseTime()">⏱ Close Time</button>';

  if (hasErr) {
    const previewTableHTML = pendingTradeDown
      ? renderDistTableMarkup(people, pendingTradeDown.byPerson, {
          remainderBills: pendingTradeDown.remainderBills,
          leftover: shares.leftover,
          preview: true,
        })
      : '';

    el.innerHTML =
      `<div class="warn-box" style="margin-bottom:10px">⚠ ${escapeHTML(errMsg)}`
      + (pendingTradeDown
        ? ''
        : ` <button onclick="App.closeModal('distModal');App.tab('cash')" style="background:none;border:none;color:inherit;text-decoration:underline;cursor:pointer;padding:0;font:inherit;font-weight:700">→ Go to Cash</button>`)
      + `</div>`
      + reqHTML
      + renderTradeDownCard(pendingTradeDown, bills)
      + previewTableHTML
      + ctBtn;
  } else {
    el.innerHTML = reqHTML
      + (pendingTradeUp ? renderTradeUpCard(pendingTradeUp, bills) : '')
      + renderDistTableMarkup(people, dist.byPerson, {
          remainderBills: dist.remainderBills,
          leftover: shares.leftover,
        })
      + ctBtn;
  }

  if ($('closeTimeSidebar')?.classList.contains('open')) renderCloseTimeSidebar();
}

// ── Close Time sidebar ────────────────────────────────────────────────────────

let ctRange = 3;
let ctCenter = 2;

export function openCloseTimeSidebar() {
  if (!currentVm || !currentVm.shares || !currentVm.totalCash) return;

  const gcOut = parseTime(currentVm.state.defaults.global.out);
  ctCenter = (gcOut.valid && !gcOut.empty) ? gcOut.value : 2;

  renderCloseTimeSidebar();
  $('closeTimeSidebar').classList.add('open');
  document.body.style.overflow = 'hidden';
}

export function closeCloseTimeSidebar() {
  $('closeTimeSidebar').classList.remove('open');
  document.body.style.overflow = '';
}

export function selectCloseTime(t) {
  setGlobalDefault('out', String(t));
  ctCenter = t;
}

function fmtCloseTime(t) {
  let hr = Math.floor(t), mn = Math.round((t - hr) * 60);
  if (mn === 60) { hr++; mn = 0; }
  const h12 = hr % 12 || 12;
  return h12 + (mn > 0 ? ':' + (mn < 10 ? '0' : '') + mn : '') + (t <= 5 ? 'a' : 'p');
}

function renderCloseTimeSidebar() {
  const body = $('close-time-body');
  if (!body || !currentVm) return;

  if (!currentVm.shares || !currentVm.bills) {
    body.innerHTML = `<div class="rem-unavailable">${escapeHTML(currentVm.blocked || 'Enter cash and staff first.')}</div>`;
    return;
  }

  const state = currentVm.state;
  const drawer = currentVm.bills;

  const times = [];
  for (let i = -ctRange; i <= ctRange; i++) {
    const t = Math.round((ctCenter + i * 0.25) * 4) / 4;
    if (t > 0 && t <= 12) times.push(t);
  }

  const cols = times.map(t => buildCloseTimeColumn(state, t, drawer));
  const nowIdx = times.findIndex(t => Math.abs(t - ctCenter) < 0.01);

  body.innerHTML = closeTimeTableHTML(times, cols, drawer, nowIdx);

  // Pinch to widen/narrow the time range
  const wrap = body.querySelector('.ct-scroll-wrap');
  if (!wrap) return;
  let pinchStartDist = 0;
  wrap.addEventListener('touchstart', e => {
    if (e.touches.length === 2)
      pinchStartDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY);
  }, { passive: true });
  wrap.addEventListener('touchmove', e => {
    if (e.touches.length !== 2 || !pinchStartDist) return;
    const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY);
    if (d - pinchStartDist > 28) {
      ctRange = Math.min(ctRange + 1, 9);
      pinchStartDist = d;
      renderCloseTimeSidebar();
    } else if (pinchStartDist - d > 28) {
      ctRange = Math.max(ctRange - 1, 1);
      pinchStartDist = d;
      renderCloseTimeSidebar();
    }
  }, { passive: true });
  wrap.addEventListener('touchend', () => { pinchStartDist = 0; }, { passive: true });
}

function closeTimeTableHTML(times, cols, pool, nowIdx) {
  const people = currentVm.shares.perPerson;
  const n = i => i === nowIdx ? ' ct-col-now' : '';

  const thCells = times.map((t, i) =>
    `<th class="${i === nowIdx ? 'ct-th-now' : 'ct-th-sel'}" onclick="App.selectCloseTime(${t})">${fmtCloseTime(t)}</th>`
  ).join('');

  const personRows = people.map(person => {
    const cells = cols.map((col, i) => {
      if (!col) return `<td class="zero${n(i)}">—</td>`;
      const p = col.shares.perPerson.find(x => x.id === person.id);
      if (!p || p.final <= 0) return `<td class="zero${n(i)}">—</td>`;
      return `<td class="${p.closer ? 'ct-closer' : 'ct-person'}${n(i)}">$${p.final}</td>`;
    }).join('');
    return `<tr><td class="ct-lbl">${escapeHTML(person.name)}</td>${cells}</tr>`;
  }).join('');

  const remRow = `<tr class="ct-rem-row"><td class="ct-lbl">Chump</td>`
    + cols.map((col, i) => {
      if (!col || !col.shares.leftover) return `<td class="zero${n(i)}">—</td>`;
      return `<td class="ct-rem${n(i)}">$${col.shares.leftover}</td>`;
    }).join('')
    + '</tr>';

  const avail15 = (pool[1] || 0) + (pool[5] || 0) * 5;
  const avail1510 = avail15 + (pool[10] || 0) * 10;

  function dataRow(label, getVal) {
    return `<tr><td class="ct-lbl">${label}</td>`
      + cols.map((col, i) => {
        if (!col) return `<td class="zero${n(i)}">—</td>`;
        const { cls, val } = getVal(col);
        return `<td class="${cls}${n(i)}">${val}</td>`;
      }).join('')
      + '</tr>';
  }

  const onesRow = dataRow('$1s', col => {
    const v = col.req.minOnes, ok = v <= (pool[1] || 0);
    return { cls: ok ? 'ct-ok' : 'ct-short', val: v };
  });
  const val15Row = dataRow('$1+5', col => {
    const v = col.req.minOneFiveValue, ok = v <= avail15;
    return { cls: ok ? 'ct-ok' : 'ct-short', val: '$' + v };
  });
  const val1510Row = dataRow('$1+5+10', col => {
    const v = col.req.minOneFiveTenValue, ok = v <= avail1510;
    return { cls: ok ? 'ct-ok' : 'ct-short', val: '$' + v };
  });

  const divRow = label =>
    `<tr class="ct-sect-hdr"><td colspan="${times.length + 1}">${label}</td></tr>`;

  return `<div class="ct-scroll-wrap"><table class="ct-tbl">
    <thead><tr><th class="ct-lbl-th"></th>${thCells}</tr></thead>
    <tbody>
      ${personRows}${remRow}
      ${divRow('Bills')}
      ${onesRow}${val15Row}${val1510Row}
    </tbody>
  </table></div>`;
}
