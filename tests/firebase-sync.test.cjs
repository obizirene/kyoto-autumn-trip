// Offline VM only: no network APIs, real Firebase SDK or real LocalStorage.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/firebaseConfig.js'), 'utf8');
const storageSource = fs.readFileSync(path.join(root, 'js/storage.js'), 'utf8');
const clone = x => JSON.parse(JSON.stringify(x));
const snap = value => ({ val: () => clone(value) });
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}
function fixture({ cloud = { itinerary: ['cloud'] }, saved = [], sdk = true } = {}) {
  const memory = new Map(saved), writes = [], applied = [], states = [];
  let listener, connectionListener, errorListener, getHook, setHook;
  const connection = {
    on(event, fn) { assert.equal(event, 'value'); connectionListener = fn; },
    off() { connectionListener = null; }
  };
  const ref = {
    root: { child(key) { assert.equal(key, '.info/connected'); return connection; } },
    on(event, fn, fail) { assert.equal(event, 'value'); listener = fn; errorListener = fail; },
    off() { listener = null; },
    async get() { return getHook ? getHook() : snap(cloud); },
    async set(data) {
      writes.push(clone(data));
      if (setHook) await setHook(data);
      cloud = clone(data); listener?.(snap(cloud));
    }
  };
  const localStorage = {
    getItem(key) { return memory.get(key) ?? null; },
    setItem(key, value) { memory.set(key, value); },
    removeItem(key) { memory.delete(key); }
  };
  const sandbox = { window: {}, localStorage, console: { log() {}, warn() {}, error() {} } };
  sandbox.window.DEFAULT_TRIP_DATA = { itinerary: [] };
  if (sdk) sandbox.firebase = {
    apps: [], initializeApp() { this.apps.push({}); }, app() { return {}; },
    database() { return { ref(key) { assert.equal(key, 'kyoto_trip_data_v1'); return ref; } }; }
  };
  vm.createContext(sandbox, { codeGeneration: { strings: false, wasm: false } });
  vm.runInContext(source, sandbox); vm.runInContext(storageSource, sandbox);
  const manager = sandbox.window.FirebaseManager;
  manager.onStatusChange = value => states.push(clone(value));
  return {
    manager, memory, writes, applied, states, sandbox, localStorage,
    getHook(fn) { getHook = fn; }, setHook(fn) { setHook = fn; },
    cloud(value) { cloud = clone(value); listener?.(snap(value)); },
    connect(value) { connectionListener(snap(value)); },
    error(message) { errorListener(new Error(message)); },
    async start() {
      assert.equal(manager.init(), true);
      manager.subscribeRealtime(data => {
        applied.push(clone(data));
        localStorage.setItem(sandbox.window.StorageManager.STORAGE_KEY, JSON.stringify(data));
      });
      this.connect(true); listener(snap(cloud)); await tick();
    }
  };
}

test('initial load, empty cloud and remote updates never upload defaults', async () => {
  const f = fixture(); await f.start();
  assert.equal(f.manager.status, 'synced');
  assert.deepEqual(f.applied.at(-1), { itinerary: ['cloud'] });
  f.cloud({ itinerary: ['remote'] });
  assert.deepEqual(f.applied.at(-1), { itinerary: ['remote'] });
  assert.equal(f.writes.length, 0);
  const empty = fixture({ cloud: null }); await empty.start();
  assert.equal(empty.writes.length, 0); assert.equal(empty.applied.length, 0);
});

test('edit before initial connection survives cloud snapshot and reload', async () => {
  const f = fixture(), local = { itinerary: ['local edit'] };
  assert.equal(f.sandbox.window.StorageManager.saveData(local), true); await f.start();
  assert.equal(f.applied.length, 0); assert.equal(f.writes.length, 0);
  const reload = fixture({ saved: [...f.memory] }); await reload.start();
  await reload.manager.retryPendingSync();
  assert.deepEqual(clone(reload.sandbox.window.StorageManager.loadData()), local);
  assert.equal(reload.manager.status, 'failed');
  assert.equal(reload.writes.length, 0); assert.equal(reload.applied.length, 0);
});

