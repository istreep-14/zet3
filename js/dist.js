// renderDist — night shift distribution tab
//
// Parameters:
//   swb      — staff array post-distribution (has .bills assigned)
//   pa       — poolAfter (bill counts remaining)
//   distCtx  — { remainderBills, distributionError, leftover, pool }
//
// No computation globals are read here. All data arrives via parameters.

// Pending trade state — set by renderDistTable, consumed by apply button handlers.
let _pendingTradeUp   = null;
let _pendingTradeDown = null;

function renderDist(swb, pa, distCtx) {
  _lastDistStaff = swb;
  renderDistTable(swb, pa, distCtx);
}

function renderDistTable(swb, poolAfter, distCtx) {
  const sb = $('stale-dist'); if (sb) sb.classList.remove('visible');

  // Unpack context; fall back to globals so existing callers still work.
  const remainderBills    = distCtx?.remainderBills    ?? lastRemainderBills   ?? {};
  const distributionError = distCtx?.distributionError ?? lastDistributionError ?? '';
  const leftover          = distCtx?.leftover          ?? lastLeftover          ?? 0;
  const pool              = distCtx?.pool              ?? livePool              ?? {};

  const unpaid      = swb.reduce((s, p) => s + Math.max(0, p.rem || 0), 0);
  const remPV       = poolValue(remainderBills);
  const hasRemShort = leftover > 0 && remPV !== leftover;
  const hasErr      = !!distributionError || unpaid > 0 || hasRemShort;
  const errMsg      = distributionError
    || (unpaid > 0 ? 'Distribution short $' + unpaid : 'Remainder not representable by available bills');

  const req     = getSmallBillRequirements(swb, pool, leftover);
  const reqHTML = renderRequirementSummary(req, pool);

  // Compute both trade options independently — trade-down for shortage, trade-up for excess.
  _pendingTradeDown = hasErr ? previewSmallBillTrades(swb, pool, leftover) : null;
  _pendingTradeUp   = !hasErr ? computeTradeUp(pool, req) : null;

  const tradeDownHTML = renderTradeDownCard(_pendingTradeDown, pool);
  const tradeUpHTML   = _pendingTradeUp ? renderTradeUpCard(_pendingTradeUp, pool) : '';

  if (hasErr) {
    const previewTableHTML = _pendingTradeDown
      ? '<div class="dist-preview-label">Distribution after simple trades</div>'
        + renderDistTableMarkup(_pendingTradeDown.staff, {
            remainderBills: _pendingTradeDown.remainderBills,
            leftover,
            preview: true,
          })
      : '';

    $('dist-content').innerHTML =
      `<div class="warn-box" style="margin-bottom:10px">⚠ ${escapeHTML(errMsg)}`
      + (_pendingTradeDown
          ? ''
          : ` <button onclick="switchTab('cash',$('tb-cash'))" style="background:none;border:none;color:inherit;text-decoration:underline;cursor:pointer;padding:0;font:inherit;font-weight:700">→ Go to Cash</button>`)
      + `</div>`
      + reqHTML
      + tradeDownHTML
      + previewTableHTML;
    return;
  }

  $('dist-content').innerHTML = reqHTML + tradeUpHTML + renderDistTableMarkup(swb, {
    remainderBills,
    leftover,
  });
}

// ── Requirement summary ───────────────────────────────────────────────────────

