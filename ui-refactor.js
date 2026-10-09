(function(){
'use strict';

const PRIMARY_TABS=['overview','portfolio','trades','accounts','compare','tripod','decisions','quality','watchlist','cost'];
const SECONDARY_TABS=[];
const PAGE_SIZE=30;
const STATE={tradeParent:null,tradeNodes:[],shown:PAGE_SIZE,tradeControls:null,tradeAnchor:null};

function mobile(){return window.matchMedia('(max-width:767px)').matches}
function qs(s,r=document){try{return r.querySelector(s)}catch(_){return null}}
function qsa(s,r=document){try{return Array.from(r.querySelectorAll(s))}catch(_){return []}}
function visible(e){return !!(e&&(e.offsetWidth||e.offsetHeight||e.getClientRects().length))}

function ensureStyle(){
 if(document.getElementById('ctUiRefactorStyle'))return;
 const st=document.createElement('style');
 st.id='ctUiRefactorStyle';
 st.textContent=`
@media(min-width:768px){#ctMoreTab,#ctMoreMenu{display:none!important}}
@media(max-width:767px){
 .tabs{display:flex!important;grid-template-columns:none!important;gap:4px!important;overflow-x:auto!important;overflow-y:hidden!important;height:56px!important;padding:4px 7px!important;scrollbar-width:none!important}
 .tabs::-webkit-scrollbar{display:none!important}
 .tabs>.tab[data-tab]{display:flex!important;flex:0 0 auto!important;min-width:82px!important;width:auto!important;height:48px!important;font-size:10px!important;line-height:1.15!important;padding:4px 9px!important;white-space:nowrap!important;align-items:center!important;justify-content:center!important}
 .tabs>.tab[data-tab="ai"]{display:none!important}
 #ctMoreTab,#ctMoreMenu{display:none!important}
 .ctTrustBadge{display:inline-flex;align-items:center;gap:4px;border-radius:999px;padding:3px 7px;margin:1px 3px 1px 0;font:800 11px/1.15 system-ui;white-space:nowrap;background:rgba(127,127,127,.10);color:inherit;border:1px solid rgba(127,127,127,.28)}
 .ctTrustBadge.measured,.ctTrustBadge.modeled,.ctTrustBadge.reference{background:rgba(127,127,127,.10);color:inherit;border-color:rgba(127,127,127,.28)}
 #ctHeroScopeWarning{font-size:11px!important;line-height:1.6!important}
 #ctTossAttributionLine{font-size:11px!important}
 .ctTradePager{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:10px 0 12px;padding:9px 10px;border:1px solid #e5eaf0;border-radius:12px;background:#fff;color:#475467;font:800 11px/1.2 system-ui;position:sticky;top:60px;z-index:8}
 .ctTradePagerBtns{display:flex;gap:6px}.ctTradePager button{border:1px solid #d0d5dd;background:#f8fafc;color:#344054;border-radius:8px;padding:7px 9px;font:800 11px/1 system-ui}.ctTradePager button:disabled{opacity:.45}
}
`;
 (document.head||document.documentElement).appendChild(st);
}

function activateTab(name){
 const t=qs('.tab[data-tab="'+CSS.escape(name)+'"]');
 if(!t)return false;
 t.click();
 try{sessionStorage.setItem('jjooni_ct_active_tab_v1',name)}catch(_){}
 return true;
}

function ensureMobileNav(){
 const more=qs('#ctMoreTab'),menu=qs('#ctMoreMenu');if(more)more.remove();if(menu)menu.remove();
 const tabs=qs('.tabs');if(!tabs)return;
 qsa('.tab[data-tab]',tabs).forEach(t=>{const id=String(t.dataset.tab||'').toLowerCase(),txt=String(t.textContent||'').trim().toUpperCase();if(id==='ai'||txt==='AI BOT'||txt.includes('AUTOBOT'))t.style.setProperty('display','none','important');else if(mobile())t.style.removeProperty('display')});
}

function syncMoreState(){}

function trustKind(raw){
 const s=String(raw||'').toUpperCase();
 if(s.includes('BROKER')||s==='FULL')return ['measured','● 실측'];
 if(s.includes('MODEL')||s.includes('MODELED')||s.includes('MTM')||s.includes('ACCOUNTING'))return ['modeled','◐ 추정'];
 return ['reference','○ 참고'];
}

function compactHeroSources(){
 const e=qs('#ctHeroScopeWarning'),C=window.__JJOONI_CANONICAL_SSOT;if(!e||!C)return;
 const rows=(C.registry||[]).map(r=>{const c=(C.accounts||{})[r.id]||{};return {id:r.id,raw:String(c.quality||c.source||'NO_DATA')}});
 const buckets={measured:0,modeled:0,reference:0};rows.forEach(x=>buckets[trustKind(x.raw)[0]]++);
 const parts=[];if(buckets.measured)parts.push('<span class="ctTrustBadge measured" title="증권사/브로커 공식값">● 실측 '+buckets.measured+'</span>');if(buckets.modeled)parts.push('<span class="ctTrustBadge modeled" title="모델 계산값">◐ 추정 '+buckets.modeled+'</span>');if(buckets.reference)parts.push('<span class="ctTrustBadge reference" title="검증 미완료/참고값">○ 참고 '+buckets.reference+'</span>');
 e.innerHTML=parts.join('');e.title=rows.map(x=>x.id+':'+x.raw).join(' · ');
}

function compactAttribution(){
 const e=qs('#ctTossAttributionLine');if(!e)return;
 const raw=e.textContent||'';e.title=raw;
 if(/RECONCILED/i.test(raw))e.innerHTML='<span class="ctTrustBadge measured">● 귀속 대사</span>';
 else if(/UNATTRIBUTED/i.test(raw))e.innerHTML='<span class="ctTrustBadge reference">! 미귀속 존재</span>';
 else e.innerHTML='<span class="ctTrustBadge reference">○ 귀속 미검증</span>';
}

const DISPLAY_MAP=[
 ['YAHOO_FALLBACK_NONLIVE','○ 참고'],['ACCOUNTING_MARKET_PNL','◐ 추정'],['MTM · KIS_MARKET_QUOTE','◐ 추정'],['BROKER_LIVE_FULL','● 실측'],['MODELED_LIVE','◐ 추정'],['MODEL_LIVE','◐ 추정'],['NO_DATA','○ 미검증']
];
function normalizeFiveAccountLabels(){
 qsa('h1,h2,h3,h4,div,span,p,small,b,strong').forEach(e=>{if(e.children.length)return;const raw=String(e.textContent||'');if(raw.includes('6계좌'))e.textContent=raw.replaceAll('6계좌','5계좌')});
}

function compactLeafCodes(){
 qsa('body *').forEach(e=>{
  if(e.childElementCount||!visible(e))return;
  let t=(e.textContent||'').trim();if(!t||t.length>90)return;
  let out=t;for(const [a,b] of DISPLAY_MAP)out=out.replaceAll(a,b);
  if(out!==t){if(!e.title)e.title=t;e.textContent=out}
 });
}

function candidateTradeGroup(panel){
 let best=null;
 qsa('*',panel).forEach(parent=>{
  const kids=Array.from(parent.children||[]).filter(visible);if(kids.length<31)return;
  const groups=new Map();
  kids.forEach(k=>{if(k.id==='ctTradePager')return;const key=k.tagName+'|'+String(k.className||'');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(k)});
  groups.forEach(items=>{
   if(items.length<31)return;
   const heights=items.slice(0,12).map(x=>x.getBoundingClientRect().height).filter(x=>x>0);if(!heights.length)return;
   const avg=heights.reduce((a,b)=>a+b,0)/heights.length;if(avg<36||avg>600)return;
   const cls=String(items[0].className||'').toLowerCase();const score=items.length*Math.min(avg,220)*(cls.includes('trade')?2:1);
   if(!best||score>best.score)best={parent,items,score,avg,cls};
  });
 });
 return best;
}

function restoreTradeNodes(){
 const parent=STATE.tradeParent;if(!parent||!parent.isConnected||!STATE.tradeNodes.length)return;
 const anchor=STATE.tradeAnchor&&STATE.tradeAnchor.parentNode===parent?STATE.tradeAnchor:null;
 STATE.tradeNodes.forEach(n=>{if(!n.isConnected){if(anchor)parent.insertBefore(n,anchor);else parent.appendChild(n)}});
}
function resetTradeState(){
 restoreTradeNodes();
 if(STATE.tradeControls&&STATE.tradeControls.isConnected)STATE.tradeControls.remove();
 STATE.tradeParent=null;STATE.tradeNodes=[];STATE.shown=PAGE_SIZE;STATE.tradeControls=null;STATE.tradeAnchor=null;
}
function attachTradePager(group){
 resetTradeState();STATE.tradeParent=group.parent;STATE.tradeNodes=group.items.slice();STATE.shown=Math.min(PAGE_SIZE,STATE.tradeNodes.length);STATE.tradeAnchor=group.items[group.items.length-1].nextSibling;
 const frag=document.createDocumentFragment();STATE.tradeNodes.slice(STATE.shown).forEach(n=>frag.appendChild(n));
 const ctl=document.createElement('div');ctl.id='ctTradePager';ctl.className='ctTradePager';ctl.innerHTML='<span class="ctTradePagerText"></span><div class="ctTradePagerBtns"><button type="button" data-more>더 보기</button><button type="button" data-collapse>접기</button></div>';STATE.tradeControls=ctl;group.parent.insertBefore(ctl,group.items[0]);
 const insertTrade=n=>{const anchor=STATE.tradeAnchor&&STATE.tradeAnchor.parentNode===group.parent?STATE.tradeAnchor:null;if(anchor)group.parent.insertBefore(n,anchor);else group.parent.appendChild(n)};
 const update=()=>{const txt=qs('.ctTradePagerText',ctl);if(txt)txt.textContent='최근 '+STATE.shown+'건 / 전체 '+STATE.tradeNodes.length+'건';const more=qs('[data-more]',ctl);if(more)more.disabled=STATE.shown>=STATE.tradeNodes.length};
 qs('[data-more]',ctl).onclick=()=>{const end=Math.min(STATE.shown+PAGE_SIZE,STATE.tradeNodes.length);for(let i=STATE.shown;i<end;i++)insertTrade(STATE.tradeNodes[i]);STATE.shown=end;update()};
 qs('[data-collapse]',ctl).onclick=()=>{if(STATE.shown<=PAGE_SIZE)return;for(let i=PAGE_SIZE;i<STATE.shown;i++)if(STATE.tradeNodes[i].isConnected)STATE.tradeNodes[i].remove();STATE.shown=Math.min(PAGE_SIZE,STATE.tradeNodes.length);update();ctl.scrollIntoView({block:'nearest'})};
 update();window.__JJOONI_TRADE_PAGINATION={state:'ACTIVE',total:STATE.tradeNodes.length,page_size:PAGE_SIZE,selector_hint:group.cls};
}
function paginateTrades(){
 if(qs('#ctTradeReviewV2')){resetTradeState();window.__JJOONI_TRADE_PAGINATION={state:'SUPERSEDED_BY_TRADE_REVIEW_V2'};return;}
 if(!mobile())return;
 const panel=qs('#panel-trades');if(!panel||!visible(panel))return;
 if(STATE.tradeParent&&STATE.tradeParent.isConnected&&STATE.tradeControls&&STATE.tradeControls.isConnected)return;
 const group=candidateTradeGroup(panel);if(group)attachTradePager(group);else window.__JJOONI_TRADE_PAGINATION={state:'NO_REPEATED_GROUP'};
}

let busy=false;
function enforce(){if(busy)return;busy=true;try{ensureStyle();ensureMobileNav();syncMoreState();compactHeroSources();compactAttribution();compactLeafCodes();normalizeFiveAccountLabels();paginateTrades();window.__JJOONI_UI_REFACTOR={version:'1.6',mobile_nav:'FULL_SCROLL',primary_tabs:PRIMARY_TABS.slice(),secondary_tabs:SECONDARY_TABS.slice(),trust_badges:'SHAPE_ONLY',trade_pagination:window.__JJOONI_TRADE_PAGINATION||{state:'PENDING'}}}finally{busy=false}}
ensureStyle();
setTimeout(enforce,0);setTimeout(enforce,800);setTimeout(enforce,2200);
document.addEventListener('jjooni:live-applied',enforce);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)enforce()});
window.addEventListener('resize',()=>{if(!mobile()){const m=qs('#ctMoreMenu');if(m)m.classList.remove('open');resetTradeState()}enforce()},{passive:true});
})();
