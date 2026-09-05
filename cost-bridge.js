(function(){
'use strict';

const PANEL_ID='panel-cost';
const TAB_NAME='cost';
let LAST_KEY='';

const n=v=>{const x=Number(v);return Number.isFinite(x)?x:null};
const money=v=>n(v)==null?'—':'$'+n(v).toFixed(n(v)<10?2:1);
const integer=v=>n(v)==null?'—':Math.round(n(v)).toLocaleString('en-US');
const pct=v=>n(v)==null?'—':n(v).toFixed(1)+'%';
const duration=s=>{if(n(s)==null)return '—';const sec=Math.max(0,n(s));const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60);return h+'h '+m+'m'};
const ageText=m=>n(m)==null?'—':n(m)<60?Math.round(n(m))+'m':(n(m)/60).toFixed(1)+'h';

function ensureStyle(){
 if(document.getElementById('ctCostStyle'))return;
 const st=document.createElement('style');
 st.id='ctCostStyle';
 st.textContent=`
#panel-cost{max-width:1180px;margin:0 auto;padding-bottom:30px;color:#1d2939}
.ctCostHead{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;margin:10px 0 12px}.ctCostHead h2{margin:0;font-size:22px;letter-spacing:-.03em;color:#101828}.ctCostSub{font-size:10px;color:#7d8b9d;margin-top:3px}.ctCostStatus{padding:6px 9px;border-radius:999px;font:900 9px/1 system-ui;background:#ecfdf3;color:#087443;border:1px solid #abefc6}.ctCostStatus.warn{background:#fff7ed;color:#b54708;border-color:#fed7aa}.ctCostStatus.pending{background:#f2f4f7;color:#475467;border-color:#e4e7ec}
.ctCostHero{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-bottom:10px}.ctCostKpi,.ctCostCard{background:#fff;border:1px solid #e6ebf1;border-radius:15px;box-shadow:0 4px 18px rgba(16,24,40,.045)}.ctCostKpi{padding:13px}.ctCostLabel{font:800 9px/1.25 system-ui;color:#98a2b3;text-transform:uppercase;letter-spacing:.04em}.ctCostValue{font:950 25px/1.08 system-ui;color:#101828;margin-top:7px;letter-spacing:-.04em}.ctCostMini{font:750 9px/1.35 system-ui;color:#667085;margin-top:5px}
.ctCostGrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.ctCostCard{padding:14px}.ctCostCard h3{margin:0 0 10px;font-size:13px;color:#101828}.ctCostRow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;padding:8px 0;border-bottom:1px solid #f0f2f5;font:750 10px/1.3 system-ui;color:#667085}.ctCostRow:last-child{border-bottom:0}.ctCostRow b{font-size:10px;color:#344054;text-align:right}.ctCostBar{height:7px;background:#f2f4f7;border-radius:999px;overflow:hidden;margin-top:8px}.ctCostBar>i{display:block;height:100%;background:#2167d5;border-radius:999px;max-width:100%}.ctCostAlert{padding:9px 10px;border-radius:10px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;font:750 9px/1.4 system-ui;margin-top:7px}.ctCostOk{padding:9px 10px;border-radius:10px;background:#ecfdf3;border:1px solid #abefc6;color:#087443;font:750 9px/1.4 system-ui}.ctCostPending{padding:12px;border-radius:12px;background:#f8fafc;border:1px dashed #cfd8e3;color:#667085;font:750 10px/1.55 system-ui}.ctCostFoot{margin-top:10px;color:#98a2b3;font:700 8px/1.45 system-ui}
@media(max-width:767px){#panel-cost{padding-left:1px;padding-right:1px}.ctCostHead{align-items:flex-start}.ctCostHead h2{font-size:18px}.ctCostHero{grid-template-columns:1fr 1fr;gap:6px}.ctCostKpi{padding:10px}.ctCostValue{font-size:20px}.ctCostGrid{grid-template-columns:1fr;gap:7px}.ctCostCard{padding:11px}}
`;
 document.head.appendChild(st);
}

function activate(){
 document.querySelectorAll('.tabPanel').forEach(x=>x.classList.remove('on'));
 document.querySelectorAll('.tab').forEach(x=>x.classList.remove('on'));
 const p=document.getElementById(PANEL_ID),t=document.querySelector('.tab[data-tab="cost"]');
 if(p)p.classList.add('on');if(t)t.classList.add('on');
 try{sessionStorage.setItem('jjooni_ct_active_tab_v1','cost')}catch(_){}
 const h=[...document.querySelectorAll('h1,h2,.pageTitle,.page-title,.sectionTitle,.section-title')].find(x=>String(x.textContent||'').trim().toUpperCase()==='OVERVIEW'||x.dataset.ctContextHeading==='1');
 if(h){h.dataset.ctContextHeading='1';h.textContent='COST'}
 render(true);
}

function ensureUI(){
 ensureStyle();
 const tabs=document.querySelector('.tabs');
 if(tabs&&!tabs.querySelector('.tab[data-tab="cost"]')){
   const t=document.createElement('div');t.className='tab';t.dataset.tab=TAB_NAME;t.textContent='COST';t.title='AUTOBOT 비용 · Runtime / AI / Billing';t.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();activate()},true);tabs.appendChild(t);
 }
 if(!document.getElementById(PANEL_ID)){
   const p=document.createElement('div');p.id=PANEL_ID;p.className='tabPanel';
   const app=document.querySelector('.app')||document.querySelector('.container')||document.body;app.appendChild(p);
 }
}

