// Remembered staff names — survives New Session (separate from tippool_v1 session state).

const ROSTER_KEY = 'tippool_roster_v1';

function loadRosterNames() {
  try {
    const raw = localStorage.getItem(ROSTER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (parsed.version !== 1 || !Array.isArray(parsed.names)) return [];
    return parsed.names.filter(Boolean);
  } catch {
    return [];
  }
}

function rememberRosterNamesFromDOM() {
  const names = new Set(loadRosterNames());
  document.querySelectorAll('#staffList [data-field="name"], #nightServerList [data-field="name"]').forEach(el => {
    const name = el.value.trim();
    if (name) names.add(name);
  });
  localStorage.setItem(ROSTER_KEY, JSON.stringify({ version: 1, names: [...names].sort() }));
}

function renderRosterChips() {
  const wrap = $('roster-chips');
  if (!wrap) return;

  const active = new Set();
  document.querySelectorAll('#staffList [data-field="name"], #nightServerList [data-field="name"]').forEach(el => {
    const name = el.value.trim();
    if (name) active.add(name);
  });

  const available = loadRosterNames().filter(name => !active.has(name));
  if (!available.length) {
    wrap.innerHTML = '';
    wrap.classList.add('hidden');
    return;
  }

  wrap.classList.remove('hidden');
  wrap.innerHTML = available.map(name =>
    `<button type="button" class="roster-chip" data-roster-name="${escapeHTML(name)}" onclick="addRosterNameFromChip(this)">${escapeHTML(name)}</button>`
  ).join('');
}

function addRosterNameFromChip(btn) {
  addRosterNameToSession(btn.dataset.rosterName || '');
}

function addRosterNameToSession(name) {
  const listId = (typeof getActiveListId === 'function') ? getActiveListId() : 'staffList';
  if (listId === 'supportList') return;

  const rows = [...document.querySelectorAll('#' + listId + ' .staff-row-modal')];
  let target = rows.find(r => !r.querySelector('[data-field="name"]').value.trim());
  if (!target) {
    addStaff(false, listId);
    const nextRows = document.querySelectorAll('#' + listId + ' .staff-row-modal');
    target = nextRows[nextRows.length - 1];
  }
  if (!target) return;

  target.querySelector('[data-field="name"]').value = name;
  onStaffNameInput();
  renderRosterChips();
  autoCalculate();
}
