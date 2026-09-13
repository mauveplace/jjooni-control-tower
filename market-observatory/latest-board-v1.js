(()=>{
'use strict';
const ITEMS=[
  {k:'KOSPI',label:'KOSPI',kind:'pct',digits:2,group:'한국'},
  {k:'KOSDAQ',label:'KOSDAQ',kind:'pct',digits:2,group:'한국'},
  {k:'RUSSELL2000',label:'Russell 2000',kind:'pct',digits:0,group:'미국'},
  {k:'DOW',label:'Dow',kind:'pct',digits:0,group:'미국'},
  {k:'SP500',label:'S&P 500',kind:'pct',digits:0,group:'미국'},
  {k:'NASDAQCOMPOSITE',label:'NASDAQ 종합',kind:'pct',digits:0,group:'미국'},
  {k:'NASDAQ100',label:'NASDAQ 100',kind:'pct',digits:0,group:'미국'},
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
const TAB_CONFIG={
  overview:{title:'전체 시장 주요 지표',sub:'Overview에서만 글로벌 시장 전체 요약을 표시',keys:ITEMS.map(x=>x.k)},
  rates:{title:'금리 주요 지표',sub:'미국·한국·일본 국채와 핵심 장단기 스프레드',keys:['US2Y','US10Y_OFFICIAL','US30Y_OFFICIAL','KR3Y','KR10Y','JP2Y','JP10Y','US_2S10S','KR_3S10S','JP_2S10S']},
  fx:{title:'환율 주요 지표',sub:'원화·엔화·달러 인덱스만 표시',keys:['USDKRW','USDJPY','JPYKRW','DXY']},
  energy:{title:'원자재 주요 지표',sub:'에너지·귀금속·산업금속만 표시',keys:['WTI','BRENT','NATGAS','GOLD','SILVER','COPPER']},
  sectors:{title:'섹터·ETF 주요 지표',sub:'송팀장 Sector Observatory의 상대강도·breadth·rotation 요약',special:'sector'},
  tripod:{title:'TRI-POD 주요 입력',sub:'NASDAQ-100 레짐·VIX10·Drawdown·현재 목표노출',special:'tripod'},
  calendar:{title:'경제일정 주요 지표',sub:'오늘·향후 7일·다음 중요 이벤트 중심',special:'calendar'}
};
const fmt=(v,d)=>v==null||!Number.isFinite(Number(v))?'—':Number(v).toLocaleString('ko-KR',{minimumFractionDigits:d,maximumFractionDigits:d});
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const num=v=>{const x=Number(v);return Number.isFinite(x)?x:null};
function seriesOf(item){if(typeof DATA==='undefined'||!DATA?.series)return[];const a=DATA.series[item.k]||[];if(a.length)return a;return item.fallback?(DATA.series[item.fallback]||[]):[]}
function stat(item){const s=seriesOf(item),last=s[s.length-1],prev=s[s.length-2];if(!last)return null;let ch=null;if(prev&&Number.isFinite(Number(prev.value))&&Number.isFinite(Number(last.value))){ch=item.kind==='bp'?(Number(last.value)-Number(prev.value))*100:item.kind==='pts'?(Number(last.value)-Number(prev.value)):(Number(last.value)/Number(prev.value)-1)*100}return{value:Number(last.value),date:last.date,change:ch}}
function arrow(v){return v==null?'':v>0?'▲':v<0?'▼':'■'}
function cls(v){return v==null?'flat':v>0?'up':v<0?'down':'flat'}
function changeText(item,v){if(v==null||!Number.isFinite(v))return '전일비 —';if(item.kind==='bp')return `${arrow(v)} ${Math.abs(v).toFixed(1)}bp`;if(item.kind==='pts')return `${arrow(v)} ${Math.abs(v).toFixed(1)}pt`;return `${arrow(v)} ${Math.abs(v).toFixed(2)}%`}
function activeTab(){return document.querySelector('#tabs button.on[data-tab]')?.dataset.tab||'overview'}
function ensure(){let host=document.getElementById('latestMarketBoard');if(host)return host;const nav=document.getElementById('tabs');if(!nav)return null;host=document.createElement('section');host.id='latestMarketBoard';host.className='latestBoardWrap';host.innerHTML='<div class="latestBoardHead"><div><b id="latestBoardTitle">주요 지표</b><span id="latestBoardSub"></span></div><span id="latestBoardGenerated"></span></div><div id="latestBoardGrid" class="latestBoardGrid"></div>';nav.insertAdjacentElement('afterend',host);return host}
function standardTile(item){const s=stat(item);const val=s?`${item.prefix||''}${fmt(s.value,item.digits)}${item.suffix||''}`:'—';const ch=s?changeText(item,s.change):'전일비 —';return `<div class="latestTile"><div class="latestTileTop"><span>${esc(item.group)}</span><b>${esc(item.label)}</b></div><strong>${esc(val)}</strong><div class="latestTileFoot"><span class="${cls(s?.change)}">${esc(ch)}</span><time>${esc(s?.date||'—')}</time></div></div>`}
function customTile(group,label,value,foot='',tone='flat',time=''){return `<div class="latestTile"><div class="latestTileTop"><span>${esc(group)}</span><b>${esc(label)}</b></div><strong class="${esc(tone)}">${esc(value)}</strong><div class="latestTileFoot"><span class="${esc(tone)}">${esc(foot||'')}</span><time>${esc(time||'')}</time></div></div>`}
function dataGenerated(){return String((typeof DATA!=='undefined'&&DATA?.generated_kst)||'').replace('T',' ').slice(0,16)}
function setHeader(title,sub,generated){const host=ensure();if(!host)return;const t=host.querySelector('#latestBoardTitle'),s=host.querySelector('#latestBoardSub'),g=host.querySelector('#latestBoardGenerated');if(t)t.textContent=title;if(s)s.textContent=sub;if(g)g.textContent=generated?`수집 ${generated} KST`:''}
function setGrid(html,count){const host=ensure();if(!host)return;host.dataset.tab=activeTab();const grid=host.querySelector('#latestBoardGrid');grid.innerHTML=html;grid.style.gridTemplateColumns=count>0&&count<=5?`repeat(${count},minmax(0,1fr))`:''}
function pulseChips(items){const p=document.getElementById('pulse');if(!p)return;p.innerHTML=items.map(x=>`<span class="chip">${esc(x)}</span>`).join('')}
function renderStandard(tab,cfg){const items=(cfg.keys||[]).map(k=>BY_KEY[k]).filter(Boolean);setHeader(cfg.title,cfg.sub,dataGenerated());setGrid(items.map(standardTile).join(''),items.length);const pulseKeys=tab==='overview'?['US10Y_OFFICIAL','US_2S10S','KR10Y','JP10Y','USDKRW','VIX','WTI']:cfg.keys.slice(0,6);pulseChips(pulseKeys.map(k=>{const i=BY_KEY[k],s=i?stat(i):null;return `${i?.label||k} ${s?`${i?.prefix||''}${fmt(s.value,i?.digits??2)}${i?.suffix||''}`:'—'}`}))}
let SECTOR_DATA=null,SECTOR_PROMISE=null;
function loadSector(){if(SECTOR_DATA)return Promise.resolve(SECTOR_DATA);if(SECTOR_PROMISE)return SECTOR_PROMISE;SECTOR_PROMISE=fetch('./data/sector-etf.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error('sector-etf '+r.status);return r.json()}).then(d=>{if(d?.schema!=='JJOONI_OBSERVATORY_SECTOR_ETF_V1')throw new Error('sector schema');SECTOR_DATA=d;return d}).finally(()=>{SECTOR_PROMISE=null});return SECTOR_PROMISE}
function renderSector(){const d=SECTOR_DATA;if(!d){setHeader(TAB_CONFIG.sectors.title,TAB_CONFIG.sectors.sub,'');setGrid(customTile('SECTOR','데이터','불러오는 중','sector-etf lazy load'),1);pulseChips(['Sector ETF 로딩중']);loadSector().then(()=>{if(activeTab()==='sectors')renderSector()}).catch(()=>{if(activeTab()==='sectors'){setGrid(customTile('SECTOR','데이터','로딩 실패','다음 갱신 후 재시도','down'),1);pulseChips(['Sector ETF 로딩 실패'])}});return}
 const s=d.summary||{},lead=s.leaders_1m_rs_spy?.[0],lag=s.laggards_1m_rs_spy?.[0],spread=num(s.growth_defense_spread_1m_pct),spy=d.benchmarks?.SPY,qqq=d.benchmarks?.QQQ;
 const rows=[
  customTile('BREADTH','MA20 상회',`${s.classic_above_ma20??'—'} / ${s.classic_count??11}`,'S&P 500 11개 섹터','flat',d.as_of_date||''),
  customTile('LEADER','1M RS 강세',lead?`${lead.ticker} ${lead.value>=0?'+':''}${Number(lead.value).toFixed(2)}%`:'—','vs SPY','up',d.as_of_date||''),
  customTile('LAGGARD','1M RS 약세',lag?`${lag.ticker} ${Number(lag.value).toFixed(2)}%`:'—','vs SPY','down',d.as_of_date||''),
  customTile('ROTATION','성장-방어',spread==null?'—':`${spread>=0?'+':''}${spread.toFixed(2)}%`,'1M spread',cls(spread),d.as_of_date||''),
  customTile('BENCH','SPY 1M',spy?.ret_1m_pct==null?'—':`${spy.ret_1m_pct>=0?'+':''}${Number(spy.ret_1m_pct).toFixed(2)}%`,'benchmark',cls(spy?.ret_1m_pct),d.as_of_date||''),
  customTile('BENCH','QQQ 1M',qqq?.ret_1m_pct==null?'—':`${qqq.ret_1m_pct>=0?'+':''}${Number(qqq.ret_1m_pct).toFixed(2)}%`,'benchmark',cls(qqq?.ret_1m_pct),d.as_of_date||'')
 ];
 setHeader(TAB_CONFIG.sectors.title,TAB_CONFIG.sectors.sub,String(d.generated_kst||'').replace('T',' ').slice(0,16));setGrid(rows.join(''),rows.length);pulseChips([`MA20 ${s.classic_above_ma20??'—'}/${s.classic_count??11}`,lead?`강세 ${lead.ticker}`:'강세 —',lag?`약세 ${lag.ticker}`:'약세 —',spread==null?'성장-방어 —':`성장-방어 ${spread>=0?'+':''}${spread.toFixed(2)}%`])}
function renderTripod(){const t=(typeof DATA!=='undefined'&&DATA?.tripod_latest)||{},ndx=stat(BY_KEY.NASDAQ100),vix=stat(BY_KEY.VIX),ma=num(t.ma250),v10=num(t.vix10),dd=num(t.drawdown_52w_pct);const rows=[
 customTile('REGIME','현재 상태',t.regime||'—','NASDAQ100 vs MA250'),
 customTile('TARGET','목표 노출',t.target||'—','송팀장 Tri-Pod'),
 customTile('INDEX','NASDAQ 100',ndx?fmt(ndx.value,0):'—',ndx?changeText(BY_KEY.NASDAQ100,ndx.change):'전일비 —',cls(ndx?.change),ndx?.date||''),
 customTile('TREND','MA250',ma==null?'—':fmt(ma,0),'레짐 기준선','flat',t.date||''),
 customTile('RISK','VIX / VIX10',`${vix?fmt(vix.value,2):'—'} / ${v10==null?'—':fmt(v10,2)}`,'현재 / 10일 평균',cls(vix?.change),vix?.date||''),
 customTile('DRAWDOWN','52주 고점대비',dd==null?'—':`${dd.toFixed(2)}%`,'낙폭',dd<-9?'down':'flat',t.date||'')
 ];setHeader(TAB_CONFIG.tripod.title,TAB_CONFIG.tripod.sub,dataGenerated());setGrid(rows.join(''),rows.length);pulseChips([`Regime ${t.regime||'—'}`,`Target ${t.target||'—'}`,`VIX10 ${v10==null?'—':fmt(v10,2)}`,`DD ${dd==null?'—':dd.toFixed(2)+'%'}`])}
function kstDay(d=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(d)}
function renderCalendarSummary(){if(typeof CAL==='undefined'||!CAL){setHeader(TAB_CONFIG.calendar.title,TAB_CONFIG.calendar.sub,'');setGrid(customTile('CALENDAR','일정','불러오는 중','economic-calendar lazy load'),1);pulseChips(['경제일정 로딩중']);return}
 const now=Date.now(),today=kstDay(),weekEnd=now+7*86400000,events=(CAL.events||[]).map(e=>({...e,_ts:Date.parse(e.datetime_kst||e.date||'')})).filter(e=>Number.isFinite(e._ts));const todayEvents=events.filter(e=>String(e.datetime_kst||e.date||'').startsWith(today));const upcoming=events.filter(e=>e._ts>=now).sort((a,b)=>a._ts-b._ts);const week=upcoming.filter(e=>e._ts<=weekEnd),weekHigh=week.filter(e=>(e.importance||0)>=3),next=upcoming[0],major=upcoming.find(e=>(e.importance||0)>=3);const time=e=>e?new Date(e._ts).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}):'—';const rows=[
 customTile('TODAY','오늘 일정',`${todayEvents.length}건`,'KST 기준','flat',today),
 customTile('7D','향후 7일',`${week.length}건`,`★★★ ${weekHigh.length}건`),
 customTile('NEXT','다음 일정',next?.title||'예정 없음',next?`${next.country||''} · ${next.category||''}`:'','flat',time(next)),
 customTile('MAJOR','다음 ★★★',major?.title||'예정 없음',major?`${major.country||''} · ${major.category||''}`:'','flat',time(major))
 ];setHeader(TAB_CONFIG.calendar.title,TAB_CONFIG.calendar.sub,String(CAL.generated_kst||'').replace('T',' ').slice(0,16));setGrid(rows.join(''),rows.length);pulseChips([`오늘 ${todayEvents.length}건`,`7일 ${week.length}건`,`★★★ ${weekHigh.length}건`,major?`다음 ★★★ ${time(major)}`:'다음 ★★★ —'])}
function renderBoard(){const host=ensure();if(!host||typeof DATA==='undefined'||!DATA)return false;const tab=activeTab(),cfg=TAB_CONFIG[tab]||TAB_CONFIG.overview;if(cfg.special==='sector')renderSector();else if(cfg.special==='tripod')renderTripod();else if(cfg.special==='calendar')renderCalendarSummary();else renderStandard(tab,cfg);return true}
function hookRender(){const base=window.render;if(typeof base!=='function'||base.__latestBoardHooked)return false;const w=function(){const r=base.apply(this,arguments);setTimeout(renderBoard,0);return r};w.__latestBoardHooked=true;window.render=w;return true}
function hookCalendar(){const base=window.renderCalendar;if(typeof base!=='function'||base.__latestBoardCalendarHooked)return false;const w=function(){const r=base.apply(this,arguments);if(activeTab()==='calendar')setTimeout(renderBoard,0);return r};w.__latestBoardCalendarHooked=true;window.renderCalendar=w;return true}
function bindTabs(){const tabs=document.getElementById('tabs');if(!tabs||tabs.dataset.latestBoardBound)return false;tabs.dataset.latestBoardBound='1';tabs.addEventListener('click',e=>{if(!e.target.closest('button[data-tab]'))return;[0,250,900,1700].forEach(ms=>setTimeout(renderBoard,ms))});return true}
const st=document.createElement('style');st.textContent=`
.latestBoardWrap{max-width:1180px;margin:12px auto 0;padding:0 14px}.latestBoardHead{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;margin-bottom:7px}.latestBoardHead>div{display:flex;align-items:baseline;gap:8px;min-width:0}.latestBoardHead b{font-size:13px}.latestBoardHead span{font-size:9px;color:#718096}.latestBoardGrid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px}.latestTile{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:9px 10px;min-width:0;box-shadow:0 4px 14px #10233d08}.latestTileTop{display:flex;align-items:center;gap:5px;min-width:0}.latestTileTop span{flex:0 0 auto;font-size:8px;font-weight:900;color:#667085;background:#f2f4f7;border-radius:999px;padding:2px 5px}.latestTileTop b{font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.latestTile strong{display:block;margin-top:5px;font-size:18px;line-height:1.05;letter-spacing:-.02em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.latestTile strong.up{color:#d92d20}.latestTile strong.down{color:#175cd3}.latestTileFoot{display:flex;justify-content:space-between;gap:5px;margin-top:5px;font-size:8px;color:#7d8b9d}.latestTileFoot span{font-weight:850;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.latestTileFoot .up{color:#d92d20}.latestTileFoot .down{color:#175cd3}.latestTileFoot .flat{color:#667085}.latestTileFoot time{white-space:nowrap}
@media(max-width:760px){.latestBoardWrap{padding:0 10px;margin-top:9px}.latestBoardHead{align-items:flex-start}.latestBoardHead>div{display:block}.latestBoardHead>div span{display:block;margin-top:2px}.latestBoardGrid{grid-template-columns:none!important;grid-template-rows:repeat(2,auto);grid-auto-flow:column;grid-auto-columns:minmax(138px,42vw);gap:6px;overflow-x:auto;padding-bottom:6px;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch;scrollbar-width:none}.latestBoardGrid::-webkit-scrollbar{display:none}.latestTile{padding:8px 9px;scroll-snap-align:start}.latestTile strong{font-size:17px}.latestTileFoot{font-size:8px}}
`;document.head.appendChild(st);
let tries=0;const id=setInterval(()=>{tries++;hookRender();hookCalendar();bindTabs();if(renderBoard()&&tries>10)clearInterval(id);if(tries>120)clearInterval(id)},100);
window.__JJOONI_LATEST_BOARD={version:'1.3',contract:'TAB_SCOPED_LATEST_NUMERIC_TOP_BOARD_WITH_SOURCE_DATE',tabs:Object.keys(TAB_CONFIG)};
})();
