const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');

const src=fs.readFileSync('consultant-tab-hotfix-v31.js','utf8');

test('market-sector hotfix is valid JavaScript',()=>{
  execFileSync(process.execPath,['--check','consultant-tab-hotfix-v31.js'],{stdio:'pipe'});
});

test('market-sector board includes Nasdaq Composite and Brent crude',()=>{
  assert.match(src,/\['NASDAQCOMP','NASDAQ 종합'\]/);
  assert.match(src,/\['BRENT','브렌트유'\]/);
  assert.match(src,/key==='WTI'\|\|key==='BRENT'/);
});

test('TRI-POD distinguishes current VIX from 10-day strategy average',()=>{
  assert.match(src,/VIX 현물\/최근값/);
  assert.match(src,/VIX 10일 평균 · 전략 입력/);
  assert.match(src,/LAST_10_DAILY_CLOSES_ARITHMETIC_MEAN/);
  assert.match(src,/YAHOO_RULE_ENGINE_FAST_V31/);
});

test('legacy TRI-POD VIX10 is blocked until FAST V31 authority arrives',()=>{
  assert.match(src,/function signalIsAuthoritative\(sig\)/);
  assert.match(src,/String\(sig\.source\|\|'\'\)==='YAHOO_RULE_ENGINE_FAST_V31'/);
  assert.match(src,/STALE SIGNAL BLOCKED/);
  assert.match(src,/rewriteLegacyTripodVix\(panel,'갱신 대기'\)/);
});

test('partial LIVE market payload cannot blank valid canonical values',()=>{
  assert.match(src,/function mergeRecord\(c,l\)/);
  assert.match(src,/if\(hasValue\(L\)\)return \{\.\.\.C,\.\.\.L\}/);
  assert.match(src,/if\(hasValue\(C\)\)return \{\.\.\.L,\.\.\.C\}/);
});
