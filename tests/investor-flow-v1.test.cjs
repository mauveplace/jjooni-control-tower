const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');

const src=fs.readFileSync('investor-flow-v1.js','utf8');
const metrics=fs.readFileSync('canonical-metrics.js','utf8');

test('investor flow surface is valid JavaScript',()=>{
  execFileSync(process.execPath,['--check','investor-flow-v1.js'],{stdio:'pipe'});
});

test('market-wide and per-stock flow are separate authorities',()=>{
  assert.match(src,/kr_market_investor_flow/);
  assert.match(src,/kr_intraday_investor_flow/);
  assert.match(src,/MARKET_WIDE_NEVER_SUM_STOCK_ESTIMATE/);
  assert.doesNotMatch(src,/foreign_net_amount\s*\+\s*.*foreign_estimated_net_qty/);
});

test('stock flow shows official KIS cumulative slots and deltas',()=>{
  for(const stamp of ['09:30','10:00','11:20','13:20','14:30']) assert.match(src,new RegExp(stamp.replace(':','\\:')));
  assert.match(src,/foreign_delta|fd/);
  assert.match(src,/Δ직전수집/);
});

test('surface consumes server-side conservative regime result',()=>{
  assert.match(src,/kr_investor_flow_consumer/);
  assert.match(src,/trend_reversal_confirmed/);
  assert.match(src,/외국인 시장전체 순매수 하나만으로 추세전환을 선언하지 않습니다/);
});

test('canonical metrics bootstraps investor flow surface',()=>{
  assert.match(metrics,/__JJOONI_INVESTOR_FLOW_BOOTSTRAPPED/);
  assert.match(metrics,/investor-flow-v1\.js\?v=1\.0/);
});
