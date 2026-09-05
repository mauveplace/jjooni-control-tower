(function(){
'use strict';
const B='ctMarketStateBadge',REF_MAX_AGE_MS=24*60*60*1000;
function el(){let e=document.getElementById(B);if(!e){e=document.createElement('div');e.id=B;e.style.cssText='position:fixed;right:12px;top:40px;z-index:99999;padding:5px 9px;border-radius:999px;font:800 9px/1.2 system-ui,-apple-system,sans-serif;white-space:nowrap;box-shadow:0 4px 14px #0002';document.body.appendChild(e)}return e}
function paintStyle(e,state){const s=state==='good'?['#ecfdf3','#abefc6','#087443']:state==='warn'?['#fff7ed','#fed7aa','#b45309']:['#fff1f2','#fecdd3','#be123c'];e.style.background=s[0];e.style.border='1px solid '+s[1];e.style.color=s[2]}
function observedMs(live){for(const k of ['observed_at','generated_kst','sync_kst']){const x=Date.parse(String(live&&live[k]||''));if(Number.isFinite(x))return x}return NaN}
function paint(){
 const e=el(),live=window.__JJOONI_LIVE_PAYLOAD||{},scheduleState=String(live.schedule_state||live.schedule_contract_state||'').toUpperCase(),authority=String(live.schedule_authority||live.schedule_contract||''),next=Date.parse(String(live.next_expected_update_kst||'')),staleAfter=Date.parse(String(live.stale_after_kst||''));
 if(scheduleState==='MISMATCH'){
  e.textContent='SSOT LIVE · 일정 계약 불일치';e.title='가격·계좌 데이터 수집은 계속됩니다. next_expected/stale_after는 신뢰할 수 없어 일정·freshness 판단만 LIMITED입니다.';paintStyle(e,'warn');return;
 }
 if(authority!=='PRODUCER_SCHEDULE_V1'||!Number.isFinite(next)||!Number.isFinite(staleAfter)){
  const obs=observedMs(live);
  if(Number.isFinite(obs)&&Date.now()-obs>REF_MAX_AGE_MS){e.textContent='SSOT 일정 메타 없음';e.title='producer schedule metadata가 24시간 이상 비어 있습니다.';paintStyle(e,'warn');return}
  e.textContent='SSOT 일정 메타 대기';e.title='producer schedule metadata가 아직 없습니다.';paintStyle(e,'good');return;
 }
 const now=Date.now();
 if(now>staleAfter){e.textContent='SSOT STALE';e.title='stale_after_kst 초과';paintStyle(e,'warn');return}
 e.textContent='SSOT LIVE';e.title='producer schedule contract 정상';paintStyle(e,'good');
}
function run(){try{paint()}catch(_){} }
setTimeout(run,0);setTimeout(run,800);setInterval(()=>{if(!document.hidden)run()},5000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)run()});
try{new MutationObserver(()=>run()).observe(document.documentElement,{subtree:true,childList:true,characterData:true});}catch(_){}
})();

(function(){
 if(document.getElementById('ctLineageGuardScript'))return;
 const s=document.createElement('script');
 s.id='ctLineageGuardScript';
 s.src='lineage-guard.js?v=5&_='+Date.now();
 s.async=true;
 s.onerror=function(){console.error('CT lineage guard load failed')};
 (document.head||document.documentElement).appendChild(s);
})();

(function(){
 if(document.getElementById('ctUiRefactorScript'))return;
 const s=document.createElement('script');
 s.id='ctUiRefactorScript';
 s.src='ui-refactor.js?v=1&_='+Date.now();
 s.async=true;
 s.onerror=function(){console.error('CT UI refactor load failed');window.__JJOONI_UI_REFACTOR={state:'LOAD_FAILED'}};
 (document.head||document.documentElement).appendChild(s);
})();

(function(){
 if(document.getElementById('ctTradeReviewLoaderScript'))return;
 const s=document.createElement('script');
 s.id='ctTradeReviewLoaderScript';
 s.src='trade-review-loader.js?v=1&_='+Date.now();
 s.async=true;
 s.onerror=function(){console.error('CT trade review loader failed');window.__JJOONI_TRADE_REVIEW_V2={state:'LOADER_FAILED'}};
 (document.head||document.documentElement).appendChild(s);
})();
