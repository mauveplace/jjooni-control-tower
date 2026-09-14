const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('encrypted shell keeps canonical metrics before the legacy loader',()=>{
  const index=read('index.html');
  const canonical=index.indexOf('canonical-metrics.js?v=33.1');
  const legacy=index.indexOf('trade-review-loader.js?v=14.22');
  assert.ok(canonical>=0,'canonical-metrics.js missing from decrypted postfix');
  assert.ok(legacy>=0,'trade-review-loader.js missing from decrypted postfix');
  assert.ok(canonical<legacy,'canonical metrics must install the deferred boot hold before legacy loader');
});

test('canonical bootstrap owns verified boot and fast refresh bootstrap',()=>{
  const canonical=read('canonical-metrics.js');
  assert.match(canonical,/__JJOONI_BOOT_COORDINATOR_BOOTSTRAPPED/);
  assert.match(canonical,/boot-coordinator-v33\.js/);
  assert.match(canonical,/__JJOONI_CT_FAST_BOOTSTRAPPED/);
  assert.match(canonical,/fast-refresh-v32\.js/);
});

test('verified boot releases exactly one UI loader after SSOT and lineage are ready',()=>{
  const boot=read('boot-coordinator-v33.js');
  assert.match(boot,/function verifiedReady\(\)\{return factsReady\(\)&&lineageReady\(\)\}/);
  assert.match(boot,/if\(S\.state==='UI_LOADING'\|\|S\.state==='ACTIVE'\|\|S\.state==='UI_LOADER_STARTED'\)return/);
  assert.match(boot,/trade-review-loader\.js\?v=14\.20-v33\.2/);
  assert.match(boot,/window\.__JJOONI_LIVE_READY=true/);
});

test('UI loader still requires detail-authority runtimes before showing the dashboard',()=>{
  const loader=read('trade-review-loader.js');
  assert.match(loader,/__JJOONI_SOURCE_AUTHORITY_V24\?\.state==='ACTIVE'/);
  assert.match(loader,/__JJOONI_POSITION_COMPLETENESS_V25\?\.state==='ACTIVE'/);
  assert.match(loader,/startsWith\('25\.1'\)/);
  assert.match(loader,/__JJOONI_TRADE_OUTCOMES_V26\?\.state==='ACTIVE'/);
  assert.match(loader,/__JJOONI_CT_FAST\?\.version==='1\.7'/);
  assert.match(loader,/REQUIRED_DETAIL_RUNTIME_MISSING/);
});

test('UI module optimization preloads downloads but preserves sequential execution',()=>{
  const loader=read('trade-review-loader.js');
  assert.match(loader,/function bootUrl\(src\)/);
  assert.match(loader,/function preloadModules\(modules\)/);
  assert.match(loader,/l\.rel='preload';l\.as='script';l\.href=bootUrl\(src\)/);
  const preload=loader.indexOf('preloadModules(modules);');
  const sequential=loader.indexOf("for(const [id,src,label] of modules){bootText('필수 모듈 확인 · '+label);await loadRequired(id,src,label)}");
  assert.ok(preload>=0,'module preloading must be enabled');
  assert.ok(sequential>preload,'required modules must still execute sequentially after preload starts');
  assert.match(loader,/s\.src=bootUrl\(src\)/);
});
