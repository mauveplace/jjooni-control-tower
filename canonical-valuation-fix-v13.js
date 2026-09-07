(function(){
'use strict';
if(window.__JJOONI_CANONICAL_VALUATION_V13?.booted)return;

const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null};
const z=v=>n(v)==null?0:n(v);
const currency=p=>String(p?.currency||((String(p?.market||'').toUpperCase()==='US')?'USD':'KRW')).toUpperCase();
const qty=p=>Math.abs(z(p?.qty??p?.quantity??p?.held_qty??p?.balance_qty));
const px=p=>n(p?.current_price??p?.price??p?.last_price);
const GENERIC=['market_value','evaluation_amount','eval_amount','valuation','evlu_amt','evaluation_value'];
const EXPLICIT=['market_value_krw','evaluation_amount_krw','eval_amount_krw','valuation_krw','evlu_amt_krw'];

function firstNumber(o,keys){for(const k of keys){const x=n(o?.[k]);if(x!=null)return {key:k,value:x}}return null}
function inferKrw(id,p,a){if(p.market_value_contract==='CANONICAL_KRW_V13'&&currency(p)==='USD'&&window.JjooniMetrics.fx(a,p)==null)return null;const value=window.JjooniMetrics.valueKrw(p,a);return value==null?null:{value,mode:'DECLARED_CURRENCY',source:'CANONICAL_CONTRACT'}}

function reconcile(){
 const C=window.__JJOONI_CANONICAL_SSOT;
 const summary={};let touched=0,positions=0,usd=0,converted=0,alreadyKrw=0,fxMissing=0;
 if(!C||!C.accounts){
   window.__JJOONI_CANONICAL_VALUATION_V13={booted:true,state:'WAITING_FOR_CANONICAL',version:'13.1',touched:0};return;
 }
 Object.entries(C.accounts).forEach(([id,a])=>{
   let total=0,count=0,stamped=0,missing=0;
   (a?.positions||[]).forEach(p=>{
     if(String(p?.record_type||'POSITION').toUpperCase()==='CASH')return;
     positions++;if(currency(p)==='USD')usd++;
     const r=inferKrw(id,p,a);
     if(!r||n(r.value)==null){if(currency(p)==='USD'){missing++;fxMissing++;}if(String(p.market_value_contract||'')==='CANONICAL_KRW_V13'){for(const k of ['market_value_krw','market_value_currency','market_value_contract','market_value_reconcile_mode','market_value_reconcile_source','market_value_fx','market_value_fx_source'])delete p[k];}return;}
     count++;total+=r.value;
     if(n(p.market_value_krw)==null||String(p.market_value_contract||'')==='CANONICAL_KRW_V13'){
       p.market_value_krw=r.value;
       p.market_value_currency='KRW';
       p.market_value_contract='CANONICAL_KRW_V13_1_SOURCE_AWARE';
       p.market_value_reconcile_mode=r.mode;
       p.market_value_reconcile_source=r.source;
       if(r.fx!=null){p.market_value_fx=r.fx;p.market_value_fx_source=r.fx_source;}
       stamped++;touched++;
     }
     if(r.mode==='USD_NATIVE_TO_KRW'||r.mode==='QTY_X_PRICE_X_VERIFIED_FX')converted++;else alreadyKrw++;
   });
   summary[id]={position_count:count,stamped,fx_missing_positions:missing,total_market_value_krw:missing?null:total,nav:n(a?.nav)};
 });
 window.__JJOONI_CANONICAL_VALUATION_V13={booted:true,state:fxMissing?'PARTIAL_FX_MISSING':'ACTIVE',version:'13.1',positions,usd_positions:usd,touched,usd_native_converted:converted,already_krw:alreadyKrw,fx_missing_positions:fxMissing,accounts:summary,fx_policy:'ACCOUNT_SPECIFIC_OR_EXPLICIT_FX_REFERENCE_ONLY',updated_at:new Date().toISOString()};
}

reconcile();
setTimeout(reconcile,150);setTimeout(reconcile,700);document.addEventListener('jjooni:live-applied',reconcile);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)reconcile()});
})();
