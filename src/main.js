// Bootstrap: load → subscribe → first render.
// Update flow: input event → action mutates state → schedule(120ms) →
// compute (buildViewModel) → render → persist.

import * as store from './store.js';
import * as persist from './persist.js';
import { buildViewModel } from './viewmodel.js';
import { switchTab, updateTabIndicators } from './render/tabs.js';
import { renderStaff, invalidateStaffList } from './render/staff.js';
import { renderPools, invalidatePools } from './render/pools.js';
import { renderSummary } from './render/summary.js';
import {
  renderDist, openCloseTimeSidebar, closeCloseTimeSidebar, selectCloseTime,
  applyPendingTradeUp, applyPendingTradeDown,
} from './render/dist.js';
import {
  openModal, closeModal, modalBgClose,
  openPersonModal, renderPersonModal,
  openRemModal, renderRemModal, adjustRemBonus, resetRemBonuses,
  renderDefaultsModal,
} from './render/modals.js';

const $ = id => document.getElementById(id);

// ── Load persisted state (v4 or migrated v3) ──────────────────────────────────

const saved = persist.load();
if (saved) store.replaceState(saved);

const state = store.getState();
if (!state.meta.date) {
  const t = new Date();
  state.meta.date = t.getFullYear() + '-'
    + String(t.getMonth() + 1).padStart(2, '0') + '-'
    + String(t.getDate()).padStart(2, '0');
}

// ── Render loop ───────────────────────────────────────────────────────────────

let lastVm = buildViewModel(state);

function render(s) {
  lastVm = buildViewModel(s);
  renderStaff(lastVm);
  renderPools(lastVm);
  renderSummary(lastVm);
  renderDist(lastVm);
  renderPersonModal(lastVm);
  renderRemModal(lastVm);
  renderDefaultsModal(lastVm);
  updateTabIndicators(lastVm);
  persist.save(s);
}

store.subscribe(render);

// ── Global handler surface for inline on* attributes ──────────────────────────

window.App = {
  // tabs
  tab(name) {
    switchTab(name);
    store.setActiveTab(name);
  },

  // staff
  addStaff() {
    store.addStaff(store.getState().ui.staffViewRole);
  },
  delStaff: store.removeStaff,
  staffField: store.updateStaff,
  toggleCloser: store.toggleCloserOverride,
  switchRole(role) {
    invalidateStaffList();
    store.setStaffViewRole(role);
  },
  roleDefaultInline(field, value) {
    store.setRoleDefault(store.getState().ui.staffViewRole, field, value.trim());
  },
  roleDefault(role, field, value) {
    store.setRoleDefault(role, field, value.trim());
  },
  globalDefault(field, value) {
    store.setGlobalDefault(field, value.trim());
  },

  // pools
  addPool: store.addPool,
  removePool: store.removePool,
  selectPool: store.selectPool,
  poolMode: store.setPoolEntryMode,
  poolRole: store.togglePoolRole,
  poolLabel(id, value) {
    store.updatePool(id, p => { p.label = value; });
  },
  poolWindow(id, field, value) {
    store.updatePool(id, p => { p.window[field] = value; });
  },
  poolBill(id, denom, value) {
    store.updatePool(id, p => { p.cash.billCounts[denom] = value; });
  },
  poolNet(id, value) {
    store.updatePool(id, p => { p.cash.netTotal = value; });
  },

  // modals
  openModal,
  closeModal,
  modalBg: modalBgClose,
  personModal(id) {
    openPersonModal(lastVm, id);
  },
  openRemModal() {
    openRemModal(lastVm);
  },
  remBonus(id, delta) {
    adjustRemBonus(lastVm, id, delta);
  },
  resetRemBonuses,

  // close time sidebar
  openCloseTime: openCloseTimeSidebar,
  closeCloseTime: closeCloseTimeSidebar,
  selectCloseTime,

  // trades
  applyTradeUp: applyPendingTradeUp,
  applyTradeDown: applyPendingTradeDown,

  // session
  setDate: store.setDate,
  toggleSessionMenu() {
    $('sessionMenu')?.classList.toggle('hidden');
  },
  exportSession() {
    const s = store.getState();
    const blob = new Blob([persist.serialize(s)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tippool-' + (s.meta.date || 'session') + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
  triggerImport() {
    const input = $('importFileInput');
    if (input) { input.value = ''; input.click(); }
  },
  importSession(file) {
    if (!file) return;
    const reader = new FileReader();
    const input = $('importFileInput');
    const resetInput = () => { if (input) input.value = ''; };
    reader.onload = e => {
      try {
        const imported = persist.deserialize(e.target.result);
        persist.save(imported);
        resetInput();
        location.reload();
      } catch (err) {
        alert('Import failed: ' + err.message);
        resetInput();
      }
    };
    reader.onerror = () => { alert('Could not read file.'); resetInput(); };
    reader.readAsText(file);
  },
  clearSession() {
    if (!confirm('Start a new session? This will clear all current data.')) return;
    persist.clear();
    location.reload();
  },
};

// ── One-time DOM wiring ───────────────────────────────────────────────────────

$('tipDate').value = state.meta.date;

document.addEventListener('click', e => {
  const menu = $('sessionMenu');
  if (!menu || menu.classList.contains('hidden')) return;
  if (!menu.contains(e.target) && e.target.id !== 'sessionMenuBtn') {
    menu.classList.add('hidden');
  }
});

// Hide the tab bar when the software keyboard is open.
if (window.visualViewport) {
  const KEYBOARD_THRESHOLD = 120;
  const updateKeyboardState = () => {
    const shrink = window.screen.height - window.visualViewport.height;
    document.body.classList.toggle('keyboard-open', shrink > KEYBOARD_THRESHOLD);
  };
  window.visualViewport.addEventListener('resize', updateKeyboardState);
  window.visualViewport.addEventListener('scroll', updateKeyboardState);
}

// ── First render ──────────────────────────────────────────────────────────────

switchTab(state.ui.activeTab || 'summary');
render(state);

// Pulse-hint the first empty staff name field on a fresh session
const firstEmpty = document.querySelector('#staffList [data-field="name"]');
if (firstEmpty && !firstEmpty.value.trim()) {
  const row = firstEmpty.closest('.staff-row-modal');
  if (row) {
    row.classList.add('pulse-hint');
    setTimeout(() => row.classList.remove('pulse-hint'), 1600);
  }
}
