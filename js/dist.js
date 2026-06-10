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

// ── Close Time Bills sidebar ──────────────────────────────────────────────────

// Persisted state across re-renders inside the open sidebar
let _ctRange    = 3;   // steps from center on each side (pinch adjusts this)
let _ctCenter   = 2;
let _ctRoleData = null;
let _ctTotal    = 0;
let _ctPool     = null;

function openCloseTimeSidebar() {
  if (!lastStaff || !lastStaff.length || !lastTotal) return;

  const { rawData, gcIn, gcOut } = collectNamedStaffRows();
  if (!rawData.length) return;

  _ctPool  = livePool || {};
  _ctTotal = lastTotal;

  // In-time uses defaults (start time stable).
  // fixedOut is ONLY the individual's own typed value — blank means "flex with close time".
  _ctRoleData = rawData.map(r => {
    const role = getRoleForList(_listIdForRowId(r.rowId));
    const rDef = roleDefaults[role] || {};
    return {
      name:     r.name,
      effIn:    r.inStr  || rDef.in  || gcIn,
      fixedOut: r.outStr || '',
    };
  }).filter(r => r.name);

  const gcOutParsed = parseTimeString(gcOut);
  _ctCenter = (gcOutParsed.valid && !gcOutParsed.empty) ? gcOutParsed.value : 2;

  _ctRenderSidebar();
  openModal('closeTimeSidebar');
}

function closeCloseTimeSidebar() {
  closeModal('closeTimeSidebar');
}

// Select a column — commit that time as the new gc-out, re-center the table on it
function selectCloseTime(t) {
  const el = $('gc-out');
  if (el) { el.value = String(t); onDefaultTimesChange(); }
  _ctCenter = t;
  _ctRenderSidebar();
}

function _ctRenderSidebar() {
  // Build time list centered on _ctCenter with _ctRange steps on each side
  const times = [];
  for (let i = -_ctRange; i <= _ctRange; i++) {
    const t = Math.round((_ctCenter + i * 0.25) * 4) / 4;
    if (t > 0 && t <= 12) times.push(t);
  }

  const cols   = times.map(ct => _computeForCloseTime(_ctRoleData, _ctTotal, ct, _ctPool));
  const nowIdx = times.findIndex(t => Math.abs(t - _ctCenter) < 0.01);

  const body = $('close-time-body');
  body.innerHTML = _renderCloseTimeTable(times, cols, _ctPool, nowIdx);

  // Attach pinch listener to the scroll wrapper
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
      _ctRange = Math.min(_ctRange + 1, 9);
      pinchStartDist = d;
      _ctRenderSidebar();
    } else if (pinchStartDist - d > 28) {
      _ctRange = Math.max(_ctRange - 1, 1);
      pinchStartDist = d;
      _ctRenderSidebar();
    }
  }, { passive: true });
  wrap.addEventListener('touchend', () => { pinchStartDist = 0; }, { passive: true });
}

function _fmtCloseTime(t) {
  let hr = Math.floor(t), mn = Math.round((t - hr) * 60);
  if (mn === 60) { hr++; mn = 0; }
  const h12 = hr % 12 || 12;
  return h12 + (mn > 0 ? ':' + (mn < 10 ? '0' : '') + mn : '') + (t <= 5 ? 'a' : 'p');
}

