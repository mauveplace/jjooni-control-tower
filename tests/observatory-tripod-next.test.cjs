const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('market-observatory/latest-board-v1.js','utf8'),ctx={};vm.createContext(ctx);
vm.runInContext(src.slice(src.indexOf('function tripodNextModel('),src.indexOf('function tripodNextHtml('))+';this.model=tripodNextModel;',ctx);
const base={ok:true,session_date:'2026-10-16',ndx:110,ma250:100,vix10:20,vix_window_count:10,drawdown_52w_pct:-5,regime:'상승',target:'TQQQ 100%'};
const model=t=>ctx.model({...base,...t},'2026-10-16');
test('drawdown price distance uses current price, not percentage-point gap',()=>{const m=model({}),g=m.gates[0];assert(m.available);assert(Math.abs(g.boundary-110/.95*.91)<1e-9);assert(Math.abs(g.distance-(1-.91/.95)*100)<1e-9);assert.equal(g.gapPctPoint,4);});
test('strict drawdown and VIX boundaries match canonical Python rules',()=>{assert(model({drawdown_52w_pct:-9}).available);assert(!model({drawdown_52w_pct:-9.001}).available);const m=model({vix10:28,target:'QQQ 50% + QLD 50%'});assert(m.available);assert(!m.max);assert.equal(m.gates[1].met,false);});
test('falling regime uses 18 and cash can reenter reduced exposure',()=>{assert(model({regime:'하락',target:'현금 100%',vix10:18}).cash);assert(!model({regime:'하락',target:'현금 100%',vix10:17.99}).available);assert(model({regime:'하락',target:'QQQ 50% + QLD 50%',vix10:17.99}).available);});
test('uncertified, incomplete or mismatched snapshots cannot show actionable distance',()=>{for(const x of [{ok:false},{ndx:null},{vix10:null},{ma250:0},{session_date:'2026-10-15'},{vix_window_count:9},{regime:'unknown'},{target:'현금 100%'}])assert(!model(x).available,JSON.stringify(x));});
test('published snapshot and displayed target agree',()=>{const data=JSON.parse(fs.readFileSync('market-observatory/data/observatory.json'));assert(ctx.model(data.tripod_latest,data.us_completed_session_date).available);});
test('compare transition prices across sessions rather than showing MA250 movement',()=>{
 const data=JSON.parse(fs.readFileSync('market-observatory/data/observatory.json'));
 const t=data.tripod_latest,prior=data.tripod_history.findLast(x=>x.date<t.date);
 const currentMonday=new Date(t.date+'T00:00:00Z');currentMonday.setUTCDate(currentMonday.getUTCDate()-((currentMonday.getUTCDay()+6)%7));
 const lastWeekStart=new Date(currentMonday);lastWeekStart.setUTCDate(lastWeekStart.getUTCDate()-7);
 const priorWeek=data.tripod_history.filter(x=>x.date>=lastWeekStart.toISOString().slice(0,10)&&x.date<currentMonday.toISOString().slice(0,10)).at(-1);
 assert(priorWeek,'Previous completed week must exist in fixture');
 const m=ctx.model(t,data.us_completed_session_date,prior,priorWeek),fall=m.gates.find(x=>x.key==='fall'),dd=m.gates.find(x=>x.key==='drawdown');
 assert.equal(fall.previousBoundary,t.previous_ma250*.95);
 assert(Math.abs((fall.boundary-fall.previousBoundary)-(t.ma250-t.previous_ma250)*.95)<1e-8);
 assert.equal(dd.previousBoundary,priorWeek.ndx/(1+priorWeek.drawdown_52w_pct/100)*.91);
 assert.equal(dd.previousBoundaryDate,priorWeek.date);
 assert.match(fall.note,/VIX10 ≥ 18/);assert.match(fall.note,/18 미만이면 바이팟/);
});
test('missing prior threshold inputs never become fabricated daily changes',()=>{
 const m=model({});assert.equal(m.gates.find(x=>x.key==='fall').previousBoundary,undefined);
 assert.equal(m.gates.find(x=>x.key==='drawdown').previousBoundary,undefined);
});
