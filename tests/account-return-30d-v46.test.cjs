const test=require('node:test');
const assert=require('node:assert/strict');
const {compound30,actualRows}=require('../account-return-30d-v46.js');

function rows(count,rate=0.001,account='ISA'){
 return Array.from({length:count},(_,i)=>({
   date:`2026-09-${String(i+1).padStart(2,'0')}`,
   account,
   series_id:'ACTUAL',
   flow_adj_daily_return:rate
 }));
}

test('compounds exactly 30 actual flow-adjusted daily returns',()=>{
 const out=compound30('ISA',rows(30));
 assert.equal(out.state,'OK');
 assert.equal(out.count,30);
 assert.ok(Math.abs(out.return_pct-((1.001**30-1)*100))<1e-10);
});

test('never fabricates a 30d return when fewer than 30 valid days exist',()=>{
 const out=compound30('PENSION',rows(29,0.002,'PENSION'));
 assert.equal(out.state,'INSUFFICIENT_HISTORY');
 assert.equal(out.count,29);
 assert.equal(out.return_pct,null);
});

test('deduplicates same-day rows and keeps latest observation',()=>{
 const source=rows(30,0.001,'IRP');
 source.push({...source[29],flow_adj_daily_return:0.01});
 const dedup=actualRows('IRP',source);
 assert.equal(dedup.length,30);
 assert.equal(dedup.at(-1).rate,0.01);
 const out=compound30('IRP',source);
 const expected=((1.001**29)*1.01-1)*100;
 assert.ok(Math.abs(out.return_pct-expected)<1e-10);
});

test('ignores proxy or non-ACTUAL series',()=>{
 const source=rows(29,0.001,'TRIPOD');
 source.push({date:'2026-10-01',account:'TRIPOD',series_id:'NDX_PROXY',flow_adj_daily_return:0.2});
 const out=compound30('TRIPOD',source);
 assert.equal(out.state,'INSUFFICIENT_HISTORY');
 assert.equal(out.count,29);
});
