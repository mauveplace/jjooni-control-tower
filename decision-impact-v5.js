(function(){
'use strict';
if(window.__JJOONI_DECISION_IMPACT_V5)return;
window.__JJOONI_DECISION_IMPACT_V5={state:'BOOTING',version:'5.2'};

const CFG={recentDays:90,pendingDays:7};
const state={defaultFilterApplied:false,amountSort:false,applying:false,scheduled:false};
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
const krwAbs=v=>'₩'+Math.round(Math.abs(Number(v)||0)).toLocaleString('ko-KR');
const signedKrw=v=>{const x=Number(v)||0;return (x>=0?'+':'-')+krwAbs(x)};

function toKrw(value,curr){
 const v=n(value);if(v==null)return null;
 try{if(typeof window.__JJOONI_TO_KRW==='function'){const x=window.__JJOONI_TO_KRW(v,curr);if(n(x)!=null)return n(x)}}catch(_){}
 if(String(curr||'KRW').toUpperCase()!=='USD')return v;
 const fx=n(window.__JJOONI_FX_KRW_PER_USD);return fx?v*fx:null;
}
function firstNum(o,keys){for(const k of keys){const x=n(o&&o[k]);if(x!=null)return x}return null}
function collectTrades(){
 const out=[];
 try{if(typeof D!=='undefined'&&Array.isArray(D.human?.trades))out.push(...D.human.trades)}catch(_){}
 try{if(typeof D!=='undefined'&&Array.isArray(D.ai?.latest?.trades))out.push(...D.ai.latest.trades.map(x=>({...x,account:x.account||'AI'})))}catch(_){}
 const seen=new Set(),dedup=[];
 out.forEach(t=>{const k=[acct(t),parseTs(t),sym(t.ticker||t.symbol),side(t),qty(t),px(t)].join('|');if(!seen.has(k)){seen.add(k);dedup.push(t)}});
 return dedup;
}
function positions(){
 const out=[];
 try{const C=window.__JJOONI_CANONICAL_SSOT||{};Object.entries(C.accounts||{}).forEach(([a,row])=>(row.positions||[]).forEach(p=>out.push({...p,account:p.account||a,account_type:p.account_type||a})))}catch(_){}
 return out;
}
function positionPnlKrw(p){
 const direct=firstNum(p,['unrealized_pnl_krw','pnl_krw','evaluation_pnl_krw']);if(direct!=null)return direct;
 const raw=firstNum(p,['unrealized_pnl','pnl','evaluation_pnl']);if(raw!=null)return toKrw(raw,currency(p));
 const q=Math.abs(z(p.qty||p.quantity||p.held_qty)),a=firstNum(p,['avg_price','avg','average_price']),c=firstNum(p,['current_price','price','last_price']);
 return q>0&&a!=null&&c!=null?toKrw((c-a)*q,currency(p)):null;
}
function buildMetrics(){
 const map=new Map();
 const ensure=t=>{const k=sym(t);if(!k)return null;if(!map.has(k))map.set(k,{ticker:k,openPnlKrw:0,openPnlKnown:false,missedGainKrw:0,avoidedLossKrw:0,pendingImpactKrw:0,pendingSellCount:0,sellCount:0,amountScore:0});return map.get(k)};
 positions().forEach(p=>{const m=ensure(p.ticker||p.symbol);if(!m)return;const v=positionPnlKrw(p);if(v!=null){m.openPnlKrw+=v;m.openPnlKnown=true}});
 const cutoff=Date.now()-CFG.recentDays*86400000;
 collectTrades().forEach(t=>{
   if(side(t)!=='SELL'||parseTs(t)<cutoff)return;
   const sp=px(t),cp=cur(t),q=qty(t),m=ensure(t.ticker||t.symbol);if(!m||sp==null||cp==null||q<=0)return;
   const delta=toKrw((cp-sp)*q,currency(t));if(delta==null)return;
   m.sellCount++;
   if(daysSince(parseTs(t))<CFG.pendingDays){m.pendingSellCount++;m.pendingImpactKrw+=delta;return}
   if(delta>0)m.missedGainKrw+=delta;else if(delta<0)m.avoidedLossKrw+=Math.abs(delta);
 });
 map.forEach(m=>{m.netSellEffectKrw=m.avoidedLossKrw-m.missedGainKrw;m.amountScore=Math.abs(m.openPnlKnown?m.openPnlKrw:0)+m.missedGainKrw+m.avoidedLossKrw+Math.abs(m.pendingImpactKrw)});
 return map;
}
function totals(metrics){
 let open=0,openKnown=0,missed=0,avoided=0,pending=0,pendingCount=0;
 metrics.forEach(m=>{if(m.openPnlKnown){open+=m.openPnlKrw;openKnown++}missed+=m.missedGainKrw;avoided+=m.avoidedLossKrw;pending+=m.pendingImpactKrw;pendingCount+=m.pendingSellCount});
 return {open,openKnown,missed,avoided,net:avoided-missed,pending,pendingCount};
}
function trustKind(raw){const s=String(raw||'').toUpperCase();if(s.includes('BROKER')||s==='FULL'||s==='LIVE')return ['measured','● 실측'];if(s.includes('MODEL')||s.includes('MODELED')||s.includes('MTM')||s.includes('ACCOUNTING'))return ['modeled','◐ 추정'];return ['reference','○ 참고']}
function tossCard(){return qsa('.ctAcct').find(x=>/\bToss\b/i.test(String(qs('.ctAcctName',x)?.textContent||'')))||null}
function smallestTextNode(root,re){if(!root)return null;return qsa('div,span,p,small',root).filter(x=>re.test(String(x.textContent||''))).sort((a,b)=>String(a.textContent||'').length-String(b.textContent||'').length)[0]||null}
function fixTossTrust(){
 const C=window.__JJOONI_CANONICAL_SSOT||{},c=(C.accounts||{}).TOSS||{},kind=trustKind(c.quality||c.source||'NO_DATA'),card=tossCard();
 let line=qs('#ctCanonicalTOSS');if(!line&&card)line=smallestTextNode(card,/예수금\s*KRW.*\bREF\b/i);
 if(line&&/\bREF\b/.test(line.textContent||''))line.innerHTML=line.innerHTML.replace(/\bREF\b/g,'<span class="ctTrustBadge '+kind[0]+'">'+kind[1]+'</span>');
 let attr=qs('#ctTossAttributionLine');if(!attr&&card)attr=smallestTextNode(card,/당일\s*귀속/i);
 if(attr&&/NO_DATA|미검증/i.test(attr.textContent||'')){
   if(!attr.dataset.rawV5)attr.dataset.rawV5=(attr.textContent||'').trim();
   const html='당일 P&L <span class="ctTrustBadge '+kind[0]+'">'+kind[1]+'</span> · 귀속 <span class="ctTrustBadge reference">○ 미검증</span>';
   if(attr.innerHTML!==html)attr.innerHTML=html;
 }
}
function tossUsdAudit(){
 const samples=[],rows=[];
 try{if(typeof D!=='undefined'){rows.push(...(D.human?.positions||[]).filter(x=>acct(x)==='TOSS'));rows.push(...(D.human?.trades||[]).filter(x=>acct(x)==='TOSS'))}}catch(_){}
 rows.forEach(x=>{const m=String(x.market||'').toUpperCase(),c=currency(x);if(m==='US'||c==='USD'){if(samples.length<8)samples.push({name:x.name||x.stock_name||x.ticker||x.symbol,currency:c,market:m})}});
 return {usd_sample_count:samples.length,samples};
}
function ensureStyle(){
 if(qs('#ctDecisionImpactV5Style'))return;
 const st=document.createElement('style');st.id='ctDecisionImpactV5Style';st.textContent=`
@media(max-width:767px){
 #ctOpportunitySummaryV5{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:0 0 10px}
 .ctImpactKpi{border:1px solid #e1e7ee;border-radius:11px;background:#fff;padding:9px 10px;min-width:0}
 .ctImpactKpi span{display:block;font-size:9px;line-height:1.2;color:#7b8798;font-weight:800}.ctImpactKpi b{display:block;margin-top:3px;font-size:14px;line-height:1.1;color:#101828;white-space:nowrap}.ctImpactKpi small{display:block;margin-top:3px;font-size:8px;color:#98a2b3}
 .ctTickerMoneyV5{font-size:10px;font-weight:950;line-height:1.15;white-space:nowrap}.ctTickerMoneyV5.loss{color:#175cd3}.ctTickerMoneyV5.gain{color:#d92d20}.ctTickerMoneyV5.neutral{color:#475467}
 #ctTradeReviewV2 .ctTickerRight{min-width:118px!important}
 #ctTradeReviewV2 .ctTrSorts{align-items:center}
}
`;(document.head||document.documentElement).appendChild(st);
}
function moneyLabel(m){
 if(!m)return {text:'금액 산정 대기',cls:'neutral'};
 const bits=[];let cls='neutral';
 if(m.openPnlKnown){bits.push('평가 '+signedKrw(m.openPnlKrw));cls=m.openPnlKrw<0?'loss':m.openPnlKrw>0?'gain':cls}
 if(m.missedGainKrw>0){bits.push('기회손실 -'+krwAbs(m.missedGainKrw));cls='loss'}
 if(m.avoidedLossKrw>0){bits.push('회피손실 +'+krwAbs(m.avoidedLossKrw));if(cls==='neutral')cls='gain'}
 if(m.pendingSellCount>0){const v=m.pendingImpactKrw;if(v>0)bits.push('잠정손실 -'+krwAbs(v));else if(v<0)bits.push('잠정회피 +'+krwAbs(v))}
 return {text:bits.slice(0,2).join(' · ')||'금액 산정 대기',cls};
}
function ensureSummary(root,metrics){
 let box=qs('#ctOpportunitySummaryV5',root);if(!box){box=document.createElement('div');box.id='ctOpportunitySummaryV5';const toolbar=qs('.ctTrToolbar',root);if(toolbar)toolbar.insertAdjacentElement('afterend',box);else root.prepend(box)}
 const t=totals(metrics),html=`<div class="ctImpactKpi"><span>현재 보유 평가손익</span><b>${signedKrw(t.open)}</b><small>${t.openKnown}개 종목군 · KRW 환산</small></div><div class="ctImpactKpi"><span>놓친 이익</span><b>${t.missed?'-'+krwAbs(t.missed):'₩0'}</b><small>매도 후 상승 · 7일 경과</small></div><div class="ctImpactKpi"><span>회피한 손실</span><b>${t.avoided?'+'+krwAbs(t.avoided):'₩0'}</b><small>매도 후 하락 · 7일 경과</small></div><div class="ctImpactKpi"><span>순 매도효과</span><b>${signedKrw(t.net)}</b><small>${t.pendingCount?'평가중 '+t.pendingCount+'건 별도':'확정 구간 기준'}</small></div>`;
 if(box.innerHTML!==html)box.innerHTML=html;
}
function addAmountSort(root,metrics){
 const sorts=qs('.ctTrSorts',root);if(!sorts)return;
 let b=qs('[data-sort-amount-v5]',sorts);if(!b){b=document.createElement('button');b.type='button';b.className='ctTrChip';b.dataset.sortAmountV5='1';b.textContent='금액순';sorts.appendChild(b);b.onclick=e=>{e.stopPropagation();state.amountSort=true;schedule()}}
 const on=b.classList.contains('on');if(on!==state.amountSort)b.classList.toggle('on',state.amountSort);
 if(state.amountSort){
   qsa('[data-sort]',sorts).forEach(x=>{if(x.classList.contains('on'))x.classList.remove('on')});
   const cards=qsa('.ctTicker',root),desired=[...cards].sort((a,b)=>z(metrics.get(b.dataset.ticker)?.amountScore)-z(metrics.get(a.dataset.ticker)?.amountScore));
   const mismatch=cards.some((x,i)=>x!==desired[i]);if(mismatch)desired.forEach(x=>x.parentNode.appendChild(x));
 }
}
function annotateCards(root,metrics){
 qsa('.ctTicker[data-ticker]',root).forEach(card=>{
   const m=metrics.get(sym(card.dataset.ticker)),right=qs('.ctTickerRight',card);if(!right)return;
   let e=qs('.ctTickerMoneyV5',right);if(!e){e=document.createElement('div');e.className='ctTickerMoneyV5 neutral';right.insertBefore(e,right.firstChild)}
   const lab=moneyLabel(m),cls='ctTickerMoneyV5 '+lab.cls;
   if(e.textContent!==lab.text)e.textContent=lab.text;if(e.className!==cls)e.className=cls;
   const title='금액순 기준: 평가손익 + 기회손실/회피손실의 절대 금액 합계';if(e.title!==title)e.title=title;
 });
}
function setDefaultAll(root){
 if(state.defaultFilterApplied)return;
 const all=qs('[data-filter="all"]',root);if(!all)return;
 state.defaultFilterApplied=true;if(!all.classList.contains('on'))all.click();
}
function apply(){
 if(state.applying||window.innerWidth>767)return;state.applying=true;state.scheduled=false;
 try{
   ensureStyle();fixTossTrust();
   const root=qs('#ctTradeReviewV2');if(!root){window.__JJOONI_DECISION_IMPACT_V5={state:'WAITING',version:'5.2',toss_usd:tossUsdAudit()};return}
   setDefaultAll(root);const metrics=buildMetrics();ensureSummary(root,metrics);annotateCards(root,metrics);addAmountSort(root,metrics);
   const t=totals(metrics),audit=tossUsdAudit();
   window.__JJOONI_DECISION_IMPACT_V5={state:'ACTIVE',version:'5.2',default_filter:'all',amount_sort:state.amountSort,fx_krw_per_usd:n(window.__JJOONI_FX_KRW_PER_USD),open_pnl_krw:t.open,missed_gain_krw:t.missed,avoided_loss_krw:t.avoided,net_sell_effect_krw:t.net,pending_sell_impact_krw:t.pending,pending_sell_count:t.pendingCount,toss_usd:audit,ui_persisted:!!qs('#ctOpportunitySummaryV5')};
 }finally{state.applying=false}
}
function schedule(){if(state.scheduled)return;state.scheduled=true;queueMicrotask(()=>requestAnimationFrame(apply))}
document.addEventListener('click',e=>{const b=e.target&&e.target.closest&&e.target.closest('#ctTradeReviewV2 [data-sort]');if(b){state.amountSort=false;schedule()}},{capture:true});
document.addEventListener('jjooni:live-applied',schedule);
setTimeout(apply,0);setTimeout(apply,350);setTimeout(apply,900);document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});
})();
