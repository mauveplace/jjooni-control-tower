const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');

test('live bridge prefers both DEEP and FAST six-account total NAV authorities',()=>{
 const s=fs.readFileSync('live-bridge.js','utf8');
 assert.match(s,/producerTotalSource==='ACCOUNT_SUM_6'/);
 assert.match(s,/authoritativeTotal=producerTotal!=null&&producerTotalSource==='ACCOUNT_SUM_6'\?producerTotal:accountSum/);
 assert.match(s,/nav:authoritativeTotal/);
 assert.match(s,/PRODUCER_ACCOUNT_SUM_6/);
});

test('mobile total card independently honors producer six-account NAV',()=>{
 const s=fs.readFileSync('mobile-stability-v4.js','utf8');
 assert.match(s,/L\.total_nav\?\?L\.total_nav_krw/);
 assert.match(s,/FAST_EFFECTIVE_SUM_6_ACCOUNT_NAV/);
 assert.match(s,/data-nav-authority|navAuthority/);
 assert.match(s,/총자산/);
});

test('runtime files remain valid JavaScript',()=>{
 execFileSync(process.execPath,['--check','live-bridge.js'],{stdio:'pipe'});
 execFileSync(process.execPath,['--check','mobile-stability-v4.js'],{stdio:'pipe'});
});
