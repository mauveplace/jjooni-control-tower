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
  assert.match(outcomes,/const op=cp!==null\?\(px\(t\)-cp\)\*qty\(t\):null/);
  assert.doesNotMatch(outcomes,/pending:age<7/);
  assert.doesNotMatch(outcomes,/기회손익 \$\{x\.pending\?/);
  assert.match(outcomes,/당일 거래도 현재가가 있으면 즉시 계산/);
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
