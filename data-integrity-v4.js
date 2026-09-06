(function(){
'use strict';
if(window.__JJOONI_DATA_INTEGRITY_V4)return;

const RETIREMENT=new Set(['ISA','PENSION','IRP']);
const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null};
const accountOf=o=>String(o&& (o.account||o.account_type)||'').trim().toUpperCase();

function fxKrwPerUsd(){
  const vals=[];
  try{vals.push(window.__JJOONI_LIVE_PAYLOAD?.accounts?.AI?.fx_krw_per_usd)}catch(_){}
  try{vals.push(window.__JJOONI_LIVE_PAYLOAD?.accounts?.TRIPOD?.fx)}catch(_){}
  try{vals.push(window.__JJOONI_CANONICAL_SSOT?.accounts?.TRIPOD?.fx)}catch(_){}
  try{if(typeof D!=='undefined')vals.push(D.ai?.latest?.fx)}catch(_){}
  const fx=vals.map(n).find(x=>x&&x>500&&x<3000);
  return fx||null;
}

function normalizeRecord(o,forcedAccount){
  if(!o||typeof o!=='object')return;
  const acct=String(forcedAccount||accountOf(o)).toUpperCase();
  if(RETIREMENT.has(acct)){
    o.currency='KRW';
    if(!o.market||String(o.market).toUpperCase()==='US')o.market='KR';
    o.currency_source='ACCOUNT_CONTRACT_KRW';
    return;
  }
  const c=String(o.currency||'').toUpperCase();
  if(c==='USD'||c==='KRW')return;
  const m=String(o.market||'').toUpperCase();
  o.currency=m==='US'?'USD':'KRW';
  o.currency_source='MARKET_INFERRED';
}

function normalize(){
  let trades=0,positions=0;
  try{
    if(typeof D!=='undefined'){
      const h=D.human||{};
      (h.trades||[]).forEach(x=>{normalizeRecord(x);trades++});
      (h.positions||[]).forEach(x=>{normalizeRecord(x);positions++});
      const ai=D.ai?.latest||{};
      (ai.trades||[]).forEach(x=>{normalizeRecord(x,'AI');trades++});
      (ai.holdings_kr||[]).forEach(x=>{x.currency='KRW';x.market='KR';positions++});
      (ai.holdings_us||[]).forEach(x=>{x.currency='USD';x.market='US';positions++});
    }
  }catch(_){}
  try{
    const live=window.__JJOONI_LIVE_PAYLOAD||{};
    ['ISA','PENSION','IRP'].forEach(id=>{
      const a=(live.accounts||{})[id]||{};
      (a.positions||[]).forEach(x=>{normalizeRecord(x,id);positions++});
    });
    (live.recent_trades||[]).forEach(x=>{normalizeRecord(x);trades++});
  }catch(_){}
  try{
    const C=window.__JJOONI_CANONICAL_SSOT||{};
    ['ISA','PENSION','IRP'].forEach(id=>((C.accounts||{})[id]?.positions||[]).forEach(x=>{normalizeRecord(x,id);positions++}));
  }catch(_){}
  const fx=fxKrwPerUsd();
  window.__JJOONI_FX_KRW_PER_USD=fx;
  window.__JJOONI_TO_KRW=function(value,currency){
    const v=n(value);if(v==null)return null;
    return String(currency||'KRW').toUpperCase()==='USD'?(fx?v*fx:null):v;
  };
  window.__JJOONI_DATA_INTEGRITY_V4={state:'ACTIVE',retirement_currency:'KRW',fx_krw_per_usd:fx,normalized_trades:trades,normalized_positions:positions};
}

normalize();
document.addEventListener('jjooni:live-applied',normalize);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)normalize()});
})();
