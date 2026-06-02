function renderSummary(staffWithBills, staffOrig, total, totH, rate, leftover, poolAfter) {
  const sb = $('stale-summary'); if (sb) sb.classList.remove('visible');
  const dateVal = $('tipDate').value;
  const [yr, mo, dy] = dateVal ? dateVal.split('-') : ['', '', ''];
  const dateStr = (mo && dy && yr) ? `${parseInt(mo)}/${parseInt(dy)}/${yr}` : '';
  const sumFinal = staffWithBills.reduce((s, p) => s + p.final, 0);
  // Grand total includes remainder — shown as one clean number
  const grandTotal = sumFinal + leftover;
  const chipHTML = bills => {
    const nonZero = DENOMS.filter(d => (bills?.[d] || 0) > 0);
    return nonZero.length
      ? '<div class="pbi-row">' + nonZero.map(d =>
          `<span class="pbi-chip"><span class="pbi-d">$${d}</span><span class="pbi-n">×${bills[d]}</span></span>`
        ).join('') + '</div>'
      : '';
  };

  const personCards = staffWithBills.map(p => {
    const safe         = escapeHTML(p.n);
    const initials     = escapeHTML(p.n.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2));
    const inStr        = fmtTime(p.i, p.i, false);
    const outStr       = fmtTime(p.o, p.i, p.o < p.i);
    const closerBadge  = p.closer ? '<span class="closer-badge">closer</span>' : '';
    const bonusLine    = p.bonus > 0
      ? `<div class="person-bonus-row"><span class="person-bonus-base">${p.base}</span><span class="person-bonus-pill">+${p.bonus}</span></div>`
      : '';
    const billsLine = chipHTML(p.bills);
    return `<div class="person-card" onclick="openPersonModal('${escapeHTML(p._rowId)}')">
      <div class="person-card-top">
        <div class="person-avatar">${initials}</div>
        <div class="person-main">
          <div class="person-name-row"><span class="person-name">${safe}</span>${closerBadge}</div>
          ${billsLine}
        </div>
        <div class="person-hrs-block">
          <div class="person-hrs-val">${fmtHrs(p.h)}</div>
          <div class="person-hrs-times">${inStr}–${outStr}</div>
        </div>
        <div class="person-tip-col"><div class="person-tip">${p.final}</div>${bonusLine}</div>
      </div>
    </div>`;
  }).join('');

  // Remainder card — compact inline row, no badge, just a small indicator
  const remainderCard = leftover > 0
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
        <div class="person-tip-col"><div class="person-tip muted">$${leftover}</div></div>
      </div>
    </div>`
    : '';

  const leftoverMeta = leftover > 0
    ? `<div class="summary-meta-item"><div class="summary-meta-lbl">Remainder</div><div class="summary-meta-val" style="color:var(--muted)">$${leftover}</div></div>`
    : '';

  const unpaid      = staffWithBills.reduce((s, p) => s + Math.max(0, p.rem || 0), 0);
  const remainderPaid = poolValue(lastRemainderBills || {});
  const remShort    = leftover > 0 && remainderPaid !== leftover;
  const warnMsg     = lastDistributionError
    || (unpaid > 0 ? 'Distribution short $' + unpaid : remShort ? 'Remainder cannot be represented by available bills' : '');

  let warnHTML = '';
  if (warnMsg) {
    const req = getSmallBillRequirements(staffWithBills, livePool, lastLeftover);
    const reqCards = renderSmallBillRequirementCards(req);
    warnHTML =
      `<div class="warn-box">⚠ ${escapeHTML(warnMsg)} `
      + `<button onclick="switchTab('cash',$('tb-cash'))" style="background:none;border:none;color:inherit;text-decoration:underline;cursor:pointer;padding:0;font:inherit;font-weight:700">→ Go to Cash</button></div>`
      + reqCards;
  }

  $('summary-content').innerHTML = `
    <div class="summary-hero">
      <div class="summary-hero-label">Total Pool${dateStr ? ' · ' + dateStr : ''}</div>
      <div class="summary-hero-val">$${total}</div>
      <div class="summary-meta">
        <div class="summary-meta-item"><div class="summary-meta-lbl">Total Hrs</div><div class="summary-meta-val">${fmtHrs(totH)}</div></div>
        <div class="summary-meta-item"><div class="summary-meta-lbl">Rate</div><div class="summary-meta-val">$${rate.toFixed(2)}/hr</div></div>
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
        <span class="summary-totals-hrs">${fmtHrs(totH)}</span>
        <span class="summary-totals-val">$${grandTotal}</span>
      </div>
    </div>
    ${warnHTML}
  `;
}

// renderSmallBillRequirementCards is defined in dist.js and called here.
// Both Summary and Dist share the same rendering helper.
