// ── Tab order & placeholders ──────────────────────────────────────────────────

function reindexTabOrder() {
  const reindex = (listId, offset) => {
    const rows = [...document.querySelectorAll('#' + listId + ' .staff-row-modal')];
    const n = rows.length;
    rows.forEach((r, i) => {
      const nameEl = r.querySelector('[data-field="name"]');
      const inEl   = r.querySelector('[data-field="in"]');
      const outEl  = r.querySelector('[data-field="out"]');
      nameEl.placeholder = 'Employee ' + (i + 1);
      nameEl.tabIndex = offset + i + 1;
      inEl.tabIndex   = offset + n + i + 1;
      outEl.tabIndex  = offset + 2 * n + i + 1;
      const gcIn  = ($('gc-in')?.value  || '').trim();
      const gcOut = ($('gc-out')?.value || '').trim();
      inEl.placeholder  = gcIn  ? gcIn  : '—';
      outEl.placeholder = gcOut ? gcOut : '—';
    });
  };

  reindex('staffList', 0);       // night shift
  reindex('bartenderList', 0);   // day shift bartenders
  reindex('serverList', 100);    // day shift servers
}

// ── Add staff row ─────────────────────────────────────────────────────────────

function addStaff(focusNew, listId) {
  const targetList = listId || 'staffList';
  const isServer   = targetList === 'serverList';

  // id ranges: night staff / day bartenders share 1-999, servers 1000+
  if (isServer) {
    serverStaffId++;
  } else {
    staffId++;
  }
  const id = isServer ? serverStaffId : staffId;

  const div = document.createElement('div');
  div.className = 'staff-row-modal';
  div.id = 'staff' + id;
  div.innerHTML =
    '<div class="sri-name">'
    + '<input data-field="name" oninput="onStaffNameInput()" autocomplete="off" autocorrect="off" autocapitalize="words">'
    + '</div>'
    + '<div class="sri-time-field"><span class="sri-tlbl">in</span>'
    + '<input data-field="in" inputmode="decimal" oninput="onTimeInput(' + id + ',\'in\')" onchange="calcHours(' + id + ');autoCalculate()">'
    + '</div>'
    + '<div class="sri-time-field"><span class="sri-tlbl">out</span>'
    + '<input data-field="out" inputmode="decimal" oninput="onTimeInput(' + id + ',\'out\')" onchange="calcHours(' + id + ');autoCalculate()">'
    + '</div>'
    + '<div class="sri-hrs" id="hrs' + id + '">–</div>'
    + '<button class="sri-closer" id="ct' + id + '" onclick="toggleCloser(' + id + ')" title="Closer" tabindex="-1"><span>c</span><span class="sc-lbl">close</span></button>'
    + '<button class="sri-del" onclick="delStaff(' + id + ',\'' + targetList + '\')" tabindex="-1">✕</button>';

  $(targetList).appendChild(div);
  reindexTabOrder();
  calcHours(id);
  updateSectionCounts();
  if (focusNew) setTimeout(() => div.querySelector('[data-field="name"]').focus(), 30);
  saveState();
}

function onStaffNameInput() {
  if (shiftMode === 'day') {
    updateDayStockCards();
  } else {
    updateStockCards();
  }
  updateTabIndicators();
  autoCalculate();
}

function delStaff(id, listId) {
  const el = $('staff' + id);
  if (el) el.remove();
  reindexTabOrder();
  updateSectionCounts();
  if (shiftMode === 'day') updateDayStockCards(); else updateStockCards();
  updateTabIndicators();
  autoCalculate();
  saveState();
}

function toggleCloser(id) {
  $('ct' + id)?.classList.toggle('on');
  autoCalculate();
}

