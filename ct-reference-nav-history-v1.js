(function(root){
'use strict';
// Distinct data contract: reference observation NAV is NEVER verified investment P&L.
const SCHEMA='CT_REFERENCE_NAV_HISTORY_V1';
const QUALITY='REFERENCE_ONLY_NO_ATTESTED_BROKER_CLOSE';
const ACCOUNTS=['TOSS','ISA','PENSION','IRP'];
const NS='http://www.w3.org/2000/svg';
const money=v=>Math.round(v).toLocaleString('ko-KR')+'원';
const dateOk=v=>{if(typeof v!=='string'||!/^20\d\d-\d\d-\d\d$/.test(v))return false;const d=new Date(v+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v;};
const timeOk=v=>typeof v==='string'&&/(Z|[+-]\d\d:\d\d)$/.test(v)&&Number.isFinite(Date.parse(v));
const failure=(reason)=>({ok:false,reason,rows:[]});
function audit(history,{live={},canonical={},now=Date.now()}={}){
 if(!history||typeof history!=='object'||Array.isArray(history))return failure('참고용 NAV 데이터 연결 대기');
 if(history.schema!==SCHEMA||history.state!=='REFERENCE_ONLY'||history.source_quality!==QUALITY)return failure('참고 NAV 원천 유형 불일치');
 if(history.cash_flow_reconciled!==false||history.certified_us_close!==false||history.historical_pnl_available!==false)return failure('참고 NAV 검증 수준 표시 오류');
 const snapshot=String(history.bound_snapshot_id||'');
 if(!snapshot||snapshot!==String(live.snapshot_id||'')||snapshot!==String(canonical.snapshot_id||''))return failure('현재 계좌 스냅샷과 연결 불일치');
 if(!Array.isArray(history.portfolio_account_ids)||history.portfolio_account_ids.length!==4||
    new Set(history.portfolio_account_ids).size!==4||ACCOUNTS.some(a=>!history.portfolio_account_ids.includes(a)))
   return failure('4계좌 구성 확인 필요');
 if(history.date_basis!=='CANONICAL_CAPTURE_KST_CALENDAR_DAY'||
    history.selection_rule!=='LATEST_COMPLETE_FOUR_ACCOUNT_CANONICAL_SNAPSHOT_PER_KST_DAY')
   return failure('일별 NAV 선정 기준 확인 필요');
 if(!timeOk(history.generated_at_kst)||Date.parse(history.generated_at_kst)>now+120000||
    now-Date.parse(history.generated_at_kst)>1000*60*60*24*10)
   return failure('참고 NAV 생성 시점 확인 대기');
 if(!Array.isArray(history.days)||history.days.length<2||history.days.length>366)return failure('참고 NAV 이력 최소 2일 필요');
 const seen=new Set(),rows=[];
 for(const raw of history.days){
   if(!raw||!dateOk(raw.date)||seen.has(raw.date)||rows.length&&raw.date<=rows[rows.length-1].date)
     return failure('날짜 순서·중복 이상');
   seen.add(raw.date);
   const nav=raw.total_four_nav_krw;
   if(typeof nav!=='number'||!Number.isFinite(nav)||nav<=0||!timeOk(raw.generated_kst)||
     !raw.source_snapshot_id||raw.source_quality!==QUALITY||typeof raw.legacy_tripod_excluded!=='boolean')
     return failure('4계좌 NAV·원천증빙 불완전');
   if(Date.parse(raw.generated_kst)>now+120000)return failure('미래 관측값 포함');
   const kstDay=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(raw.generated_kst));
   if(kstDay!==raw.date)return failure('NAV 기록일과 수집시각 불일치');
   rows.push({date:raw.date,nav,source_at:raw.generated_kst,legacy_risk:raw.legacy_tripod_excluded});
 }
 const latest=rows[rows.length-1],gap=(now-Date.parse(latest.source_at))/(24*60*60*1000);
 return {ok:true,reason:'REFERENCE_ONLY',rows,
   gaps:Math.round((Date.parse(latest.date+'T00:00:00Z')-Date.parse(rows[0].date+'T00:00:00Z'))/(24*60*60*1000))+1-rows.length,
   source_at:history.generated_at_kst,age_days:gap,stale:gap>4,
   excluded_legacy:rows.filter(r=>r.legacy_risk).length};
}
function el(tag,attrs={},label){
 const e=document.createElementNS(NS,tag);
 for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));
 if(label!=null)e.textContent=label;return e;
}
function makeChart(rows){
 const width=660,start=Date.parse(rows[0].date+'T00:00:00Z'),
   last=Date.parse(rows[rows.length-1].date+'T00:00:00Z'),range=Math.max(1,last-start);
 const min=Math.min(...rows.map(r=>r.nav)),max=Math.max(...rows.map(r=>r.nav)),span=Math.max(1,max-min);
 const x=r=>16+628*(Date.parse(r.date+'T00:00:00Z')-start)/range;
 const y=r=>151-127*(r.nav-min)/span;
 const svg=el('svg',{viewBox:'0 0 660 183',preserveAspectRatio:'xMidYMid meet',role:'img','aria-label':'기존 4계좌 참고용 순자산 NAV 추이. 수집일 누락 구간은 연결하지 않음'});
 svg.append(el('title',{},'4계좌 참고용 순자산: 실제 수집 기록만 점으로 표시'));
 svg.append(el('line',{x1:16,y1:151,x2:645,y2:151,stroke:'#cfd9e7','stroke-width':1}));
 let section=[];
 const flush=()=>{if(section.length>1)svg.append(el('polyline',{points:section.join(' '),fill:'none',stroke:'#28629d','stroke-width':2.8,'stroke-linecap':'round','stroke-linejoin':'round'}));section=[]};
 rows.forEach((r,i)=>{
   if(i&&(Date.parse(r.date+'T00:00:00Z')-Date.parse(rows[i-1].date+'T00:00:00Z'))>86400000)flush();
   section.push(x(r).toFixed(1)+','+y(r).toFixed(1));
 });flush();
 rows.forEach((r,i)=>{
   const point=el('circle',{cx:x(r).toFixed(1),cy:y(r).toFixed(1),r:i===rows.length-1?4.4:2.1,fill:'#28629d'});
   point.append(el('title',{},r.date+' 수집 NAV '+money(r.nav)));svg.append(point);
 });
 svg.append(el('text',{x:16,y:176,'font-size':12,fill:'#54657b'},rows[0].date));
 svg.append(el('text',{x:645,y:176,'font-size':12,fill:'#54657b','text-anchor':'end'},rows[rows.length-1].date));
 return svg;
}
function overviewShortcut(report){
 const overview=document.querySelector('#panel-overview');
 if(!overview)return;
 let card=document.querySelector('#ctReferenceNavOverviewV1');
 if(!card){
  card=document.createElement('section');card.id='ctReferenceNavOverviewV1';
  card.setAttribute('aria-label','4계좌 관측 순자산 그래프');
  const title=document.createElement('strong');title.textContent='4계좌 순자산 추이 · 참고용';
  title.className='ctRefNavOverviewTitle';
  const info=document.createElement('span');info.className='ctRefNavOverviewInfo';
  const button=document.createElement('button');button.type='button';
  button.textContent='상세 그래프 · 성과 탭';button.className='ctRefNavOverviewOpen';
  button.addEventListener('click',()=>{
   const tab=document.querySelector('.tabs .tab[data-tab="compare"]');
   if(!tab)return;
   tab.click();
   setTimeout(()=>{
    const section=document.querySelector('#ctReferenceNavHistoryV1');
    if(section&&section.getClientRects().length)section.scrollIntoView({block:'start',behavior:'smooth'});
   },180);
  });
  const plot=document.createElement('div');plot.className='ctRefNavOverviewChart';
  plot.setAttribute('aria-label','검증된 기준시각의 관측 NAV만 표시하고 누락된 날짜는 연결하지 않는 그래프');
  card.append(title,info,button,plot);
 }
 const anchor=document.querySelector('#ctHumanQuickV2')||overview.querySelector('.ctOvHero');
 if(anchor&&anchor.parentElement===overview){
  if(anchor.nextElementSibling!==card)anchor.insertAdjacentElement('afterend',card);
 }else if(card.parentElement!==overview)overview.prepend(card);
 const info=card.querySelector('.ctRefNavOverviewInfo');
 if(report.ok){
  info.textContent='실제 관측 '+report.rows.length+'일 · 투자수익률·손익 아님'+(report.gaps?' · 관측 공백 '+report.gaps+'일':'')+(report.stale?' · 최신 관측 지연':'');
  card.dataset.ctReference='REFERENCE_ONLY';
  const plot=card.querySelector('.ctRefNavOverviewChart');
  if(plot){plot.replaceChildren(makeChart(report.rows));plot.hidden=false}
 }else{
  info.textContent='관측 NAV 그래프 표시 불가 · '+report.reason;
  card.dataset.ctReference='WAITING';
  const plot=card.querySelector('.ctRefNavOverviewChart');
  if(plot){plot.replaceChildren();plot.hidden=true}
 }
}
function render(){
 if(root.__JJOONI_CT_HUMAN_V2?.mode!=='v2')return;
 const host=document.querySelector('#panel-compare');if(!host)return;
 let section=document.querySelector('#ctReferenceNavHistoryV1');
 if(!section){
  section=document.createElement('section');section.id='ctReferenceNavHistoryV1';
  section.setAttribute('aria-label','참고용 4계좌 순자산 추이');
  host.insertBefore(section,host.querySelector('#ctVerifiedPerformanceHistoryV1'));
 }
 const live=root.__JJOONI_LIVE_PAYLOAD||{},canonical=root.__JJOONI_CANONICAL_SSOT||{};
 const report=audit(live.reference_nav_history,{live,canonical});
 root.__JJOONI_REFERENCE_NAV_AUDIT={state:report.ok?'REFERENCE_ONLY':'WAITING',reason:report.reason,points:report.rows.length};
 overviewShortcut(report);
 const sig=[live.snapshot_id,canonical.snapshot_id,live.reference_nav_history?.generated_at_kst,report.ok,report.reason,
   report.rows.map(r=>[r.date,r.nav,r.source_at]).join('|')].join('|');
 if(section.dataset.signature===sig)return;section.dataset.signature=sig;
 section.replaceChildren();section.dataset.ctReference=report.ok?'REFERENCE_ONLY':'WAITING';
 const header=document.createElement('header');header.className='ctRefNavHeader';
 const h=document.createElement('h2');h.textContent='수집된 순자산 추이 · 참고용';
 const tag=document.createElement('span');tag.className='ctRefNavTag';tag.textContent='투자손익 아님';
 const sub=document.createElement('p');sub.textContent='Toss · ISA · 연금저축 · IRP 합계 · 과거 스냅샷에서 복원 · TRI-POD는 Toss 내 전략으로 중복 제외';
 header.append(h,tag,sub);section.append(header);
 if(!report.ok){
  const w=document.createElement('p');w.className='ctRefNavWaiting';w.textContent='참고 NAV 검증 대기 · '+report.reason;
  section.append(w);return;
 }
 const source=document.createElement('p');source.className='ctRefNavMeta';
 source.textContent='수집된 날짜 '+report.rows.length+'일 · '+report.rows[0].date+' ~ '+report.rows[report.rows.length-1].date+
  (report.gaps>0?' · 기록 없는 날짜 '+report.gaps+'일':'')+(report.stale?' · 최근 관측 갱신 확인 필요':'');
 section.append(source,makeChart(report.rows));
 const first=report.rows[0],last=report.rows[report.rows.length-1];
 const facts=document.createElement('p');facts.className='ctRefNavValues';
 facts.textContent='첫 기록 '+money(first.nav)+' → 최근 기록 '+money(last.nav)+' · 참고 NAV 변동 '+money(last.nav-first.nav);
 section.append(facts);
 const warn=document.createElement('p');warn.className='ctRefNavDisclaimer';
 warn.textContent='주의: 참고 NAV 변동에는 입출금·계좌별 관측시각 차이 등이 섞일 수 있습니다. 수익률·순투자손익이 아니며, 누락 날짜는 연결하지 않습니다. 별도의 검증된 투자성과 3종 그래프와 혼용하지 않습니다.';
 section.append(warn);
 const details=document.createElement('details');details.className='ctRefNavDetails';
 const title=document.createElement('summary');title.textContent='날짜별 참고 NAV 기록 보기';details.append(title);
 const scroll=document.createElement('div');scroll.className='ctRefNavScroll';
 const table=document.createElement('table');const head=document.createElement('thead');const tr=document.createElement('tr');
 for(const label of ['수집일','4계좌 참고 NAV','최종 수집시각 (KST)']){const th=document.createElement('th');th.textContent=label;tr.append(th)}
 head.append(tr);table.append(head);
 const body=document.createElement('tbody');
 for(const row of report.rows){const tr=document.createElement('tr');const at=new Date(row.source_at);const time=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false}).format(at);
  for(const value of [row.date,money(row.nav),time]){const td=document.createElement('td');td.textContent=value;tr.append(td)}body.append(tr)}
 table.append(body);scroll.append(table);details.append(scroll);section.append(details);
}
let pending=false;function schedule(){if(pending)return;pending=true;setTimeout(()=>{pending=false;render()},70)}
if(typeof document!=='undefined'){
 const init=()=>{
  if(!document.getElementById('ctReferenceNavStyle')){
    const link=document.createElement('link');link.id='ctReferenceNavStyle';link.rel='stylesheet';link.href='ct-reference-nav-history-v1.css?v=3';
    (document.head||document.documentElement).append(link);
  }
  render();
 };
 document.addEventListener('jjooni:live-applied',schedule);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});
 document.addEventListener('click',e=>{if(e.target.closest?.('.tab[data-tab],#ctHumanBottomV2,#ctHumanV2More'))schedule()});
 setTimeout(init,0);setTimeout(init,900);setTimeout(init,2300);
}
const api={schema:SCHEMA,audit,render};
root.JjooniReferenceNavHistory=api;
if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window==='object'?window:globalThis);
