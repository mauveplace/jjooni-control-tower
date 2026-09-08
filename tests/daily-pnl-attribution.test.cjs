const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const src=fs.readFileSync(path.join(__dirname,'../daily-pnl-attribution-v27.js'),'utf8');
const alias=fs.readFileSync(path.join(__dirname,'../daily-performance-alias-v23.js'),'utf8');

test('daily position attribution is loss-first and reconciles to account PnL',()=>{
  assert.match(src,/version:'27\.0'/);
  assert.match(src,/JjooniMetrics\?\.positionDay/);
  assert.match(src,/return x\.day-y\.day/);
  assert.match(src,/bridge=acct!=null&&known\.length\?acct-knownSum:null/);
  assert.match(src,/오늘 종목별 손익 · 많이 빠진 순/);
  assert.match(src,/▼ 오늘 빠진 종목/);
  assert.match(src,/매매·수수료·미확인 Bridge/);
  assert.match(src,/0원으로 임의 대체하지 않습니다/);
});

test('misleading zero price FX legacy cards are hidden and v27 is loaded by verified daily module chain',()=>{
  assert.match(src,/종목별 주가·환율 기여도/);
  assert.match(src,/종목 기준 당일 가격효과/);
  assert.match(alias,/daily-pnl-attribution-v27\.js\?v=27\.0/);
  assert.match(alias,/__JJOONI_DAILY_PNL_ATTR_LOADER_V27/);
});
