const STORAGE_KEY = 'tippool_v1';

function saveState() {
  if (isRestoringState) return;
  if (typeof snapshotCurrentCashMode === 'function') snapshotCurrentCashMode();

  const serializeList = selector =>
    [...document.querySelectorAll(selector)].map(r => {
      const rowId = r.id.replace('staff', '');
      const ctEl  = document.getElementById('ct' + rowId);
      return {
        name:   r.querySelector('[data-field="name"]').value,
        in:     r.querySelector('[data-field="in"]').value,
        out:    r.querySelector('[data-field="out"]').value,
        closer: ctEl ? ctEl.classList.contains('on') : false,
      };
    });

  const bartenderSelector = shiftMode === 'day'
    ? '#bartenderList .staff-row-modal'
    : '#staffList .staff-row-modal';

  const staff   = serializeList(bartenderSelector);
  const servers = serializeList('#serverList .staff-row-modal');

  // Snapshot current day pool cash states
  const dayPoolSnap = {};
  ['morning', 'middle', 'party1', 'party2'].forEach(pid => {
    const p = dayPools[pid];
    if (!p) return;
    const snap = {
      cashMode:         p.cashMode,
      netTotalSnapshot: p.netTotalSnapshot || '',
      perBillSnapshot:  { ...p.perBillSnapshot },
      netBillSnapshot:  { ...p.netBillSnapshot },
    };
    if (pid === 'party1' || pid === 'party2') {
      snap.enabled     = p.enabled;
      snap.windowStart = p.windowStart || '';
      snap.windowEnd   = p.windowEnd   || '';
    }
    if (p.cashMode === 'nettotal') {
      const el = $('dp-net-' + pid);
      if (el) snap.netTotalSnapshot = el.value || '';
    } else {
      DENOMS.forEach(d => {
        const el = $('dp-b' + d + '-' + pid);
        if (el) snap.perBillSnapshot[d] = el.value || '';
      });
    }
    dayPoolSnap[pid] = snap;
  });

  const snap = {
    v:        2,
    saved:    Date.now(),
    date:     $('tipDate')?.value       ?? '',
    gcIn:     $('gc-in')?.value         ?? '',
    gcOut:    $('gc-out')?.value        ?? '',
    shiftMode,
    cashMode,
    bills:        (typeof readBillInputSnapshot === 'function') ? readBillInputSnapshot() : {},
    perBillBills: perBillSnapshot,
    netBillBills: netBillSnapshot,
    netTotal:     $('net-total-input')?.value ?? '',
    staff,
    servers,
    dayPools: dayPoolSnap,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
  } catch (e) {
    console.warn('TipPool: localStorage unavailable', e);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw);
    validateSessionSnapshot(snap);
    return snap;
  } catch {
    return null;
  }
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function validateBillSnapshot(value, label) {
  if (value == null) return;
  if (!isPlainObject(value)) throw new Error(label + ' must be an object');
  DENOMS.forEach(d => {
    const billValue = value[d];
    if (billValue == null) return;
    if (typeof billValue !== 'string' && typeof billValue !== 'number') {
      throw new Error(label + ' contains invalid bill values');
    }
    if (!parseWholeNumberString(billValue).valid) {
      throw new Error(label + ' contains non-whole bill counts');
    }
  });
}

function validateSessionSnapshot(snap) {
  if (!isPlainObject(snap)) throw new Error('Not a valid TipPool file');
  if (snap.v !== 1 && snap.v !== 2) throw new Error('Incompatible file version');
  ['date', 'gcIn', 'gcOut', 'cashMode', 'netTotal'].forEach(key => {
    if (snap[key] != null && typeof snap[key] !== 'string') throw new Error(key + ' must be a string');
  });
  if (snap.cashMode && snap.cashMode !== 'perbill' && snap.cashMode !== 'nettotal') {
    throw new Error('cashMode is invalid');
  }
  if (snap.shiftMode && snap.shiftMode !== 'night' && snap.shiftMode !== 'day') {
    throw new Error('shiftMode is invalid');
  }
  validateBillSnapshot(snap.bills, 'bills');
  validateBillSnapshot(snap.perBillBills, 'perBillBills');
  validateBillSnapshot(snap.netBillBills, 'netBillBills');
  if (snap.staff != null) {
    if (!Array.isArray(snap.staff)) throw new Error('staff must be an array');
    snap.staff.forEach(person => {
      if (!isPlainObject(person)) throw new Error('staff entries must be objects');
      ['name', 'in', 'out'].forEach(key => {
        if (person[key] != null && typeof person[key] !== 'string') throw new Error('staff ' + key + ' must be a string');
      });
      if (person.closer != null && typeof person.closer !== 'boolean') throw new Error('staff closer must be a boolean');
    });
  }
  if (snap.servers != null) {
    if (!Array.isArray(snap.servers)) throw new Error('servers must be an array');
    snap.servers.forEach(person => {
      if (!isPlainObject(person)) throw new Error('server entries must be objects');
    });
  }
}

function exportSession() {
  saveState();
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) { alert('Nothing to export yet.'); return; }
  const date     = $('tipDate')?.value ?? 'session';
  const filename = 'tippool-' + date + '.json';
  const blob = new Blob([data], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

function importSession(file) {
  if (!file) return;
  const reader = new FileReader();
  const input  = $('importFileInput');
  const resetInput = () => { if (input) input.value = ''; };
  reader.onload = e => {
    try {
      const parsed = JSON.parse(e.target.result);
      validateSessionSnapshot(parsed);
      localStorage.setItem(STORAGE_KEY, e.target.result);
      resetInput();
      location.reload();
    } catch (err) {
      alert('Import failed: ' + err.message);
      resetInput();
    }
  };
  reader.onerror = () => { alert('Could not read file.'); resetInput(); };
  reader.readAsText(file);
}

function clearSession() {
  if (!confirm('Start a new session? This will clear all current data.')) return;
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}

function triggerImport() {
  const input = $('importFileInput');
  if (input) input.value = '';
  $('importFileInput').click();
}

function toggleSessionMenu() {
  const menu = $('sessionMenu');
  if (menu) menu.classList.toggle('hidden');
}

document.addEventListener('click', e => {
  const menu = $('sessionMenu');
  if (!menu || menu.classList.contains('hidden')) return;
  if (!menu.contains(e.target) && e.target.id !== 'sessionMenuBtn') {
    menu.classList.add('hidden');
  }
});
