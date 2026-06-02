function renderDist(swb, pa) {
  _lastDistStaff = swb;
  renderDistTable(swb, pa);
}

function renderDistTable(swb, poolAfter) {
  const sb = $('stale-dist'); if (sb) sb.classList.remove('visible');
  const unpaid      = swb.reduce((s, p) => s + Math.max(0, p.rem || 0), 0);
  const sumRem      = lastLeftover, remPV = poolValue(lastRemainderBills || {});
  const hasRemShort = sumRem > 0 && remPV !== sumRem;
  const hasErr      = !!lastDistributionError || unpaid > 0 || hasRemShort;
  const errMsg      = lastDistributionError || (unpaid > 0 ? 'Distribution short $' + unpaid : 'Remainder not representable by available bills');

  // Requirement cards always shown — they give live feedback even when ok
  const req = getSmallBillRequirements(swb, livePool, lastLeftover);
  const reqCards = renderSmallBillRequirementCards(req);

  if (hasErr) {
    // Try to suggest a simple set of bill breaks that would resolve the shortage
    const preview = previewSmallBillTrades(swb, livePool, lastLeftover);
    const previewHTML = preview
      ? renderTradePreview(preview) + renderDistTableMarkup(preview.staff, {
          remainderBills: preview.remainderBills,
          leftover: lastLeftover,
          preview: true
        })
      : '';

    $('dist-content').innerHTML =
      `<div class="warn-box" style="margin-bottom:10px">⚠ ${escapeHTML(errMsg)} `
      + (preview
          ? 'Preview below assumes these trades before payout.'
          : `<button onclick="switchTab('cash',$('tb-cash'))" style="background:none;border:none;color:inherit;text-decoration:underline;cursor:pointer;padding:0;font:inherit;font-weight:700">→ Go to Cash</button>`)
      + `</div>`
      + reqCards
      + previewHTML;
    return;
  }

  $('dist-content').innerHTML = reqCards + renderDistTableMarkup(swb, {
    remainderBills: lastRemainderBills || {},
    leftover: lastLeftover
  });
}

// ── Requirement cards ──────────────────────────────────────────────────────────

function renderSmallBillRequirementCards(req) {
  function statusClass(short) { return short > 0 ? 'short' : 'ok'; }
  function shortText(short, unit) {
    if (short > 0) return 'short ' + (unit === '$' ? '$' : '') + short;
    return 'covered';
  }

  const cards = [
    {
      title: 'Minimum $1s',
      value: req.availableOnes + ' / ' + req.minOnes,
      sub:   shortText(req.onesShort, 'count'),
      status: statusClass(req.onesShort)
    },
    {
      title: 'Min $1+$5 value',
      value: '$' + req.availableOneFiveValue + ' / $' + req.minOneFiveValue,
      sub:   shortText(req.oneFiveShort, '$'),
      status: statusClass(req.oneFiveShort)
    },
    {
      title: 'Min $1+$5+$10',
      value: '$' + req.availableOneFiveTenValue + ' / $' + req.minOneFiveTenValue,
      sub:   '$50s cover $' + req.fiftyCoverageValue + ' of odd tens',
      status: statusClass(req.oneFiveTenShort)
    }
  ];

  return `<div class="dist-req-grid">${cards.map(card =>
    `<div class="dist-req-card ${card.status}">
      <div class="dist-req-title">${card.title}</div>
      <div class="dist-req-value">${card.value}</div>
      <div class="dist-req-sub">${card.sub}</div>
    </div>`
  ).join('')}</div>`;
}

// ── Trade preview ──────────────────────────────────────────────────────────────

function renderCountCell(count) {
  return count > 0 ? `<td class="has-bills">${count}</td>` : '<td class="zero">—</td>';
}

