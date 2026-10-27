(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.JjooniCollectorSchedule=api})(typeof window==='object'?window:globalThis,function(){
'use strict';
const GRACE_MIN=75, STATUS_TTL_MIN=120, MARKET_TTL_MIN=90;
const timestamp=x=>typeof x==='string'&&x.trim()?Date.parse(x):NaN;
function age(stamp,now){const t=timestamp(stamp);return Number.isFinite(t)&&t<=now+60000?Math.max(0,(now-t)/60000):null}
function evaluate(runs,status,now=Date.now()){
 const list=(Array.isArray(runs)?runs:[]).filter(r=>r?.event==='schedule'&&age(r.created_at,now)!==null).sort((a,b)=>timestamp(b.created_at)-timestamp(a.created_at));
 const last=list[0]||null,runAge=last?age(last.created_at,now):null;
 const statusAge=age(status?.generated_kst,now),marketAge=statusAge!==null&&statusAge<=STATUS_TTL_MIN?age(status?.groups?.market?.generated_kst,now):null;
 const state=!last?'UNVERIFIED':runAge>GRACE_MIN?'SCHEDULE_GAP':last.status!=='completed'?'RUNNING':last.conclusion!=='success'?'SCHEDULE_FAILED':'SCHEDULE_OBSERVED';
 return{state,last,last_age_min:runAge,status_age_min:statusAge,market_age_min:marketAge,market_check:marketAge===null?'UNVERIFIED':marketAge>MARKET_TTL_MIN?'CHECK_REQUIRED':'RECENT_ASSESSMENT',grace_min:GRACE_MIN};
}
return{evaluate};
});
