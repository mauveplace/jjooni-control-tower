(function(){
'use strict';
if(document.getElementById('ctTradeReviewV2Script'))return;
const s=document.createElement('script');
s.id='ctTradeReviewV2Script';
s.src='trade-review-v2.js?v=2&_='+Date.now();
s.async=true;
s.onerror=function(){console.error('CT trade review v2 load failed');window.__JJOONI_TRADE_REVIEW_V2={state:'LOAD_FAILED'}};
(document.head||document.documentElement).appendChild(s);
})();
