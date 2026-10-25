/* Private holdings/trades supply the startup name subset; no account data is published. */
(function(root){
'use strict';
if(root.__JJOONI_SECURITY_NAMES_HELD)return;
root.__JJOONI_SECURITY_NAMES_HELD={version:'1.0'};
const names=root.__JJOONI_SECURITY_NAMES=root.__JJOONI_SECURITY_NAMES||{};
const symbol=v=>{const s=String(v||'').trim().toUpperCase();return /^\d{1,6}$/.test(s)?s.padStart(6,'0'):s};
function rows(){
 const canon=root.__JJOONI_CANONICAL_SSOT?.accounts||{},live=root.__JJOONI_LIVE_PAYLOAD||{};
 let human={};try{if(typeof D==='object')human=D.human||{}}catch(_){}
 return [...(human.positions||[]),...(human.trades||[]),...(live.recent_trades||[]),...Object.values(canon).flatMap(a=>a.positions||[])];
}
function refresh(){let changed=false;for(const row of rows()){
 const key=symbol(row.ticker||row.symbol),name=String(row.name||row.stock_name||row.security_name||row.prdt_name||'').trim();
 if(key&&name&&symbol(name)!==key&&names[key]!==name){names[key]=name;changed=true;}
}if(changed)root.dispatchEvent(new CustomEvent('jjooni:security-names-ready',{detail:{count:Object.keys(names).length,scope:'HOLDINGS_AND_TRADES'}}));}
let fullPromise=null;
function ensureFull(){
 if(fullPromise)return fullPromise;
 fullPromise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.id='ctSecurityNamesFullScript';script.src='security-names-v1.js?v=1&_ctboot='+encodeURIComponent(root.__JJOONI_UI_RELEASE||'20261025-r5');script.onload=()=>resolve(names);script.onerror=()=>{script.remove();fullPromise=null;reject(Error('SECURITY_MASTER_UNAVAILABLE'))};document.head.appendChild(script)});
 return fullPromise;
}
root.__JJOONI_LOAD_SECURITY_MASTER=ensureFull;
refresh();document.addEventListener('jjooni:live-applied',refresh);
document.addEventListener('click',event=>{
 const tab=event.target?.closest?.('[data-tab]')?.dataset.tab;
 if(['trades','watchlist'].includes(tab)&&rows().some(row=>{const key=symbol(row.ticker||row.symbol);return key&&!names[key]}))ensureFull().catch(()=>{});
},{capture:true});
})(window);
