// Bootstrap — runs after all other scripts are loaded
const _today = new Date();
const yyyy = _today.getFullYear();
const mm = String(_today.getMonth() + 1).padStart(2, '0');
const dd = String(_today.getDate()).padStart(2, '0');
$('tipDate').value = yyyy + '-' + mm + '-' + dd;

const _saved = loadState();

function _savedBillSnap(snap) {
  const out = { 100: '', 50: '', 20: '', 10: '', 5: '', 1: '' };
  DENOMS.forEach(d => { out[d] = snap?.[d] ?? ''; });
  return out;
}

isRestoringState = true;
if (_saved) {
  if (_saved.date)     $('tipDate').value             = _saved.date;
  if (_saved.gcIn)     $('gc-in').value               = _saved.gcIn;
  if (_saved.gcOut)    $('gc-out').value              = _saved.gcOut;
  if (_saved.netTotal) $('net-total-input').value     = _saved.netTotal;
  netTotalSnapshot = _saved.netTotal ?? '';
  perBillSnapshot = _savedBillSnap(_saved.perBillBills ?? (_saved.cashMode === 'perbill' ? _saved.bills : {}));
  netBillSnapshot = _savedBillSnap(_saved.netBillBills ?? (_saved.cashMode === 'nettotal' ? _saved.bills : {}));

  const rows = (_saved.staff?.length >= 1) ? _saved.staff : [{}, {}, {}];
  rows.forEach((s, i) => {
    addStaff();
    const row = document.querySelectorAll('#staffList .staff-row-modal')[i];
    if (!row) return;
    row.querySelector('[data-field="name"]').value = s.name ?? '';
    row.querySelector('[data-field="in"]').value   = s.in   ?? '';
    row.querySelector('[data-field="out"]').value  = s.out  ?? '';
    if (s.closer) row.querySelector('.sri-closer')?.classList.add('on');
    calcHours(row.id.replace('staff', ''));
  });
  cashMode = _saved.cashMode || 'perbill';
  setCashMode(cashMode);
} else {
  addStaff(); addStaff(); addStaff();
}
isRestoringState = false;

// FIX: 'change' alone can fire late or not at all on some iOS Safari date
// pickers — the picker closes before 'change' fires, and if the user then
// reloads without touching another field the new date is lost.
// Adding 'input' as a belt-and-suspenders fallback saves on every selection.
$('tipDate').addEventListener('change', saveState);
$('tipDate').addEventListener('input',  saveState);

reindexTabOrder();
updateStockCards();
updateTabIndicators();
autoCalculate();

// Pulse-hint the first empty staff name field instead of forcing focus
const _firstEmpty = document.querySelector('#staffList [data-field="name"]');
if (_firstEmpty && !_firstEmpty.value.trim()) {
  const _row = _firstEmpty.closest('.staff-row-modal');
  if (_row) {
    _row.classList.add('pulse-hint');
    setTimeout(() => _row.classList.remove('pulse-hint'), 1600);
  }
}

// Keep the tab bar above the software keyboard on iOS
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => {
    const bar = document.querySelector('.tab-bar');
    if (!bar) return;
    const offset = window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop;
    bar.style.transform = offset > 0 ? 'translateY(-' + offset + 'px)' : '';
  });
}
