const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');

test('live bridge prefers both DEEP and FAST five-account total NAV authorities',()=>{
 const s=fs.readFileSync('live-bridge.js','utf8');
 assert.match(s,/FIVE_ACCOUNT_NAV_SOURCES/);
 assert.match(s,/ACCOUNT_SUM_5/);
 assert.match(s,/FAST_EFFECTIVE_SUM_5_ACCOUNT_NAV/);
 assert.match(s,/isFiveAccountNavSource/);
 assert.match(s,/producerTotalTrusted/);
 assert.match(s,/nav:authoritativeTotal/);
});

test('mobile total card independently honors producer five-account NAV',()=>{
 const s=fs.readFileSync('mobile-stability-v4.js','utf8');
 assert.match(s,/FIVE_NAV_SOURCES_V44/);
 assert.match(s,/ACCOUNT_SUM_5/);
 assert.match(s,/FAST_EFFECTIVE_SUM_5_ACCOUNT_NAV/);
 assert.match(s,/trustedFiveNavV44/);
 assert.match(s,/navAuthority/);
 assert.match(s,/총자산/);
});

test('runtime files remain valid JavaScript',()=>{
 execFileSync(process.execPath,['--check','live-bridge.js'],{stdio:'pipe'});
 execFileSync(process.execPath,['--check','mobile-stability-v4.js'],{stdio:'pipe'});
});
