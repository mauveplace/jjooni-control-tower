const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function fixture(){let calls=0,fail=false;const window={location:{href:'https://example.test/market-observatory/'}};vm.runInNewContext(fs.readFileSync('market-observatory/shared-data-reader-v1.js','utf8'),{window,URL,Date,Map,AbortSignal,fetch:async()=>{calls++;if(fail)throw Error('offline');return {ok:true,json:async()=>({value:123})}}});return {read:window.JjooniDataReads.read,calls:()=>calls,fail:v=>fail=v}}
test('concurrent readers and short-term revisit share one response parse',async()=>{const f=fixture();const [a,b]=await Promise.all([f.read('./data/sector-etf.json?cb=1'),f.read('./data/sector-etf.json?cb=2')]);assert.equal(f.calls(),1);assert.strictEqual(a,b);await f.read('./data/sector-etf.json');assert.equal(f.calls(),1)});
test('failed shared request is evicted so the next attempt can recover',async()=>{const f=fixture();f.fail(true);await assert.rejects(f.read('./data/x.json'));f.fail(false);assert.equal((await f.read('./data/x.json')).value,123);assert.equal(f.calls(),2)});
test('pageshow seeds the initial market revision without fetching it a second time',async()=>{
 const data={schema:'JJOONI_MARKET_OBSERVATORY_V1',generated_kst:'2026-10-25T08:00:00+09:00',us_completed_session_date:'2026-10-23',series:{},latest:{}},events={};let calls=0;
 const document={hidden:false,addEventListener(){},getElementById:()=>null,querySelector:()=>null};
 const window={document,addEventListener:(k,f)=>events[k]=f};
 vm.runInNewContext(fs.readFileSync('market-observatory/live-market-refresh-v1.js','utf8'),{window,document,DATA:data,Date,JSON,Map,AbortSignal,CustomEvent:class{},setInterval(){},clearInterval(){},fetch:async()=>{calls++;return {ok:true,json:async()=>data}}});
 events.pageshow();await Promise.resolve();assert.equal(calls,0);await window.__JJOONI_OBSERVATORY_MARKET_REFRESH.refresh(true);assert.equal(calls,1);
});
