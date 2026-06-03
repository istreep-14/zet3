// Bootstrap — runs after all other scripts are loaded
const _today = new Date();
const yyyy = _today.getFullYear();
const mm   = String(_today.getMonth() + 1).padStart(2, '0');
const dd   = String(_today.getDate()).padStart(2, '0');
$('tipDate').value = yyyy + '-' + mm + '-' + dd;

const _saved = loadState();

function _savedBillSnap(snap) {
  const out = { 100: '', 50: '', 20: '', 10: '', 5: '', 1: '' };
  DENOMS.forEach(d => { out[d] = snap?.[d] ?? ''; });
  return out;
}

isRestoringState = true;

if (_saved) {
  // ── Shared fields ──
  if (_saved.date)  $('tipDate').value = _saved.date;
  if (_saved.gcIn)  $('gc-in').value   = _saved.gcIn;
  if (_saved.gcOut) $('gc-out').value  = _saved.gcOut;

  // ── Shift mode ──
  const savedShift = _saved.shiftMode || 'night';
  shiftMode = savedShift;

  const btnNight = $('shift-btn-night');
  const btnDay   = $('shift-btn-day');
  if (btnNight) btnNight.classList.toggle('active', savedShift === 'night');
  if (btnDay)   btnDay.classList.toggle('active',   savedShift === 'day');

  const shiftLabel = $('shift-mode-label');
  if (shiftLabel) shiftLabel.textContent = savedShift === 'night' ? 'Night Shift' : 'Day Shift';

  const nightCash  = $('night-cash-section');
  const dayCash    = $('day-cash-section');
  const nightStaff = $('night-staff-section');
  const dayStaff   = $('day-staff-section');
  if (nightCash)  nightCash.style.display  = savedShift === 'night' ? '' : 'none';
  if (dayCash)    dayCash.style.display    = savedShift === 'day'   ? '' : 'none';
  if (nightStaff) nightStaff.style.display = savedShift === 'night' ? '' : 'none';
  if (dayStaff)   dayStaff.style.display   = savedShift === 'day'   ? '' : 'none';

  // ── Night shift cash ──
  if (_saved.netTotal) $('net-total-input').value = _saved.netTotal;
  netTotalSnapshot = _saved.netTotal ?? '';
  perBillSnapshot  = _savedBillSnap(_saved.perBillBills ?? (_saved.cashMode === 'perbill'  ? _saved.bills : {}));
  netBillSnapshot  = _savedBillSnap(_saved.netBillBills ?? (_saved.cashMode === 'nettotal' ? _saved.bills : {}));

  // ── Bartenders ──
  // Night shift: staffList. Day shift: bartenderList. Both use the same saved 'staff' array.
  const bartListId = savedShift === 'day' ? 'bartenderList' : 'staffList';
  const bartRows = (_saved.staff?.length >= 1)
    ? _saved.staff
    : (savedShift === 'night' ? [{}, {}, {}] : [{}]);

  bartRows.forEach((s, i) => {
    addStaff(false, bartListId);
    const row = document.querySelectorAll('#' + bartListId + ' .staff-row-modal')[i];
    if (!row) return;
    row.querySelector('[data-field="name"]').value = s.name ?? '';
    row.querySelector('[data-field="in"]').value   = s.in   ?? '';
    row.querySelector('[data-field="out"]').value  = s.out  ?? '';
    if (s.closer) row.querySelector('.sri-closer')?.classList.add('on');
    calcHours(row.id.replace('staff', ''));
  });

  // ── Servers (day shift only) ──
  if (savedShift === 'day' && _saved.servers?.length) {
    _saved.servers.forEach((s, i) => {
      addStaff(false, 'serverList');
      const row = document.querySelectorAll('#serverList .staff-row-modal')[i];
      if (!row) return;
      row.querySelector('[data-field="name"]').value = s.name ?? '';
      row.querySelector('[data-field="in"]').value   = s.in   ?? '';
      row.querySelector('[data-field="out"]').value  = s.out  ?? '';
      if (s.closer) row.querySelector('.sri-closer')?.classList.add('on');
      calcHours(row.id.replace('staff', ''));
    });
  } else if (savedShift === 'day') {
    addStaff(false, 'serverList');
  }

  // ── Day shift pool cash ──
  if (_saved.dayPools) {
    ['morning', 'middle', 'party1', 'party2'].forEach(pid => {
      const saved = _saved.dayPools[pid];
      if (!saved) return;
      const pool = dayPools[pid];
      pool.cashMode         = saved.cashMode         || 'perbill';
      pool.netTotalSnapshot = saved.netTotalSnapshot || '';
      pool.perBillSnapshot  = _savedBillSnap(saved.perBillSnapshot);
      pool.netBillSnapshot  = _savedBillSnap(saved.netBillSnapshot);
      if (pid === 'party1' || pid === 'party2') {
        pool.enabled     = !!saved.enabled;
        pool.windowStart = saved.windowStart || '';
        pool.windowEnd   = saved.windowEnd   || '';
      }
    });
  }

  // Night shift cash mode
  cashMode = _saved.cashMode || 'perbill';
  if (savedShift === 'night') setCashMode(cashMode);

  // Render day cash panels after state is set
  if (savedShift === 'day') {
    renderDayPoolCashPanels();
    ['morning', 'middle', 'party1', 'party2'].forEach(pid => {
      const pool = dayPools[pid];
      if (!pool.enabled && (pid === 'party1' || pid === 'party2')) return;
      if (pool.cashMode === 'nettotal') {
        const el = $('dp-net-' + pid);
        if (el) { el.value = pool.netTotalSnapshot || ''; onDayPoolNetTotalChange(pid); }
      } else {
        DENOMS.forEach(d => {
          const el = $('dp-b' + d + '-' + pid);
          if (el) el.value = pool.perBillSnapshot?.[d] ?? '';
        });
        onDayPoolBillsChange(pid);
      }
    });
  }

} else {
  // Fresh session defaults
  addStaff(false, 'staffList');
  addStaff(false, 'staffList');
  addStaff(false, 'staffList');
  if (shiftMode === 'day') {
    addStaff(false, 'serverList');
    renderDayPoolCashPanels();
  } else {
    setCashMode('perbill');
  }
}

