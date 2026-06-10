// Remainder allocation panel — night shift only.
// Automatic mode keeps the original closer split. Manual mode stores rowId -> add-on dollars.

function getLastRemainderPool() {
  if (lastRemainderPool > 0) return lastRemainderPool;
  return (lastStaff || []).reduce((s, p) => s + (p.bonus || 0), 0) + (lastLeftover || 0);
}

function hasManualRemainderOverrides() {
  return !!(remainderOverrides && typeof remainderOverrides === 'object');
}

function getAutoRemainderAllocation(staff, remainderPool) {
  const bonuses = {};
  staff.forEach(p => { bonuses[p._rowId] = 0; });
  const closers = staff.filter(p => p.closer);
  const perCloser = closers.length ? Math.floor(remainderPool / closers.length) : 0;
  closers.forEach(p => { bonuses[p._rowId] = perCloser; });
  return {
    bonuses,
    leftover: remainderPool - perCloser * closers.length,
  };
}

function sanitizeRemainderOverrides(staff, remainderPool) {
  if (!hasManualRemainderOverrides()) return null;

  const rowIds = staff.map(p => String(p._rowId));
  const clean = {};
  let allocated = 0;

  rowIds.forEach(rowId => {
    const raw = Number(remainderOverrides[rowId] || 0);
    const val = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
    clean[rowId] = val;
    allocated += val;
  });

  // If cash/staff changes made the previous allocation too large, trim from the bottom rows.
  for (let i = rowIds.length - 1; allocated > remainderPool && i >= 0; i--) {
    const rowId = rowIds[i];
    const cut = Math.min(clean[rowId], allocated - remainderPool);
    clean[rowId] -= cut;
    allocated -= cut;
  }

  remainderOverrides = clean;
  return clean;
}

function applyRemainderAllocation(staff, remainderPool) {
  const allocation = hasManualRemainderOverrides()
    ? { bonuses: sanitizeRemainderOverrides(staff, remainderPool) || {}, manual: true }
    : { ...getAutoRemainderAllocation(staff, remainderPool), manual: false };

  let allocated = 0;
  staff.forEach(p => {
    p.bonus = allocation.bonuses[p._rowId] || 0;
    allocated += p.bonus;
  });

  return {
    remainderPool,
    leftover: Math.max(0, remainderPool - allocated),
    manual: allocation.manual,
  };
}

function seedManualRemainderOverrides() {
  if (!lastStaff || !lastStaff.length) return false;
  if (!hasManualRemainderOverrides()) {
    remainderOverrides = {};
    lastStaff.forEach(p => { remainderOverrides[p._rowId] = p.bonus || 0; });
  }
  return true;
}

function adjustRemainderBonus(rowId, delta) {
  if (!seedManualRemainderOverrides()) return;

  const key = String(rowId);
  const pool = getLastRemainderPool();
  const allocated = Object.values(remainderOverrides).reduce((s, v) => s + (Number(v) || 0), 0);
  const current = Number(remainderOverrides[key] || 0);

  if (delta > 0 && allocated >= pool) return;
  remainderOverrides[key] = Math.max(0, current + delta);

  autoCalculate();
  requestAnimationFrame(renderRemainderSidebar);
}

function resetRemainderAllocation() {
  remainderOverrides = null;
  autoCalculate();
  requestAnimationFrame(renderRemainderSidebar);
}

function openRemainderSidebar() {
  if (shiftMode !== 'night' || !lastStaff || !lastStaff.length || !lastTotal) return;
  renderRemainderSidebar();
  openModal('remainderSidebar');
}

function closeRemainderSidebar() {
  closeModal('remainderSidebar');
}

function renderRemainderSidebar() {
  const body = $('remainder-body');
  if (!body) return;

  if (shiftMode !== 'night' || !lastStaff || !lastStaff.length || !lastTotal) {
    body.innerHTML = '<div class="rem-empty">Enter night-shift cash and staff to see closer bonus / Chump allocation.</div>';
    return;
  }

  const pool = getLastRemainderPool();
  const allocated = lastStaff.reduce((s, p) => s + (p.bonus || 0), 0);
  const remaining = Math.max(0, pool - allocated);
  const manual = hasManualRemainderOverrides();
  const remBillsValue = poolValue(lastRemainderBills || {});
  const canAdd = remaining > 0;

  const rows = lastStaff.map(p => {
    const raw = Number.isFinite(p.exact) ? p.exact.toFixed(2) : '0.00';
    const add = p.bonus || 0;
    const closer = p.closer ? '<span class="rem-closer">closer</span>' : '';
    const minusDisabled = add <= 0 ? ' disabled' : '';
    const plusDisabled = !canAdd ? ' disabled' : '';
    return `<div class="rem-row">
      <div class="rem-person">
        <span class="rem-name">${escapeHTML(p.n)}</span>
        ${closer}
      </div>
      <div class="rem-num rem-raw"><span>Raw</span><strong>$${raw}</strong></div>
      <div class="rem-num rem-floor"><span>Floor</span><strong>$${p.base}</strong></div>
      <div class="rem-stepper" aria-label="Adjust ${escapeHTML(p.n)} remainder add-on">
        <button onclick="adjustRemainderBonus('${escapeHTML(p._rowId)}', -1)"${minusDisabled}>&minus;</button>
        <strong>+$${add}</strong>
        <button onclick="adjustRemainderBonus('${escapeHTML(p._rowId)}', 1)"${plusDisabled}>+</button>
      </div>
      <div class="rem-final"><span>Amt</span><strong>$${p.final}</strong></div>
    </div>`;
  }).join('');

  const remBills = remBillsValue > 0
    ? '<div class="rem-bills">'
      + DENOMS.map(d => {
          const n = lastRemainderBills?.[d] || 0;
          return `<span class="${n ? '' : 'zero'}">$${d} ${n || '—'}</span>`;
        }).join('')
      + '</div>'
    : '<div class="rem-bills rem-bills-empty">No remainder bills left in drawer.</div>';

  body.innerHTML = `
    <div class="rem-summary">
      <div><span>Raw remainder</span><strong>$${pool}</strong></div>
      <div><span>Applied</span><strong>$${allocated}</strong></div>
      <div><span>Chump</span><strong>$${remaining}</strong></div>
    </div>
    <div class="rem-mode-row">
      <span>${manual ? 'Manual add-ons are active.' : 'Auto split is using closer badges.'}</span>
      <button onclick="resetRemainderAllocation()"${manual ? '' : ' disabled'}>Reset Auto</button>
    </div>
    <div class="rem-head">
      <span>Person</span><span>Before floor</span><span>Floored</span><span>Add</span><span>Amount</span>
    </div>
    <div class="rem-rows">${rows}</div>
    <div class="rem-bills-title">Chump bills in drawer</div>
    ${remBills}
  `;
}
