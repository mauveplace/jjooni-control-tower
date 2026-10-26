const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function calculate({ref={},position={}}={}){
 const p={ticker:'TEST',currency:'USD',market:'US',qty:2,current_price:110,...position};
 const r={ticker:'TEST',currency:'USD',qty:2,current_price:110,baseline_price:100,baseline_session_date:'2026-10-23',baseline_source:'BROKER_CANDLES',state:'CALCULATED',...ref};
 const w={__JJOONI_LIVE_PAYLOAD:{fx_reference:{krw_per_usd:1300,prev_close_krw_per_usd:1320}},__JJOONI_CANONICAL_SSOT:{accounts:{TOSS:{positions:[p],holding_price_effect:{positions:[r]}}}}};
 const ctx={window:w,document:{addEventListener(){}},setTimeout(){},console,Intl};
 const src=fs.readFileSync('fx-attribution-v16.js','utf8').replace('function enrichAccounts(calc){','window.testBuildRows=buildRows;function enrichAccounts(calc){');
 vm.runInNewContext(src,ctx);return w.testBuildRows();
}
test('current canonical baseline restores USD rows and exact price/FX decomposition',()=>{
 const x=calculate();assert.equal(x.rows.length,1);assert.equal(x.usd_count,1);assert.equal(x.price_usd,20);
 assert.equal(x.total,2*(110*1300-100*1320));assert(Math.abs(x.total-x.price_krw_decomp-x.fx)<1e-7);
});
test('mismatched holdings or invalid reference is excluded without inventing zero',()=>{
 for(const ref of [{qty:3},{current_price:111},{currency:'KRW'},{state:'MISSING'},{baseline_source:null},{baseline_price:null},{baseline_session_date:null}]){
  const x=calculate({ref});assert.equal(x.usd_count,1);assert.equal(x.rows.length,0);assert.equal(x.total,null);
 }
});
test('legacy explicit prev_close remains supported; short quantity is not made long',()=>{
 assert.equal(calculate({position:{prev_close:105},ref:{state:'MISSING'}}).rows[0].p0,105);
 assert.equal(calculate({position:{qty:-2},ref:{qty:-2}}).rows.length,0);
});
