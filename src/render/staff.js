// Staff tab — one list, role filter toggle. Rows re-render only on structural
// changes (add/remove/role switch) so typing never loses focus; value-only
// updates patch hours cells, placeholders, and validity classes in place.

import { escapeHTML, fmtHrs } from '../util.js';
import { parseTime, fmtTimeAbs, resolveIn, nextAfter } from '../time.js';

const $ = id => document.getElementById(id);

const ROLE_LABEL = { bartender: 'bartender', server: 'server', support: 'support' };
const ADD_LABEL = { bartender: '+ Add Bartender', server: '+ Add Server', support: '+ Add Support' };

let lastSignature = '';

function rowDefaults(state, role) {
  const roleDef = state.defaults.byRole[role] || {};
  return {
    in: roleDef.in || state.defaults.global.in || '',
    out: roleDef.out || state.defaults.global.out || '',
  };
}

// Mirror of the resolver for display purposes only — works for unnamed rows
// too, so a row shows its hours as soon as times are typed. Uses the same
// fixed-axis rules as resolve.js: In via resolveIn, Out as the next occurrence
// after In, so hours never go negative regardless of anchor.
function rowDisplay(state, person, vm) {
  const defs = rowDefaults(state, person.role);
  const inRaw = person.in.trim() || defs.in;
  const outRaw = person.out.trim() || defs.out;
  const inParsed = parseTime(inRaw);
  const outParsed = parseTime(outRaw);
  const usedDefault = !person.in.trim() || !person.out.trim();

  const display = {
    defIn: defs.in,
    defOut: defs.out,
    inInvalid: !!inRaw && !inParsed.valid,
    outInvalid: !!outRaw && !outParsed.valid,
    hrsText: '–',
    hrsClass: 'sri-hrs',
  };

  if (display.inInvalid || display.outInvalid) {
    display.hrsText = '?';
    display.hrsClass = 'sri-hrs err';
    return display;
  }
  if (inParsed.empty || outParsed.empty) return display;

  const inAbs = resolveIn(inParsed.value);
  const outAbs = nextAfter(outParsed.value, inAbs);
  const h = outAbs - inAbs;

  if (h <= 0 || h > 12) {
    display.hrsText = '?';
    display.hrsClass = 'sri-hrs err';
    return display;
  }
  display.hrsText = fmtHrs(h);
  display.hrsClass = 'sri-hrs filled' + (usedDefault ? ' default-hrs' : '');
  return display;
}

function rowHTML(person, idx, display) {
  const id = person.id;
  return `<div class="staff-row-modal" data-sid="${id}">
    <div class="sri-name">
      <input data-field="name" value="${escapeHTML(person.name)}" placeholder="Employee ${idx + 1}"
        autocomplete="off" autocorrect="off" autocapitalize="words"
        onkeydown="App.staffTab(event,'name')"
        oninput="App.staffField('${id}','name',this.value)">
    </div>
    <div class="sri-time-field"><span class="sri-tlbl">in</span>
      <input data-field="in" value="${escapeHTML(person.in)}" placeholder="${escapeHTML(display.defIn || '—')}"
        inputmode="decimal" onkeydown="App.staffTab(event,'in')" oninput="App.staffField('${id}','in',this.value)">
    </div>
    <div class="sri-time-field"><span class="sri-tlbl">out</span>
      <input data-field="out" value="${escapeHTML(person.out)}" placeholder="${escapeHTML(display.defOut || '—')}"
        inputmode="decimal" onkeydown="App.staffTab(event,'out')" oninput="App.staffField('${id}','out',this.value)">
    </div>
    <div class="${display.hrsClass}" data-hrs>${display.hrsText}</div>
    <button class="sri-closer${person.closerOverride ? ' on' : ''}" onclick="App.toggleCloser('${id}')"
      title="Closer override" tabindex="-1"><span>c</span><span class="sc-lbl">close</span></button>
    <button class="sri-del" onclick="App.delStaff('${id}')" tabindex="-1">✕</button>
  </div>`;
}

function patchRow(rowEl, person, display) {
  const hrsEl = rowEl.querySelector('[data-hrs]');
  if (hrsEl) {
    hrsEl.textContent = display.hrsText;
    hrsEl.className = display.hrsClass;
    hrsEl.setAttribute('data-hrs', '');
  }
  const inEl = rowEl.querySelector('[data-field="in"]');
  const outEl = rowEl.querySelector('[data-field="out"]');
  if (inEl) {
    inEl.placeholder = display.defIn || '—';
    inEl.classList.toggle('input-invalid', display.inInvalid);
  }
  if (outEl) {
    outEl.placeholder = display.defOut || '—';
    outEl.classList.toggle('input-invalid', display.outInvalid);
  }
}

