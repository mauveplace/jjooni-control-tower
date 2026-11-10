(function(root){
'use strict';
const PAIRS={BTCUSD:'BTCUSDT',ETHUSD:'ETHUSDT'}, BASE='https://data-api.binance.vision/api/v3/trades?limit=1&symbol=';
function parse(key,data,now=Date.now()){
 const row=Array.isArray(data)&&data[0], value=Number(row?.price), ms=Number(row?.time);
 if(!PAIRS[key]||!Number.isFinite(value)||value<=0||!Number.isFinite(ms)||ms>now+60000||now-ms>1200000)throw Error('INVALID_OR_STALE_TRADE');
 return {key,value,observed_at:new Date(ms).toISOString(),session_date:new Date(ms).toISOString().slice(0,10),source:'Binance '+PAIRS[key],quote_currency:'USDT',market_state:'CONTINUOUS',refresh_status:'FETCHED'};
}
if(typeof module==='object'&&module.exports){module.exports={parse,PAIRS};return}
let rows={},pending=null,last=0;
const state={status:'WAITING',get(key,publishedAt){let q=rows[key];if(!q)return null;let p=Date.parse(publishedAt);if(Number.isFinite(p)&&p>Date.parse(q.observed_at))return null;let age=Date.now()-Date.parse(q.observed_at);return {...q,display_status:q.refresh_status==='RETAINED'?'이전 관측 유지':age>1200000?'관측 지연':'최근 거래 관측',age_label:Math.max(0,Math.floor(age/60000))+'분 전'}},async refresh(force=false){
 if(pending)return pending;if(!force&&(document.hidden||Date.now()-last<60000))return;last=Date.now();state.status='CHECKING';
 pending=Promise.allSettled(Object.entries(PAIRS).map(async([key,pair])=>{let r=await fetch(BASE+pair,{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('HTTP_'+r.status);return parse(key,await r.json())})).then(results=>{
  let success=0;Object.keys(PAIRS).forEach((key,i)=>{let r=results[i];if(r.status==='fulfilled'){if(!rows[key]||Date.parse(r.value.observed_at)>=Date.parse(rows[key].observed_at))rows[key]=r.value;success++}else if(rows[key])rows[key]={...rows[key],refresh_status:'RETAINED'}});
  state.status=success===2?'COMPLETE':success?'PARTIAL':'FAILED';root.__JJOONI_LATEST_BOARD?.render?.();return state.status;
 }).finally(()=>{pending=null});return pending;
}};
root.__JJOONI_CRYPTO_ON_VIEW=state;
function resume(){state.refresh(false).catch(()=>{})}
document.addEventListener('visibilitychange',resume);root.addEventListener('pageshow',resume);resume();
})(typeof window==='object'?window:globalThis);
