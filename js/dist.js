function renderDist(swb, pa) {
  _lastDistStaff = swb;
  renderDistTable(swb, pa);
}

function renderDistTable(swb, poolAfter) {
  const sb = $('stale-dist'); if (sb) sb.classList.remove('visible');
  const unpaid     = swb.reduce((s, p) => s + Math.max(0, p.rem || 0), 0);
  const sumRem     = lastLeftover, remPV = poolValue(lastRemainderBills || {});
  const hasRemShort = sumRem > 0 && remPV !== sumRem;
  const hasErr     = !!lastDistributionError || unpaid > 0 || hasRemShort;
  const errMsg     = lastDistributionError || (unpaid > 0 ? 'Distribution short $' + unpaid : 'Remainder not representable by available bills');
  const hCols      = DENOMS.map(d => `<th><span class="dist-tbl-denom">$${d}</span></th>`).join('') + '<th class="total-col"><span class="dist-tbl-denom" style="color:var(--text2)">TOT</span></th>';

  // FIX: old message said "Adjust bill counts in Cash before distributing"
  // with no way to act on it. Now the error banner includes a tappable
  // "→ Go to Cash" button so the user can fix the problem in one tap.
  // The Cash-on-Hand summary table is kept below so they can see exactly
  // what denominations are available before deciding how to recount.
  if (hasErr) {
    const cr = DENOMS.map(d => { const r = livePool[d] || 0; return r > 0 ? `<td style="color:var(--text2);font-weight:700">${r}</td>` : `<td class="zero">—</td>`; }).join('');
    const ct = DENOMS.reduce((s, d) => s + (livePool[d] || 0) * d, 0);
    $('dist-content').innerHTML =
      `<div class="warn-box" style="margin-bottom:10px">⚠ ${escapeHTML(errMsg)} <button onclick="switchTab('cash',$('tb-cash'))" style="background:none;border:none;color:inherit;text-decoration:underline;cursor:pointer;padding:0;font:inherit;font-weight:700">→ Go to Cash</button></div>`
      + `<div class="dist-cash-section"><div class="dist-cash-label">Cash on Hand</div><table class="dist-tbl" style="margin-top:0"><thead><tr>${DENOMS.map(d => `<th><span class="dist-tbl-denom" style="font-size:.5rem">$${d}</span></th>`).join('')}<th class="total-col"><span class="dist-tbl-denom" style="color:var(--text2);font-size:.5rem">TOT</span></th></tr></thead><tbody><tr>${cr}<td class="grand-total" style="font-size:.8rem">$${ct}</td></tr></tbody></table></div>`;
    return;
  }

  const rows = swb.map(p => {
    const safe = escapeHTML(p.n);
    const pt   = DENOMS.reduce((s, d) => s + (p.bills[d] || 0) * d, 0);
    const dot  = p.closer ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--accent);margin-left:3px;vertical-align:middle"></span>' : '';
    const cols = DENOMS.map(d => { const n = p.bills[d] || 0; return n > 0 ? `<td class="has-bills">${n}</td>` : `<td class="zero">—</td>`; }).join('');
    return `<tr><td>${safe}${dot}</td>${cols}<td class="person-total">$${pt}</td></tr>`;
  }).join('');

  let remRow = '', remBills = {}, remAT = 0;
  if (sumRem > 0) {
    remBills = lastRemainderBills || {};
    remAT    = DENOMS.reduce((s, d) => s + (remBills[d] || 0) * d, 0);
    const rc = DENOMS.map(d => { const n = remBills[d] || 0; return n > 0 ? `<td style="color:var(--muted);font-weight:600;font-size:.74rem">${n}</td>` : `<td class="zero">—</td>`; }).join('');
    remRow   = `<tr class="dist-rem-row"><td>Rem</td>${rc}<td style="color:var(--muted);font-weight:600;border-left:1px solid var(--border);font-size:.74rem">$${sumRem}</td></tr>`;
  }

  const dtCols = DENOMS.map(d => {
    const t = swb.reduce((s, p) => s + (p.bills[d] || 0), 0) + (remBills[d] || 0);
    return t > 0 ? `<td style="color:var(--gold)">${t}</td>` : `<td class="zero">—</td>`;
  }).join('');
  const dGT      = swb.reduce((s, p) => s + DENOMS.reduce((ss, d) => ss + (p.bills[d] || 0) * d, 0), 0) + remAT;
  const totalRow = `<tr class="dist-totals-row"><td>Total</td>${dtCols}<td class="grand-total">$${dGT}</td></tr>`;

  const cr = DENOMS.map(d => { const r = livePool[d] || 0; return r > 0 ? `<td style="font-weight:700">${r}</td>` : `<td class="zero">—</td>`; }).join('');
  const ct = DENOMS.reduce((s, d) => s + (livePool[d] || 0) * d, 0);
  const cashTfoot = `<tr class="dist-cash-hdr-row"><td colspan="${DENOMS.length + 2}">Cash on Hand</td></tr>`
    + `<tr class="dist-cash-data-row"><td style="color:var(--muted);font-size:.68rem;font-family:var(--font-mono)">On Hand</td>${cr}<td class="person-total">$${ct}</td></tr>`;

  $('dist-content').innerHTML =
    `<div class="dist-tbl-wrap"><table class="dist-tbl"><thead><tr><th>Name</th>${hCols}</tr></thead><tbody>${rows}${remRow}</tbody><tfoot>${totalRow}${cashTfoot}</tfoot></table></div>`;
}
