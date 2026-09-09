const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const src=fs.readFileSync(path.join(__dirname,'..','watchlist-bridge.js'),'utf8');

test('1D current return is gated by quote_live',()=>{
  assert.match(src,/function isLive\(x\)/);
  assert.match(src,/SORT==='day_return_pct'\)return isLive\(x\)\?n\(x\.day_return_pct\):null/);
  assert.match(src,/metricValue\(x,key\)/);
});

test('non-live radar prices are labelled as reference values',()=>{
  assert.match(src,/reference_price\?\?x\?\.current_price/);
  assert.match(src,/const label=live!=null\?'현재':'기준'/);
  assert.match(src,/기준값 ·/);
  assert.match(src,/현재시세 미확인/);
});

test('1D sorting puts verified live quotes ahead of reference-only rows',()=>{
  assert.match(src,/Number\(isLive\(b\)\)-Number\(isLive\(a\)\)/);
  assert.match(src,/검증 현재시세/);
});
