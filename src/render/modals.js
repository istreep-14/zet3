// Modal helpers + Person profile, Remainder split, and Default Times modals.

import { DENOMS, escapeHTML, fmtHrs } from '../util.js';
import { fmtTimeAbs } from '../time.js';
import { setBonuses, clearBonuses } from '../store.js';

const $ = id => document.getElementById(id);

export function openModal(id) {
  $(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}

export function closeModal(id) {
  $(id).classList.remove('open');
  document.body.style.overflow = '';
  if (id === 'personModal') openPersonId = null;
}

export function modalBgClose(e, id) {
  if (e.target === $(id)) closeModal(id);
}

// ── Person profile modal ──────────────────────────────────────────────────────

let openPersonId = null;

export function openPersonModal(vm, id) {
  openPersonId = id;
  openModal('personModal');
  renderPersonModal(vm);
}

export function renderPersonModal(vm) {
  if (!openPersonId || !$('personModal')?.classList.contains('open')) return;
  const person = vm.shares?.perPerson.find(p => p.id === openPersonId);
  if (!person) { closeModal('personModal'); return; }

  const raw = vm.state.staff.find(p => p.id === openPersonId);
  const anchor = vm.resolved.anchorRaw;
  const safe = escapeHTML(person.name);
  const initials = escapeHTML(person.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2));
  const inStr = fmtTimeAbs(person.inAbs, anchor);
  const outStr = fmtTimeAbs(person.outAbs, anchor);
  const hrsStr = fmtHrs(person.hours);
  const closerBadge = person.closer ? '<span class="closer-badge" style="margin-left:5px">closer</span>' : '';

  const bills = vm.dist?.byPerson[openPersonId];
  const hasBills = bills && DENOMS.some(d => (bills[d] || 0) > 0);
  const billsHTML = hasBills
    ? '<div class="profile-bills-row">' + DENOMS.map(d => {
        const c = bills[d] || 0;
        return `<div class="profile-bill-chip"><span class="pbc2-denom">$${d}</span><span class="pbc2-count${c === 0 ? ' zero' : ''}">${c === 0 ? '—' : c}</span></div>`;
      }).join('') + '</div>'
    : `<div style="color:var(--muted);font-size:.75rem;font-family:var(--font-mono);padding:6px 0">No distribution calculated yet</div>`;

  const rateCell = person.bonus > 0
    ? `<div class="profile-tip-cell bonus"><div class="profile-tip-cell-lbl">Bonus</div><div class="profile-tip-cell-val">+$${person.bonus}</div></div>`
    : `<div class="profile-tip-cell"><div class="profile-tip-cell-lbl">Rate</div><div class="profile-tip-cell-val" style="font-size:.82rem">$${(vm.shares.rate || 0).toFixed(2)}/h</div></div>`;

  $('personModalLabel').textContent = person.name;
  $('personModalBody').innerHTML = `
    <div class="person-profile-hdr">
      <div class="person-profile-avatar">${initials}</div>
      <div class="person-profile-name">${safe}${closerBadge}</div>
      <div class="person-profile-sub">${hrsStr}h · ${inStr}–${outStr}</div>
    </div>
    <div class="person-profile-body">
      <div class="profile-section">
        <div class="profile-section-lbl">Hours</div>
        <div class="profile-hours-block">
          <div class="profile-hrs-big">${escapeHTML(hrsStr)}h</div>
          <div class="profile-hours-detail"><div class="profile-in-out">${inStr} – ${outStr}</div><div class="profile-shift-lbl">Start – End</div></div>
        </div>
        <div class="profile-edit-row">
          <span class="profile-edit-lbl">In</span>
          <input class="profile-time-input" value="${escapeHTML(raw?.in ?? '')}" placeholder="${inStr}" inputmode="decimal"
            onchange="App.staffField('${person.id}','in',this.value)">
          <span class="profile-edit-sep">–</span>
          <span class="profile-edit-lbl">Out</span>
          <input class="profile-time-input" value="${escapeHTML(raw?.out ?? '')}" placeholder="${person.usedCloseTime ? 'closer' : outStr}" inputmode="decimal"
            onchange="App.staffField('${person.id}','out',this.value)">
        </div>
      </div>
      <div class="profile-section">
        <div class="profile-section-lbl">Tips</div>
        <div class="profile-tips-grid">
          <div class="profile-tip-cell"><div class="profile-tip-cell-lbl">Base</div><div class="profile-tip-cell-val">$${person.base}</div></div>
          ${rateCell}
          <div class="profile-tip-cell span2"><div class="profile-tip-cell-lbl">Total Payout</div><div class="profile-tip-cell-val">$${person.final}</div></div>
        </div>
      </div>
      <div class="profile-section"><div class="profile-section-lbl">Bill Distribution</div>${billsHTML}</div>
    </div>`;
}

// ── Remainder split modal ─────────────────────────────────────────────────────

export function openRemModal(vm) {
  openModal('remModal');
  renderRemModal(vm);
}

