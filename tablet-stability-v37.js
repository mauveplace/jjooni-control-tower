(function(){
'use strict';
if(window.__JJOONI_TABLET_STABILITY_V37)return;
const S={state:'BOOTING',version:'37.1',tab_repairs:0,applies:0};
window.__JJOONI_TABLET_STABILITY_V37=S;
const q=(s,r=document)=>{try{return r.querySelector(s)}catch(_){return null}};
const qa=(s,r=document)=>{try{return Array.from(r.querySelectorAll(s))}catch(_){return[]}};
function isTablet(){
  const touch=(navigator.maxTouchPoints||0)>0||window.matchMedia('(pointer:coarse)').matches||document.documentElement.classList.contains('ctTouchTablet');
  return touch&&Math.min(window.innerWidth,window.innerHeight)>=600;
}
function ensureStyle(){
 if(q('#ctTabletStabilityV37Style'))return;
 const st=document.createElement('style');st.id='ctTabletStabilityV37Style';st.textContent=`
html.ctStableTabletV37 body{font-size:17px!important}
html.ctStableTabletV37 .tabs{width:210px!important;padding:108px 14px 20px!important;gap:9px!important}
html.ctStableTabletV37 .tabs:before{left:22px!important;font-size:21px!important}
html.ctStableTabletV37 .tabs:after{left:22px!important;top:76px!important;font-size:11px!important}
html.ctStableTabletV37 .tab,html.ctStableTabletV37 .tab[data-tab]{min-height:54px!important;padding:13px 12px!important;font-size:15px!important;line-height:1.25!important;border-radius:11px!important}
html.ctStableTabletV37 .app{margin-left:210px!important;width:calc(100% - 210px)!important;padding:0 22px 34px!important}
html.ctStableTabletV37 .tabPanel{font-size:17px!important;line-height:1.55!important}
html.ctStableTabletV37 button,html.ctStableTabletV37 [role="button"]{min-height:44px;font-size:14px!important;touch-action:manipulation}
html.ctStableTabletV37 small{font-size:14px!important;line-height:1.45!important}
html.ctStableTabletV37 :is(.ctWlSub,.ctWlMeta,.ctWlTicker,.ctWlTag,.ctCmSrc,.ctCmMacroMove,.ctTrSub,.ctTickerMeta,.ctSleeveMeta,.ctTrEventMeta,.ctTrEventEval,.ctA8Sub,.ctA8Line,.ctA8Source,.ctP8Sub,.ctP8Line,.ctP8Source,.ctTpLabel,.ctTpNote,.ctD8Sub,.ctD8Meta,.ctD8Now,.ctD8Kpi span,.ctD8Kpi small){font-size:14px!important;line-height:1.45!important}
html.ctStableTabletV37 :is(.ctWlName,.ctCmMacroName,.ctTickerName,.ctSleeveName,.ctA8Name,.ctP8Name,.ctD8Name){font-size:17px!important;line-height:1.35!important}
html.ctStableTabletV37 :is(.ctCmMacroValue,.ctA8Nav,.ctP8Nav,.ctD8Kpi b){font-size:24px!important;line-height:1.2!important}
html.ctStableTabletV37 :is(.ctWlBtn,.ctTrChip,.ctD8Btn){font-size:14px!important;min-height:42px!important;padding:9px 12px!important}

/* Touch tablets use the full interactive trade-review renderer, not the compact
   desktop replacement. Keep all tap targets and P&L text readable. */
html.ctStableTabletV37 #panel-trades>#ctDesktopTradeReviewV8,
html.ctStableTabletV37 #panel-accounts>#ctDesktopAccountsV8,
html.ctStableTabletV37 #panel-performance>#ctDesktopPerformanceV8{display:none!important}
html.ctStableTabletV37 #ctTradeReviewV2{display:block!important;margin:12px 0 30px!important;font-family:system-ui,-apple-system,'Noto Sans KR',sans-serif;color:#172033}
html.ctStableTabletV37 #ctTradeReviewV2 .ctTrHead{margin:8px 2px 16px!important}
html.ctStableTabletV37 #ctTradeReviewV2 .ctTrTitle{font-size:30px!important;line-height:1.18!important;font-weight:900!important;color:#14243a!important}
html.ctStableTabletV37 #ctTradeReviewV2 .ctTrSub{font-size:16px!important;line-height:1.5!important;color:#667085!important;margin-top:5px!important}
html.ctStableTabletV37 #ctTradeReviewV2 .ctTrToolbar{display:flex!important;justify-content:space-between!important;gap:12px!important;align-items:flex-start!important;flex-wrap:wrap!important;margin-bottom:14px!important}
html.ctStableTabletV37 #ctTradeReviewV2 .ctTrFilters,html.ctStableTabletV37 #ctTradeReviewV2 .ctTrSorts{display:flex!important;gap:8px!important;flex-wrap:wrap!important}
html.ctStableTabletV37 #ctTradeReviewV2 .ctTrChip{border:1px solid #d8e1ea!important;background:#fff!important;color:#475467!important;border-radius:999px!important;padding:10px 14px!important;font-size:15px!important;font-weight:850!important;min-height:44px!important}
html.ctStableTabletV37 #ctTradeReviewV2 .ctTrChip.on{background:#0b2f5d!important;color:#fff!important;border-color:#0b2f5d!important}
html.ctStableTabletV37 #ctTradeReviewV2 .ctTicker{background:#fff!important;border:1px solid #dfe6ee!important;border-radius:16px!important;margin-bottom:11px!important;overflow:hidden!important;box-shadow:0 4px 14px rgba(12,31,54,.05)!important}
html.ctStableTabletV37 #ctTradeReviewV2 .ctTickerHead{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:12px!important;padding:14px 16px!important;min-height:72px!important;align-items:center!important;cursor:pointer!important}
html.ctStableTabletV37 #ctTradeReviewV2 .ctTickerName{font-size:20px!important;line-height:1.3!important;font-weight:900!important;color:#101828!important;white-space:normal!important}
html.ctStableTabletV37 #ctTradeReviewV2 .ctTickerMeta{display:block!important;font-size:14px!important;line-height:1.45!important;color:#7d8b9d!important;margin-top:4px!important}
html.ctStableTabletV37 #ctTradeReviewV2 .ctTickerRight{display:flex!important;flex-direction:column!important;align-items:flex-end!important;gap:5px!important;text-align:right!important}
html.ctStableTabletV37 #ctTradeReviewV2 .ctTickerScore{font-size:16px!important;font-weight:900!important;color:#101828!important;white-space:nowrap!important}
html.ctStableTabletV37 #ctTradeReviewV2 .ctTickerVerdict{font-size:14px!important;line-height:1.3!important;color:#667085!important;white-space:nowrap!important}
html.ctStableTabletV37 #ctTradeReviewV2 .ctTickerBody{display:none!important;border-top:1px solid #edf1f5!important;background:#f8fafc!important;padding:12px!important}
html.ctStableTabletV37 #ctTradeReviewV2 .ctTicker.open .ctTickerBody{display:block!important}
html.ctStableTabletV37 #ctTradeReviewV2 .ctSleeve{background:#fff!important;border:1px solid #e1e7ee!important;border-radius:14px!important;margin-bottom:10px!important;overflow:hidden!important}
html.ctStableTabletV37 #ctTradeReviewV2 .ctSleeveHead{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:12px!important;padding:13px 15px!important;align-items:center!important;cursor:pointer!important}
html.ctStableTabletV37 #ctTradeReviewV2 .ctSleeveName{font-size:18px!important;font-weight:900!important;color:#101828!important}
html.ctStableTabletV37 #ctTradeReviewV2 .ctSleeveMeta{font-size:14px!important;line-height:1.4!important;color:#7d8b9d!important;margin-top:3px!important}
html.ctStableTabletV37 #ctTradeReviewV2 .ctSleeveRight{text-align:right!important}
html.ctStableTabletV37 #ctTradeReviewV2 .ctSleeveRet{font-size:17px!important;font-weight:900!important}
html.ctStableTabletV37 #ctTradeReviewV2 .ctSleeveVerdict{font-size:14px!important;color:#667085!important;margin-top:3px!important}
html.ctStableTabletV37 #ctTradeReviewV2 .ctSleeveDetail{display:none!important;border-top:1px solid #edf1f5!important;background:#fbfcfe!important;padding:12px 14px!important}
html.ctStableTabletV37 #ctTradeReviewV2 .ctSleeve.open .ctSleeveDetail{display:block!important}
html.ctStableTabletV37 #ctTradeReviewV2 .ctTrMetric{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:12px!important;padding:8px 0!important;font-size:15px!important;line-height:1.45!important;color:#475467!important}
html.ctStableTabletV37 #ctTradeReviewV2 .ctTrMetric b{color:#101828!important}
html.ctStableTabletV37 #ctTradeReviewV2 .ctTrTimeline{margin-top:10px!important;border-top:1px dashed #dce4ec!important;padding-top:8px!important}
html.ctStableTabletV37 #ctTradeReviewV2 .ctTrEvent{padding:9px 0!important;border-bottom:1px solid #f0f3f6!important}
html.ctStableTabletV37 #ctTradeReviewV2 .ctTrEventMain{display:grid!important;grid-template-columns:58px 48px minmax(0,1fr) auto!important;gap:8px!important;font-size:15px!important;line-height:1.4!important;color:#475467!important}
html.ctStableTabletV37 #ctTradeReviewV2 .ctTrEventEval,html.ctStableTabletV37 #ctTradeReviewV2 .ctTrEventMeta{font-size:14px!important;line-height:1.45!important;margin-top:4px!important;padding-left:114px!important}
html.ctStableTabletV37 #ctTradeReviewV2 .ctTrEmpty{background:#fff!important;border:1px dashed #d0d5dd!important;border-radius:14px!important;padding:22px!important;text-align:center!important;color:#667085!important;font-size:16px!important}

/* Account/performance drilldowns retain the original interactive DOM. */
html.ctStableTabletV37 #accountDrillModal :is(.label,.v2Label,[class*="Label"]){font-size:16px!important;line-height:1.4!important}
html.ctStableTabletV37 #accountDrillModal :is(.value,.v2Value,[class*="Value"]){font-size:21px!important;line-height:1.3!important}
html.ctStableTabletV37 #accountDrillModal :is(td,th,li,p,small){font-size:16px!important;line-height:1.5!important}
@media (orientation:portrait){
 html.ctStableTabletV37 .tabs{width:188px!important}
 html.ctStableTabletV37 .app{margin-left:188px!important;width:calc(100% - 188px)!important;padding-left:18px!important;padding-right:18px!important}
 html.ctStableTabletV37 .tab,html.ctStableTabletV37 .tab[data-tab]{font-size:14px!important}
 html.ctStableTabletV37 #ctTradeReviewV2 .ctTrTitle{font-size:27px!important}
 html.ctStableTabletV37 #ctTradeReviewV2 .ctTickerName{font-size:19px!important}
}
`;(document.head||document.documentElement).appendChild(st);
}
function forceTab(name){
 if(!isTablet()||!name)return false;
 const tab=q('.tab[data-tab="'+CSS.escape(name)+'"]');
 const panel=document.getElementById('panel-'+name);
 if(!panel)return false;
 qa('.tabPanel').forEach(p=>{
   p.classList.toggle('on',p===panel);
   if(p===panel){p.style.setProperty('display','block','important');delete p.dataset.ctConsultantHidden}
   else{p.style.removeProperty('display');delete p.dataset.ctConsultantHidden}
 });
 qa('.tab[data-tab]').forEach(t=>t.classList.toggle('on',t===tab));
 try{sessionStorage.setItem('jjooni_ct_active_tab_v1',name)}catch(_){}
 S.tab_repairs++;S.last_tab=name;S.last_tab_at=new Date().toISOString();
 return true;
}
function apply(){
 const html=document.documentElement,on=isTablet();
 html.classList.toggle('ctStableTabletV37',on);
 if(!on){S.state='INACTIVE_NON_TABLET';return}
 ensureStyle();
 const active=q('.tab.on[data-tab]');
 if(active&&document.getElementById('panel-'+active.dataset.tab))forceTab(active.dataset.tab);
 S.state='ACTIVE';S.applies++;S.last_apply=new Date().toISOString();
}
let lastPointer=0;
document.addEventListener('pointerup',e=>{
 if(!isTablet())return;const t=e.target?.closest?.('.tab[data-tab],#ctMoreMenu button[data-tab]');if(!t)return;
 lastPointer=Date.now();setTimeout(()=>forceTab(t.dataset.tab),0);
},true);
document.addEventListener('click',e=>{
 if(!isTablet())return;const t=e.target?.closest?.('.tab[data-tab],#ctMoreMenu button[data-tab]');if(!t)return;
 if(Date.now()-lastPointer<500)return;setTimeout(()=>forceTab(t.dataset.tab),0);
},true);
document.addEventListener('jjooni:live-applied',()=>setTimeout(apply,0));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(apply,0)});
window.addEventListener('resize',()=>setTimeout(apply,50),{passive:true});
setTimeout(apply,0);setTimeout(apply,700);setTimeout(apply,1800);
})();