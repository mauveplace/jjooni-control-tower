(function(root){
'use strict';
// Verified-only investment performance. Never derives history from D.human.performance:
// live-bridge mutates that legacy array with current observations.
const SCHEMA='CT_RECONCILED_PERFORMANCE_HISTORY_V1';
const ACCOUNTS=['TOSS','ISA','PENSION','IRP'];
const SVG_NS='http://www.w3.org/2000/svg';
const number=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
const money=v=>Math.round(v).toLocaleString('ko-KR')+'원';
const sign=v=>(v>0?'+':'')+money(v);
const day=v=>{
 if(typeof v!=='string'||!/^20\d\d-\d\d-\d\d$/.test(v))return false;
 const d=new Date(v+'T00:00:00Z');
 return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v;
};
const near=(a,b)=>Math.abs(a-b)<=2; // Only KRW rounding, never asset-size-relative reconciliation tolerance.
const zonedTime=v=>typeof v==='string'&&v.includes('T')&&/(?:Z|[+-]\d{2}:\d{2})$/.test(v)&&Number.isFinite(Date.parse(v));
const fail=(reason,extra={})=>({ok:false,reason,rows:[],contributionOk:false,...extra});

function audit(history,{live={},canonical={}}={}){
 if(!history||typeof history!=='object'||Array.isArray(history))return fail('성과 이력 원천 미제공');
 if(history.schema!==SCHEMA)return fail('검증된 이력 스키마 불일치');
 if(history.status!=='VERIFIED')return fail('성과 이력 검증 대기');
 const health=String(live?.source_health?.pb_history?.state||'').toUpperCase();
 if(!['OK','VERIFIED'].includes(health))return fail('성과 원장 신선도 검증 대기');
 const snapshot=String(history.bound_snapshot_id||'');
 if(!snapshot||snapshot!==String(live.snapshot_id||'')||snapshot!==String(canonical.snapshot_id||''))return fail('성과 이력과 현재 스냅샷 불일치');
 if(!zonedTime(history.verified_at_kst)||Date.parse(history.verified_at_kst)>Date.now()+120000)return fail('이력 검증 시각 확인 필요');
 if(!Array.isArray(history.accounts)||history.accounts.length!==4||ACCOUNTS.some(a=>!history.accounts.includes(a))||new Set(history.accounts).size!==4)return fail('4계좌 원장 범위 확인 필요');
 if(!Array.isArray(history.rows)||history.rows.length<2||history.rows.length>366)return fail('일별 성과 이력 최소 2일 필요');
 const rows=[],seen=new Set();
 for(const raw of history.rows){
  if(!raw||!day(raw.date)||seen.has(raw.date))return fail('기준일 중복 또는 날짜 형식 오류');
  seen.add(raw.date);
  const nav=number(raw.nav_krw),pnl=number(raw.investment_pnl_krw),flow=number(raw.net_cash_flow_krw);
  if(nav==null||nav<=0||pnl==null||flow==null)return fail('일별 NAV·투자손익·순입출금 원장 누락');
  if(rows.length&&raw.date<=rows[rows.length-1].date)return fail('일별 원장 날짜 역순');
  rows.push({date:raw.date,nav,pnl,flow,raw});
 }
 for(let i=1;i<rows.length;i++){
  const prev=rows[i-1],cur=rows[i],change=cur.nav-prev.nav,bridge=cur.pnl+cur.flow;
  if(!near(change,bridge))return fail('NAV 증감 = 투자손익 + 순입출금 대사 불일치',{failed_date:cur.date});
 }
 // Asset-class bars are independently gated: NAV and daily P&L remain usable
 // even when classification is incomplete or overlapping.
 let contributionOk=history.asset_class_partition==='DISJOINT',reason='';
 const contributions=new Map();
 if(contributionOk){
  for(const row of rows){
   const p=row.raw.asset_class_contributions_krw;
   if(!p||typeof p!=='object'||Array.isArray(p)||!Object.keys(p).length||Object.keys(p).length>12){contributionOk=false;reason='자산군별 기여 데이터 누락';break}
   let subtotal=0;
   for(const [category,value] of Object.entries(p)){
    if(!/^[A-Z][A-Z0-9_]{1,39}$/.test(category)||number(value)==null){contributionOk=false;reason='자산군별 기여 형식 오류';break}
    subtotal+=value;
    contributions.set(category,(contributions.get(category)||0)+value);
   }
   if(!contributionOk)break;
   if(!near(subtotal,row.pnl)){contributionOk=false;reason='자산군별 기여 합계와 투자손익 대사 불일치';break}
  }
 }else reason='자산군 중복 없는 분류 검증 대기';
 return {ok:true,reason:'VERIFIED',rows,contributionOk,contributionReason:contributionOk?'':reason,contributions:contributionOk?Array.from(contributions.entries()).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])):[],source_at:history.verified_at_kst,source_snapshot:snapshot};
}

