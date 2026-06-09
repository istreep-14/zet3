// Global mutable state — written by calculator, read by renderers
let staffId      = 0;
let serverStaffId = 1000; // servers start at 1000 to avoid id collisions
let supportId    = 2000;  // support staff start at 2000
let livePool     = {};
let lastStaff    = [];
let lastTotal    = 0;
let lastTotH     = 0;
let lastRate     = 0;
let lastLeftover = 0;
let lastRemainderPool = 0;
let lastPoolAfter = {};
let lastRemainderBills = {};
let lastDistributionError = '';
let _lastDistStaff = [];
let cashMode     = 'perbill';
let perBillSnapshot = { 100: '', 50: '', 20: '', 10: '', 5: '', 1: '' };
let netBillSnapshot = { 100: '', 50: '', 20: '', 10: '', 5: '', 1: '' };
let netTotalSnapshot = '';
let isRestoringState = false;
let isUpdatingNetTotal = false;
let currentInputError = '';
let remainderOverrides = null; // null = automatic closer split; object = manual rowId -> add-on dollars

// ── Shift mode ────────────────────────────────────────────────────────────────
// 'night' = current single-pool behaviour
// 'day'   = multi-pool day shift (morning cut + middle cut + optional parties)
let shiftMode = 'night';

// ── Day shift pool state ──────────────────────────────────────────────────────
// Each pool has its own cash entry (per-bill or net-total snapshot).
// poolEnabled flags control whether party pools are active.
let dayPools = {
  morning: {
    cashMode: 'nettotal',
    perBillSnapshot: { 100: '', 50: '', 20: '', 10: '', 5: '', 1: '' },
    netBillSnapshot: { 100: '', 50: '', 20: '', 10: '', 5: '', 1: '' },
    netTotalSnapshot: '',
  },
  middle: {
    cashMode: 'nettotal',
    perBillSnapshot: { 100: '', 50: '', 20: '', 10: '', 5: '', 1: '' },
    netBillSnapshot: { 100: '', 50: '', 20: '', 10: '', 5: '', 1: '' },
    netTotalSnapshot: '',
  },
  party1: {
    enabled: false,
    windowStart: '',
    windowEnd:   '',
    cashMode: 'nettotal',
    perBillSnapshot: { 100: '', 50: '', 20: '', 10: '', 5: '', 1: '' },
    netBillSnapshot: { 100: '', 50: '', 20: '', 10: '', 5: '', 1: '' },
    netTotalSnapshot: '',
  },
  party2: {
    enabled: false,
    windowStart: '',
    windowEnd:   '',
    cashMode: 'nettotal',
    perBillSnapshot: { 100: '', 50: '', 20: '', 10: '', 5: '', 1: '' },
    netBillSnapshot: { 100: '', 50: '', 20: '', 10: '', 5: '', 1: '' },
    netTotalSnapshot: '',
  },
};

// ── Staff role toggle ─────────────────────────────────────────────────────────
// Which role tab is active in the staff section
let staffViewRole = 'bartender'; // 'bartender' | 'server' | 'support'

// Per-role default times — explicitly set by the inline/default-time controls.
let roleDefaults = {
  bartender: { in: '', out: '' },
  server:    { in: '', out: '' },
  support:   { in: '', out: '' },
};

// Support staff cut assignments: rowId → string[] of cut IDs
// e.g. { '2001': ['middle', 'party1'] }
let supportCutAssignments = {};

// Support tip-out overrides per cut (set in the tip-out modal):
// { cutId: { rowId: { hours: number, pct: number } } }
let supportTipOutOverrides = {};

// Which day-shift pool card is currently expanded (accordion — one at a time)
let selectedDayPool = 'morning';

// Last computed day shift results (for rendering)
let lastDayResult = null;
/*
  lastDayResult shape:
  {
    pools: [
      { id: 'morning', label: 'Morning Cut', start, end, total, totalHours, participants: [{name,role,hours,raw}] },
      { id: 'middle',  label: 'Middle Cut',  start, end, total, totalHours, participants: [...] },
      { id: 'party1',  label: 'Party 1',     start, end, total, totalHours, participants: [...] },
      { id: 'party2',  label: 'Party 2',     start, end, total, totalHours, participants: [...] },
    ],
    people: [
      { n, role, _rowId, i, o, h, rawTotal, final, bonus, closer, bills:{} }
    ],
    totalCash, totalPaid, leftover, rate (combined), error
  }
*/

const $ = id => document.getElementById(id);
const DENOMS = [100, 50, 20, 10, 5, 1];
