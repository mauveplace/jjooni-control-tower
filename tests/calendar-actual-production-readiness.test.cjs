'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {targets,verifiedTargetActualsReady}=require('./calendar-actual-production-readiness.cjs');
const fixture=()=>({actual_freshness:{status:'DEGRADED',overdue_count:1,overdue_events:[{title:'2026년 9월 산업활동동향'}]},events:targets.map(([date,title,actual])=>({datetime_kst:date+'T12:00:00+09:00',title,actual,source_tier:'OFFICIAL',source_url:'https://example.test/official'}))});
test('unrelated overdue release does not fail verified historical target QA',()=>{
 const data=fixture();assert.equal(verifiedTargetActualsReady(data),true);
 data.actual_freshness.overdue_count=0;assert.equal(verifiedTargetActualsReady(data),true);
});
test('missing target, wrong value, unverified source, or missing provenance fail closed',()=>{
 for(const mutation of [
  d=>d.events.pop(),
  d=>d.events[0].actual='197K',
  d=>d.events[0].source_tier='MARKET_FEED',
  d=>delete d.events[0].source_url,
  d=>d.events[0].datetime_kst='2026-09-16T12:00:00+09:00',
 ]){const data=fixture();mutation(data);assert.equal(verifiedTargetActualsReady(data),false);}
});
