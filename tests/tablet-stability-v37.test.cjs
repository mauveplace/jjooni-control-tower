const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const live=fs.readFileSync('live-bridge.js','utf8');
const tablet=fs.readFileSync('tablet-runtime-v8.js','utf8');
const accounts=fs.readFileSync('tablet-accounts-v8.js','utf8');
const drill=fs.readFileSync('metric-drilldown-router-v12.js','utf8');
const loader=fs.readFileSync('trade-review-loader.js','utf8');
const guard=fs.readFileSync('tablet-stability-v37.js','utf8');
const trade=fs.readFileSync('trade-review-v2.js','utf8');

test('tablet stability scripts parse',()=>{
  for(const f of ['live-bridge.js','tablet-runtime-v8.js','tablet-accounts-v8.js','metric-drilldown-router-v12.js','trade-review-loader.js','tablet-stability-v37.js','trade-review-v2.js'])execFileSync(process.execPath,['--check',f]);
});

test('fresh ticker-only rows preserve legacy Korean names',()=>{
  assert.match(live,/function legacyName\(id,ticker\)/);
  assert.match(live,/name:t\.name\|\|nm/);
  assert.match(live,/stock_name:t\.stock_name\|\|nm/);
  assert.match(live,/sym\(t\.ticker\|\|t\.symbol\)/);
});

test('metric drilldown fails open when modal host is unavailable',()=>{
  const host=drill.indexOf("typeof window.openMetricInfo!=='function'");
  const stop=drill.indexOf('e.preventDefault()',host);
  assert.ok(host>0);
  assert.ok(stop>host,'active drilldown preventDefault must occur after openMetricInfo availability check');
  assert.match(drill,/OPEN_METRIC_INFO_MISSING/);
});

test('desktop replacement panels cannot take over touch tablet',()=>{
  assert.match(tablet,/innerWidth>=1200&&window\.matchMedia\('\(hover:hover\) and \(pointer:fine\)'\)\.matches/);
  assert.match(accounts,/innerWidth>=1200&&window\.matchMedia\('\(hover:hover\) and \(pointer:fine\)'\)\.matches/);
});

test('touch tablet keeps interactive trade review instead of reverting to legacy history',()=>{
  assert.match(trade,/const touchTablet=/);
  assert.match(trade,/if\(window\.innerWidth>767&&!touchTablet\(\)\)\{restoreLegacy\(panel\);return\}/);
  assert.match(trade,/실현손익/);
  assert.match(trade,/평가손익/);
  assert.match(trade,/실현\+평가/);
});

test('tablet readability and navigation guard is loaded',()=>{
  assert.match(loader,/tablet-stability-v37\.js\?v=37\.0/);
  assert.match(guard,/ctStableTabletV37/);
  assert.match(guard,/font-size:20px!important/);
  assert.match(guard,/font-size:16px!important/);
  assert.match(guard,/min-height:44px/);
  assert.match(guard,/function forceTab\(name\)/);
  assert.match(guard,/ctConsultantHidden/);
  assert.match(guard,/\.ctTicker\.open \.ctTickerBody\{display:block!important\}/);
  assert.match(guard,/\.ctSleeve\.open \.ctSleeveDetail\{display:block!important\}/);
});