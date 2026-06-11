// Summary tab — single-pool sessions render the night-shift card layout,
// multi-pool sessions render the day-style matrix. Same view model.

import { escapeHTML, fmtHrs, poolValue } from '../util.js';
import { fmtTimeAbs } from '../time.js';
import { renderRequirementSummary } from './dist.js';

const $ = id => document.getElementById(id);

function emptyStateHTML() {
  return `<div class="empty-state">
    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
    <div class="empty-title">No data yet</div>
    Enter cash &amp; staff to calculate
  </div>`;
}

function blockedHTML(reason) {
  return `<div class="warn-box">⚠ ${escapeHTML(reason)}</div>`;
}

function dateLabel(state) {
  const dateVal = state.meta.date;
  const [yr, mo, dy] = dateVal ? dateVal.split('-') : ['', '', ''];
  return (mo && dy && yr) ? `${parseInt(mo)}/${parseInt(dy)}/${yr}` : '';
}

function warnBoxHTML(vm) {
  const dist = vm.dist;
  const shares = vm.shares;
  const unpaid = vm.people.reduce((s, p) => {
    const paid = poolValue(dist.byPerson[p.id] || {});
    return s + Math.max(0, p.final - paid);
  }, 0);
  const remainderPaid = poolValue(dist.remainderBills);
  const remShort = shares.leftover > 0 && remainderPaid !== shares.leftover;
  const warnMsg = dist.error
    || (unpaid > 0 ? 'Distribution short $' + unpaid
      : remShort ? 'Remainder cannot be represented by available bills' : '');
  const poolWarnings = shares.perPool.map(p => p.warning).filter(Boolean);

  let html = poolWarnings.map(w => `<div class="warn-box">⚠ ${escapeHTML(w)}</div>`).join('');
  if (warnMsg) {
    html += `<div class="warn-box">⚠ ${escapeHTML(warnMsg)} `
      + `<button onclick="App.tab('cash')" style="background:none;border:none;color:inherit;text-decoration:underline;cursor:pointer;padding:0;font:inherit;font-weight:700">→ Go to Cash</button></div>`
      + renderRequirementSummary(vm.req, vm.bills);
  }
  return html;
}

// ── Single pool: card layout ──────────────────────────────────────────────────

