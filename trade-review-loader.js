(function(){
'use strict';
const head=document.head||document.documentElement;
function load(id,src,onload,onerror){
  const existing=document.getElementById(id);
  if(existing){if(onload)existing.addEventListener('load',onload,{once:true});return existing}
  const s=document.createElement('script');s.id=id;s.src=src+(src.includes('?')?'&':'?')+'_='+Date.now();s.async=true;
  if(onload)s.onload=onload;if(onerror)s.onerror=onerror;head.appendChild(s);return s;
}
function loadBottomGuard(){
  load('ctViewportBottomGuardV5Script','viewport-bottom-guard-v5.js?v=5',null,()=>{window.__JJOONI_VIEWPORT_BOTTOM_GUARD_V5={state:'LOAD_FAILED'}});
}
function loadDecisionImpact(){
  load('ctDecisionImpactV5Script','decision-impact-v5.js?v=5.2',loadBottomGuard,()=>{window.__JJOONI_DECISION_IMPACT_V5={state:'LOAD_FAILED'};loadBottomGuard()});
}
function loadStability(){
  load('ctMobileStabilityV4Script','mobile-stability-v4.js?v=4',loadDecisionImpact,()=>{window.__JJOONI_MOBILE_STABILITY_V4={state:'LOAD_FAILED'};loadDecisionImpact()});
}
function loadReadable(){
  load('ctTradeReviewReadableV3Script','trade-review-readable-v3.js?v=3',loadStability,()=>{window.__JJOONI_TRADE_REVIEW_READABLE_V3={state:'LOAD_FAILED'};loadStability()});
}
function loadTrade(){
  load('ctTradeReviewV2Script','trade-review-v2.js?v=2',loadReadable,()=>{window.__JJOONI_TRADE_REVIEW_V2={state:'LOAD_FAILED'};loadReadable()});
}
load('ctDataIntegrityV4Script','data-integrity-v4.js?v=4',loadTrade,()=>{window.__JJOONI_DATA_INTEGRITY_V4={state:'LOAD_FAILED'};loadTrade()});
})();
