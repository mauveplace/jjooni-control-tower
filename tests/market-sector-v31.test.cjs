const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');

const src=fs.readFileSync('consultant-tab-hotfix-v31.js','utf8');
const daily=fs.readFileSync('tripod-daily-freshness-v35.js','utf8');
const sidecar=fs.readFileSync('public-market-sidecar-v36.js','utf8');
const metrics=fs.readFileSync('canonical-metrics.js','utf8');

test('market-sector, sidecar and TRI-POD guard scripts are valid JavaScript',()=>{
  for(const file of ['consultant-tab-hotfix-v31.js','tripod-daily-freshness-v35.js','public-market-sidecar-v36.js','canonical-metrics.js']){
    execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
  }
});

test('public market, VIX authority and daily freshness guards are always bootstrapped',()=>{
  assert.match(metrics,/__JJOONI_PUBLIC_MARKET_SIDECAR_BOOTSTRAPPED/);
  assert.match(metrics,/public-market-sidecar-v36\.js\?v=36\.0/);
  assert.match(metrics,/__JJOONI_TRIPOD_VIX_AUTHORITY_BOOTSTRAPPED/);
  assert.match(metrics,/consultant-tab-hotfix-v31\.js\?v=31\.6/);
  assert.match(metrics,/__JJOONI_TRIPOD_DAILY_GUARD_BOOTSTRAPPED/);
  assert.match(metrics,/tripod-daily-freshness-v35\.js\?v=35\.1/);
});

test('public sidecar is read-only market-only data with freshness validation',()=>{
  assert.match(sidecar,/JJOONI_PUBLIC_MARKET_DAILY_V1/);
  assert.match(sidecar,/d\.read_only!==true/);
  assert.match(sidecar,/d\.contains_account_data!==false/);
  assert.match(sidecar,/age>=0&&age<=4/);
  assert.match(sidecar,/jjooni:public-market-loaded/);
});

test('market-sector board includes Nasdaq Composite and Brent crude',()=>{
  assert.match(src,/\['NASDAQCOMP','NASDAQ 종합'\]/);
  assert.match(src,/\['BRENT','브렌트유'\]/);
  assert.match(src,/key==='WTI'\|\|key==='BRENT'/);
});

test('public daily values fill blanks but valid LIVE values keep priority',()=>{
  assert.match(src,/__JJOONI_PUBLIC_MARKET_DAILY/);
  assert.match(src,/const safeFallback=mergeRecord\(ci\[key\],pi\[key\]\)/);
  assert.match(src,/items\[key\]=mergeRecord\(safeFallback,li\[key\]\)/);
  assert.match(src,/YAHOO_PUBLIC_DAILY/);
});

test('TRI-POD distinguishes current VIX from 10-day strategy average',()=>{
  assert.match(daily,/VIX 최근 완료 일봉/);
  assert.match(daily,/VIX 10일 평균 · 전략 입력/);
  assert.match(daily,/LAST_10_DAILY_CLOSES_ARITHMETIC_MEAN/);
});

test('stale historical TRI-POD card is quarantined instead of presented as today',()=>{
  assert.match(daily,/data-ct-tripod-daily-quarantine/);
  assert.match(daily,/STALE BLOCKED/);
  assert.match(daily,/구형 정적 판단화면은 안전을 위해 숨겼습니다/);
  assert.match(daily,/age>4/);
});

test('daily TRI-POD trusts only verified FAST or isolated public daily authority',()=>{
  assert.match(daily,/PUBLIC_MARKET_DAILY_V1/);
  assert.match(daily,/YAHOO_RULE_ENGINE_FAST_V31/);
  assert.match(daily,/NDX_VIX_SAME_COMPLETED_SESSION/);
  assert.match(daily,/jjooni:public-market-loaded/);
});

test('verified daily TRI-POD surface contains complete decision inputs',()=>{
  assert.match(daily,/VERIFIED DAILY/);
  assert.match(daily,/CURRENT REGIME/);
  assert.match(daily,/TARGET EXPOSURE/);
  assert.match(daily,/TODAY ACTION/);
  assert.match(daily,/NASDAQ-100 \/ MA250/);
  assert.match(daily,/VIX 10일 평균 · 전략 입력/);
  assert.match(daily,/52주 고점 대비 낙폭/);
  assert.match(daily,/PUBLIC DAILY/);
});