const test=require('node:test');
const assert=require('node:assert/strict');
const {day,rowsForDay,chartPoints,aggregate,historyRows,axisLabel}=require('../market-observatory/us-rates-intraday-v1.js');
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

const point=(date,value)=>({timestamp:Date.parse(date)/1000,yield_pct:value});
test('one US session spans KST midnight without mixing adjacent US trading dates',()=>{
  const rows=[point('2026-10-14T18:55:00Z',5.27),point('2026-10-15T12:20:00Z',5.18),point('2026-10-15T18:55:00Z',5.07)];
  assert.equal(rowsForDay(rows,'2026-10-15','kst').length,2);
  assert.deepEqual(rowsForDay(rows,'2026-10-15','ny').map(p=>p.yield_pct),[5.18,5.07]);
  assert.equal(day(Date.parse('2026-03-09T04:30:00Z')/1000,'ny'),'2026-03-09');
  assert.equal(day(Date.parse('2026-11-02T04:30:00Z')/1000,'ny'),'2026-11-01');
});
test('weekly and monthly series retain actual last observations across year boundaries',()=>{
  const rows=[point('2025-12-31T14:30:00Z',4),point('2026-01-02T14:30:00Z',4.1),point('2026-01-05T14:30:00Z',4.2),point('2026-01-30T14:30:00Z',4.3)];
  assert.deepEqual(aggregate(rows,'weekly').map(p=>p.yield_pct),[4.1,4.2,4.3]);
  assert.deepEqual(aggregate(rows,'monthly').map(p=>p.yield_pct),[4,4.3]);
  assert.deepEqual(historyRows(rows,'monthly','2026-01-05',12).map(p=>p.yield_pct),[4,4.2]);
  assert.equal(chartPoints(rows,'yield','monthly').length,4);
});
test('intraday ticks include dates across midnight and history ticks use US dates',()=>{
  assert.equal(axisLabel(Date.parse('2026-10-15T15:05:00Z'),'intraday'),'10-16 00:05');
  assert.equal(axisLabel(Date.parse('2026-10-15T01:05:00Z'),'daily'),'2026-10-14');
});
