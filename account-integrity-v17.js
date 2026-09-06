(function(){
'use strict';
if(window.__JJOONI_ACCOUNT_INTEGRITY_V17?.booted)return;
const S={booted:true,state:'BOOTING',version:'17.0',ai_trades:0,irp_funds:0,irp_lifetime_fail_closed:false,updated_at:null};
window.__JJOONI_ACCOUNT_INTEGRITY_V17=S;
const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null};
const z=v=>n(v)==null?0:n(v);
const sym=v=>String(v||'').trim().toUpperCase().replace(/\.(KS|KQ)$/,'');
const won=v=>(Number(v)>=0?'+':'-')+'₩'+Math.round(Math.abs(Number(v)||0)).toLocaleString('ko-KR');
const pct=v=>n(v)==null?'—':(v>=0?'+':'')+Number(v).toFixed(2)+'%';
const cls=v=>z(v)>0?'v2Positive':z(v)<0?'v2Negative':'v2Muted';
function C(){return window.__JJOONI_CANONICAL_SSOT||{}}
function L(){return window.__JJOONI_LIVE_PAYLOAD||{}}
function isFund(p){return /^F\d+$/i.test(sym(p?.ticker))||String(p?.record_type||'').toUpperCase()==='FUND'}
function holdingReturn(p){const a=n(p?.avg_price??p?.avg),c=n(p?.current_price??p?.price);return a>0&&c>0?(c/a-1)*100:null}
function holdingPnl(p){const a=n(p?.avg_price??p?.avg),c=n(p?.current_price??p?.price),q=Math.abs(z(p?.qty??p?.quantity));return a>0&&c>0&&q>0?(c-a)*q:null}

function mirrorAiTrades(){
 const at=Array.isArray(L().accounts?.AI?.trades)?L().accounts.AI.trades:[];
 try{
   D.ai=D.ai||{};D.ai.latest=D.ai.latest||{};
   if(at.length){
     const rows=at.map(t=>({...t,account:'AI',account_type:'AI'}));
     D.ai.trades_31d=rows;D.ai.latest.trades=rows;D.ai.trade_count=rows.length;
     D.human=D.human||{};const old=Array.isArray(D.human.trades)?D.human.trades:[],key=t=>[String(t.account||t.account_type||''),String(t.order_no||t.decision_id||''),String(t.filled_at_kst||t.trade_date||''),sym(t.ticker),String(t.side||''),String(t.qty||''),String(t.price||'')].join('|'),m=new Map();
     [...rows,...old].forEach(t=>{const k=key(t);if(k&&!m.has(k))m.set(k,t)});D.human.trades=[...m.values()].sort((a,b)=>String(b.filled_at_kst||b.trade_date||'').localeCompare(String(a.filled_at_kst||a.trade_date||''))).slice(0,320);
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
 (a.positions||[]).forEach(p=>{const r=holdingReturn(p),pl=holdingPnl(p);if(r!=null){p.holding_return=r;p.return_pct=r}if(pl!=null){p.holding_pnl=pl;p.pnl=pl}if(isFund(p)){p.record_type='FUND';p.price_basis='FUND_NAV';funds++}});S.irp_funds=funds;
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
 const m=document.getElementById('accountDrillModal');if(!m||String(m.querySelector('h2')?.textContent||'').trim().toUpperCase()!=='IRP')return;
 const a=C().accounts?.IRP;if(!a)return;let totalEval=0,totalCost=0,totalPnl=0;(a.positions||[]).forEach(p=>{const mv=n(p.market_value_krw??p.market_value)??0,pl=holdingPnl(p);totalEval+=mv;if(pl!=null){totalPnl+=pl;totalCost+=mv-pl}});
 let info=m.querySelector('#ctIrpIntegrityV17');if(!info){info=document.createElement('div');info.id='ctIrpIntegrityV17';info.style.cssText='margin:12px 0;padding:11px 13px;border:1px solid #765a1b;border-radius:12px;background:#2d2718;color:#ffe3a3;font:800 12px/1.55 system-ui';const hero=m.querySelector('.accountHeroPrimary');hero?hero.insertAdjacentElement('afterend',info):m.firstElementChild?.prepend(info)}if(info)info.innerHTML=`계좌 누적성과는 <b>원금/이관 이력 대사 중</b>이라 현재 음수 누적수익률을 사용하지 않습니다.<br>현재 보유 기준 평가손익 ${won(totalPnl)} · 현재 보유 원가 ${won(totalCost).replace('+','')} · 계좌 NAV ₩${Math.round(z(a.nav)).toLocaleString('ko-KR')}`;
 // Correct the zero securities fallback: IRP positions include funds and ETFs.
 m.querySelectorAll('.v2Kpi').forEach(k=>{const lab=String(k.querySelector('.label')?.textContent||'').trim();if(lab==='주식 평가액'){const v=k.querySelector('.value');if(v)v.textContent='₩'+Math.round(totalEval).toLocaleString('ko-KR')}});
 m.querySelectorAll('[data-position-drill^="IRP|"]').forEach(row=>{const ticker=String(row.dataset.positionDrill||'').split('|')[1]||'',p=(a.positions||[]).find(x=>sym(x.ticker)===sym(ticker));if(!p)return;const r=holdingReturn(p),pl=holdingPnl(p),leftSubs=row.querySelectorAll(':scope > div:first-child .sub'),rightSub=row.querySelector('.right .sub');if(isFund(p)&&leftSubs.length){const q=Math.abs(z(p.qty??p.quantity));leftSubs[0].innerHTML=`${p.ticker||ticker} · ${q.toLocaleString('ko-KR')}좌 · <span class="v2Muted">펀드 기준가</span>`}if(rightSub&&r!=null){rightSub.innerHTML=`${isFund(p)?'기준가':'누적'} <span class="${cls(r)}">${pct(r)}</span>${pl!=null?` · <span class="${cls(pl)}">${won(pl)}</span>`:''}`}});
 // Historical fund transactions can be amount-based, not comparable NAV units.
 const fundNames=new Set((a.positions||[]).filter(isFund).map(p=>String(p.name||'').trim()));m.querySelectorAll('.trade').forEach(row=>{const nm=String(row.querySelector('.name')?.textContent||'').trim();if(!fundNames.has(nm))return;const b=row.querySelector('.right b'),s=row.querySelector('.right .sub');if(b){b.textContent='산정 제외';b.className='v2Muted'}if(s)s.textContent='펀드 가격단위 불일치'});
}
function apply(){mirrorAiTrades();normalizeIrp();failCloseIrpCards();patchIrpModal();S.state='ACTIVE';S.updated_at=new Date().toISOString()}
function wrap(){const fn=window.openAccountDrilldown;if(typeof fn!=='function'||fn.__jjooniIntegrityV17)return;const w=function(){apply();const r=fn.apply(this,arguments);setTimeout(apply,0);setTimeout(apply,120);setTimeout(apply,320);return r};w.__jjooniIntegrityV17=true;w.__original=fn;window.openAccountDrilldown=w}
apply();wrap();setTimeout(()=>{apply();wrap()},500);document.addEventListener('jjooni:live-applied',()=>{apply();wrap()});document.addEventListener('click',e=>{if(e.target?.closest?.('[data-account-drill]'))setTimeout(apply,80)},{capture:true});
})();
