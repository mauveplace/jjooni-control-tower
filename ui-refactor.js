(function(){
'use strict';

const PRIMARY_TABS=['overview','portfolio','compare','ai','accounts'];
const SECONDARY_TABS=['tripod','decisions','trades','quality','watchlist','cost'];
const PAGE_SIZE=30;
const STATE={tradeParent:null,tradeNodes:[],shown:PAGE_SIZE,tradeControls:null};

function mobile(){return window.matchMedia('(max-width:767px)').matches}
function qs(s,r=document){try{return r.querySelector(s)}catch(_){return null}}
function qsa(s,r=document){try{return Array.from(r.querySelectorAll(s))}catch(_){return []}}
function visible(e){return !!(e&&(e.offsetWidth||e.offsetHeight||e.getClientRects().length))}

function ensureStyle(){
 if(document.getElementById('ctUiRefactorStyle'))return;
 const st=document.createElement('style');
 st.id='ctUiRefactorStyle';
 st.textContent=`
@media(max-width:767px){
 .tabs{display:grid!important;grid-template-columns:repeat(6,minmax(0,1fr))!important;gap:3px!important;overflow:visible!important;height:56px!important;padding:4px 6px!important}
 .tabs>.tab[data-tab]{display:none!important;min-width:0!important;width:auto!important;height:48px!important;font-size:11px!important;line-height:1.15!important;padding:4px 3px!important;white-space:nowrap!important}
 .tabs>.tab[data-tab="overview"],.tabs>.tab[data-tab="portfolio"],.tabs>.tab[data-tab="compare"],.tabs>.tab[data-tab="ai"],.tabs>.tab[data-tab="accounts"]{display:flex!important}
 #ctMoreTab{display:flex!important;align-items:center;justify-content:center;min-width:0;width:auto;height:48px;border:0;border-radius:8px;background:transparent;color:#c3d1e2;font:800 11px/1.15 system-ui;cursor:pointer}
 #ctMoreTab.on{background:rgba(255,255,255,.1);color:#fff}
 #ctMoreMenu{position:fixed;left:10px;right:10px;bottom:66px;z-index:100050;background:#071a33;border:1px solid #244363;border-radius:14px;padding:8px;box-shadow:0 18px 50px rgba(0,0,0,.35);display:none;grid-template-columns:1fr 1fr;gap:6px}
 #ctMoreMenu.open{display:grid}
 #ctMoreMenu button{min-height:44px;border:1px solid rgba(255,255,255,.08);border-radius:10px;background:#0c294f;color:#eef6ff;font:800 12px/1.2 system-ui;text-align:left;padding:10px 12px}
 #ctMoreMenu button.active{background:#174a87}
 .ctTrustBadge{display:inline-flex;align-items:center;gap:4px;border-radius:999px;padding:3px 7px;margin:1px 3px 1px 0;font:800 11px/1.15 system-ui;white-space:nowrap}
 .ctTrustBadge.measured{background:#ecfdf3;color:#087443;border:1px solid #abefc6}
 .ctTrustBadge.modeled{background:#fff7ed;color:#b45309;border:1px solid #fed7aa}
 .ctTrustBadge.reference{background:#f2f4f7;color:#475467;border:1px solid #d0d5dd}
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
 const tabs=qs('.tabs');if(!tabs)return;
 let more=qs('#ctMoreTab');
 if(!more){
  more=document.createElement('button');more.type='button';more.id='ctMoreTab';more.textContent='더보기';more.setAttribute('aria-haspopup','menu');more.setAttribute('aria-expanded','false');tabs.appendChild(more);
 }
 let menu=qs('#ctMoreMenu');
 if(!menu){
  menu=document.createElement('div');menu.id='ctMoreMenu';menu.setAttribute('role','menu');document.body.appendChild(menu);
 }
 const labels={tripod:'TRI-POD',decisions:'의사결정',trades:'거래내역',quality:'데이터품질',watchlist:'시황/워치',cost:'COST'};
 if(!menu.dataset.ready){
  SECONDARY_TABS.forEach(name=>{const b=document.createElement('button');b.type='button';b.dataset.tab=name;b.textContent=labels[name]||name;b.setAttribute('role','menuitem');b.onclick=()=>{activateTab(name);menu.classList.remove('open');more.setAttribute('aria-expanded','false');syncMoreState()};menu.appendChild(b)});
  menu.dataset.ready='1';
 }
 more.onclick=()=>{const open=!menu.classList.contains('open');menu.classList.toggle('open',open);more.setAttribute('aria-expanded',String(open))};
 document.addEventListener('click',e=>{if(!menu.contains(e.target)&&e.target!==more){menu.classList.remove('open');more.setAttribute('aria-expanded','false')}},{capture:true,once:false});
 syncMoreState();
}

function syncMoreState(){
 const more=qs('#ctMoreTab'),menu=qs('#ctMoreMenu');if(!more||!menu)return;
 const active=qs('.tab.on[data-tab]');const name=active&&active.dataset.tab||'';const secondary=SECONDARY_TABS.includes(name);
 more.classList.toggle('on',secondary);
 qsa('button[data-tab]',menu).forEach(b=>b.classList.toggle('active',b.dataset.tab===name));
}

function trustKind(raw){
 const s=String(raw||'').toUpperCase();
 if(s.includes('BROKER')||s==='FULL')return ['measured','🟢 실측'];
 if(s.includes('MODEL')||s.includes('MODELED')||s.includes('MTM')||s.includes('ACCOUNTING'))return ['modeled','🟡 추정'];
 return ['reference','⚪ 참고'];
}
function badgeHtml(raw){const [k,l]=trustKind(raw);return '<span class="ctTrustBadge '+k+'" title="'+String(raw||'').replaceAll('"','&quot;')+'">'+l+'</span>'}

function compactHeroSources(){
 const e=qs('#ctHeroScopeWarning'),C=window.__JJOONI_CANONICAL_SSOT;if(!e||!C)return;
 const rows=(C.registry||[]).map(r=>{const c=(C.accounts||{})[r.id]||{};return {id:r.id,raw:String(c.quality||c.source||'NO_DATA')}});
 const buckets={measured:0,modeled:0,reference:0};rows.forEach(x=>buckets[trustKind(x.raw)[0]]++);
 const parts=[];if(buckets.measured)parts.push('<span class="ctTrustBadge measured" title="증권사/브로커 공식값">🟢 실측 '+buckets.measured+'</span>');if(buckets.modeled)parts.push('<span class="ctTrustBadge modeled" title="모델 계산값">🟡 추정 '+buckets.modeled+'</span>');if(buckets.reference)parts.push('<span class="ctTrustBadge reference" title="검증 미완료/참고값">⚪ 참고 '+buckets.reference+'</span>');
 e.innerHTML=parts.join('');e.title=rows.map(x=>x.id+':'+x.raw).join(' · ');
}

function compactAttribution(){
 const e=qs('#ctTossAttributionLine');if(!e)return;
 const raw=e.textContent||'';e.title=raw;
 if(/RECONCILED/i.test(raw))e.innerHTML='<span class="ctTrustBadge measured">🟢 귀속 대사</span>';
 else if(/UNATTRIBUTED/i.test(raw))e.innerHTML='<span class="ctTrustBadge reference">🔴 미귀속 존재</span>';
 else e.innerHTML='<span class="ctTrustBadge reference">⚪ 귀속 미검증</span>';
}

const DISPLAY_MAP=[
 ['YAHOO_FALLBACK_NONLIVE','⚪ 참고'],['ACCOUNTING_MARKET_PNL','🟡 추정'],['MTM · KIS_MARKET_QUOTE','🟡 추정'],['BROKER_LIVE_FULL','🟢 실측'],['MODELED_LIVE','🟡 추정'],['MODEL_LIVE','🟡 추정'],['NO_DATA','⚪ 미검증']
];
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

function resetTradeState(){STATE.tradeParent=null;STATE.tradeNodes=[];STATE.shown=PAGE_SIZE;if(STATE.tradeControls&&STATE.tradeControls.isConnected)STATE.tradeControls.remove();STATE.tradeControls=null}
function attachTradePager(group){
 resetTradeState();STATE.tradeParent=group.parent;STATE.tradeNodes=group.items.slice();STATE.shown=Math.min(PAGE_SIZE,STATE.tradeNodes.length);
 const frag=document.createDocumentFragment();STATE.tradeNodes.slice(STATE.shown).forEach(n=>frag.appendChild(n));STATE.detached=Array.from(frag.childNodes);
 const ctl=document.createElement('div');ctl.id='ctTradePager';ctl.className='ctTradePager';ctl.innerHTML='<span class="ctTradePagerText"></span><div class="ctTradePagerBtns"><button type="button" data-more>더 보기</button><button type="button" data-collapse>접기</button></div>';STATE.tradeControls=ctl;group.parent.insertBefore(ctl,group.parent.firstChild);
 const update=()=>{const txt=qs('.ctTradePagerText',ctl);if(txt)txt.textContent='최근 '+STATE.shown+'건 / 전체 '+STATE.tradeNodes.length+'건';const more=qs('[data-more]',ctl);if(more)more.disabled=STATE.shown>=STATE.tradeNodes.length};
 qs('[data-more]',ctl).onclick=()=>{const end=Math.min(STATE.shown+PAGE_SIZE,STATE.tradeNodes.length);for(let i=STATE.shown;i<end;i++)group.parent.appendChild(STATE.tradeNodes[i]);STATE.shown=end;update()};
 qs('[data-collapse]',ctl).onclick=()=>{if(STATE.shown<=PAGE_SIZE)return;for(let i=PAGE_SIZE;i<STATE.shown;i++)if(STATE.tradeNodes[i].isConnected)STATE.tradeNodes[i].remove();STATE.shown=Math.min(PAGE_SIZE,STATE.tradeNodes.length);update();ctl.scrollIntoView({block:'nearest'})};
 update();window.__JJOONI_TRADE_PAGINATION={state:'ACTIVE',total:STATE.tradeNodes.length,page_size:PAGE_SIZE,selector_hint:group.cls};
}
function paginateTrades(){
 if(!mobile())return;
 const panel=qs('#panel-trades');if(!panel||!visible(panel))return;
 if(STATE.tradeParent&&STATE.tradeParent.isConnected&&STATE.tradeControls&&STATE.tradeControls.isConnected)return;
 const group=candidateTradeGroup(panel);if(group)attachTradePager(group);else window.__JJOONI_TRADE_PAGINATION={state:'NO_REPEATED_GROUP'};
}

let busy=false;
function enforce(){if(busy)return;busy=true;try{ensureStyle();ensureMobileNav();syncMoreState();compactHeroSources();compactAttribution();compactLeafCodes();paginateTrades();window.__JJOONI_UI_REFACTOR={version:'1.0',mobile_nav:'5_PLUS_MORE',trust_badges:true,trade_pagination:window.__JJOONI_TRADE_PAGINATION||{state:'PENDING'}}}finally{busy=false}}
ensureStyle();
setTimeout(enforce,0);setTimeout(enforce,800);setTimeout(enforce,2200);
setInterval(()=>{if(!document.hidden)enforce()},1500);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)enforce()});
window.addEventListener('resize',()=>{if(!mobile()){const m=qs('#ctMoreMenu');if(m)m.classList.remove('open');resetTradeState()}enforce()},{passive:true});
})();
