import assert from 'node:assert';
import { serialize, deserialize, migrateV3, validateV4, save, load, STORAGE_KEY } from '../src/persist.js';
import { initialState, newStaff } from '../src/store.js';

function fakeStorage() {
  const map = new Map();
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: k => map.delete(k),
  };
}

// ── v4 round-trip ──
{
  const state = initialState();
  state.meta.date = '2026-06-10';
  state.staff[0].name = 'Alex';
  state.staff[0].in = '5';
  state.pools[0].cash.netTotal = '500';
  state.overrides.bonuses = { [state.staff[0].id]: 2 };

  const restored = deserialize(serialize(state));
  assert.deepStrictEqual(restored, state);

  const storage = fakeStorage();
  save(state, storage);
  assert.deepStrictEqual(load(storage), state);
}

// ── Validation discards malformed data ──
{
  const storage = fakeStorage();
  storage.setItem(STORAGE_KEY, '{"v":4,"state":{"staff":"nope"}}');
  assert.strictEqual(load(storage), null);

  storage.setItem(STORAGE_KEY, 'not json');
  assert.strictEqual(load(storage), null);

  storage.setItem(STORAGE_KEY, '{"v":99,"state":{}}');
  assert.strictEqual(load(storage), null);

  const bad = initialState();
  bad.staff.push({ ...newStaff('bartender'), role: 'wizard' });
  assert.throws(() => validateV4(bad), /role/);
}

// ── v3 migration: lists → one staff array, night cash → one pool ──
{
  const v3 = {
    v: 3,
    saved: 0,
    date: '2026-06-09',
    gcIn: '5',
    gcOut: '2.5',
    shiftMode: 'day',
    cashMode: 'perbill',
    staffViewRole: 'server',
    roleDefaults: {
      bartender: { in: '4.5', out: '' },
      server: { in: '5', out: '11' },
      support: { in: '', out: '' },
    },
    bills: { 100: '2', 50: '1', 20: '10', 10: '0', 5: '4', 1: '13' },
    perBillBills: { 100: '2', 50: '1', 20: '10', 10: '0', 5: '4', 1: '13' },
    netBillBills: {},
    netTotal: '463',
    staff: [
      { _rowId: '1', name: 'Alex', in: '5', out: '', closer: false },
      { _rowId: '2', name: 'Sam', in: '', out: '1', closer: true },
    ],
    servers: [{ _rowId: '1001', name: 'DayOnly', in: '10', out: '2', closer: false }],
    nightServers: [{ _rowId: '1002', name: 'Jo', in: '6', out: '', closer: false }],
    support: [{ _rowId: '2001', name: 'Bee', in: '7', out: '12', closer: false, cuts: ['middle'] }],
    dayPools: { morning: {}, middle: {} },
  };

  const state = migrateV3(v3);

  assert.strictEqual(state.staff.length, 4); // day-only server list is dropped
  const [alex, sam, jo, bee] = state.staff;
  assert.deepStrictEqual(
    [alex.name, alex.role, alex.in, alex.out, alex.closerOverride],
    ['Alex', 'bartender', '5', '', false],
  );
  assert.deepStrictEqual([sam.name, sam.closerOverride], ['Sam', true]);
  assert.deepStrictEqual([jo.name, jo.role], ['Jo', 'server']);
  assert.deepStrictEqual([bee.name, bee.role, bee.in, bee.out], ['Bee', 'support', '7', '12']);
  assert.ok(new Set(state.staff.map(p => p.id)).size === 4, 'ids are unique');

  assert.strictEqual(state.meta.date, '2026-06-09');
  assert.deepStrictEqual(state.defaults.global, { in: '5', out: '2.5' });
  assert.strictEqual(state.defaults.byRole.bartender.in, '4.5');
  assert.strictEqual(state.defaults.byRole.server.out, '11');

  assert.strictEqual(state.pools.length, 1);
  const pool = state.pools[0];
  assert.strictEqual(pool.cash.entryMode, 'perbill');
  assert.strictEqual(pool.cash.billCounts[20], '10');
  assert.strictEqual(pool.cash.netTotal, '463');
  assert.deepStrictEqual(pool.window, { start: '', end: '' });

  // Migrated state passes v4 validation and round-trips
  assert.deepStrictEqual(deserialize(serialize(state)), state);

  // A v3 snapshot in storage loads via migration
  const storage = fakeStorage();
  storage.setItem(STORAGE_KEY, JSON.stringify(v3));
  const loaded = load(storage);
  assert.strictEqual(loaded.staff.length, 4);
}

console.log('persist tests passed');