function statusClass(s){s=String(s||'').toUpperCase();return s==='NORMAL'?'':s==='WARN'?'warn':'pending'}
function currentCost(){return window.__JJOONI_COST_SIDECAR||(window.__JJOONI_LIVE_PAYLOAD||{}).cost||null}
function row(label,value){return `<div class="ctCostRow"><span>${label}</span><b>${value}</b></div>`}

function render(force){
 ensureUI();
 const p=document.getElementById(PANEL_ID);if(!p)return;
 const c=currentCost();
 const key=JSON.stringify(c&&[c.generated_kst,c.status,c.runtime&&c.runtime.estimated_usd_today,c.ai&&c.ai.estimated_usd_today,c.billing&&c.billing.month_to_date_usd,c.forecast&&c.forecast.month_end_usd]);
 if(!force&&key===LAST_KEY)return;LAST_KEY=key;
 if(!c){
   p.innerHTML=`<div class="ctCostHead"><div><h2>AUTOBOT COST</h2><div class="ctCostSub">Runtime · AI · Google Billing</div></div><span class="ctCostStatus pending">SETUP PENDING</span></div><div class="ctCostPending">비용 데이터 계약은 준비되어 있습니다. 다음 encrypted feed에 <b>AUTOBOT_COST_V1</b>이 들어오면 이 화면이 자동으로 활성화됩니다.</div>`;
   return;
 }
 const rt=c.runtime||{},ai=c.ai||{},bill=c.billing||{},fc=c.forecast||{};
 const estimate=(n(rt.estimated_usd_today)||0)+(n(ai.estimated_usd_today)||0);
 const alerts=Array.isArray(c.alerts)?c.alerts:[];
 const budgetPct=n(fc.budget_pct),bar=Math.max(0,Math.min(100,budgetPct||0));
 const generated=String(c.generated_kst||'—').replace('T',' ').slice(0,16);
 const status=String(c.status||'SETUP_PENDING').toUpperCase();
 p.innerHTML=`
   <div class="ctCostHead"><div><h2>AUTOBOT COST</h2><div class="ctCostSub">Near-real-time estimate + lagged Google Billing actual · ${generated}</div></div><span class="ctCostStatus ${statusClass(status)}">${status}</span></div>
   <div class="ctCostHero">
     <div class="ctCostKpi"><div class="ctCostLabel">오늘 예상</div><div class="ctCostValue">${money(estimate)}</div><div class="ctCostMini">Worker + OpenAI</div></div>
     <div class="ctCostKpi"><div class="ctCostLabel">Google 실제</div><div class="ctCostValue">${money(bill.actual_today_usd)}</div><div class="ctCostMini">Billing lag ${ageText(bill.lag_minutes)}</div></div>
     <div class="ctCostKpi"><div class="ctCostLabel">월 누적</div><div class="ctCostValue">${money(bill.month_to_date_usd)}</div><div class="ctCostMini">BigQuery actual</div></div>
     <div class="ctCostKpi"><div class="ctCostLabel">월말 예상</div><div class="ctCostValue">${money(fc.month_end_usd)}</div><div class="ctCostMini">Budget ${money(fc.budget_usd)} · ${pct(fc.budget_pct)}</div><div class="ctCostBar"><i style="width:${bar}%"></i></div></div>
   </div>
   <div class="ctCostGrid">
     <div class="ctCostCard"><h3>Worker Runtime</h3>${row('Platform',String(rt.platform||'—').replaceAll('_',' '))}${row('Worker',rt.worker_pool||'—')}${row('Instances',integer(rt.instances))}${row('오늘 billable',duration(rt.billable_seconds_today))}${row('오늘 예상비용',money(rt.estimated_usd_today))}${row('Telemetry',rt.telemetry||'—')}</div>
     <div class="ctCostCard"><h3>AI Usage</h3>${row('Luna calls',integer(ai.luna_calls_today))}${row('Terra calls',integer(ai.terra_calls_today))}${row('Sol calls',integer(ai.sol_calls_today))}${row('Input tokens',integer(ai.input_tokens))}${row('Cached input',integer(ai.cached_input_tokens))}${row('Output tokens',integer(ai.output_tokens))}${row('오늘 AI 비용',money(ai.estimated_usd_today))}</div>
     <div class="ctCostCard"><h3>Google Billing</h3>${row('Source',bill.source||'—')}${row('오늘 실제비용',money(bill.actual_today_usd))}${row('월 누적비용',money(bill.month_to_date_usd))}${row('Billing lag',ageText(bill.lag_minutes))}${row('Currency',bill.currency||'USD')}</div>
     <div class="ctCostCard"><h3>Cost Guard</h3>${alerts.length?alerts.map(x=>`<div class="ctCostAlert">${String(x)}</div>`).join(''):`<div class="ctCostOk">비용 이상징후 없음</div>`}<div class="ctCostFoot">COST는 기존 Sheet 응답의 COST_JSON sidecar를 우선 사용합니다. 별도 Google/BigQuery browser polling은 없습니다.</div></div>
   </div>`;
}