function singlePoolHTML(vm) {
  const shares = vm.shares;
  const anchor = vm.resolved.anchorRaw;
  const dateStr = dateLabel(vm.state);
  const sumFinal = shares.perPerson.reduce((s, p) => s + p.final, 0);
  const grandTotal = sumFinal + shares.leftover;

  const personCards = shares.perPerson.map(p => {
    const safe = escapeHTML(p.name);
    const initials = escapeHTML(p.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2));
    const inStr = fmtTimeAbs(p.inAbs, anchor);
    const outStr = fmtTimeAbs(p.outAbs, anchor);
    const closerBadge = p.closer ? '<span class="closer-badge">closer</span>' : '';
    const roleBadge = p.role !== 'bartender'
      ? `<span class="role-badge role-${p.role}" style="margin-left:4px">${p.role === 'support' ? 'sup' : 'srv'}</span>`
      : '';

    const bonusLine = p.bonus > 0
      ? `<div class="person-bonus-row">
           <span class="person-bonus-base">${p.base}</span>
           <span class="person-bonus-pill">+${p.bonus}</span>
         </div>`
      : `<div class="person-bonus-row">
           <span class="person-bonus-base person-bonus-base--only">${p.base}</span>
         </div>`;

    return `<div class="person-card" onclick="App.personModal('${p.id}')">
      <div class="person-card-top">
        <div class="person-avatar">${initials}</div>
        <div class="person-main">
          <div class="person-name-row"><span class="person-name">${safe}</span>${closerBadge}${roleBadge}</div>
        </div>
        <div class="person-hrs-block">
          <div class="person-hrs-val">${fmtHrs(p.hours)}</div>
          <div class="person-hrs-times">${inStr}–${outStr}</div>
        </div>
        <div class="person-tip-col">
          <div class="person-tip">${p.final}</div>
          ${bonusLine}
        </div>
      </div>
    </div>`;
  }).join('');

  const remainderCard = shares.leftover > 0
    ? `<div class="person-card remainder-card">
        <div class="person-card-top">
          <div class="person-avatar remainder-avatar">C</div>
          <div class="person-main">
            <div class="person-name-row"><span class="person-name" style="color:var(--muted)">Chump</span></div>
          </div>
          <div class="person-hrs-block">
            <div class="person-hrs-val muted" style="font-size:.72rem">stays</div>
            <div class="person-hrs-times">in drawer</div>
          </div>
          <div class="person-tip-col"><div class="person-tip muted">$${shares.leftover}</div></div>
        </div>
      </div>`
    : '';

  const leftoverMeta = shares.leftover > 0
    ? `<div class="summary-meta-item"><div class="summary-meta-lbl">Chump</div><div class="summary-meta-val" style="color:var(--muted)">$${shares.leftover}</div></div>`
    : '';

  return `
    <div class="summary-hero">
      <div class="summary-hero-label">Total Pool${dateStr ? ' · ' + dateStr : ''}</div>
      <div class="summary-hero-val">$${shares.totalCash}</div>
      <div class="summary-meta">
        <div class="summary-meta-item"><div class="summary-meta-lbl">Total Hrs</div><div class="summary-meta-val">${fmtHrs(shares.totalHours)}</div></div>
        <div class="summary-meta-item"><div class="summary-meta-lbl">Rate</div><div class="summary-meta-val">$${shares.rate.toFixed(2)}/hr</div></div>
        <div class="summary-meta-item"><div class="summary-meta-lbl">Paid Out</div><div class="summary-meta-val">$${sumFinal}</div></div>
        ${leftoverMeta}
      </div>
    </div>
    <div class="section-hdr">Breakdown</div>
    <div class="summary-breakdown-head"><span></span><span></span><span>Hrs</span><span>Tip</span></div>
    ${personCards}
    ${remainderCard}
    <div class="summary-totals-strip">
      <span class="summary-totals-lbl">Total</span>
      <div class="summary-totals-right">
        <span class="summary-totals-hrs">${fmtHrs(shares.totalHours)}</span>
        <span class="summary-totals-val">$${grandTotal}</span>
      </div>
    </div>
    <button class="bill-chart-btn" onclick="App.openModal('distModal')">Bill chart →</button>
    ${warnBoxHTML(vm)}
  `;
}

// ── Multi-pool: matrix layout ─────────────────────────────────────────────────

