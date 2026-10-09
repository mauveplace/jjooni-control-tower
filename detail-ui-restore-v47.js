(function(){
'use strict';
if(window.__JJOONI_DETAIL_UI_RESTORE_V47)return;
const STATE={state:'BOOTING',version:'47.0',tabs:0,labels_fixed:0,updated_at:null};
window.__JJOONI_DETAIL_UI_RESTORE_V47=STATE;
const q=(s,r=document)=>{try{return r.querySelector(s)}catch(_){return null}};
const qa=(s,r=document)=>{try{return Array.from(r.querySelectorAll(s))}catch(_){return []}};
const retired=name=>['ai','autobot'].includes(String(name||'').trim().toLowerCase());
function style(){
 let s=q('#ctDetailUiRestoreV47Style');if(s)return;
 s=document.createElement('style');s.id='ctDetailUiRestoreV47Style';s.textContent=`
@media(max-width:767px){
 .tabs{display:flex!important;grid-template-columns:none!important;gap:4px!important;overflow-x:auto!important;overflow-y:hidden!important;height:56px!important;padding:4px 7px!important;scrollbar-width:none!important}
 .tabs::-webkit-scrollbar{display:none!important}
 .tabs>.tab[data-tab]{display:flex!important;flex:0 0 auto!important;min-width:82px!important;width:auto!important;height:48px!important;padding:4px 9px!important;align-items:center!important;justify-content:center!important;font-size:10px!important;line-height:1.15!important;white-space:nowrap!important}
 .tabs>.tab[data-tab="ai"]{display:none!important}
 #ctMoreTab,#ctMoreMenu{display:none!important}
}
`;(document.head||document.documentElement).appendChild(s);
}
function cleanTabs(){
 const tabs=q('.tabs');if(!tabs)return;
 qa('.tab[data-tab]',tabs).forEach(t=>{const id=String(t.dataset.tab||'').toLowerCase();const text=String(t.textContent||'').trim().toUpperCase();if(retired(id)||text.includes('AUTOBOT')||text==='AI BOT'){t.style.setProperty('display','none','important');return}if(innerWidth<=767)t.style.removeProperty('display')});
 const m=q('#ctMoreTab');if(m)m.remove();const menu=q('#ctMoreMenu');if(menu)menu.remove();
 STATE.tabs=qa('.tab[data-tab]',tabs).filter(t=>!retired(t.dataset.tab)&&String(t.textContent||'').trim().toUpperCase()!=='AI BOT').length;
}
function fixFiveAccountLabels(){
 let n=0;
 qa('h1,h2,h3,h4,div,span,p,small,b,strong').forEach(e=>{
  if(e.children.length)return;const raw=String(e.textContent||'');if(!raw.includes('6계좌'))return;const next=raw.replaceAll('6계좌','5계좌');if(next!==raw){e.textContent=next;n++}
 });
 STATE.labels_fixed=n;
}
function apply(){
 style();cleanTabs();fixFiveAccountLabels();
 STATE.state='ACTIVE';STATE.updated_at=new Date().toISOString();
 document.documentElement.dataset.ctDetailUi='restored-v47';
}
let queued=false;function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply()})}
apply();setTimeout(apply,250);setTimeout(apply,900);setTimeout(apply,2200);
document.addEventListener('jjooni:live-applied',schedule);window.addEventListener('resize',schedule,{passive:true});
const root=document.documentElement;try{new MutationObserver(schedule).observe(root,{subtree:true,childList:true,characterData:true})}catch(_){}
})();