ensureUI();render(true);
setInterval(()=>{if(!document.hidden)render(false)},3000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)render(true)});
})();

/* Tablet/desktop navigation contract: >=768px always uses left rail. */
(function(){
 function install(){
  if(document.getElementById('ctTabletRailFixV1'))return;
  const st=document.createElement('style');
  st.id='ctTabletRailFixV1';
  st.textContent=`
@media (min-width:768px){
 html.ctTouchTablet .tabs,html .tabs,.tabs{position:fixed!important;left:0!important;top:0!important;bottom:0!important;right:auto!important;width:158px!important;height:100vh!important;margin:0!important;padding:108px 12px 18px!important;display:flex!important;flex-direction:column!important;grid-template-columns:none!important;gap:6px!important;overflow-y:auto!important;overflow-x:hidden!important;background:linear-gradient(180deg,#061a36,#07162b)!important;border:0!important;z-index:4500!important;box-shadow:8px 0 28px rgba(6,24,51,.10)!important}
 html.ctTouchTablet .tabs:before,.tabs:before{content:'CONTROL\\A TOWER'!important;white-space:pre!important;display:block!important;position:absolute!important;left:20px!important;top:28px!important;color:white!important;font:900 17px/1.05 system-ui!important;letter-spacing:.02em!important}
 html.ctTouchTablet .tabs:after,.tabs:after{content:'INVESTMENT'!important;display:block!important;position:absolute!important;left:20px!important;top:72px!important;color:#8fa4bb!important;font:700 8px/1 system-ui!important;letter-spacing:.18em!important}
 html.ctTouchTablet .tab,html.ctTouchTablet .tab[data-tab],html .tab,.tab,.tab[data-tab]{display:flex!important;flex:0 0 auto!important;width:100%!important;min-width:0!important;min-height:46px!important;height:auto!important;padding:10px!important;border:0!important;border-radius:9px!important;align-items:center!important;justify-content:flex-start!important;text-align:left!important;font-size:11px!important;color:#c3d1e2!important;background:transparent!important;box-shadow:none!important}
 html.ctTouchTablet .tab.on,.tab.on{background:linear-gradient(90deg,#123e75,#0c2d57)!important;color:#fff!important;box-shadow:inset 3px 0 #62a8ff!important}
 html.ctTouchTablet .app,html .app,.app{margin-left:158px!important;width:calc(100% - 158px)!important;max-width:none!important;padding-left:18px!important;padding-right:18px!important}
 html.ctTouchTablet .top,html .top,.top{margin-left:0!important;width:100%!important}
 html.ctTouchTablet .top:before,.top:before{display:none!important}
 html.ctTouchTablet .tabPanel,.tabPanel{padding-top:0!important}
 #ctEncryptedLiveBadge{top:10px!important;right:12px!important;bottom:auto!important}
}
`;
  (document.head||document.documentElement).appendChild(st);
 }
 install();
 window.addEventListener('resize',install,{passive:true});
})();