test('rapid writes serialize and coalesce to newest queued copy', async () => {
  const f = fixture(); await f.start();
  const hold = deferred(); f.setHook(() => hold.promise);
  const a = { itinerary: ['A'] }, b = { itinerary: ['B'] }, c = { itinerary: ['C'] };
  const result = f.manager.saveDataToCloud(a);
  f.manager.saveDataToCloud(b); f.manager.saveDataToCloud(c);
  assert.deepEqual(f.writes, [a]); assert.equal(f.manager.status, 'pending');
  hold.resolve(); await result;
  assert.deepEqual(f.writes, [a, c]); assert.deepEqual(f.applied.at(-1), c);
  assert.equal(f.manager.status, 'synced');
  assert.equal(f.memory.has(f.manager.recoveryKey), false);
});

test('post-write read catches remote snapshots skipped during write', async () => {
  const f = fixture(); await f.start();
  const hold = deferred(); f.setHook(() => hold.promise);
  const result = f.manager.saveDataToCloud({ itinerary: ['edit'] });
  f.getHook(() => snap({ itinerary: ['latest remote'] }));
  f.cloud({ itinerary: ['skipped remote'] });
  assert.notDeepEqual(f.applied.at(-1), { itinerary: ['skipped remote'] });
  hold.resolve(); await result;
  assert.deepEqual(f.applied.at(-1), { itinerary: ['latest remote'] });
});

test('local optimistic echo cannot acknowledge uncompleted or failed write', async () => {
  const f = fixture(); await f.start();
  const hold = deferred(); f.setHook(() => hold.promise);
  const data = { itinerary: ['local'] }, result = f.manager.saveDataToCloud(data);
  f.cloud(data);
  assert.equal(f.manager.status, 'pending'); assert.equal(f.memory.has(f.manager.recoveryKey), true);
  hold.reject(new Error('permission denied')); await result;
  assert.equal(f.manager.status, 'failed'); assert.equal(f.manager.writeBlocked, true);
});

test('failure and reconnect preserve local copy without stale retry over newer cloud', async () => {
  const f = fixture(); await f.start();
  f.setHook(() => Promise.reject(new Error('offline')));
  const data = { itinerary: ['unsynced'] };
  f.sandbox.window.StorageManager.saveData(data); await f.manager.pendingWrites;
  f.cloud({ itinerary: ['newer remote'] }); f.connect(false); f.connect(true); await tick();
  await f.manager.retryPendingSync();
  assert.equal(f.writes.length, 1); assert.equal(f.manager.status, 'failed');
  assert.deepEqual(clone(f.manager.pendingData), data);
  assert.deepEqual(clone(f.sandbox.window.StorageManager.loadData()), data);
});

test('identical cloud recovery confirms without another set', async () => {
  const data = { itinerary: ['already saved'] };
  const f = fixture({ cloud: data, saved: [
    ['kyoto_trip_pending_sync_v1', 'pending'], ['kyoto_autumn_trip_app_v1', JSON.stringify(data)]
  ] }); await f.start();
  assert.equal(await f.manager.retryPendingSync(), true);
  assert.equal(f.writes.length, 0); assert.equal(f.manager.writeBlocked, false);
  assert.equal(f.memory.has(f.manager.recoveryKey), false);
});

test('local edit during recovery read cannot be falsely acknowledged', async () => {
  const a = { itinerary: ['A'] }, b = { itinerary: ['B'] }, f = fixture({ cloud: a });
  f.sandbox.window.StorageManager.saveData(a); await f.start();
  const hold = deferred(); f.getHook(() => hold.promise);
  const result = f.manager.retryPendingSync(); f.sandbox.window.StorageManager.saveData(b);
  hold.resolve(snap(a)); await result;
  assert.deepEqual(clone(f.manager.pendingData), b);
  assert.equal(f.writes.length, 0); assert.equal(f.manager.writeBlocked, true);
});

