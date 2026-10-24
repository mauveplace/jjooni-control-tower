(()=>{
'use strict';
const FRESH='./data/freshness-status.json',WATCH='./data/watchdog-status.json';
const ORDER=['market','kr_equity','us_supplement','energy','fx','metals','us_rates','kr_rates','jp_rates','crypto','pulse','fear_greed','fedwatch','tripod','sector','official_macro','calendar','audit','market_regime'];
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const tone=s=>{s=String(s||'').toUpperCase();if(['LIVE','HEALTHY','HEALTHY_NOOP','REPAIRED','PASS','FINAL'].includes(s))return'good';if(['FAIL','FAILED','ERROR','MISALIGNED','INCONSISTENT','AHEAD_OF_ANCHOR','REPAIR_FAILED','UNAVAILABLE'].includes(s))return'bad';return'warn'};
const age=v=>{if(!v)return'—';const ms=Date.now()-Date.parse(v);if(!Number.isFinite(ms))return'—';const m=Math.max(0,Math.round(ms/60000));if(m<60)return`${m}분 전`;const h=Math.floor(m/60);return h<48?`${h}시간 전`:`${Math.floor(h/24)}일 전`};
// A published LIVE verdict describes collection-time validity, not current spot freshness.
const effective=(key,raw)=>{
 const g={...(raw||{})};
 if(key==='market_regime'){if(g.state==='LIVE'&&Number.isFinite(Date.parse(g.as_of))&&Date.now()>Date.parse(g.as_of))g.state='EXPIRED';return g;}
 if(key!=='crypto')return g;
 const quotes=g.quotes||{},keys=['BTCUSD','ETHUSD'],limit=Number(g.max_age_seconds)||3600;
 const records=keys.map(k=>{
  const q=quotes[k]||{},stamp=Date.parse(q.quote_as_of_kst||'');
  const seconds=Number.isFinite(stamp)?(Date.now()-stamp)/1000:NaN;
  return {name:k,state:q.status,age:Number.isFinite(seconds)&&seconds>=-60?Math.max(0,seconds):null};
 });
 g.state=records.some(x=>x.age===null)?'UNAVAILABLE':records.some(x=>x.age>limit||x.state!=='LIVE')?'STALE':'LIVE';
 g.detail=records.map(x=>x.name+' '+(x.age===null?'시각 확인 불가':Math.floor(x.age/60)+'분 전')).join(' · ')+' · 화면 조회시각 기준';
 return g;
};
const tile=(key,g)=>{g=effective(key,g);const s=String(g?.state||'UNAVAILABLE').toUpperCase();const d=[g?.detail,g?.source,g?.generated_kst?`갱신 ${age(g.generated_kst)}`:null].filter(Boolean).join(' · ');return `<div class="obsFreshTile ${tone(s)}" data-fresh-key="${esc(key)}"><div><span>${esc(g?.label||key)}</span><b>${esc(s)}</b></div><strong>${esc(g?.as_of||'—')}</strong><small>${esc(d)}</small></div>`};
const watchTile=w=>{const s=String(w?.result||'PENDING_FIRST_RUN').toUpperCase();return `<div class="obsFreshTile ${tone(s)}" data-fresh-key="watchdog"><div><span>Watchdog</span><b>${esc(s)}</b></div><strong>${esc(w?.current?.observatory_session||'—')}</strong><small>${esc(w?.checked_kst?`점검 ${age(w.checked_kst)}`:'점검 기록 없음')}</small></div>`};
let lastStatus=null,lastWatch=null,busy=false;
function paint(){const grid=document.getElementById('obsFreshGrid');if(!grid||!lastStatus)return;grid.innerHTML=ORDER.map(k=>tile(k,(lastStatus.groups||{})[k])).join('')+watchTile(lastWatch||{});grid.dataset.fullMarketGroups='1';}
async function load(){if(busy)return;busy=true;try{const [a,b]=await Promise.allSettled([window.JjooniDataReads.read(FRESH),window.JjooniDataReads.read(WATCH)]);if(a.status==='fulfilled')lastStatus=a.value;if(b.status==='fulfilled')lastWatch=b.value;paint()}finally{busy=false}}
function attach(){const grid=document.getElementById('obsFreshGrid');if(!grid)return false;const mo=new MutationObserver(()=>{if(grid.querySelectorAll('.obsFreshTile').length<ORDER.length+1&&lastStatus)paint()});mo.observe(grid,{childList:true});load();return true}
let tries=0;const t=setInterval(()=>{tries++;if(attach()||tries>120)clearInterval(t)},250);setInterval(load,60000);
window.__JJOONI_FRESHNESS_ALL_GROUPS={version:'1.0',order:ORDER,contract:'ALL_MARKET_FAMILY_FRESHNESS_GRID_V1'};
})();
