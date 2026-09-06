(function(){
'use strict';
if(window.__JJOONI_IRP_TRADE_UNIT_GUARD_V18?.booted)return;

const STATE={booted:true,state:'BOOTING',version:'18.0',excluded:0,evaluable:0,updated_at:null};
window.__JJOONI_IRP_TRADE_UNIT_GUARD_V18=STATE;

const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null};
const sym=v=>String(v||'').trim().toUpperCase().replace(/\.(KS|KQ)$/,'');
const normName=v=>String(v||'').replace(/\s+/g,' ').trim();
const pct=v=>n(v)==null?'—':(Number(v)>=0?'+':'')+Number(v).toFixed(2)+'%';
const side=t=>{const s=String(t?.side||'').toUpperCase();return s.includes('SELL')||s.includes('매도')?'SELL':s.includes('BUY')||s.includes('매수')?'BUY':'OTHER'};
const tradePrice=t=>n(t?.price??t?.filled_price??t?.avg_price);
const acct=t=>String(t?.account||t?.account_type||'').trim().toUpperCase();

function C(){return window.__JJOONI_CANONICAL_SSOT||{}}
function irpPositions(){return C().accounts?.IRP?.positions||[]}
function isFundPosition(p){
 const k=sym(p?.ticker||p?.symbol),r=String(p?.record_type||'').toUpperCase(),nm=normName(p?.name);
 return /^F\d+$/i.test(k)||r==='FUND'||/(자투자신탁|투자신탁|TDF|펀드)/i.test(nm);
}
function fundSets(){
 const rows=irpPositions().filter(isFundPosition);
 return {tickers:new Set(rows.map(p=>sym(p?.ticker||p?.symbol)).filter(Boolean)),names:new Set(rows.map(p=>normName(p?.name)).filter(Boolean))};
}
function isFundTrade(t,sets){
 const k=sym(t?.ticker||t?.symbol),nm=normName(t?.name||t?.stock_name),r=String(t?.record_type||'').toUpperCase();
 return sets.tickers.has(k)||sets.names.has(nm)||/^F\d+$/i.test(k)||r==='FUND'||/(자투자신탁|투자신탁|TDF|펀드)/i.test(nm);
}
function irpTrades(){
 try{return [...(D.human?.trades||[])].filter(t=>acct(t)==='IRP')}catch(_){return []}
}
function quotePrice(t){
 const k=sym(t?.ticker||t?.symbol),p=irpPositions().find(x=>sym(x?.ticker||x?.symbol)===k),pv=n(p?.current_price??p?.price);
 if(pv!=null&&pv>0)return pv;
 try{
  const q=D.human?.trade_quotes||{},direct=q[t?.ticker]||q[k]||Object.entries(q).find(([kk])=>sym(kk)===k)?.[1],v=n(direct?.price);
  if(v!=null&&v>0)return v;
 }catch(_){}
 return null;
}
function scoreTrades(){
 const sets=fundSets(),scored=[],excluded=[];
 irpTrades().forEach(t=>{
  const entry=tradePrice(t),cur=quotePrice(t),sd=side(t),fund=isFundTrade(t,sets);
  if(fund&&String(t?.price_unit||'').toUpperCase()!=='COMPARABLE_NAV_UNIT'){
   excluded.push({...t,_reason:'펀드 체결금액과 현재 기준가 단위 불일치'});return;
  }
  if(!(entry>0&&cur>0)){excluded.push({...t,_reason:'현재가 또는 체결가 없음'});return;}
  const ratio=cur/entry;
  if(ratio>5||ratio<0.2){excluded.push({...t,_reason:'가격 단위 불일치'});return;}
  let perf=null;
  if(sd==='BUY')perf=(cur/entry-1)*100;
  else if(sd==='SELL')perf=(entry/cur-1)*100;
  if(perf==null){excluded.push({...t,_reason:'매수/매도 구분 불가'});return;}
  scored.push({...t,_perf:perf});
 });
 return {sets,scored,excluded};
}
function modal(){return document.getElementById('accountDrillModal')}
function isIrpModal(m){return !!(m&&normName(m.querySelector('h2')?.textContent).toUpperCase()==='IRP')}
function parseDomFallback(m,sets){
 const out=[];
 m.querySelectorAll('.trade').forEach(row=>{
  const nm=normName(row.querySelector('.name')?.textContent),fund=sets.names.has(nm)||/(자투자신탁|투자신탁|TDF|펀드)/i.test(nm);
  if(fund)return;
  const txt=normName(row.querySelector('.right b')?.textContent),mm=txt.match(/([+-]?\d+(?:\.\d+)?)%/);
  if(mm){const v=Number(mm[1]);if(Number.isFinite(v)&&Math.abs(v)<=500)out.push({_perf:v,name:nm});}
 });
 return out;
}
function setKpi(el,text){const v=el?.querySelector('.value');if(v)v.textContent=text}
function patchRows(m,sets){
 let excludedRows=0;
 m.querySelectorAll('.trade').forEach(row=>{
  const nm=normName(row.querySelector('.name')?.textContent),fund=sets.names.has(nm)||/(자투자신탁|투자신탁|TDF|펀드)/i.test(nm);
  if(!fund)return;
  const b=row.querySelector('.right b'),s=row.querySelector('.right .sub');
  if(b){b.textContent='산정 제외';b.className='v2Muted'}
  if(s)s.textContent='펀드 체결금액≠기준가 단위';
  row.dataset.irpUnitExcluded='1';excludedRows++;
 });
 return excludedRows;
}
function patchSummary(m,data){
 let scored=data.scored;
 if(!scored.length)scored=parseDomFallback(m,data.sets);
 const fav=scored.filter(x=>x._perf>0),avg=scored.length?scored.reduce((s,x)=>s+x._perf,0)/scored.length:null;
 const best=[...scored].sort((a,b)=>b._perf-a._perf)[0],worst=[...scored].sort((a,b)=>a._perf-b._perf)[0];
 m.querySelectorAll('.v2Kpi').forEach(el=>{
  const lab=normName(el.querySelector('.label')?.textContent);
  if(lab==='평가 가능 거래'||lab==='평가 가능한 거래')setKpi(el,scored.length+'건');
  else if(lab==='유리한 체결')setKpi(el,scored.length?`${fav.length}/${scored.length}`:'—');
  else if(lab==='유리 체결률')setKpi(el,scored.length?(fav.length/scored.length*100).toFixed(1)+'%':'—');
  else if(lab==='평균 체결후 성과')setKpi(el,avg==null?'—':pct(avg));
  else if(lab.startsWith('Best'))setKpi(el,best?`${best.name||best.ticker||'거래'} ${pct(best._perf)}`:'—');
  else if(lab.startsWith('Worst'))setKpi(el,worst?`${worst.name||worst.ticker||'거래'} ${pct(worst._perf)}`:'—');
 });
 STATE.evaluable=scored.length;
}
function note(m,count){
 let e=m.querySelector('#ctIrpTradeUnitGuardV18Note');
 if(!e){
  e=document.createElement('div');e.id='ctIrpTradeUnitGuardV18Note';e.className='sub';
  e.style.cssText='margin:8px 0 12px;color:#f5b942;font-weight:800';
  const h=[...m.querySelectorAll('h3')].find(x=>/최근.*매매/.test(normName(x.textContent)));
  if(h)h.insertAdjacentElement('afterend',e);
 }
 if(e)e.textContent=`※ 펀드 ${count}건은 체결금액과 기준가 단위가 달라 체결후 성과에서 제외했습니다.`;
}
function apply(){
 const m=modal();if(!isIrpModal(m))return;
 const data=scoreTrades(),rowCount=patchRows(m,data.sets),excludedFund=data.excluded.filter(t=>isFundTrade(t,data.sets)).length;
 patchSummary(m,data);note(m,Math.max(rowCount,excludedFund));
 STATE.excluded=Math.max(rowCount,excludedFund);STATE.state='ACTIVE';STATE.updated_at=new Date().toISOString();
}
function wrap(){
 const fn=window.openAccountDrilldown;if(typeof fn!=='function'||fn.__jjooniIrpUnitGuardV18)return;
 const w=function(){const r=fn.apply(this,arguments);setTimeout(apply,0);setTimeout(apply,80);setTimeout(apply,250);setTimeout(apply,700);return r};
 w.__jjooniIrpUnitGuardV18=true;w.__original=fn;window.openAccountDrilldown=w;
}
wrap();setTimeout(wrap,400);setTimeout(apply,500);
document.addEventListener('jjooni:live-applied',()=>{wrap();setTimeout(apply,0)});
document.addEventListener('click',e=>{if(e.target?.closest?.('[data-account-drill]'))setTimeout(apply,100)},{capture:true});
})();
