// Run real import handlers against in-memory fixtures; no SDK, network or real storage.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const storage = fs.readFileSync(path.join(root, 'js/storage.js'), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
const headers = ['Day','Time','Title','Category','Location','CostJPY','Note','MapsUrl'];
const field = value => '"' + String(value).replaceAll('"','""') + '"';
const table = (rows, separator = ',', head = headers) => [head, ...rows].map(row => row.map(field).join(separator)).join('\r\n');
function handler(name) {
  const start = app.indexOf(`  window.${name} = async function(e) {`);
  const end = app.indexOf('\r\n  };', start);
  assert.ok(start >= 0 && end > start);
  return app.slice(start, end + '\r\n  };'.length);
}
function fixture(text = '', confirm = true) {
  const input = { value: text }, button = { disabled: false };
  const alerts = [], confirmations = [], saves = [], closed = [];
  const initial = { itinerary: [{ id: 'old', day: 6, title: 'old' }], expenses: [{ id: 'old-exp' }], shopping: [{ id: 'keep' }] };
  const context = {
    window: { uiSetIconText() {}, closeModal(id) { closed.push(id); }, confirm(message) { confirmations.push(message); return confirm; } },
    document: { getElementById() { return input; }, querySelector() { return button; } },
    alert(message) { alerts.push(message); }, console: { error() {}, warn() {} },
    tripData: clone(initial), currentItineraryCategory: '交通',
    DAYS_LIST: Array.from({ length: 10 }, (_, i) => ({ day: i + 1 })),
    saveDataAndUpdate() { saves.push(clone(context.tripData)); }
  };
  vm.createContext(context, { codeGeneration: { strings: false, wasm: false } });
  vm.runInContext(storage, context);
  vm.runInContext(handler('syncGoogleSheetItinerary') + '\n' + handler('syncGoogleSheetExpense'), context);
  return { context, initial, input, button, alerts, confirmations, saves, closed, manager: context.window.StorageManager };
}

test('CSV with quoted Tab is not mistaken for TSV and keeps original quotes', async () => {
  const note = '店名 "京都", 集合\t出口\r\n下一行';
  const f = fixture(table([[1,'09:00','"店名"','景點','京都','500*2',note,'']]));
  assert.equal(await f.context.window.syncGoogleSheetItinerary(), true);
  assert.equal(f.context.tripData.itinerary[0].note, note);
  assert.equal(f.context.tripData.itinerary[0].title, '"店名"');
  assert.equal(f.context.tripData.itinerary[0].costJPY, '500*2');
  assert.equal(f.saves.length, 1); assert.deepEqual(f.context.tripData.shopping, f.initial.shopping);
});

for (const separator of [',', '\t']) {
  test(`${separator === ',' ? 'CSV' : 'TSV'} literal, escaped quotes and multiline fields round-trip`, () => {
    const rows = [[1,'09:00','店"名','景點','京都','交通說明\n500*2','"備忘",\t內容\n第二行','']];
    const f = fixture();
    assert.deepEqual(clone(f.manager.parseCSVTextToMatrix(table(rows, separator))), [headers, rows[0].map(String)]);
  });
  test(`${separator === ',' ? 'CSV' : 'TSV'} final empty fields survive actual Sheet entry`, async () => {
    const f = fixture([headers.join(separator), ['1','09:00','A','景點','京都','500*2','',''].join(separator)].join('\r\n'));
    assert.equal(await f.context.window.syncGoogleSheetItinerary(), true);
    assert.equal(f.context.tripData.itinerary.length, 1);
    assert.equal(f.context.tripData.itinerary[0].note, '');
    assert.equal(f.context.tripData.itinerary[0].mapsUrl, '');
  });
  test(`90 itinerary fixture ${separator === ',' ? 'CSV' : 'TSV'} retains counts, all ten-day confirmation and cost text`, async () => {
    const counts = [12,18,23,23,14];
    const rows = counts.flatMap((n, d) => Array.from({ length: n }, (_, i) => [d+1,'09:00',`行程 ${d+1}-${i}`,'景點','京都',`500*2\n交通 ${i}`,`備忘 "${i}",\t內容\n續行`, '']));
    const f = fixture(table(rows, separator));
    assert.equal(await f.context.window.syncGoogleSheetItinerary(), true);
    assert.equal(f.context.tripData.itinerary.length, 90);
    for (let day = 1; day <= 10; day++) {
      const expected = counts[day-1] || 0;
      assert.equal(f.context.tripData.itinerary.filter(item => item.day === day).length, expected);
      assert.ok(f.confirmations[0].includes(`Day ${day}: ${expected} 筆`));
    }
    for (let i = 0; i < rows.length; i++) {
      assert.equal(f.context.tripData.itinerary[i].costJPY, rows[i][5]);
      assert.equal(f.context.tripData.itinerary[i].note, rows[i][6]);
    }
    assert.ok(f.confirmations[0].includes('原本有資料的 Day 6'));
    assert.equal(f.context.currentItineraryCategory, 'all'); assert.equal(f.saves.length, 1);
  });
}

