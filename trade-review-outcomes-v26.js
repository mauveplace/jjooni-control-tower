(function(){
'use strict';

const RT={state:'WAITING',version:'26.0',rendered_at:null,sell_count:0,realized_known:0,opportunity_known:0,missing_realized:0,missing_opportunity:0};
window.__JJOONI_TRADE_OUTCOMES_V26=RT;
const q=(s,r=document)=>{try{return r.querySelector(s)}catch(_){return null}};
const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(String(v).replace(/,/g,''));return Number.isFinite(x)?x:null};
const sym=v=>String(v||'').trim().toUpperCase().replace(/\.(KS|KQ)$/,'');
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const side=t=>{const s=String(t?.side||'').toUpperCase();return s.includes('SELL')||s.includes('매도')?'SELL':s.includes('BUY')||s.includes('매수')?'BUY':'OTHER'};
const acct=t=>String(t?.account||t?.account_type||'UNKNOWN').toUpperCase();
const qty=t=>Math.abs(n(t?.qty??t?.quantity??t?.filled_qty)??0);
const px=t=>n(t?.price??t?.filled_price??t?.avg_price);
const ccy=t=>String(t?.currency||((String(t?.market||'').toUpperCase()==='US')?'USD':'KRW')).toUpperCase();
const ts=t=>String(t?.filled_at_kst||t?.filled_at||t?.trade_date||t?.date||'');
const ticker=t=>sym(t?.ticker||t?.symbol);
const name=t=>String(t?.name||t?.stock_name||t?.ticker||t?.symbol||'UNKNOWN').trim();

function firstNum(o,keys){for(const k of keys){const x=n(o&&o[k]);if(x!==null)return {value:x,key:k}}return null}
function fee(t){return firstNum(t,['commission','fee','commission_krw','fee_krw'])?.value??0}
function tax(t){return firstNum(t,['tax','tax_krw','transaction_tax'])?.value??0}
function explicitRealized(t){
 let x=firstNum(t,['realized_pnl_krw','pnl_realized_krw','realized_profit_krw']);
 if(x)return {value:x.value,currency:'KRW',basis:'BROKER/LEDGER'};
 x=firstNum(t,['realized_pnl','pnl_realized','realized_profit']);
 return x?{value:x.value,currency:ccy(t),basis:'BROKER/LEDGER'}:null;
}
function money(v,c){
 if(v===null||!Number.isFinite(v))return '—';
 const sign=v>0?'+':v<0?'-':'';const a=Math.abs(v);
 return String(c).toUpperCase()==='USD'?sign+'$'+a.toLocaleString('en-US',{maximumFractionDigits:2}):sign+'₩'+Math.round(a).toLocaleString('ko-KR');
}
function price(v,c){if(v===null)return '—';return String(c).toUpperCase()==='USD'?'$'+v.toLocaleString('en-US',{maximumFractionDigits:2}):'₩'+Math.round(v).toLocaleString('ko-KR')}
function cls(v){return v===null?'na':v>0?'pos':v<0?'neg':'zero'}

function collectTrades(){
 const out=[];
 try{if(window.D?.human&&Array.isArray(D.human.trades))out.push(...D.human.trades)}catch(_){}
 try{if(window.D?.ai?.latest&&Array.isArray(D.ai.latest.trades))out.push(...D.ai.latest.trades.map(x=>({...x,account:x.account||'AI'})))}catch(_){}
 const seen=new Set(),dedup=[];
 out.forEach((t,i)=>{
  const oid=String(t?.order_id||t?.order_no||'').trim();
  const key=oid?'OID|'+acct(t)+'|'+oid:['SIG',acct(t),String(t?.trade_date||''),ticker(t),side(t),qty(t),px(t)].join('|');
  if(seen.has(key))return;seen.add(key);dedup.push({...t,__seq:i});
 });
 return dedup;
}

function reconstructRealized(trades){
 const books=new Map(),map=new Map();
 const ordered=[...trades].sort((a,b)=>{
  const at=Date.parse(ts(a))||Date.parse(String(a.trade_date||'')+'T00:00:00+09:00')||0;
  const bt=Date.parse(ts(b))||Date.parse(String(b.trade_date||'')+'T00:00:00+09:00')||0;
  return at-bt||a.__seq-b.__seq;
 });
 for(const t of ordered){
  const k=acct(t)+'|'+ticker(t),qv=qty(t),p=px(t);if(!ticker(t)||!qv||p===null)continue;
  let b=books.get(k)||{qty:0,avg:null,incomplete:false};
  if(side(t)==='BUY'){
   if(b.qty<0)b.incomplete=true;
   const oldCost=(b.avg??0)*Math.max(0,b.qty),newQty=Math.max(0,b.qty)+qv;
   b.avg=newQty>0?(oldCost+p*qv)/newQty:p;b.qty=newQty;
  }else if(side(t)==='SELL'){
   const ex=explicitRealized(t);
   if(ex){map.set(t,{...ex,state:'OK'});b.qty=Math.max(0,b.qty-qv);if(b.qty<=1e-9)b.avg=null;}
   else if(!b.incomplete&&b.avg!==null&&b.qty+1e-9>=qv){
    const realized=(p-b.avg)*qv-fee(t)-tax(t);
    map.set(t,{value:realized,currency:ccy(t),basis:'WEIGHTED_AVG_LEDGER',state:'OK',avg_cost:b.avg});
    b.qty-=qv;if(b.qty<=1e-9){b.qty=0;b.avg=null}
   }else{
    map.set(t,{value:null,currency:ccy(t),basis:'COST_BASIS_INCOMPLETE',state:'NA'});
    b.incomplete=true;b.qty=Math.max(0,b.qty-qv);if(b.qty<=1e-9)b.avg=null;
   }
  }
  books.set(k,b);
 }
 return map;
}

function currentPriceMap(trades){
 const m=new Map();
 const set=(a,s,v)=>{const x=n(v);if(x!==null&&x>0&&s)m.set(String(a||'')+'|'+sym(s),x)};
 trades.forEach(t=>set(acct(t),ticker(t),t.current_price??t.last_price));
 try{Object.entries(window.__JJOONI_CANONICAL_SSOT?.accounts||{}).forEach(([a,o])=>(o.positions||[]).forEach(p=>set(a,p.ticker||p.symbol,p.current_price||p.price||p.last_price)))}catch(_){}
 try{const w=D?.human?.watchlist||{};[...(w.kr||[]),...(w.us||[])].forEach(x=>{const s=sym(x.ticker||x.symbol),v=x.current_price||x.price;for(const a of ['TOSS','ISA','PENSION','IRP','AI','TRIPOD'])set(a,s,v)})}catch(_){}
 return m;
}

function buildRows(){
 const trades=collectTrades(),realized=reconstructRealized(trades),curMap=currentPriceMap(trades);
 return trades.filter(t=>side(t)==='SELL'&&ticker(t)&&qty(t)>0&&px(t)!==null).map(t=>{
  const r=realized.get(t)||{value:null,currency:ccy(t),basis:'COST_BASIS_INCOMPLETE',state:'NA'};
  const cp=n(t.current_price??t.last_price)??curMap.get(acct(t)+'|'+ticker(t))??null;
  const op=cp!==null?(px(t)-cp)*qty(t):null;
  const dt=Date.parse(ts(t))||Date.parse(String(t.trade_date||'')+'T00:00:00+09:00')||0;
  const age=dt?Math.max(0,Math.floor((Date.now()-dt)/86400000)):999;
  return {t,realized:r,current:cp,opportunity:op,pending:age<7,time:dt};
 }).sort((a,b)=>b.time-a.time).slice(0,16);
}

function ensureStyle(){
 if(q('#ctTradeOutcomeV26Style'))return;
 const s=document.createElement('style');s.id='ctTradeOutcomeV26Style';s.textContent=`
 #ctTradeOutcomeV26{margin:8px 0 12px;font-family:system-ui,-apple-system,sans-serif;color:#172b45}
 .ctO26Head{display:flex;justify-content:space-between;gap:10px;align-items:end;margin:0 2px 7px}.ctO26Title{font-size:17px;font-weight:950}.ctO26Sub{font-size:10px;color:#718196;margin-top:2px}.ctO26Badge{font-size:10px;font-weight:850;color:#38526c;background:#eef4fa;border:1px solid #d9e4ef;border-radius:999px;padding:5px 8px;white-space:nowrap}
 .ctO26Summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-bottom:7px}.ctO26Sum{background:#fff;border:1px solid #e0e7ef;border-radius:10px;padding:8px 10px;min-height:54px}.ctO26Sum span{display:block;font-size:10px;color:#718196;font-weight:750}.ctO26Sum b{display:block;font-size:16px;line-height:1.15;margin-top:4px;letter-spacing:-.02em}.ctO26Sum small{display:block;font-size:9px;color:#8a98a8;margin-top:2px}
 .ctO26List{display:grid;gap:5px}.ctO26Row{background:#fff;border:1px solid #e1e7ee;border-radius:10px;padding:8px 10px;display:grid;grid-template-columns:minmax(150px,1.35fr) repeat(2,minmax(105px,.65fr));gap:8px;align-items:center;box-shadow:0 2px 8px rgba(22,43,69,.025)}.ctO26Name{font-size:13px;font-weight:950;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ctO26Meta{font-size:10px;color:#748398;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ctO26Metric span{display:block;font-size:9px;color:#78889c;font-weight:750}.ctO26Metric b{display:block;font-size:13px;margin-top:2px}.ctO26Metric small{font-size:8px;color:#93a0ad}.ctO26Metric .pos{color:#d43f53}.ctO26Metric .neg{color:#2167c9}.ctO26Metric .zero{color:#48596b}.ctO26Metric .na{color:#8b98a6}.ctO26Empty{background:#fff;border:1px dashed #dce5ee;border-radius:10px;padding:14px;font-size:12px;color:#748398;text-align:center}
 @media(max-width:700px){.ctO26Row{grid-template-columns:1fr 1fr;gap:6px}.ctO26Identity{grid-column:1/-1}.ctO26Metric b{font-size:12px}.ctO26Summary{grid-template-columns:1fr 1fr}}
 `;document.head.appendChild(s);
}

function sumKnown(rows,key,currency){const vals=rows.map(x=>key==='realized'?x.realized:( {value:x.opportunity,currency:ccy(x.t)} )).filter(x=>x&&x.value!==null&&x.currency===currency);return {sum:vals.reduce((a,x)=>a+x.value,0),count:vals.length}}
function render(){
 const panel=q('#panel-trades');if(!panel)return;
 ensureStyle();
 let root=q('#ctTradeOutcomeV26',panel);if(!root){root=document.createElement('section');root.id='ctTradeOutcomeV26';panel.prepend(root)}
 root.removeAttribute('data-ct-trade-review-legacy');root.style.setProperty('display','block','important');
 const rows=buildRows(),krR=sumKnown(rows,'realized','KRW'),krO=sumKnown(rows,'opportunity','KRW');
 const usdR=sumKnown(rows,'realized','USD'),usdO=sumKnown(rows,'opportunity','USD');
 const knownR=rows.filter(x=>x.realized.value!==null).length,knownO=rows.filter(x=>x.opportunity!==null).length;
 const sumTxt=(kr,usd)=>{const a=[];if(kr.count)a.push(money(kr.sum,'KRW'));if(usd.count)a.push(money(usd.sum,'USD'));return a.length?a.join(' · '):'—'};
 root.innerHTML=`<div class="ctO26Head"><div><div class="ctO26Title">매매복기 · 손익</div><div class="ctO26Sub">실현손익과 매도 후 현재가 기준 기회손익을 같은 거래에서 봅니다.</div></div><div class="ctO26Badge">SELL ${rows.length}건</div></div>
 <div class="ctO26Summary"><div class="ctO26Sum"><span>확인된 실현손익 합계</span><b>${esc(sumTxt(krR,usdR))}</b><small>${knownR}/${rows.length}건 원가근거 확인</small></div><div class="ctO26Sum"><span>기회손익 합계</span><b>${esc(sumTxt(krO,usdO))}</b><small>${knownO}/${rows.length}건 현재가 확인 · +는 회피손실</small></div></div>
 <div class="ctO26List">${rows.length?rows.map(x=>{const t=x.t,r=x.realized,op=x.opportunity;const opWord=op===null?'현재가 없음':op<0?'놓친수익':op>0?'회피손실':'중립';return `<div class="ctO26Row" data-v26-ticker="${esc(ticker(t))}" data-v26-account="${esc(acct(t))}" data-v26-realized="${r.value===null?'NA':'OK'}" data-v26-opportunity="${op===null?'NA':'OK'}"><div class="ctO26Identity"><div class="ctO26Name">${esc(name(t))} <span style="font-size:10px;color:#7b8a9b">${esc(ticker(t))}</span></div><div class="ctO26Meta">${esc(acct(t))} · ${esc(String(t.trade_date||ts(t)).slice(0,10))} · ${qty(t).toLocaleString()}주 × ${esc(price(px(t),ccy(t)))}</div></div><div class="ctO26Metric"><span>실현손익</span><b class="${cls(r.value)}">${esc(money(r.value,r.currency))}</b><small>${r.value===null?'원가근거 필요':r.basis==='WEIGHTED_AVG_LEDGER'?'가중평균 원가':'원장/브로커'}</small></div><div class="ctO26Metric"><span>기회손익 ${x.pending?'· 잠정':''}</span><b class="${cls(op)}">${esc(money(op,ccy(t)))}</b><small>${esc(opWord)}${x.current!==null?' · 현재 '+price(x.current,ccy(t)):''}</small></div></div>`}).join(''):'<div class="ctO26Empty">최근 매도 거래가 없습니다.</div>'}</div>`;
 RT.state='ACTIVE';RT.rendered_at=new Date().toISOString();RT.sell_count=rows.length;RT.realized_known=knownR;RT.opportunity_known=knownO;RT.missing_realized=rows.length-knownR;RT.missing_opportunity=rows.length-knownO;
}

function run(){try{render()}catch(e){RT.state='ERROR';RT.error=String(e&&e.message||e)}}
setTimeout(run,0);setTimeout(run,900);setTimeout(run,2400);
document.addEventListener('jjooni:live-applied',run);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)run()});
window.addEventListener('resize',run,{passive:true});
})();
