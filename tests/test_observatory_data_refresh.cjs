const test=require('node:test');
const assert=require('node:assert/strict');
const {selectRun,stateFor,RUN_URL}=require('../market-observatory/data-refresh-v1.js');
const started=Date.parse('2026-10-14T21:00:00Z');
const run={id:42,event:'workflow_dispatch',head_branch:'main',created_at:'2026-10-14T21:00:10Z',status:'in_progress'};
test('opening GitHub is only waiting, never reports collection started',()=>{
  assert.equal(stateFor(null,null).state,'WAITING');
  assert.match(RUN_URL,/actions\/workflows\/market-observatory-supplemental-freshness.yml$/);
});
test('only manual main runs created after the request are selected',()=>{
  assert.equal(selectRun([{...run,id:1,event:'schedule'},{...run,id:2,head_branch:'feature'},{...run,id:3,created_at:'2026-10-14T20:59:59Z'},run],started).id,42);
  assert.equal(selectRun([run],started+60000),null);
});
test('completed collector waits for matching live publication receipt',()=>{
  const done={...run,status:'completed',conclusion:'success'};
  assert.equal(stateFor(done,null).state,'DEPLOYING');
  assert.equal(stateFor(done,{run_id:'41'}).state,'DEPLOYING');
  assert.equal(stateFor(done,{run_id:'42',sources:{market:'success'}}).state,'PUBLISHED');
});
test('one source failure is visible while independently published sources remain usable',()=>{
  assert.equal(stateFor(run,{run_id:'42',sources:{market:'success',kr_rates:'failure'}}).state,'PARTIAL');
  assert.equal(stateFor({...run,status:'completed',conclusion:'failure'},null).state,'FAILED');
});
test('queued and running jobs retain separate progress',()=>{
  assert.match(stateFor({...run,status:'queued'},null).text,/대기열/);
  assert.equal(stateFor(run,null).state,'RUNNING');
});

test('a successful process with stale source data is partial, never all-current',()=>{
  assert.equal(stateFor(run,{run_id:'42',sources:{fedwatch:'success'},quality:{source_health:'DEGRADED',degraded_sources:{fedwatch:'LAGGING'}}}).state,'PARTIAL');
});
