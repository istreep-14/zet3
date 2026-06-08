function _isVisibleForFocus(el) {
  return !!(el && el.offsetParent !== null);
}

function _focusFirstEmpty(selector) {
  const inputs = document.querySelectorAll(selector);
  for (const inp of inputs) {
    if (_isVisibleForFocus(inp) && !inp.value.trim()) {
      inp.focus();
      return true;
    }
  }
  return false;
}

function _focusCashEntry() {
  if (shiftMode === 'day') {
    const activePoolId = (typeof selectedDayPool !== 'undefined' && selectedDayPool)
      ? selectedDayPool
      : (typeof getDayPoolActiveIds === 'function' ? getDayPoolActiveIds()[0] : 'morning');
    const activeInput = $('dp-net-' + activePoolId);
    if (_isVisibleForFocus(activeInput)) {
      activeInput.focus();
      return;
    }
    _focusFirstEmpty('#day-cash-section input');
    return;
  }

  if (cashMode === 'nettotal') {
    const netInput = $('net-total-input');
    if (_isVisibleForFocus(netInput)) netInput.focus();
    return;
  }

  const billIds = ['b100', 'b50', 'b20', 'b10', 'b5', 'b1'];
  for (const id of billIds) {
    const el = $(id);
    if (_isVisibleForFocus(el) && !el.value) {
      el.focus();
      return;
    }
  }
}

function switchTab(name, btn) {
  const panel = $('tab-' + name);
  if (!panel) return;

  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-selected', 'false');
  });
  panel.classList.add('active');

  const tabBtn = btn || $('tb-' + name);
  if (tabBtn) {
    tabBtn.classList.add('active');
    tabBtn.setAttribute('aria-selected', 'true');
  }

  requestAnimationFrame(() => { $('mainContent').scrollTop = 0; });

  // Focus synchronously — still inside the click/key gesture chain (iOS Safari requires this).
  if (name === 'staff') {
    const listId = (typeof getActiveListId === 'function') ? getActiveListId() : 'staffList';
    _focusFirstEmpty('#' + listId + ' [data-field="name"]');
  }
  if (name === 'cash') _focusCashEntry();
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
  const staffSelector = shiftMode === 'day'
    ? '#bartenderList .staff-row-modal, #serverList .staff-row-modal'
    : '#staffList .staff-row-modal';
  const rows = document.querySelectorAll(staffSelector);
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
