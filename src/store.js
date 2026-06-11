// Single state store — plain data, mutated only through exported actions.
// Subscribers are notified on a 120ms debounce (immediate for structural
// changes) and run the full pipeline: compute → render → persist.

import { nextId } from './ids.js';

export const ROLES = ['bartender', 'server', 'support'];

export function blankBillStrings() {
  return { 100: '', 50: '', 20: '', 10: '', 5: '', 1: '' };
}

export function newStaff(role = 'bartender') {
  return {
    id: nextId('s'),
    name: '',
    role,
    in: '',
    out: '',
    closerOverride: false,
  };
}

export function newPool(label = 'Pool') {
  return {
    id: nextId('p'),
    label,
    window: { start: '', end: '' },
    roles: { bartender: true, server: true },
    includeSupport: false,
    cash: {
      entryMode: 'nettotal',
      billCounts: blankBillStrings(),
      netTotal: '',
    },
  };
}

export function initialState() {
  const pool = newPool();
  const state = {
    meta: { date: '' },
    staff: [newStaff(), newStaff(), newStaff()],
    defaults: {
      global: { in: '5', out: '2' },
      byRole: {
        bartender: { in: '', out: '' },
        server: { in: '', out: '' },
        support: { in: '', out: '' },
      },
    },
    pools: [pool],
    overrides: { bonuses: {} },
    ui: { activeTab: 'summary', staffViewRole: 'bartender', selectedPool: pool.id },
  };
  return state;
}

let state = initialState();
const listeners = [];
let timer = null;

export function getState() {
  return state;
}

export function replaceState(next) {
  state = next;
}

export function subscribe(fn) {
  listeners.push(fn);
}

function notify() {
  timer = null;
  listeners.forEach(fn => fn(state));
}

function schedule(immediate) {
  if (timer) clearTimeout(timer);
  if (immediate) {
    notify();
  } else {
    timer = setTimeout(notify, 120);
  }
}

// All mutations funnel through here. Structural changes (rows/pools/tabs
// appearing or disappearing) render immediately; keystrokes debounce.
export function mutate(fn, { immediate = false } = {}) {
  fn(state);
  schedule(immediate);
}

// ── Staff actions ─────────────────────────────────────────────────────────────

export function addStaff(role) {
  const person = newStaff(role);
  mutate(s => { s.staff.push(person); }, { immediate: true });
  return person.id;
}

export function removeStaff(id) {
  mutate(s => {
    s.staff = s.staff.filter(p => p.id !== id);
    delete s.overrides.bonuses[id];
  }, { immediate: true });
}

export function updateStaff(id, field, value) {
  mutate(s => {
    const p = s.staff.find(x => x.id === id);
    if (p) p[field] = value;
  });
}

export function toggleCloserOverride(id) {
  mutate(s => {
    const p = s.staff.find(x => x.id === id);
    if (p) p.closerOverride = !p.closerOverride;
  }, { immediate: true });
}

// ── Defaults actions ──────────────────────────────────────────────────────────

export function setGlobalDefault(field, value) {
  mutate(s => { s.defaults.global[field] = value; });
}

export function setRoleDefault(role, field, value) {
  mutate(s => { s.defaults.byRole[role][field] = value; });
}

// ── Pool actions ──────────────────────────────────────────────────────────────

export function addPool() {
  const pool = newPool();
  mutate(s => {
    pool.label = 'Pool ' + (s.pools.length + 1);
    s.pools.push(pool);
    s.ui.selectedPool = pool.id;
  }, { immediate: true });
  return pool.id;
}

export function removePool(id) {
  mutate(s => {
    s.pools = s.pools.filter(p => p.id !== id);
    if (s.ui.selectedPool === id && s.pools.length) s.ui.selectedPool = s.pools[0].id;
  }, { immediate: true });
}

export function updatePool(id, fn) {
  mutate(s => {
    const pool = s.pools.find(p => p.id === id);
    if (pool) fn(pool);
  });
}

export function setPoolEntryMode(id, mode) {
  mutate(s => {
    const pool = s.pools.find(p => p.id === id);
    if (pool) pool.cash.entryMode = mode;
  }, { immediate: true });
}

export function togglePoolRole(id, role) {
  mutate(s => {
    const pool = s.pools.find(p => p.id === id);
    if (!pool) return;
    if (role === 'support') pool.includeSupport = !pool.includeSupport;
    else pool.roles[role] = !pool.roles[role];
  }, { immediate: true });
}

// ── Overrides ─────────────────────────────────────────────────────────────────

export function setBonuses(map) {
  mutate(s => { s.overrides.bonuses = { ...map }; }, { immediate: true });
}

export function clearBonuses() {
  mutate(s => { s.overrides.bonuses = {}; }, { immediate: true });
}

// ── UI / meta ─────────────────────────────────────────────────────────────────

export function setDate(date) {
  mutate(s => { s.meta.date = date; });
}

export function setActiveTab(tab) {
  mutate(s => { s.ui.activeTab = tab; }, { immediate: true });
}

export function setStaffViewRole(role) {
  mutate(s => { s.ui.staffViewRole = role; }, { immediate: true });
}

export function selectPool(id) {
  mutate(s => { s.ui.selectedPool = id; }, { immediate: true });
}
