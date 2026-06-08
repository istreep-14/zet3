// Support staff helpers — cut assignments, overlap hours, tip-out modal

// ── Collect support rows ──────────────────────────────────────────────────────

function collectSupportRows() {
  const rows = document.querySelectorAll('#supportList .staff-row-modal');
  const result = [];
  rows.forEach(r => {
    const name = r.querySelector('[data-field="name"]').value.trim();
    if (!name) return;
    const rowId  = r.id.replace('staff', '');
    const inEl   = r.querySelector('[data-field="in"]');
    const outEl  = r.querySelector('[data-field="out"]');
    const defIn  = roleDefaults.support?.in  || $('gc-in')?.value.trim()  || '';
    const defOut = roleDefaults.support?.out || $('gc-out')?.value.trim() || '';
    const inStr  = inEl?.value.trim()  || defIn;
    const outStr = outEl?.value.trim() || defOut;
    const inP    = parseTimeString(inStr);
    const outP   = parseTimeString(outStr);
    // Convert to absolute day-shift hours (same scale as engine_day.js)
    const inAbs  = (inP.valid  && !inP.empty)  ? dayShiftAbsolute(inP.value)  : null;
    const outAbs = (outP.valid && !outP.empty)  ? dayShiftAbsolute(outP.value) : null;
    result.push({
      name, rowId,
      inAbs, outAbs,
      cuts: supportCutAssignments[rowId] || [],
    });
  });
  return result;
}

// ── Cut window helpers ────────────────────────────────────────────────────────

// Returns { morning, middle, party1?, party2? } window {start, end} in absolute hours.
// Windows are derived from staffRows (same logic as engine_day.js deriveDayShiftWindows).
function deriveSupportCutWindows(poolCash, partyConfig, bartenderRows, serverRows) {
  // Parse absolute times for all tipped staff
  const toAbs = rows => rows.map(r => {
    const defIn  = roleDefaults.bartender?.in  || roleDefaults.server?.in  || $('gc-in')?.value.trim()  || '';
    const defOut = roleDefaults.bartender?.out || roleDefaults.server?.out || $('gc-out')?.value.trim() || '';
    const inStr  = r.inStr  || defIn;
    const outStr = r.outStr || defOut;
    const inP    = parseTimeString(inStr);
    const outP   = parseTimeString(outStr);
    return {
      inAbs:          (inP.valid  && !inP.empty)  ? dayShiftAbsolute(inP.value)  : null,
      outAbs:         (outP.valid && !outP.empty)  ? dayShiftAbsolute(outP.value) : null,
      hasExplicitOut: !!r.outStr,
      role:           r.role,
    };
  });

  const bars = toAbs(bartenderRows);
  const srvs = toAbs(serverRows);
  const all  = [...bars, ...srvs];

  const inTimes = all.map(p => p.inAbs).filter(t => t !== null);
  if (!inTimes.length) return null;

  const morningStart = Math.min(...inTimes);

  const srvOuts = srvs.filter(p => p.hasExplicitOut && p.outAbs !== null).map(p => p.outAbs);
  if (!srvOuts.length) return null;
  const morningEnd = Math.max(...srvOuts);

  const barOuts = bars.filter(p => p.hasExplicitOut && p.outAbs !== null).map(p => p.outAbs);
  if (!barOuts.length) return null;
  const middleEnd = Math.max(...barOuts);

  if (morningEnd <= morningStart || middleEnd <= morningEnd) return null;

  const windows = {
    morning: { start: morningStart, end: morningEnd },
    middle:  { start: morningEnd,   end: middleEnd  },
  };

  // Party pools use explicit window inputs
  ['party1', 'party2'].forEach(pid => {
    const cfg = partyConfig?.[pid];
    if (!cfg?.enabled) return;
    const sp = parseTimeString(cfg.start || '');
    const ep = parseTimeString(cfg.end   || '');
    if (sp.valid && !sp.empty && ep.valid && !ep.empty) {
      windows[pid] = {
        start: dayShiftAbsolute(sp.value),
        end:   dayShiftAbsolute(ep.value),
      };
    }
  });

  return windows;
}

// Hours a support person overlaps with a cut window
function supportOverlapHours(person, win) {
  if (person.inAbs === null || person.outAbs === null) return 0;
  const start = Math.max(person.inAbs,  win.start);
  const end   = Math.min(person.outAbs, win.end);
  return Math.max(0, parseFloat((end - start).toFixed(4)));
}

// ── Compute tip-outs ──────────────────────────────────────────────────────────