test('blank rows including final whitespace-only row are ignored', async () => {
  const text = headers.join('\t') + '\n\t\t\t\t\t\t\t\n1\t09:00\tA\t景點\t京都\t500*2\t\t\n   ';
  const f = fixture(text); assert.equal(await f.context.window.syncGoogleSheetItinerary(), true);
  assert.equal(f.context.tripData.itinerary.length, 1);
});

for (const day of ['', '0', '11', '-1', '1.5', 'abc', 'Day 12']) {
  test(`invalid Day ${JSON.stringify(day)} fails without save or data replacement`, async () => {
    const f = fixture(table([[day,'09:00','A','景點','京都','','','']]));
    assert.equal(await f.context.window.syncGoogleSheetItinerary(), false);
    assert.equal(f.saves.length, 0); assert.equal(f.confirmations.length, 0);
    assert.deepEqual(f.context.tripData, f.initial); assert.ok(f.alerts.at(-1).includes('Day 無效'));
    assert.equal(f.button.disabled, false);
  });
}

test('row with data but blank title is rejected', async () => {
  const f = fixture(table([[1,'09:00','   ','景點','京都','','','']]));
  assert.equal(await f.context.window.syncGoogleSheetItinerary(), false);
  assert.ok(f.alerts.at(-1).includes('缺少行程標題')); assert.equal(f.saves.length, 0);
  assert.deepEqual(f.context.tripData, f.initial);
});

for (const row of ['1,09:00,A', '1,09:00,A,景點,京都,,,,extra']) {
  test(`incorrect column count is rejected: ${row}`, async () => {
    const f = fixture(headers.join(',') + '\n' + row);
    assert.equal(await f.context.window.syncGoogleSheetItinerary(), false);
    assert.ok(f.alerts.at(-1).includes('欄位數不符')); assert.equal(f.saves.length, 0);
  });
}

test('unclosed quote fails without changing fixture', async () => {
  const f = fixture(headers.join(',') + '\n1,09:00,"unclosed');
  assert.equal(await f.context.window.syncGoogleSheetItinerary(), false);
  assert.ok(f.alerts.at(-1).includes('雙引號未封閉')); assert.equal(f.saves.length, 0);
  assert.deepEqual(f.context.tripData, f.initial);
});

test('missing required headers is rejected', async () => {
  const f = fixture('Time,Location\n09:00,京都');
  assert.equal(await f.context.window.syncGoogleSheetItinerary(), false);
  assert.ok(f.alerts.at(-1).includes('標題列必須')); assert.equal(f.saves.length, 0);
});

test('cancel confirmation preserves old data, text and filter', async () => {
  const f = fixture(table([[1,'09:00','A','景點','京都','','','']]), false);
  const original = f.input.value;
  assert.equal(await f.context.window.syncGoogleSheetItinerary(), false);
  assert.equal(f.saves.length, 0); assert.deepEqual(f.context.tripData, f.initial);
  assert.equal(f.input.value, original); assert.equal(f.context.currentItineraryCategory, '交通');
});

test('empty input is rejected without save', async () => {
  const f = fixture(' \t\n '); assert.equal(await f.context.window.syncGoogleSheetItinerary(), false);
  assert.equal(f.saves.length, 0);
});

