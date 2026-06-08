// ── Role helpers ──────────────────────────────────────────────────────────────

function getRoleForList(listId) {
  if (listId === 'supportList') return 'support';
  if (listId === 'nightServerList' || listId === 'serverList') return 'server';
  return 'bartender';
}

function getActiveListId() {
  if (staffViewRole === 'support') return 'supportList';
  if (shiftMode === 'day') {
    return staffViewRole === 'server' ? 'serverList' : 'bartenderList';
  }
  return staffViewRole === 'server' ? 'nightServerList' : 'staffList';
}

// ── Role toggle ───────────────────────────────────────────────────────────────

function switchStaffRole(role) {
  staffViewRole = role;
  document.querySelector('.role-toggle')?.classList.remove('open');

  // Update toggle buttons
  ['bartender', 'server', 'support'].forEach(r => {
    const btn = $('rb-' + r);
    if (btn) btn.classList.toggle('active', r === role);
  });

  _applyRoleVisibility();
  updateRoleDefaultsUI();
  updateRoleViewCount();
}

function onRoleButtonClick(role) {
  const toggle = document.querySelector('.role-toggle');
  if (role === staffViewRole && toggle && !toggle.classList.contains('open')) {
    toggle.classList.add('open');
    return;
  }
  switchStaffRole(role);
}

function _applyRoleVisibility() {
  const role  = staffViewRole;
  const isDay = shiftMode === 'day';
  const isSup = role === 'support';

  // Night shift wraps
  const nb = $('night-bar-wrap');
  const ns = $('night-srv-wrap');
  if (nb) nb.style.display = (!isDay && !isSup && role === 'bartender') ? '' : 'none';
  if (ns) ns.style.display = (!isDay && !isSup && role === 'server')    ? '' : 'none';

  // Day shift wraps
  const db = $('day-bar-wrap');
  const ds = $('day-srv-wrap');
  if (db) db.style.display = (isDay && !isSup && role === 'bartender') ? '' : 'none';
  if (ds) ds.style.display = (isDay && !isSup && role === 'server')    ? '' : 'none';

  // Support section (shared across both shifts)
  const sup = $('support-staff-section');
  if (sup) sup.style.display = isSup ? '' : 'none';

  // Re-render support cut chips if day mode
  if (isSup && shiftMode === 'day') refreshSupportCutChips();
}

// Called by setShiftMode after switching — keeps role filter consistent
function reapplyRoleVisibility() {
  _applyRoleVisibility();
  updateRoleViewCount();
}

// ── Per-role default times ────────────────────────────────────────────────────

function updateRoleDefaultsUI() {
  const d = roleDefaults[staffViewRole] || {};
  const i = $('rdef-in'),  o = $('rdef-out');
  if (i) i.value = d.in  || '';
  if (o) o.value = d.out || '';
  // Sync modal fields
  _syncModalRoleFields();
}

function _syncModalRoleFields() {
  const roles = { bartender: 'bar', server: 'srv', support: 'sup' };
  Object.entries(roles).forEach(([role, key]) => {
    const d = roleDefaults[role] || {};
    const mi = $('rdef-modal-' + key + '-in'),  mo = $('rdef-modal-' + key + '-out');
    if (mi) mi.value = d.in  || '';
    if (mo) mo.value = d.out || '';
  });
}

function onRoleDefaultChange(field) {
  const el = field === 'in' ? $('rdef-in') : $('rdef-out');
  if (!el) return;
  _setRoleDefault(staffViewRole, field, el.value.trim());
}

function onModalRoleDefaultChange(role, field) {
  const keyMap = { bartender: 'bar', server: 'srv', support: 'sup' };
  const el = $('rdef-modal-' + keyMap[role] + '-' + field);
  if (!el) return;
  _setRoleDefault(role, field, el.value.trim());
  // Keep inline fields in sync if viewing this role
  if (role === staffViewRole) updateRoleDefaultsUI();
}

function _setRoleDefault(role, field, val) {
  if (!roleDefaults[role]) return;
  roleDefaults[role][field] = val;
  // Re-render placeholders for rows in this role
  _refreshRolePlaceholders(role, field);
  // Recalculate hours for all rows in this role
  _recalcRoleHours(role);
  autoCalculate();
}

