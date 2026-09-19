const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {num,won,parseWonText}=require('../toss-account-basis-v43.js');

test('Toss basis runtime parses and formats KRW safely',()=>{
 assert.equal(num('₩74,257,726'),74257726);
 assert.equal(parseWonText('₩74,257,726'),74257726);
 assert.equal(won(74257726),'₩74,257,726');
});

test('Toss current total asset authority is canonical overview NAV',()=>{
 const s=fs.readFileSync('toss-account-basis-v43.js','utf8');
 assert.match(s,/CT_OVERVIEW_CANONICAL_TOSS_NAV/);
 assert.match(s,/\(canon\(\)\.accounts\|\|\{\}\)\.TOSS/);
 assert.match(s,/현재 총자산/);
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
 assert.match(canonical,/toss-account-basis-v43\.js\?v=43\.0/);
 assert.match(index,/canonical-metrics\.js\?v=33\.3/);
});
