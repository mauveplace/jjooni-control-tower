(function(){
'use strict';
if(window.__JJOONI_TABLET_ACCOUNTS_V8)return;
window.__JJOONI_TABLET_ACCOUNTS_V8={state:'BOOTING',version:'8.3'};
const IDS=['TOSS','ISA','PENSION','IRP'];
const LABEL={TOSS:'Toss',ISA:'ISA',PENSION:'연금저축',IRP:'IRP',TRIPOD:'TRI-POD'};
const n=v=>{if(v===null||v===undefined||v===''||typeof v==='boolean'||typeof v==='object')return null;const x=Number(v);return Number.isFinite(x)?x:null};
const z=v=>n(v)==null?0:n(v);
const qs=(s,r=document)=>{try{return r.querySelector(s)}catch(_){return null}};
const wide=()=>true; // Shared canonical account view on every viewport.
const C=()=>window.__JJOONI_CANONICAL_SSOT||{};
const L=()=>window.__JJOONI_LIVE_PAYLOAD||{};
const won=v=>n(v)==null?'—':'₩'+Math.round(Math.abs(Number(v)||0)).toLocaleString('ko-KR');
const signed=v=>{if(n(v)==null)return '산정 대기';const x=Number(v)||0;return (x>=0?'+':'-')+won(x)};
const pct=v=>n(v)==null?'—':(Number(v)>=0?'+':'')+Number(v).toFixed(2)+'%';
const cls=v=>Number(v)>0?'gain':Number(v)<0?'loss':'neutral';
function trustKind(raw){const s=String(raw||'').toUpperCase();if(s.includes('BROKER_DIRECT')||s.includes('BROKER_LIVE')||s.includes('BROKER_API')||s.includes('ACTUAL_BROKER'))return '증권사 확인';if(s.includes('MODEL')||s.includes('MODELED')||s.includes('MTM')||s.includes('ACCOUNTING')||s.includes('PARTIAL'))return '계산값';return '참고값'}
function authority(a){return a?.holdings_quality||a?.cash_quality||a?.account_authority||a?.quality||a?.source||''}
function displayCash(id,a){const x=window.JjooniMetrics.cash(a);if(x==null)return null;const auth=String(authority(a)).toUpperCase();if(id==='IRP'&&!auth.includes('BROKER_DIRECT')&&Math.abs(x)<=1.01){const stock=window.JjooniMetrics.stock(a),nav=n(a?.nav);if(stock!=null&&nav!=null&&Math.abs(nav-stock-x)<=1.01)return null}return x}
function fx(id,a){const live=(L().accounts||{})[id]||{};for(const v of [a?.fx_krw_per_usd,a?.fx,live.fx_krw_per_usd,live.fx]){const x=n(v);if(x&&x>500&&x<3000)return x}const ref=L().fx_reference||{},x=n(ref.krw_per_usd);return x&&x>500&&x<3000&&String(ref.source||'').toUpperCase()!=='FX_REFERENCE_MISSING'?x:null}
function style(){if(qs('#ctTabletAccountsV8Style'))return;const s=document.createElement('style');s.id='ctTabletAccountsV8Style';s.textContent=`
@media(min-width:0px){
 #panel-accounts>#ctDesktopAccountsV8{display:block!important}#panel-accounts>:not(#ctDesktopAccountsV8){display:none!important}
 #ctDesktopAccountsV8{font-family:system-ui,-apple-system,'Noto Sans KR',sans-serif;color:#172033}.ctA8Head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;margin:8px 0 12px}.ctA8Title{font-size:22px;font-weight:900}.ctA8Sub{font-size:10px;color:#667085;margin-top:3px}.ctA8Total{text-align:right;font-size:11px;font-weight:900}.ctA8Grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.ctA8Card{background:#fff;border:1px solid #e5eaf0;border-radius:14px;padding:12px;min-width:0}.ctA8Name{font-size:12px;font-weight:900}.ctA8Nav{font-size:18px;font-weight:900;margin-top:4px}.ctA8Rows{margin-top:9px;border-top:1px solid #edf1f5;padding-top:6px}.ctA8Line{display:flex;justify-content:space-between;gap:8px;padding:4px 0;font-size:9px;color:#667085}.ctA8Line b{color:#172033}.ctA8Source{margin-top:7px;font-size:8px;color:#98a2b3}.gain{color:#d92d20!important}.loss{color:#175cd3!important}.neutral{color:#667085!important}
 #ctDesktopAccountsV8 .ctHoldingDetail>summary{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 12px;align-items:center;min-height:58px}
 #ctDesktopAccountsV8 .ctHoldingDetail>summary .ctHoldingName{grid-column:1;grid-row:1;min-width:0;overflow-wrap:anywhere}
 #ctDesktopAccountsV8 .ctHoldingDetail>summary .ctHoldingMeta{grid-column:1;grid-row:2;color:#667085}
 #ctDesktopAccountsV8 .ctHoldingDetail>summary .ctHoldingRight{grid-column:2;grid-row:1/3;display:flex!important;flex-direction:column;align-items:flex-end;text-align:right;white-space:nowrap!important}
 #ctDesktopAccountsV8 .ctHoldingDetail>summary .ctHoldingRight strong{font-size:16px!important;white-space:nowrap!important}
 #ctDesktopAccountsV8 .ctHoldingDetail>summary .ctHoldingRate{font-size:15px!important;font-weight:800;white-space:nowrap!important}
 html[data-ct-layout="mobile-first"] body #ctDesktopAccountsV8 .ctHoldingDetail>summary .ctHoldingRate.gain{color:#d92d20!important}
 html[data-ct-layout="mobile-first"] body #ctDesktopAccountsV8 .ctHoldingDetail>summary .ctHoldingRate.loss{color:#175cd3!important}
 #ctDesktopAccountsV8 .ctHoldingDetail>summary .ctHoldingPeriod{font-size:11px!important;font-weight:700;white-space:nowrap!important}
 #ctDesktopAccountsV8 .ctHoldingDetail>summary .ctHoldingBasis{font-size:11px!important;color:#667085!important;white-space:nowrap!important}
}
@media(min-width:768px) and (max-width:1050px){.ctA8Grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
`;document.head.appendChild(s)}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function holdingRate(p,fund,price,avg){
 if(fund){const x=n(p.master_holding_return_pct);return x==null?null:{value:x,basis:'확정값'};}
 const currency=String(p.currency||'').toUpperCase();
 if(!['KRW','USD'].includes(currency)||!(price>0&&avg>0))return null;
 const value=100*(price/avg-1);return Number.isFinite(value)?{value,basis:currency==='USD'?'달러 가격 기준':'가격 기준'}:null;
}
function periodData(id,ticker){
 const live=L(),d=live.performance_day,pc=d?.price_comparisons,now=Date.now(),start=Date.parse(d?.start_kst),end=Date.parse(d?.end_kst),at=Date.parse(d?.as_of_kst);
 if(d?.schema!=='CT_US_CLOSE_PERFORMANCE_DAY_V1'||!live.snapshot_id||d.snapshot_id!==live.snapshot_id||pc?.snapshot_id!==live.snapshot_id||pc?.schema!=='CT_HOLDING_PRICE_COMPARISONS_V1'||pc.current?.start_kst!==d.start_kst||![start,end,at].every(Number.isFinite)||!(start<=at&&at<end&&start<=now&&now<end))return {stale:true};
 const key=String(ticker||'').trim().toUpperCase();
 const get=period=>{const matches=(pc[period]?.accounts?.[id]?.positions||[]).filter(x=>String(x.ticker||'').trim().toUpperCase()===key);if(!key||matches.length!==1)return null;const p=matches[0],amount=n(p.price_effect_krw),base=n(p.baseline_value_krw);return p.state==='CALCULATED'&&amount!=null&&base>0?{amount,rate:100*amount/base,date:p.baseline_session_date,price:p.baseline_price}:null};
 return {today:get('current'),week:get('week')};
}
function holdingDetails(a,id){
 const M=window.JjooniMetrics,rows=M.positions(a);
 const metric=(label,value)=>`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;
 return `<details class="ctAccountHoldings" data-disclosure-key="${id}"><summary>보유종목 ${rows.length}개 보기</summary><small>오늘·전주: 현재 보유수량·현재 환율 기준 가격변동 · 매매·배당·비용·환율변동 제외</small><div class="ctAccountHoldingRows">${rows.map((p,i)=>{
  const ticker=String(p.ticker||p.symbol||''),fund=String(p.record_type||'').toUpperCase()==='FUND'||/^F\d+$/i.test(ticker),qty=M.first(p,['qty','quantity','held_qty']),value=M.valueKrw(p,a),price=M.first(p,['current_price','price','last_price']),avg=M.first(p,['avg_price','average_price','purchase_price']),period=periodData(id,ticker),day=period.today?.amount,cum=M.first(p,['pnl_krw','total_pnl_krw','evaluation_pnl_krw','unrealized_pnl_krw']),unit=M.currency(p)==='USD'?' USD':'원',native=x=>x==null?'확인 필요':x.toLocaleString('ko-KR',{maximumFractionDigits:unit==='원'?0:4})+unit;
  const brokerRate=id==='TOSS'?n(p.broker_holding_return_pct):null,rate=brokerRate!=null?{value:brokerRate,basis:'토스 보유 기준'}:holdingRate(p,fund,price,avg);
  const periodLine=(label,v)=>`<span class="ctHoldingPeriod ${v?cls(v.amount):'neutral'}">${label} ${v?signed(v.amount)+' · '+pct(v.rate):(period.stale?'갱신 필요':'기준가 확인 필요')}</span>`;
  return `<article><details class="ctHoldingDetail" data-disclosure-key="${esc(id+'|'+ticker+'|'+i)}"><summary><b class="ctHoldingName">${esc(M.currency(p)==='USD'?ticker+' · '+(p.name||ticker):p.name||ticker)}</b><small class="ctHoldingMeta">${esc(ticker)} · ${fund?'펀드 · 좌수 기준 확인 필요':qty==null?'수량 확인 필요':qty.toLocaleString('ko-KR')+'주'} · 상세 보기</small><span class="ctHoldingRight"><strong>${won(value)}</strong><span class="ctHoldingRate ${rate?cls(rate.value):'neutral'}">${rate?pct(rate.value):'수익률 확인 필요'}</span><small class="ctHoldingBasis">보유 · ${rate?esc(rate.basis):'매수 대비'}</small>${periodLine('오늘',period.today)}${periodLine('전주',period.week)}</span></summary><dl class="ctHoldingMetrics">${metric('현재가 · 원통화',native(price))}${metric('평균 매수가 · 원통화',native(avg))}${metric('오늘 보유 가격변동 · 원화',signed(day))}${metric('전주 보유 가격변동 · 원화',signed(period.week?.amount))}${metric('오늘 기준일 · 기준가',period.today?String(period.today.date||'확인 필요')+' · '+native(period.today.price):'확인 필요')}${metric('전주 기준일 · 기준가',period.week?String(period.week.date||'확인 필요')+' · '+native(period.week.price):'확인 필요')}${metric('누적 보유손익 · 원화',signed(cum))}${metric('계좌 내 비중',value!=null&&n(a.nav)>0?(value/a.nav*100).toFixed(2)+'%':'확인 필요')}${metric('평가액 · 원화',won(value))}</dl>${id==='TOSS'?`<small>토스 보유내역 기준 · 수집 ${esc(p.broker_holding_observed_at||'미확인')}<br>평가손익 ${signed(p.broker_holding_pnl_krw)} · 수익률 ${pct(p.broker_holding_return_pct)}<br>위 가격 기준 수익률과 기준 시점·환율 산식이 다를 수 있습니다.</small>`:''}${fund?'':`<button type="button" class="ctHoldingGraph" data-chart-symbol="${esc(ticker)}">일중 그래프 보기</button>`}<small>계좌 원본 기준 · 누락된 원가·손익은 임의 계산하지 않습니다.</small></details></article>`;
 }).join('')||'<p>원본에서 확인된 보유종목이 없습니다.</p>'}</div></details>`
}
function render(){if(!wide())return;const panel=qs('#panel-accounts'),c=C();if(!panel||!c.accounts)return;style();let root=qs('#ctDesktopAccountsV8',panel);if(!root){root=document.createElement('div');root.id='ctDesktopAccountsV8';panel.prepend(root)}const cards=IDS.map(id=>{const a=c.accounts[id]||{},holding=window.JjooniMetrics.tossHoldingPerformance(a),effect=a.holding_price_effect,priceOnly=n(a.today_pnl)==null&&effect?.known_count>0&&n(effect.known_subtotal_krw)!=null,day=priceOnly?effect.known_subtotal_krw:a.today_pnl,dayReturn=priceOnly?effect.return_pct:a.today_return,cash=displayCash(id,a),source=trustKind(authority(a));return `<div class="ctA8Card"><div class="ctA8Name">${LABEL[id]}</div><div class="ctA8Nav">${n(a.nav)!=null?won(a.nav):'—'}</div><div class="ctA8Rows">${a.performance_basis==='CONTRIBUTED_CAPITAL'?`<div class="ctA8Line"><span>납입원금</span><b>${won(a.principal)}</b></div>`:''}<div class="ctA8Line"><span>${priceOnly?'보유 가격변동 · '+effect.known_count+'/'+effect.position_count+'종목':'오늘 투자손익'}</span><b class="${cls(day)}">${n(day)!=null?signed(day):'산정 대기'}</b></div><div class="ctA8Line"><span>${priceOnly?'보유가격 수익률':'오늘 수익률'}</span><b>${pct(dayReturn)}</b></div><div class="ctA8Line"><span>${a.performance_basis==='CONTRIBUTED_CAPITAL'?'납입원금 기준 손익':'누적손익'}</span><b class="${cls(a.pnl)}">${n(a.pnl)!=null?signed(a.pnl):'산정 대기'}</b></div><div class="ctA8Line"><span>${a.performance_basis==='CONTRIBUTED_CAPITAL'?'납입원금 기준 수익률':'누적수익률'}</span><b>${pct(n(a.pnl)==null?null:a.return_pct)}</b></div>${id==='TOSS'?`<div class="ctA8Line"><span>보유주식 평가손익 · 토스 기준</span><b class="${cls(holding.pnl)}">${signed(holding.pnl)}</b></div><div class="ctA8Line"><span>보유주식 평가수익률 · 토스 기준</span><b>${pct(holding.return_pct)}</b></div>`:''}<div class="ctA8Line"><span>예수금/현금</span><b>${cash!=null?won(cash):'—'}</b></div><div class="ctA8Line"><span>보유종목</span><b>${(a.positions||[]).length}개</b></div></div><div class="ctA8Source">${source} · 기준 ${String(c.observed_at||'').replace('T',' ').slice(5,16)}</div>${holdingDetails(a,id)}</div>`}).join('');const html=`<div class="ctA8Head"><div><div class="ctA8Title">계좌별 성과</div><div class="ctA8Sub">4계좌 동일 Canonical SSOT 기준 · 값이 없으면 0원이 아니라 산정 대기로 표시</div></div><div class="ctA8Total">총자산 ${won(c.total&&c.total.nav)}<br>${n(c.total?.today_pnl)==null&&c.performance_day?.price_effect?.known_count>0?'보유 가격변동 '+signed(c.performance_day.price_effect.known_subtotal_krw):'오늘 '+signed(c.total&&c.total.today_pnl)}</div></div><div class="ctA8Grid">${cards}</div>`;if(root.dataset.renderedHtml!==html){
 const opened=new Set(Array.from(root.querySelectorAll('details[open][data-disclosure-key]')).map(d=>d.dataset.disclosureKey));
 const anchor=root.querySelector('details[open].ctHoldingDetail'),anchorKey=anchor?.dataset.disclosureKey,anchorTop=anchor?.getBoundingClientRect().top;
 root.innerHTML=html;root.dataset.renderedHtml=html;
 for(const d of root.querySelectorAll('details[data-disclosure-key]'))if(opened.has(d.dataset.disclosureKey))d.open=true;
 if(anchorKey){const next=Array.from(root.querySelectorAll('.ctHoldingDetail')).find(d=>d.dataset.disclosureKey===anchorKey);if(next&&Number.isFinite(anchorTop))window.scrollBy(0,next.getBoundingClientRect().top-anchorTop)}
 }window.__JJOONI_TABLET_ACCOUNTS_V8={state:'ACTIVE',version:'8.3',card_count:IDS.length}}
document.addEventListener('click',e=>{
 const button=e.target.closest?.('.ctHoldingGraph[data-chart-symbol]');if(!button)return;
 e.stopPropagation();
 document.dispatchEvent(new CustomEvent('jjooni:open-intraday',{detail:{symbol:button.dataset.chartSymbol}}));
});
setTimeout(render,0);setTimeout(render,700);document.addEventListener('jjooni:live-applied',render);window.addEventListener('resize',render);
})();

