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
 const b=ensureBadge(),live=window.__JJOONI_LIVE_PAYLOAD||{},f=window.JjooniMetrics.freshness(live),basis=stamp(basisRaw(live)),next=nextText(live);
 const text=(live.schedule_contract_state==='MISMATCH'?'수집 일정 확인 필요':f.text)+' · 기준 '+basis+(next?' · 다음 '+next:'');
 if(b.textContent!==text)b.textContent=text;
 b.title='최종 데이터 생성 시각과 생산자가 지정한 다음 수집 마감시각 기준';
 paintStyle(b,live.schedule_contract_state==='MISMATCH'?'warn':f.kind);
 window.__JJOONI_MARKET_STATE_BRIDGE={state:'ACTIVE',version:'2.3',freshness_authority:'PRODUCER_STALE_AFTER',basis_kst:basisRaw(live),data_age_ms:f.age_ms};
}

let busy=false;
const run=()=>{if(busy)return;busy=true;try{paint()}finally{setTimeout(()=>{busy=false},0)}};
run();
document.addEventListener('jjooni:live-applied',run);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)run()});
})();

// UI dependencies are owned exclusively by the verified sequential loader.
