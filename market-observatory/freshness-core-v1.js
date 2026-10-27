(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.JjooniFreshness=api})(typeof window==='object'?window:globalThis,function(){
'use strict';
const ORDER=['market','kr_equity','us_supplement','energy','fx','metals','us_rates','kr_rates','jp_rates','crypto','pulse','fear_greed','fedwatch','tripod','sector','official_macro','calendar','audit','market_regime'];
const good=new Set(['LIVE','HEALTHY','FINAL','PASS']);
const bad=new Set(['UNAVAILABLE','FAILED','ERROR','MISALIGNED','FAIL','INCONSISTENT','AHEAD_OF_ANCHOR']);
const ms=v=>typeof v==='string'&&v.trim()?Date.parse(v):NaN;
function effective(key,raw,now=Date.now()){
 const g={...(raw||{})};g.state=String(g.state||'UNAVAILABLE').toUpperCase();g.reported_state=g.state;
 if(key==='market_regime'){
  const end=ms(g.valid_until_kst||g.as_of),start=ms(g.valid_from_kst);
  if(!Number.isFinite(end)||g.valid_from_kst&&(!Number.isFinite(start)||start>=end))g.state='UNAVAILABLE';
  else if(now>end)g.state='EXPIRED';
  else if(Number.isFinite(start)&&now<start)g.state='PENDING';
  else {const c=String(g.consensus_status||'').toUpperCase(),a=String(g.authority||'').toUpperCase();if(a.includes('PROVISIONAL')||c.startsWith('PARTIAL')||['PENDING','PROVISIONAL','DRAFT'].includes(c))g.state='PROVISIONAL';else if(c!=='CLOSED')g.state='UNAVAILABLE'}
  return g;
 }
 if(key!=='crypto')return g;
 const quotes=g.quotes||{},limit=Number(g.max_age_seconds)>0?Number(g.max_age_seconds):3600;
 const records=['BTCUSD','ETHUSD'].map(name=>{const q=quotes[name]||{},stamp=ms(q.quote_as_of_kst),seconds=(now-stamp)/1000;return{name,state:q.status,age:Number.isFinite(seconds)&&seconds>=-60?Math.max(0,seconds):null}});
 g.state=records.some(x=>x.age===null)?'UNAVAILABLE':records.some(x=>x.age>limit||x.state!=='LIVE')?'STALE':'LIVE';
 g.detail=records.map(x=>x.name+' '+(x.age===null?'시각 확인 불가':Math.floor(x.age/60)+'분 전')).join(' · ')+' · 화면 조회시각 기준';return g;
}
function evaluate(status,watchdog,now=Date.now(),errors=[]){
 const s=status||{},published=ms(s.generated_kst),limit=Number(s.freshness_policy?.max_status_age_seconds)>0?Number(s.freshness_policy.max_status_age_seconds):7200;
 const age=(now-published)/1000,valid=Number.isFinite(age)&&age>=-60,stale=valid&&age>limit;
 const groups=Object.fromEntries([...new Set([...ORDER,...Object.keys(s.groups||{})])].map(key=>{
  const raw=s.groups?.[key]||{state:'UNAVAILABLE',critical:['market','kr_equity','pulse','tripod','audit'].includes(key)};
  const g=effective(key,raw,now);
  if((!valid||stale)&&good.has(g.state)&&!['crypto','market_regime'].includes(key)){g.state='CHECK_REQUIRED';g.detail=[g.detail,'게시된 판정의 유효시간 경과 · 재점검 필요'].filter(Boolean).join(' · ')}
  return[key,g];
 }));
 const entries=Object.entries(groups),critical=entries.filter(([,g])=>g.critical&&(bad.has(g.state)||['LAGGING','STALE'].includes(g.state))).map(([k])=>k);
 const issues=entries.filter(([,g])=>!good.has(g.state));
 let overall=critical.length||['DEGRADED','FAILED','ERROR'].includes(s.overall)?'DEGRADED':issues.length?'LIVE_WITH_WARNINGS':'LIVE';
 if(s.overall==='LIVE_WITH_WARNINGS'&&overall==='LIVE')overall='LIVE_WITH_WARNINGS';
 if(!Object.keys(s.groups||{}).length||!valid)overall='UNKNOWN';else if(stale)overall='STATUS_STALE';
 if(errors.length&&overall==='LIVE')overall='LIVE_WITH_WARNINGS';
 const w=watchdog||{},checked=ms(w.checked_kst),due=ms(w.next_check_due_kst);
 const watchState=!Number.isFinite(checked)||checked>now+60000?'UNAVAILABLE':Number.isFinite(due)&&now>due?'CHECK_OVERDUE':['REPAIR_FAILED','REPAIR_INCOMPLETE','STALE_NO_REPAIR'].includes(w.result)?w.result:'HISTORICAL_CHECK';
 if(watchState==='CHECK_OVERDUE'&&overall==='LIVE')overall='LIVE_WITH_WARNINGS';
 return{groups,issues,overall,critical_bad:critical,published_overall:s.overall||'UNKNOWN',status_age_seconds:valid?Math.max(0,age):null,status_stale:stale,load_errors:[...errors],watchdog:{...w,state:watchState,reported_result:w.result||'PENDING_FIRST_RUN',scope:'US_CLOSE_RECOVERY_ONLY'}};
}
return{ORDER,effective,evaluate};
});
