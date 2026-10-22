(function(root){
'use strict';
const IDS=['TOSS','ISA','PENSION','IRP'],NAMES={TOSS:'Toss',ISA:'ISA',PENSION:'연금저축',IRP:'IRP'};
const num=v=>v==null||typeof v==='boolean'||typeof v==='object'||String(v).trim()===''||!Number.isFinite(Number(v))?null:Number(v);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>num(v)==null?'산정 대기':(num(v)>0?'+':num(v)<0?'-':'')+'₩'+Math.abs(Math.round(v)).toLocaleString('ko-KR');
const pct=v=>num(v)==null?'수익률 산정 대기':(num(v)>0?'+':'')+num(v).toFixed(2)+'%';
const time=v=>{const ms=Date.parse(v);return Number.isFinite(ms)?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(ms)):'시각 확인 필요'};
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
 const expired=now>=end||now<start;
 if(expired){current.pnl=null;current.rate=null;current.ready=false;current.known=0;current.rows.forEach(r=>{r.pnl=null;r.rate=null})}
 return {valid:true,date:d.date,previousDate:d.previous_date,start:d.start_kst,end:d.end_kst,previousStart:d.previous_start_kst,asOf:d.as_of_kst,expired,current,previous,
  references:IDS.map(id=>({id,name:NAMES[id],...(live.accounts?.[id]?.broker_daily_reference||{})}))};
}
function html(live,now=Date.now()){
 const m=model(live,now);if(!m)return '';
 if(!m.valid)return '<section class="ctPerformanceDay"><h3>미국 정규장 마감 기준</h3><p>손익 기준기간 확인 중 · 새 원본 갱신을 기다립니다.</p></section>';
 const card=(which,title,date,a,b)=>{const r=m[which];return `<article class="ctPerformanceDayMetric"><span>${esc(title)} · ${esc(date)}</span><strong>${money(r.pnl)}</strong><b>${pct(r.rate)}</b><small>${esc(time(a))} → ${esc(time(b))}</small><small>${r.known}/4계좌 ${r.ready?(which==='previous'?'확정':'집계 중'):'산정 대기'}</small></article>`};
 const pending=!m.current.ready||!m.previous.ready;
 return `<section class="ctPerformanceDay" data-performance-date="${esc(m.date)}"><h3>미국 정규장 마감 기준</h3><div class="ctPerformanceDayGrid">${card('current','오늘 진행 손익',m.date,m.start,m.end)}${card('previous',m.previous.ready?'전일 확정 손익':'전일 손익',m.previousDate,m.previousStart,m.start)}</div><p>${m.expired?'기준기간이 종료됐습니다. 새 원본 갱신을 기다립니다.':`애프터장부터 새날 손익 · 원본 ${esc(time(m.asOf))}`}${pending?'<br>마감 평가액·입출금 확인 전에는 손익을 확정하지 않습니다.':''}</p><details><summary>계좌별 손익·증권사 참고값</summary><div class="ctPerformanceDayAccounts">${IDS.map((id,i)=>{const a=m.current.rows[i],p=m.previous.rows[i],ref=m.references[i];return `<article><h4>${esc(a.name)}</h4><div><span>오늘 진행</span><b>${money(a.pnl)}</b></div><div><span>전일 확정</span><b>${money(p.pnl)}</b></div><div class="ctPerformanceDayReference"><span>원천 구간 참고</span><b>${money(ref.today_pnl)}</b></div></article>`}).join('')}</div><p>증권사 참고값은 각 원천의 집계 구간입니다. 위의 미국 마감 기준 손익과 합산하지 않습니다. 입출금은 투자손익에서 제외하고, 배당·비용·환율 변동은 계좌 평가액에 반영합니다.</p></details></section>`;
}
const api={version:'1.0',model,html};if(typeof module==='object'&&module.exports)module.exports=api;else root.JjooniPerformanceDay=api;
})(typeof window==='object'?window:globalThis);