// After a time input, scan for the first explicit value in the role → auto-set role default
function _inferRoleDefault(listId, field) {
  const role = getRoleForList(listId);
  const rows = document.querySelectorAll('#' + listId + ' .staff-row-modal');
  let firstVal = '';
  rows.forEach(r => {
    if (firstVal) return;
    const el = r.querySelector('[data-field="' + field + '"]');
    if (el && el.value.trim()) firstVal = el.value.trim();
  });
  if (firstVal && firstVal !== roleDefaults[role][field]) {
    roleDefaults[role][field] = firstVal;
    // Sync the inline UI if this is the active role
    if (role === staffViewRole) updateRoleDefaultsUI();
    _syncModalRoleFields();
    _refreshRolePlaceholders(role, field);
    // Recalculate displayed hours for every blank row in this role now that the default changed
    _recalcRoleHours(role);
    // Update global gc-in/gc-out if all roles agree on one value (or role is the only one set)
    _syncGlobalFromRoles(field);
  }
}

function _syncGlobalFromRoles(field) {
  const gcId = field === 'in' ? 'gc-in' : 'gc-out';
  const gcEl = $(gcId);
  if (!gcEl) return;
  // If global is blank and there's a consensus or any role value, suggest it
  const vals = ['bartender', 'server']
    .map(r => roleDefaults[r][field])
    .filter(Boolean);
  if (!vals.length) return;
  // Only auto-set global if it's currently blank
  if (!gcEl.value.trim()) {
    const consensus = vals.every(v => v === vals[0]) ? vals[0] : '';
    if (consensus) { gcEl.value = consensus; onDefaultTimesChange(); }
  }
}

function _refreshRolePlaceholders(role, field) {
  const listIds = _listIdsForRole(role);
  const defaultVal = roleDefaults[role][field]
    || (field === 'in' ? ($('gc-in')?.value.trim() || '') : ($('gc-out')?.value.trim() || ''));

  listIds.forEach(lid => {
    document.querySelectorAll('#' + lid + ' .staff-row-modal').forEach(r => {
      const el = r.querySelector('[data-field="' + field + '"]');
      if (el && !el.value.trim()) {
        el.placeholder = defaultVal || (field === 'in' ? '—' : '—');
        el.classList.toggle('using-default', !!defaultVal);
      }
    });
  });
}

function _recalcRoleHours(role) {
  const listIds = _listIdsForRole(role);
  listIds.forEach(lid => {
    document.querySelectorAll('#' + lid + ' .staff-row-modal').forEach(r => {
      const id = r.id.replace('staff', '');
      calcHours(id);
    });
  });
}

function _listIdsForRole(role) {
  if (role === 'support') return ['supportList'];
  if (role === 'server')  return ['nightServerList', 'serverList'];
  return ['staffList', 'bartenderList'];
}

// ── Tab order & placeholders ──────────────────────────────────────────────────

function reindexTabOrder() {
  const reindex = (listId, offset) => {
    const rows = [...document.querySelectorAll('#' + listId + ' .staff-row-modal')];
    const n = rows.length;
    const role = getRoleForList(listId);
    const defIn  = roleDefaults[role]?.in  || $('gc-in')?.value.trim()  || '';
    const defOut = roleDefaults[role]?.out || $('gc-out')?.value.trim() || '';

    rows.forEach((r, i) => {
      const nameEl = r.querySelector('[data-field="name"]');
      const inEl   = r.querySelector('[data-field="in"]');
      const outEl  = r.querySelector('[data-field="out"]');
      if (nameEl) {
        nameEl.placeholder = 'Employee ' + (i + 1);
        nameEl.tabIndex = offset + i + 1;
      }
      if (inEl)  {
        inEl.tabIndex   = offset + n + i + 1;
        inEl.placeholder  = defIn  || '—';
      }
      if (outEl) {
        outEl.tabIndex  = offset + 2 * n + i + 1;
        outEl.placeholder = defOut || '—';
      }
    });
  };

  reindex('staffList',       0);
  reindex('nightServerList', 0);
  reindex('bartenderList',   0);
  reindex('serverList',      100);
  reindex('supportList',     200);
}

// ── Add staff row ─────────────────────────────────────────────────────────────

