(function(){
'use strict';
if(window.__JJOONI_TRADE_MONEY_V6)return;
window.__JJOONI_TRADE_MONEY_V6={state:'BOOTING',version:'6.0'};

const CFG={recentDays:90,pendingDays:7};
const state={amountSort:true,applying:false,scheduled:false};
const qs=(s,r=document)=>{try{return r.querySelector(s)}catch(_){return null}};
const qsa=(s,r=document)=>{try{return Array.from(r.querySelectorAll(s))}catch(_){return []}};
const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null};
const z=v=>n(v)==null?0:n(v);
const sym=v=>String(v||'').trim().toUpperCase().replace(/\.(KS|KQ)$/,'');
const acct=o=>String(o&&(o.account||o.account_type)||'UNKNOWN').trim().toUpperCase();
const side=o=>{const s=String(o&&o.side||'').toUpperCase();return s.includes('SELL')||s.includes('매도')?'SELL':s.includes('BUY')||s.includes('매수')?'BUY':'OTHER'};
const qty=o=>Math.abs(z(o&&(o.qty||o.quantity||o.filled_qty)));
const px=o=>n(o&&(o.price||o.filled_price||o.avg_price));
const cur=o=>n(o&&o.current_price);
const currency=o=>String(o&&o.currency||((String(o&&o.market||'').toUpperCase()==='US')?'USD':'KRW')).toUpperCase();
const parseTs=o=>{const raw=String(o&&(o.filled_at_kst||o.trade_date||o.date)||'').trim();if(!raw)return 0;const ms=Date.parse(raw.length<=10?raw+'T00:00:00+09:00':raw);return Number.isFinite(ms)?ms:0};
const daysSince=ms=>ms?Math.floor((Date.now()-ms)/86400000):9999;
const wonAbs=v=>'₩'+Math.round(Math.abs(Number(v)||0)).toLocaleString('ko-KR');
const signedWon=v=>{const x=Number(v)||0;return (x>=0?'+':'-')+wonAbs(x)};

function toKrw(value,curr){
 const v=n(value);if(v==null)return null;
 try{if(typeof window.__JJOONI_TO_KRW==='function'){const x=window.__JJOONI_TO_KRW(v,curr);if(n(x)!=null)return n(x)}}catch(_){}
 if(String(curr||'KRW').toUpperCase()!=='USD')return v;
 const fx=n(window.__JJOONI_FX_KRW_PER_USD);return fx?v*fx:null;
}
function firstNum(o,keys){for(const k of keys){const x=n(o&&o[k]);if(x!=null)return {value:x,key:k}}return null}
function realizedInfo(t){
 let x=firstNum(t,['realized_pnl_krw','pnl_realized_krw','realized_profit_krw','realized_profit_loss_krw']);
 if(x)return {value:x.value,currency:'KRW'};
 x=firstNum(t,['realized_pnl','pnl_realized','realized_profit','realized_profit_loss']);
 return x?{value:x.value,currency:currency(t)}:null;
}
function collectTrades(){
 const out=[];
 try{if(typeof D!=='undefined'&&Array.isArray(D.human?.trades))out.push(...D.human.trades)}catch(_){}
 try{if(typeof D!=='undefined'&&Array.isArray(D.ai?.latest?.trades))out.push(...D.ai.latest.trades.map(x=>({...x,account:x.account||'AI'})))}catch(_){}
 const seen=new Set(),dedup=[];
 out.forEach(t=>{const k=[acct(t),parseTs(t),sym(t.ticker||t.symbol),side(t),qty(t),px(t)].join('|');if(k&&!seen.has(k)){seen.add(k);dedup.push(t)}});
 return dedup;
}
function positions(){
 const out=[];
 try{const C=window.__JJOONI_CANONICAL_SSOT||{};Object.entries(C.accounts||{}).forEach(([a,row])=>(row.positions||[]).forEach(p=>out.push({...p,account:p.account||a,account_type:p.account_type||a})))}catch(_){}
 return out;
}
function positionPnlKrw(p){
 let x=firstNum(p,['unrealized_pnl_krw','pnl_krw','evaluation_pnl_krw']);if(x)return x.value;
 x=firstNum(p,['unrealized_pnl','pnl','evaluation_pnl']);if(x)return toKrw(x.value,currency(p));
 const q=Math.abs(z(p.qty||p.quantity||p.held_qty)),a=n(p.avg_price||p.avg||p.average_price),c=n(p.current_price||p.price||p.last_price);
 return q>0&&a!=null&&c!=null?toKrw((c-a)*q,currency(p)):null;
}
function metricMap(){
 const map=new Map();
 const ensure=t=>{const k=sym(t);if(!k)return null;if(!map.has(k))map.set(k,{ticker:k,realizedKrw:0,realizedCount:0,openPnlKrw:0,openPnlKnown:false,missedKrw:0,avoidedKrw:0,pendingKrw:0,pendingCount:0,sellCount:0,amountScore:0});return map.get(k)};
 positions().forEach(p=>{const m=ensure(p.ticker||p.symbol);if(!m)return;const v=positionPnlKrw(p);if(v!=null){m.openPnlKrw+=v;m.openPnlKnown=true}});
 const cutoff=Date.now()-CFG.recentDays*86400000;
 collectTrades().forEach(t=>{
   const ts=parseTs(t);if(ts<cutoff)return;
   const m=ensure(t.ticker||t.symbol);if(!m)return;
   if(side(t)==='SELL'){
     const ri=realizedInfo(t);
     if(ri){const rv=toKrw(ri.value,ri.currency);if(rv!=null){m.realizedKrw+=rv;m.realizedCount++}}
     const sp=px(t),cp=cur(t),q=qty(t);if(sp==null||cp==null||q<=0)return;
     const delta=toKrw((cp-sp)*q,currency(t));if(delta==null)return;
     m.sellCount++;
     if(daysSince(ts)<CFG.pendingDays){m.pendingKrw+=delta;m.pendingCount++;return}
     if(delta>0)m.missedKrw+=delta;else if(delta<0)m.avoidedKrw+=Math.abs(delta);
   }
 });
 map.forEach(m=>{m.netSellEffectKrw=m.avoidedKrw-m.missedKrw;m.amountScore=Math.abs(m.realizedKrw)+Math.abs(m.openPnlKnown?m.openPnlKrw:0)+m.missedKrw+m.avoidedKrw+Math.abs(m.pendingKrw)});
 return map;
}
function totals(map){
 const t={realized:0,realizedCount:0,open:0,openCount:0,missed:0,avoided:0,pending:0,pendingCount:0};
 map.forEach(m=>{t.realized+=m.realizedKrw;t.realizedCount+=m.realizedCount;if(m.openPnlKnown){t.open+=m.openPnlKrw;t.openCount++}t.missed+=m.missedKrw;t.avoided+=m.avoidedKrw;t.pending+=m.pendingKrw;t.pendingCount+=m.pendingCount});
 t.net=t.avoided-t.missed;return t;
}
function moneyClass(v){return v>0?'gain':v<0?'loss':'neutral'}
function ensureStyle(){
 if(qs('#ctTradeMoneyV6Style'))return;
 const st=document.createElement('style');st.id='ctTradeMoneyV6Style';st.textContent=`
@media(max-width:767px){
 #ctOpportunitySummaryV5{display:none!important}
 #ctTradeReviewV2 [data-sort-amount-v5]{display:none!important}
 #ctTradeReviewV2 .ctTickerMoneyV5{display:none!important}
 #ctOpportunitySummaryV6{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:0 0 10px}
 .ctImpactKpiV6{border:1px solid #e1e7ee;border-radius:11px;background:#fff;padding:9px 10px;min-width:0}
 .ctImpactKpiV6 span{display:block;font-size:9px;line-height:1.2;color:#7b8798;font-weight:850}.ctImpactKpiV6 b{display:block;margin-top:3px;font-size:14px;line-height:1.1;white-space:nowrap}.ctImpactKpiV6 small{display:block;margin-top:3px;font-size:8px;color:#98a2b3}.ctImpactKpiV6 b.gain{color:#d92d20}.ctImpactKpiV6 b.loss{color:#175cd3}.ctImpactKpiV6 b.neutral{color:#101828}
 .ctTickerMoneyV6{min-width:132px;text-align:right;font-size:9px;line-height:1.22;font-weight:900;color:#475467;white-space:nowrap}
 .ctTickerMoneyV6 .moneyLine{display:block}.ctTickerMoneyV6 .gain{color:#d92d20}.ctTickerMoneyV6 .loss{color:#175cd3}.ctTickerMoneyV6 .neutral{color:#475467}.ctTickerMoneyV6 .pending{color:#667085}
 #ctTradeReviewV2 .ctTickerRight{display:grid!important;grid-template-columns:1fr!important;justify-items:end!important;gap:1px!important;min-width:138px!important}
 #ctTradeReviewV2 .ctTickerScore{font-size:9px!important;color:#667085!important;font-weight:800!important}
 #ctTradeReviewV2 .ctTickerVerdict{font-size:9px!important}
}
`;(document.head||document.documentElement).appendChild(st);
}
function ensureSortButton(root){
 const sorts=qs('.ctTrSorts',root);if(!sorts)return;
 let b=qs('[data-sort-amount-v6]',sorts);
 if(!b){b=document.createElement('button');b.type='button';b.className='ctTrChip';b.dataset.sortAmountV6='1';b.textContent='금액순';sorts.prepend(b);b.addEventListener('click',e=>{e.stopPropagation();state.amountSort=true;schedule()})}
 b.classList.toggle('on',state.amountSort);
 if(state.amountSort)qsa('[data-sort]',sorts).forEach(x=>x.classList.remove('on'));
}
function renderSummary(root,map){
 let box=qs('#ctOpportunitySummaryV6',root);if(!box){box=document.createElement('div');box.id='ctOpportunitySummaryV6';const old=qs('#ctOpportunitySummaryV5',root),toolbar=qs('.ctTrToolbar',root);if(old)old.insertAdjacentElement('afterend',box);else if(toolbar)toolbar.insertAdjacentElement('afterend',box);else root.prepend(box)}
 const t=totals(map),items=[
  ['확인된 실현손익',signedWon(t.realized),moneyClass(t.realized),`${t.realizedCount}개 매도체결 · 최근 ${CFG.recentDays}일`],
  ['현재 보유 평가손익',signedWon(t.open),moneyClass(t.open),`${t.openCount}개 종목군 · KRW 환산`],
  ['놓친 돈',t.missed?'-'+wonAbs(t.missed):'₩0',t.missed?'loss':'neutral','매도 후 상승 · 7일 경과'],
  ['지킨 돈',t.avoided?'+'+wonAbs(t.avoided):'₩0',t.avoided?'gain':'neutral','매도 후 하락 · 7일 경과'],
  ['순 매도효과',signedWon(t.net),moneyClass(t.net),'지킨 돈 − 놓친 돈'],
  ['평가 중',t.pending?signedWon(-t.pending):'₩0',t.pending>0?'loss':t.pending<0?'gain':'neutral',`${t.pendingCount}건 · 7일 미경과`]
 ];
 const html=items.map(([label,val,cls,sub])=>`<div class="ctImpactKpiV6"><span>${label}</span><b class="${cls}">${val}</b><small>${sub}</small></div>`).join('');
 if(box.innerHTML!==html)box.innerHTML=html;
}
function cardHtml(m){
 if(!m)return '<span class="moneyLine neutral">금액 산정 대기</span>';
 const a=[];
 const first=[];
 if(m.realizedCount)first.push(`<span class="${moneyClass(m.realizedKrw)}">실현 ${signedWon(m.realizedKrw)}</span>`);
 if(m.openPnlKnown)first.push(`<span class="${moneyClass(m.openPnlKrw)}">평가 ${signedWon(m.openPnlKrw)}</span>`);
 if(first.length)a.push(`<span class="moneyLine">${first.join(' · ')}</span>`);
 const second=[];
 if(m.missedKrw>0)second.push(`<span class="loss">놓친 돈 -${wonAbs(m.missedKrw)}</span>`);
 if(m.avoidedKrw>0)second.push(`<span class="gain">지킨 돈 +${wonAbs(m.avoidedKrw)}</span>`);
 if(m.pendingCount>0){const text=m.pendingKrw>0?'평가중 놓침 '+('-'+wonAbs(m.pendingKrw)):m.pendingKrw<0?'평가중 방어 '+('+'+wonAbs(m.pendingKrw)):'평가중 ₩0';second.push(`<span class="pending">${text}</span>`)}
 if(second.length)a.push(`<span class="moneyLine">${second.join(' · ')}</span>`);
 return a.join('')||'<span class="moneyLine neutral">금액 산정 대기</span>';
}
function annotateCards(root,map){
 qsa('.ctTicker[data-ticker]',root).forEach(card=>{
   const right=qs('.ctTickerRight',card);if(!right)return;
   let e=qs('.ctTickerMoneyV6',right);if(!e){e=document.createElement('div');e.className='ctTickerMoneyV6';right.insertBefore(e,right.firstChild)}
   const html=cardHtml(map.get(sym(card.dataset.ticker)));if(e.innerHTML!==html)e.innerHTML=html;
   const score=qs('.ctTickerScore',right);if(score&&/최대오차/.test(score.textContent||''))score.textContent=String(score.textContent||'').replace('최대오차','오차율');
 });
}
function sortCards(root,map){
 if(!state.amountSort)return;
 const cards=qsa('.ctTicker[data-ticker]',root);if(cards.length<2)return;
 const desired=[...cards].sort((a,b)=>z(map.get(sym(b.dataset.ticker))?.amountScore)-z(map.get(sym(a.dataset.ticker))?.amountScore));
 if(cards.some((x,i)=>x!==desired[i]))desired.forEach(x=>x.parentNode&&x.parentNode.appendChild(x));
}
function apply(){
 if(state.applying||window.innerWidth>767)return;state.applying=true;state.scheduled=false;
 try{
   ensureStyle();const root=qs('#ctTradeReviewV2');if(!root){window.__JJOONI_TRADE_MONEY_V6={state:'WAITING',version:'6.0'};return}
   ensureSortButton(root);const map=metricMap();renderSummary(root,map);annotateCards(root,map);sortCards(root,map);
   const t=totals(map);window.__JJOONI_TRADE_MONEY_V6={state:'ACTIVE',version:'6.0',default_sort:state.amountSort?'amount':'base',realized_pnl_krw:t.realized,realized_trade_count:t.realizedCount,open_pnl_krw:t.open,missed_money_krw:t.missed,avoided_money_krw:t.avoided,net_sell_effect_krw:t.net,pending_count:t.pendingCount,pending_direction_krw:t.pending};
 }finally{state.applying=false}
}
function schedule(){if(state.scheduled)return;state.scheduled=true;setTimeout(apply,35)}
document.addEventListener('click',e=>{const b=e.target&&e.target.closest&&e.target.closest('#ctTradeReviewV2 [data-sort]');if(b){state.amountSort=false;schedule()}},{capture:true});
const mo=new MutationObserver(m=>{if(m.some(x=>x.type==='childList'))schedule()});mo.observe(document.documentElement,{subtree:true,childList:true});
setTimeout(apply,0);setTimeout(apply,700);setTimeout(apply,1800);setInterval(()=>{if(!document.hidden)apply()},1800);
})();