// Returns { cutId: [ { name, rowId, hours, pct, tipOut, cutHours, ratePerHr } ] }
function computeAllSupportTipOuts(rawPoolCash, partyConfig, supportPeople) {
  if (!supportPeople || !supportPeople.length) return {};

  // Collect tipped staff rows to derive cut windows
  const bartenderRows = _collectDayTippedRows('bartenderList', 'bartender');
  const serverRows    = _collectDayTippedRows('serverList', 'server');

  const windows = deriveSupportCutWindows(rawPoolCash, partyConfig, bartenderRows, serverRows);
  if (!windows) return {};

  const result = {};
  Object.entries(windows).forEach(([cutId, win]) => {
    const cutTotal = rawPoolCash[cutId] || 0;
    if (cutTotal <= 0) return;
    const cutHours = win.end - win.start;
    if (cutHours <= 0) return;
    const ratePerHr = cutTotal / cutHours;

    const items = supportPeople
      .filter(p => p.cuts.includes(cutId))
      .map(p => {
        const override = supportTipOutOverrides[cutId]?.[p.rowId];
        const hours   = override?.hours !== undefined ? override.hours : supportOverlapHours(p, win);
        const pct     = override?.pct   !== undefined ? override.pct   : 10;
        const tipOut  = Math.floor(hours * ratePerHr * pct / 100);
        return { name: p.name, rowId: p.rowId, hours, pct, tipOut, cutHours, ratePerHr };
      });

    if (items.length) result[cutId] = items;
  });
  return result;
}

function _collectDayTippedRows(listId, role) {
  const rows = document.querySelectorAll('#' + listId + ' .staff-row-modal');
  const result = [];
  rows.forEach(r => {
    const name = r.querySelector('[data-field="name"]').value.trim();
    if (!name) return;
    const inEl  = r.querySelector('[data-field="in"]');
    const outEl = r.querySelector('[data-field="out"]');
    result.push({
      inStr:  inEl?.value.trim()  || '',
      outStr: outEl?.value.trim() || '',
      role,
    });
  });
  return result;
}

// ── Aggregate support tip-outs into distributable people objects ──────────────

// Returns an array of support person objects (same shape as engineResult.people)
// with final = sum of tip-outs across all their assigned cuts.
function aggregateSupportForDist(supportTipOuts) {
  const byPerson = {};
  Object.values(supportTipOuts).forEach(items => {
    items.forEach(item => {
      if (!byPerson[item.rowId]) {
        byPerson[item.rowId] = {
          n:          item.name,
          _rowId:     item.rowId,
          role:       'support',
          final:      0,
          h:          0,
          i: 0, o: 0, eo: 0,
          closer:     false,
          _autoCloser: false,
          base: 0, bonus: 0,
          rawShares:  {},
          bills:      {},
        };
      }
      byPerson[item.rowId].final += item.tipOut;
      byPerson[item.rowId].h    += item.hours;
    });
  });
  return Object.values(byPerson).filter(p => p.final > 0);
}

// ── Tip-out modal ─────────────────────────────────────────────────────────────

let _tipOutModalCutId = null; // which cut is open

function openSupportTipOutModal(cutId) {
  _tipOutModalCutId = cutId;

  const cutLabels = { morning: 'Morning Cut', middle: 'Middle Cut', party1: 'Party 1', party2: 'Party 2' };
  const result    = lastDayResult;
  if (!result) return;

  const tipOuts  = result.supportTipOuts || {};
  const items    = tipOuts[cutId] || [];
  const rawCash  = result.rawPoolCash?.[cutId] || 0;
  const adjCash  = rawCash - items.reduce((s, x) => s + x.tipOut, 0);

  const win = _getCutWindowForModal(cutId);
  const winStr = win ? _fmtAbsTime(win.start) + '–' + _fmtAbsTime(win.end)
                     + ' (' + parseFloat(win.end - win.start).toFixed(2) + ' hrs)' : '—';

  $('supportModalTitle').textContent = (cutLabels[cutId] || cutId) + ' · Support Tip-Out';

  if (!items.length) {
    $('supportModalBody').innerHTML = `
      <div style="color:var(--muted);font-size:.8rem;padding:8px 0">
        No support staff assigned to this cut.<br>
        <em style="font-size:.7rem">Go to Staff → Support and assign cuts to each support person.</em>
      </div>`;
    openModal('supportTipOutModal');
    return;
  }

  const totalTipOut = items.reduce((s, x) => s + x.tipOut, 0);
  const ratePerHr   = items[0]?.ratePerHr || 0;
  const cutHrs      = items[0]?.cutHours  || 0;

  const cards = items.map(item => `
    <div class="stom-card" id="stom-card-${item.rowId}">
      <div class="stom-name">${escapeHTML(item.name)}</div>
      <div class="stom-fields">
        <div class="stom-field">
          <span class="stom-lbl">Hours in cut</span>
          <input class="stom-input" id="stom-hrs-${item.rowId}" type="number" min="0" step="0.25"
            value="${parseFloat(item.hours.toFixed(2))}"
            oninput="onSupportModalInput('${item.rowId}','hrs')">
          <span class="stom-sub">${parseFloat(item.hours.toFixed(2))} / ${parseFloat(cutHrs.toFixed(2))} hrs
            (${cutHrs > 0 ? (item.hours/cutHrs*100).toFixed(1) : 0}%)</span>
        </div>
        <div class="stom-field">
          <span class="stom-lbl">Rate %</span>
          <input class="stom-input" id="stom-pct-${item.rowId}" type="number" min="0" step="1"
            value="${item.pct}"
            oninput="onSupportModalInput('${item.rowId}','pct')">
          <span class="stom-sub">$${ratePerHr.toFixed(2)}/hr × ${item.pct}%</span>
        </div>
        <div class="stom-field stom-field--tip">
          <span class="stom-lbl">Tip out</span>
          <input class="stom-input stom-input--tip" id="stom-tip-${item.rowId}" type="number" min="0" step="1"
            value="${item.tipOut}"
            oninput="onSupportModalInput('${item.rowId}','tip')">
          <span class="stom-sub">floor(hrs × rate × %)</span>
        </div>
      </div>
    </div>`).join('');

  $('supportModalBody').innerHTML = `
    <div class="stom-meta">
      <div class="stom-meta-row"><span class="stom-meta-lbl">Window</span><span class="stom-meta-val">${escapeHTML(winStr)}</span></div>
      <div class="stom-meta-row"><span class="stom-meta-lbl">Cut tips</span><span class="stom-meta-val">$${rawCash}</span></div>
      <div class="stom-meta-row"><span class="stom-meta-lbl">Tips/hr</span><span class="stom-meta-val">$${ratePerHr.toFixed(2)}</span></div>
    </div>
    <div class="stom-note">Each field is interdependent — editing one recalculates the others.</div>
    ${cards}
    <div class="stom-totals">
      <div class="stom-total-row">
        <span class="stom-total-lbl">Total tip-out</span>
        <span class="stom-total-val" id="stom-total">$${totalTipOut}</span>
      </div>
      <div class="stom-total-row">
        <span class="stom-total-lbl">Remaining for pool</span>
        <span class="stom-total-val stom-adj" id="stom-adj">$${adjCash}</span>
      </div>
    </div>`;

  openModal('supportTipOutModal');
}

