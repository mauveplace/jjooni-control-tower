(()=>{
'use strict';
const ITEMS=[
  {k:'KOSPI',label:'KOSPI',kind:'pct',digits:2,group:'한국'},
  {k:'KOSDAQ',label:'KOSDAQ',kind:'pct',digits:2,group:'한국'},
  {k:'RUSSELL2000',label:'Russell 2000',kind:'pct',digits:2,group:'미국'},
  {k:'DOW',label:'Dow',kind:'pct',digits:2,group:'미국'},
  {k:'SP500',label:'S&P 500',kind:'pct',digits:2,group:'미국'},
  {k:'NASDAQCOMPOSITE',label:'NASDAQ 종합',kind:'pct',digits:2,group:'미국'},
  {k:'NASDAQ100',label:'NASDAQ 100',kind:'pct',digits:2,group:'미국'},
  {k:'VIX',label:'VIX',kind:'pct',digits:2,group:'위험'},
  {k:'FEAR_GREED',label:'Fear & Greed',kind:'pts',digits:0,suffix:'/100',group:'심리'},
  {k:'USDKRW',label:'USD/KRW',kind:'pct',digits:2,group:'환율'},
  {k:'USDJPY',label:'USD/JPY',kind:'pct',digits:2,group:'환율'},
  {k:'JPYKRW',label:'JPY/KRW',kind:'pct',digits:3,group:'환율'},
  {k:'DXY',label:'DXY',kind:'pct',digits:2,group:'환율'},
  {k:'US2Y',label:'미국 2Y',kind:'bp',digits:3,suffix:'%',group:'금리'},
  {k:'US10Y_OFFICIAL',fallback:'US10Y',label:'미국 10Y',kind:'bp',digits:3,suffix:'%',group:'금리'},
  {k:'US30Y_OFFICIAL',fallback:'US30Y',label:'미국 30Y',kind:'bp',digits:3,suffix:'%',group:'금리'},
  {k:'KR3Y',label:'한국 3Y',kind:'bp',digits:3,suffix:'%',group:'금리'},
  {k:'KR10Y',label:'한국 10Y',kind:'bp',digits:3,suffix:'%',group:'금리'},
  {k:'JP2Y',label:'일본 2Y',kind:'bp',digits:3,suffix:'%',group:'금리'},
  {k:'JP10Y',label:'일본 10Y',kind:'bp',digits:3,suffix:'%',group:'금리'},
  {k:'US_2S10S',label:'US 2s10s',kind:'bp',digits:3,suffix:'%',group:'스프레드'},
  {k:'KR_3S10S',label:'KR 3s10s',kind:'bp',digits:3,suffix:'%',group:'스프레드'},
  {k:'JP_2S10S',label:'JP 2s10s',kind:'bp',digits:3,suffix:'%',group:'스프레드'},
  {k:'WTI',label:'WTI',kind:'pct',digits:2,prefix:'$',group:'에너지'},
  {k:'BRENT',label:'Brent',kind:'pct',digits:2,prefix:'$',group:'에너지'},
  {k:'NATGAS',label:'Natural Gas',kind:'pct',digits:3,prefix:'$',group:'에너지'},
  {k:'GOLD',label:'Gold',kind:'pct',digits:1,prefix:'$',group:'금속'},
  {k:'SILVER',label:'Silver',kind:'pct',digits:2,prefix:'$',group:'금속'},
  {k:'COPPER',label:'Copper',kind:'pct',digits:3,prefix:'$',group:'금속'}
];
const BY_KEY=Object.fromEntries(ITEMS.map(x=>[x.k,x]));
const INDEX_KEYS=['KOSPI','KOSDAQ','SP500','NASDAQCOMPOSITE','NASDAQ100','DOW','RUSSELL2000'];
const OVERVIEW_GROUPS=[
  {key:'indices',label:'주요 지수',sub:'완료 세션 종가 · 미국지수 소수점 2자리',keys:INDEX_KEYS},
  {key:'risk',label:'위험·심리',sub:'변동성과 투자심리',keys:['VIX','FEAR_GREED']},
  {key:'rates',label:'금리·스프레드',sub:'미국 UST · 한국 ECOS · 일본 MOF 공식 일별 기준',keys:['US2Y','US10Y_OFFICIAL','US30Y_OFFICIAL','KR3Y','KR10Y','JP2Y','JP10Y','US_2S10S','KR_3S10S','JP_2S10S']},
  {key:'fx',label:'환율',sub:'Yahoo daily close · 제공사 cutoff에 따라 시점차 가능',keys:['USDKRW','USDJPY','JPYKRW','DXY']},
  {key:'commodity',label:'원자재',sub:'Yahoo 연속선물 daily close · 거래소 settlement/월물과 다를 수 있음',keys:['WTI','BRENT','NATGAS','GOLD','SILVER','COPPER']}
];
const COMPARES={
  D1:{label:'전일',mode:'prev'},
  W1:{label:'전주',days:7},
  M1:{label:'전월',months:1},
  M2:{label:'2개월 전',months:2},
  Y1:{label:'전년',years:1}
};
let compareKey='D1';
const TAB_CONFIG={
  overview:{title:'시장 한눈에 보기',sub:'지표를 성격별로 묶어 필요한 영역만 빠르게 확인',groups:OVERVIEW_GROUPS},
  indices:{title:'주요 지수',sub:'완료 세션 종가 · 미국 주요 지수는 소수점 둘째 자리까지 표시',keys:INDEX_KEYS},
  rates:{title:'금리 주요 지표',sub:'미국=US Treasury · 한국=BOK ECOS · 일본=MOF 공식 일별 기준',keys:['US2Y','US10Y_OFFICIAL','US30Y_OFFICIAL','KR3Y','KR10Y','JP2Y','JP10Y','US_2S10S','KR_3S10S','JP_2S10S']},
  fx:{title:'환율 주요 지표',sub:'Yahoo daily close · 다른 제공사의 마감 cutoff와 소폭 차이 가능',keys:['USDKRW','USDJPY','JPYKRW','DXY']},
  energy:{title:'원자재 주요 지표',sub:'Yahoo 연속선물 daily close · 거래소 settlement/특정 월물과 직접 동일값 아님',keys:['WTI','BRENT','NATGAS','GOLD','SILVER','COPPER']},
  sectors:{title:'섹터·ETF 주요 지표',sub:'송팀장 Sector Observatory의 상대강도·breadth·rotation 요약',special:'sector'},
  tripod:{title:'TRI-POD 주요 입력',sub:'NASDAQ-100 레짐·VIX10·Drawdown·현재 목표노출',special:'tripod'},
  calendar:{title:'경제일정 주요 지표',sub:'오늘·향후 7일·다음 중요 이벤트 중심',special:'calendar'}
};
const fmt=(v,d)=>v==null||!Number.isFinite(Number(v))?'—':Number(v).toLocaleString('ko-KR',{minimumFractionDigits:d,maximumFractionDigits:d});
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const num=v=>{const x=Number(v);return Number.isFinite(x)?x:null};
function seriesOf(item){if(typeof DATA==='undefined'||!DATA?.series)return[];const a=DATA.series[item.k]||[];if(a.length)return a;return item.fallback?(DATA.series[item.fallback]||[]):[]}
function utcDate(s){const d=new Date(String(s||'').slice(0,10)+'T00:00:00Z');return Number.isNaN(d.getTime())?null:d}
function refPoint(s,last,key){if(s.length<2)return null;const cfg=COMPARES[key]||COMPARES.D1;if(cfg.mode==='prev')return s[s.length-2]||null;const d=utcDate(last?.date);if(!d)return s[s.length-2]||null;if(cfg.days)d.setUTCDate(d.getUTCDate()-cfg.days);if(cfg.months)d.setUTCMonth(d.getUTCMonth()-cfg.months);if(cfg.years)d.setUTCFullYear(d.getUTCFullYear()-cfg.years);const target=d.toISOString().slice(0,10);for(let i=s.length-2;i>=0;i--){if(String(s[i]?.date||'')<=target)return s[i]}return null}
function stat(item,key=compareKey){const s=seriesOf(item),last=s[s.length-1];if(!last)return null;const ref=refPoint(s,last,key);let ch=null;if(ref&&Number.isFinite(Number(ref.value))&&Number.isFinite(Number(last.value))){ch=item.kind==='bp'?(Number(last.value)-Number(ref.value))*100:item.kind==='pts'?(Number(last.value)-Number(ref.value)):(Number(ref.value)!==0?(Number(last.value)/Number(ref.value)-1)*100:null)}return{value:Number(last.value),date:last.date,change:ch,refDate:ref?.date||null,refValue:ref?Number(ref.value):null}}
function arrow(v){return v==null?'':v>0?'▲':v<0?'▼':'■'}
function cls(v){return v==null?'flat':v>0?'up':v<0?'down':'flat'}
function changeText(item,v){const label=COMPARES[compareKey]?.label||'비교';if(v==null||!Number.isFinite(v))return `${label} 대비 —`;if(item.kind==='bp')return `${label} ${arrow(v)} ${Math.abs(v).toFixed(1)}bp`;if(item.kind==='pts')return `${label} ${arrow(v)} ${Math.abs(v).toFixed(1)}pt`;return `${label} ${arrow(v)} ${Math.abs(v).toFixed(2)}%`}
function activeTab(){return document.querySelector('#tabs button.on[data-tab]')?.dataset.tab||'overview'}
function ensureIndexShell(){const tabs=document.getElementById('tabs'),main=document.querySelector('main.wrap');if(!tabs||!main)return false;let tab=tabs.querySelector('button[data-tab="indices"]');if(!tab){tab=document.createElement('button');tab.type='button';tab.dataset.tab='indices';tab.textContent='주요 지수';const ref=tabs.querySelector('button[data-tab="rates"]');if(ref)tabs.insertBefore(tab,ref);else tabs.appendChild(tab)}let panel=document.getElementById('indices');if(!panel){panel=document.createElement('section');panel.className='panel';panel.id='indices';panel.innerHTML='<div class="grid obsIndexGrid"><div class="card"><h3>한국 주요 지수</h3><div class="meta">KOSPI · KOSDAQ</div><div class="chart"><canvas id="krIndexChart"></canvas></div></div><div class="card"><h3>미국 대표 지수</h3><div class="meta">S&P 500 · Dow · Russell 2000</div><div class="chart"><canvas id="usBroadIndexChart"></canvas></div></div><div class="card"><h3>미국 기술주 지수</h3><div class="meta">NASDAQ 종합 · NASDAQ 100</div><div class="chart"><canvas id="usTechIndexChart"></canvas></div></div></div>';const ref=main.querySelector('#rates');if(ref)main.insertBefore(panel,ref);else main.appendChild(panel)}return true}
function ensure(){ensureIndexShell();let host=document.getElementById('latestMarketBoard');if(host)return host;const nav=document.getElementById('tabs');if(!nav)return null;host=document.createElement('section');host.id='latestMarketBoard';host.className='latestBoardWrap';host.innerHTML='<div class="latestBoardHead"><div class="latestBoardTitleBox"><b id="latestBoardTitle">주요 지표</b><span id="latestBoardSub"></span></div><div class="latestBoardTools"><div id="latestCompare" class="latestCompare" aria-label="비교 기준"></div><span id="latestBoardGenerated"></span></div></div><div id="latestBoardGrid" class="latestBoardGrid"></div>';nav.insertAdjacentElement('afterend',host);return host}
function standardTile(item){const s=stat(item);const val=s?`${item.prefix||''}${fmt(s.value,item.digits)}${item.suffix||''}`:'—';const ch=s?changeText(item,s.change):`${COMPARES[compareKey]?.label||'비교'} 대비 —`;const dates=s?.refDate?`${String(s.date).slice(5)} ↔ ${String(s.refDate).slice(5)}`:(s?.date||'—');return `<div class="latestTile"><div class="latestTileTop"><span>${esc(item.group)}</span><b>${esc(item.label)}</b></div><strong>${esc(val)}</strong><div class="latestTileFoot"><span class="${cls(s?.change)}">${esc(ch)}</span><time>${esc(dates)}</time></div></div>`}
function customTile(group,label,value,foot='',tone='flat',time=''){return `<div class="latestTile"><div class="latestTileTop"><span>${esc(group)}</span><b>${esc(label)}</b></div><strong class="${esc(tone)}">${esc(value)}</strong><div class="latestTileFoot"><span class="${esc(tone)}">${esc(foot||'')}</span><time>${esc(time||'')}</time></div></div>`}
function dataGenerated(){return String((typeof DATA!=='undefined'&&DATA?.generated_kst)||'').replace('T',' ').slice(0,16)}
function renderCompare(show=true){const host=ensure(),box=host?.querySelector('#latestCompare');if(!box)return;box.style.display=show?'flex':'none';if(!show)return;box.innerHTML=Object.entries(COMPARES).map(([k,v])=>`<button type="button" data-compare="${k}" class="${k===compareKey?'on':''}">${esc(v.label)}</button>`).join('');box.querySelectorAll('button[data-compare]').forEach(b=>b.onclick=()=>{compareKey=b.dataset.compare;renderBoard()})}
function setHeader(title,sub,generated,showCompare=true){const host=ensure();if(!host)return;const t=host.querySelector('#latestBoardTitle'),s=host.querySelector('#latestBoardSub'),g=host.querySelector('#latestBoardGenerated');if(t)t.textContent=title;if(s)s.textContent=sub;if(g)g.textContent=generated?`수집 ${generated} KST`:'';renderCompare(showCompare)}
function setGrid(html,count,grouped=false){const host=ensure();if(!host)return;host.dataset.tab=activeTab();const grid=host.querySelector('#latestBoardGrid');grid.classList.toggle('grouped',grouped);grid.innerHTML=html;grid.style.gridTemplateColumns=grouped?'1fr':(count>0&&count<=5?`repeat(${count},minmax(0,1fr))`:'')}
function groupHtml(g){const items=(g.keys||[]).map(k=>BY_KEY[k]).filter(Boolean);return `<section class="latestGroup latestGroup-${esc(g.key)}"><div class="latestGroupHead"><div><b>${esc(g.label)}</b><span>${esc(g.sub||'')}</span></div><em>${items.length}개</em></div><div class="latestGroupGrid">${items.map(standardTile).join('')}</div></section>`}
function pulseChips(items){const p=document.getElementById('pulse');if(!p)return;p.innerHTML=items.map(x=>`<span class="chip">${esc(x)}</span>`).join('')}
function renderStandard(tab,cfg){setHeader(cfg.title,cfg.sub,dataGenerated(),true);if(cfg.groups){setGrid(cfg.groups.map(groupHtml).join(''),cfg.groups.length,true)}else{const items=(cfg.keys||[]).map(k=>BY_KEY[k]).filter(Boolean);setGrid(items.map(standardTile).join(''),items.length,false)}const pulseKeys=tab==='overview'?['SP500','NASDAQ100','KOSPI','US10Y_OFFICIAL','USDKRW','VIX','WTI']:(cfg.keys||[]).slice(0,7);pulseChips(pulseKeys.map(k=>{const i=BY_KEY[k],s=i?stat(i):null;return `${i?.label||k} ${s?`${i?.prefix||''}${fmt(s.value,i?.digits??2)}${i?.suffix||''}`:'—'}`}))}
function rowsFor(keys){const map=new Map();if(typeof DATA==='undefined'||!DATA?.series)return[];for(const k of keys){const item=BY_KEY[k];for(const p of seriesOf(item||{k})){if(!p?.date)continue;if(!map.has(p.date))map.set(p.date,{date:p.date});map.get(p.date)[k]=p.value}}return[...map.values()].sort((a,b)=>String(a.date).localeCompare(String(b.date)))}
function renderIndexPanel(){if(activeTab()!=='indices'||typeof window.chart!=='function')return;const kr=rowsFor(['KOSPI','KOSDAQ']),broad=rowsFor(['SP500','DOW','RUSSELL2000']),tech=rowsFor(['NASDAQCOMPOSITE','NASDAQ100']);window.chart('krIndexChart',kr.map(x=>x.date),[{label:'KOSPI',data:kr.map(x=>x.KOSPI)},{label:'KOSDAQ',data:kr.map(x=>x.KOSDAQ)}]);window.chart('usBroadIndexChart',broad.map(x=>x.date),[{label:'S&P 500',data:broad.map(x=>x.SP500)},{label:'Dow',data:broad.map(x=>x.DOW)},{label:'Russell 2000',data:broad.map(x=>x.RUSSELL2000)}]);window.chart('usTechIndexChart',tech.map(x=>x.date),[{label:'NASDAQ 종합',data:tech.map(x=>x.NASDAQCOMPOSITE)},{label:'NASDAQ 100',data:tech.map(x=>x.NASDAQ100)}])}
let SECTOR_DATA=null,SECTOR_PROMISE=null;
function loadSector(){if(SECTOR_DATA)return Promise.resolve(SECTOR_DATA);if(SECTOR_PROMISE)return SECTOR_PROMISE;SECTOR_PROMISE=fetch('./data/sector-etf.json?cb='+Date.now(),{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('sector-etf '+r.status);return r.json()}).then(d=>{if(d?.schema!=='JJOONI_OBSERVATORY_SECTOR_ETF_V1')throw new Error('sector schema');SECTOR_DATA=d;return d}).finally(()=>{SECTOR_PROMISE=null});return SECTOR_PROMISE}
function renderSector(){const d=SECTOR_DATA;if(!d){setHeader(TAB_CONFIG.sectors.title,TAB_CONFIG.sectors.sub,'',false);setGrid(customTile('SECTOR','데이터','불러오는 중','sector-etf lazy load'),1);pulseChips(['Sector ETF 로딩중']);loadSector().then(()=>{if(activeTab()==='sectors')renderSector()}).catch(()=>{if(activeTab()==='sectors'){setGrid(customTile('SECTOR','데이터','로딩 실패','다음 갱신 후 재시도','down'),1);pulseChips(['Sector ETF 로딩 실패'])}});return}
 const s=d.summary||{},lead=s.leaders_1m_rs_spy?.[0],lag=s.laggards_1m_rs_spy?.[0],spread=num(s.growth_defense_spread_1m_pct),spy=d.benchmarks?.SPY,qqq=d.benchmarks?.QQQ;
 const base=[
  customTile('BREADTH','MA20 상회',`${s.classic_above_ma20??'—'} / ${s.classic_count??11}`,'S&P 500 11개 섹터','flat',d.as_of_date||''),
  customTile('LEADER','1M RS 강세',lead?`${lead.ticker} ${lead.value>=0?'+':''}${Number(lead.value).toFixed(2)}%`:'—','vs SPY','up',d.as_of_date||''),
  customTile('LAGGARD','1M RS 약세',lag?`${lag.ticker} ${Number(lag.value).toFixed(2)}%`:'—','vs SPY','down',d.as_of_date||''),
  customTile('ROTATION','성장-방어',spread==null?'—':`${spread>=0?'+':''}${spread.toFixed(2)}%`,'1M spread',cls(spread),d.as_of_date||''),
  customTile('BENCH','SPY 1M',spy?.ret_1m_pct==null?'—':`${spy.ret_1m_pct>=0?'+':''}${Number(spy.ret_1m_pct).toFixed(2)}%`,'benchmark',cls(spy?.ret_1m_pct),d.as_of_date||''),
  customTile('BENCH','QQQ 1M',qqq?.ret_1m_pct==null?'—':`${qqq.ret_1m_pct>=0?'+':''}${Number(qqq.ret_1m_pct).toFixed(2)}%`,'benchmark',cls(qqq?.ret_1m_pct),d.as_of_date||'')
 ];
 const themes=(d.groups||[]).filter(g=>g.key!=='classic').map(g=>{
   const members=g.rows||[];
   const best=members.map(r=>({ticker:r.ticker,rs:num(r.rs_spy_20d_pct),ret:num(r.ret_20d_pct)})).sort((a,b)=>(b.rs??-999)-(a.rs??-999))[0];
   const value=best?`${best.ticker} ${best.ret==null?'':(best.ret>=0?'+':'')+best.ret.toFixed(1)+'%'}`:'—';
   return customTile('THEME',g.label||g.key,value,`${members.map(r=>r.ticker).join(' · ')} · 상세 아래`,cls(best?.ret),d.as_of_date||'');
 });
 const rows=[...base,...themes];
 setHeader(TAB_CONFIG.sectors.title,'S&P 500 11개 섹터 + 추가 테마·업종 ETF 전체 표시',String(d.generated_kst||'').replace('T',' ').slice(0,16),false);setGrid(rows.join(''),rows.length);pulseChips([`MA20 ${s.classic_above_ma20??'—'}/${s.classic_count??11}`,...((d.groups||[]).filter(g=>g.key!=='classic').map(g=>g.label||g.key))])}
function renderTripod(){const t=(typeof DATA!=='undefined'&&DATA?.tripod_latest)||{},ndx=stat(BY_KEY.NASDAQ100),vix=stat(BY_KEY.VIX),ma=num(t.ma250),v10=num(t.vix10),dd=num(t.drawdown_52w_pct);const rows=[
 customTile('REGIME','현재 상태',t.regime||'—','NASDAQ100 vs MA250'),
 customTile('TARGET','목표 노출',t.target||'—','송팀장 Tri-Pod'),
 customTile('INDEX','NASDAQ 100',ndx?fmt(ndx.value,2):'—',ndx?changeText(BY_KEY.NASDAQ100,ndx.change):'전일 대비 —',cls(ndx?.change),ndx?.date||''),
 customTile('TREND','MA250',ma==null?'—':fmt(ma,0),'레짐 기준선','flat',t.date||''),
 customTile('RISK','VIX / VIX10',`${vix?fmt(vix.value,2):'—'} / ${v10==null?'—':fmt(v10,2)}`,'현재 / 10일 평균',cls(vix?.change),vix?.date||''),
 customTile('DRAWDOWN','52주 고점대비',dd==null?'—':`${dd.toFixed(2)}%`,'낙폭',dd<-9?'down':'flat',t.date||'')
 ];setHeader(TAB_CONFIG.tripod.title,TAB_CONFIG.tripod.sub,dataGenerated(),false);setGrid(rows.join(''),rows.length);pulseChips([`Regime ${t.regime||'—'}`,`Target ${t.target||'—'}`,`VIX10 ${v10==null?'—':fmt(v10,2)}`,`DD ${dd==null?'—':dd.toFixed(2)+'%'}`])}
function kstDay(d=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(d)}
function renderCalendarSummary(){if(typeof CAL==='undefined'||!CAL){setHeader(TAB_CONFIG.calendar.title,TAB_CONFIG.calendar.sub,'',false);setGrid(customTile('CALENDAR','일정','불러오는 중','economic-calendar lazy load'),1);pulseChips(['경제일정 로딩중']);return}
 const now=Date.now(),today=kstDay(),weekEnd=now+7*86400000,events=(CAL.events||[]).map(e=>({...e,_ts:Date.parse(e.datetime_kst||e.date||'')})).filter(e=>Number.isFinite(e._ts));const todayEvents=events.filter(e=>String(e.datetime_kst||e.date||'').startsWith(today));const upcoming=events.filter(e=>e._ts>=now).sort((a,b)=>a._ts-b._ts);const week=upcoming.filter(e=>e._ts<=weekEnd),weekHigh=week.filter(e=>(e.importance||0)>=3),next=upcoming[0],major=upcoming.find(e=>(e.importance||0)>=3);const time=e=>e?new Date(e._ts).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}):'—';const rows=[
 customTile('TODAY','오늘 일정',`${todayEvents.length}건`,'KST 기준','flat',today),
 customTile('7D','향후 7일',`${week.length}건`,`★★★ ${weekHigh.length}건`),
 customTile('NEXT','다음 일정',next?.title||'예정 없음',next?`${next.country||''} · ${next.category||''}`:'','flat',time(next)),
 customTile('MAJOR','다음 ★★★',major?.title||'예정 없음',major?`${major.country||''} · ${major.category||''}`:'','flat',time(major))
 ];setHeader(TAB_CONFIG.calendar.title,TAB_CONFIG.calendar.sub,String(CAL.generated_kst||'').replace('T',' ').slice(0,16),false);setGrid(rows.join(''),rows.length);pulseChips([`오늘 ${todayEvents.length}건`,`7일 ${week.length}건`,`★★★ ${weekHigh.length}건`,major?`다음 ★★★ ${time(major)}`:'다음 ★★★ —'])}