function svgEl(tag,attrs={},content){
 const e=document.createElementNS(SVG_NS,tag);
 for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));
 if(content!=null)e.textContent=content;return e;
}
function svgBase(label){
 const svg=svgEl('svg',{viewBox:'0 0 680 180',preserveAspectRatio:'xMidYMid meet',role:'img','aria-label':label});
 svg.append(svgEl('title',{},label));return svg;
}
function lineChart(rows){
 const data=rows.map(r=>r.nav),min=Math.min(...data),max=Math.max(...data),span=Math.max(1,max-min),left=16,right=662,top=16,bottom=157;
 const x=i=>left+(right-left)*i/(data.length-1);
 const y=v=>bottom-(bottom-top)*(v-min)/span;
 const svg=svgBase('날짜별 4계좌 순자산 추이, 시작 '+money(data[0])+', 종료 '+money(data[data.length-1]));
 svg.append(svgEl('line',{x1:left,y1:bottom,x2:right,y2:bottom,stroke:'#d7e0eb','stroke-width':1}));
 const p=data.map((v,i)=>x(i).toFixed(1)+','+y(v).toFixed(1)).join(' ');
 svg.append(svgEl('polyline',{points:p,fill:'none',stroke:'#3272be','stroke-width':3,'stroke-linejoin':'round','stroke-linecap':'round'}));
 for(const i of [0,data.length-1])svg.append(svgEl('circle',{cx:x(i),cy:y(data[i]),r:4,fill:'#3272be'}));
 svg.append(svgEl('text',{x:left,y:175,fill:'#52657a','font-size':12},rows[0].date));
 svg.append(svgEl('text',{x:right,y:175,fill:'#52657a','font-size':12,'text-anchor':'end'},rows[rows.length-1].date));
 return svg;
}
function dailyChart(rows){
 const svg=svgBase('날짜별 투자손익 막대, 순입출금 제외');
 const limit=Math.max(1,...rows.map(r=>Math.abs(r.pnl))),baseline=89,left=16,right=662;
 svg.append(svgEl('line',{x1:left,y1:baseline,x2:right,y2:baseline,stroke:'#64748b','stroke-width':1}));
 const step=(right-left)/rows.length,width=Math.max(1,Math.min(step*.66,36));
 rows.forEach((row,i)=>{
  const h=75*Math.abs(row.pnl)/limit,x=left+i*step+(step-width)/2;
  svg.append(svgEl('rect',{x:x.toFixed(1),y:(row.pnl>=0?baseline-h:baseline).toFixed(1),width:width.toFixed(1),height:Math.max(.75,h).toFixed(1),rx:2,fill:row.pnl>=0?'#bb3643':'#326fb4'}));
 });
 svg.append(svgEl('text',{x:left,y:175,fill:'#52657a','font-size':12},rows[0].date));
 svg.append(svgEl('text',{x:right,y:175,fill:'#52657a','font-size':12,'text-anchor':'end'},rows[rows.length-1].date));
 return svg;
}
function contributionChart(pairs){
 const svg=svgBase('검증된 자산군별 기간 투자손익 기여');
 const top=16,left=180,right=658,max=Math.max(1,...pairs.map(([,v])=>Math.abs(v)));
 pairs.slice(0,6).forEach(([key,v],i)=>{
  const y=top+i*26,width=(right-left)*Math.abs(v)/max;
  svg.append(svgEl('text',{x:8,y:y+15,'font-size':12,fill:'#344054'},key.replaceAll('_',' ').slice(0,23)));
  svg.append(svgEl('rect',{x:left,y,width:width.toFixed(1),height:15,rx:3,fill:v>=0?'#bb3643':'#326fb4'}));
 });
 return svg;
}
function panel(title,subtitle){
 const section=document.createElement('section');section.className='ctPerfHistoryCard';
 const header=document.createElement('div');header.className='ctPerfHistoryCardHead';
 const h=document.createElement('h3');h.textContent=title;
 const cap=document.createElement('small');cap.textContent=subtitle;
 header.append(h,cap);section.append(header);return section;
}
function waiting(card,reason){
 card.dataset.ctVerification='PENDING';
 const note=document.createElement('p');note.className='ctPerfHistoryPending';note.textContent='검증 대기 · '+reason;
 card.append(note);
}
function render(){
 if(root.__JJOONI_CT_HUMAN_V2?.mode!=='v2')return;
 const host=document.querySelector('#panel-compare');if(!host)return;
 let container=document.getElementById('ctVerifiedPerformanceHistoryV1');
 if(!container){
  container=document.createElement('section');container.id='ctVerifiedPerformanceHistoryV1';
  container.setAttribute('aria-label','검증된 투자성과 3종 그래프');
  host.append(container);
 }
 const live=root.__JJOONI_LIVE_PAYLOAD||{},canonical=root.__JJOONI_CANONICAL_SSOT||{};
 const history=live.performance_history;
 const report=audit(history,{live,canonical});
 root.__JJOONI_PERFORMANCE_HISTORY_AUDIT={version:'1.0',state:report.ok?(report.contributionOk?'VERIFIED_3_OF_3':'VERIFIED_2_OF_3'):'WAITING',reason:report.ok?report.contributionReason:report.reason,points:report.rows.length};
 const signature=[live.snapshot_id,canonical.snapshot_id,live?.source_health?.pb_history?.state,history?.verified_at_kst,history?.status,report.ok,report.reason,report.rows.length,report.contributionOk,report.failed_date,JSON.stringify(report.ok?report.rows.map(r=>[r.date,r.nav,r.pnl,r.flow,r.raw.asset_class_contributions_krw]):[])].join('|');
 if(container.dataset.signature===signature)return;container.dataset.signature=signature;
 container.replaceChildren();
 const top=document.createElement('header');top.className='ctPerfHistoryHeader';
 const h=document.createElement('h2');h.textContent='검증된 투자성과 · 3종 그래프';
 const note=document.createElement('p');note.textContent='실제 4계좌 성과 원장만 사용 · 순자산 증감에서 순입출금 분리 · TRI-POD 중복 합산 제외';
 top.append(h,note);container.append(top);
 const tiles=[
  panel('① 일별 순자산','4계좌 합계 NAV · 원 단위'),
  panel('② 일별 투자손익','입출금 제외 · 원 단위'),
  panel('③ 자산군별 수익 기여','서로 중복 없는 자산군 분류 필요')
 ];
 if(!report.ok){
  // One actionable provenance state, not three tall empty "graphs".
  const state=document.createElement('section');state.className='ctPerfHistoryUnavailable';
  state.dataset.ctVerification='BLOCKED';
  const heading=document.createElement('h3');heading.textContent='투자성과 3종 그래프 · 원장 검증 전 미표시';
  const why=document.createElement('p');why.textContent='현재 차단 사유: '+report.reason;
  const explain=document.createElement('p');explain.textContent='정확한 일별 투자손익을 계산하려면 증권사 공식 마감 NAV와 4계좌 외부 입출금 증빙을 같은 날짜로 대사해야 합니다. 현재 잔액 변화나 참고 NAV를 수익률로 대체하지 않습니다.';
  const pending=document.createElement('p');pending.className='ctPerfHistoryNeeds';
  pending.textContent='대기 중: ① 공식 일별 순자산 ② 입출금 차감 후 투자손익 ③ 중복 없는 자산군 수익 기여도';
  state.append(heading,why,explain,pending);
  const ref=document.querySelector('#ctReferenceNavHistoryV1');
  if(ref){
   const go=document.createElement('button');go.type='button';
   go.textContent='관측 NAV 그래프 보기 · 참고용';
   go.addEventListener('click',()=>ref.scrollIntoView({block:'start',behavior:'smooth'}));
   state.append(go);
  }
  container.append(state);
  return;
 }
 {
  const a=document.createElement('p');a.className='ctPerfHistorySource';a.textContent='검증 이력 '+report.rows.length+'일 · '+report.rows[0].date+'~'+report.rows[report.rows.length-1].date+' · 검증시각 '+report.source_at;
  top.append(a);
  tiles[0].append(lineChart(report.rows));
  tiles[0].dataset.ctVerification='VERIFIED';
  const end=report.rows[report.rows.length-1],first=report.rows[0];
  const detail=document.createElement('p');detail.textContent='시작 '+money(first.nav)+' → 마지막 '+money(end.nav)+' · 순자산 변화 '+sign(end.nav-first.nav);
  tiles[0].append(detail);
  tiles[1].append(dailyChart(report.rows));tiles[1].dataset.ctVerification='VERIFIED';
  const pnlSum=report.rows.reduce((s,r)=>s+r.pnl,0);
  const pnlText=document.createElement('p');pnlText.textContent='표시 기간 일별 손익 합계 '+sign(pnlSum)+' · 첫 기록의 전일 기준은 이력 시작 전일';
  tiles[1].append(pnlText);
  if(report.contributionOk){
   tiles[2].dataset.ctVerification='VERIFIED';
   tiles[2].append(contributionChart(report.contributions));
   const table=document.createElement('ul');
   table.className='ctPerfContributionList';
   for(const [key,value]of report.contributions){
    const li=document.createElement('li');const label=document.createElement('span');label.textContent=key.replaceAll('_',' ');
    const val=document.createElement('strong');val.textContent=sign(value);
    li.append(label,val);table.append(li);
   }
   tiles[2].append(table);
  }else waiting(tiles[2],report.contributionReason);
  const d=document.createElement('details');d.className='ctPerfHistoryDetail';
  const s=document.createElement('summary');s.textContent='일별 원장 대사 내역 보기';d.append(s);
  const wrap=document.createElement('div');wrap.className='ctPerfHistoryTableScroll';
  const t=document.createElement('table');const head=document.createElement('thead');const tr=document.createElement('tr');
  for(const label of ['일자','NAV','투자손익','순입출금']){const th=document.createElement('th');th.textContent=label;tr.append(th)}
  head.append(tr);t.append(head);const body=document.createElement('tbody');
  for(const r of report.rows){const line=document.createElement('tr');for(const val of [r.date,money(r.nav),sign(r.pnl),sign(r.flow)]){const td=document.createElement('td');td.textContent=val;line.append(td)}body.append(line)}
  t.append(body);wrap.append(t);d.append(wrap);container.append(d);
 }
 const grid=document.createElement('div');grid.className='ctPerfHistoryGrid';
 for(const tile of tiles)grid.append(tile);
 container.insertBefore(grid,container.querySelector('.ctPerfHistoryDetail'));
}
let queued=false;
function schedule(){if(queued)return;queued=true;setTimeout(()=>{queued=false;render()},70)}
if(typeof document!=='undefined'){
 const boot=()=>{
  if(!document.getElementById('ctPerfHistoryStylesheet')){
   const link=document.createElement('link');link.id='ctPerfHistoryStylesheet';link.rel='stylesheet';
   link.href='ct-performance-history-v1.css?v=2';(document.head||document.documentElement).append(link);
  }
  render();
 };
 document.addEventListener('jjooni:live-applied',schedule);
 document.addEventListener('click',e=>{if(e.target.closest?.('.tab[data-tab],#ctHumanBottomV2,#ctHumanV2More'))schedule()});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});
 setTimeout(boot,0);setTimeout(boot,900);setTimeout(boot,2300);
}
const api={schema:SCHEMA,audit,render};root.JjooniVerifiedHistory=api;
if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window==='object'?window:globalThis);
