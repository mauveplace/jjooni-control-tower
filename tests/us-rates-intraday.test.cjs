const test=require('node:test');
const assert=require('node:assert/strict');
const {day,rowsForDay,chartPoints}=require('../market-observatory/us-rates-intraday-v1.js');
test('KST day starts at 15:00 UTC, independent of machine timezone',()=>{
  const before=Date.parse('2026-10-14T14:59:00Z')/1000,after=before+60;
  assert.equal(day(before),'2026-10-14');assert.equal(day(after),'2026-10-15');
  assert.equal(rowsForDay([{timestamp:before,yield_pct:5.2},{timestamp:after,yield_pct:5.19}],'2026-10-15').length,1);
});
test('basis-point changes use the first selected observation, not percent returns',()=>{
  const points=chartPoints([{timestamp:1000,yield_pct:5.2},{timestamp:1300,yield_pct:5.19}],'bp');
  assert.ok(Math.abs(points[1].y+1)<1e-9);assert.equal(points[0].y,0);
});
test('closed or missing time windows have a visible gap',()=>{
  const points=chartPoints([{timestamp:1000,yield_pct:5.2},{timestamp:20000,yield_pct:5.19}],'yield');
  assert.equal(points.length,3);assert.equal(points[1].y,null);assert.equal(points[2].y,5.19);
});
