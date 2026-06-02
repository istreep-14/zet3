// Day shift summary renderer

function renderDaySummary(result) {
  const sb = $('stale-summary'); if (sb) sb.classList.remove('visible');
  const dateVal = $('tipDate').value;
  const [yr, mo, dy] = dateVal ? dateVal.split('-') : ['', '', ''];
  const dateStr = (mo && dy && yr) ? `${parseInt(mo)}/${parseInt(dy)}/${yr}` : '';

  const chipHTML = bills => {
    const nonZero = DENOMS.filter(d => (bills?.[d] || 0) > 0);
    return nonZero.length
      ? '<div class="pbi-row">' + nonZero.map(d =>
          `<span class="pbi-chip"><span class="pbi-d">$${d}</span><span class="pbi-n">×${bills[d]}</span></span>`
        ).join('') + '</div>'
      : '';
  };

  const fmtAbs = t => {
    // Convert absolute hour back to display string: 10–12 = am, 13+ = pm
    const h = t >= 13 ? t - 12 : t;
    const isAm = t < 12;
    const mn = Math.round((h - Math.floor(h)) * 60);
    const hr = Math.floor(h);
    let h12 = hr % 12; if (h12 === 0) h12 = 12;
    return h12 + (mn > 0 ? ':' + (mn < 10 ? '0' : '') + mn : '') + (isAm ? 'a' : 'p');
  };

  // ── Pool breakdown section ──
  const poolSections = result.pools.map(pool => {
    if (pool.total === 0 && !pool.participants.length) return '';
    const rateStr = pool.totalHours > 0 ? '$' + (pool.total / pool.totalHours).toFixed(2) + '/hr' : '—';
    const startStr = fmtAbs(pool.start);
    const endStr   = fmtAbs(pool.end);

    const participantRows = pool.participants.map(px => {
      const roleBadge = `<span class="role-badge role-${px.role}">${px.role === 'bartender' ? 'bar' : 'srv'}</span>`;
      return `<div class="pool-participant-row">
        <span class="pool-participant-name">${escapeHTML(px.name)}${roleBadge}</span>
        <span class="pool-participant-hrs">${fmtHrs(px.hours)}h</span>
        <span class="pool-participant-raw">$${px.raw.toFixed(2)}</span>
      </div>`;
    }).join('');

    return `<div class="pool-section">
      <div class="pool-section-hdr">
        <div class="pool-section-left">
          <span class="pool-section-name">${escapeHTML(pool.label)}</span>
          <span class="pool-section-window">${startStr}–${endStr}</span>
        </div>
        <div class="pool-section-right">
          <span class="pool-section-total">$${pool.total}</span>
          <span class="pool-section-rate">${rateStr}</span>
        </div>
      </div>
      <div class="pool-participants">${participantRows}</div>
    </div>`;
  }).join('');

  // ── Per-person cards ──
  const personCards = result.people.map(p => {
    const safe     = escapeHTML(p.n);
    const initials = escapeHTML(p.n.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2));
    const roleBadge = `<span class="role-badge role-${p.role}">${p.role === 'bartender' ? 'bar' : 'srv'}</span>`;
    const closerBadge = p.closer ? '<span class="closer-badge">closer</span>' : '';

    // Per-pool breakdown chips
    const poolChips = Object.entries(p.rawShares)
      .filter(([, v]) => v > 0)
      .map(([pid, v]) => {
        const poolLabel = result.pools.find(pl => pl.id === pid)?.label || pid;
        return `<span class="pool-chip"><span class="pool-chip-lbl">${escapeHTML(poolLabel)}</span><span class="pool-chip-val">$${v.toFixed(2)}</span></span>`;
      }).join('');

    const bonusLine = p.bonus > 0
      ? `<div class="person-bonus-row"><span class="person-bonus-base">${p.final - p.bonus}</span><span class="person-bonus-pill">+${p.bonus}</span></div>`
      : '';

    const billsLine = chipHTML(p.bills);

    // Hours display: total shift hours
    const inStr  = fmtAbs(p.inAbs);
    const outStr = fmtAbs(p.outAbs);

    return `<div class="person-card">
      <div class="person-card-top">
        <div class="person-avatar">${initials}</div>
        <div class="person-main">
          <div class="person-name-row"><span class="person-name">${safe}</span>${roleBadge}${closerBadge}</div>
          <div class="pool-chips-row">${poolChips}</div>
          ${billsLine}
        </div>
        <div class="person-hrs-block">
          <div class="person-hrs-val">${fmtHrs(p.totalHours)}</div>
          <div class="person-hrs-times">${inStr}–${outStr}</div>
        </div>
        <div class="person-tip-col">
          <div class="person-tip">$${p.final}</div>
          ${bonusLine}
        </div>
      </div>
    </div>`;
  }).join('');

  const remainderCard = result.leftover > 0
    ? `<div class="person-card remainder-card">
      <div class="person-card-top">
        <div class="person-avatar remainder-avatar">R</div>
        <div class="person-main">
          <div class="person-name-row"><span class="person-name" style="color:var(--muted)">Remainder</span></div>
          ${chipHTML(lastRemainderBills)}
        </div>
        <div class="person-hrs-block">
          <div class="person-hrs-val muted" style="font-size:.72rem">stays</div>
          <div class="person-hrs-times">in drawer</div>
        </div>
        <div class="person-tip-col"><div class="person-tip muted">$${result.leftover}</div></div>
      </div>
    </div>`
    : '';

  const grandTotal  = result.totalPaid;
  const totalHoursAll = result.people.reduce((s, p) => s + p.totalHours, 0);

  const warnHTML = lastDistributionError
    ? `<div class="warn-box">⚠ ${escapeHTML(lastDistributionError)} <button onclick="switchTab('cash',$('tb-cash'))" style="background:none;border:none;color:inherit;text-decoration:underline;cursor:pointer;padding:0;font:inherit;font-weight:700">→ Go to Cash</button></div>`
    : '';

  $('summary-content').innerHTML = `
    <div class="summary-hero">
      <div class="summary-hero-label">Day Shift Total Pool${dateStr ? ' · ' + dateStr : ''}</div>
      <div class="summary-hero-val">$${result.totalCash}</div>
      <div class="summary-meta">
        <div class="summary-meta-item"><div class="summary-meta-lbl">Paid Out</div><div class="summary-meta-val">$${result.totalPaid}</div></div>
        ${result.leftover > 0 ? `<div class="summary-meta-item"><div class="summary-meta-lbl">Remainder</div><div class="summary-meta-val" style="color:var(--muted)">$${result.leftover}</div></div>` : ''}
        <div class="summary-meta-item"><div class="summary-meta-lbl">Staff</div><div class="summary-meta-val">${result.people.length}</div></div>
      </div>
    </div>

    <div class="section-hdr" style="margin-top:8px">Pool Breakdown</div>
    <div class="pool-sections">${poolSections}</div>

    <div class="section-hdr" style="margin-top:12px">Per Person</div>
    <div class="summary-breakdown-head"><span></span><span></span><span>Hrs</span><span>Tip</span></div>
    ${personCards}
    ${remainderCard}

    <div class="summary-totals-strip">
      <span class="summary-totals-lbl">Total</span>
      <div class="summary-totals-right">
        <span class="summary-totals-hrs">${fmtHrs(totalHoursAll)}</span>
        <span class="summary-totals-val">$${grandTotal}</span>
      </div>
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

  // Remainder row
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
