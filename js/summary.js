// renderSummary — night shift summary tab
//
// Parameters:
//   staffWithBills  — staff array post-distribution (has .bills assigned)
//   staffOrig       — original staff array from computation (same objects here, kept for API compat)
//   total           — total cash pool
//   totH            — total hours worked
//   rate            — $/hr rate
//   leftover        — dollars remaining in drawer
//   poolAfter       — bill counts remaining after distribution (unused in markup, kept for compat)
//   distCtx         — { remainderBills, distributionError, pool }
//
// No computation globals are read here. All data arrives via parameters.

function renderSummary(staffWithBills, staffOrig, total, totH, rate, leftover, poolAfter, distCtx) {
  const sb = $('stale-summary'); if (sb) sb.classList.remove('visible');

  // Unpack distribution context, fall back to globals only as a safety net
  // so existing callers that don't pass distCtx still work during migration.
  const remainderBills    = distCtx?.remainderBills    ?? lastRemainderBills  ?? {};
  const distributionError = distCtx?.distributionError ?? lastDistributionError ?? '';
  const pool              = distCtx?.pool              ?? livePool             ?? {};

  const dateVal  = $('tipDate').value;
  const [yr, mo, dy] = dateVal ? dateVal.split('-') : ['', '', ''];
  const dateStr  = (mo && dy && yr) ? `${parseInt(mo)}/${parseInt(dy)}/${yr}` : '';
  const sumFinal = staffWithBills.reduce((s, p) => s + p.final, 0);
  const grandTotal = sumFinal + leftover;

  const personCards = staffWithBills.map(p => {
    const safe        = escapeHTML(p.n);
    const initials    = escapeHTML(p.n.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2));
    const inStr       = fmtTime(p.i, p.i, false);
    const outStr      = fmtTime(p.o, p.i, p.o < p.i);
    const closerBadge = p.closer ? '<span class="closer-badge">closer</span>' : '';

    const bonusLine = p.bonus > 0
      ? `<div class="person-bonus-row">
           <span class="person-bonus-base">${p.base}</span>
           <span class="person-bonus-pill">+${p.bonus}</span>
         </div>`
      : `<div class="person-bonus-row">
           <span class="person-bonus-base person-bonus-base--only">${p.base}</span>
         </div>`;

    return `<div class="person-card" onclick="openPersonModal('${escapeHTML(p._rowId)}')">
      <div class="person-card-top">
        <div class="person-avatar">${initials}</div>
        <div class="person-main">
          <div class="person-name-row"><span class="person-name">${safe}</span>${closerBadge}</div>
        </div>
        <div class="person-hrs-block">
          <div class="person-hrs-val">${fmtHrs(p.h)}</div>
          <div class="person-hrs-times">${inStr}–${outStr}</div>
        </div>
        <div class="person-tip-col">
          <div class="person-tip">${p.final}</div>
          ${bonusLine}
        </div>
      </div>
    </div>`;
  }).join('');

  const remainderCard = leftover > 0
    ? `<div class="person-card remainder-card">
        <div class="person-card-top">
          <div class="person-avatar remainder-avatar">R</div>
          <div class="person-main">
            <div class="person-name-row"><span class="person-name" style="color:var(--muted)">Remainder</span></div>
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

  const unpaid       = staffWithBills.reduce((s, p) => s + Math.max(0, p.rem || 0), 0);
  const remainderPaid = poolValue(remainderBills);
  const remShort     = leftover > 0 && remainderPaid !== leftover;
  const warnMsg      = distributionError
    || (unpaid > 0 ? 'Distribution short $' + unpaid : remShort ? 'Remainder cannot be represented by available bills' : '');

  let warnHTML = '';
  if (warnMsg) {
    const req     = getSmallBillRequirements(staffWithBills, pool, leftover);
    const reqHTML = renderRequirementSummary(req, pool);
    warnHTML =
      `<div class="warn-box">⚠ ${escapeHTML(warnMsg)} `
      + `<button onclick="switchTab('cash',$('tb-cash'))" style="background:none;border:none;color:inherit;text-decoration:underline;cursor:pointer;padding:0;font:inherit;font-weight:700">→ Go to Cash</button></div>`
      + reqHTML;
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