function _computeForCloseTime(roleData, total, closeTime, pool) {
  const defaultIn = 5;
  const staff = roleData.map(r => {
    const effOut = r.fixedOut || closeTime;
    const inParsed  = parseTimeString(r.effIn);
    const outParsed = parseTimeString(String(effOut));
    const inVal  = (inParsed.valid  && !inParsed.empty)  ? inParsed.value  : defaultIn;
    const outVal = (outParsed.valid && !outParsed.empty) ? outParsed.value : closeTime;
    let h = outVal - inVal; if (h < 0) h += 12;
    const eo = outVal < inVal ? outVal + 12 : outVal;
    return { n: r.name, h, eo, base: 0, bonus: 0, closer: false, final: 0 };
  }).filter(p => p.h > 0 && p.h <= 12);

  if (!staff.length) return null;

  const totH = staff.reduce((s, p) => s + p.h, 0);
  if (!totH) return null;

  const rate = total / totH;
  staff.forEach(p => { p.base = Math.floor(p.h * rate); });

  const floored   = staff.reduce((s, p) => s + p.base, 0);
  const remainder = total - floored;
  const peakEo    = Math.max(...staff.map(p => p.eo));
  const closers   = staff.filter(p => p.eo >= peakEo);
  const perCloser = closers.length ? Math.floor(remainder / closers.length) : 0;
  const leftover  = remainder - perCloser * closers.length;
  closers.forEach(p => { p.bonus = perCloser; p.closer = true; });
  staff.forEach(p => { p.final = p.base + p.bonus; });

  const req = getSmallBillRequirements(staff, pool, leftover);
  return {
    staff,
    req,
    minFives: Math.max(0, (req.minOneFiveValue - req.minOnes) / 5),
    minTens:  Math.max(0, (req.minOneFiveTenValue - req.minOneFiveValue) / 10),
    leftover,
  };
}

function _renderCloseTimeTable(times, cols, pool, nowIdx) {
  const names = _ctRoleData.map(r => r.name);

  // nowCls(i): extra class string for cells in the "current" column
  const n = (i) => i === nowIdx ? ' ct-col-now' : '';

  // Header — time columns are tappable to select that close time
  const thCells = times.map((t, i) =>
    `<th class="${i === nowIdx ? 'ct-th-now' : 'ct-th-sel'}" onclick="selectCloseTime(${t})">${_fmtCloseTime(t)}</th>`
  ).join('');

  // Per-person tip rows
  const personRows = names.map(name => {
    const cells = cols.map((col, i) => {
      if (!col) return `<td class="zero${n(i)}">—</td>`;
      const p = col.staff.find(s => s.n === name);
      if (!p) return `<td class="zero${n(i)}">—</td>`;
      return `<td class="${p.closer ? 'ct-closer' : 'ct-person'}${n(i)}">$${p.final}</td>`;
    }).join('');
    return `<tr><td class="ct-lbl">${escapeHTML(name)}</td>${cells}</tr>`;
  }).join('');

  // Remainder row
  const remRow = `<tr class="ct-rem-row"><td class="ct-lbl">Chump</td>`
    + cols.map((col, i) => {
        if (!col || !col.leftover) return `<td class="zero${n(i)}">—</td>`;
        return `<td class="ct-rem${n(i)}">$${col.leftover}</td>`;
      }).join('')
    + '</tr>';

  // Bill rows — only $1s count; $1+5 and $1+5+10 cumulative values
  const avail15   = (pool[1] || 0) + (pool[5]  || 0) * 5;
  const avail1510 = avail15        + (pool[10] || 0) * 10;

  function dataRow(label, getCls, getVal) {
    return `<tr><td class="ct-lbl">${label}</td>`
      + cols.map((col, i) => {
          if (!col) return `<td class="zero${n(i)}">—</td>`;
          const { cls, val } = getVal(col);
          return `<td class="${cls}${n(i)}">${val}</td>`;
        }).join('')
      + '</tr>';
  }

  const onesRow    = dataRow('$1s', null, col => {
    const v = col.req.minOnes, ok = v <= (pool[1] || 0);
    return { cls: ok ? 'ct-ok' : 'ct-short', val: v };
  });
  const val15Row   = dataRow('$1+5', null, col => {
    const v = col.req.minOneFiveValue, ok = v <= avail15;
    return { cls: ok ? 'ct-ok' : 'ct-short', val: '$' + v };
  });
  const val1510Row = dataRow('$1+5+10', null, col => {
    const v = col.req.minOneFiveTenValue, ok = v <= avail1510;
    return { cls: ok ? 'ct-ok' : 'ct-short', val: '$' + v };
  });

  const divRow = (label) =>
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

  const actionBtns = '<div class="dist-action-grid dist-action-grid--three">'
    + '<button class="ct-open-btn" onclick="openBillChartSheet()">Bill Chart</button>'
    + '<button class="ct-open-btn" onclick="openCloseTimeSidebar()">⏱ Close Time</button>'
    + '<button class="ct-open-btn rem-open-btn" onclick="openRemainderSidebar()">Chump</button>'
    + '</div>';

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
      + previewTableHTML
      + actionBtns;
    return;
  }

  $('dist-content').innerHTML = reqHTML + tradeUpHTML + renderDistTableMarkup(swb, {
    remainderBills,
    leftover,
  }) + actionBtns;
}

