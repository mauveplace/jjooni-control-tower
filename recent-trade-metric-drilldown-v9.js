(function(){
'use strict';
if(window.__JJOONI_RECENT_TRADE_DRILL_V9)return;

const STATE={activeAccount:null,wrapped:null,bound:0,last:null};
const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null};
const z=v=>n(v)==null?0:n(v);
const normTicker=v=>String(v||'').trim().toUpperCase().replace(/\.(KS|KQ)$/,'');
const normAcct=v=>{const s=String(v||'').trim().toUpperCase();if(['AIBOT','AI_BOT'].includes(s))return'AI';if(s==='PENSION'||s==='연금저축')return'PENSION';return s};
const side=t=>{const s=String(t&&t.side||'').toUpperCase();return s.includes('SELL')||s.includes('매도')?'SELL':s.includes('BUY')||s.includes('매수')?'BUY':'OTHER'};
const qty=t=>Math.abs(z(t&&(t.qty||t.quantity||t.filled_qty)));
const price=t=>n(t&&(t.price||t.filled_price||t.avg_price));
const when=t=>String(t&&(t.filled_at_kst||t.filled_at||t.trade_date||t.time||t.date)||'').trim();
const pct=v=>n(v)==null?'—':(Number(v)>=0?'+':'')+Number(v).toFixed(2)+'%';
const shortDate=s=>{const x=String(s||'');const m=x.match(/(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);return m?(m[2]+'/'+m[3]+(m[4]?' '+m[4]+':'+m[5]:'')):x.slice(0,16)};
const currency=t=>{const c=String(t&&t.currency||'').toUpperCase();if(c)return c;const m=String(t&&t.market||'').toUpperCase();return m==='US'?'USD':'KRW'};
const fmtPx=(v,t)=>{const x=n(v);if(x==null)return'—';return currency(t)==='USD'?'$'+x.toLocaleString('en-US',{maximumFractionDigits:4}):'₩'+Math.round(x).toLocaleString('ko-KR')};

function visible(e){return !!(e&&(e.offsetWidth||e.offsetHeight||e.getClientRects().length))}
function modal(){return document.getElementById('accountDrillModal')}
function inferAccount(){
 if(STATE.activeAccount)return STATE.activeAccount;
 const m=modal();if(!m)return null;const h=String((m.querySelector('h2')||{}).textContent||'').trim().toUpperCase();
 if(h.includes('AI BOT'))return'AI';if(h==='ISA')return'ISA';if(h.includes('연금저축'))return'PENSION';if(h==='IRP')return'IRP';if(h.includes('TOSS'))return'TOSS';return null;
}
function humanPositions(acct){
 try{return [...(D.human?.positions||[])].filter(x=>normAcct(x.account||x.account_type)===acct)}catch(_){return []}
}
function humanTrades(acct){
 try{return [...(D.human?.trades||[])].filter(t=>normAcct(t.account||t.account_type)===acct).sort((a,b)=>when(b).localeCompare(when(a)))}catch(_){return []}
}
function aiTrades(){
 try{const a=Array.isArray(D.ai?.trades_31d)&&D.ai.trades_31d.length?D.ai.trades_31d:(D.ai?.latest?.trades||[]);return [...a].map(t=>({...t,account:'AI'})).sort((x,y)=>when(y).localeCompare(when(x)))}catch(_){return []}
}
function aiPositions(){
 try{const L=D.ai?.latest||{};return [...(L.holdings_kr||[]).map(x=>({...x,account:'AI',currency:'KRW',market:'KR',current_price:n(x.current_price??x.price)})),...(L.holdings_us||[]).map(x=>({...x,account:'AI',currency:'USD',market:'US',current_price:n(x.current_price??x.price)}))]}catch(_){return []}
}
function quotePrice(t,acct,positions){
 const nt=normTicker(t.ticker||t.symbol);
 const p=(positions||[]).find(x=>normTicker(x.ticker||x.symbol)===nt),pp=n(p&&(p.current_price??p.price));if(pp!=null&&pp>0)return pp;
 if(acct==='AI')return null;
 try{
  const q=D.human?.trade_quotes||{},direct=q[t.ticker]||q[nt]||Object.entries(q).find(([k])=>normTicker(k)===nt)?.[1],v=n(direct&&direct.price);if(v!=null&&v>0)return v;
 }catch(_){}
 return null;
}
function incompatibleUnits(t,entry,cur,positions){
 const nt=normTicker(t.ticker||t.symbol),p=(positions||[]).find(x=>normTicker(x.ticker||x.symbol)===nt)||{},record=String(t.record_type||p.record_type||'').toUpperCase();
 const fund=/^F\d+$/i.test(nt)||record==='FUND';
 if(fund){
   // Historical PB fund trades use transaction amount in some rows while the
   // current position uses total fund valuation/NAV. Those are not comparable
   // unit prices and must never be divided into a post-trade return.
   if(String(t.price_unit||'').toUpperCase()!=='COMPARABLE_NAV_UNIT')return '펀드 체결금액과 현재 기준가 단위 불일치';
 }
 if(!(entry>0&&cur>0))return '현재가 또는 체결가 없음';
 const ratio=cur/entry;
 if(ratio>5||ratio<0.2)return '가격 단위 불일치';
 return null;
}
function build(acct){
 acct=normAcct(acct);const trades=acct==='AI'?aiTrades():humanTrades(acct),positions=acct==='AI'?aiPositions():humanPositions(acct),excluded=[];
 const scored=[];
 trades.forEach(t=>{const entry=price(t),cur=quotePrice(t,acct,positions),sd=side(t),reason=incompatibleUnits(t,entry,cur,positions);if(reason){excluded.push({...t,_excludeReason:reason,_current:cur,_side:sd});return}let perf=null;if(entry>0&&cur>0){if(sd==='BUY')perf=(cur/entry-1)*100;else if(sd==='SELL')perf=(entry/cur-1)*100}if(perf!=null)scored.push({...t,_perf:perf,_current:cur,_side:sd})});
 const favorable=scored.filter(t=>t._perf>0),unfavorable=scored.filter(t=>!(t._perf>0)),avg=scored.length?scored.reduce((s,t)=>s+t._perf,0)/scored.length:null,sum=scored.reduce((s,t)=>s+t._perf,0);
 return {acct,trades,scored,excluded,favorable,unfavorable,avg,sum};
}
function tradeRow(t,i){
 const name=t.name||t.ticker||'거래',sd=t._side==='SELL'?'매도':t._side==='BUY'?'매수':'거래',cls=t._perf>0?'유리':t._perf<0?'불리':'보합';
 return [`${i+1}. ${name} · ${sd} · ${shortDate(when(t))}`,`${pct(t._perf)} · ${cls} · ${qty(t).toLocaleString('ko-KR')}주 · ${fmtPx(price(t),t)} → ${fmtPx(t._current,t)}`];
}
function excludedRow(t,i){return [`제외 ${i+1}. ${t.name||t.ticker||'거래'} · ${shortDate(when(t))}`,t._excludeReason||'성과 산정 제외']}
function headlineSnapshot(){
 const m=modal(),out={};if(!m)return out;
 m.querySelectorAll('.v2Kpi').forEach(el=>{const lab=String((el.querySelector('.label')||{}).textContent||'').replace(/\s+/g,' ').trim(),val=String((el.querySelector('.value')||{}).textContent||'').trim();if(lab)out[lab]=val});return out;
}
function openDetail(kind,label,value){
 const acct=inferAccount(),d=build(acct);if(!acct||typeof window.openMetricInfo!=='function')return;
 let rows=[];
 const excludedNote=d.excluded.length?[['성과 제외',d.excluded.length+'건 · 비교 가능한 가격 단위가 없는 거래']]:[];
 if(kind==='evaluable'){
  rows=[['산정 기준','동일 가격 단위 + 현재가 확인 거래만 포함'],['평가 거래수',d.scored.length+'건'],...excludedNote,...d.scored.map(tradeRow),...d.excluded.map(excludedRow)];
 }else if(kind==='favorable'){
  rows=[['유리한 체결',d.favorable.length+'건'],['불리·보합',d.unfavorable.length+'건'],...excludedNote,['판정 기준','매수는 현재가 상승, 매도는 매도 후 가격 하락이 +'],...d.scored.map(tradeRow)];
 }else if(kind==='rate'){
  rows=[['유리한 체결',d.favorable.length+'건'],['전체 평가 거래',d.scored.length+'건'],...excludedNote,['산식',`${d.favorable.length} ÷ ${d.scored.length||0} × 100 = ${d.scored.length?(d.favorable.length/d.scored.length*100).toFixed(1):'—'}%`],...d.scored.map(tradeRow)];
 }else if(kind==='average'){
  rows=[['체결후 성과 합계',pct(d.sum)],['평가 거래수',d.scored.length+'건'],...excludedNote,['산식',d.scored.length?`${d.sum.toFixed(4)}% ÷ ${d.scored.length} = ${d.avg.toFixed(4)}%`:'—'],...d.scored.map(tradeRow)];
 }
 const heads=headlineSnapshot();window.openMetricInfo(label,value,rows);
 STATE.last={kind,account:acct,evaluable:d.scored.length,excluded:d.excluded.length,favorable:d.favorable.length,rate:d.scored.length?d.favorable.length/d.scored.length*100:null,average:d.avg,headline:value,headlines:heads};
 window.__JJOONI_RECENT_TRADE_DRILL_V9={state:'ACTIVE',version:'9.2',bound:STATE.bound,last:STATE.last};
}
function setKpi(el,text){const v=el&&el.querySelector('.value');if(v&&String(v.textContent||'').trim()!==String(text))v.textContent=text}
function rewriteTradeRows(m,d){
 const fundNames=new Set(d.excluded.map(t=>String(t.name||'').trim()).filter(Boolean));
 m.querySelectorAll('.trade').forEach(row=>{const name=String(row.querySelector('.name')?.textContent||'').trim();if(!fundNames.has(name))return;const b=row.querySelector('.right b'),s=row.querySelector('.right .sub');if(b){b.textContent='산정 제외';b.className='v2Muted'}if(s)s.textContent='가격단위 불일치'});
}
function syncHeadlines(m,d){
 m.querySelectorAll('.v2Kpi').forEach(el=>{const lab=String(el.querySelector('.label')?.textContent||'').replace(/\s+/g,' ').trim();if(lab==='평가 가능 거래'||lab==='평가 가능한 거래')setKpi(el,d.scored.length+'건');else if(lab==='유리한 체결')setKpi(el,d.scored.length?`${d.favorable.length}/${d.scored.length}`:'—');else if(lab==='유리 체결률')setKpi(el,d.scored.length?(d.favorable.length/d.scored.length*100).toFixed(1)+'%':'—');else if(lab==='평균 체결후 성과')setKpi(el,d.avg==null?'—':pct(d.avg));else if(lab.startsWith('Best')){const best=[...d.scored].sort((a,b)=>b._perf-a._perf)[0];setKpi(el,best?`${best.name||best.ticker} ${pct(best._perf)}`:'—')}else if(lab.startsWith('Worst')){const worst=[...d.scored].sort((a,b)=>a._perf-b._perf)[0];setKpi(el,worst?`${worst.name||worst.ticker} ${pct(worst._perf)}`:'—')}});
 rewriteTradeRows(m,d);
 let note=m.querySelector('#ctTradeUnitGuardV92');if(!note&&d.excluded.length){note=document.createElement('div');note.id='ctTradeUnitGuardV92';note.className='sub';note.style.cssText='margin:8px 0;color:#f5b942;font-weight:800';const h=[...m.querySelectorAll('h3')].find(x=>String(x.textContent||'').includes('최근')&&String(x.textContent||'').includes('매매'));if(h)h.insertAdjacentElement('afterend',note)}if(note)note.textContent=`※ 가격단위 불일치 ${d.excluded.length}건은 체결후 성과에서 제외했습니다.`;
}
function bind(){
 const m=modal();if(!m||!visible(m))return;const acct=inferAccount(),d=build(acct);syncHeadlines(m,d);
 const defs=[{kind:'evaluable',labels:['평가 가능 거래','평가 가능한 거래']},{kind:'favorable',labels:['유리한 체결']},{kind:'rate',labels:['유리 체결률']},{kind:'average',labels:['평균 체결후 성과']}];
 let count=0;m.querySelectorAll('.v2Kpi').forEach(el=>{const lab=String((el.querySelector('.label')||{}).textContent||'').replace(/\s+/g,' ').trim(),def=defs.find(x=>x.labels.some(y=>lab===y||lab.startsWith(y)));if(!def)return;el.dataset.noAutoDrill='1';delete el.dataset.autoDrill;el.dataset.tradeMetricDetail=def.kind;el.style.cursor='pointer';el.onclick=ev=>{ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();const value=String((el.querySelector('.value')||{}).textContent||'').trim();openDetail(def.kind,lab,value);return false};count++});
 STATE.bound=count;window.__JJOONI_RECENT_TRADE_DRILL_V9={state:count?'ACTIVE':'WAITING',version:'9.2',bound:count,last:STATE.last,current:{account:acct,evaluable:d.scored.length,excluded:d.excluded.length,favorable:d.favorable.length,average:d.avg}};
}
function wrap(){
 const fn=window.openAccountDrilldown;if(typeof fn!=='function'||fn.__jjooniRecentTradeV9)return;
 const wrapped=function(acct){STATE.activeAccount=normAcct(acct);const r=fn.apply(this,arguments);setTimeout(bind,0);setTimeout(bind,80);setTimeout(bind,250);return r};wrapped.__jjooniRecentTradeV9=true;wrapped.__original=fn;window.openAccountDrilldown=wrapped;STATE.wrapped=wrapped;
}
wrap();setTimeout(wrap,400);setTimeout(bind,500);
document.addEventListener('jjooni:live-applied',()=>setTimeout(bind,0));
document.addEventListener('click',e=>{const a=e.target?.closest?.('[data-account-drill]');if(a){STATE.activeAccount=normAcct(a.dataset.accountDrill);setTimeout(bind,40)}},{capture:true});
document.addEventListener('jjooni:live-applied',()=>{wrap();bind()});
window.__JJOONI_RECENT_TRADE_DRILL_V9={state:'BOOTING',version:'9.2',bound:0,last:null};
})();
