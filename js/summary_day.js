// Day shift summary renderer

function renderDaySummary(result) {
  const sb = $('stale-summary'); if (sb) sb.classList.remove('visible');

  const dateVal = $('tipDate').value;
  const [yr, mo, dy] = dateVal ? dateVal.split('-') : ['', '', ''];
  const dateStr = (mo && dy && yr) ? `${parseInt(mo)}/${parseInt(dy)}/${yr}` : '';

  // ── Helpers ──────────────────────────────────────────────────────────────

  const fmtAbs = t => {
    const isAm = t < 12;
    const hr = Math.floor(t);
    const mn = Math.round((t - hr) * 60);
    let h12 = hr % 12; if (h12 === 0) h12 = 12;
    const minStr = mn > 0 ? ':' + (mn < 10 ? '0' : '') + mn : ':00';
    return h12 + minStr + ' ' + (isAm ? 'AM' : 'PM');
  };

  const fmtH = h => parseFloat(h.toFixed(2)).toString();

  // Active pools only
  const pools = result.pools.filter(p => p.total > 0 || p.participants.length > 0);

  // Short column labels: "Day", "Mid", "Party", "Party 2" …
  const poolLabel = (p, i) => {
    if (p.id === 'morning') return 'Day';
    if (p.id === 'middle')  return 'Mid';
    // party pools — count how many party pools exist
    const partyPools = pools.filter(x => x.id.startsWith('party'));
    if (partyPools.length === 1) return 'Party';
    const idx = partyPools.indexOf(p) + 1;
    return 'Party ' + idx;
  };

  const totalCash     = result.totalCash;
  const totalHoursAll = result.people.reduce((s, p) => s + p.totalHours, 0);
  const totalPaidSum  = result.people.reduce((s, p) => s + p.final, 0);
  const colCount      = pools.length + 2; // name col + pool cols + total col

  // ── Column header row ─────────────────────────────────────────────────────

  const thCols = pools.map((p, i) =>
    `<th class="ds-pool-col">${escapeHTML(poolLabel(p, i))}</th>`
  ).join('') + '<th class="ds-total-col">Total</th>';

  // ── Metadata rows ─────────────────────────────────────────────────────────

  const metaRows = [
    { label: 'Start',  vals: pools.map(p => fmtAbs(p.start)),                                                         total: null },
    { label: 'End',    vals: pools.map(p => fmtAbs(p.end)),                                                           total: null },
    { label: 'Hours',  vals: pools.map(p => fmtH(p.end - p.start)),                                                   total: null },
    { label: 'Tips',   vals: pools.map(p => p.total > 0 ? p.total : '—'),   total: totalCash,     boldTotal: true  },
    { label: 'Hours',  vals: pools.map(p => p.totalHours > 0 ? fmtH(p.totalHours) : '—'), total: fmtH(totalHoursAll) },
    { label: 'Hourly', vals: pools.map(p => p.totalHours > 0 ? (p.total / p.totalHours).toFixed(2) : '—'),
                                                                             total: totalHoursAll > 0 ? (totalCash / totalHoursAll).toFixed(2) : '—' },
  ];

  const metaTbody = metaRows.map(row => {
    const tds = row.vals.map(v => `<td class="ds-pool-col">${escapeHTML(String(v))}</td>`).join('');
    const tot = row.total != null
      ? `<td class="ds-total-col${row.boldTotal ? ' ds-bold' : ''}">${escapeHTML(String(row.total))}</td>`
      : `<td class="ds-total-col ds-muted">—</td>`;
    return `<tr class="ds-meta-row"><td class="ds-label-col">${escapeHTML(row.label)}</td>${tds}${tot}</tr>`;
  }).join('');

  // ── Person rows ───────────────────────────────────────────────────────────

  const personRows = result.people.map(p => {
    const name = escapeHTML(p.n);

    // Role badge
    const roleBadge = `<span class="ds-role-badge ds-role-${p.role}">${p.role === 'bartender' ? 'bar' : 'srv'}</span>`;

    // Closer dot
    const closerDot = p.closer
      ? '<span class="ds-closer-dot"></span>'
      : '';

    const tds = pools.map(pool => {
      const raw = p.rawShares[pool.id] || 0;
      if (raw <= 0) return '<td class="ds-pool-col ds-empty">—</td>';
      const hrs = pool.participants.find(px => px.name === p.n)?.hours || 0;
      // hrs inline after payout: "258 · 6h"
      return `<td class="ds-pool-col ds-person-cell">
        <span class="ds-pay">${Math.floor(raw)}</span><span class="ds-hrs">${fmtH(hrs)}h</span>
      </td>`;
    }).join('');

    return `<tr class="ds-person-row">
      <td class="ds-label-col ds-name-cell">${name}${roleBadge}${closerDot}</td>
      ${tds}
      <td class="ds-total-col ds-bold">$${p.final}</td>
    </tr>`;
  }).join('');

  // ── Totals row ────────────────────────────────────────────────────────────

  const totalsTds = pools.map(pool => {
    const paid = pool.participants.reduce((s, px) => s + Math.floor(px.raw), 0);
    const hrs  = fmtH(pool.totalHours);
    return `<td class="ds-pool-col ds-person-cell ds-totals-cell">
      <span class="ds-pay">${paid > 0 ? paid : '—'}</span><span class="ds-hrs">${hrs}h</span>
    </td>`;
  }).join('');

  const totalsRow = `<tr class="ds-totals-row">
    <td class="ds-label-col">Total</td>
    ${totalsTds}
    <td class="ds-total-col ds-bold">$${totalPaidSum}</td>
  </tr>`;

  // ── Remainder row ─────────────────────────────────────────────────────────

  const remRow = result.leftover > 0
    ? `<tr class="ds-rem-row">
        <td class="ds-label-col">Remainder</td>
        ${pools.map(() => '<td class="ds-pool-col"></td>').join('')}
        <td class="ds-total-col ds-muted-val">$${result.leftover}</td>
      </tr>`
    : '';

  // ── Warn box ──────────────────────────────────────────────────────────────

  const warnHTML = lastDistributionError
    ? `<div class="warn-box" style="margin-top:8px">⚠ ${escapeHTML(lastDistributionError)}
        <button onclick="switchTab('cash',$('tb-cash'))" style="background:none;border:none;color:inherit;text-decoration:underline;cursor:pointer;padding:0;font:inherit;font-weight:700">→ Go to Cash</button>
       </div>`
    : '';

  // ── Assemble ──────────────────────────────────────────────────────────────

  $('summary-content').innerHTML = `
    <div class="ds-hero">
      <div class="ds-hero-label">Day Shift${dateStr ? ' · ' + dateStr : ''}</div>
      <div class="ds-hero-val">$${result.totalCash}</div>
    </div>
    <div class="ds-table-wrap">
      <table class="ds-table">
        <thead>
          <tr>
            <th class="ds-label-col ds-cut-hdr">Cut</th>
            ${thCols}
          </tr>
        </thead>
        <tbody>
          ${metaTbody}
          <tr class="ds-divider"><td colspan="${colCount}"></td></tr>
          <tr class="ds-name-hdr">
            <th class="ds-label-col">Name</th>
            ${pools.map((p, i) => `<th class="ds-pool-col">${escapeHTML(poolLabel(p, i))}</th>`).join('')}
            <th class="ds-total-col">Total</th>
          </tr>
          ${personRows}
          ${totalsRow}
          ${remRow}
        </tbody>
      </table>
    </div>
    ${warnHTML}
  `;
}