test('late catch-up result cannot replace newer remote event', async () => {
  const f = fixture(); await f.start(); const hold = deferred(); f.getHook(() => hold.promise);
  const result = f.manager.refreshCloud(); f.cloud({ itinerary: ['new remote'] });
  hold.resolve(snap({ itinerary: ['stale read'] })); await result;
  assert.deepEqual(f.applied.at(-1), { itinerary: ['new remote'] });
});

test('offline and absent SDK edits stay pending without writes', async () => {
  const f = fixture(); await f.start(); f.connect(false);
  f.sandbox.window.StorageManager.saveData({ itinerary: ['offline'] });
  assert.equal(f.manager.status, 'pending'); assert.equal(f.writes.length, 0);
  const missing = fixture({ sdk: false }); assert.equal(missing.manager.init(), false);
  missing.sandbox.window.StorageManager.saveData({ itinerary: ['no sdk'] });
  assert.equal(missing.manager.writeBlocked, true); assert.equal(missing.writes.length, 0);
});

test('permission and read errors are visible rather than synced', async () => {
  const f = fixture(); await f.start();
  f.getHook(() => Promise.reject(new Error('permission denied')));
  await f.manager.refreshCloud(); assert.equal(f.manager.status, 'failed');
  f.error('permission denied'); assert.equal(f.manager.cloudReady, false);
});

test('storage quota failure prevents cloud write and protects memory', async () => {
  const f = fixture(); await f.start();
  f.localStorage.setItem = () => { throw new Error('quota exceeded'); };
  const data = { itinerary: ['recover me'] };
  assert.equal(f.sandbox.window.StorageManager.saveData(data), false);
  assert.equal(f.writes.length, 0); assert.equal(f.manager.status, 'failed');
  assert.deepEqual(clone(f.manager.pendingData), data);
  f.cloud({ itinerary: ['remote'] }); assert.notDeepEqual(f.applied.at(-1), { itinerary: ['remote'] });
});

test('explicit discard reads cloud only; empty cloud never erases local copy', async () => {
  const f = fixture(); f.sandbox.window.StorageManager.saveData({ itinerary: ['local'] }); await f.start();
  assert.equal(await f.manager.discardPendingAndLoadCloud(), true);
  assert.deepEqual(f.applied.at(-1), { itinerary: ['cloud'] }); assert.equal(f.writes.length, 0);
  const empty = fixture({ cloud: null });
  empty.sandbox.window.StorageManager.saveData({ itinerary: ['local'] }); await empty.start();
  assert.equal(await empty.manager.discardPendingAndLoadCloud(), false); assert.equal(empty.manager.writeBlocked, true);
});

test('cannot change config while edits are pending', async () => {
  const f = fixture(); await f.start(); f.connect(false);
  await f.manager.saveDataToCloud({ itinerary: ['offline'] });
  assert.equal(f.manager.init({ databaseURL: 'https://not-used.invalid' }), false);
  assert.equal(f.writes.length, 0);
});

test('UI labels follow real sync state, not isInitialized flag', () => {
  const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  const start = app.indexOf('  function updateFirebaseSyncStatus()');
  const end = app.indexOf('\n  function initFirebaseSync()', start);
  const nodes = new Map(['firebase-sync-status', 'fb-status-message', 'fb-load-cloud-btn'].map(id => [id, { style: {} }]));
  const manager = { status: 'connecting', isInitialized: true };
  const context = { window: { FirebaseManager: manager }, document: { getElementById: id => nodes.get(id) } };
  for (const [state, label] of [['connecting', '連線中'], ['pending', '待同步'], ['failed', '同步失敗'], ['synced', '已同步']]) {
    manager.status = state;
    vm.runInNewContext(app.slice(start, end) + '\nupdateFirebaseSyncStatus();', context);
    assert.equal(nodes.get('firebase-sync-status').textContent, label);
  }
});

