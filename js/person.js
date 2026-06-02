function openPersonModal(rowId) {
  const person = lastStaff.find(p => p._rowId === String(rowId)); if (!person) return;
  const safe       = escapeHTML(person.n);
  const initials   = escapeHTML(person.n.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2));
  const inStr      = fmtTime(person.i, person.i, false);
  const outStr     = fmtTime(person.o, person.i, person.o < person.i);
  const hrsStr     = fmtHrs(person.h);
  const closerBadge = person.closer ? '<span class="closer-badge" style="margin-left:5px">closer</span>' : '';
  const dp          = (_lastDistStaff || []).find(p => p._rowId === String(rowId));
  const hasBills    = dp && DENOMS.some(d => (dp.bills[d] || 0) > 0);
  const billsHTML   = hasBills
    ? '<div class="profile-bills-row">' + DENOMS.map(d => {
        const n = dp.bills[d] || 0;
        return `<div class="profile-bill-chip"><span class="pbc2-denom">$${d}</span><span class="pbc2-count${n === 0 ? ' zero' : ''}">${n === 0 ? '—' : n}</span></div>`;
      }).join('') + '</div>'
    : `<div style="color:var(--muted);font-size:.75rem;font-family:var(--font-mono);padding:6px 0">No distribution calculated yet</div>`;

  $('personModalLabel').textContent = person.n;
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
          <input class="profile-time-input" id="pi-in-${rowId}" value="${person._autoCloser ? '' : escapeHTML(String(person.i))}" placeholder="${escapeHTML(String(person.i))}" inputmode="decimal" onchange="updatePersonFromModal('${escapeHTML(String(rowId))}')">
          <span class="profile-edit-sep">–</span>
          <span class="profile-edit-lbl">Out</span>
          <input class="profile-time-input" id="pi-out-${rowId}" value="${person._autoCloser ? '' : escapeHTML(String(person.o))}" placeholder="${person._autoCloser ? 'closer' : escapeHTML(String(person.o))}" inputmode="decimal" onchange="updatePersonFromModal('${escapeHTML(String(rowId))}')">
        </div>
      </div>
      <div class="profile-section">
        <div class="profile-section-lbl">Tips</div>
        <div class="profile-tips-grid">
          <div class="profile-tip-cell"><div class="profile-tip-cell-lbl">Base</div><div class="profile-tip-cell-val">$${person.base}</div></div>
          ${person.bonus > 0
            ? `<div class="profile-tip-cell bonus"><div class="profile-tip-cell-lbl">Closer Bonus</div><div class="profile-tip-cell-val">+$${person.bonus}</div></div>`
            : `<div class="profile-tip-cell"><div class="profile-tip-cell-lbl">Rate</div><div class="profile-tip-cell-val" style="font-size:.82rem">$${lastRate.toFixed(2)}/h</div></div>`}
          <div class="profile-tip-cell span2"><div class="profile-tip-cell-lbl">Total Payout</div><div class="profile-tip-cell-val">$${person.final}</div></div>
        </div>
      </div>
      <div class="profile-section"><div class="profile-section-lbl">Bill Distribution</div>${billsHTML}</div>
    </div>`;
  openModal('personModal');
}

function updatePersonFromModal(rowId) {
  const row = $('staff' + rowId); if (!row) return;
  const ni  = $('pi-in-'  + rowId);
  const no  = $('pi-out-' + rowId);
  if (ni) { const el = row.querySelector('[data-field="in"]');  if (el) { el.value = ni.value; el.classList.remove('using-default'); } }
  if (no) { const el = row.querySelector('[data-field="out"]'); if (el) { el.value = no.value; el.classList.remove('using-default'); } }
  calcHours(rowId); autoCalculate();
  setTimeout(() => { if ($('personModal').classList.contains('open')) openPersonModal(rowId); }, 120);
}
