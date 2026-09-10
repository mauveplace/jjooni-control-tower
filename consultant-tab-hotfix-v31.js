(function(){
'use strict';
if(window.__JJOONI_CONSULTANT_TAB_HOTFIX_V31)return;
const S={state:'ACTIVE',version:'31.3-brent-nasdaq',activations:0,market_augments:0,market_repairs:0};
window.__JJOONI_CONSULTANT_TAB_HOTFIX_V31=S;
const q=(s,r=document)=>{try{return r.querySelector(s)}catch(_){return null}};
const qa=(s,r=document)=>{try{return Array.from(r.querySelectorAll(s))}catch(_){return[]}};
const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null};
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const BASE_MARKET=[
  ['KOSPI','KOSPI'],
  ['KOSDAQ','KOSDAQ'],
  ['USDKRW','원/달러'],
  ['NASDAQ100','NASDAQ 100'],
  ['SP500','S&P 500'],
  ['WTI','WTI 유가'],
  ['US10Y','미국채 10년'],
  ['VIX','VIX'],
  ['DXY','달러인덱스']
];
const MARKET_EXTRA=[
  ['DOW30','다우 30'],
  ['NASDAQCOMP','NASDAQ 종합'],
  ['RUSSELL2000','Russell 2000'],
  ['BRENT','브렌트유'],
  ['FEAR_GREED','공포탐욕지수']
];
function hasValue(r){return n(r?.value)!=null}
function mergeRecord(c,l){
  const C=c&&typeof c==='object'?c:{};
  const L=l&&typeof l==='object'?l:{};
  if(hasValue(L))return {...C,...L};
  if(hasValue(C))return {...L,...C};
  return {...C,...L};
}
function mergedMarket(){
  const P=window.__JJOONI_LIVE_PAYLOAD||{};
  const C=window.__JJOONI_CANONICAL_SSOT||{};
  const live=P.market_context&&typeof P.market_context==='object'?P.market_context:{};
  const canonical=C.market_context&&typeof C.market_context==='object'?C.market_context:{};
  const ci=canonical.items&&typeof canonical.items==='object'?canonical.items:{};
  const li=live.items&&typeof live.items==='object'?live.items:{};
  const items={};
  for(const key of new Set([...Object.keys(ci),...Object.keys(li)]))items[key]=mergeRecord(ci[key],li[key]);
  const merged={...canonical,...live,items};
  merged._ct_merge={canonical_items:Object.keys(ci).length,live_items:Object.keys(li).length,merged_items:Object.keys(items).length};
  return merged;
}
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
function marketVal(r,key){
  const x=n(r?.value);if(x==null)return'—';
  if(key==='USDKRW')return '₩'+x.toLocaleString('ko-KR',{maximumFractionDigits:2});
  if(key==='WTI'||key==='BRENT'||String(r?.unit||'').toUpperCase()==='USD/BBL')return '$'+x.toLocaleString('en-US',{maximumFractionDigits:2});
  if(key==='US10Y'||r?.unit==='%')return x.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:3})+'%';
  return val(x);
}
function sentiment(r){
  const score=n(r?.value),prev=n(r?.prev_close),rating=String(r?.rating||'').toUpperCase();
  const ko={'EXTREME FEAR':'극도 공포','FEAR':'공포','NEUTRAL':'중립','GREED':'탐욕','EXTREME GREED':'극도 탐욕'}[rating]||rating||'—';
  return {
    value:score==null?'—':Math.round(score)+'/100',
    move:(prev==null?ko:`${ko} · 전일 ${Math.round(prev)}`),
    klass:'flat'
  };
}
function updateCard(card,r,key,label){
  if(!card)return false;
  const src=q('.ctCmSrc',card),name=q('.ctCmMacroName',card),valueEl=q('.ctCmMacroValue',card),moveEl=q('.ctCmMacroMove',card);
  if(name&&label)name.textContent=label;
  if(src)src.textContent=sourceLabel(r?.source);
  let value=marketVal(r,key),move=pct(r?.change_pct),klass=cls(r?.change_pct);
  if(key==='FEAR_GREED'){
    const s=sentiment(r);value=s.value;move=s.move;klass=s.klass;
  }
  if(valueEl)valueEl.textContent=value;
  if(moveEl){moveEl.textContent=move;moveEl.classList.remove('up','down','flat');moveEl.classList.add(klass)}
  return hasValue(r);
}
function repairBaseMarketCards(grid,items){
  const cards=qa('.ctCmMacroCard:not([data-ct-market-v30])',grid);
  const byLabel=new Map();
  for(const card of cards){const label=q('.ctCmMacroName',card)?.textContent?.trim();if(label)byLabel.set(label,card)}
  let repaired=0;
  for(const [key,label] of BASE_MARKET){
    const r=items[key]||{};
    if(!hasValue(r))continue;
    const card=byLabel.get(label);
    if(card&&updateCard(card,r,key,label))repaired++;
  }
  if(repaired){S.market_repairs+=repaired;S.last_market_repair=new Date().toISOString()}
}
function augmentMarketCards(){
  const panel=q('#panel-consultant'),grid=q('.ctCmMacro',panel||document);if(!panel||!grid)return false;
  const market=mergedMarket();
  const items=market.items||{};
  repairBaseMarketCards(grid,items);
  let touched=0;
  for(const [key,label] of MARKET_EXTRA){
    let card=grid.querySelector(`[data-ct-market-v30="${key}"]`);
    if(!card){card=document.createElement('div');card.className='ctCmMacroCard';card.dataset.ctMarketV30=key;card.innerHTML='<div class="ctCmMacroTop"><span class="ctCmMacroName"></span><span class="ctCmSrc"></span></div><div class="ctCmMacroValue">—</div><div class="ctCmMacroMove flat">—</div>';grid.appendChild(card)}
    updateCard(card,items[key]||{},key,label);touched++;
  }
  const sub=q('.ctCmSub',panel);
  if(sub&&items.DOW30)sub.textContent='송팀장 Consultant View · 주요 지수 + 유가 + 시장심리 + 마스터시트 섹터 Watchlist';
  if(touched){S.market_augments+=touched;S.last_market_augment=new Date().toISOString()}
  S.market_merge=market._ct_merge;
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
window.addEventListener('click',intercept,true);
window.addEventListener('keydown',e=>{
  if((e.key==='Enter'||e.key===' ')&&isConsultantTarget(e))intercept(e);
},true);
try{
  let pending=false;
  new MutationObserver(()=>{
    if(pending)return;pending=true;
    requestAnimationFrame(()=>{pending=false;augmentMarketCards()});
  }).observe(document.documentElement,{subtree:true,childList:true});
}catch(_){ }
document.addEventListener('jjooni:live-applied',()=>setTimeout(augmentMarketCards,0));
setTimeout(augmentMarketCards,500);
})();