// Day shift summary renderer — table layout matching design spec

function renderDaySummary(result) {
  const sb = $('stale-summary'); if (sb) sb.classList.remove('visible');

  const dateVal = $('tipDate').value;
  const [yr, mo, dy] = dateVal ? dateVal.split('-') : ['', '', ''];
  const dateStr = (mo && dy && yr) ? `${parseInt(mo)}/${parseInt(dy)}/${yr}` : '';

  // ── Helpers ──────────────────────────────────────────────────────────────

  const fmtAbs = t => {
    // Absolute hour → "H:MMam/pm". 10–11.99 = AM, 12+ = PM, 0–9.99 = AM
    const isAm = t < 12;
    const hr   = Math.floor(t);
    const mn   = Math.round((t - hr) * 60);
    let h12 = hr % 12; if (h12 === 0) h12 = 12;
    const minStr = mn > 0 ? ':' + (mn < 10 ? '0' : '') + mn : ':00';
    return h12 + minStr + ' ' + (isAm ? 'AM' : 'PM');
  };

  const fmtHrsLocal = h => parseFloat(h.toFixed(2)).toString();

  // Active pools (morning always first, then middle, then any parties)
  const pools = result.pools.filter(p => p.total > 0 || p.participants.length > 0);

  // ── Pool metadata table ───────────────────────────────────────────────────

  // Compute combined totals for a "Total" column
  const totalCash       = result.totalCash;
  const totalHoursAll   = result.people.reduce((s, p) => s + p.totalHours, 0);

  // Header row: Cut | pool labels | Total
  const thCols = pools.map(p => `<th>${escapeHTML(p.label)}</th>`).join('') + '<th>Total</th>';

  // Metadata rows
  const metaRows = [
    {
      label: 'Start',
      vals:  pools.map(p => fmtAbs(p.start)),
      total: '',
    },
    {
      label: 'End',
      vals:  pools.map(p => fmtAbs(p.end)),
      total: '',
    },
    {
      label: 'Hours',
      vals:  pools.map(p => fmtHrsLocal(p.end - p.start)),
      total: '',
    },
    {
      label: 'Tips',
      vals:  pools.map(p => p.total > 0 ? p.total : '—'),
      total: totalCash,
      boldTotal: true,
    },
    {
      label: 'Hours',
      vals:  pools.map(p => p.totalHours > 0 ? fmtHrsLocal(p.totalHours) : '—'),
      total: fmtHrsLocal(totalHoursAll),
    },
    {
      label: 'Hourly',
      vals:  pools.map(p => p.totalHours > 0 ? (p.total / p.totalHours).toFixed(2) : '—'),
      total: totalHoursAll > 0 ? (totalCash / totalHoursAll).toFixed(2) : '—',
    },
  ];

  const metaTbody = metaRows.map(row => {
    const tdVals = row.vals.map(v => `<td>${escapeHTML(String(v))}</td>`).join('');
    const totalCell = row.total !== ''
      ? `<td class="ds-total-col${row.boldTotal ? ' ds-bold' : ''}">${escapeHTML(String(row.total))}</td>`
      : '<td class="ds-total-col ds-muted">—</td>';
    return `<tr><td class="ds-row-label">${escapeHTML(row.label)}</td>${tdVals}${totalCell}</tr>`;
  }).join('');

  // ── Per-person rows ───────────────────────────────────────────────────────

  // For each person, compute their payout per pool
  // result.people[i].rawShares is a map of poolId → raw dollar share (pre-floor)
  // We want the floored contribution per pool, then total = person.final

  // Recompute per-pool floored amounts for display.
  // Strategy: show Math.floor(rawShare) per pool, with the closer bonus folded into
  // whichever pool the person participated in most (or just the total column).
  const personRows = result.people.map(p => {
    const name     = escapeHTML(p.n);
    const roleDot  = p.closer
      ? '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--accent);margin-left:4px;vertical-align:middle"></span>'
      : '';

    const tdVals = pools.map(pool => {
      const raw = p.rawShares[pool.id] || 0;
      if (raw <= 0) return '<td class="ds-person-cell ds-empty">—</td>';
      const hrs = pool.participants.find(px => px.name === p.n)?.hours || 0;
      return `<td class="ds-person-cell">
        <span class="ds-hrs">${fmtHrsLocal(hrs)}</span>
        <span class="ds-pay">${Math.floor(raw)}</span>
      </td>`;
    }).join('');

    return `<tr class="ds-person-row">
      <td class="ds-name-cell">${name}${roleDot}</td>
      ${tdVals}
      <td class="ds-total-col ds-bold">$${p.final}</td>
    </tr>`;
  }).join('');

  // Totals row
  const poolTotals = pools.map(pool => {
    const paid = pool.participants.reduce((s, px) => s + Math.floor(px.raw), 0);
    return `<td class="ds-total-col ds-bold">${paid > 0 ? paid : '—'}</td>`;
  }).join('');
  const grandPaid = result.totalPaid + result.leftover;

  // Hours totals row
  const poolHrTotals = pools.map(pool =>
    `<td class="ds-total-col">${pool.totalHours > 0 ? fmtHrsLocal(pool.totalHours) : '—'}</td>`
  ).join('');

  // Total paid per person sums
  const totalPaidSum = result.people.reduce((s, p) => s + p.final, 0);

  const totalsRow = `<tr class="ds-totals-row">
    <td class="ds-row-label">Total</td>
    ${pools.map(pool => {
      const paid = pool.participants.reduce((s, px) => s + Math.floor(px.raw), 0);
      const hrs  = fmtHrsLocal(pool.totalHours);
      return `<td class="ds-person-cell">
        <span class="ds-hrs">${hrs}</span>
        <span class="ds-pay">${paid > 0 ? paid : '—'}</span>
      </td>`;
    }).join('')}
    <td class="ds-total-col ds-bold">$${totalPaidSum}</td>
  </tr>`;

  // Remainder row (if any)
  const remRow = result.leftover > 0
    ? `<tr class="ds-rem-row">
        <td class="ds-row-label" style="color:var(--muted)">Remainder</td>
        ${pools.map(() => '<td></td>').join('')}
        <td class="ds-total-col" style="color:var(--muted)">$${result.leftover}</td>
      </tr>`
    : '';

  // ── Warn box ─────────────────────────────────────────────────────────────

  const warnHTML = lastDistributionError
    ? `<div class="warn-box" style="margin-top:8px">⚠ ${escapeHTML(lastDistributionError)}
        <button onclick="switchTab('cash',$('tb-cash'))" style="background:none;border:none;color:inherit;text-decoration:underline;cursor:pointer;padding:0;font:inherit;font-weight:700">→ Go to Cash</button>
       </div>`
    : '';

  // ── Assemble ─────────────────────────────────────────────────────────────

  $('summary-content').innerHTML = `
    <div class="ds-hero">
      <div class="ds-hero-label">Day Shift${dateStr ? ' · ' + dateStr : ''}</div>
      <div class="ds-hero-val">$${result.totalCash}</div>
    </div>

    <div class="ds-table-wrap">
      <table class="ds-table">
        <thead>
          <tr>
            <th class="ds-cut-col">Cut</th>
            ${thCols}
          </tr>
        </thead>
        <tbody>
          ${metaTbody}
          <tr class="ds-section-divider"><td colspan="${pools.length + 2}"></td></tr>
          <tr class="ds-thead-row">
            <th class="ds-cut-col">Name</th>
            ${pools.map(p => `<th>${escapeHTML(p.label)}</th>`).join('')}
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

// ── Day shift dist renderer (unchanged from before) ───────────────────────────

function renderDayDist(result) {
  const sb = $('stale-dist'); if (sb) sb.classList.remove('visible');

  const unpaid = result.people.reduce((s, p) => s + Math.max(0, p.rem || 0), 0);
  const hasErr = !!lastDistributionError || unpaid > 0;
  const errMsg = lastDistributionError || (unpaid > 0 ? 'Distribution short $' + unpaid : '');

  const hCols = DENOMS.map(d => `<th><span class="dist-tbl-denom">$${d}</span></th>`).join('')
              + '<th class="total-col"><span class="dist-tbl-denom" style="color:var(--text2)">TOT</span></th>';

  const rows = result.people.map(p => {
    const safe     = escapeHTML(p.n);
    const roleBadge = `<span class="role-badge role-${p.role}" style="margin-left:3px">${p.role === 'bartender' ? 'bar' : 'srv'}</span>`;
    const dot = p.closer
      ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--accent);margin-left:3px;vertical-align:middle"></span>'
      : '';
    const pt = DENOMS.reduce((s, d) => s + (p.bills[d] || 0) * d, 0);
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

// ── Day shift home live update (unchanged) ────────────────────────────────────

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

  const distOk   = !lastDistributionError;
  const statusText = currentInputError || (distOk ? 'Distribution ready' : 'Adjust bill counts in Cash');
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