// ── Requirement summary ───────────────────────────────────────────────────────

function renderRequirementSummary(req, pool) {
  return renderSmallBillRequirementSummary(req, pool, { title: 'Minimum small bills' });
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
        ${renderDistColGroup()}
        <thead><tr><th></th>${DENOMS.map(d => `<th><span class="dist-tbl-denom">${d}</span></th>`).join('')}<th class="total-col"><span class="dist-tbl-denom" style="color:var(--text2)">TOT</span></th></tr></thead>
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
        ${renderDistColGroup()}
        <thead><tr><th></th>${DENOMS.map(d => `<th><span class="dist-tbl-denom">${d}</span></th>`).join('')}<th class="total-col"><span class="dist-tbl-denom" style="color:var(--text2)">TOT</span></th></tr></thead>
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

function renderDistColGroup() {
  return '<colgroup><col class="dist-name-col">'
    + DENOMS.map(() => '<col class="dist-bill-col">').join('')
    + '<col class="dist-total-col"></colgroup>';
}

function renderDistTableMarkup(swb, options = {}) {
  const hCols  = DENOMS.map(d => `<th><span class="dist-tbl-denom">${d}</span></th>`).join('')
               + '<th class="total-col"><span class="dist-tbl-denom" style="color:var(--text2)">TOT</span></th>';
  const sumRem      = options.leftover || 0;
  const previewLabel = options.preview
    ? '<div class="dist-preview-label">Distribution after simple trades</div>'
    : '';

  const rows = swb.map(p => {
    const safe = escapeHTML(p.n);
    const pt   = DENOMS.reduce((s, d) => s + (p.bills[d] || 0) * d, 0);
    const cols = DENOMS.map(d => {
      const n = p.bills[d] || 0;
      return n > 0 ? `<td class="has-bills">${n}</td>` : `<td class="zero">—</td>`;
    }).join('');
    return `<tr><td>${safe}</td>${cols}<td class="person-total">$${pt}</td></tr>`;
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
    remRow = `<tr class="dist-rem-row"><td>Chump</td>${rc}<td style="color:var(--muted);font-weight:600;border-left:1px solid var(--border);font-size:.74rem">$${sumRem}</td></tr>`;
  }

  const dtCols = DENOMS.map(d => {
    const t = swb.reduce((s, p) => s + (p.bills[d] || 0), 0) + (remBills[d] || 0);
    return t > 0 ? `<td style="color:var(--gold)">${t}</td>` : `<td class="zero">—</td>`;
  }).join('');
  const dGT      = swb.reduce((s, p) => s + DENOMS.reduce((ss, d) => ss + (p.bills[d] || 0) * d, 0), 0) + remAT;
  const totalRow = `<tr class="dist-totals-row"><td>Total</td>${dtCols}<td class="grand-total">$${dGT}</td></tr>`;

  return previewLabel
    + `<div class="dist-tbl-wrap"><table class="dist-tbl">${renderDistColGroup()}<thead><tr><th>Name</th>${hCols}</tr></thead><tbody>${rows}${remRow}</tbody><tfoot>${totalRow}</tfoot></table></div>`;
}

function openBillChartSheet() {
  const body = $('billChartBody');
  if (!body) return;
  if (!_lastDistStaff || !_lastDistStaff.length) {
    body.innerHTML = '<div class="warn-box">Add cash and staff to see the bill chart.</div>';
  } else if (lastDistributionError) {
    body.innerHTML = `<div class="warn-box">⚠ ${escapeHTML(lastDistributionError)}</div>`;
  } else {
    body.innerHTML = renderDistTableMarkup(_lastDistStaff, {
      remainderBills: lastRemainderBills,
      leftover: lastLeftover,
    });
  }
  openModal('billChartSheet');
}

function closeBillChartSheet() {
  closeModal('billChartSheet');
}
