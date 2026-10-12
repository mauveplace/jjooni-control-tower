const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('../market-observatory/analysis-lab-core.js');

test('missing values never become zero',()=>{
 assert.equal(C.number(null),null);assert.equal(C.number(''),null);
 assert.deepEqual(C.resample([{date:'2026-01-01',value:null}], 'monthly'),[]);
});
test('month end alignment pairs holiday last close with macro reference month',()=>{
 const x=C.resample([{date:'2026-01-29',value:100},{date:'2026-01-30',value:110}],'monthly');
 const y=C.resample([{date:'2026-01-31',value:3}],'monthly');
 const pairs=C.align(x,y);assert.equal(pairs.length,1);assert.equal(pairs[0].x,110);assert.equal(pairs[0].xDate,'2026-01-30');
});
test('incomplete period does not move observations into the future',()=>{
 const x=C.resample([{date:'2026-10-09',value:100}],'monthly','last','2026-10-12');
 assert.equal(x[0].date,'2026-10-12');assert.equal(x[0].sourceDate,'2026-10-09');assert.equal(x[0].partial,true);
});
test('return and drawdown use their declared denominators',()=>{
 const rows=[100,120,90].map((value,i)=>({date:'2026-01-0'+(i+1),value}));
 assert.equal(C.transform(rows,'return')[0].value.toFixed(2),'20.00');
 assert.equal(C.transform(rows,'drawdown')[2].value,-25);
 assert.equal(C.transform(rows,'index')[0].value,100);
});
test('positive lag pairs earlier X with later Y and excludes unsupported edges',()=>{
 const x=[1,2,3,4].map((value,i)=>({date:'2026-01-0'+(i+1),value}));
 const y=[9,1,2,3].map((value,i)=>({date:'2026-01-0'+(i+1),value}));
 const p=C.align(x,y,1);assert.equal(p.length,3);assert.equal(p[0].x,1);assert.equal(p[0].y,1);assert.equal(C.correlation(p),1);
});
test('constant or insufficient series have no invented correlation',()=>{
 assert.equal(C.correlation([{x:1,y:2}]),null);
 assert.equal(C.correlation([{x:1,y:2},{x:1,y:3},{x:1,y:4}]),null);
});
