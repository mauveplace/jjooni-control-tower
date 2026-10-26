const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const src=fs.readFileSync('market-observatory/latest-board-v1.js','utf8');
function api(history){
 const context={DATA:{tripod_history:history},fmt:(v,d)=>Number(v).toFixed(d),cls:v=>v>0?'up':v<0?'down':'flat'};
 vm.createContext(context);
 const dateHelper=src.slice(src.indexOf('function utcDate('),src.indexOf('function refPoint('));
 const helpers=src.slice(src.indexOf('function ma250Change('),src.indexOf('function tripodPriceDistance('));
 assert(dateHelper.startsWith('function utcDate('));
 assert(helpers.includes('function tripodPreviousWeekRow('));
 vm.runInContext(dateHelper+'\n'+helpers+'\nthis.previousWeek=tripodPreviousWeekRow;this.level=tripodBipodLevel;this.change=tripodBipodChange;',context);
 return context;
}
const row=(date,ndx,drawdown_52w_pct)=>({date,ndx,drawdown_52w_pct});
test('BIPOD compares to the final completed close of previous calendar week, not previous day',()=>{
 const a=api([row('2026-10-16',100,-5),row('2026-10-19',101,-4),row('2026-10-22',103,-4),row('2026-10-23',105,-4),row('2026-10-26',110,-3)]);
 const latest=row('2026-10-27',111,-3);
 assert.equal(a.previousWeek(latest).date,'2026-10-23');
 assert.equal(a.change(latest).label,'전주');
 assert.equal(a.change(latest).refDate,'2026-10-23');
 const expected=a.level(latest)-a.level(row('2026-10-23',105,-4));
 assert(Math.abs(parseFloat(a.change(latest).points)-expected)<.01);
});
test('Monday comparison uses last Friday, rather than last Monday',()=>{
 const a=api([row('2026-10-16',100,-5),row('2026-10-19',100,-5),row('2026-10-23',105,-4)]);
 assert.equal(a.previousWeek(row('2026-10-26',110,-3)).date,'2026-10-23');
});
test('holiday week chooses final available close in preceding week',()=>{
 const a=api([row('2026-10-14',100,-6),row('2026-10-15',101,-6),row('2026-10-19',103,-5)]);
 assert.equal(a.previousWeek(row('2026-10-20',104,-5)).date,'2026-10-15');
});
test('missing last-week close must not fabricate a prior-week change',()=>{
 const a=api([row('2026-10-09',100,-5),row('2026-10-26',110,-3)]);
 assert.equal(a.previousWeek(row('2026-10-27',111,-3)),null);
 assert.equal(a.change(row('2026-10-27',111,-3)),null);
});
test('52-week high drawdown is distinct from weekly change in the boundary',()=>{
 const a=api([]);
 const price=29273.40429688,drawdown=-6.248517147946564,level=a.level(row('2026-10-26',price,drawdown));
 assert(Math.abs(level-28414.268339839204)<1e-7);
 assert(Math.abs((level/price-1)*100-(-2.9348686211134067))<1e-8);
});
test('comparison labels are weekly only for BIPOD; NOPOD and MA250 retain daily',()=>{
 assert.match(src,/label:'전주',refDate:prior\.date/);
 assert.match(src,/change\.label\|\|'전일'/);
 assert.match(src,/weekly=g\.key==='drawdown'/);
 assert.match(src,/drawdown\.previousBoundaryDate=previousWeek\.date/);
 assert.match(src,/최근 252거래일|52주 최고 종가/);
});
