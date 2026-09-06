(function(){
'use strict';
const head=document.head||document.documentElement;
function load(id,src,onload,onerror){
  const existing=document.getElementById(id);
  if(existing){if(onload)existing.addEventListener('load',onload,{once:true});return existing}
  const s=document.createElement('script');s.id=id;s.src=src+(src.includes('?')?'&':'?')+'_='+Date.now();s.async=true;
  if(onload)s.onload=onload;if(onerror)s.onerror=onerror;head.appendChild(s);return s;
}
function loadRecentTradeMetric(){load('ctRecentTradeMetricV9Script','recent-trade-metric-drilldown-v9.js?v=9.0',null,()=>{window.__JJOONI_RECENT_TRADE_DRILL_V9={state:'LOAD_FAILED'}})}
function loadTabletAccounts(){load('ctTabletAccountsV8Script','tablet-accounts-v8.js?v=8.1',loadRecentTradeMetric,()=>{window.__JJOONI_TABLET_ACCOUNTS_V8={state:'LOAD_FAILED'};loadRecentTradeMetric()})}
function loadTabletRuntime(){load('ctTabletRuntimeV8Script','tablet-runtime-v8.js?v=8.0',loadTabletAccounts,()=>{window.__JJOONI_TABLET_RUNTIME_V8={state:'LOAD_FAILED'};loadTabletAccounts()})}
function loadBottomGuard(){load('ctViewportBottomGuardV5Script','viewport-bottom-guard-v5.js?v=5',loadTabletRuntime,()=>{window.__JJOONI_VIEWPORT_BOTTOM_GUARD_V5={state:'LOAD_FAILED'};loadTabletRuntime()})}
function loadHumanUi(){load('ctHumanUiV6Script','human-ui-v6.js?v=6.1',loadBottomGuard,()=>{window.__JJOONI_HUMAN_UI_V6={state:'LOAD_FAILED'};loadBottomGuard()})}
function loadTradeMoney(){load('ctTradeMoneyV6Script','trade-money-v6.js?v=6.2',loadHumanUi,()=>{window.__JJOONI_TRADE_MONEY_V6={state:'LOAD_FAILED'};loadHumanUi()})}
function loadRealizedLedger(){load('ctRealizedLedgerV7Script','realized-ledger-v7.js?v=7.3',loadTradeMoney,()=>{window.__JJOONI_REALIZED_LEDGER_V7={state:'LOAD_FAILED'};loadTradeMoney()})}
function loadDecisionImpact(){load('ctDecisionImpactV5Script','decision-impact-v5.js?v=5.2',loadRealizedLedger,()=>{window.__JJOONI_DECISION_IMPACT_V5={state:'LOAD_FAILED'};loadRealizedLedger()})}
function loadStability(){load('ctMobileStabilityV4Script','mobile-stability-v4.js?v=4',loadDecisionImpact,()=>{window.__JJOONI_MOBILE_STABILITY_V4={state:'LOAD_FAILED'};loadDecisionImpact()})}
function loadReadable(){load('ctTradeReviewReadableV3Script','trade-review-readable-v3.js?v=3',loadStability,()=>{window.__JJOONI_TRADE_REVIEW_READABLE_V3={state:'LOAD_FAILED'};loadStability()})}
function loadTrade(){load('ctTradeReviewV2Script','trade-review-v2.js?v=2',loadReadable,()=>{window.__JJOONI_TRADE_REVIEW_V2={state:'LOAD_FAILED'};loadReadable()})}
load('ctDataIntegrityV4Script','data-integrity-v4.js?v=4',loadTrade,()=>{window.__JJOONI_DATA_INTEGRITY_V4={state:'LOAD_FAILED'};loadTrade()});
})();
