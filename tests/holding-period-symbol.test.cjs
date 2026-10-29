const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){
 const now=Date.now(),sid='symbols',start=new Date(now-10000).toISOString();
 const row=(ticker,amount)=>({ticker,state:'CALCULATED',price_effect_krw:amount,baseline_value_krw:10000,baseline_price:100,baseline_session_date:'2026-10-28'});
 const account={positions:[row('005930',0),row('000660',-200)],known_count:2,position_count:2,known_subtotal_krw:-200};
 const C={snapshot_id:sid,accounts:{ISA:{positions:[{ticker:'005930.KS'},{ticker:'000660.KQ'}]}}};
 const live={snapshot_id:sid,performance_day:{schema:'CT_US_CLOSE_PERFORMANCE_DAY_V1',snapshot_id:sid,start_kst:start,end_kst:new Date(now+3600000).toISOString(),as_of_kst:new Date(now).toISOString(),price_comparisons:{schema:'CT_HOLDING_PRICE_COMPARISONS_V1',snapshot_id:sid,current:{snapshot_id:sid,start_kst:start,accounts:{ISA:account}},week:{snapshot_id:sid,accounts:{ISA:{...account,positions:[row('005930',500),row('000660',-300)],known_subtotal_krw:200}}}}}};
 const root={__JJOONI_CANONICAL_SSOT:C,__JJOONI_LIVE_PAYLOAD:live,JjooniMetrics:{positions:a=>a.positions||[]},addEventListener(){}};
 const source=fs.readFileSync('tablet-accounts-v8.js','utf8').replace('setTimeout(render,0);','window.testPeriod={periodData,periodCoverage,periodSymbol};setTimeout(render,0);');
 vm.runInNewContext(source,{window:root,document:{addEventListener(){}},setTimeout(){},console});
 return {api:root.testPeriod,C,live,account};
}
test('KR suffixes join calculated daily and weekly evidence; zero is valid',()=>{
 const {api}=fixture();assert.equal(api.periodData('ISA',' 005930.ks ').today.amount,0);assert.equal(api.periodData('ISA','005930.KS').week.amount,500);assert.equal(api.periodData('ISA','000660.KQ').today.amount,-200);assert.match(api.periodCoverage('ISA'),/오늘 2\/2종목 · 합계 일치/);assert.match(api.periodCoverage('ISA'),/전주 2\/2종목 · 합계 일치/);assert.equal(api.periodSymbol('BRK.B'),'BRK.B');
});
test('missing or duplicate evidence stays unknown and cannot claim complete totals',()=>{
 const {api,account}=fixture();account.positions.pop();account.known_count=1;account.known_subtotal_krw=0;assert.equal(api.periodData('ISA','000660.KQ').today,null);assert.match(api.periodCoverage('ISA'),/오늘 1\/2종목 · 1종목 기준자료 확인 필요/);account.positions.push({...account.positions[0]});assert.equal(api.periodData('ISA','005930').today,null);assert.doesNotMatch(api.periodCoverage('ISA').split(' / ')[0],/합계 일치/);
});
test('snapshot mismatch hides period values and reports once at account level',()=>{
 const {api,C}=fixture();C.snapshot_id='old';assert.equal(api.periodData('ISA','005930').stale,true);assert.equal(api.periodCoverage('ISA'),'오늘·전주 가격변동 갱신 필요');
});