function sectionSummaryHTML(vm) {
  const state = vm.state;
  const named = state.staff.filter(p => p.name.trim());
  if (!named.length) return '';

  const blankOuts = named.filter(p => !p.out.trim() && !(state.defaults.byRole[p.role]?.out || '').trim());
  const parts = [named.length + ' staff'];

  const closeAbs = vm.resolved.closeAbs;
  if (closeAbs !== null) parts.push('close ' + fmtTimeAbs(closeAbs));
  if (blankOuts.length) {
    parts.push(blankOuts.length + (blankOuts.length === 1 ? ' blank out' : ' blank outs') + ' using close time');
  }

  let html = escapeHTML(parts.join(' · '));

  const warnings = [];
  if (closeAbs !== null) {
    vm.resolved.staff.forEach(p => {
      if (!p.usedDefaults.out && p.outAbs !== null && p.outAbs > closeAbs + 0.001) {
        warnings.push(p.name + "'s out time is later than the close time");
      }
    });
  }
  const closers = vm.resolved.staff.filter(p => p.closer);
  if (closers.length === 1) warnings.push('Only one closer detected');

  warnings.forEach(w => {
    html += ' <span class="staff-summary-warn">⚠ ' + escapeHTML(w) + '</span>';
  });
  return html;
}

export function renderStaff(vm) {
  const state = vm.state;
  const viewRole = state.ui.staffViewRole;

  // Role toggle buttons
  ['bartender', 'server', 'support'].forEach(r => {
    $('rb-' + r)?.classList.toggle('active', r === viewRole);
  });

  // Inline role defaults (don't clobber while focused)
  const roleDef = state.defaults.byRole[viewRole] || {};
  const rdefIn = $('rdef-in'), rdefOut = $('rdef-out');
  if (rdefIn && document.activeElement !== rdefIn) rdefIn.value = roleDef.in || '';
  if (rdefOut && document.activeElement !== rdefOut) rdefOut.value = roleDef.out || '';

  // Count line
  const visible = state.staff.filter(p => p.role === viewRole);
  const named = visible.filter(p => p.name.trim()).length;
  const countEl = $('role-view-count');
  if (countEl) {
    const label = ROLE_LABEL[viewRole];
    countEl.textContent = named + ' ' + (named === 1 ? label : label + 's');
  }

  const addBtn = $('addStaffBtn');
  if (addBtn) addBtn.textContent = ADD_LABEL[viewRole];

  const summaryEl = $('staff-section-summary');
  if (summaryEl) summaryEl.innerHTML = sectionSummaryHTML(vm);

  // List: full re-render only when structure changes
  const signature = viewRole + '|' + visible.map(p => p.id + ':' + (p.closerOverride ? 1 : 0)).join(',');
  const list = $('staffList');
  if (!list) return;

  if (signature !== lastSignature) {
    lastSignature = signature;
    list.innerHTML = visible.map((p, i) => rowHTML(p, i, rowDisplay(state, p, vm))).join('');
  } else {
    visible.forEach(p => {
      const rowEl = list.querySelector(`[data-sid="${p.id}"]`);
      if (rowEl) patchRow(rowEl, p, rowDisplay(state, p, vm));
    });
  }
}

// Force the next render to rebuild rows (e.g. after restoring state).
export function invalidateStaffList() {
  lastSignature = '';
}

// Column-major Tab order: stepping through the list walks DOWN a column (all
// names, then all ins, then all outs) instead of left→right across each row.
// We override the native row-major order on Tab / Shift+Tab; at the ends we let
// the default fire so focus escapes the list (to the add button / role defaults).
const TAB_COLS = ['name', 'in', 'out'];

export function staffTabNav(e, field) {
  if (e.key !== 'Tab') return;
  const rows = [...document.querySelectorAll('#staffList [data-sid]')];
  const rowEl = e.target.closest('[data-sid]');
  let r = rows.indexOf(rowEl);
  let c = TAB_COLS.indexOf(field);
  if (r < 0 || c < 0) return;

  if (!e.shiftKey) {
    if (r < rows.length - 1) r++;
    else if (c < TAB_COLS.length - 1) { c++; r = 0; }
    else return;                         // last cell → let focus leave the list
  } else {
    if (r > 0) r--;
    else if (c > 0) { c--; r = rows.length - 1; }
    else return;                         // first cell → let focus leave the list
  }

  const target = rows[r]?.querySelector(`[data-field="${TAB_COLS[c]}"]`);
  if (target) { e.preventDefault(); target.focus(); }
}
