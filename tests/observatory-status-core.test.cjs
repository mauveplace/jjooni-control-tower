const {test}=require('node:test'),assert=require('node:assert/strict');
const {ORDER,evaluate,effective}=require('../market-observatory/freshness-core-v1.js');
const now=Date.parse('2026-10-27T12:00:00+09:00'),iso=x=>new Date(x).toISOString();
const status=(age=0)=>({generated_kst:iso(now-age*1000),overall:'LIVE',groups:Object.fromEntries(ORDER.map(key=>[key,key==='crypto'?{state:'LIVE',quotes:{BTCUSD:{status:'LIVE',quote_as_of_kst:iso(now)},ETHUSD:{status:'LIVE',quote_as_of_kst:iso(now)}}}:key==='market_regime'?{state:'LIVE',consensus_status:'CLOSED',valid_until_kst:iso(now+3600000)}:{state:key==='audit'?'PASS':'LIVE',critical:['market','audit'].includes(key)}]))});
test('expired status cannot endorse current LIVE while completed-session date stays intact',()=>{
 const s=status(7201);s.groups.market.as_of='2026-10-26';const m=evaluate(s,{},now);
 assert.equal(m.overall,'STATUS_STALE');assert.equal(m.groups.market.state,'CHECK_REQUIRED');assert.equal(m.groups.market.reported_state,'LIVE');assert.equal(m.groups.market.as_of,'2026-10-26');assert.equal(s.groups.market.state,'LIVE');
 assert.equal(evaluate(status(7200),{},now).overall,'LIVE');
});
test('missing or future metadata, empty groups and fetch failures never produce a green current verdict',()=>{
 assert.equal(evaluate({},null,now).overall,'UNKNOWN');
 assert.equal(evaluate({...status(),generated_kst:iso(now+120000)},null,now).overall,'UNKNOWN');
 assert.equal(evaluate({...status(),groups:{}},null,now).overall,'UNKNOWN');
 assert.equal(evaluate(status(),{},now,['offline']).overall,'LIVE_WITH_WARNINGS');
 assert.equal(evaluate({...status(),overall:'DEGRADED'},null,now).overall,'DEGRADED');
 const missing=status();delete missing.groups.market;assert.equal(evaluate(missing,null,now).overall,'DEGRADED');
});
test('current group warnings downgrade an already-warned or originally green headline consistently',()=>{
 const s=status();s.groups.crypto={state:'LIVE',quotes:{BTCUSD:{status:'LIVE',quote_as_of_kst:iso(now-4000000)},ETHUSD:{status:'LIVE',quote_as_of_kst:iso(now)}}};
 s.groups.market_regime={state:'LIVE',consensus_status:'CLOSED',as_of:iso(now-1),informational:true};s.overall='LIVE_WITH_WARNINGS';
 const m=evaluate(s,{},now);assert.equal(m.overall,'LIVE_WITH_WARNINGS');assert.equal(m.groups.crypto.state,'STALE');assert.equal(m.groups.market_regime.state,'EXPIRED');assert.equal(m.issues.length,1);
});
test('expired weekly analyst reference never downgrades healthy market data',()=>{
 const s=status();s.groups.market_regime={state:'LIVE',consensus_status:'CLOSED',valid_from_kst:iso(now-3600000),valid_until_kst:iso(now-1000),informational:true,monitoring_scope:'INVESTMENT_BOARD_REFERENCE_ONLY'};
 const m=evaluate(s,{},now);
 assert.equal(m.groups.market_regime.state,'EXPIRED');
 assert.equal(m.issues.length,0);
 assert.equal(m.overall,'LIVE');
});
test('watchdog evidence remains a historical close check rather than permanent current health',()=>{
 const w={result:'HEALTHY_NOOP',checked_kst:iso(now-12*3600000)};
 const m=evaluate(status(),w,now);assert.equal(m.watchdog.state,'HISTORICAL_CHECK');assert.equal(m.watchdog.reported_result,'HEALTHY_NOOP');assert.equal(m.watchdog.scope,'US_CLOSE_RECOVERY_ONLY');
 assert.equal(evaluate(status(),{...w,next_check_due_kst:iso(now-1)},now).watchdog.state,'CHECK_OVERDUE');
});
test('regime starts, ends and malformed intervals are checked without upgrading unpublished guidance',()=>{
 assert.equal(effective('market_regime',{state:'LIVE',valid_from_kst:iso(now+1),valid_until_kst:iso(now+100)},now).state,'PENDING');
 assert.equal(effective('market_regime',{state:'LIVE',valid_from_kst:iso(now+100),valid_until_kst:iso(now+1)},now).state,'UNAVAILABLE');
 assert.equal(effective('market_regime',{state:'LIVE',consensus_status:'CLOSED',as_of:iso(now)},now).state,'LIVE');
 assert.equal(effective('market_regime',{state:'PENDING',consensus_status:'CLOSED',valid_from_kst:iso(now-100),valid_until_kst:iso(now+100)},now).state,'PENDING');
 assert.equal(effective('market_regime',{state:'LIVE',consensus_status:'PARTIAL_PENDING_JJANGGU',valid_until_kst:iso(now+100)},now).state,'PROVISIONAL');
 assert.equal(effective('market_regime',{state:'LIVE',valid_until_kst:iso(now+100)},now).state,'UNAVAILABLE');
});

test('freshly published status cannot misreport Friday as LIVE after Monday close',()=>{
 const original=global.window;
 try{
  global.window={JjooniTripodCore:require('../market-observatory/jjooni-tripod-v1.js')};
  const before=Date.parse('2026-11-16T21:14:00Z');
  const after=Date.parse('2026-11-16T21:26:00Z');
  const s=status();
  s.generated_kst=new Date(after-30000).toISOString();
  for(const k of ['market','pulse','tripod'])s.groups[k]={state:'LIVE',critical:true,as_of:'2026-11-13'};
  assert.equal(evaluate(s,{},before).groups.market.state,'LIVE');
  const m=evaluate(s,{},after);
  for(const k of ['market','pulse','tripod']){
   assert.equal(m.groups[k].state,'STALE');
   assert.equal(m.groups[k].reported_state,'LIVE');
  }
  assert.equal(m.overall,'DEGRADED');
  for(const k of ['market','pulse','tripod'])s.groups[k].as_of='2026-11-16';
  assert.equal(evaluate(s,{},after).groups.market.state,'LIVE');
 }finally{
  if(original===undefined)delete global.window; else global.window=original;
 }
});