function updateSectionCounts() {
  // In day mode bartenders live in #bartenderList; in night mode they're in #staffList.
  const bartSelector = shiftMode === 'day'
    ? '#bartenderList .staff-row-modal'
    : '#staffList .staff-row-modal';

  const bartCount = [...document.querySelectorAll(bartSelector)]
    .filter(r => r.querySelector('[data-field="name"]').value.trim()).length;
  const servCount = [...document.querySelectorAll('#serverList .staff-row-modal')]
    .filter(r => r.querySelector('[data-field="name"]').value.trim()).length;

  const bartCountEl = $('bartender-count');
  const servCountEl = $('server-count');
  if (bartCountEl) bartCountEl.textContent = bartCount + (bartCount === 1 ? ' person' : ' people');
  if (servCountEl) servCountEl.textContent = servCount + (servCount === 1 ? ' person' : ' people');

  // Night shift page count (staffPageCount lives in night section)
  const spc = $('staffPageCount');
  if (spc) {
    const n = shiftMode === 'day' ? bartCount + servCount : bartCount;
    spc.textContent = n + (n === 1 ? ' person' : ' people');
  }

  // Day shift page count (staffPageCount2 lives in day section)
  const spc2 = $('staffPageCount2');
  if (spc2) {
    const n = bartCount + servCount;
    spc2.textContent = n + (n === 1 ? ' person' : ' people');
  }
}

function onDefaultTimesChange() {
  reindexTabOrder();
  document.querySelectorAll('#staffList .staff-row-modal, #bartenderList .staff-row-modal, #serverList .staff-row-modal')
    .forEach(r => calcHours(r.id.replace('staff', '')));
  autoCalculate();
}

function onTimeInput(id, field) {
  const row = $('staff' + id); if (!row) return;
  const el  = row.querySelector('[data-field="' + field + '"]');
  if (el) el.classList.remove('using-default');
  calcHours(id);
}

function calcHours(id) {
  const row   = $('staff' + id); if (!row) return;
  const inEl  = row.querySelector('[data-field="in"]');
  const outEl = row.querySelector('[data-field="out"]');
  const el    = $('hrs' + id);
  const gcIn  = $('gc-in')?.value.trim() || '';
  const gcOut = $('gc-out')?.value.trim() || '';
  const inRaw  = inEl.value.trim()  || gcIn;
  const outRaw = outEl.value.trim() || gcOut;
  const uDI = !inEl.value.trim()  && !!gcIn;
  const uDO = !outEl.value.trim() && !!gcOut;
  inEl.classList.toggle('using-default',  uDI);
  outEl.classList.toggle('using-default', uDO);
  const inParsed  = parseTimeString(inRaw);
  const outParsed = parseTimeString(outRaw);
  setInputInvalid($('gc-in'),  !!gcIn  && !parseTimeString(gcIn).valid);
  setInputInvalid($('gc-out'), !!gcOut && !parseTimeString(gcOut).valid);
  setInputInvalid(inEl,  !!inRaw  && !inParsed.valid);
  setInputInvalid(outEl, !!outRaw && !outParsed.valid);
  if (!inParsed.valid || !outParsed.valid) {
    if (el) { el.textContent = '?'; el.className = 'sri-hrs err'; }
    if (shiftMode === 'day') updateDayStockCards(); else updateStockCards();
    return;
  }
  if (inParsed.empty || outParsed.empty) {
    if (el) { el.textContent = '–'; el.className = 'sri-hrs'; }
    if (shiftMode === 'day') updateDayStockCards(); else updateStockCards();
    return;
  }
  const inV  = inParsed.value;
  const outV = outParsed.value;
  let h = outV - inV;
  if (h < 0) h += 12;
  if (h === 0 || h > 12) {
    if (el) { el.textContent = '?'; el.className = 'sri-hrs err'; }
    if (shiftMode === 'day') updateDayStockCards(); else updateStockCards();
    return;
  }
  if (el) {
    el.textContent = fmtHrs(h);
    el.className   = 'sri-hrs filled' + (uDI || uDO ? ' default-hrs' : '');
  }
  if (shiftMode === 'day') updateDayStockCards(); else updateStockCards();
}