// ── Day shift dist renderer ───────────────────────────────────────────────────

function renderDayDist(result) {
  const sb = $('stale-dist'); if (sb) sb.classList.remove('visible');

  const unpaid = result.people.reduce((s, p) => s + Math.max(0, p.rem || 0), 0);
  const hasErr = !!lastDistributionError || unpaid > 0;
  const errMsg = lastDistributionError || (unpaid > 0 ? 'Distribution short $' + unpaid : '');

  const hCols = DENOMS.map(d => `<th><span class="dist-tbl-denom">$${d}</span></th>`).join('')
              + '<th class="total-col"><span class="dist-tbl-denom" style="color:var(--text2)">TOT</span></th>';

  const rows = result.people.map(p => {
    const safe      = escapeHTML(p.n);
    const roleBadge = `<span class="role-badge role-${p.role}" style="margin-left:3px">${p.role === 'bartender' ? 'bar' : 'srv'}</span>`;
    const dot = p.closer
      ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--accent);margin-left:3px;vertical-align:middle"></span>'
      : '';
    const pt   = DENOMS.reduce((s, d) => s + (p.bills[d] || 0) * d, 0);
    const cols = DENOMS.map(d => {
      const n = p.bills[d] || 0;
      return n > 0 ? `<td class="has-bills">${n}</td>` : `<td class="zero">—</td>`;
    }).join('');
    return `<tr><td>${safe}${roleBadge}${dot}</td>${cols}<td class="person-total">$${pt}</td></tr>`;
  }).join('');

  let remRow = '';
  if (result.leftover > 0) {
    const remBills = lastRemainderBills || {};
    const rc = DENOMS.map(d => {
      const n = remBills[d] || 0;
      return n > 0
        ? `<td style="color:var(--muted);font-weight:600;font-size:.74rem">${n}</td>`
        : `<td class="zero">—</td>`;
    }).join('');
    remRow = `<tr class="dist-rem-row"><td>Rem</td>${rc}<td style="color:var(--muted);font-weight:600;border-left:1px solid var(--border);font-size:.74rem">$${result.leftover}</td></tr>`;
  }

  const remBills = lastRemainderBills || {};
  const dtCols = DENOMS.map(d => {
    const t = result.people.reduce((s, p) => s + (p.bills[d] || 0), 0) + (remBills[d] || 0);
    return t > 0 ? `<td style="color:var(--gold)">${t}</td>` : `<td class="zero">—</td>`;
  }).join('');
  const dGT = result.people.reduce((s, p) => s + DENOMS.reduce((ss, d) => ss + (p.bills[d] || 0) * d, 0), 0)
            + poolValue(remBills);
  const totalRow = `<tr class="dist-totals-row"><td>Total</td>${dtCols}<td class="grand-total">$${dGT}</td></tr>`;

  const tableHTML = `<div class="dist-tbl-wrap"><table class="dist-tbl">
    <thead><tr><th>Name</th>${hCols}</tr></thead>
    <tbody>${rows}${remRow}</tbody>
    <tfoot>${totalRow}</tfoot>
  </table></div>`;

  const errHTML = hasErr
    ? `<div class="warn-box" style="margin-bottom:10px">⚠ ${escapeHTML(errMsg)} <button onclick="switchTab('cash',$('tb-cash'))" style="background:none;border:none;color:inherit;text-decoration:underline;cursor:pointer;padding:0;font:inherit;font-weight:700">→ Go to Cash</button></div>`
    : '';

  $('dist-content').innerHTML = errHTML + tableHTML;
}

