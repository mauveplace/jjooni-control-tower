'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const core=require('../market-observatory/collector-schedule-core-v1.js');
const now=Date.parse('2026-10-27T10:45:00Z');
const scheduled=(created_at,conclusion='success')=>[{id:123,event:'schedule',status:'completed',conclusion,created_at,html_url:'https://github.com/mauveplace/jjooni-control-tower/actions/runs/123'}];
test('recent scheduled run is observed, not proof of market data LIVE',()=>{
  const s=core.evaluate(scheduled('2026-10-27T10:30:00Z'),{generated_kst:'2026-10-27T10:00:00Z'},now);
  assert.equal(s.state,'SCHEDULE_OBSERVED');assert.equal(s.recovery_due,false);
});
test('missing scheduled run is SCHEDULE_GAP even with fresh push producer',()=>{
  const s=core.evaluate(scheduled('2026-10-27T07:59:25Z'),{generated_kst:'2026-10-27T10:10:52Z'},now);
  assert.equal(s.state,'SCHEDULE_GAP');assert.equal(s.recovery_due,false);
});
test('gap and stale producer separately signal RECOVERY_DUE',()=>{
  const s=core.evaluate(scheduled('2026-10-27T07:59:25Z'),{generated_kst:'2026-10-27T08:00:00Z'},now);
  assert.equal(s.state,'SCHEDULE_GAP');assert.equal(s.recovery_due,true);
});
test('recent failed schedule does not turn green',()=>{
  const s=core.evaluate(scheduled('2026-10-27T10:30:00Z','failure'),{},now);
  assert.equal(s.state,'SCHEDULE_FAILED');
});
test('no GitHub evidence is UNVERIFIED rather than healthy',()=>{
  assert.equal(core.evaluate([],{},now).state,'UNVERIFIED');
});
test('workflow-run and push events cannot substitute scheduled runs',()=>{
  const r=[{event:'push',created_at:'2026-10-27T10:44:00Z',conclusion:'success'}];
  assert.equal(core.evaluate(r,{},now).state,'UNVERIFIED');
});
test('future and malformed producer timestamps never claim fresh producer',()=>{
  const s=core.evaluate(scheduled('2026-10-27T07:59:25Z'),{generated_kst:'not a time'},now);
  assert.equal(s.state,'SCHEDULE_GAP');assert.equal(s.recovery_due,true);
});
