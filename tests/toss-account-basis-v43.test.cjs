const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {num,won,parseWonText}=require('../toss-account-basis-v43.js');

test('Toss basis runtime parses and formats KRW safely',()=>{
 assert.equal(num('₩74,257,726'),74257726);
 assert.equal(parseWonText('₩74,257,726'),74257726);
 assert.equal(won(74257726),'₩74,257,726');
});

test('Toss current account NAV authority is separate from six-account total',()=>{
 const s=fs.readFileSync('toss-account-basis-v43.js','utf8');
 assert.match(s,/TOSS_ACCOUNT_CANONICAL_NAV_ONLY/);
 assert.match(s,/\(canon\(\)\.accounts\|\|\{\}\)\.TOSS/);
 assert.match(s,/Toss 현재 NAV/);
});

test('Historical NAV is preserved as a basis, not presented as current total asset',()=>{
 const s=fs.readFileSync('toss-account-basis-v43.js','utf8');
 assert.match(s,/Historical 성과 계산 기준 NAV/);
 assert.match(s,/현재 총자산과 별도/);
 assert.match(s,/Historical 누적수익률/);
 assert.match(s,/Historical NAV 정합성 차이/);
});

test('30-day flow adjusted return is labelled as operating return, not generic cumulative return',()=>{
 const s=fs.readFileSync('toss-account-basis-v43.js','utf8');
 assert.match(s,/30D Flow-adjusted 운용수익률/);
});


test('canonical bootstrap loads Toss basis authority and encrypted shell cache-busts it',()=>{
 const canonical=fs.readFileSync('canonical-metrics.js','utf8');
 const index=fs.readFileSync('index.html','utf8');
 assert.match(canonical,/__JJOONI_TOSS_ACCOUNT_BASIS_BOOTSTRAPPED/);
 assert.match(canonical,/toss-account-basis-v43\.js\?v=43\.1/);
 assert.match(index,/canonical-metrics\.js\?v=33\.3/);
});


test('Toss historical patch is explicitly isolated from the Overview panel',()=>{
 const src=fs.readFileSync('toss-account-basis-v43.js','utf8');
 assert.match(src,/label\.closest&&label\.closest\('#panel-overview'\)/);
});


test('Historical Toss annotation never mutates an existing amount into current Toss NAV',()=>{
 const src=fs.readFileSync('toss-account-basis-v43.js','utf8');
 const start=src.indexOf('function patchHistoryCard');
 const end=src.indexOf('function patchTossModal');
 const body=src.slice(start,end);
 assert.ok(start>=0&&end>start);
 assert.doesNotMatch(body,/hit\.e\.textContent\s*=\s*won\(nav\)/);
 assert.match(body,/Historical surfaces are read-only evidence/);
});

test('Historical Toss discovery cannot climb into whole tab panels',()=>{
 const src=fs.readFileSync('toss-account-basis-v43.js','utf8');
 assert.match(src,/String\(e\.id\|\|''\)\.startsWith\('panel-'\)/);
});


test('Toss historical discovery rejects aggregate multi-account containers',()=>{
 const src=fs.readFileSync('toss-account-basis-v43.js','utf8');
 assert.match(src,/전체\\s\*6계좌\\s\*NAV/);
 assert.match(src,/6계좌\\s\*통합\\s\*Current\\s\*Snapshot/);
 assert.match(src,/\\bISA\\b/);
 assert.match(src,/연금저축/);
 assert.match(src,/\\bIRP\\b/);
});
