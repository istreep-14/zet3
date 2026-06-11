// Tab bar — panel switching and the cash/staff indicator dots.

const $ = id => document.getElementById(id);

export function switchTab(name) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  $('tab-' + name)?.classList.add('active');
  $('tb-' + name)?.classList.add('active');
  requestAnimationFrame(() => { $('mainContent').scrollTop = 0; });

  // Focus synchronously — still inside the click gesture chain (iOS Safari).
  if (name === 'staff') {
    const inputs = document.querySelectorAll('#staffList [data-field="name"]');
    for (const inp of inputs) { if (!inp.value.trim()) { inp.focus(); break; } }
  }
}

export function updateTabIndicators(vm) {
  const total = vm.totalCash;
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

  const named = vm.state.staff.filter(p => p.name.trim()).length;
  const sd = $('tab-dot-staff'), ss = $('tab-sub-staff');
  if (named > 0) {
    sd.className = 'tab-dot ' + (vm.inputError ? 'warn' : 'ok');
    ss.textContent = named + (named === 1 ? ' person' : ' ppl');
    ss.className = 'tab-sub has-staff';
  } else {
    sd.className = 'tab-dot empty';
    ss.textContent = '—';
    ss.className = 'tab-sub';
  }
}
