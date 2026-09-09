(function(){
'use strict';
if(window.__JJOONI_CONSULTANT_TAB_HOTFIX_V31)return;
const S={state:'ACTIVE',version:'31.1-market-v30',activations:0,market_augments:0};
window.__JJOONI_CONSULTANT_TAB_HOTFIX_V31=S;
const q=(s,r=document)=>{try{return r.querySelector(s)}catch(_){return null}};
const qa=(s,r=document)=>{try{return Array.from(r.querySelectorAll(s))}catch(_){return[]}};
const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null};
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const MARKET_EXTRA=[
  ['DOW30','다우 30'],
  ['NASDAQCOMP','나스닥 종합'],
  ['RUSSELL2000','Russell 2000'],
  ['FEAR_GREED','공포탐욕지수']
];
function isConsultantTarget(e){
  try{
    const path=typeof e.composedPath==='function'?e.composedPath():[];
    for(const node of path){
      if(node?.matches?.('.tab[data-tab="consultant"],#ctMoreMenu button[data-tab="consultant"]'))return node;
    }
    return e.target?.closest?.('.tab[data-tab="consultant"],#ctMoreMenu button[data-tab="consultant"]')||null;
  }catch(_){return null}
}
function sourceLabel(s){
  const x=String(s||'').toUpperCase();
  if(x.includes('KIS'))return'KIS';
  if(x.includes('CNN'))return'CNN 참고';
  if(x.includes('YAHOO'))return'Yahoo 참고';
  if(x==='UNAVAILABLE')return'확인 불가';
  return s||'—';
}
function pct(v){const x=n(v);return x==null?'—':(x>=0?'+':'')+x.toFixed(2)+'%'}
function cls(v){const x=n(v);return x==null?'flat':x>0?'up':x<0?'down':'flat'}
function val(v){const x=n(v);return x==null?'—':x.toLocaleString('en-US',{maximumFractionDigits:2})}
function sentiment(r){
  const score=n(r?.value),prev=n(r?.prev_close),rating=String(r?.rating||'').toUpperCase();
  const ko={'EXTREME FEAR':'극도 공포','FEAR':'공포','NEUTRAL':'중립','GREED':'탐욕','EXTREME GREED':'극도 탐욕'}[rating]||rating||'—';
  return {
    value:score==null?'—':Math.round(score)+'/100',
    move:(prev==null?ko:`${ko} · 전일 ${Math.round(prev)}`),
    klass:'flat'
  };
}
function augmentMarketCards(){
  const panel=q('#panel-consultant'),grid=q('.ctCmMacro',panel||document);if(!panel||!grid)return false;
  const P=window.__JJOONI_LIVE_PAYLOAD||{};
  const C=window.__JJOONI_CANONICAL_SSOT||{};
  const market=P.market_context||C.market_context||{};
  const items=market.items||{};
  let added=0;
  for(const [key,label] of MARKET_EXTRA){
    if(grid.querySelector(`[data-ct-market-v30="${key}"]`))continue;
    const r=items[key]||{};
    const card=document.createElement('div');card.className='ctCmMacroCard';card.dataset.ctMarketV30=key;
    let value=val(r.value),move=pct(r.change_pct),klass=cls(r.change_pct);
    if(key==='FEAR_GREED'){
      const s=sentiment(r);value=s.value;move=s.move;klass=s.klass;
    }
    card.innerHTML=`<div class="ctCmMacroTop"><span class="ctCmMacroName">${esc(label)}</span><span class="ctCmSrc">${esc(sourceLabel(r.source))}</span></div><div class="ctCmMacroValue">${esc(value)}</div><div class="ctCmMacroMove ${klass}">${esc(move)}</div>`;
    grid.appendChild(card);added++;
  }
  const sub=q('.ctCmSub',panel);
  if(sub&&items.DOW30)sub.textContent='송팀장 Consultant View · 주요 지수 + 시장심리 + 마스터시트 섹터 Watchlist';
  if(added){S.market_augments+=added;S.last_market_augment=new Date().toISOString()}
  return true;
}
function activate(){
  const tab=q('.tab[data-tab="consultant"]'),panel=q('#panel-consultant');
  if(!panel)return false;
  qa('.tab[data-tab]').forEach(t=>t.classList.toggle('on',t===tab));
  qa('[id^="panel-"]').forEach(p=>{
    const on=p===panel;
    p.classList.toggle('on',on);
    if(on){p.style.setProperty('display','block','important');p.removeAttribute('data-ct-consultant-hidden')}
    else{p.dataset.ctConsultantHidden='1';p.style.setProperty('display','none','important')}
  });
  const menu=q('#ctMoreMenu');
  if(menu){qa('button[data-tab]',menu).forEach(b=>b.classList.toggle('active',b.dataset.tab==='consultant'));menu.classList.remove('open')}
  const more=q('#ctMoreTab');if(more){more.classList.add('on');more.setAttribute('aria-expanded','false')}
  try{sessionStorage.setItem('jjooni_ct_active_tab_v1','consultant')}catch(_){}
  S.activations++;S.last_activation=new Date().toISOString();
  augmentMarketCards();setTimeout(augmentMarketCards,0);setTimeout(augmentMarketCards,250);
  return true;
}
function intercept(e){
  if(!isConsultantTarget(e))return;
  e.preventDefault();
  e.stopImmediatePropagation();
  e.stopPropagation();
  activate();
  queueMicrotask(activate);
  setTimeout(activate,0);
}
// Window is the first DOM node in the capture path. This intentionally runs before
// the dashboard's legacy document-level capture handlers, which otherwise consume
// consultant-tab clicks before V30 can observe them.
window.addEventListener('click',intercept,true);
window.addEventListener('keydown',e=>{
  if((e.key==='Enter'||e.key===' ')&&isConsultantTarget(e))intercept(e);
},true);
// V29 re-renders the consultant panel whenever a fresh live payload arrives. Add
// the V30 breadth cards back after that render without owning or mutating payload.
try{
  let pending=false;
  new MutationObserver(()=>{
    if(pending)return;pending=true;
    requestAnimationFrame(()=>{pending=false;augmentMarketCards()});
  }).observe(document.documentElement,{subtree:true,childList:true});
}catch(_){ }
setTimeout(augmentMarketCards,500);
})();