test('cached initial value while offline cannot mark ready or overwrite local', async () => {
  const f = fixture();
  assert.equal(f.manager.init(), true);
  f.manager.subscribeRealtime(data => f.applied.push(clone(data)));
  f.connect(false); f.cloud({ itinerary: ['cached cloud'] });
  assert.equal(f.manager.cloudReady, false); assert.equal(f.applied.length, 0);
  await f.manager.saveDataToCloud({ itinerary: ['early local'] });
  f.connect(true); await tick();
  assert.equal(f.writes.length, 0); assert.equal(f.applied.length, 0);
});

test('storage failure during active write prevents sending the newer unsaved copy', async () => {
  const f = fixture(); await f.start();
  const hold = deferred(); f.setHook(() => hold.promise);
  const result = f.manager.saveDataToCloud({ itinerary: ['first'] });
  f.localStorage.setItem = () => { throw new Error('quota'); };
  f.sandbox.window.StorageManager.saveData({ itinerary: ['not persisted'] });
  hold.resolve(); await result;
  assert.equal(f.writes.length, 1); assert.equal(f.manager.writeBlocked, true);
  assert.equal(f.manager.status, 'failed');
  assert.deepEqual(clone(f.manager.pendingData), { itinerary: ['not persisted'] });
});

test('out-of-order reads keep newest result', async () => {
  const f = fixture(); await f.start(); const a = deferred(), b = deferred(); let n = 0;
  f.getHook(() => ++n === 1 ? a.promise : b.promise);
  const first = f.manager.refreshCloud(), second = f.manager.refreshCloud();
  b.resolve(snap({ itinerary: ['new read'] })); await second;
  a.resolve(snap({ itinerary: ['old read'] })); await first;
  assert.deepEqual(f.applied.at(-1), { itinerary: ['new read'] });
});

test('listener error invalidates an older pending read', async () => {
  const f = fixture(); await f.start(); const hold = deferred(); f.getHook(() => hold.promise);
  const result = f.manager.refreshCloud(); f.error('permission denied');
  hold.resolve(snap({ itinerary: ['old read'] })); await result;
  assert.equal(f.manager.cloudReady, false); assert.equal(f.manager.status, 'failed');
});

test('manual discard refuses to drop local edits made during the read', async () => {
  const f = fixture(); f.sandbox.window.StorageManager.saveData({ itinerary: ['A'] }); await f.start();
  const hold = deferred(); f.getHook(() => hold.promise);
  const result = f.manager.discardPendingAndLoadCloud();
  f.sandbox.window.StorageManager.saveData({ itinerary: ['B'] });
  hold.resolve(snap({ itinerary: ['cloud'] }));
  assert.equal(await result, false); assert.equal(f.writes.length, 0);
  assert.deepEqual(clone(f.manager.pendingData), { itinerary: ['B'] });
});

test('two isolated mock devices preserve last-write-wins and receive remote changes', async () => {
  const a = fixture(), b = fixture(); await a.start(); await b.start();
  const first = { itinerary: ['device A'] }, last = { itinerary: ['device B'] };
  await a.manager.saveDataToCloud(first); b.cloud(first);
  assert.deepEqual(b.applied.at(-1), first);
  await b.manager.saveDataToCloud(last); a.cloud(last);
  assert.deepEqual(a.applied.at(-1), last);
  assert.equal(a.writes.length, 1); assert.equal(b.writes.length, 1);
});

test('corrupt pending local JSON cannot silently resolve as default data', async () => {
  const f = fixture({ cloud: { itinerary: [] }, saved: [
    ['kyoto_trip_pending_sync_v1', 'pending'], ['kyoto_autumn_trip_app_v1', '{broken']
  ] }); await f.start(); await f.manager.retryPendingSync();
  assert.equal(f.manager.writeBlocked, true); assert.equal(f.manager.status, 'failed');
  assert.equal(f.memory.get('kyoto_autumn_trip_app_v1'), '{broken'); assert.equal(f.writes.length, 0);
});