test('Sheet accounting retains quotes, commas, Tab, multiline note and payer', async () => {
  const head = ['Date','Time','Item','JPY','TWD','Payer','Category','Card','Note'];
  const note = '"備註",\t內容\n下一行';
  const f = fixture(table([['2026-11-20','09:00','"午餐"','1,000','0','🐷','飲食','現金',note]], ',', head));
  assert.equal(await f.context.window.syncGoogleSheetExpense(), true);
  const item = f.context.tripData.expenses[0];
  assert.equal(item.title, '"午餐"'); assert.equal(item.note, note);
  assert.equal(item.amount, 1000); assert.equal(item.payer, '🐷');
  assert.equal(f.saves.length, 1); assert.deepEqual(f.context.tripData.itinerary, f.initial.itinerary);
});

test('general CSV import preserves legacy column order and CostJPY text', () => {
  const f = fixture();
  const head = ['第幾天(Day)','時間','行程標題','分類','地點名稱','預估費用(JPY)','Google地圖連結','備忘貼士'];
  const data = table([[2,'09:00','"京都"','景點','京都','500*2\n交通','','note']], ',', head);
  const result = f.manager.importData(data, f.initial, 'itinerary', 'replace');
  assert.equal(result.itinerary[0].day, 2); assert.equal(result.itinerary[0].title, '"京都"');
  assert.equal(result.itinerary[0].costJPY, '500*2\n交通'); assert.deepEqual(f.initial.itinerary, [{ id: 'old', day: 6, title: 'old' }]);
});

test('general TSV import entry preserves trailing empty fields', () => {
  const f = fixture();
  const head = ['第幾天(Day)','時間','行程標題','分類','地點名稱','預估費用(JPY)','Google地圖連結','備忘貼士'];
  const data = head.join('\t') + '\n2\t09:00\t京都\t景點\t京都\t500*2\t\t';
  const result = f.manager.importData(data, f.initial, 'itinerary', 'replace');
  assert.equal(result.itinerary[0].day, 2); assert.equal(result.itinerary[0].note, '');
});


for (const separator of [',', '\t']) {
  const format = separator === ',' ? 'CSV' : 'TSV';
  for (const title of ['', '   ']) for (const mode of ['replace','merge']) {
    test(format + ' general blank title rejects atomic ' + mode + ': ' + JSON.stringify(title), () => {
      const f = fixture();
      const data = table([[1,'09:00','valid','景點','京都','','',''],[2,'10:00',title,'景點','京都','','','']],separator);
      assert.throws(()=>f.manager.importData(data,f.context.tripData,'itinerary',mode),/第 3 列缺少行程標題/);
      assert.deepEqual(f.context.tripData,f.initial); assert.equal(f.saves.length,0);
    });
  }
  test(format + ' general valid original title and blank rows',()=>{
    const f=fixture();
    const data=table([Array(8).fill(''),[1,'09:00','  京都 "原文"  ','景點','京都','500*2','','']],separator);
    const result=f.manager.importData(data,f.context.tripData,'itinerary','replace');
    assert.equal(result.itinerary.length,1); assert.equal(result.itinerary[0].title,'  京都 "原文"  ');
    assert.deepEqual(f.context.tripData,f.initial);
  });
  const head=['Date','Time','Item','JPY','TWD','Payer','Category','Card','Note'];
  const valid=['2026-11-20','09:00','午餐','1000','0','🐷','飲食','現金',''];
  for(const invalid of [valid.slice(0,4),[...valid,'extra']]) {
    test(format + ' Sheet expense rejects atomic wrong columns '+invalid.length,async()=>{
      const f=fixture(table([valid,invalid],separator,head));
      assert.equal(await f.context.window.syncGoogleSheetExpense(),false);
      assert.ok(f.alerts.at(-1).includes('第 3 列欄位數不符：預期 9，實際 '+invalid.length));
      assert.deepEqual(f.context.tripData,f.initial); assert.equal(f.saves.length,0);
      assert.equal(f.closed.length,0); assert.equal(f.button.disabled,false);
    });
  }
  test(format+' Sheet expense valid trailing empty field and blank row',async()=>{
    const f=fixture(table([Array(9).fill(''),valid],separator,head));
    assert.equal(await f.context.window.syncGoogleSheetExpense(),true);
    assert.equal(f.context.tripData.expenses.length,1);
    assert.equal(f.context.tripData.expenses[0].title,'午餐');
    assert.equal(f.context.tripData.expenses[0].note,''); assert.equal(f.saves.length,1);
    assert.deepEqual(f.context.tripData.itinerary,f.initial.itinerary);
  });
}
