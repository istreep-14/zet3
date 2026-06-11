// Persistence — localStorage save/load, JSON export/import.
// Schema v4 stores the state object directly. v1–v3 snapshots (the old
// DOM-serialized shape) are migrated on first load; malformed data is
// discarded, never crashed on.

import { DENOMS, parseWholeNumber } from './util.js';
import { newStaff, newPool, initialState, blankBillStrings, ROLES } from './store.js';
import { seedIds } from './ids.js';

export const STORAGE_KEY = 'tippool_v1';

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

// ── v4 validation ─────────────────────────────────────────────────────────────

function assertString(v, label) {
  if (v != null && typeof v !== 'string') throw new Error(label + ' must be a string');
}

export function validateV4(state) {
  if (!isPlainObject(state)) throw new Error('Not a valid TipPool state');
  if (!isPlainObject(state.meta)) throw new Error('meta missing');
  assertString(state.meta.date, 'date');

  if (!Array.isArray(state.staff)) throw new Error('staff must be an array');
  state.staff.forEach(p => {
    if (!isPlainObject(p)) throw new Error('staff entries must be objects');
    if (typeof p.id !== 'string') throw new Error('staff id must be a string');
    ['name', 'in', 'out'].forEach(k => assertString(p[k], 'staff ' + k));
    if (!ROLES.includes(p.role)) throw new Error('staff role is invalid');
    if (p.closerOverride != null && typeof p.closerOverride !== 'boolean') {
      throw new Error('closerOverride must be a boolean');
    }
  });

  if (!isPlainObject(state.defaults) || !isPlainObject(state.defaults.global) || !isPlainObject(state.defaults.byRole)) {
    throw new Error('defaults missing');
  }

  if (!Array.isArray(state.pools) || !state.pools.length) throw new Error('pools must be a non-empty array');
  state.pools.forEach(pool => {
    if (!isPlainObject(pool) || typeof pool.id !== 'string') throw new Error('pool entries are invalid');
    if (!isPlainObject(pool.window) || !isPlainObject(pool.roles) || !isPlainObject(pool.cash)) {
      throw new Error('pool shape is invalid');
    }
    if (pool.cash.entryMode !== 'perbill' && pool.cash.entryMode !== 'nettotal') {
      throw new Error('pool entryMode is invalid');
    }
    assertString(pool.cash.netTotal, 'pool netTotal');
    if (!isPlainObject(pool.cash.billCounts)) throw new Error('pool billCounts must be an object');
    DENOMS.forEach(d => {
      const v = pool.cash.billCounts[d];
      if (v == null) return;
      if (typeof v !== 'string' && typeof v !== 'number') throw new Error('pool bill counts are invalid');
      if (!parseWholeNumber(v).valid) throw new Error('pool bill counts must be whole numbers');
    });
  });

  if (!isPlainObject(state.overrides) || !isPlainObject(state.overrides.bonuses)) {
    throw new Error('overrides missing');
  }
  Object.values(state.overrides.bonuses).forEach(v => {
    if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0) throw new Error('bonus overrides must be whole dollars');
  });
}

// ── v3 → v4 migration ─────────────────────────────────────────────────────────
// Old snapshot: staff (bartenders) + nightServers + support lists, night cash
// snapshots, gcIn/gcOut, roleDefaults. Day-pool / cut-assignment data is
// dropped (orphaned in the unified model).

export function migrateV3(snap) {
  const state = initialState();
  state.staff = [];

  const addRows = (rows, role) => {
    (rows || []).forEach(r => {
      if (!isPlainObject(r)) return;
      const person = newStaff(role);
      person.name = typeof r.name === 'string' ? r.name : '';
      person.in = typeof r.in === 'string' ? r.in : '';
      person.out = typeof r.out === 'string' ? r.out : '';
      person.closerOverride = !!r.closer;
      state.staff.push(person);
    });
  };

  addRows(snap.staff, 'bartender');
  addRows(snap.nightServers, 'server');
  addRows(snap.support, 'support');
  if (!state.staff.length) state.staff = [newStaff(), newStaff(), newStaff()];

  state.meta.date = typeof snap.date === 'string' ? snap.date : '';
  state.defaults.global.in = typeof snap.gcIn === 'string' && snap.gcIn ? snap.gcIn : '5';
  state.defaults.global.out = typeof snap.gcOut === 'string' && snap.gcOut ? snap.gcOut : '2';
  if (isPlainObject(snap.roleDefaults)) {
    ROLES.forEach(role => {
      const d = snap.roleDefaults[role];
      if (!isPlainObject(d)) return;
      state.defaults.byRole[role].in = typeof d.in === 'string' ? d.in : '';
      state.defaults.byRole[role].out = typeof d.out === 'string' ? d.out : '';
    });
  }

  // One pool from the night cash snapshots.
  const pool = newPool();
  const mode = snap.cashMode === 'perbill' ? 'perbill' : 'nettotal';
  pool.cash.entryMode = mode;
  pool.cash.netTotal = typeof snap.netTotal === 'string' ? snap.netTotal : '';
  const bills = isPlainObject(snap.perBillBills) ? snap.perBillBills
    : (mode === 'perbill' && isPlainObject(snap.bills) ? snap.bills : null);
  if (bills) {
    const counts = blankBillStrings();
    DENOMS.forEach(d => {
      const v = bills[d];
      if ((typeof v === 'string' || typeof v === 'number') && parseWholeNumber(v).valid) {
        counts[d] = String(v ?? '');
      }
    });
    pool.cash.billCounts = counts;
  }
  state.pools = [pool];
  state.ui.selectedPool = pool.id;

  validateV4(state);
  return state;
}

// ── Snapshot round-trip ───────────────────────────────────────────────────────

export function serialize(state) {
  return JSON.stringify({ v: 4, saved: Date.now(), state });
}

export function deserialize(raw) {
  const snap = JSON.parse(raw);
  if (!isPlainObject(snap)) throw new Error('Not a valid TipPool file');

  if (snap.v === 4) {
    validateV4(snap.state);
    seedIds([...snap.state.staff.map(p => p.id), ...snap.state.pools.map(p => p.id)]);
    return snap.state;
  }

  if (snap.v === 1 || snap.v === 2 || snap.v === 3) {
    return migrateV3(snap);
  }

  throw new Error('Incompatible file version');
}

// ── Browser storage I/O ───────────────────────────────────────────────────────

export function save(state, storage = globalThis.localStorage) {
  try {
    storage.setItem(STORAGE_KEY, serialize(state));
  } catch (e) {
    console.warn('TipPool: localStorage unavailable', e);
  }
}

export function load(storage = globalThis.localStorage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return deserialize(raw);
  } catch {
    return null;
  }
}

export function clear(storage = globalThis.localStorage) {
  storage.removeItem(STORAGE_KEY);
}