function addStaff(focusNew, listId) {
  const role = getRoleForList(listId);
  const isSupport = role === 'support';

  // Assign ID from the right counter
  let id;
  if (isSupport) {
    supportId++;
    id = supportId;
  } else if (listId === 'nightServerList' || listId === 'serverList') {
    serverStaffId++;
    id = serverStaffId;
  } else {
    staffId++;
    id = staffId;
  }

  const div = document.createElement('div');
  div.className = 'staff-row-modal' + (isSupport ? ' sup-row' : '');
  div.id = 'staff' + id;

  if (isSupport) {
    div.innerHTML = _supportRowHTML(id, listId);
  } else {
    div.innerHTML = _staffRowHTML(id, listId);
  }

  $(listId).appendChild(div);
  initStaffRowSwipe(div);
  reindexTabOrder();
  calcHours(id);
  updateSectionCounts();
  updateRoleViewCount();
  if (focusNew) setTimeout(() => div.querySelector('[data-field="name"]').focus(), 30);
  saveState();
}

function _staffRowHTML(id, listId) {
  return '<div class="sri-name">'
    + '<input data-field="name" oninput="onStaffNameInput()" autocomplete="off" autocorrect="off" autocapitalize="words">'
    + '<div class="sri-meta" id="meta' + id + '">Add times to calculate hours</div>'
    + '</div>'
    + '<div class="sri-time-field"><span class="sri-tlbl">in</span>'
    + '<input data-field="in" inputmode="decimal" oninput="onTimeInput(' + id + ',\'in\')" onchange="calcHours(' + id + ');autoCalculate()">'
    + '</div>'
    + '<div class="sri-time-field"><span class="sri-tlbl">out</span>'
    + '<input data-field="out" inputmode="decimal" oninput="onTimeInput(' + id + ',\'out\')" onchange="calcHours(' + id + ');autoCalculate()">'
    + '</div>'
    + '<div class="sri-hrs" id="hrs' + id + '">–</div>'
    + '<button class="sri-closer" id="ct' + id + '" onclick="toggleCloser(' + id + ')" title="Closer override" tabindex="-1"><span>c</span><span class="sc-lbl">close</span></button>'
    + '<button class="sri-del" onclick="delStaff(' + id + ',\'' + listId + '\')" tabindex="-1">Delete</button>';
}

function _supportRowHTML(id, listId) {
  // Cut chips are rendered dynamically when switching to day mode
  const cutsHTML = shiftMode === 'day'
    ? '<div class="sup-cuts" id="sup-cuts-' + id + '">' + _supportCutChipsHTML(String(id)) + '</div>'
    : '<div class="sup-cuts sup-cuts--hidden" id="sup-cuts-' + id + '"></div>';
  return '<div class="sri-name">'
    + '<input data-field="name" oninput="onStaffNameInput()" autocomplete="off" autocorrect="off" autocapitalize="words">'
    + '<div class="sri-meta" id="meta' + id + '">Add times to calculate hours</div>'
    + '</div>'
    + '<div class="sri-time-field"><span class="sri-tlbl">in</span>'
    + '<input data-field="in" inputmode="decimal" oninput="onTimeInput(' + id + ',\'in\')" onchange="calcHours(' + id + ');autoCalculate()">'
    + '</div>'
    + '<div class="sri-time-field"><span class="sri-tlbl">out</span>'
    + '<input data-field="out" inputmode="decimal" oninput="onTimeInput(' + id + ',\'out\')" onchange="calcHours(' + id + ');autoCalculate()">'
    + '</div>'
    + '<div class="sri-hrs" id="hrs' + id + '">–</div>'
    + cutsHTML
    + '<button class="sri-del" onclick="delStaff(' + id + ',\'supportList\')" tabindex="-1">Delete</button>';
}

function initStaffRowSwipe(row) {
  if (!row || row.dataset.swipeReady) return;
  row.dataset.swipeReady = '1';
  let startX = 0;
  let startY = 0;
  row.addEventListener('touchstart', e => {
    const t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
  }, { passive: true });
  row.addEventListener('touchend', e => {
    if (!startX) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    if (Math.abs(dx) > Math.abs(dy) && dx < -44) {
      row.classList.add('swiped');
    } else if (dx > 24 || Math.abs(dx) < 8) {
      row.classList.remove('swiped');
    }
    startX = 0;
    startY = 0;
  }, { passive: true });
}

