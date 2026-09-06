(function(){
'use strict';
if(window.__JJOONI_TRADE_REVIEW_READABLE_V3)return;
window.__JJOONI_TRADE_REVIEW_READABLE_V3={state:'BOOTING',version:'3.1'};

const state={showAll:false,query:''};
let applying=false,rafPending=false;
const qs=(s,r=document)=>{try{return r.querySelector(s)}catch(_){return null}};
const qsa=(s,r=document)=>{try{return Array.from(r.querySelectorAll(s))}catch(_){return []}};

function style(){
  if(qs('#ctTradeReadableV3Style'))return;
  const st=document.createElement('style');
  st.id='ctTradeReadableV3Style';
  st.textContent=`
@media(max-width:767px){
  .ctDevNoteHiddenV3{display:none!important}
  #ctTradeReviewV2{margin:8px 0 24px!important}
  #ctTradeReviewV2 .ctTrHead{margin:6px 2px 12px!important}
  #ctTradeReviewV2 .ctTrTitle{font-size:22px!important;line-height:1.15!important;letter-spacing:-.5px!important}
  #ctTradeReviewV2 .ctTrSub{font-size:11px!important;line-height:1.45!important;color:#7b8798!important;margin-top:5px!important}
  #ctTradeReviewV2 .ctTrToolbar{display:grid!important;grid-template-columns:1fr!important;gap:7px!important;margin:0 0 10px!important}
  #ctTradeReviewV2 .ctTrFilters,#ctTradeReviewV2 .ctTrSorts{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px!important}
  #ctTradeReviewV2 .ctTrChip{width:100%!important;min-height:36px!important;padding:0 6px!important;font-size:11px!important;border-radius:10px!important;white-space:nowrap!important}
  #ctTradeReviewV2 .ctTrV3Tools{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px;align-items:center;margin:0 0 10px}
  #ctTradeReviewV2 .ctTrV3Search{width:100%;height:38px;border:1px solid #d7e0e9;border-radius:11px;background:#fff;padding:0 12px;font:700 12px/1 system-ui;color:#172033;outline:none;box-sizing:border-box}
  #ctTradeReviewV2 .ctTrV3Search:focus{border-color:#7996bd;box-shadow:0 0 0 3px rgba(30,84,145,.08)}
  #ctTradeReviewV2 .ctTrV3More{height:38px;border:1px solid #d7e0e9;border-radius:11px;background:#fff;padding:0 11px;font:800 11px/1 system-ui;color:#27415f;white-space:nowrap}
  #ctTradeReviewV2 .ctTicker{margin-bottom:8px!important;border-radius:14px!important;border-color:#e2e8ef!important;box-shadow:0 3px 10px rgba(13,35,61,.035)!important}
  #ctTradeReviewV2 .ctTickerHead{display:grid!important;grid-template-columns:minmax(0,1fr) 112px!important;gap:8px!important;padding:10px 11px!important;min-height:64px!important;align-items:center!important}
  #ctTradeReviewV2 .ctTickerHead>div:first-child{min-width:0!important}
  #ctTradeReviewV2 .ctTickerName{font-size:13px!important;line-height:1.3!important;font-weight:900!important;white-space:normal!important;overflow:hidden!important;display:-webkit-box!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important;letter-spacing:-.25px!important}
  #ctTradeReviewV2 .ctTickerMeta{display:block!important;margin-top:4px!important;font-size:9px!important;line-height:1.25!important;color:#8a96a6!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
  #ctTradeReviewV2 .ctTickerRight{display:flex!important;flex-direction:column!important;align-items:flex-end!important;justify-content:center!important;gap:5px!important;min-width:0!important}
  #ctTradeReviewV2 .ctTickerScore{font-size:10px!important;line-height:1!important;color:#344054!important;font-weight:900!important;white-space:nowrap!important}
  #ctTradeReviewV2 .ctTickerVerdict{display:inline-flex!important;align-items:center!important;justify-content:center!important;max-width:108px!important;min-height:23px!important;padding:0 7px!important;border-radius:999px!important;background:#eef3f8!important;color:#526071!important;font-size:9px!important;font-weight:900!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
  #ctTradeReviewV2 .ctTickerVerdict[data-kind="good"]{background:#eef8f1!important;color:#207044!important}
  #ctTradeReviewV2 .ctTickerVerdict[data-kind="bad"]{background:#fff4e8!important;color:#a24d08!important}
  #ctTradeReviewV2 .ctTickerVerdict[data-kind="wait"]{background:#f2f4f7!important;color:#667085!important}
  #ctTradeReviewV2 .ctTickerBody{padding:9px!important;background:#f7f9fc!important}
  #ctTradeReviewV2 .ctSleeve{border-radius:12px!important;margin-bottom:8px!important}
  #ctTradeReviewV2 .ctSleeveHead{padding:11px 12px!important}
  #ctTradeReviewV2 .ctSleeveName{font-size:12px!important}
  #ctTradeReviewV2 .ctSleeveMeta{font-size:9px!important;line-height:1.35!important}
  #ctTradeReviewV2 .ctSleeveRet{font-size:12px!important}
  #ctTradeReviewV2 .ctSleeveVerdict{font-size:9px!important}
  #ctTradeReviewV2 .ctSleeveDetail{padding:10px 11px!important}
  #ctTradeReviewV2 .ctTrMetric{font-size:10px!important;padding:5px 0!important}
  #ctTradeReviewV2 .ctTrEventMain{font-size:10px!important;grid-template-columns:45px 36px minmax(0,1fr) auto!important}
  #ctTradeReviewV2 .ctTrEventEval,#ctTradeReviewV2 .ctTrEventMeta{font-size:9px!important;padding-left:86px!important}
}
`;
  (document.head||document.documentElement).appendChild(st);
}

function hideDeveloperNotes(){
  if(window.innerWidth>767)return;
  const markers=['Human = PB DB SSOT','CURRENT는 최신 운용값','현재 전체자산 = Broker Actual NAV'];
  qsa('div,p,small,section').forEach(el=>{
    if(el.id==='ctTradeReviewV2'||el.closest('#ctTradeReviewV2'))return;
    const text=(el.textContent||'').trim().replace(/\s+/g,' ');
    if(!text||text.length>360)return;
    if(markers.some(m=>text.includes(m)))el.classList.add('ctDevNoteHiddenV3');
  });
}

function simplifyMeta(card){
  const meta=qs('.ctTickerMeta',card);if(!meta)return;
  const raw=(meta.textContent||'').trim();
  const s=(raw.match(/(\d+)개 전략/)||[])[1];
  const status=raw.includes('청산 완료')?'청산 완료':'진행 중';
  meta.textContent=(s?`${s}계좌 · `:'')+status+' · 탭하면 계좌별 상세';
}

function parsePct(text){
  const m=String(text||'').match(/([+-]?\d+(?:\.\d+)?)%/);
  return m?Number(m[1]):null;
}
function maxSleevePct(card){
  const vals=qsa('.ctSleeveRet',card).map(e=>parsePct(e.textContent)).filter(v=>Number.isFinite(v));
  if(!vals.length)return null;
  return vals.sort((a,b)=>Math.abs(b)-Math.abs(a))[0];
}
function simplifyCard(card){
  simplifyMeta(card);
  const score=qs('.ctTickerScore',card),pct=maxSleevePct(card);
  if(score){
    if(Number.isFinite(pct))score.textContent='최대오차 '+Math.abs(pct).toFixed(1)+'%';
    else if(!String(score.textContent||'').includes('최대오차'))score.textContent='상세에서 손익 확인';
  }
  const v=qs('.ctTickerVerdict',card);
  if(v){
    let t=(v.textContent||'').trim();
    const parts=t.split('·').map(x=>x.trim()).filter(Boolean);
    if(parts.length>1)t=parts[0].slice(0,1)+' '+parts[parts.length-1];
    v.textContent=t;
    const good=/✓|잘 팔았|매수 유효|청산 이익/.test(t),bad=/✕|평단 아래|매도 후 상승|청산 손실/.test(t);
    v.dataset.kind=good?'good':bad?'bad':'wait';
  }
}

function ensureTools(root){
  let tools=qs('.ctTrV3Tools',root);if(tools)return tools;
  const toolbar=qs('.ctTrToolbar',root);if(!toolbar)return null;
  tools=document.createElement('div');tools.className='ctTrV3Tools';
  const input=document.createElement('input');input.className='ctTrV3Search';input.type='search';input.placeholder='종목 검색';input.value=state.query;input.setAttribute('aria-label','종목 검색');
  input.addEventListener('input',()=>{state.query=input.value||'';state.showAll=false;apply()});
  const more=document.createElement('button');more.type='button';more.className='ctTrV3More';more.addEventListener('click',()=>{state.showAll=!state.showAll;apply()});
  tools.append(input,more);toolbar.insertAdjacentElement('afterend',tools);return tools;
}

function limitCards(root){
  const tools=ensureTools(root),cards=qsa('.ctTicker',root),q=state.query.trim().toLowerCase();
  let matched=0,shown=0;
  cards.forEach(card=>{
    const name=(qs('.ctTickerName',card)?.textContent||'').toLowerCase();
    const hit=!q||name.includes(q);if(hit)matched++;
    const show=hit&&(q||state.showAll||shown<12);
    card.style.setProperty('display',show?'block':'none','important');
    if(show&&hit)shown++;
  });
  if(tools){const btn=qs('.ctTrV3More',tools);if(btn){if(q||matched<=12){btn.style.display='none'}else{btn.style.display='block';btn.textContent=state.showAll?'접기':`${matched-12}개 더보기`}}}
}

function apply(){
  if(applying||window.innerWidth>767)return;
  const root=qs('#ctTradeReviewV2');if(!root)return;
  applying=true;
  try{
    style();hideDeveloperNotes();
    const sub=qs('.ctTrSub',root);if(sub)sub.textContent='종목 요약 → 탭하면 계좌별 → 다시 탭하면 체결 상세';
    const errorSort=qs('[data-sort="error"]',root);if(errorSort)errorSort.textContent='오차율순';
    qsa('.ctTicker',root).forEach(simplifyCard);
    limitCards(root);
    window.__JJOONI_TRADE_REVIEW_READABLE_V3={state:'ACTIVE',version:'3.1',visible_limit:12,query:state.query,show_all:state.showAll};
  }finally{applying=false}
}

function schedule(){
  if(rafPending)return;rafPending=true;
  requestAnimationFrame(()=>{rafPending=false;apply()});
}
style();
const obs=new MutationObserver(schedule);obs.observe(document.documentElement,{subtree:true,childList:true});
window.addEventListener('resize',schedule,{passive:true});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});
setTimeout(apply,0);setTimeout(apply,500);setTimeout(apply,1400);setInterval(()=>{if(!document.hidden)apply()},700);
})();