test('sync preserves all original fields and does not mutate submitted data', async () => {
  const f = fixture(); await f.start();
  const data = {
    itinerary: [{ id: 'i1', day: 2, costs: [{ text: '¥406*2' }], note: 'multi\nline' }],
    expenses: [{ payer: '❤️', amount: 123, currency: 'JPY' }],
    shoppingLocations: [{ items: [{ priceJPY: 42, bought: false }] }],
    packing: [{ category: 'C', owner: '🐷' }], otherExistingField: { value: true }
  };
  const before = JSON.stringify(data);
  f.sandbox.window.StorageManager.saveData(data); await f.manager.pendingWrites;
  assert.equal(JSON.stringify(data), before);
  assert.deepEqual(f.writes.at(-1), data); assert.deepEqual(f.applied.at(-1), data);
});

test('recovery compares RTDB array/object and empty-value normalization without changing data', async () => {
  const local = { itinerary: [{ id: 'i1', note: '' }], expenses: [], optional: null, settings: {} };
  const cloud = { itinerary: { 0: { note: '', id: 'i1' } } };
  const f = fixture({ cloud, saved: [
    ['kyoto_trip_pending_sync_v1', 'pending'], ['kyoto_autumn_trip_app_v1', JSON.stringify(local)]
  ] }); await f.start();
  assert.equal(await f.manager.retryPendingSync(), true);
  assert.equal(f.writes.length, 0);
  assert.equal(f.memory.get('kyoto_autumn_trip_app_v1'), JSON.stringify(local));
  assert.equal(f.manager.sameData({ value: false }, {}), false);
  assert.equal(f.manager.sameData({ value: 0 }, {}), false);
});


for(const separator of [',','\t']) {
  test((separator===','?'CSV':'TSV')+' 90 rows import-storage-sync-reload integration',async()=>{
    const counts=[12,18,23,23,14];
    const rows=counts.flatMap((n,d)=>Array.from({length:n},(_,i)=>[d+1,'09:00','行程 '+d+'-'+i,'景點','京都','500*2\n交通','','備忘 "'+i+'",\t內容\n續行']));
    const header=['Day','Time','Title','Category','Location','CostJPY','MapsUrl','Note'];
    const text=[header,...rows].map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(separator)).join('\r\n');
    const f=fixture({cloud:null});
    f.sandbox.window.StorageManager.STORAGE_KEY='phase4_fixture_import_sync';
    await f.start();
    const initial={itinerary:[],expenses:[{id:'keep-exp'}],shopping:[{id:'keep-shop',items:[]}]};
    const data=f.sandbox.window.StorageManager.importData(text,initial,'itinerary','replace');
    assert.equal(data.itinerary.length,90);
    for(let day=1;day<=10;day++)assert.equal(data.itinerary.filter(i=>i.day===day).length,counts[day-1]||0);
    assert.deepEqual(clone(data.itinerary.map(i=>i.note)),rows.map(r=>r[7]));
    assert.deepEqual(clone(data.itinerary.map(i=>i.costJPY)),rows.map(r=>r[5]));
    assert.deepEqual(initial.itinerary,[]);
    const original=clone(data);
    assert.equal(f.sandbox.window.StorageManager.saveData(data),true);await f.manager.pendingWrites;
    assert.equal(f.writes.length,1);assert.deepEqual(f.writes[0],original);assert.deepEqual(clone(data),original);
    const reload=fixture({cloud:original,saved:[...f.memory]});
    reload.sandbox.window.StorageManager.STORAGE_KEY='phase4_fixture_import_sync';
    await reload.start();
    assert.deepEqual(clone(reload.sandbox.window.StorageManager.loadData()),original);
    assert.equal(reload.writes.length,0);
  });
}
