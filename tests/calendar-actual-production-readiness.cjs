'use strict';
// Production QA verifies these historical releases; newly due unrelated events
// are monitored by the independent Calendar Actual health/overdue gate.
const targets=[
 ['2026-09-17','U.S. Initial Jobless Claims','196K'],
 ['2026-09-18','2026년 8월 생산자물가지수','0.2%'],
 ['2026-09-18','BOJ 금융정책','1.25%'],
 ['2026-09-17','Bank of England','3.75%'],
];
function verifiedTargetActualsReady(data){
 return targets.every(([date,title,value])=>(data?.events||[]).some(e=>
  typeof e.datetime_kst==='string'&&e.datetime_kst.startsWith(date)&&
  typeof e.title==='string'&&e.title.includes(title)&&
  e.actual===value&&e.source_tier==='OFFICIAL'&&Boolean(e.source_url)));
}
module.exports={targets,verifiedTargetActualsReady};
