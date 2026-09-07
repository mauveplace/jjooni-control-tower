(function(){
'use strict';
if(window.__JJOONI_ACCOUNT_INTEGRITY_V17?.booted)return;
const S={booted:true,state:'BOOTING',version:'17.5',ai_trades:0,ai_modal_trades:0,irp_funds:0,irp_lifetime_fail_closed:false,kis_broker_label:false,updated_at:null};
window.__JJOONI_ACCOUNT_INTEGRITY_V17=S;
const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null};
const z=v=>n(v)==null?0:n(v);
const sym=v=>String(v||'').trim().toUpperCase().replace(/\.(KS|KQ)$/,'');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const won=v=>(Number(v)>=0?'+':'-')+'₩'+Math.round(Math.abs(Number(v)||0)).toLocaleString('ko-KR');
const pct=v=>n(v)==null?'—':(v>=0?'+':'')+Number(v).toFixed(2)+'%';
const cls=v=>z(v)>0?'v2Positive':z(v)<0?'v2Negative':'v2Muted';
function C(){return window.__JJOONI_CANONICAL_SSOT||{}}
function L(){return window.__JJOONI_LIVE_PAYLOAD||{}}
function isFund(p){return /^F\d+$/i.test(sym(p?.ticker))||String(p?.record_type||'').toUpperCase()==='FUND'}
function holdingReturn(p){
  const master=n(p?.master_holding_return_pct??p?.master_return_pct);
  if(master!=null)return master;
  const explicit=n(p?.holding_return);
  if(explicit!=null)return explicit;
  const a=n(p?.avg_price??p?.avg),c=n(p?.current_price??p?.price);
  return a>0&&c>0?(c/a-1)*100:null;
}
function holdingPnl(p){const a=n(p?.avg_price??p?.avg),c=n(p?.current_price??p?.price),q=Math.abs(z(p?.qty??p?.quantity));return a>0&&c>0&&q>0?(c-a)*q:null}
function aiBrokerLabel(){
 const a=L().accounts?.AI||C().accounts?.AI||{};
 return String(a.broker_name||a.broker||'한국투자증권 (KIS)').trim()||'한국투자증권 (KIS)';
}
function patchAiBrokerAuthority(){
 const label=aiBrokerLabel();
 window.__JJOONI_BROKER_OVERRIDE={...(window.__JJOONI_BROKER_OVERRIDE||{}),AI:label};
 for(const root of [L(),C()]){
   try{if(root.accounts?.AI){root.accounts.AI.broker=label;root.accounts.AI.broker_name=label;root.accounts.AI.broker_code='KIS'}}catch(_){}
 }
 const candidates=[...document.querySelectorAll('.ctP8Card,.ctA8Card,.accountCard,[data-account-drill],#accountDrillModal')];
 for(const root of candidates){
   const text=String(root.innerText||root.textContent||'');
   const heading=String(root.querySelector('.ctP8Name,.ctA8Name,.accountName,h1,h2,h3')?.textContent||'');
   if(String(root.dataset.accountDrill||'').toUpperCase()!=='AI'&&!/AI\s*BOT/i.test(heading))continue;
   const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
   let node;
   while((node=walker.nextNode())){
     if(String(node.nodeValue||'').includes('KB증권'))node.nodeValue=String(node.nodeValue).replaceAll('KB증권',label);
   }
 }
 S.kis_broker_label=true;
}
function aiName(ticker){
 const k=sym(ticker),a=L().accounts?.AI||{},rows=[...(a.holdings_kr||[]),...(a.holdings_us||[]),...(a.positions||[])];
 const p=rows.find(x=>sym(x?.ticker)===k);return String(p?.name||ticker||'').trim()||k;
}
function normalizeAiTrade(t){
 if(!t||typeof t!=='object')return null;
 const ticker=String(t.ticker||t.symbol||'').trim();if(!ticker)return null;
 let market=String(t.market||'').toUpperCase();if(!market){const cur=String(t.currency||'').toUpperCase();market=cur==='USD'?'US':'KR'}
 const side=String(t.side||'').toUpperCase();
 return {...t,account:'AI',account_type:'AI',ticker,name:String(t.name||aiName(ticker)||ticker),market,currency:String(t.currency||'').toUpperCase()||(market==='US'?'USD':'KRW'),side:side.startsWith('S')?'SELL':'BUY',qty:n(t.qty??t.quantity??t.filled_qty),price:n(t.price??t.filled_price??t.avg_price),trade_date:String(t.trade_date||t.filled_at_kst||t.filled_at||t.date||''),filled_at_kst:String(t.filled_at_kst||t.filled_at||t.trade_date||t.date||''),source:t.source||'AI_LIVE_LEDGER'};
}
function aiTrades(){
 const a=L().accounts?.AI||{};
 if(Array.isArray(a.trades)&&a.trades.length)return a.trades.map(normalizeAiTrade).filter(Boolean);
 if(!Array.isArray(a.trades_v18))return [];
 return a.trades_v18.map(r=>{
   if(!Array.isArray(r)||r.length<6)return null;
   const [date,m,ticker,side,qty,price]=r,market=m==='U'?'US':'KR';
   return normalizeAiTrade({trade_date:String(date||''),filled_at_kst:String(date||''),market,currency:market==='US'?'USD':'KRW',ticker:String(ticker||''),name:aiName(ticker),side:side==='S'?'SELL':'BUY',qty:n(qty),price:n(price),source:'AI_PERSISTED_GCS_V18'});
 }).filter(Boolean);
}
function mirrorAiTrades(){
 const at=aiTrades();
 try{
   if(typeof D!=='object'||!D)return;
   D.ai=D.ai||{};D.ai.latest=D.ai.latest||{};
   if(at.length){
     const rows=at.map(t=>({...t,account:'AI',account_type:'AI'}));
     D.ai.trades_31d=rows;D.ai.latest.trades=rows;D.ai.trade_count=rows.length;
     D.human=D.human||{};
     const old=Array.isArray(D.human.trades)?D.human.trades:[];
     const nonAi=old.filter(t=>!['AI','AIBOT','AI_BOT'].includes(String(t.account||t.account_type||'').trim().toUpperCase()));
     D.human.trades=[...rows,...nonAi].sort((a,b)=>String(b.filled_at_kst||b.trade_date||'').localeCompare(String(a.filled_at_kst||a.trade_date||''))).slice(0,400);
   }
 }catch(_){}
 S.ai_trades=at.length;
}
function normalizeIrp(){
 const c=C(),a=c.accounts?.IRP;if(!a)return;
 if(!Object.prototype.hasOwnProperty.call(a,'reported_lifetime_return_pct'))a.reported_lifetime_return_pct=n(a.return_pct);
 if(!Object.prototype.hasOwnProperty.call(a,'reported_lifetime_pnl'))a.reported_lifetime_pnl=n(a.pnl);
 a.return_pct=null;a.pnl=null;a.lifetime_return_state='PRINCIPAL_HISTORY_RECONCILIATION_REQUIRED';a.lifetime_return_label='원금 이력 대사 중';
 S.irp_lifetime_fail_closed=true;let funds=0;
 (a.positions||[]).forEach(p=>{const r=holdingReturn(p),pl=holdingPnl(p);if(r!=null){p.holding_return=r;p.return_pct=r}if(pl!=null){p.holding_pnl=pl;p.pnl=pl}if(isFund(p)){p.record_type='FUND';p.price_basis='MASTER_SHEET_FUND_RETURN';funds++}});S.irp_funds=funds;
 try{(D.human?.positions||[]).filter(p=>String(p.account||p.account_type||'').toUpperCase()==='IRP').forEach(p=>{const cp=(a.positions||[]).find(x=>sym(x.ticker)===sym(p.ticker));if(!cp)return;Object.assign(p,{holding_return:cp.holding_return,return_pct:cp.return_pct,holding_pnl:cp.holding_pnl,pnl:cp.pnl,record_type:cp.record_type||p.record_type,price_basis:cp.price_basis||p.price_basis})})}catch(_){}
}
function failCloseIrpCards(){
 for(const rootSel of ['#ctDesktopPerformanceV8','#ctDesktopAccountsV8']){
   const root=document.querySelector(rootSel);if(!root)continue;
   const card=[...root.querySelectorAll('.ctP8Card,.ctA8Card')].find(x=>/\bIRP\b/.test(String(x.querySelector('.ctP8Name,.ctA8Name')?.textContent||'')));if(!card)continue;
   card.querySelectorAll('.ctP8Line,.ctA8Line').forEach(row=>{const lab=String(row.querySelector('span')?.textContent||'').trim();if(lab==='누적손익'||lab==='누적수익률'){const b=row.querySelector('b');if(b){b.textContent='원금 이력 대사 중';b.className=''}}});
 }
}
function patchIrpModal(){
 const m=document.getElementById('accountDrillModal');if(!m||!String(m.innerText||'').includes('IRP'))return;
 const a=C().accounts?.IRP;if(!a)return;let totalEval=0,totalCost=0,totalPnl=0;
 (a.positions||[]).forEach(p=>{const mv=n(p.market_value_krw??p.market_value)??0,pl=holdingPnl(p);totalEval+=mv;if(pl!=null){totalPnl+=pl;totalCost+=mv-pl}});
 let info=m.querySelector('#ctIrpIntegrityV17');if(!info){info=document.createElement('div');info.id='ctIrpIntegrityV17';info.style.cssText='margin:12px 0;padding:11px 13px;border:1px solid #765a1b;border-radius:12px;background:#2d2718;color:#ffe3a3;font:800 12px/1.55 system-ui';const hero=m.querySelector('.accountHeroPrimary');hero?hero.insertAdjacentElement('afterend',info):m.firstElementChild?.prepend(info)}
 if(info)info.innerHTML=`펀드 수익률은 <b>자산 마스터 시트 수동확정값</b>을 그대로 사용합니다.<br>계좌 전체 누적성과는 원금/이관 이력 대사 중이며, 현재 보유 기준 평가손익 ${won(totalPnl)} · 현재 보유 원가 ${won(totalCost).replace('+','')} · 계좌 NAV ₩${Math.round(z(a.nav)).toLocaleString('ko-KR')}`;
 m.querySelectorAll('.v2Kpi').forEach(k=>{const lab=String(k.querySelector('.label')?.textContent||'').trim();if(lab==='주식 평가액'){const v=k.querySelector('.value');if(v)v.textContent='₩'+Math.round(totalEval).toLocaleString('ko-KR')}});
 m.querySelectorAll('[data-position-drill^="IRP|"]').forEach(row=>{const ticker=String(row.dataset.positionDrill||'').split('|')[1]||'',p=(a.positions||[]).find(x=>sym(x.ticker)===sym(ticker));if(!p)return;const r=holdingReturn(p),pl=holdingPnl(p),leftSubs=row.querySelectorAll(':scope > div:first-child .sub'),rightSub=row.querySelector('.right .sub');if(isFund(p)&&leftSubs.length){const q=Math.abs(z(p.qty??p.quantity));leftSubs[0].innerHTML=`${esc(p.ticker||ticker)} · ${q.toLocaleString('ko-KR')}좌 · <span class="v2Muted">마스터 수익률</span>`}if(rightSub&&r!=null){rightSub.innerHTML=`${isFund(p)?'마스터':'누적'} <span class="${cls(r)}">${pct(r)}</span>${pl!=null?` · <span class="${cls(pl)}">${won(pl)}</span>`:''}`}});
 const fundNames=new Set((a.positions||[]).filter(isFund).map(p=>String(p.name||'').trim()));m.querySelectorAll('.trade').forEach(row=>{const nm=String(row.querySelector('.name')?.textContent||'').trim();if(!fundNames.has(nm))return;const b=row.querySelector('.right b'),s=row.querySelector('.right .sub');if(b){b.textContent='산정 제외';b.className='v2Muted'}if(s)s.textContent='펀드 가격단위 불일치'});
}
function patchAiModal(){
 const m=document.getElementById('accountDrillModal');if(!m||!String(m.innerText||'').includes('AI BOT'))return;
 const rows=aiTrades();if(!rows.length)return;
 // The legacy modal is fed by the human trade ledger and can legitimately be
 // empty for AI. Remove only its rendered trade rows and render the AI ledger
 // directly from the live/persisted AI authority instead of depending on it.
 m.querySelectorAll('.trade').forEach(x=>x.remove());
 m.querySelector('#ctAiLedgerSectionV174')?.remove();
 const section=document.createElement('section');section.id='ctAiLedgerSectionV174';section.style.cssText='margin:14px 0 4px;padding:0 2px';
 const note=document.createElement('div');note.id='ctAiFullLedgerV17';note.style.cssText='margin:10px 0 8px;padding:8px 10px;border:1px solid rgba(77,166,255,.32);border-radius:10px;background:rgba(22,74,116,.18);font:800 12px/1.45 system-ui;color:#cfe9ff';
 const kr=rows.filter(x=>String(x.market).toUpperCase()==='KR').length,us=rows.filter(x=>String(x.market).toUpperCase()==='US').length;note.textContent=`전체 체결원장 ${rows.length}건 · 국내 ${kr}건 · 미국 ${us}건`;
 section.appendChild(note);
 rows.forEach(t=>{const side=String(t.side||'BUY').toUpperCase(),isSell=side.startsWith('S'),ccy=String(t.currency||(t.market==='US'?'USD':'KRW')).toUpperCase(),p=n(t.price),q=n(t.qty);const el=document.createElement('div');el.className='trade ctAiLedgerRowV17';el.style.cssText='display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.08)';el.innerHTML=`<span style="display:inline-flex;min-width:42px;justify-content:center;padding:4px 7px;border-radius:7px;background:${isSell?'rgba(255,88,88,.15)':'rgba(62,205,137,.16)'};color:${isSell?'#ffb1b1':'#a9f3ce'};font:900 10px/1 system-ui">${isSell?'SELL':'BUY'}</span><div style="min-width:0"><div class="name" style="font:800 12px/1.35 system-ui;white-space:normal">${esc(t.name||t.ticker)}</div><div class="sub" style="margin-top:3px;font:600 10px/1.35 system-ui;opacity:.72">${esc(t.trade_date||t.filled_at_kst)} · ${esc(t.ticker)} · ${esc(t.market)}</div></div><div class="right" style="text-align:right"><b style="font:800 11px/1.3 system-ui">${q==null?'—':q.toLocaleString('ko-KR')}주</b><div class="sub" style="margin-top:3px;font:600 10px/1.3 system-ui;opacity:.72">${p==null?'체결가 —':`${ccy} ${p.toLocaleString('ko-KR',{maximumFractionDigits:4})}`}</div></div>`;section.appendChild(el)});
 m.appendChild(section);S.ai_modal_trades=rows.length;
}
function apply(){patchAiBrokerAuthority();mirrorAiTrades();normalizeIrp();failCloseIrpCards();patchIrpModal();patchAiModal();patchAiBrokerAuthority();S.state='ACTIVE';S.updated_at=new Date().toISOString()}
function wrap(){const fn=window.openAccountDrilldown;if(typeof fn!=='function'||fn.__jjooniIntegrityV17)return;const w=function(){apply();const r=fn.apply(this,arguments);[0,80,220,500,1000].forEach(ms=>setTimeout(apply,ms));return r};w.__jjooniIntegrityV17=true;w.__original=fn;window.openAccountDrilldown=w}
apply();wrap();[250,700,1600,3000].forEach(ms=>setTimeout(()=>{apply();wrap()},ms));document.addEventListener('jjooni:live-applied',()=>{apply();wrap();setTimeout(apply,120);setTimeout(apply,700)});document.addEventListener('click',e=>{if(e.target?.closest?.('[data-account-drill]')){setTimeout(apply,60);setTimeout(apply,260)}},{capture:true});
})();