function renderRequirementSummary(req, pool) {
  const minFives = Math.max(0, (req.minOneFiveValue - req.minOnes) / 5);
  const minTens  = Math.max(0, (req.minOneFiveTenValue - req.minOneFiveValue) / 10);
  const shortFives = Math.max(0, minFives - (pool[5]  || 0));
  const shortTens  = Math.max(0, minTens  - (pool[10] || 0));

  function reqRow(label, need, have, short) {
    const ok    = short <= 0;
    const cls   = ok ? 'req-row--ok' : 'req-row--short';
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
    ${reqRow('$1s',  req.minOnes, pool[1]  || 0, req.onesShort)}
    ${reqRow('$5s',  minFives,    pool[5]  || 0, shortFives)}
    ${reqRow('$10s', minTens,     pool[10] || 0, shortTens)}
  </div>`;
}

// ── Apply pending trades ──────────────────────────────────────────────────────

function applyPendingTradeUp() {
  if (_pendingTradeUp) applyBillTradeToInputs(_pendingTradeUp.newPool);
}

function applyPendingTradeDown() {
  if (_pendingTradeDown) applyBillTradeToInputs(_pendingTradeDown.pool);
}

// ── Trade card: up (consolidate excess small bills → $20s) ───────────────────

function renderTradeUpCard(tradeUp, pool) {
  const nowCells   = DENOMS.map(d => renderCountCell(pool[d] || 0)).join('');
  const deltaCells = DENOMS.map(d => {
    const delta = tradeUp.delta[d] || 0;
    if (delta === 0) return '<td class="zero">—</td>';
    return `<td class="${delta > 0 ? 'delta-pos' : 'delta-neg'}">${delta > 0 ? '+' : ''}${delta}</td>`;
  }).join('');
  const afterCells = DENOMS.map(d => renderCountCell(tradeUp.newPool[d] || 0)).join('');

  const nowTotal   = DENOMS.reduce((s, d) => s + (pool[d] || 0) * d, 0);
  const deltaTotal = DENOMS.reduce((s, d) => s + (tradeUp.delta[d] || 0) * d, 0);
  const afterTotal = DENOMS.reduce((s, d) => s + (tradeUp.newPool[d] || 0) * d, 0);
  const deltaTotalCell = deltaTotal === 0
    ? '<td class="delta-pos grand-total">$0</td>'
    : `<td class="${deltaTotal > 0 ? 'delta-pos' : 'delta-neg'} grand-total">${deltaTotal > 0 ? '+$' : '-$'}${Math.abs(deltaTotal)}</td>`;

  return `<div class="trade-card trade-card--up">
    <div class="trade-card-hdr">
      <div class="trade-card-info">
        <div class="trade-card-title">↑ Consolidate → $20s</div>
        <div class="trade-card-sub">Swap excess small bills for ${tradeUp.new20s}&nbsp;×&nbsp;$20. Cash tab updates on apply.</div>
      </div>
      <button class="trade-apply-btn" onclick="applyPendingTradeUp()">Apply</button>
    </div>
    <div class="dist-tbl-wrap dist-trade-table">
      <table class="dist-tbl">
        <thead><tr><th></th>${DENOMS.map(d => `<th><span class="dist-tbl-denom">$${d}</span></th>`).join('')}<th class="total-col"><span class="dist-tbl-denom" style="color:var(--text2)">TOT</span></th></tr></thead>
        <tbody>
          <tr><td>Now</td>${nowCells}<td class="person-total">$${nowTotal}</td></tr>
          <tr><td>Delta</td>${deltaCells}${deltaTotalCell}</tr>
          <tr><td>After</td>${afterCells}<td class="person-total">$${afterTotal}</td></tr>
        </tbody>
      </table>
    </div>
  </div>`;
}

// ── Trade card: down (break large bills → small change) ───────────────────────

function renderTradeDownCard(preview, pool) {
  if (!preview) return '';
  const nowPool    = pool ?? livePool ?? {};
  const nowCells   = DENOMS.map(d => renderCountCell(nowPool[d] || 0)).join('');
  const deltaCells = DENOMS.map(d => {
    const delta = preview.deltas[d] || 0;
    if (delta === 0) return '<td class="zero">—</td>';
    return `<td class="${delta > 0 ? 'delta-pos' : 'delta-neg'}">${delta > 0 ? '+' : ''}${delta}</td>`;
  }).join('');
  const afterCells = DENOMS.map(d => renderCountCell(preview.pool[d] || 0)).join('');
  const tradeItems = preview.trades.length
    ? `<ul>${preview.trades.map(t => `<li>${escapeHTML(t)}</li>`).join('')}</ul>`
    : '';

  const nowTotal   = DENOMS.reduce((s, d) => s + (nowPool[d] || 0) * d, 0);
  const deltaTotal = DENOMS.reduce((s, d) => s + (preview.deltas[d] || 0) * d, 0);
  const afterTotal = DENOMS.reduce((s, d) => s + (preview.pool[d] || 0) * d, 0);
  const deltaTotalCell = deltaTotal === 0
    ? '<td class="delta-pos grand-total">$0</td>'
    : `<td class="${deltaTotal > 0 ? 'delta-pos' : 'delta-neg'} grand-total">${deltaTotal > 0 ? '+$' : '-$'}${Math.abs(deltaTotal)}</td>`;

  return `<div class="trade-card trade-card--down">
    <div class="trade-card-hdr">
      <div class="trade-card-info">
        <div class="trade-card-title">↓ Break Bills → Small Change</div>
        <div class="trade-card-sub">Counts not saved until applied.</div>
      </div>
      <button class="trade-apply-btn" onclick="applyPendingTradeDown()">Apply</button>
    </div>
    <div class="trade-card-trades">${tradeItems}</div>
    <div class="dist-tbl-wrap dist-trade-table">
      <table class="dist-tbl">
        <thead><tr><th></th>${DENOMS.map(d => `<th><span class="dist-tbl-denom">$${d}</span></th>`).join('')}<th class="total-col"><span class="dist-tbl-denom" style="color:var(--text2)">TOT</span></th></tr></thead>
        <tbody>
          <tr><td>Now</td>${nowCells}<td class="person-total">$${nowTotal}</td></tr>
          <tr><td>Delta</td>${deltaCells}${deltaTotalCell}</tr>
          <tr><td>After</td>${afterCells}<td class="person-total">$${afterTotal}</td></tr>
        </tbody>
      </table>
    </div>
  </div>`;
}

// ── Distribution table markup ──────────────────────────────────────────────────

function renderCountCell(count) {
  return count > 0 ? `<td class="has-bills">${count}</td>` : '<td class="zero">—</td>';
}

function renderDistTableMarkup(swb, options = {}) {
  const hCols  = DENOMS.map(d => `<th><span class="dist-tbl-denom">$${d}</span></th>`).join('')
               + '<th class="total-col"><span class="dist-tbl-denom" style="color:var(--text2)">TOT</span></th>';
  const sumRem      = options.leftover || 0;
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
