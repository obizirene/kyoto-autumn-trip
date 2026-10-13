const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
const begin=app.indexOf('    // JSON-only backup restore:');
const finish=app.indexOf('    // 4. Edit Flight Form Handler',begin);
assert.ok(begin>=0&&finish>begin);
function fixture(confirmed=true){
  let submit;const button={disabled:false},status={textContent:''},file={files:[]},text={value:''};
  const data={itinerary:[{id:'old',day:1,title:'old'}],expenses:[{id:'e',title:'old',amount:1}],shopping:[],packing:[],hotels:[],flightInfo:{outbound:{},inbound:{}},extra:{keep:true}};
  const saves=[],prompts=[];
  const c={window:{confirm(message){prompts.push(message);return confirmed;}},document:{getElementById(id){return {'form-restore-json':{addEventListener(event,fn){submit=fn;},querySelector(){return button;}},'restore-json-status':status,'restore-json-file':file,'restore-json-text':text}[id];}},tripData:structuredClone(data),saveDataAndUpdate(){saves.push(structuredClone(c.tripData));},console};
  vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(root,'js/storage.js'),'utf8'),c);vm.runInContext(app.slice(begin,finish),c);
  return {c,data,saves,prompts,status,button,file,text,run:()=>submit({preventDefault(){}})};
}
test('full JSON export and restore keeps all fields including shopping and unknown keys',async()=>{
 const f=fixture();let exported;f.c.window.StorageManager.downloadJSONFile=d=>exported=structuredClone(d);f.c.window.StorageManager.exportFullJSON(f.data);
 exported.shopping=[{id:'s',location:'京都',items:[{name:'商品',priceJPY:100,bought:true}]}];exported.extra={unknown:['preserved']};
 f.text.value=JSON.stringify(exported);await f.run();assert.deepEqual(f.saves[0],exported);assert.match(f.prompts[0],/購物/);assert.match(f.prompts[0],/extra/);
});
for(const type of ['kyoto_trip_expenses','kyoto_trip_itinerary','kyoto_trip_expenses_itinerary'])test(type+' replaces only named categories',async()=>{
 const f=fixture();const d={type};if(type!=='kyoto_trip_itinerary')d.expenses=[];if(type!=='kyoto_trip_expenses')d.itinerary=[];
 f.text.value=JSON.stringify(d);await f.run();assert.equal(f.saves.length,1);assert.deepEqual(f.c.tripData.shopping,f.data.shopping);assert.deepEqual(f.c.tripData.extra,f.data.extra);
 if(d.expenses)assert.equal(f.c.tripData.expenses.length,0);else assert.deepEqual(f.c.tripData.expenses,f.data.expenses);
 if(d.itinerary)assert.equal(f.c.tripData.itinerary.length,0);else assert.deepEqual(f.c.tripData.itinerary,f.data.itinerary);
});
test('cancel keeps live data untouched and saves zero',async()=>{const f=fixture(false);f.text.value=JSON.stringify({type:'kyoto_trip_itinerary',itinerary:[]});await f.run();assert.deepEqual(f.c.tripData,f.data);assert.equal(f.saves.length,0);assert.match(f.status.textContent,/取消/);});
for(const bad of ['not JSON','[]','{}',JSON.stringify({type:'kyoto_trip_expenses',expenses:'bad'}),JSON.stringify({itinerary:[{day:1,title:' '}]}),JSON.stringify({expenses:[{title:'x',amount:'100'}]}),JSON.stringify({flightInfo:{},expenses:[],itinerary:[]})])test('invalid backup rejects before confirmation '+bad,async()=>{const f=fixture();f.text.value=bad;await f.run();assert.deepEqual(f.c.tripData,f.data);assert.equal(f.saves.length,0);assert.equal(f.prompts.length,0);assert.match(f.status.textContent,/還原失敗/);assert.equal(f.button.disabled,false);});
test('non JSON file rejected without reading',async()=>{const f=fixture();f.file.files=[{name:'data.csv',text(){throw Error('must not read')}}];await f.run();assert.equal(f.saves.length,0);assert.equal(f.prompts.length,0);});
test('JSON file path and duplicate submission guard',async()=>{const f=fixture();let release;f.file.files=[{name:'backup.json',text:()=>new Promise(r=>release=r)}];const first=f.run();await f.run();release(JSON.stringify({type:'kyoto_trip_itinerary',itinerary:[]}));await first;assert.equal(f.saves.length,1);assert.equal(f.prompts.length,1);});
test('old generic import markup and events removed; dedicated entries retained',()=>{const html=fs.readFileSync(path.join(root,'index.html'),'utf8');assert.ok(!html.includes('import-data-modal-btn'));assert.ok(!html.includes('modal-import-data'));assert.ok(!app.includes('form-import-data'));for(const id of ['form-restore-json','btn-export-itinerary-json','btn-export-expenses-json','form-google-sheet-expense','form-google-sheet-itinerary'])assert.ok(html.includes(id));});

test('malformed full backup nested categories rejected without save',async()=>{for(const bad of [{packing:[{category:'C'}]},{shopping:[{location:42,items:[]}]}]){const f=fixture();f.text.value=JSON.stringify({...f.data,...bad});await f.run();assert.equal(f.saves.length,0);assert.equal(f.prompts.length,0);assert.deepEqual(f.c.tripData,f.data);}});
