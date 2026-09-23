const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');

const src=fs.readFileSync('live-bridge.js','utf8');

test('live bridge remains valid JavaScript',()=>{
  execFileSync(process.execPath,['--check','live-bridge.js'],{stdio:'pipe'});
});

test('overview current total asset is pinned to six-account canonical NAV',()=>{
  assert.match(src,/function updateOverviewTotalNav\(/);
  assert.match(src,/CANON\.total\.nav/);
  assert.match(src,/현재 총자산 \(6계좌 NAV\)/);
  assert.match(src,/account_count:REGISTRY\.length/);
});

test('overview NAV guard reruns after overview DOM rerenders',()=>{
  assert.match(src,/MutationObserver/);
  assert.match(src,/queueOverviewTotalNav/);
  assert.match(src,/closest\('#panel-overview'\)/);
});

test('canonical browser bridge still sums all registry accounts before rendering',()=>{
  assert.match(src,/const t=M\.aggregate\(out\),rows=REGISTRY\.map/);
  assert.match(src,/return \{snapshot_id:live\.snapshot_id/);
  assert.match(src,/account_count:REGISTRY\.length/);
});

test('account detail cards remain separate from overview total patch',()=>{
  assert.match(src,/if\(e\.closest&&e\.closest\('\.ctAcct'\)\)return false/);
});