isRestoringState = false;

// Date change listeners
$('tipDate').addEventListener('change', saveState);
$('tipDate').addEventListener('input',  saveState);

reindexTabOrder();
updateSectionCounts();

if (shiftMode === 'day') {
  updateDayStockCards();
} else {
  updateStockCards();
}
updateTabIndicators();
autoCalculate();

// Pulse-hint first empty staff name field (night mode only — day mode has bartenderList)
const _firstEmptySelector = shiftMode === 'day'
  ? '#bartenderList [data-field="name"]'
  : '#staffList [data-field="name"]';
const _firstEmpty = document.querySelector(_firstEmptySelector);
if (_firstEmpty && !_firstEmpty.value.trim()) {
  const _row = _firstEmpty.closest('.staff-row-modal');
  if (_row) {
    _row.classList.add('pulse-hint');
    setTimeout(() => _row.classList.remove('pulse-hint'), 1600);
  }
}

// Hide tab bar when software keyboard is open so it doesn't block inputs.
// Uses a body class; CSS handles both the bar and content padding.
if (window.visualViewport) {
  const KEYBOARD_THRESHOLD = 120; // px shrinkage below which we ignore (URL bar etc)
  const updateKeyboardState = () => {
    const shrink = window.screen.height - window.visualViewport.height;
    document.body.classList.toggle('keyboard-open', shrink > KEYBOARD_THRESHOLD);
  };
  window.visualViewport.addEventListener('resize', updateKeyboardState);
  window.visualViewport.addEventListener('scroll', updateKeyboardState);
}
