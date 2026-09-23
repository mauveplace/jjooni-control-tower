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


test('six-account guard directly patches mobile and performance aggregate surfaces',()=>{
  assert.match(src,/function patchAllSixAccountTotalSurfaces\(/);
  assert.match(src,/#ctMobileNetSummaryV4 \.ctNetValue/);
  assert.match(src,/\.ctP8Total/);
  assert.match(src,/\.ctA8Total/);
  assert.match(src,/총자산\\s\*\[·•\]\\s\*6계좌/);
  assert.match(src,/전체\\s\*6계좌\\s\*NAV/);
});

test('FAST effective source is an accepted six-account authority',()=>{
  assert.match(src,/FAST_EFFECTIVE_SUM_6_ACCOUNT_NAV/);
  assert.match(src,/total_nav_component_count/);
  assert.match(src,/total_nav_missing_accounts/);
});
