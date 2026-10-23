(function(root){
'use strict';
const IDS=['TOSS','ISA','PENSION','IRP'],NAMES={TOSS:'Toss',ISA:'ISA',PENSION:'연금저축',IRP:'IRP'};
const num=v=>v==null||typeof v==='boolean'||typeof v==='object'||String(v).trim()===''||!Number.isFinite(Number(v))?null:Number(v);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>num(v)==null?'산정 대기':(num(v)>0?'+':num(v)<0?'-':'')+'₩'+Math.abs(Math.round(v)).toLocaleString('ko-KR');
const pct=v=>num(v)==null?'수익률 산정 대기':(num(v)>0?'+':'')+num(v).toFixed(2)+'%';
const tone=v=>num(v)==null?'unknown':Number(v)>0?'gain':Number(v)<0?'loss':'neutral';
const time=v=>{const ms=Date.parse(v);return Number.isFinite(ms)?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(ms)):'시각 확인 필요'};
function daily(a){
 if(num(a?.today_pnl)!=null)return {pnl:num(a.today_pnl),rate:num(a.today_return),priceOnly:false,label:'오늘 투자손익'};
 const p=a?.holding_price_effect;
 if(p?.known_count>0&&num(p.known_subtotal_krw)!=null)return {pnl:num(p.known_subtotal_krw),rate:num(p.return_pct),priceOnly:true,label:'보유 가격변동',known:p.known_count,count:p.position_count};
 const ref=a?.broker_daily_reference;if(num(ref?.today_pnl)!=null)return {pnl:num(ref.today_pnl),rate:num(ref.today_return),priceOnly:false,brokerOnly:true,label:'증권사 당일손익 · 별도 구간'};
 return {pnl:null,rate:null,priceOnly:false,label:'오늘 투자손익'};
}
function model(live,now=Date.now()){
 const d=live?.performance_day;if(d?.schema!=='CT_US_CLOSE_PERFORMANCE_DAY_V1')return null;
 const start=Date.parse(d.start_kst),end=Date.parse(d.end_kst),at=Date.parse(d.as_of_kst);
 if(![start,end,at].every(Number.isFinite)||!(start<=at&&at<end)||d.snapshot_id!==live.snapshot_id)return {valid:false};
 function side(key){
  const p=d[key]||{},rows=IDS.map(id=>{const r=p.accounts?.[id]||{},ready=(key==='previous'?r.state==='FINAL':r.state==='LIVE')&&num(r.pnl_krw)!=null;return {id,name:NAMES[id],pnl:ready?num(r.pnl_krw):null,rate:ready?num(r.return_pct):null,reasons:r.reasons||[]}});
  const known=rows.filter(r=>r.pnl!=null).length,complete=known===IDS.length;
  return {rows,known,pnl:complete?rows.reduce((s,r)=>s+r.pnl,0):null,rate:complete?num(p.return_pct):null,ready:complete};
 }
 const current=side('current'),previous=side('previous');
 const pe=d.price_effect||{},priceEffect=pe.schema==='CT_CURRENT_HOLDINGS_PRICE_EFFECT_V1'&&pe.snapshot_id===live.snapshot_id&&pe.start_kst===d.start_kst?pe:null;
 const expired=now>=end||now<start;
 if(expired){current.pnl=null;current.rate=null;current.ready=false;current.known=0;current.rows.forEach(r=>{r.pnl=null;r.rate=null})}
 const pc=d.price_comparisons;const comparisons=!expired&&pc?.schema==='CT_HOLDING_PRICE_COMPARISONS_V1'&&pc.snapshot_id===live.snapshot_id&&pc.current?.start_kst===d.start_kst?pc:null;
 return {valid:true,comparisons,date:d.date,previousDate:d.previous_date,start:d.start_kst,end:d.end_kst,previousStart:d.previous_start_kst,asOf:d.as_of_kst,expired,current,previous,priceEffect:expired?null:priceEffect,
  references:IDS.map(id=>({id,name:NAMES[id],...(live.accounts?.[id]?.broker_daily_reference||{})}))};
}
function html(live,now=Date.now()){
 const m=model(live,now);if(!m)return '';
 if(!m.valid)return '<section class="ctPerformanceDay"><h3>미국 정규장 마감 기준</h3><p>손익 기준기간 확인 중 · 새 원본 갱신을 기다립니다.</p></section>';
 if(m.comparisons)return comparisonHtml(m);
 const usePrice=!m.current.ready&&m.priceEffect?.known_count>0&&num(m.priceEffect.known_subtotal_krw)!=null;
 const card=(which,title,date,a,b)=>{const r=m[which],pe=which==='current'&&usePrice?m.priceEffect:null;return `<article class="ctPerformanceDayMetric"><span>${esc(pe?'오늘 보유종목 가격변동':title)} · ${esc(date)}</span><strong class="${tone(pe?pe.known_subtotal_krw:r.pnl)}">${money(pe?pe.known_subtotal_krw:r.pnl)}</strong><b class="${tone(pe?pe.return_pct:r.rate)}">${pct(pe?pe.return_pct:r.rate)}</b><small>${esc(time(a))} → ${esc(time(b))}</small><small>${pe?`확인 ${pe.known_count}/${pe.position_count}종목 · 현재 수량 기준`:`${r.known}/4계좌 ${r.ready?(which==='previous'?'확정':'집계 중'):'산정 대기'}`}</small></article>`};
 const pending=!m.current.ready||!m.previous.ready;
 const priceNote=usePrice?'<br>가격변동은 현재 보유수량·현재 환율로 계산합니다. 실현손익·입출금·배당·비용·환율변동은 포함하지 않습니다.':'';
 return `<section class="ctPerformanceDay" data-performance-date="${esc(m.date)}"><h3>미국 정규장 마감 기준</h3><div class="ctPerformanceDayGrid">${card('current','오늘 진행 손익',m.date,m.start,m.end)}${card('previous',m.previous.ready?'전일 확정 손익':'전일 손익',m.previousDate,m.previousStart,m.start)}</div><p>${m.expired?'기준기간이 종료됐습니다. 새 원본 갱신을 기다립니다.':`애프터장부터 새날 손익 · 원본 ${esc(time(m.asOf))}`}${priceNote}${pending?'<br>계좌 전체 투자손익은 마감 평가액·입출금 대사 중입니다.':''}${m.priceEffect?.excluded_funds_count?`<br>펀드 ${m.priceEffect.excluded_funds_count}건은 가격변동 합계에서 제외했습니다.`:''}</p><details><summary>계좌별 손익·증권사 참고값</summary><div class="ctPerformanceDayAccounts">${IDS.map((id,i)=>{const a=m.current.rows[i],p=m.previous.rows[i],ref=m.references[i],effect=m.priceEffect?.accounts?.[id];return `<article><h4>${esc(a.name)}</h4>${effect?.known_count?`<div><span>보유 가격변동</span><b>${money(effect.known_subtotal_krw)}</b></div><small>확인 ${effect.known_count}/${effect.position_count}종목</small><details data-price-account="${id}"><summary>종목별 기준종가·계산값</summary>${(effect.positions||[]).map(r=>`<div class="ctPriceEffectRow"><b>${esc(r.name||r.ticker)}</b><span>${esc(r.qty)}주 · ${esc(r.currency)} ${esc(r.baseline_price??'미확인')} → ${esc(r.current_price??'미확인')}</span><small>기준종가 ${esc(r.baseline_session_date||'확인 중')}</small><strong>${money(r.price_effect_krw)}</strong></div>`).join('')}</details>`:''}<div><span>계좌 전체 · 오늘</span><b>${money(a.pnl)}</b></div><div><span>전일 확정</span><b>${money(p.pnl)}</b></div><div class="ctPerformanceDayReference"><span>원천 구간 참고</span><b>${money(ref.today_pnl)}</b></div></article>`}).join('')}</div><p>증권사 참고값은 각 원천의 집계 구간입니다. 위의 미국 마감 기준 손익과 합산하지 않습니다.</p></details></section>`;
}
function comparisonHtml(m){
 const c=m.comparisons;
 const amount=r=>num(r?.known_subtotal_krw)??num(r?.pnl_krw);
 const missing=r=>r?.excluded_funds_count&&!r?.position_count?'펀드 기준가 별도':'기준가격 자료 없음';
 const value=r=>amount(r)==null?missing(r):money(amount(r));
 const coverage=r=>`${r.known_count}/${r.position_count}종목${r.excluded_funds_count?' · 펀드 '+r.excluded_funds_count+'건 별도':''}`;
 const metric=(key,title)=>{const r=c[key];return `<article class="ctPerformanceDayMetric" data-price-period="${key}"><span>${title}</span><strong class="${tone(amount(r))}">${value(r)}</strong><b class="${tone(r.return_pct)}">${num(r.return_pct)==null?'수익률 자료 없음':pct(r.return_pct)}</b><small>${esc(time(r.start_kst))} → ${esc(time(key==='previous'?m.start:m.asOf))}</small><small>${coverage(r)}</small></article>`};
 const change=c.day_change?.pnl_change_krw;
 const row=(r,label)=>`<div><span>${label}</span><b class="${tone(amount(r))}">${value(r)}${num(r?.return_pct)!=null?' · '+pct(r.return_pct):''}</b></div>`;
 return `<section class="ctPerformanceDay" data-performance-date="${esc(m.date)}" data-comparison-schema="${esc(c.schema)}"><h3>오늘·전일·전주 가격변동</h3><div class="ctPerformanceDayGrid">${metric('current','오늘 · 미국 마감 이후')}${metric('previous','전일 · 마감 대 마감')}${metric('week','전주 대비 · 7일 전 마감 기준')}</div>${num(change)!=null?`<div class="ctCommonLine ctDailyProfitChange"><span>전일 대비 오늘 손익 증감</span><strong class="${tone(change)}">${money(change)}</strong></div>`:''}<p>현재 보유수량 × 기준종가 대비 가격변동 × 현재 환율입니다. 전일은 전일 마감 구간, 전주 대비는 7일 전 마감부터 현재까지입니다. 매매·실현손익·배당·비용·환율변동은 제외합니다.</p><details><summary>계좌별 비교·종목별 계산 근거</summary><div class="ctPerformanceDayAccounts">${IDS.map(id=>{const a=c.current.accounts[id],prev=c.previous.accounts[id],week=c.week.accounts[id],delta=c.day_change?.accounts?.[id];return `<article><h4>${NAMES[id]}</h4>${row(a,'오늘')}${row(prev,'전일')}${row(week,'전주 대비')}${num(delta?.pnl_change_krw)!=null?`<div><span>전일 대비 손익 증감</span><b class="${tone(delta.pnl_change_krw)}">${money(delta.pnl_change_krw)}</b></div>`:''}<small>${coverage(a)}</small><details data-price-account="${id}"><summary>종목별 기준종가·계산값</summary>${(a.positions||[]).map(p=>`<div class="ctPriceEffectRow"><b>${esc(p.name||p.ticker)}</b><span>${esc(p.qty)}주 · ${esc(p.currency)} ${esc(p.baseline_price??'미제공')} → ${esc(p.current_price??'미제공')}</span><small>기준종가 ${esc(p.baseline_session_date||'미제공')}</small><strong class="${tone(p.price_effect_krw)}">${num(p.price_effect_krw)==null?'기준가격 자료 없음':money(p.price_effect_krw)}</strong></div>`).join('')}</details></article>`}).join('')}</div><p>계좌 전체 투자손익은 마감 NAV·입출금 이력이 모두 확인된 경우에만 별도로 확정합니다. 위 가격변동 합계와 혼합하지 않습니다.</p></details></section>`;
}
const api={version:'1.2',model,html,daily,tone};if(typeof module==='object'&&module.exports)module.exports=api;else root.JjooniPerformanceDay=api;
})(typeof window==='object'?window:globalThis);
