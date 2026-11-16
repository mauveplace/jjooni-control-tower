const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../tripod-daily-freshness-v35.js'),'utf8');
const kstDate=offset=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+offset*86400000));
function sandbox({date=kstDate(0),marketDate=date,missing=null,sourceName='PUBLIC_MARKET_DAILY_V1'}={}){
 const sig={ok:true,date,session_date:date,source:sourceName,
  vix_basis:'LAST_10_DAILY_CLOSES_ARITHMETIC_MEAN',vix_window_count:10,
  data_alignment:'NDX_VIX_SAME_COMPLETED_SESSION',
  ndx:28000,ma250:27000,vix10:20.5,vix_latest_close:21.0,drawdown_52w_pct:-10.5,
  regime:'상승',target:'QQQ 50% + QLD 50%',action:'HOLD_NO_TRADE'};
 if(missing)delete sig[missing];
 const timer=[],events=[];let interval=null;
 const document={documentElement:{},querySelector:()=>null,addEventListener:()=>{},
  dispatchEvent:e=>{events.push(e.type)}};
 const window={__JJOONI_PUBLIC_MARKET_DAILY:{tripod_signal:sig,
   market_context:{items:marketDate?{VIX:{value:21,session_date:marketDate}}:{}}}};
 const ctx={window,document,console:{warn:()=>{}},Date,Intl,Math,Number,String,Set,JSON,
  setTimeout:fn=>{timer.push(fn);return timer.length},
  setInterval:fn=>{interval=fn;return 1},
  requestAnimationFrame:fn=>{fn();return 1},
  MutationObserver:class{observe(){}},
  CustomEvent:class{constructor(type){this.type=type}}};
 vm.runInNewContext(source,ctx,{filename:'tripod-daily-freshness-v35.js'});
 for(const fn of timer.splice(0))fn();
 return {window,events,tick:()=>interval?.(),signal:sig};
}
test('verified market daily signal publishes without strategy panel and exposes trustworthy source facts',()=>{
 const {window,events}=sandbox(),s=window.__JJOONI_TRIPOD_DAILY_FRESHNESS_V35.last;
 assert.equal(s.trusted,true);assert.equal(s.marketDate,s.date);
 assert.equal(s.target,'QQQ 50% + QLD 50%');
 assert.equal(s.vix10,20.5);assert.equal(s.drawdown_52w_pct,-10.5);
 assert(Math.abs(s.ma250_gap_pct-(28000/27000-1)*100)<1e-9);
 assert(events.includes('jjooni:tripod-daily-verified'));
});
test('stale, market-date mismatch, unavailable market session and missing actions fail closed',()=>{
 const tests=[{date:kstDate(-11),marketDate:kstDate(-11)},
  {marketDate:kstDate(-1)},{marketDate:null},
  {missing:'target'},{missing:'action'},{missing:'regime'},
  {missing:'vix10'},{missing:'ndx'},{missing:'drawdown_52w_pct'}];
 for(const params of tests){
  const s=sandbox(params).window.__JJOONI_TRIPOD_DAILY_FRESHNESS_V35.last;
  assert.equal(s.trusted,false,'expected BLOCKED for '+JSON.stringify(params));
  assert.equal('target'in s,false,'blocked signal must never publish last known goal');
 }
});
test('local 1-minute re-evaluation revokes previously trusted source without panel',()=>{
 const box=sandbox(),state=box.window.__JJOONI_TRIPOD_DAILY_FRESHNESS_V35;
 assert.equal(state.last.trusted,true);
 box.signal.target='';
 box.tick();
 assert.equal(state.last.trusted,false);
 assert.equal('target'in state.last,false);
});
