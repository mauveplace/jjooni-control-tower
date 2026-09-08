(function(){
'use strict';
if(window.__JJOONI_DAILY_PERFORMANCE_ALIAS_V23)return;
const S={state:'BOOTING',version:'23.1',bound:0};
window.__JJOONI_DAILY_PERFORMANCE_ALIAS_V23=S;
const q=(s,r=document)=>{try{return r.querySelector(s)}catch(_){return null}};
const qa=(s,r=document)=>{try{return Array.from(r.querySelectorAll(s))}catch(_){return []}};
const norm=s=>String(s||'').replace(/\s+/g,' ').trim();
function accountId(){
 const m=q('#accountDrillModal');if(!m)return null;
 const t=norm(q('h1,h2,h3,.modalTitle,.title',m)?.textContent).toUpperCase();
 if(t.includes('AI BOT'))return'AI';if(t.includes('TRI-POD')||t.includes('TRIPOD'))return'TRIPOD';if(t.includes('연금'))return'PENSION';if(/\bISA\b/.test(t))return'ISA';if(/\bIRP\b/.test(t))return'IRP';if(t.includes('TOSS'))return'TOSS';
 return null;
}
function bind(){
 const m=q('#accountDrillModal'),id=accountId();if(!m||!id)return;
 let bound=0;
 qa('.v2Kpi',m).forEach(el=>{
   const label=norm(q('.label',el)?.textContent);
   if(label!=='당일 투자성과')return;
   delete el.dataset.autoDrill;delete el.dataset.metricDisabledV11;
   el.dataset.noAutoDrill='1';
   el.dataset.metricDrillV11='account';
   el.dataset.metricAccountV11=id;
   // The current UI label is '당일 투자성과'; the canonical V12 rows contract
   // calls the same metric '정규장 투자성과'. Keep the display label and map
   // only the internal drilldown key so the existing audited calculation is reused.
   el.dataset.metricLabelV11='정규장 투자성과';
   el.style.cursor='pointer';el.setAttribute('role','button');el.setAttribute('tabindex','0');
   bound++;
 });
 S.state='ACTIVE';S.bound=bound;S.account=id;S.updated_at=new Date().toISOString();
}
let queued=false;function schedule(){if(queued)return;queued=true;setTimeout(()=>{queued=false;bind()},40)}
document.addEventListener('jjooni:live-applied',schedule);
document.addEventListener('click',schedule,true);
try{new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','data-auto-drill','data-metric-disabled-v11']});}catch(_){}
setTimeout(bind,0);setTimeout(bind,300);setTimeout(bind,900);
})();

(function(){
'use strict';
if(window.__JJOONI_DAILY_PNL_ATTR_V27||document.getElementById('ctDailyPnlAttrV27Script'))return;
const st={state:'LOADING',version:'27.0',started_at:new Date().toISOString()};
window.__JJOONI_DAILY_PNL_ATTR_LOADER_V27=st;
const s=document.createElement('script');
s.id='ctDailyPnlAttrV27Script';
s.src='daily-pnl-attribution-v27.js?v=27.0&_='+Date.now();
s.async=false;
s.onload=()=>{st.state=window.__JJOONI_DAILY_PNL_ATTR_V27?.state||'LOADED';st.loaded_at=new Date().toISOString()};
s.onerror=()=>{st.state='LOAD_FAILED';st.failed_at=new Date().toISOString();console.error('DAILY_PNL_ATTR_V27_LOAD_FAILED')};
(document.head||document.documentElement).appendChild(s);
})();