// ── Day shift home live update ────────────────────────────────────────────────

function updateHomeLiveDay(result) {
  const sec = $('home-live-section'); if (!sec) return;

  if (!result) {
    sec.innerHTML = `<div class="home-dashboard">
      <div class="home-status-card idle">
        <div class="home-status-label">Session status</div>
        <div class="home-status-title">Enter day shift staff &amp; cash</div>
        <div class="home-status-sub">Add bartenders and servers with shift times</div>
      </div>
      <div class="home-action-grid">
        <button onclick="switchTab('cash', $('tb-cash'))"><span>Cash</span><em>pools</em></button>
        <button onclick="switchTab('staff', $('tb-staff'))"><span>Staff</span><em>bartenders</em></button>
        <button onclick="switchTab('summary', $('tb-summary'))"><span>Summary</span><em>pending</em></button>
        <button onclick="switchTab('dist', $('tb-dist'))"><span>Dist</span><em>pending</em></button>
      </div>
    </div>`;
    return;
  }

  const distOk      = !lastDistributionError;
  const statusText  = currentInputError || (distOk ? 'Distribution ready' : 'Adjust bill counts in Cash');
  const statusClass = currentInputError ? 'warn' : distOk ? 'ok' : 'warn';
  const nBart = result.people.filter(p => p.role === 'bartender').length;
  const nServ = result.people.filter(p => p.role === 'server').length;

  sec.innerHTML = `<div class="home-dashboard">
    <div class="home-status-card ${statusClass}">
      <div class="home-status-label">Day Shift · Session status</div>
      <div class="home-status-title">${statusText}</div>
      <div class="home-status-sub">${nBart} bartender${nBart !== 1 ? 's' : ''} · ${nServ} server${nServ !== 1 ? 's' : ''} · $${result.totalCash} total</div>
    </div>
    <div class="home-metric-grid">
      <div class="home-metric"><span>Pools</span><strong>${result.pools.length}</strong></div>
      <div class="home-metric"><span>Paid Out</span><strong>$${result.totalPaid}</strong></div>
      <div class="home-metric"><span>Remainder</span><strong>${result.leftover > 0 ? '$' + result.leftover : '—'}</strong></div>
    </div>
    <div class="home-action-grid">
      <button onclick="switchTab('cash', $('tb-cash'))"><span>Cash</span><em>$${result.totalCash}</em></button>
      <button onclick="switchTab('staff', $('tb-staff'))"><span>Staff</span><em>${result.people.length} people</em></button>
      <button onclick="switchTab('summary', $('tb-summary'))"><span>Summary</span><em>${distOk ? 'ready' : 'pending'}</em></button>
      <button onclick="switchTab('dist', $('tb-dist'))"><span>Dist</span><em>${distOk ? 'ready' : 'check bills'}</em></button>
    </div>
  </div>`;
}
