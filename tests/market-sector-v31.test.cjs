const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const src=fs.readFileSync('consultant-tab-hotfix-v31.js','utf8');

test('market-sector board includes Nasdaq Composite and Brent crude',()=>{
  assert.match(src,/\['NASDAQCOMP','NASDAQ 종합'\]/);
  assert.match(src,/\['BRENT','브렌트유'\]/);
  assert.match(src,/key==='WTI'\|\|key==='BRENT'/);
});

test('TRI-POD distinguishes current VIX from 10-day strategy average',()=>{
  assert.match(src,/VIX 현물\/최근값/);
  assert.match(src,/VIX 10일 평균 · 전략 입력/);
  assert.match(src,/LAST_10_DAILY_CLOSES_ARITHMETIC_MEAN|vix10/);
  assert.match(src,/YAHOO_RULE_ENGINE_FAST_V31|sig\.source/);
});

test('partial LIVE market payload cannot blank valid canonical values',()=>{
  assert.match(src,/function mergeRecord\(c,l\)/);
  assert.match(src,/if\(hasValue\(L\)\)return \{\.\.\.C,\.\.\.L\}/);
  assert.match(src,/if\(hasValue\(C\)\)return \{\.\.\.L,\.\.\.C\}/);
});
