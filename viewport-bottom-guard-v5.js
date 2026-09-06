(function(){
'use strict';
if(window.__JJOONI_VIEWPORT_BOTTOM_GUARD_V5)return;
window.__JJOONI_VIEWPORT_BOTTOM_GUARD_V5={state:'BOOTING',version:'5.0'};
const qs=(s,r=document)=>{try{return r.querySelector(s)}catch(_){return null}};
function mobile(){return window.matchMedia('(max-width:767px)').matches}
function activeTab(){return qs('.tab.on[data-tab]')?.dataset?.tab||''}
function restoreBottom(gap,tab){
 if(!mobile()||activeTab()!==tab)return;
 const max=Math.max(0,document.documentElement.scrollHeight-window.innerHeight),target=Math.max(0,max-gap);
 if(Math.abs((window.scrollY||0)-target)>2)window.scrollTo({top:target,left:0,behavior:'auto'});
}
function wrap(){
 const fn=window.render;if(typeof fn!=='function'||fn.__ctBottomGuardV5)return;
 function guardedRender(){
   const y=window.scrollY||document.documentElement.scrollTop||0,max=Math.max(0,document.documentElement.scrollHeight-window.innerHeight),gap=Math.max(0,max-y),tab=activeTab();
   const preserve=mobile()&&y>120&&gap<180;
   const out=fn.apply(this,arguments);
   if(preserve){const r=()=>restoreBottom(gap,tab);requestAnimationFrame(()=>requestAnimationFrame(r));setTimeout(r,100);setTimeout(r,280);setTimeout(r,520)}
   return out;
 }
 guardedRender.__ctBottomGuardV5=true;guardedRender.__ctOriginal=fn;window.render=guardedRender;
 window.__JJOONI_VIEWPORT_BOTTOM_GUARD_V5={state:'ACTIVE',version:'5.0',bottom_gap_preservation:true,dvh_supported:CSS.supports('height','100dvh')};
}
wrap();setTimeout(wrap,500);setTimeout(wrap,1600);document.addEventListener('jjooni:live-applied',wrap);
window.visualViewport?.addEventListener('resize',()=>{const s=window.__JJOONI_VIEWPORT_BOTTOM_GUARD_V5||{};s.last_visual_height=Math.round(window.visualViewport.height);s.last_resize_kst=new Date().toISOString();window.__JJOONI_VIEWPORT_BOTTOM_GUARD_V5=s},{passive:true});
})();
