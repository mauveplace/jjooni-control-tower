(function(root){
'use strict';
// Shared display contract. No trading decisions; browser may load the separate
// read-only FAST refresh client after the pure metrics API is installed.
const IDS=['TOSS','ISA','PENSION','IRP','AI','TRIPOD'];
const number=v=>{if(v==null||typeof v==='boolean'||typeof v==='object'||String(v).trim()==='')return null;const x=Number(v);return Number.isFinite(x)?x:null};
const first=(o,keys)=>{for(const k of keys){const x=number(o?.[k]);if(x!=null)return x}return null};
const sum=xs=>xs.length&&xs.every(x=>number(x)!=null)?xs.reduce((s,x)=>s+Number(x),0):null;
const positions=a=>(a?.positions||[]).filter(p=>!['CASH','CASH_EQUIVALENT','WATCHLIST'].includes(String(p.record_type||'POSITION').toUpperCase()));
const currency=p=>String(p?.currency||(String(p?.market||'').toUpperCase()==='US'?'USD':'KRW')).toUpperCase();
function fx(a,p){const x=first(p,['fx','fx_krw_per_usd'])??first(a,['fx_krw_per_usd','fx']);return x!=null&&x>0?x:null}
function valueKrw(p,a){
 const explicit=first(p,['market_value_krw','value_krw','market_value_krw_equiv','evaluation_amount_krw','eval_amount_krw','valuation_krw','evlu_amt_krw']);if(explicit!=null)return explicit;
 const mv=number(p?.market_value);
 // CT canonical market_value is KRW; native broker value uses `value`.
 if(mv!=null&&String(p.market_value_currency||'KRW').toUpperCase()==='KRW')return mv;
 const native=first(p,['value','market_value']),f=fx(a,p);
 if(native!=null)return currency(p)==='USD'?(f==null?null:native*f):native;
 const q=first(p,['qty','quantity','held_qty']),px=first(p,['current_price','price','last_price']);
 if(q==null||px==null)return null;
 return currency(p)==='USD'?(f==null?null:q*px*f):q*px;
}
function cash(a){
 const direct=first(a,['cash_krw_equiv','cash_total_krw']);if(direct!=null)return direct;
 const kr=number(a?.cash_krw),us=number(a?.cash_usd);
 if(us==null)return kr;
 const usdKrw=number(a?.cash_usd_krw),f=fx(a);
 if(kr==null||us!==0&&usdKrw==null&&f==null)return null;
 return kr+(usdKrw??(us===0?0:us*f));
}
function stock(a){const ps=positions(a);return ps.length?sum(ps.map(p=>valueKrw(p,a))):Array.isArray(a?.positions)?0:null}
function previous(a){const explicit=first(a,['previous_nav','previous_nav_krw','baseline_nav']);if(explicit!=null)return explicit;const nav=number(a?.nav),day=number(a?.today_pnl),flow=number(a?.net_flow);return nav!=null&&day!=null&&flow!=null?nav-day-flow:null}
function aggregate(accounts,ids=IDS){
 const xs=ids.map(id=>accounts?.[id]||{}),nav=sum(xs.map(x=>number(x.nav))),day=sum(xs.map(x=>number(x.today_pnl))),flow=sum(xs.map(x=>number(x.net_flow))),prior=sum(xs.map(previous)),cum=sum(xs.map(x=>number(x.pnl))),principal=sum(xs.map(x=>number(x.principal)));
 return {nav,day,flow,previous:prior,day_return:day!=null&&prior>0?100*day/prior:null,cum,principal,return_pct:cum!=null&&principal>0?100*cum/principal:null,known_day:xs.filter(x=>number(x.today_pnl)!=null).length,account_count:ids.length,known_day_subtotal:xs.reduce((s,x)=>s+(number(x.today_pnl)??0),0)};
}
function dayKey(v){const s=String(v||'').trim();if(/^\d{8}$/.test(s))return s.slice(0,4)+'-'+s.slice(4,6)+'-'+s.slice(6);if(/^\d{4}[/-]\d{2}[/-]\d{2}$/.test(s))return s.replaceAll('/','-');const t=parseMs(s);return t==null?'':new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date(t))}
function parseMs(v){let s=String(v||'').trim();if(!s)return null;if(!/(Z|[+-]\d{2}:?\d{2})$/i.test(s)&&/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(s))s=s.replace(' ','T')+'+09:00';const x=Date.parse(s);return Number.isFinite(x)?x:null}
function freshness(l,now=Date.now()){
 const t=parseMs(l?.generated_kst||l?.observed_at),until=parseMs(l?.stale_after_kst),session=l?.session,closed=l?.market_closed===true||String(session?.state||session).toUpperCase().includes('CLOSED');
 if(t==null||t>now+120000)return {kind:'warn',state:'UNKNOWN',text:'기준시각 확인 필요',age_ms:null};
 const late=until!=null?now>until:now-t>20*60000;
 if(late)return {kind:'warn',state:'STALE',text:'업데이트 지연',age_ms:now-t};
 return {kind:closed?'closed':'good',state:closed?'CLOSED':'LIVE',text:closed?'장 마감 · 다음 수집 대기':'최신 수집 기준',age_ms:now-t};
}
function positionDay(p,a){
 const direct=first(p,['daily_pnl','day_pnl_krw','regular_pnl']);if(direct!=null)return direct;
 const native=number(p?.day_pnl),f=currency(p)==='USD'?fx(a,p):1;if(native!=null)return f==null?null:native*f;
 const q=first(p,['qty','quantity']),cur=first(p,['current_price','price']),prev=number(p?.prev_close);
 return q!=null&&cur>0&&prev>0&&f!=null?q*(cur-prev)*f:null;
}
function audit(c){const rows={};for(const id of IDS){const a=c.accounts?.[id]||{},s=stock(a),k=cash(a),nav=number(a.nav);rows[id]={stock:s,cash:k,nav,gap:s!=null&&k!=null&&nav!=null?nav-s-k:null,cash_kind:a.cash_kind||'CASH',position_count:positions(a).length}}return rows}
const api={IDS,number,first,sum,positions,currency,fx,valueKrw,cash,stock,previous,aggregate,dayKey,parseMs,freshness,positionDay,audit};
root.JjooniMetrics=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window==='object'?window:globalThis);

