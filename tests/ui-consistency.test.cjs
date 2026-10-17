const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const M=require('../canonical-metrics.js');
function tradeApi(trades,accounts={}){
 let code=fs.readFileSync('trade-review-outcomes-v26.js','utf8');code=code.slice(0,code.indexOf('function ensureStyle(){'))+'window.api={buildRows,reconstructRealized,collectTrades};})();';
 const window={__JJOONI_CANONICAL_SSOT:{accounts}},ctx={window,D:{human:{trades}},console,Date,Map,Set,Number,String,Math};vm.runInNewContext(code,ctx);return window.api;
}
test('broker fund amount rows cannot create synthetic realized or opportunity profit',()=>{
 const a=tradeApi([{account:'IRP',ticker:'F002',side:'BUY',qty:1,price:360000,current_price:17599696,trade_date:'2026-09-21'},{account:'IRP',ticker:'F002',side:'SELL',qty:1,price:400000,current_price:17599696,trade_date:'2026-09-22'}]);
 const rows=a.buildRows();assert.equal(rows.length,2);for(const r of rows){assert.equal(r.opportunity,null);assert.equal(r.performance_pct,null);assert.equal(r.realized.value,null);assert.equal(r.basis.state,'FUND_UNITS_REQUIRED')}
});
test('explicit broker realized fund profit is preserved without inferred price delta',()=>{
 const a=tradeApi([{account:'IRP',ticker:'F002',side:'SELL',qty:1,price:400000,current_price:17599696,realized_pnl_krw:123,trade_date:'2026-09-22'}]);const [r]=a.buildRows();assert.equal(r.realized.value,123);assert.equal(r.opportunity,null);
});
test('same account canonical quote wins over older per-trade and watchlist prices',()=>{
 const a=tradeApi([{account:'TOSS',ticker:'TQQQ',side:'BUY',qty:2,price:70,current_price:67,currency:'USD'}],{TOSS:{positions:[{ticker:'TQQQ',current_price:73}]}});const [r]=a.buildRows();assert.equal(r.current,73);assert.equal(r.opportunity,6);
});
test('FX attribution with no comparable USD closes is unavailable, never zero',()=>{
 let code=fs.readFileSync('fx-attribution-v16.js','utf8');code=code.slice(0,code.indexOf('function enrichAccounts('))+'window.api={buildRows,signedKrw,signedUsd};})();';
 const window={__JJOONI_CANONICAL_SSOT:{accounts:{TOSS:{positions:[{ticker:'QQQ',currency:'USD',qty:2,current_price:100}]}}},__JJOONI_LIVE_PAYLOAD:{fx_reference:{krw_per_usd:1300,prev_close_krw_per_usd:1290}}};vm.runInNewContext(code,{window,document:{},console,Intl,Date});const x=window.api.buildRows();for(const k of ['price_usd','price_krw_live','fx','total'])assert.equal(x[k],null);assert.equal(window.api.signedUsd(x.price_usd),'산정 대기');assert.equal(window.api.signedKrw(0),'+₩0');
});
test('source truth emission does not schedule itself again',()=>{
 const handlers={},timers=[];let emitted=0;const document={querySelector:()=>null,querySelectorAll:()=>[],addEventListener:(k,fn)=>(handlers[k]||=[]).push(fn),dispatchEvent:e=>{emitted++;for(const fn of handlers[e.type]||[])fn(e)}};
 const window={__JJOONI_CANONICAL_SSOT:{accounts:{TOSS:{}},registry:[]},__JJOONI_LIVE_PAYLOAD:{}};vm.runInNewContext(fs.readFileSync('account-source-truth-v22.js','utf8'),{window,document,setTimeout:fn=>timers.push(fn),CustomEvent:class{constructor(type){this.type=type}},console});
 const original=timers.length;timers[0]();assert.equal(emitted,1);assert.equal(timers.length,original,'no recursive source-truth timer');
});