function multiPoolHTML(vm) {
  const shares = vm.shares;
  const anchor = vm.resolved.anchorRaw;
  const dateStr = dateLabel(vm.state);
  const pools = shares.perPool;
  const colCount = pools.length + 2;

  const fmtAbs = t => fmtTimeAbs(t, anchor);
  const fmtH = h => fmtHrs(h);

  const thCols = pools.map(p => `<th class="ds-pool-col">${escapeHTML(p.label)}</th>`).join('')
    + '<th class="ds-total-col">Total</th>';

  const metaRows = [
    { label: 'Start', vals: pools.map(p => fmtAbs(p.startAbs)), total: null },
    { label: 'End', vals: pools.map(p => fmtAbs(p.endAbs)), total: null },
    { label: 'Window', vals: pools.map(p => fmtH(p.endAbs - p.startAbs)), total: null },
    { label: 'Tips', vals: pools.map(p => p.total > 0 ? p.total : '—'), total: shares.totalCash, boldTotal: true },
    { label: 'Hours', vals: pools.map(p => p.hours > 0 ? fmtH(p.hours) : '—'), total: fmtH(shares.totalHours) },
    {
      label: 'Hourly', vals: pools.map(p => p.hours > 0 ? (p.total / p.hours).toFixed(2) : '—'),
      total: shares.totalHours > 0 ? shares.rate.toFixed(2) : '—',
    },
  ];

  const metaTbody = metaRows.map(row => {
    const tds = row.vals.map(v => `<td class="ds-pool-col">${escapeHTML(String(v))}</td>`).join('');
    const tot = row.total != null
      ? `<td class="ds-total-col${row.boldTotal ? ' ds-bold' : ''}">${escapeHTML(String(row.total))}</td>`
      : `<td class="ds-total-col ds-muted">—</td>`;
    return `<tr class="ds-meta-row"><td class="ds-label-col">${escapeHTML(row.label)}</td>${tds}${tot}</tr>`;
  }).join('');

  const roleLbl = { bartender: 'bar', server: 'srv', support: 'sup' };
  const personRows = shares.perPerson.map(p => {
    const roleBadge = `<span class="ds-role-badge ds-role-${p.role}">${roleLbl[p.role]}</span>`;
    const closerDot = p.closer ? '<span class="ds-closer-dot"></span>' : '';
    const tds = pools.map(pool => {
      const share = p.perPool[pool.id];
      if (!share || share.raw <= 0) return '<td class="ds-pool-col ds-empty">—</td>';
      return `<td class="ds-pool-col ds-person-cell">
        <span class="ds-pay">${Math.floor(share.raw)}</span><span class="ds-hrs">${fmtH(share.hours)}h</span>
      </td>`;
    }).join('');
    return `<tr class="ds-person-row" onclick="App.personModal('${p.id}')">
      <td class="ds-label-col ds-name-cell">${escapeHTML(p.name)}${roleBadge}${closerDot}</td>
      ${tds}
      <td class="ds-total-col ds-bold">$${p.final}</td>
    </tr>`;
  }).join('');

  const totalsTds = pools.map(pool => {
    const paid = pool.participants.reduce((s, px) => s + Math.floor(px.raw), 0);
    return `<td class="ds-pool-col ds-person-cell ds-totals-cell">
      <span class="ds-pay">${paid > 0 ? paid : '—'}</span><span class="ds-hrs">${fmtH(pool.hours)}h</span>
    </td>`;
  }).join('');

  const totalPaid = shares.perPerson.reduce((s, p) => s + p.final, 0);
  const totalsRow = `<tr class="ds-totals-row">
    <td class="ds-label-col">Total</td>
    ${totalsTds}
    <td class="ds-total-col ds-bold">$${totalPaid}</td>
  </tr>`;

  const remRow = shares.leftover > 0
    ? `<tr class="ds-rem-row">
        <td class="ds-label-col">Chump</td>
        ${pools.map(() => '<td class="ds-pool-col"></td>').join('')}
        <td class="ds-total-col ds-muted-val">$${shares.leftover}</td>
      </tr>`
    : '';

  return `
    <div class="ds-hero">
      <div class="ds-hero-label">Tip Pool${dateStr ? ' · ' + dateStr : ''}</div>
      <div class="ds-hero-val">$${shares.totalCash}</div>
    </div>
    <div class="ds-table-wrap">
      <table class="ds-table">
        <thead>
          <tr><th class="ds-label-col ds-cut-hdr">Pool</th>${thCols}</tr>
        </thead>
        <tbody>
          ${metaTbody}
          <tr class="ds-divider"><td colspan="${colCount}"></td></tr>
          <tr class="ds-name-hdr">
            <th class="ds-label-col">Name</th>
            ${pools.map(p => `<th class="ds-pool-col">${escapeHTML(p.label)}</th>`).join('')}
            <th class="ds-total-col">Total</th>
          </tr>
          ${personRows}
          ${totalsRow}
          ${remRow}
        </tbody>
      </table>
    </div>
    <button class="bill-chart-btn" onclick="App.openModal('distModal')">Bill chart →</button>
    ${warnBoxHTML(vm)}
  `;
}

export function renderSummary(vm) {
  const el = $('summary-content');
  if (!el) return;

  if (vm.blocked) {
    const pristine = !vm.hasNamedStaff && vm.totalCash === 0;
    el.innerHTML = pristine ? emptyStateHTML() : blockedHTML(vm.blocked);
    return;
  }

  el.innerHTML = vm.state.pools.length === 1 ? singlePoolHTML(vm) : multiPoolHTML(vm);
}
