const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const outcomes=fs.readFileSync(path.join(root,'trade-review-outcomes-v26.js'),'utf8');
const grouped=fs.readFileSync(path.join(root,'trade-review-v2.js'),'utf8');

test('trade review uses individual BUY and SELL fills in strict recent order',()=>{
  assert.match(outcomes,/\['BUY','SELL'\]\.includes\(side\(t\)\)/);
  assert.match(outcomes,/\.sort\(\(a,b\)=>b\.time-a\.time\|\|b\.seq-a\.seq\)/);
  assert.match(outcomes,/slice\(0,40\)/);
});

test('current-price delta is per fill quantity and never waits seven days',()=>{
  assert.match(outcomes,/sd==='BUY'\?\(cp-px\(t\)\)\*qty\(t\):\(px\(t\)-cp\)\*qty\(t\)/);
  assert.doesNotMatch(outcomes,/pending:age<7/);
  assert.doesNotMatch(outcomes,/기회손익 \$\{x\.pending\?/);
  assert.match(outcomes,/매수=\(현재가−매수가\)×수량/);
  assert.match(outcomes,/개별 체결 수량만 반영/);
});

test('only one canonical trade review is rendered',()=>{
  assert.match(outcomes,/<div class="ctO26Title">매매복기<\/div>/);
  assert.match(grouped,/state:'SUPERSEDED'/);
  assert.match(grouped,/owner:'trade-review-outcomes-v26'/);
  const run=grouped.match(/function run\(\)\{[\s\S]*?\n\}/)?.[0]||'';
  assert.doesNotMatch(run,/\brender\(\)/);
});


test('compact PB dates are parsed before recent sorting',()=>{
  assert.match(outcomes,/function tradeTs\(t\)/);
  assert.match(outcomes,/raw\.match\(\/\^\(\\d\{2\}\)\(\\d\{2\}\)\(\\d\{2\}\)/);
  assert.match(outcomes,/raw\.match\(\/\^\(\\d\{4\}\)\(\\d\{2\}\)\(\\d\{2\}\)/);
  assert.match(outcomes,/const dt=tradeTs\(t\)/);
});


test('trade-review sign is favorable-positive for both sides',()=>{
  assert.match(outcomes,/현재 수익 · 매수가보다 상승/);
  assert.match(outcomes,/현재 손실 · 매수가보다 하락/);
  assert.match(outcomes,/회피손실 · 매도 후 하락/);
  assert.match(outcomes,/기회손실 · 매도 후 상승/);
  assert.match(outcomes,/복기손익 합계/);
});


test('post-trade horizon buttons use historical basis without current-price substitution',()=>{
  for(const label of ['현재','5영업일','10영업일','1개월','6개월']){
    assert.match(outcomes,new RegExp(label));
  }
  assert.match(outcomes,/data-horizon-v26/);
  assert.match(outcomes,/trade_review_horizons/);
  assert.match(outcomes,/b\.state==='PENDING'/);
  assert.match(outcomes,/sd==='BUY'\?\(cp-entry\)\*qty\(t\):\(entry-cp\)\*qty\(t\)/);
  assert.match(outcomes,/해당 기준가가 확정된 거래만 반영/);
});