function renderBoard(){const host=ensure();if(!host||typeof DATA==='undefined'||!DATA)return false;const tab=activeTab(),cfg=TAB_CONFIG[tab]||TAB_CONFIG.overview;if(cfg.special==='sector')renderSector();else if(cfg.special==='tripod')renderTripod();else if(cfg.special==='calendar')renderCalendarSummary();else renderStandard(tab,cfg);if(tab==='indices')setTimeout(renderIndexPanel,0);return true}
function hookRender(){const base=window.render;if(typeof base!=='function'||base.__latestBoardHooked)return false;const w=function(){const r=base.apply(this,arguments);setTimeout(renderBoard,0);return r};w.__latestBoardHooked=true;window.render=w;return true}
function hookCalendar(){const base=window.renderCalendar;if(typeof base!=='function'||base.__latestBoardCalendarHooked)return false;const w=function(){const r=base.apply(this,arguments);if(activeTab()==='calendar')setTimeout(renderBoard,0);return r};w.__latestBoardCalendarHooked=true;window.renderCalendar=w;return true}
function ensureOfficialMacroRuntime(){
  if(window.__JJOONI_OFFICIAL_MACRO_V1)return true;
  if(document.querySelector('script[data-official-macro-runtime]'))return false;
  const s=document.createElement('script');s.dataset.officialMacroRuntime='1';s.src='./official-macro-v1.js?fallback='+Date.now();document.body.appendChild(s);return false
}
function bindTabs(){const tabs=document.getElementById('tabs');if(!tabs||tabs.dataset.latestBoardBound)return false;tabs.dataset.latestBoardBound='1';tabs.addEventListener('click',e=>{const b=e.target.closest('button[data-tab]');if(!b)return;[0,120,350,900].forEach(ms=>setTimeout(()=>{renderBoard();if(b.dataset.tab==='indices')renderIndexPanel()},ms))});return true}
const st=document.createElement('style');st.textContent=`
.latestBoardWrap{max-width:1180px;margin:12px auto 0;padding:0 14px}.latestBoardHead{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:9px}.latestBoardTitleBox{display:flex;align-items:baseline;gap:8px;min-width:0}.latestBoardTitleBox b{font-size:14px}.latestBoardTitleBox span{font-size:9px;color:#718096}.latestBoardTools{display:flex;align-items:center;justify-content:flex-end;gap:9px;min-width:0}.latestBoardTools>span{font-size:9px;color:#718096;white-space:nowrap}.latestCompare{display:flex;align-items:center;gap:4px;flex-wrap:wrap}.latestCompare:before{content:'비교';font-size:8px;font-weight:900;color:#98a2b3;margin-right:2px}.latestCompare button{border:1px solid #d9e1ea;background:#fff;color:#526071;border-radius:8px;padding:5px 7px;font-size:9px;font-weight:850;white-space:nowrap;cursor:pointer}.latestCompare button.on{background:#0b3b70;color:#fff;border-color:#0b3b70}.latestBoardGrid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px}.latestBoardGrid.grouped{display:block}.latestGroup{background:#ffffff80;border:1px solid #e5ebf2;border-radius:15px;padding:10px;margin-bottom:10px}.latestGroup:last-child{margin-bottom:0}.latestGroupHead{display:flex;align-items:flex-end;justify-content:space-between;gap:8px;margin-bottom:7px}.latestGroupHead>div{display:flex;align-items:baseline;gap:7px;min-width:0}.latestGroupHead b{font-size:12px;color:#1d2b3d}.latestGroupHead span{font-size:8px;color:#8794a5}.latestGroupHead em{font-size:8px;color:#98a2b3;font-style:normal;white-space:nowrap}.latestGroupGrid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px}.latestTile{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:9px 10px;min-width:0;box-shadow:0 4px 14px #10233d08}.latestTileTop{display:flex;align-items:center;gap:5px;min-width:0}.latestTileTop span{flex:0 0 auto;font-size:8px;font-weight:900;color:#667085;background:#f2f4f7;border-radius:999px;padding:2px 5px}.latestTileTop b{font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.latestTile strong{display:block;margin-top:5px;font-size:18px;line-height:1.05;letter-spacing:-.02em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.latestTile strong.up{color:#d92d20}.latestTile strong.down{color:#175cd3}.latestTileFoot{display:flex;justify-content:space-between;align-items:flex-end;gap:5px;margin-top:5px;font-size:8px;color:#7d8b9d}.latestTileFoot span{font-weight:850;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.latestTileFoot .up{color:#d92d20}.latestTileFoot .down{color:#175cd3}.latestTileFoot .flat{color:#667085}.latestTileFoot time{white-space:nowrap;font-size:7px;color:#98a2b3}.obsIndexGrid .card:last-child{grid-column:1/-1}
@media(max-width:980px) and (min-width:761px){.latestGroupGrid,.latestBoardGrid{grid-template-columns:repeat(4,minmax(0,1fr))}.latestBoardHead{align-items:flex-start}.latestBoardTools{align-items:flex-end;flex-direction:column;gap:5px}}
@media(max-width:760px){.latestBoardWrap{padding:0 10px;margin-top:9px}.latestBoardHead{align-items:flex-start;flex-direction:column;gap:7px}.latestBoardTitleBox{display:block}.latestBoardTitleBox span{display:block;margin-top:2px}.latestBoardTools{width:100%;align-items:flex-start;flex-direction:column-reverse;gap:5px}.latestCompare{width:100%;overflow-x:auto;flex-wrap:nowrap;padding-bottom:2px;scrollbar-width:none}.latestCompare::-webkit-scrollbar{display:none}.latestCompare button{flex:0 0 auto;min-height:28px}.latestBoardGrid:not(.grouped){grid-template-columns:none!important;grid-template-rows:repeat(2,auto);grid-auto-flow:column;grid-auto-columns:minmax(138px,42vw);gap:6px;overflow-x:auto;padding-bottom:6px;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch;scrollbar-width:none}.latestBoardGrid:not(.grouped)::-webkit-scrollbar{display:none}.latestGroup{padding:8px;margin-bottom:8px}.latestGroupHead{align-items:flex-start}.latestGroupHead>div{display:block}.latestGroupHead span{display:block;margin-top:2px}.latestGroupGrid{grid-template-columns:none;grid-template-rows:repeat(2,auto);grid-auto-flow:column;grid-auto-columns:minmax(138px,42vw);gap:6px;overflow-x:auto;padding-bottom:5px;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch;scrollbar-width:none}.latestGroupGrid::-webkit-scrollbar{display:none}.latestTile{padding:8px 9px;scroll-snap-align:start}.latestTile strong{font-size:17px}.latestTileFoot{font-size:8px}.obsIndexGrid .card:last-child{grid-column:auto}}
`;document.head.appendChild(st);
let tries=0;const id=setInterval(()=>{tries++;ensureIndexShell();ensureOfficialMacroRuntime();hookRender();hookCalendar();bindTabs();if(renderBoard()&&tries>10&&window.__JJOONI_OFFICIAL_MACRO_V1)clearInterval(id);if(tries>120)clearInterval(id)},100);
window.__JJOONI_LATEST_BOARD={version:'2.4.1',contract:'GROUPED_MARKET_BOARD_WITH_INDEX_TAB_PERIOD_COMPARISON_AND_SOURCE_BASIS',tabs:Object.keys(TAB_CONFIG),comparisons:Object.keys(COMPARES)};
})();
