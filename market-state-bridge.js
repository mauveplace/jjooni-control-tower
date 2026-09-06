(function(){
'use strict';

const BADGE_ID='ctProducerFreshnessBadge';
const REF_AGE_MS=30*60*1000;
const STALE_AGE_MS=24*60*60*1000;

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
function parseKstMs(v){
  const raw=String(v||'').trim();if(!raw)return null;
  let s=raw;
  if(!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(s)&&/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(s))s=s.replace(' ','T')+'+09:00';
  const ms=Date.parse(s);return Number.isFinite(ms)?ms:null;
}
function stamp(v){
  const ms=parseKstMs(v);if(ms==null)return '시각 확인 중';
  const parts=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date(ms));
  const get=t=>(parts.find(x=>x.type===t)||{}).value||'';
  return `${get('month')}/${get('day')} ${get('hour')}:${get('minute')}`;
}
function ageText(ms){
  const min=Math.max(0,Math.floor(ms/60000));
  if(min<60)return `${min}분 경과`;
  const h=Math.floor(min/60),m=min%60;return m>=30?`${h+1}시간 경과`:`${h}시간 경과`;
}
function basisRaw(live){return live.generated_kst||live.source_snapshot_kst||live.observed_at||''}
function basisMs(live){return parseKstMs(basisRaw(live))}
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
function nextText(live){return live.next_expected_update_kst?stamp(live.next_expected_update_kst):''}
function paint(){
  const b=ensureBadge();
  const live=window.__JJOONI_LIVE_PAYLOAD||{};
  const session=live.session||{};
  const scheduleState=String(live.schedule_contract_state||'').toUpperCase();
  const basis=basisMs(live),basisLabel=stamp(basisRaw(live)),age=basis==null?null:Math.max(0,Date.now()-basis),next=nextText(live);

  if(age==null){
    b.textContent='⚠ 기준시각 확인 필요';
    b.title='generated_kst를 확인할 수 없어 데이터 신선도를 판정할 수 없습니다.';
    paintStyle(b,'warn');return;
  }
  if(age>STALE_AGE_MS){
    b.textContent=`⚠ 데이터 ${ageText(age)} · 기준 ${basisLabel}`;
    b.title='generated_kst 기준 24시간을 초과했습니다. 휴장 여부와 관계없이 마지막 검증값으로만 취급합니다.';
    paintStyle(b,'warn');return;
  }
  if(scheduleState==='MISMATCH'){
    b.textContent=`⚠ 수집 일정 확인 필요 · 기준 ${basisLabel}`;
    b.title='데이터는 있으나 producer 일정 계약이 불일치합니다.';
    paintStyle(b,'warn');return;
  }
  if(String(session.state||'').toUpperCase()==='CLOSED'){
    const aged=age>REF_AGE_MS?' · '+ageText(age):'';
    b.textContent=`● 장 마감${aged} · 기준 ${basisLabel}${next?' · 다음 '+next:''}`;
    b.title='generated_kst 기준 마지막 검증값입니다. 24시간을 넘으면 휴장 중에도 경고로 전환합니다.';
    paintStyle(b,'closed');return;
  }
  const liquidity=liquidityState(live);
  if(age>REF_AGE_MS){
    b.textContent=`⚠ 데이터 ${ageText(age)} · 기준 ${basisLabel}`;
    b.title='시장 진행 중인데 generated_kst 기준 30분을 넘었습니다.';
    paintStyle(b,'warn');return;
  }
  if(liquidity==='THIN'){
    b.textContent=`● 저유동성 구간 · 기준 ${basisLabel}${next?' · 다음 '+next:''}`;
    b.title='가격 유동성이 낮아 손익 판단은 제한적으로 봐야 합니다.';
    paintStyle(b,'warn');return;
  }
  b.textContent=`● 최신 · 기준 ${basisLabel}${next?' · 다음 '+next:''}`;
  b.title='데이터 신선도는 generated_kst 기준입니다. 브라우저 렌더 시각은 사용하지 않습니다.';
  paintStyle(b,'good');
  window.__JJOONI_MARKET_STATE_BRIDGE={state:'ACTIVE',version:'2.0',freshness_authority:'generated_kst',basis_kst:basisRaw(live),data_age_ms:age};
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
