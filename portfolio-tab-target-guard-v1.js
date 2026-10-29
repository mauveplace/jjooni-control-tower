(function(root){
'use strict';
// The Control Tower has multiple legacy navigation owners. A portfolio tab
// tap must never be redirected to the neighboring TRI-POD strategy tab.
if(root.__JJOONI_PORTFOLIO_TAB_GUARD_V1)return;
const state={version:'1.1',bound:true,repairs:0,last_target:null,last_reason:null};
root.__JJOONI_PORTFOLIO_TAB_GUARD_V1=state;
if(!root.document)return;
const doc=root.document;
let generation=0;

function resolveTab(target){
 if(!target||typeof target.closest!=='function')return null;
 return target.closest('.tabs .tab[data-tab],#ctMoreMenu button[data-tab]');
}
function activatePortfolio(){
 const panel=doc.getElementById('panel-portfolio');
 const tab=doc.querySelector('.tabs .tab[data-tab="portfolio"]');
 const panels=Array.from(doc.querySelectorAll('.tabPanel[id^="panel-"]'));
 if(!panel||!tab||!panels.includes(panel)){state.last_reason='PORTFOLIO_PANEL_OR_TAB_NOT_FOUND';return false}
 for(const p of panels){
  const chosen=p===panel;
  p.classList.toggle('on',chosen);
  // A tablet recovery layer can leave display:block!important on TRI-POD.
  // Clear only that old inline display override; CSS owns normal layout.
  if(p.style.getPropertyPriority('display')==='important')p.style.removeProperty('display');
 }
 for(const t of doc.querySelectorAll('.tabs .tab[data-tab]')){
  const selected=t===tab;t.classList.toggle('on',selected);
  t.setAttribute?.('aria-current',selected?'page':'false');
 }
 // The capture guard bypasses legacy click handlers, including their title and
 // hash updates. Publish the complete destination, not just the panel class.
 const brand=doc.querySelector('.top .brand');
 if(brand&&brand.textContent!=='보유분석')brand.textContent='보유분석';
 try{if(root.location?.hash!=='#portfolio')root.history?.replaceState(root.history.state,'','#portfolio')}catch(_){}

 const menu=doc.getElementById('ctMoreMenu'),button=doc.getElementById('ctMoreTab');
 menu?.classList.remove('open');
 doc.getElementById('ctMoreBackdropV4')?.classList.remove('open');
 button?.setAttribute('aria-expanded','false');
 try{root.sessionStorage?.setItem('jjooni_ct_active_tab_v1','portfolio')}catch(_){}
 if(root.__JJOONI_TABLET_STABILITY_V37&&typeof root.__JJOONI_TABLET_STABILITY_V37==='object'){
  root.__JJOONI_TABLET_STABILITY_V37.last_tab='portfolio';
 }
 state.repairs++;state.last_target='portfolio';state.last_reason='AUTHORITATIVE_PORTFOLIO_TAP';
 return true;
}
function maintain(token){
 const run=()=>{if(token!==generation)return;activatePortfolio()};
 run();
 for(const ms of [0,75,250])root.setTimeout?.(run,ms);
}
// A new interaction with a different nav item cancels any delayed portfolio
// correction; navigating to TRI-POD explicitly must continue to work.
function cancelIfOther(e){
 const tab=resolveTab(e.target);
 if(tab&&tab.dataset.tab!=='portfolio')generation++;
}
root.addEventListener('pointerdown',cancelIfOther,true);
root.addEventListener('keydown',e=>{
 const tab=resolveTab(e.target);if(!tab)return;
 if(tab.dataset.tab!=='portfolio'){generation++;return}
 if(e.key!=='Enter'&&e.key!==' ')return;
 e.preventDefault();e.stopPropagation();e.stopImmediatePropagation?.();
 maintain(++generation);
},true);
root.addEventListener('click',e=>{
 const tab=resolveTab(e.target);if(!tab)return;
 if(tab.dataset.tab!=='portfolio'){generation++;return}
 // Handle exact tab ID before the legacy capture/bubble handlers. Avoid
 // synthetic .click(), which can re-enter an old tab-router mismatch.
 e.preventDefault();e.stopPropagation();e.stopImmediatePropagation?.();
 maintain(++generation);
},true);
})(typeof window!=='undefined'?window:globalThis);
