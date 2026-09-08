(function(){
'use strict';

function num(v){
  if(v===null||v===undefined||v==='')return null;
  const x=Number(v);return Number.isFinite(x)?x:null;
}
function sym(v){return String(v||'').trim().toUpperCase().replace(/\.(KS|KQ)$/,'')}
function side(t){const s=String(t?.side||'').toUpperCase();return s.includes('SELL')||s.includes('매도')?'SELL':s.includes('BUY')||s.includes('매수')?'BUY':'OTHER'}
function qty(t){return Math.abs(num(t?.qty??t?.quantity??t?.filled_qty)??0)}
function tradePx(t){return num(t?.price??t?.filled_price??t?.avg_price)}
function currentPx(t){return num(t?.current_price??t?.last_price)}
function account(t){return String(t?.account||t?.account_type||'UNKNOWN').toUpperCase()}
function sleeve(t){
  const explicit=String(t?.strategy_sleeve||t?.sleeve||t?.strategy||t?.book||'').trim();
  if(explicit)return explicit;
  const a=account(t);if(a==='AI')return'AI BOT';if(a==='TRIPOD')return'TRI-POD';return a;
}
function parseTs(t){
  const raw=String(t?.filled_at_kst||t?.trade_date||t?.date||'').trim();
  if(!raw)return 0;
  const ms=Date.parse(raw.length<=10?raw+'T00:00:00+09:00':raw);
  return Number.isFinite(ms)?ms:0;
}
function isRecent(ms){return ms>0&&Date.now()-ms<7*86400000}
function currency(t){return String(t?.currency||((String(t?.market||'').toUpperCase()==='US')?'USD':'KRW')).toUpperCase()}
function fmtMoney(v,c='KRW'){
  if(num(v)==null)return'—';
  const sign=v>=0?'+':'-';const a=Math.abs(v);
  return String(c).toUpperCase()==='USD'?sign+'$'+a.toLocaleString('en-US',{maximumFractionDigits:2}):sign+'₩'+Math.round(a).toLocaleString('ko-KR');
}
function fmtPx(v,c='KRW'){
  if(num(v)==null)return'—';
  return String(c).toUpperCase()==='USD'?'$'+Number(v).toLocaleString('en-US',{maximumFractionDigits:2}):'₩'+Math.round(v).toLocaleString('ko-KR');
}
function fmtPct(v){return num(v)==null?'—':(v>=0?'+':'')+(v*100).toFixed(1)+'%'}

function calcOpportunity(trades,fallbackCurrent){
  let money=0,weighted=0,weight=0,latestTs=0,count=0,curr=null;
  for(const t of trades||[]){
    if(side(t)!=='SELL')continue;
    const sp=tradePx(t),q=qty(t),cp=currentPx(t)??num(fallbackCurrent);
    if(!(sp>0)||!(q>0)||!(cp>0))continue;
    money+=(sp-cp)*q;
    weighted+=(cp/sp-1)*q;
    weight+=q;count++;latestTs=Math.max(latestTs,parseTs(t));curr=curr||currency(t);
  }
  return {money:count?money:null,pct:weight?weighted/weight:null,count,latestTs,currency:curr||'KRW'};
}

if(typeof module!=='undefined'&&module.exports)module.exports={calcOpportunity};
if(typeof window==='undefined'||typeof document==='undefined')return;
if(window.__JJOONI_TRADE_OPPORTUNITY_V28?.state==='ACTIVE')return;
const S={state:'BOOTING',version:'28.0',patched_sleeves:0,patched_sells:0};
window.__JJOONI_TRADE_OPPORTUNITY_V28=S;
let applying=false,queued=false;

function allTrades(){
  const out=[];
  try{if(typeof D!=='undefined'&&D.human&&Array.isArray(D.human.trades))out.push(...D.human.trades)}catch(_){}
  try{if(typeof D!=='undefined'&&D.ai&&D.ai.latest&&Array.isArray(D.ai.latest.trades))out.push(...D.ai.latest.trades.map(x=>({...x,account:x.account||'AI'})))}catch(_){}
  return out;
}
function currentFor(ticker,acct,trades){
  const same=(trades||[]).filter(t=>sym(t.ticker||t.symbol)===ticker&&(!acct||account(t)===acct));
  for(const t of [...same].sort((a,b)=>parseTs(b)-parseTs(a))){const p=currentPx(t);if(p>0)return p}
  try{
    const C=window.__JJOONI_CANONICAL_SSOT||{};
    const exact=C.accounts?.[acct]||C.accounts?.[String(acct||'').toUpperCase()];
    for(const p of exact?.positions||[]){if(sym(p.ticker||p.symbol)===ticker){const x=num(p.current_price??p.price??p.last_price);if(x>0)return x}}
    for(const a of Object.values(C.accounts||{}))for(const p of a?.positions||[]){if(sym(p.ticker||p.symbol)===ticker){const x=num(p.current_price??p.price??p.last_price);if(x>0)return x}}
  }catch(_){}
  try{
    for(const w of D?.human?.watchlist||[]){if(sym(w.ticker||w.symbol)===ticker){const x=num(w.current_price??w.price??w.last_price);if(x>0)return x}}
  }catch(_){}
  return null;
}
function metricRow(sleeveEl,label){
  return Array.from(sleeveEl.querySelectorAll('.ctTrMetric')).find(r=>String(r.querySelector('span')?.textContent||'').trim()===label)||null;
}
function ensureOpportunityRow(sleeveEl,closed){
  let row=metricRow(sleeveEl,'기회손익');if(row)return row;
  if(closed){
    row=metricRow(sleeveEl,'평가손익');
    if(row){const s=row.querySelector('span');if(s)s.textContent='기회손익';return row}
  }
  row=document.createElement('div');row.className='ctTrMetric ctOpportunityV28';row.innerHTML='<span>기회손익</span><b>—</b>';
  const realized=metricRow(sleeveEl,'실현손익');
  if(realized)realized.insertAdjacentElement('afterend',row);else sleeveEl.querySelector('.ctSleeveDetail')?.prepend(row);
  return row;
}
function eventKey(t){return [parseTs(t),side(t),qty(t),tradePx(t)].join('|')}
function patchEvents(sleeveEl,trades,fallbackCurrent){
  const ordered=[...(trades||[])].sort((a,b)=>parseTs(b)-parseTs(a));
  const events=Array.from(sleeveEl.querySelectorAll('.ctTrEvent'));let patched=0;
  events.forEach((el,i)=>{
    const t=ordered[i];if(!t||side(t)!=='SELL')return;
    const sp=tradePx(t),q=qty(t),cp=currentPx(t)??fallbackCurrent;if(!(sp>0)||!(q>0)||!(cp>0))return;
    const op=(sp-cp)*q,pct=cp/sp-1,pending=isRecent(parseTs(t));
    let ev=el.querySelector('.ctTrEventEval');
    if(!ev){ev=document.createElement('div');ev.className='ctTrEventEval';el.querySelector('.ctTrEventMain')?.insertAdjacentElement('afterend',ev)}
    const kind=op>=0?'회피손실':'놓친수익';
    ev.textContent=`현재 ${fmtPx(cp,currency(t))} · 기회손익 ${fmtMoney(op,currency(t))} · ${kind}${pending?' · 잠정':''} · 매도 후 ${fmtPct(pct)}`;
    ev.dataset.tradeOpportunityV28=eventKey(t);patched++;
  });
  return patched;
}
function patchSleeve(el,trades){
  const key=String(el.dataset.sleeve||'');const cut=key.indexOf('|');if(cut<1)return {sleeve:0,sells:0};
  const ticker=sym(key.slice(0,cut)),sl=key.slice(cut+1),meta=String(el.querySelector('.ctSleeveMeta')?.textContent||'');
  const acct=(meta.split('·')[0]||'').trim().toUpperCase()||sl.toUpperCase();
  const scoped=trades.filter(t=>sym(t.ticker||t.symbol)===ticker&&(sleeve(t)===sl||account(t)===acct));
  if(!scoped.some(t=>side(t)==='SELL'))return {sleeve:0,sells:0};
  const cp=currentFor(ticker,acct,scoped),r=calcOpportunity(scoped,cp);if(r.count===0)return {sleeve:0,sells:0};
  const closed=meta.includes('청산 완료');const pending=isRecent(r.latestTs);const kind=r.money>=0?'회피손실':'놓친수익';
  const after=metricRow(el,'매도 후 등락');if(after){const b=after.querySelector('b');if(b)b.textContent=`${fmtPct(r.pct)}${pending?' · 잠정':''}`}
  const opRow=ensureOpportunityRow(el,closed);if(opRow){const b=opRow.querySelector('b');if(b)b.textContent=`${fmtMoney(r.money,r.currency)} · ${kind}${pending?' · 잠정':''}`}
  const verdict=el.querySelector('.ctSleeveVerdict');if(verdict&&pending){verdict.textContent=`${r.money>=0?'✓':'✕'} ${kind} · 잠정`}
  if(closed){
    const total=metricRow(el,'실현+평가');if(total){const s=total.querySelector('span'),b=total.querySelector('b');if(s)s.textContent='실현손익 + 기회손익';if(b)b.textContent='각 항목 별도 확인'}
  }
  return {sleeve:1,sells:patchEvents(el,scoped,cp)};
}
function apply(){
  if(applying)return;const root=document.getElementById('ctTradeReviewV2');if(!root)return;
  applying=true;try{
    const trades=allTrades();let ps=0,pt=0;
    root.querySelectorAll('.ctSleeve').forEach(el=>{const r=patchSleeve(el,trades);ps+=r.sleeve;pt+=r.sells});
    S.state='ACTIVE';S.patched_sleeves=ps;S.patched_sells=pt;S.updated_at=new Date().toISOString();
  }finally{applying=false}
}
function schedule(){if(queued)return;queued=true;setTimeout(()=>{queued=false;apply()},0)}
document.addEventListener('jjooni:live-applied',schedule);
document.addEventListener('click',schedule,true);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});
try{new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true});}catch(_){}
setTimeout(apply,0);setTimeout(apply,300);setTimeout(apply,1000);setTimeout(apply,2200);
})();
