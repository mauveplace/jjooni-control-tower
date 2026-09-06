(function(){
'use strict';
if(window.__JJOONI_CANONICAL_VALUATION_V13?.booted)return;

const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null};
const z=v=>n(v)==null?0:n(v);
const fxGlobal=()=>n(window.__JJOONI_FX_KRW_PER_USD)||n(window.__JJOONI_LIVE_PAYLOAD?.accounts?.AI?.fx_krw_per_usd)||n(window.__JJOONI_LIVE_PAYLOAD?.accounts?.TRIPOD?.fx)||1350;
const currency=p=>String(p?.currency||((String(p?.market||'').toUpperCase()==='US')?'USD':'KRW')).toUpperCase();
const qty=p=>Math.abs(z(p?.qty??p?.quantity??p?.held_qty??p?.balance_qty));
const px=p=>n(p?.current_price??p?.price??p?.last_price);
const GENERIC=['market_value','evaluation_amount','eval_amount','valuation','evlu_amt','evaluation_value'];
const EXPLICIT=['market_value_krw','evaluation_amount_krw','eval_amount_krw','valuation_krw','evlu_amt_krw'];

function firstNumber(o,keys){for(const k of keys){const x=n(o?.[k]);if(x!=null)return {key:k,value:x}}return null}
function inferKrw(p,a){
 const explicit=firstNumber(p,EXPLICIT);if(explicit)return {value:explicit.value,mode:'EXPLICIT_KRW',source:explicit.key};
 const raw=firstNumber(p,GENERIC);if(!raw)return null;
 if(currency(p)!=='USD')return {value:raw.value,mode:'KRW_DIRECT',source:raw.key};
 const f=n(p?.fx)||n(a?.fx)||fxGlobal(),q=qty(p),cur=px(p);
 if(q>0&&cur!=null&&cur>0&&f>500){
   const native=q*cur,krw=native*f;
   const eNative=Math.abs(raw.value-native)/Math.max(1,Math.abs(native));
   const eKrw=Math.abs(raw.value-krw)/Math.max(1,Math.abs(krw));
   if(eNative+0.02<eKrw)return {value:raw.value*f,mode:'USD_NATIVE_TO_KRW',source:raw.key,fx:f,eNative,eKrw};
   return {value:raw.value,mode:'ALREADY_KRW',source:raw.key,fx:f,eNative,eKrw};
 }
 return {value:raw.value,mode:'CANONICAL_KRW_FALLBACK',source:raw.key,fx:f};
}

function reconcile(){
 const C=window.__JJOONI_CANONICAL_SSOT;
 const summary={};let touched=0,positions=0,usd=0,converted=0,alreadyKrw=0;
 if(!C||!C.accounts){
   window.__JJOONI_CANONICAL_VALUATION_V13={booted:true,state:'WAITING_FOR_CANONICAL',version:'13.0',touched:0};return;
 }
 Object.entries(C.accounts).forEach(([id,a])=>{
   let total=0,count=0,stamped=0;
   (a?.positions||[]).forEach(p=>{
     if(String(p?.record_type||'POSITION').toUpperCase()!=='POSITION')return;
     positions++;if(currency(p)==='USD')usd++;
     const r=inferKrw(p,a);if(!r||n(r.value)==null)return;
     count++;total+=r.value;
     if(n(p.market_value_krw)==null){
       p.market_value_krw=r.value;
       p.market_value_currency='KRW';
       p.market_value_contract='CANONICAL_KRW_V13';
       p.market_value_reconcile_mode=r.mode;
       p.market_value_reconcile_source=r.source;
       stamped++;touched++;
     }
     if(r.mode==='USD_NATIVE_TO_KRW')converted++;else if(r.mode==='ALREADY_KRW'||r.mode==='KRW_DIRECT'||r.mode==='CANONICAL_KRW_FALLBACK')alreadyKrw++;
   });
   summary[id]={position_count:count,stamped,total_market_value_krw:total,nav:n(a?.nav)};
 });
 window.__JJOONI_CANONICAL_VALUATION_V13={booted:true,state:'ACTIVE',version:'13.0',positions,usd_positions:usd,touched,usd_native_converted:converted,already_krw:alreadyKrw,accounts:summary,fx_krw_per_usd:fxGlobal(),updated_at:new Date().toISOString()};
}

reconcile();
setTimeout(reconcile,150);setTimeout(reconcile,700);setInterval(()=>{if(!document.hidden)reconcile()},500);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)reconcile()});
})();
