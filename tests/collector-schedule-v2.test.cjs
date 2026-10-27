'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {evaluate}=require('../market-observatory/collector-schedule-core-v2.js');
const now=Date.parse('2026-10-27T12:00:00Z'),at=minutes=>new Date(now-minutes*60000).toISOString();
const run=(minutes,result='success')=>({event:'schedule',created_at:at(minutes),status:'completed',conclusion:result,id:123});
const status=(statusAge,marketAge)=>({generated_kst:at(statusAge),groups:{market:{generated_kst:at(marketAge)}}});
test('schedule gap remains distinct from a recently generated market file',()=>{
 const out=evaluate([run(160)],status(10,20),now);assert.equal(out.state,'SCHEDULE_GAP');assert.equal(out.market_check,'RECENT_ASSESSMENT');
});
test('failed, absent and future scheduled runs cannot claim observed success',()=>{
 assert.equal(evaluate([run(10,'failure')],status(0,0),now).state,'SCHEDULE_FAILED');
 assert.equal(evaluate([],status(0,0),now).state,'UNVERIFIED');
 assert.equal(evaluate([run(-5)],status(0,0),now).state,'UNVERIFIED');
});
test('stale or missing status cannot verify a current market assessment',()=>{
 assert.equal(evaluate([run(10)],status(121,10),now).market_check,'UNVERIFIED');
 assert.equal(evaluate([run(10)],{},now).market_check,'UNVERIFIED');
 assert.equal(evaluate([run(10)],status(1,91),now).market_check,'CHECK_REQUIRED');
});
test('other workflow events cannot substitute a scheduled run',()=>{
 assert.equal(evaluate([{...run(1),event:'push'}],status(0,0),now).state,'UNVERIFIED');
});
