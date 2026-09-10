(function(){
'use strict';
if(window.__JJOONI_PUBLIC_MARKET_SIDECAR_V36)return;
const S={state:'LOADING',version:'36.0',attempts:0,last_error:null};
window.__JJOONI_PUBLIC_MARKET_SIDECAR_V36=S;
function dateAge(d){
 if(!/^20\d{2}-\d{2}-\d{2}$/.test(String(d||'')))return null;
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const a=Date.parse(String(d)+'T12:00:00+09:00'),b=Date.parse(today+'T12:00:00+09:00');
 return Number.isFinite(a)&&Number.isFinite(b)?Math.round((b-a)/86400000):null;
}
function valid(d){
 if(!d||d.schema!=='JJOONI_PUBLIC_MARKET_DAILY_V1'||d.read_only!==true||d.contains_account_data!==false)return false;
 const sig=d.tripod_signal||{},age=dateAge(sig.date||sig.session_date);
 return sig.ok===true&&age!=null&&age>=0&&age<=4&&sig.vix_basis==='LAST_10_DAILY_CLOSES_ARITHMETIC_MEAN'&&Number(sig.vix_window_count)===10;
}
async function load(){
 S.attempts++;
 try{
  const r=await fetch('public-market-daily.json?_='+Date.now(),{cache:'no-store',credentials:'same-origin'});
  if(!r.ok)throw new Error('HTTP_'+r.status);
  const d=await r.json();
  if(!valid(d))throw new Error('SIDECAR_CONTRACT_INVALID');
  window.__JJOONI_PUBLIC_MARKET_DAILY=d;
  S.state='READY';S.loaded_at=new Date().toISOString();S.generated_kst=d.generated_kst||null;S.signal_date=(d.tripod_signal||{}).date||null;S.last_error=null;
  document.dispatchEvent(new CustomEvent('jjooni:public-market-loaded',{detail:{signal_date:S.signal_date,generated_kst:S.generated_kst}}));
  return true;
 }catch(e){
  S.state='FAILED';S.last_error=String(e&&e.message||e);S.failed_at=new Date().toISOString();
  console.warn('CT public market sidecar',e);
  return false;
 }
}
window.__JJOONI_PUBLIC_MARKET_SIDECAR_V36.load=load;
load().then(ok=>{if(!ok)setTimeout(load,5000)});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&S.state!=='READY')load()});
})();