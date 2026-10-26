const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('market-observatory/metric-detail-v1.js','utf8');
const begin=src.indexOf(' const compare=window.__JJOONI_LATEST_BOARD?.getComparison?.();');
const end=src.indexOf(' const dateLabel=',begin);
assert(begin>=0&&end>begin,'Metric drilldown comparison block must exist');
const code=src.slice(begin,end);

function plotReference(selected,source){
 const ctx={selected,m:{lines:[{rows:source}]},rows:source,datasets:[],value:v=>Number(v).toFixed(2),
  window:{__JJOONI_LATEST_BOARD:{getComparison:()=>({label:'일간',mode:'prev'})}}};
 vm.createContext(ctx);
 vm.runInContext(code,ctx);
 return ctx.datasets;
}
const rows=[
 {date:'2026-10-16',value:28000},
 {date:'2026-10-22',value:28333},
 {date:'2026-10-23',value:28414.27},
 {date:'2026-10-26',value:28414.27}
];
test('BIPOD modal uses prior Friday reference, even when common comparison is daily',()=>{
 const out=plotReference('TRIPOD_BIPOD',rows);
 assert.equal(out.length,1);
 assert.match(out[0].label,/전주 마지막 거래일 \(2026-10-23\)/);
 assert.match(out[0].label,/28,?414.27|28414.27/);
 assert.equal(out[0].data[0].y,28414.27);
});
test('Other metrics keep previous-day comparison behavior',()=>{
 const out=plotReference('TRIPOD_MA',rows);
 assert.equal(out.length,1);
 assert.match(out[0].label,/일간 비교 기준/);
 assert.doesNotMatch(out[0].label,/전주 마지막 거래일/);
});
test('BIPOD drilldown leaves previous-week overlay absent if week has no observations',()=>{
 const out=plotReference('TRIPOD_BIPOD',[{date:'2026-10-08',value:28100},{date:'2026-10-26',value:28414.27}]);
 assert.equal(out.length,0);
});