export function renderRemModal(vm) {
  const body = $('remModalBody');
  if (!body || !$('remModal')?.classList.contains('open')) return;

  if (!vm.shares || !vm.totalCash) {
    body.innerHTML = '<div class="rem-unavailable">Enter cash and staff to see the remainder breakdown.</div>';
    return;
  }

  const shares = vm.shares;
  const floored = shares.perPerson.reduce((s, p) => s + p.base, 0);
  const remainder = shares.totalCash - floored;
  const bonusSum = shares.perPerson.reduce((s, p) => s + p.bonus, 0);
  const leftover = remainder - bonusSum;
  const available = Math.max(0, leftover);
  const hasOverrides = shares.bonusMode === 'manual';

  const rows = shares.perPerson.map(p => {
    const canAdd = available > 0;
    const canSub = p.bonus > 0;
    const closerHtml = p.closer ? '<span class="rem-closer-badge">CLOSER</span>' : '';

    return `
      <div class="rem-row">
        <div class="rem-name-row">
          <span class="rem-name">${escapeHTML(p.name)}</span>
          ${closerHtml}
        </div>
        <div class="rem-val-row">
          <span class="rem-exact">$${p.exact.toFixed(2)}</span>
          <span class="rem-arrow">→</span>
          <span class="rem-base">$${p.base}</span>
          <div class="rem-bonus-ctrl">
            <button class="rem-btn rem-btn-sub" onclick="App.remBonus('${p.id}',-1)"${canSub ? '' : ' disabled'}>−</button>
            <span class="rem-bonus-val${p.bonus > 0 ? ' active' : ''}">${p.bonus > 0 ? '+$' + p.bonus : '—'}</span>
            <button class="rem-btn rem-btn-add" onclick="App.remBonus('${p.id}',1)"${canAdd ? '' : ' disabled'}>+</button>
          </div>
          <span class="rem-final${p.bonus > 0 ? ' boosted' : ''}">$${p.final}</span>
        </div>
      </div>`;
  }).join('');

  const modeBadge = hasOverrides
    ? '<span class="rem-mode-badge rem-mode-manual">MANUAL</span>'
    : '<span class="rem-mode-badge rem-mode-auto">AUTO · CLOSERS</span>';

  const resetBtn = hasOverrides
    ? '<button class="rem-reset-btn" onclick="App.resetRemBonuses()">↺ Reset to Auto (Closers)</button>'
    : '';

  body.innerHTML = `
    <div class="rem-top-strip">
      <span class="rem-pool-label">Pool&nbsp;<strong>$${shares.totalCash}</strong>&nbsp;·&nbsp;$${shares.rate.toFixed(2)}/hr</span>
      ${modeBadge}
    </div>
    <div class="rem-rows">${rows}</div>
    <div class="rem-summary">
      <div class="rem-sum-row">
        <span>Floored sum</span><span>$${floored}</span>
      </div>
      <div class="rem-sum-row rem-sum-remainder">
        <span>Raw remainder</span><span>$${remainder}</span>
      </div>
      <div class="rem-sum-row">
        <span>Distributed</span><span>${bonusSum > 0 ? '$' + bonusSum : '—'}</span>
      </div>
      <div class="rem-sum-row">
        <span>Chump</span>
        <span class="${leftover > 0 ? 'rem-leftover' : ''}">${leftover > 0 ? '$' + leftover : '—'}</span>
      </div>
    </div>
    ${resetBtn}`;
}

export function adjustRemBonus(vm, id, delta) {
  if (!vm.shares) return;
  const shares = vm.shares;
  const floored = shares.perPerson.reduce((s, p) => s + p.base, 0);
  const remainder = shares.totalCash - floored;

  // Seed overrides from the current bonuses on first edit so existing closer
  // bonuses aren't silently zeroed. Zeros are kept — any key present means
  // manual mode stays sticky until reset.
  const bonuses = {};
  shares.perPerson.forEach(p => { bonuses[p.id] = p.bonus || 0; });

  const proposed = (bonuses[id] || 0) + delta;
  if (proposed < 0) return;
  const otherSum = Object.entries(bonuses)
    .filter(([pid]) => pid !== id)
    .reduce((s, [, b]) => s + b, 0);
  if (proposed + otherSum > remainder) return;

  bonuses[id] = proposed;
  setBonuses(bonuses);
}

export function resetRemBonuses() {
  clearBonuses();
}

// ── Default Times modal ───────────────────────────────────────────────────────

export function renderDefaultsModal(vm) {
  const d = vm.state.defaults;
  const setIfBlurred = (id, value) => {
    const el = $(id);
    if (el && document.activeElement !== el) el.value = value;
  };
  setIfBlurred('gc-in', d.global.in);
  setIfBlurred('gc-out', d.global.out);
  const keys = { bartender: 'bar', server: 'srv', support: 'sup' };
  Object.entries(keys).forEach(([role, key]) => {
    setIfBlurred('rdef-modal-' + key + '-in', d.byRole[role].in);
    setIfBlurred('rdef-modal-' + key + '-out', d.byRole[role].out);
  });
}