function renderTradePreview(preview) {
  const nowCells = DENOMS.map(d => renderCountCell(livePool[d] || 0)).join('');
  const deltaCells = DENOMS.map(d => {
    const delta = preview.deltas[d] || 0;
    if (delta === 0) return '<td class="zero">—</td>';
    return `<td class="${delta > 0 ? 'delta-pos' : 'delta-neg'}">${delta > 0 ? '+' : ''}${delta}</td>`;
  }).join('');
  const afterCells = DENOMS.map(d => renderCountCell(preview.pool[d] || 0)).join('');
  const tradeItems = preview.trades.length
    ? `<ul>${preview.trades.map(t => `<li>${escapeHTML(t)}</li>`).join('')}</ul>`
    : '';

  return `<div class="dist-trade-card">
    <div class="dist-trade-top">
      <div>
        <div class="dist-trade-label">Simple trade preview</div>
        <div class="dist-trade-sub">Counts are not saved until Cash is updated.</div>
      </div>
    </div>
    <div class="dist-trade-list">${tradeItems}</div>
    <div class="dist-tbl-wrap dist-trade-table">
      <table class="dist-tbl">
        <thead><tr><th></th>${DENOMS.map(d => `<th><span class="dist-tbl-denom">$${d}</span></th>`).join('')}</tr></thead>
        <tbody>
          <tr><td>Now</td>${nowCells}</tr>
          <tr><td>Delta</td>${deltaCells}</tr>
          <tr><td>After</td>${afterCells}</tr>
        </tbody>
      </table>
    </div>
  </div>`;
}

// ── Distribution table markup ──────────────────────────────────────────────────

function renderDistTableMarkup(swb, options = {}) {
  const hCols  = DENOMS.map(d => `<th><span class="dist-tbl-denom">$${d}</span></th>`).join('')
               + '<th class="total-col"><span class="dist-tbl-denom" style="color:var(--text2)">TOT</span></th>';
  const sumRem = options.leftover || 0;
  const previewLabel = options.preview
    ? '<div class="dist-preview-label">Distribution after simple trades</div>'
    : '';

  const rows = swb.map(p => {
    const safe = escapeHTML(p.n);
    const pt   = DENOMS.reduce((s, d) => s + (p.bills[d] || 0) * d, 0);
    const dot  = p.closer
      ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--accent);margin-left:3px;vertical-align:middle"></span>'
      : '';
    const cols = DENOMS.map(d => {
      const n = p.bills[d] || 0;
      return n > 0 ? `<td class="has-bills">${n}</td>` : `<td class="zero">—</td>`;
    }).join('');
    return `<tr><td>${safe}${dot}</td>${cols}<td class="person-total">$${pt}</td></tr>`;
  }).join('');

  let remRow = '', remBills = {}, remAT = 0;
  if (sumRem > 0) {
    remBills = options.remainderBills || {};
    remAT    = DENOMS.reduce((s, d) => s + (remBills[d] || 0) * d, 0);
    const rc = DENOMS.map(d => {
      const n = remBills[d] || 0;
      return n > 0
        ? `<td style="color:var(--muted);font-weight:600;font-size:.74rem">${n}</td>`
        : `<td class="zero">—</td>`;
    }).join('');
    remRow = `<tr class="dist-rem-row"><td>Rem</td>${rc}<td style="color:var(--muted);font-weight:600;border-left:1px solid var(--border);font-size:.74rem">$${sumRem}</td></tr>`;
  }

  const dtCols = DENOMS.map(d => {
    const t = swb.reduce((s, p) => s + (p.bills[d] || 0), 0) + (remBills[d] || 0);
    return t > 0 ? `<td style="color:var(--gold)">${t}</td>` : `<td class="zero">—</td>`;
  }).join('');
  const dGT      = swb.reduce((s, p) => s + DENOMS.reduce((ss, d) => ss + (p.bills[d] || 0) * d, 0), 0) + remAT;
  const totalRow = `<tr class="dist-totals-row"><td>Total</td>${dtCols}<td class="grand-total">$${dGT}</td></tr>`;

  return previewLabel
    + `<div class="dist-tbl-wrap"><table class="dist-tbl"><thead><tr><th>Name</th>${hCols}</tr></thead><tbody>${rows}${remRow}</tbody><tfoot>${totalRow}</tfoot></table></div>`;
}