(function(){
'use strict';
if(typeof window!=='object'||typeof document!=='object')return;

// SSOT-first verified boot coordinator. This runs before the legacy eager
// trade-review-loader tag and temporarily marks that loader as already active,
// so the old loader returns immediately instead of starting its 30s timeout.
if(!window.__JJOONI_BOOT_COORDINATOR_BOOTSTRAPPED){
 window.__JJOONI_BOOT_COORDINATOR_BOOTSTRAPPED=true;
 if(!window.__JJOONI_UI_BOOT_V14)window.__JJOONI_UI_BOOT_V14={state:'ACTIVE',version:'V33_DEFERRED_BOOT_HOLD'};
 const c=document.createElement('script');
 c.src='boot-coordinator-v33.js?v=33.0&_='+Date.now();
 c.async=false;
 c.onerror=()=>{console.warn('CT boot coordinator load failed');window.__JJOONI_UI_BOOT_V14=null};
 (document.head||document.documentElement).appendChild(c);
}

// Stability boundary: public-market sidecar contains no account/order data and
// therefore can refresh market/TRI-POD daily facts independently of private KIS.
if(!window.__JJOONI_PUBLIC_MARKET_SIDECAR_BOOTSTRAPPED){
 window.__JJOONI_PUBLIC_MARKET_SIDECAR_BOOTSTRAPPED=true;
 const p=document.createElement('script');
 p.src='public-market-sidecar-v36.js?v=36.0&_='+Date.now();
 p.async=false;
 p.onerror=()=>console.warn('CT public market sidecar load failed');
 (document.head||document.documentElement).appendChild(p);
}

// Read-only market/VIX presentation guard.
if(!window.__JJOONI_TRIPOD_VIX_AUTHORITY_BOOTSTRAPPED){
 window.__JJOONI_TRIPOD_VIX_AUTHORITY_BOOTSTRAPPED=true;
 const v=document.createElement('script');
 v.src='consultant-tab-hotfix-v31.js?v=31.6&_='+Date.now();
 v.async=false;
 v.onerror=()=>console.warn('CT market/VIX presentation guard load failed');
 (document.head||document.documentElement).appendChild(v);
}

// Stability-first TRI-POD daily surface. The decrypted legacy card is historical
// and remains quarantined unless a complete verified daily signal is available.
if(!window.__JJOONI_TRIPOD_DAILY_GUARD_BOOTSTRAPPED){
 window.__JJOONI_TRIPOD_DAILY_GUARD_BOOTSTRAPPED=true;
 const d=document.createElement('script');
 d.src='tripod-daily-freshness-v35.js?v=35.1&_='+Date.now();
 d.async=false;
 d.onerror=()=>console.warn('CT TRI-POD daily freshness guard load failed');
 (document.head||document.documentElement).appendChild(d);
}

if(window.__JJOONI_CT_FAST_BOOTSTRAPPED)return;
window.__JJOONI_CT_FAST_BOOTSTRAPPED=true;
const s=document.createElement('script');
s.src='fast-refresh-v32.js?v=1&_='+Date.now();
s.async=true;
s.onerror=()=>console.warn('CT FAST client load failed');
(document.head||document.documentElement).appendChild(s);
})();