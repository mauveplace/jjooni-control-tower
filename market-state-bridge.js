(function(){
'use strict';

const BADGE_ID='ctProducerFreshnessBadge';
const REF_MAX_AGE_MS=24*60*60*1000;

function ensureBadge(){
  const legacy=document.getElementById('ctEncryptedLiveBadge');
  if(legacy)legacy.style.display='none';
  let b=document.getElementById(BADGE_ID);
  if(!b){
    b=document.createElement('div');
    b.id=BADGE_ID;
    b.style.cssText='position:fixed;right:12px;top:10px;z-index:100002;padding:6px 10px;border-radius:999px;font:800 10px/1.2 system-ui,-apple-system,sans-serif;box-shadow:0 4px 14px #0002;white-space:nowrap';
    document.body.appendChild(b);
  }
  return b;
}
function paintStyle(b,state){
  const s=state==='good'?['#ecfdf3','#abefc6','#087443']:state==='closed'?['#f2f4f7','#d0d5dd','#475467']:state==='warn'?['#fff7ed','#fed7aa','#b45309']:['#fff1f2','#fecdd3','#be123c'];
  b.style.background=s[0];b.style.border='1px solid '+s[1];b.style.color=s[2];
}
function stamp(v){return String(v||'').replace('T',' ').slice(5,16)}
function liquidityState(live){
  const declared=String(((live.price_liquidity_quality||{}).state)||'').toUpperCase();
  if(declared)return declared;
  const accounts=live.accounts||{};
  for(const a of Object.values(accounts)){
    if(!a||typeof a!=='object')continue;
    for(const key of ['positions','holdings','holdings_kr','holdings_us']){
      const rows=Array.isArray(a[key])?a[key]:[];
      if(rows.some(r=>String((r||{}).price_liquidity||'').toUpperCase()==='THIN'))return 'THIN';
    }
  }
  return 'NORMAL';
}
function observedMs(live){
  for(const v of [live.observed_at,live.generated_kst,live.source_snapshot_kst]){
    const t=Date.parse(String(v||''));
    if(Number.isFinite(t))return t;
  }
  return null;
}
function paint(){
  const b=ensureBadge();
  const live=window.__JJOONI_LIVE_PAYLOAD||{};
  const session=live.session||{};
  const authority=String(live.freshness_authority||'');
  const scheduleState=String(live.schedule_contract_state||'').toUpperCase();
  const next=Date.parse(String(live.next_expected_update_kst||''));
  const staleAfter=Date.parse(String(live.stale_after_kst||''));

  if(scheduleState==='MISMATCH'){
    b.textContent='SSOT LIVE · 일정 계약 불일치';
    b.title='가격·계좌 데이터 수집은 계속됩니다. next_expected/stale_after는 신뢰할 수 없어 일정·freshness 판단만 LIMITED입니다.';
    paintStyle(b,'warn');
    return;
  }

  if(authority!=='PRODUCER_SCHEDULE_V1'||!Number.isFinite(next)||!Number.isFinite(staleAfter)){
    const obs=observedMs(live);
    if(Number.isFinite(obs)&&Date.now()-obs>REF_MAX_AGE_MS){
      b.textContent='SSOT STALE · 일정 메타데이터 없음 · '+stamp(live.observed_at||live.generated_kst);
      b.title='Producer schedule metadata가 없고 마지막 관측도 24시간을 넘었습니다.';
      paintStyle(b,'warn');
    }else{
      b.textContent='SSOT REF · 일정 메타데이터 대기';
      b.title='다음 producer snapshot부터 session / next_expected_update_kst 계약을 사용합니다.';
      paintStyle(b,'closed');
    }
    return;
  }

  const nextText=stamp(live.next_expected_update_kst);
  if(Date.now()>staleAfter){
    b.textContent='SSOT STALE · 예정 '+nextText;
    b.title='Producer가 선언한 stale_after_kst를 지났는데 새 snapshot이 도착하지 않았습니다.';
    paintStyle(b,'warn');
    return;
  }

  const liquidity=liquidityState(live);
  if(String(session.state||'').toUpperCase()==='CLOSED'){
    b.textContent='● '+(live.freshness_display||'장 마감 · 마지막 검증값 기준');
    b.title='정상 휴장/비거래 구간입니다. 다음 예상 수집 '+String(live.next_expected_update_kst||'—');
    paintStyle(b,'closed');
    return;
  }

  if(liquidity==='THIN'){
    b.textContent='SSOT LIVE · '+String(session.id||'OPEN')+' · THIN';
    b.title='Producer가 지정한 저유동성 시간외 구간(US PRE 04:00–06:00 ET 또는 POST 18:00–20:00 ET)입니다. 손익 판단은 LIMITED입니다. 다음 예상 수집 '+String(live.next_expected_update_kst||'—');
    paintStyle(b,'warn');
    return;
  }

  b.textContent='SSOT LIVE · '+String(session.id||'OPEN')+' · 다음 '+nextText;
  b.title='Freshness authority: PRODUCER_SCHEDULE_V1. 브라우저는 세션 시각을 자체 계산하지 않습니다.';
  paintStyle(b,'good');
}

let busy=false;
const run=()=>{if(busy)return;busy=true;try{paint()}finally{setTimeout(()=>{busy=false},0)}};
run();
setInterval(()=>{if(!document.hidden)run()},15000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)run()});
try{new MutationObserver(()=>run()).observe(document.documentElement,{subtree:true,childList:true,characterData:true});}catch(_){}
})();

(function(){
 if(document.getElementById('ctLineageGuardScript'))return;
 const s=document.createElement('script');
 s.id='ctLineageGuardScript';
 s.src='lineage-guard.js?v=1&_='+Date.now();
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