function _supportCutChipsHTML(rowId) {
  const activeIds = typeof getDayPoolActiveIds === 'function' ? getDayPoolActiveIds() : [];
  const labels = { morning: 'Day', middle: 'Mid', party1: 'P1', party2: 'P2' };
  const assigned = supportCutAssignments[rowId] || [];
  return activeIds.map(id =>
    '<button class="sup-cut-chip' + (assigned.includes(id) ? ' active' : '') + '"'
    + ' onclick="toggleSupportCut(\'' + rowId + '\',\'' + id + '\')">'
    + escapeHTML(labels[id] || id) + '</button>'
  ).join('');
}

function refreshSupportCutChips() {
  document.querySelectorAll('#supportList .sup-row').forEach(r => {
    const rowId = r.id.replace('staff', '');
    const el = $('sup-cuts-' + rowId);
    if (!el) return;
    el.classList.toggle('sup-cuts--hidden', shiftMode !== 'day');
    if (shiftMode === 'day') el.innerHTML = _supportCutChipsHTML(rowId);
  });
}

function toggleSupportCut(rowId, cutId) {
  if (!supportCutAssignments[rowId]) supportCutAssignments[rowId] = [];
  const arr = supportCutAssignments[rowId];
  const idx = arr.indexOf(cutId);
  if (idx >= 0) arr.splice(idx, 1); else arr.push(cutId);
  const el = $('sup-cuts-' + rowId);
  if (el) el.innerHTML = _supportCutChipsHTML(rowId);
  autoCalculate();
  saveState();
}

// ── Event handlers ────────────────────────────────────────────────────────────

function onStaffNameInput() {
  if (shiftMode === 'day') updateDayStockCards(); else updateStockCards();
  updateTabIndicators();
  updateRoleViewCount();
  autoCalculate();
}

function delStaff(id, listId) {
  const el = $('staff' + id);
  if (el) el.remove();
  // Clean up support cut assignments
  if (listId === 'supportList') delete supportCutAssignments[String(id)];
  reindexTabOrder();
  updateSectionCounts();
  updateRoleViewCount();
  if (shiftMode === 'day') updateDayStockCards(); else updateStockCards();
  updateTabIndicators();
  autoCalculate();
  saveState();
}

function toggleCloser(id) {
  $('ct' + id)?.classList.toggle('on');
  const row = $('staff' + id);
  if (row) _updateStaffMeta(row, $('hrs' + id)?.textContent || '');
  autoCalculate();
}

function _updateStaffMeta(row, hoursText) {
  if (!row) return;
  const id = row.id.replace('staff', '');
  const meta = $('meta' + id);
  if (!meta) return;
  const ctEl = $('ct' + id);
  const outEl = row.querySelector('[data-field="out"]');
  const closer = (ctEl && ctEl.classList.contains('on')) || !outEl?.value.trim();
  const safeHours = hoursText && hoursText !== '–' ? hoursText + ' hrs' : 'Add times to calculate hours';
  meta.innerHTML = escapeHTML(safeHours) + (closer ? ' <span class="sri-meta-badge">closer</span>' : '');
}

function updateSectionCounts() {
  const bartSelector = shiftMode === 'day'
    ? '#bartenderList .staff-row-modal'
    : '#staffList .staff-row-modal';
  const servSelector = shiftMode === 'day'
    ? '#serverList .staff-row-modal'
    : '#nightServerList .staff-row-modal';

  const bartCount = [...document.querySelectorAll(bartSelector)]
    .filter(r => r.querySelector('[data-field="name"]').value.trim()).length;
  const servCount = [...document.querySelectorAll(servSelector)]
    .filter(r => r.querySelector('[data-field="name"]').value.trim()).length;
  const supCount  = [...document.querySelectorAll('#supportList .staff-row-modal')]
    .filter(r => r.querySelector('[data-field="name"]').value.trim()).length;

  // Keep hidden compat spans in sync
  const spc  = $('staffPageCount');
  const spc2 = $('staffPageCount2');
  const bc   = $('bartender-count');
  const sc   = $('server-count');

  const nightTotal = bartCount + servCount;
  const dayTotal   = bartCount + servCount;

  if (spc)  spc.textContent  = nightTotal + (nightTotal === 1 ? ' person' : ' people');
  if (spc2) spc2.textContent = dayTotal   + (dayTotal   === 1 ? ' person' : ' people');
  if (bc)   bc.textContent   = bartCount  + (bartCount  === 1 ? ' person' : ' people');
  if (sc)   sc.textContent   = servCount  + (servCount  === 1 ? ' person' : ' people');
}

