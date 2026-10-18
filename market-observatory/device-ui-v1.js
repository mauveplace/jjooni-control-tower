(()=>{
'use strict';
const tabs=document.getElementById('tabs');
if(!tabs)return;
document.body.classList.add('obsDeviceUI');
function sync(){
 const selected=tabs.querySelector('button.on[data-tab]');
 tabs.querySelectorAll('button[data-tab]').forEach(b=>b.setAttribute('aria-current',b===selected?'page':'false'));
}
tabs.addEventListener('click',e=>{
 const b=e.target.closest('button[data-tab]');if(!b)return;
 // Every menu has the same reload/share contract, including morning brief.
 history.replaceState(null,'','#'+b.dataset.tab);sync();
});
function fromHash(){
 let id;try{id=decodeURIComponent(location.hash.slice(1))}catch(_){return}
 if(!/^[a-z-]+$/.test(id))return; // Preserve Analysis Lab's encoded settings URL.
 const b=Array.from(tabs.querySelectorAll('button[data-tab]')).find(x=>x.dataset.tab===id);
 if(b&&!b.classList.contains('on'))b.click();sync();
}
window.addEventListener('hashchange',fromHash);
window.addEventListener('load',()=>{fromHash();sync()});
const observer=new MutationObserver(()=>{fromHash();sync()});observer.observe(tabs,{childList:true});
setTimeout(()=>observer.disconnect(),10000);
const menu=document.createElement('button');menu.type='button';menu.className='obsBackToMenu';menu.textContent='메뉴 ↑';menu.hidden=true;
menu.onclick=()=>tabs.scrollIntoView({block:'start',behavior:'smooth'});document.body.appendChild(menu);
let scrollPending=false;
window.addEventListener('scroll',()=>{if(scrollPending)return;scrollPending=true;requestAnimationFrame(()=>{menu.hidden=scrollY<500;scrollPending=false})},{passive:true});
sync();
})();
