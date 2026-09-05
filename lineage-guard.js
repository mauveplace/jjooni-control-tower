(function(){
'use strict';

const DEFAULT_IDS=['TOSS','ISA','PENSION','IRP','AI','TRIPOD'];
const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null};
const won=v=>n(v)==null?'—':'₩'+Math.round(Math.abs(Number(v))).toLocaleString('ko-KR');
const signed=v=>n(v)==null?'—':(Number(v)>=0?'+':'-')+won(v);
const canon=()=>window.__JJOONI_CANONICAL_SSOT||null;
const live=()=>window.__JJOONI_LIVE_PAYLOAD||null;
function ids(){
 const C=canon();
 const xs=C&&Array.isArray(C.registry)?C.registry.map(x=>String((x||{}).id||'').toUpperCase()).filter(Boolean):[];
 return xs.length?xs:DEFAULT_IDS.slice();
}

function validFx(v){const x=n(v);return x!=null&&x>500&&x<3000?x:null}
function fxFor(c,p){
 if(String((p||{}).currency||'KRW').toUpperCase()!=='USD')return 1;
 const L=live()||{},A=L.accounts||{};
 for(const v of [p&&p.fx,c&&c.fx,(A.TOSS||{}).fx_krw_per_usd,(A.AI||{}).fx_krw_per_usd,(A.TRIPOD||{}).fx]){
  const x=validFx(v);if(x!=null)return x;
 }
 return null;
}
function priceAsOf(p){return String((p||{}).price_as_of||(p||{}).live_price_timestamp||'').trim()||null}
function tossDiag(){
 const C=canon()||{},L=live()||{};
 return (((C.accounts||{}).TOSS||{}).daily_pnl_attribution)||(((L.accounts||{}).TOSS||{}).daily_pnl_attribution)||null;
}

function repairLegacyMirrors(){
 const C=canon(),IDS=ids();
 if(!C||typeof D==='undefined')return;
 D.human=D.human||{};
 D.human.current_account_navs=D.human.current_account_navs||{};
 D.human.current_account_details=D.human.current_account_details||{};
 for(const id of IDS){
  const c=(C.accounts||{})[id]||{};
  if(n(c.nav)!=null)D.human.current_account_navs[id]=Number(c.nav);
  D.human.current_account_details[id]={
   ...(D.human.current_account_details[id]||{}),
   canonical_quality:c.quality,
   canonical_source:c.source,
   display_nav_source:c.source,
   modeled_current_nav:n(c.nav),
   cash_krw:n(c.cash_krw),
   cash_usd:n(c.cash_usd)
  };
 }
 if(n((C.total||{}).nav)!=null)D.human.total_asset=Number(C.total.nav);
 if(n((C.total||{}).principal)!=null)D.human.principal=Number(C.total.principal);
 if(n((C.total||{}).pnl)!=null)D.human.total_pnl=Number(C.total.pnl);
 if(n((C.total||{}).return_pct)!=null)D.human.return_pct=Number(C.total.return_pct);

 D.human.latest_performance={
  ...(D.human.latest_performance||{}),
  total_asset:n((C.total||{}).nav),
  principal:n((C.total||{}).principal),
  total_pnl:n((C.total||{}).pnl),
  return_pct:n((C.total||{}).return_pct),
  market_pnl:n((C.total||{}).today_pnl),
  net_cash_flow:n((C.total||{}).net_flow),
  data_state:'CANONICAL_REGISTRY_LINEAGE_GUARD',
  sync_kst:C.observed_at
 };
}

function installFunctions(){
 if(!canon())return false;

 const latest=function(){
  const C=canon();if(!C)return {};
  const out={};
  for(const id of ids()){
   const c=(C.accounts||{})[id]||{};
   out[id]={
    account:id,
    total_asset:n(c.nav),
    principal:n(c.principal),
    market_pnl:n(c.today_pnl),
    net_cash_flow:n(c.net_flow),
    daily_return:n(c.today_return)!=null?Number(c.today_return)/100:null,
    flow_adj_return:n(c.today_return)!=null?Number(c.today_return)/100:null,
    data_state:c.quality,
    sync_kst:C.observed_at
   };
  }
  return out;
 };
 latest.__jjooniLineageGuard=true;
 window.latestAccountRows=latest;

 const accounting=function(){
  const C=canon(),IDS=ids();
  if(!C)return {accounts:{},current_nav:null,actual_nav:null,live_reconciliation_gap:null,live_reconciliation_state:'NO_DATA'};
  const accts={};let current=0,pnl=0,flow=0,navKnown=0,pnlKnown=0,flowKnown=0,prevKnown=0,prevTotal=0;
  for(const id of IDS){
   const c=(C.accounts||{})[id]||{},nav=n(c.nav),p=n(c.today_pnl),f=n(c.net_flow);
   if(nav!=null){current+=nav;navKnown++}
   if(p!=null){pnl+=p;pnlKnown++}
   if(f!=null){flow+=f;flowKnown++}
   const prev=nav!=null&&p!=null&&f!=null?nav-p-f:null;
   if(prev!=null){prevTotal+=prev;prevKnown++}
   const chg=p!=null&&f!=null?p+f:null;
   accts[id]={
    account:id,current_nav:nav,actual_nav:nav,previous_nav:prev,
    nav_change:chg,actual_nav_change:chg,live_nav_change:chg,
    net_cash_flow:f,live_pnl:p,investment_pnl:p,daily_return:n(c.today_return),
    data_state:c.quality,sync_kst:C.observed_at
   };
  }
  const canonicalNav=n((C.total||{}).nav);
  const accountSumGap=canonicalNav!=null&&navKnown===IDS.length?canonicalNav-current:null;
  const td=tossDiag();
  return {
   accounts:accts,
   current_nav:navKnown===IDS.length?current:null,
   actual_nav:navKnown===IDS.length?current:null,
   nav_change:pnlKnown===IDS.length&&flowKnown===IDS.length?pnl+flow:null,
   actual_nav_change:pnlKnown===IDS.length&&flowKnown===IDS.length?pnl+flow:null,
   live_nav_change:pnlKnown===IDS.length&&flowKnown===IDS.length?pnl+flow:null,
   net_cash_flow:flowKnown===IDS.length?flow:null,
   live_pnl:pnlKnown===IDS.length?pnl:null,
   investment_pnl:pnlKnown===IDS.length?pnl:null,
   previous_nav:prevKnown===IDS.length?prevTotal:null,
   daily_return:prevKnown===IDS.length&&prevTotal>0&&pnlKnown===IDS.length?pnl/prevTotal:null,
   explained_gap:null,
   explained_gap_state:'NO_INDEPENDENT_PREVIOUS_NAV_BASELINE',
   live_reconciliation_gap:null,
   live_reconciliation_state:'NO_INDEPENDENT_PREVIOUS_NAV_BASELINE',
   nav_account_sum_gap:accountSumGap,
   nav_account_sum_state:accountSumGap==null?'NO_DATA':Math.abs(accountSumGap)<1?'ARITHMETIC_MATCH':'MISMATCH',
   toss_attribution_gap:td?n(td.unattributed_daily_pnl_krw_equiv):null,
   toss_attribution_state:td?String(td.state||'UNKNOWN'):'NO_DATA',
   account_count:IDS.length
  };
 };
 accounting.__jjooniLineageGuard=true;
 window.buildTodayAccounting=accounting;

 const metrics=function(){
  const C2=canon(),IDS=ids();if(!C2)return {accounts:{},positions:[],context:{source:'NO_DATA'}};
  const accounts={},positions=[];
  for(const id of IDS){
   const c=(C2.accounts||{})[id]||{};let priced=0,total=0;
   for(const p of (c.positions||[])){
    if(String(p.record_type||'POSITION').toUpperCase()!=='POSITION')continue;
    total++;
    const cur=n(p.current_price!=null?p.current_price:p.price),prev=n(p.prev_close),qty=n(p.qty),asof=priceAsOf(p),liq=String(p.price_liquidity||'NORMAL').toUpperCase();
    if(id==='TOSS'){
     const dp=n(p.daily_pnl),dr=n(p.daily_return),fx=fxFor(c,p);
     const ok=dp!=null&&asof!=null;
     if(ok&&liq!=='THIN')priced++;
     positions.push({
      account:id,ticker:p.ticker,name:p.name,qty,
      baseline_price:prev,baseline_date:p.prev_close_as_of||null,regular_mark:cur,
      regular_pnl:ok?dp:null,extended_pnl:0,session_pnl:ok?dp:null,
      display_day_return:dr,quality:!ok?'NO_DATA':liq==='THIN'?'LIMITED_THIN':'FULL',
      quote_timestamp:asof,quote_source:'BROKER · '+String(p.price_source||c.source||'TOSS'),
      base_fx:fx,calculation_method:'BROKER',baseline_quality:'BROKER_DAILY_PNL'
     });
     continue;
    }

    const isUsd=String(p.currency||'KRW').toUpperCase()==='USD',fx=fxFor(c,p);
    const ok=cur!=null&&cur>0&&prev!=null&&prev>0&&qty!=null&&qty>0&&asof!=null&&(!isUsd||fx!=null);
    const pnl=ok?qty*(cur-prev)*(isUsd?fx:1):null;
    if(ok&&liq!=='THIN')priced++;
    positions.push({
     account:id,ticker:p.ticker,name:p.name,qty,
     baseline_price:prev,baseline_date:p.prev_close_as_of||null,regular_mark:cur,
     regular_pnl:pnl,extended_pnl:0,session_pnl:pnl,
     quality:!ok?'NO_DATA':liq==='THIN'?'LIMITED_THIN':'FULL',
     quote_timestamp:asof,quote_source:'MTM · '+String(p.price_source||c.source||'MODEL'),
     base_fx:isUsd?fx:1,calculation_method:'MTM',
     baseline_quality:p.prev_close_as_of?'DATED':'UNVERIFIED_ASOF'
    });
   }
   accounts[id]={
    regular_pnl:n(c.today_pnl),extended_pnl:0,session_pnl:n(c.today_pnl),
    quality:c.quality,priced,positions:total,session_label:c.source
   };
  }
  return {accounts,positions,context:{source:'CANONICAL_LINEAGE_GUARD_V2',observed_at:C2.observed_at,account_count:IDS.length}};
 };
 metrics.__jjooniLineageGuard=true;
 window.buildRegularSessionMetrics=metrics;
 return true;
}

function wrapRender(){
 if(typeof window.render!=='function'||window.render.__jjooniLineageWrapped)return;
 const base=window.render;
 const wrapped=function(){
  if(canon()){installFunctions();repairLegacyMirrors()}
  return base.apply(this,arguments);
 };
 wrapped.__jjooniLineageWrapped=true;
 window.render=wrapped;
}

function paintAttribution(){
 const C=canon(),td=tossDiag();if(!C)return;
 const card=[...document.querySelectorAll('.ctAcct')].find(x=>String((x.querySelector('.ctAcctName')||{}).textContent||'').toLowerCase().includes('toss'));
 if(!card)return;
 let e=card.querySelector('#ctTossAttributionLine');
 if(!e){e=document.createElement('div');e.id='ctTossAttributionLine';e.style.cssText='grid-column:1/-1;font:800 9px/1.4 system-ui;margin-top:4px;padding-top:4px;border-top:1px dashed #e7ebf0;text-align:right';card.appendChild(e)}
 if(!td){e.textContent='당일 귀속 · NO_DATA';return}
 const gap=n(td.unattributed_daily_pnl_krw_equiv),state=String(td.state||'UNKNOWN');
 e.textContent='당일 귀속 '+state+' · 미귀속 '+(gap==null?'—':signed(gap));
 e.style.color=state==='RECONCILED'?'#087443':state==='UNATTRIBUTED'?'#be123c':'#b45309';
}

function enforce(){
 wrapRender();
 if(!canon())return;
 const signature=[
  !!(window.latestAccountRows&&window.latestAccountRows.__jjooniLineageGuard),
  !!(window.buildTodayAccounting&&window.buildTodayAccounting.__jjooniLineageGuard),
  !!(window.buildRegularSessionMetrics&&window.buildRegularSessionMetrics.__jjooniLineageGuard)
 ].join('|');
 if(signature!=='true|true|true'){
  installFunctions();repairLegacyMirrors();
  try{if(typeof window.render==='function')window.render()}catch(e){console.warn('lineage guard render',e)}
 }else repairLegacyMirrors();
 paintAttribution();
}

wrapRender();
enforce();
setInterval(()=>{if(!document.hidden)enforce()},500);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)enforce()});
window.__JJOONI_LINEAGE_GUARD={version:'2.0',accounts:ids(),policy:'NO_SILENT_FALLBACK_NO_FAKE_RECONCILIATION'};
})();
