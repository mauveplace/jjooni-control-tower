(function(){
'use strict';
if(window.__JJOONI_CONSULTANT_TAB_HOTFIX_V30)return;
const S={state:'ACTIVE',version:'30.0',activations:0};
window.__JJOONI_CONSULTANT_TAB_HOTFIX_V30=S;
const q=(s,r=document)=>{try{return r.querySelector(s)}catch(_){return null}};
const qa=(s,r=document)=>{try{return Array.from(r.querySelectorAll(s))}catch(_){return[]}};
function activate(){
  const tab=q('.tab[data-tab="consultant"]');
  const panel=q('#panel-consultant');
  if(!panel)return false;
  qa('.tab[data-tab]').forEach(t=>t.classList.toggle('on',t===tab));
  qa('[id^="panel-"]').forEach(p=>{
    const on=p===panel;
    p.classList.toggle('on',on);
    if(on){
      p.style.setProperty('display','block','important');
      p.removeAttribute('data-ct-consultant-hidden');
    }else{
      p.dataset.ctConsultantHidden='1';
      p.style.setProperty('display','none','important');
    }
  });
  const menu=q('#ctMoreMenu');
  if(menu){
    qa('button[data-tab]',menu).forEach(b=>b.classList.toggle('active',b.dataset.tab==='consultant'));
    menu.classList.remove('open');
  }
  const more=q('#ctMoreTab');
  if(more){more.classList.add('on');more.setAttribute('aria-expanded','false')}
  try{sessionStorage.setItem('jjooni_ct_active_tab_v1','consultant')}catch(_){}
  S.activations++;S.last_activation=new Date().toISOString();
  return true;
}
// Capture-phase delegation is intentional: legacy tab handlers can rebuild the tab strip
// and otherwise win the race after the consultant module's target listener has fired.
document.addEventListener('click',e=>{
  const t=e.target?.closest?.('.tab[data-tab="consultant"],#ctMoreMenu button[data-tab="consultant"]');
  if(!t)return;
  e.preventDefault();
  e.stopImmediatePropagation();
  activate();
  setTimeout(activate,0);
},true);
})();