function updateRoleViewCount() {
  const el = $('role-view-count');
  if (!el) return;
  const listId = getActiveListId();
  const rows = document.querySelectorAll('#' + listId + ' .staff-row-modal');
  let named = 0;
  rows.forEach(r => { if (r.querySelector('[data-field="name"]').value.trim()) named++; });
  const roleLabel = { bartender: 'bartender', server: 'server', support: 'support' }[staffViewRole] || staffViewRole;
  el.textContent = named + ' ' + (named === 1 ? roleLabel : roleLabel + 's');
}

function onDefaultTimesChange() {
  reindexTabOrder();
  // Refresh role-aware placeholders for all roles (global fallback may have changed)
  ['bartender', 'server', 'support'].forEach(role => {
    _refreshRolePlaceholders(role, 'in');
    _refreshRolePlaceholders(role, 'out');
  });
  // Recalc hours for every row across all lists
  ['staffList', 'nightServerList', 'bartenderList', 'serverList', 'supportList'].forEach(lid => {
    document.querySelectorAll('#' + lid + ' .staff-row-modal').forEach(r =>
      calcHours(r.id.replace('staff', ''))
    );
  });
  autoCalculate();
}

function onTimeInput(id, field) {
  const row = $('staff' + id); if (!row) return;
  const el  = row.querySelector('[data-field="' + field + '"]');
  if (el) el.classList.remove('using-default');
  calcHours(id);

  // Smart default: infer role default from first explicit entry
  const listId = _findListForId(id);
  if (listId) _inferRoleDefault(listId, field);
}

function _findListForId(id) {
  const lists = ['staffList','nightServerList','bartenderList','serverList','supportList'];
  for (const lid of lists) {
    if ($('staff' + id)?.closest('#' + lid)) return lid;
  }
  return null;
}

function calcHours(id) {
  const row   = $('staff' + id); if (!row) return;
  const inEl  = row.querySelector('[data-field="in"]');
  const outEl = row.querySelector('[data-field="out"]');
  const el    = $('hrs' + id);

  // Determine role-specific defaults for this row's list
  const listId = _findListForId(id) || '';
  const role = getRoleForList(listId);
  const rDef = roleDefaults[role] || {};
  const defIn  = rDef.in  || $('gc-in')?.value.trim()  || '';
  const defOut = rDef.out || $('gc-out')?.value.trim()  || '';

  const inRaw  = inEl?.value.trim()  || defIn;
  const outRaw = outEl?.value.trim() || defOut;
  const uDI = !inEl?.value.trim()  && !!defIn;
  const uDO = !outEl?.value.trim() && !!defOut;

  if (inEl)  { inEl.classList.toggle('using-default',  uDI); inEl.placeholder  = defIn  || '—'; }
  if (outEl) { outEl.classList.toggle('using-default', uDO); outEl.placeholder = defOut || '—'; }

  const inParsed  = parseTimeString(inRaw);
  const outParsed = parseTimeString(outRaw);

  setInputInvalid($('gc-in'),  !!defIn  && !parseTimeString(defIn).valid);
  setInputInvalid($('gc-out'), !!defOut && !parseTimeString(defOut).valid);
  setInputInvalid(inEl,  !!inRaw  && !inParsed.valid);
  setInputInvalid(outEl, !!outRaw && !outParsed.valid);

  if (!inParsed.valid || !outParsed.valid) {
    if (el) { el.textContent = '?'; el.className = 'sri-hrs err'; }
    _updateStaffMeta(row, '?');
    _updateCards();
    return;
  }
  if (inParsed.empty || outParsed.empty) {
    if (el) { el.textContent = '–'; el.className = 'sri-hrs'; }
    _updateStaffMeta(row, '');
    _updateCards();
    return;
  }
  const inV  = inParsed.value;
  const outV = outParsed.value;
  let h = outV - inV;
  if (h < 0) h += 12;
  if (h === 0 || h > 12) {
    if (el) { el.textContent = '?'; el.className = 'sri-hrs err'; }
    _updateStaffMeta(row, '?');
    _updateCards();
    return;
  }
  if (el) {
    el.textContent = fmtHrs(h);
    el.className   = 'sri-hrs filled' + (uDI || uDO ? ' default-hrs' : '');
  }
  _updateStaffMeta(row, fmtHrs(h));
  _updateCards();
}

function _updateCards() {
  if (shiftMode === 'day') updateDayStockCards(); else updateStockCards();
}
