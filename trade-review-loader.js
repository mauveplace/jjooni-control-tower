(function(){
'use strict';
function loadReadable(){
  if(document.getElementById('ctTradeReviewReadableV3Script'))return;
  const p=document.createElement('script');
  p.id='ctTradeReviewReadableV3Script';
  p.src='trade-review-readable-v3.js?v=3&_='+Date.now();
  p.async=true;
  p.onerror=function(){console.error('CT trade review readable v3 load failed');window.__JJOONI_TRADE_REVIEW_READABLE_V3={state:'LOAD_FAILED'}};
  (document.head||document.documentElement).appendChild(p);
}

const existing=document.getElementById('ctTradeReviewV2Script');
if(existing){
  if(window.__JJOONI_TRADE_REVIEW_V2)loadReadable();
  else existing.addEventListener('load',loadReadable,{once:true});
  return;
}
const s=document.createElement('script');
s.id='ctTradeReviewV2Script';
s.src='trade-review-v2.js?v=2&_='+Date.now();
s.async=true;
s.onload=loadReadable;
s.onerror=function(){console.error('CT trade review v2 load failed');window.__JJOONI_TRADE_REVIEW_V2={state:'LOAD_FAILED'}};
(document.head||document.documentElement).appendChild(s);
})();
