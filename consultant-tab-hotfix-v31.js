(function(){
'use strict';
if(window.__JJOONI_CONSULTANT_TAB_HOTFIX_V31)return;
const S={state:'ACTIVE',version:'31.0',activations:0};
window.__JJOONI_CONSULTANT_TAB_HOTFIX_V31=S;
const q=(s,r=document)=>{try{return r.querySelector(s)}catch(_){return null}};
const qa=(s,r=document)=>{try{return Array.from(r.querySelectorAll(s))}catch(_){return[]}};
function isConsultantTarget(e){
  try{
    const path=typeof e.composedPath==='function'?e.composedPath():[];
    for(const node of path){
      if(node?.matches?.('.tab[data-tab="consultant"],#ctMoreMenu button[data-tab="consultant"]'))return node;
    }
    return e.target?.closest?.('.tab[data-tab="consultant"],#ctMoreMenu button[data-tab="consultant"]')||null;
  }catch(_){return null}
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
})();