function onSupportModalInput(rowId, changedField) {
  const cutId = _tipOutModalCutId;
  if (!cutId) return;

  const result  = lastDayResult;
  if (!result) return;
  const tipOuts = result.supportTipOuts?.[cutId] || [];
  const item    = tipOuts.find(x => x.rowId === rowId);
  if (!item) return;

  const hrsEl = $('stom-hrs-' + rowId);
  const pctEl = $('stom-pct-' + rowId);
  const tipEl = $('stom-tip-' + rowId);

  let hours   = parseFloat(hrsEl?.value) || 0;
  let pct     = parseFloat(pctEl?.value) || 0;
  let tipOut  = parseFloat(tipEl?.value);
  const rate  = item.ratePerHr;

  if (changedField === 'hrs' || changedField === 'pct') {
    tipOut = Math.floor(hours * rate * pct / 100);
    if (tipEl) tipEl.value = tipOut;
  } else if (changedField === 'tip') {
    // Back-solve for pct given hours
    tipOut = Math.floor(tipOut);
    pct = (hours > 0 && rate > 0) ? parseFloat(((tipOut / (hours * rate)) * 100).toFixed(1)) : 0;
    if (pctEl) pctEl.value = pct;
  }

  // Save overrides and recalculate
  if (!supportTipOutOverrides[cutId]) supportTipOutOverrides[cutId] = {};
  supportTipOutOverrides[cutId][rowId] = { hours, pct };

  // Update totals display
  const rawCash = result.rawPoolCash?.[cutId] || 0;
  const allCards = document.querySelectorAll('.stom-card');
  let newTotal = 0;
  allCards.forEach(card => {
    const rid = card.id.replace('stom-card-', '');
    const t = parseInt($('stom-tip-' + rid)?.value) || 0;
    newTotal += t;
  });
  const totalEl = $('stom-total');
  const adjEl   = $('stom-adj');
  if (totalEl) totalEl.textContent = '$' + newTotal;
  if (adjEl)   adjEl.textContent   = '$' + Math.max(0, rawCash - newTotal);

  // Trigger a recalculation so summary updates live
  scheduleCalculate();
}

function _getCutWindowForModal(cutId) {
  if (!lastDayResult) return null;
  const pool  = lastDayResult.pools?.find(p => p.id === cutId);
  if (!pool) return null;
  return { start: pool.start, end: pool.end };
}

function _fmtAbsTime(t) {
  if (t === null || t === undefined) return '?';
  const isAm = t < 12;
  const hr   = Math.floor(t);
  const mn   = Math.round((t - hr) * 60);
  let h12    = hr % 12; if (h12 === 0) h12 = 12;
  const minStr = mn > 0 ? ':' + (mn < 10 ? '0' : '') + mn : '';
  return h12 + minStr + (isAm ? 'AM' : 'PM');
}
