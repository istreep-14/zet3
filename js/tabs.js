function switchTab(name, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  $('tab-' + name).classList.add('active');
  if (btn) btn.classList.add('active');
  requestAnimationFrame(() => { $('mainContent').scrollTop = 0; });

  // Focus synchronously — still inside the click gesture chain (iOS Safari requires this)
  if (name === 'staff') {
    const inputs = document.querySelectorAll('#staffList [data-field="name"]');
    for (const inp of inputs) { if (!inp.value.trim()) { inp.focus(); break; } }
  }
  if (name === 'cash') {
    const billIds = ['b100', 'b50', 'b20', 'b10', 'b5', 'b1'];
    for (const id of billIds) { const el = $(id); if (el && !el.value) { el.focus(); break; } }
  }
}

function updateTabIndicators() {
  const total = getTotal();
  const cd = $('tab-dot-cash'), cs = $('tab-sub-cash');
  if (total > 0) {
    cd.className = 'tab-dot ok';
    cs.textContent = '$' + total;
    cs.className = 'tab-sub has-val';
  } else {
    cd.className = 'tab-dot empty';
    cs.textContent = '—';
    cs.className = 'tab-sub';
  }
  const rows = document.querySelectorAll('#staffList .staff-row-modal');
  let named = 0;
  rows.forEach(r => { if (r.querySelector('[data-field="name"]').value.trim()) named++; });
  const sd = $('tab-dot-staff'), ss = $('tab-sub-staff');
  if (named > 0) {
    sd.className = 'tab-dot ok';
    ss.textContent = named + (named === 1 ? ' person' : ' ppl');
    ss.className = 'tab-sub has-staff';
  } else {
    sd.className = 'tab-dot empty';
    ss.textContent = '—';
    ss.className = 'tab-sub';
  }
}
