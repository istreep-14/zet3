function reindexTabOrder() {
  const rows = [...document.querySelectorAll('#staffList .staff-row-modal')];
  const n = rows.length;
  rows.forEach((r, i) => {
    const nameEl = r.querySelector('[data-field="name"]');
    const inEl   = r.querySelector('[data-field="in"]');
    const outEl  = r.querySelector('[data-field="out"]');
    nameEl.placeholder = 'Employee ' + (i + 1);
    nameEl.tabIndex = i + 1;
    inEl.tabIndex   = n + i + 1;
    outEl.tabIndex  = 2 * n + i + 1;
    const gcIn  = ($('gc-in').value  || '').trim();
    const gcOut = ($('gc-out').value || '').trim();
    inEl.placeholder  = gcIn  ? gcIn  : '—';
    outEl.placeholder = gcOut ? gcOut : '—';
  });
}

function addStaff(focusNew) {
  staffId++;
  const id  = staffId;
  const div = document.createElement('div');
  div.className = 'staff-row-modal';
  div.id = 'staff' + id;
  div.innerHTML =
    '<div class="sri-name">'
    + '<input data-field="name" oninput="updateStockCards();updateTabIndicators();autoCalculate()" autocomplete="off" autocorrect="off" autocapitalize="words">'
    + '</div>'
    + '<div class="sri-time-field"><span class="sri-tlbl">in</span>'
    + '<input data-field="in" inputmode="decimal" oninput="onTimeInput(' + id + ',\'in\')" onchange="calcHours(' + id + ');autoCalculate()">'
    + '</div>'
    + '<div class="sri-time-field"><span class="sri-tlbl">out</span>'
    + '<input data-field="out" inputmode="decimal" oninput="onTimeInput(' + id + ',\'out\')" onchange="calcHours(' + id + ');autoCalculate()">'
    + '</div>'
    + '<div class="sri-hrs" id="hrs' + id + '">–</div>'
    + '<button class="sri-closer" id="ct' + id + '" onclick="toggleCloser(' + id + ')" title="Closer" tabindex="-1"><span>c</span><span class="sc-lbl">close</span></button>'
    + '<button class="sri-del" onclick="delStaff(' + id + ')" tabindex="-1">✕</button>';
  $('staffList').appendChild(div);
  reindexTabOrder();
  calcHours(id);
  if (focusNew) setTimeout(() => div.querySelector('[data-field="name"]').focus(), 30);
  saveState();
}

function delStaff(id) {
  const el = $('staff' + id);
  if (el) el.remove();
  reindexTabOrder(); updateStockCards(); updateTabIndicators(); autoCalculate();
  saveState();
}

function toggleCloser(id) {
  $('ct' + id).classList.toggle('on');
  autoCalculate();
}

function onDefaultTimesChange() {
  reindexTabOrder();
  document.querySelectorAll('#staffList .staff-row-modal')
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
  const gcIn  = $('gc-in').value.trim(), gcOut = $('gc-out').value.trim();
  const inRaw = inEl.value.trim()  || gcIn;
  const outRaw = outEl.value.trim() || gcOut;
  const uDI = !inEl.value.trim()  && !!gcIn;
  const uDO = !outEl.value.trim() && !!gcOut;
  inEl.classList.toggle('using-default',  uDI);
  outEl.classList.toggle('using-default', uDO);
  const inParsed = parseTimeString(inRaw), outParsed = parseTimeString(outRaw);
  setInputInvalid($('gc-in'), !!gcIn && !parseTimeString(gcIn).valid);
  setInputInvalid($('gc-out'), !!gcOut && !parseTimeString(gcOut).valid);
  setInputInvalid(inEl, !!inRaw && !inParsed.valid);
  setInputInvalid(outEl, !!outRaw && !outParsed.valid);
  if (!inParsed.valid || !outParsed.valid) { el.textContent = '?'; el.className = 'sri-hrs err'; updateStockCards(); return; }
  if (inParsed.empty || outParsed.empty) { el.textContent = '–'; el.className = 'sri-hrs'; updateStockCards(); return; }
  const inV = inParsed.value, outV = outParsed.value;
  let h = outV - inV; if (h < 0) h += 12;
  if (h === 0 || h > 12) { el.textContent = '?'; el.className = 'sri-hrs err'; updateStockCards(); return; }
  el.textContent = fmtHrs(h);
  el.className   = 'sri-hrs filled' + (uDI || uDO ? ' default-hrs' : '');
  updateStockCards();
}

function collectStaffInputRows() {
  return [...document.querySelectorAll('#staffList .staff-row-modal')].map(r => {
    const rowId = r.id.replace('staff', '');
    return {
      rowId,
      name:     r.querySelector('[data-field="name"]').value.trim(),
      inStr:    r.querySelector('[data-field="in"]').value.trim(),
      outStr:   r.querySelector('[data-field="out"]').value.trim(),
      toggleOn: $('ct' + rowId) ? $('ct' + rowId).classList.contains('on') : false
    };
  }).filter(r => r.name);
}
