(function(){
'use strict';
if(window.__JJOONI_MOBILE_STABILITY_V4)return;
window.__JJOONI_MOBILE_STABILITY_V4={state:'BOOTING',version:'4.2'};

const qs=(s,r=document)=>{try{return r.querySelector(s)}catch(_){return null}};
const qsa=(s,r=document)=>{try{return Array.from(r.querySelectorAll(s))}catch(_){return []}};
let lastPointerAt=0,wrapping=false;
const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null};
const won=v=>'₩'+Math.round(Math.abs(Number(v)||0)).toLocaleString('ko-KR');
const signed=v=>{const x=Number(v)||0;return (x>=0?'+':'-')+won(x)};

function mobile(){return window.matchMedia('(max-width:767px)').matches}
function activeTab(){return qs('.tab.on[data-tab]')?.dataset?.tab||''}
function normText(e){return String(e&&e.textContent||'').trim().replace(/\s+/g,' ')}

function ensureStyle(){
 if(qs('#ctMobileStabilityV4Style'))return;
 const st=document.createElement('style');st.id='ctMobileStabilityV4Style';st.textContent=`
@supports(height:100dvh){
 body{min-height:100dvh!important}
 @media(min-width:768px) and (max-width:1199px){.tabs{height:100dvh!important}}
}
@media(max-width:767px){
 .top{background:linear-gradient(180deg,#05172e,#061d3b)!important;isolation:isolate!important}
 #ctEncryptedLiveBadge{position:absolute!important;right:10px!important;top:50%!important;bottom:auto!important;transform:translateY(-50%)!important;z-index:4!important;margin:0!important;box-shadow:none!important;background:#0b294d!important;border-color:#38597d!important;color:#eaf3ff!important;max-width:122px!important;overflow:hidden!important;text-overflow:ellipsis!important}
 #ctHeroScopeWarning{display:none!important}
 #ctHeroTrustStripV4{min-height:30px;height:30px;display:flex;align-items:center;gap:5px;flex-wrap:nowrap;overflow:hidden;margin-top:6px}
 #ctHeroTrustStripV4 .ctTrustBadge{margin:0!important;font-size:10px!important;padding:4px 7px!important;background:rgba(255,255,255,.08)!important;border-color:rgba(255,255,255,.14)!important;color:#e7eef8!important}
 #ctMobileNetSummaryV4{margin:0 0 11px;padding:0 0 11px;border-bottom:1px solid rgba(255,255,255,.12)}
 #ctMobileNetSummaryV4 .ctNetLabel{font-size:10px;line-height:1;color:#9fb2c9;font-weight:800;letter-spacing:.02em}
 #ctMobileNetSummaryV4 .ctNetValue{font-size:30px;line-height:1.05;color:#fff;font-weight:950;letter-spacing:-.045em;margin-top:4px;white-space:nowrap}
 #ctMobileNetSummaryV4 .ctNetMeta{font-size:10px;line-height:1.35;color:#aebfd2;margin-top:5px}
 .ctOvPrimary .ctOvBig{font-size:26px!important}
 #ctTodayNetStrip{display:none!important}
 #ctMoreBackdropV4{position:fixed;inset:0;z-index:100040;background:rgba(2,10,22,.56);backdrop-filter:blur(1.5px);display:none}
 #ctMoreBackdropV4.open{display:block}
 #ctMoreMenu{position:fixed!important;left:10px!important;right:10px!important;top:auto!important;bottom:calc(70px + env(safe-area-inset-bottom))!important;z-index:100060!important;max-height:min(62dvh,520px)!important;overflow:auto!important;background:#071a33!important;border:1px solid #315273!important;border-radius:18px!important;padding:10px!important;box-shadow:0 22px 70px rgba(0,0,0,.48)!important;grid-template-columns:1fr 1fr!important;gap:7px!important}
 #ctMoreMenu button{min-height:48px!important;font-size:12px!important;text-align:center!important}
}
`;(document.head||document.documentElement).appendChild(st);
}

function trustKind(raw){
 const s=String(raw||'').toUpperCase();
 if(s.includes('BROKER')||s==='FULL'||s==='LIVE')return 'measured';
 if(s.includes('MODEL')||s.includes('MODELED')||s.includes('MTM')||s.includes('ACCOUNTING'))return 'modeled';
 return 'reference';
}

function updateNetSummary(){
 if(!mobile())return;
 const C=window.__JJOONI_CANONICAL_SSOT,h=qs('.ctOvPrimary');if(!C||!h)return;
 let box=qs('#ctMobileNetSummaryV4',h);
 if(!box){box=document.createElement('div');box.id='ctMobileNetSummaryV4';h.insertBefore(box,h.firstChild)}
 const nav=n(C.total&&C.total.nav),pnl=n(C.total&&C.total.today_pnl),count=n(C.total&&C.total.account_count);
 const html=`<div class="ctNetLabel">총자산${count!=null?' · '+count+'계좌':''}</div><div class="ctNetValue">${nav==null?'—':won(nav)}</div><div class="ctNetMeta">오늘 투자손익 ${pnl==null?'—':signed(pnl)}</div>`;
 if(box.innerHTML!==html)box.innerHTML=html;
}

function updateTrustStrip(){
 if(!mobile())return;
 const C=window.__JJOONI_CANONICAL_SSOT,h=qs('.ctOvPrimary');if(!C||!h)return;
 let strip=qs('#ctHeroTrustStripV4',h);
 if(!strip){strip=document.createElement('div');strip.id='ctHeroTrustStripV4';h.appendChild(strip)}
 const ids=['TOSS','ISA','PENSION','IRP','AI','TRIPOD'];
 const rows=ids.map(id=>{const c=(C.accounts||{})[id]||{};return {id,raw:String(c.quality||c.source||'NO_DATA')}});
 const counts={measured:0,modeled:0,reference:0};rows.forEach(x=>counts[trustKind(x.raw)]++);
 const bits=[];
 if(counts.measured)bits.push(`<span class="ctTrustBadge measured">● 실측 ${counts.measured}</span>`);
 if(counts.modeled)bits.push(`<span class="ctTrustBadge modeled">◐ 추정 ${counts.modeled}</span>`);
 if(counts.reference)bits.push(`<span class="ctTrustBadge reference">○ 참고 ${counts.reference}</span>`);
 const html=bits.join('');if(strip.innerHTML!==html)strip.innerHTML=html;
 strip.title=rows.map(x=>x.id+':'+x.raw).join(' · ');
}

function dockLiveBadge(){
 if(!mobile())return;
 const top=qs('.top'),b=qs('#ctEncryptedLiveBadge');if(!top||!b)return;
 if(b.parentNode!==top)top.appendChild(b);
}

function ensureMoreSheet(){
 const menu=qs('#ctMoreMenu');if(!menu)return;
 let dim=qs('#ctMoreBackdropV4');
 if(!dim){dim=document.createElement('div');dim.id='ctMoreBackdropV4';document.body.appendChild(dim);dim.addEventListener('click',()=>{menu.classList.remove('open');dim.classList.remove('open');const m=qs('#ctMoreTab');if(m)m.setAttribute('aria-expanded','false')})}
 const sync=()=>dim.classList.toggle('open',menu.classList.contains('open')&&mobile());
 if(!menu.dataset.stabilityObserved){new MutationObserver(sync).observe(menu,{attributes:true,attributeFilter:['class']});menu.dataset.stabilityObserved='1'}
 sync();
}

function hideRawHeroLog(){const e=qs('#ctHeroScopeWarning');if(e)e.setAttribute('aria-hidden','true')}

function captureAnchor(){
 if(!mobile())return null;
 const x=Math.round(window.innerWidth/2),y=Math.min(300,Math.max(150,Math.round(window.innerHeight*.32)));
 let e=document.elementFromPoint(x,y);
 const panel=qs('.panel.on')||document.body;
 while(e&&e!==panel&&e!==document.body){
   const r=e.getBoundingClientRect(),text=normText(e),cls=String(e.className||'').trim().split(/\s+/).find(Boolean)||'';
   if(r.height>=28&&text.length>=6&&(e.id||e.dataset?.account||e.dataset?.ticker||cls)){
     return {id:e.id||'',account:e.dataset?.account||'',ticker:e.dataset?.ticker||'',cls,text:text.slice(0,64),top:r.top};
   }
   e=e.parentElement;
 }
 return null;
}
function resolveAnchor(a){
 if(!a)return null;
 if(a.id){const e=document.getElementById(a.id);if(e)return e}
 if(a.account){const e=qs('[data-account="'+CSS.escape(a.account)+'"]');if(e)return e}
 if(a.ticker){const e=qs('[data-ticker="'+CSS.escape(a.ticker)+'"]');if(e)return e}
 if(a.cls){
   const items=qsa('.'+CSS.escape(a.cls));
   const sig=a.text.slice(0,26);const hit=items.find(e=>normText(e).startsWith(sig)||normText(e).includes(sig));if(hit)return hit;
 }
 return null;
}
function restoreViewport(y,tab,anchor,bottomGap){
 if(activeTab()!==tab)return;
 const a=resolveAnchor(anchor);
 if(a){const delta=a.getBoundingClientRect().top-anchor.top;if(Math.abs(delta)>2)window.scrollBy(0,delta);return}
 const max=Math.max(0,document.documentElement.scrollHeight-window.innerHeight);
 const target=bottomGap!=null&&bottomGap<140?Math.max(0,max-bottomGap):Math.min(y,max);
 if(Math.abs((window.scrollY||0)-target)>2)window.scrollTo({top:target,left:0,behavior:'auto'});
}

function wrapRender(){
 if(wrapping)return;wrapping=true;
 try{
  const fn=window.render;if(typeof fn!=='function'||fn.__ctStableV4)return;
  function stableRender(){
   const y=window.scrollY||document.documentElement.scrollTop||0,tab=activeTab(),recentUser=Date.now()-lastPointerAt<900;
   const maxBefore=Math.max(0,document.documentElement.scrollHeight-window.innerHeight),bottomGap=Math.max(0,maxBefore-y);
   let stack='';try{stack=String(new Error().stack||'')}catch(_){}
   const polling=/renderAll|applyLive|refresh/i.test(stack);
   if(mobile()&&polling&&window.__JJOONI_LIVE_READY===true){
     const g=window.__JJOONI_MOBILE_RENDER_GUARD||{polling_full_render_skipped:0};g.polling_full_render_skipped=(g.polling_full_render_skipped||0)+1;g.last_skip_kst=new Date().toISOString();window.__JJOONI_MOBILE_RENDER_GUARD=g;
     return undefined;
   }
   const preserve=!recentUser&&y>120,anchor=preserve?captureAnchor():null;
   const out=fn.apply(this,arguments);
   if(preserve){
    const restore=()=>restoreViewport(y,tab,anchor,bottomGap);
    requestAnimationFrame(()=>requestAnimationFrame(restore));setTimeout(restore,90);setTimeout(restore,260);
   }
   return out;
  }
  stableRender.__ctStableV4=true;stableRender.__ctOriginal=fn;window.render=stableRender;
 }finally{wrapping=false}
}

function stabilizeTradeDefault(){
 const root=qs('#ctTradeReviewV2');if(!root||root.dataset.defaultCollapseV4)return;
 qsa('.ctTicker.open,.ctSleeve.open',root).forEach(e=>e.classList.remove('open'));
 root.dataset.defaultCollapseV4='1';
}

function clarifySortLabel(){const b=qs('#ctTradeReviewV2 [data-sort="error"]');if(b)b.textContent='오차율순'}

function apply(){
 ensureStyle();hideRawHeroLog();updateNetSummary();updateTrustStrip();dockLiveBadge();ensureMoreSheet();wrapRender();stabilizeTradeDefault();clarifySortLabel();
 window.__JJOONI_MOBILE_STABILITY_V4={state:'ACTIVE',version:'4.2',scroll_guard:true,polling_full_render_blocked:true,viewport_anchor_restore:true,hero_raw_log_hidden:true,trust_strip:true,total_asset_primary:true,more_bottom_sheet:true,dynamic_viewport:true};
}

document.addEventListener('pointerdown',()=>{lastPointerAt=Date.now()},{passive:true,capture:true});
document.addEventListener('touchstart',()=>{lastPointerAt=Date.now()},{passive:true,capture:true});
const mo=new MutationObserver(()=>{clearTimeout(mo._t);mo._t=setTimeout(apply,25)});mo.observe(document.documentElement,{subtree:true,childList:true});
window.addEventListener('resize',apply,{passive:true});
setTimeout(apply,0);setTimeout(apply,700);setTimeout(apply,1800);setInterval(()=>{if(!document.hidden)apply()},1200);
})();
