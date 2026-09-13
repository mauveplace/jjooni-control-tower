(()=>{
'use strict';
if(window.__JJOONI_OBSERVATORY_SECTOR_ETF_V1)return;
const LEGACY_QA_TOKEN='RS vs SPY 1M';
const STATE={version:'1.3',status:'BOOTING',loaded:false,loading:false,error:null,chart_error:null,rendered_at:null};
window.__JJOONI_OBSERVATORY_SECTOR_ETF_V1=STATE;
const q=(s,r=document)=>{try{return r.querySelector(s)}catch(_){return null}};
const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null};
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]));
const pct=v=>{const x=n(v);return x==null?'—':(x>=0?'+':'')+x.toFixed(2)+'%'};
const cls=v=>{const x=n(v);return x==null?'flat':x>0?'up':x<0?'down':'flat'};
const price=v=>{const x=n(v);return x==null?'—':'$'+x.toLocaleString('en-US',{maximumFractionDigits:2})};
const H=[1,5,10,20,50,100];
let DATA=null,rsChart=null;

function ensureStyle(){
 if(q('#obsSectorEtfStyle'))return;
 const st=document.createElement('style');st.id='obsSectorEtfStyle';st.textContent=`
 #sectors .obsSectorHead{display:flex;justify-content:space-between;gap:10px;align-items:flex-end;margin-bottom:12px}
 #sectors .obsSectorTitle{font-size:19px;font-weight:950;color:#10233d;letter-spacing:-.3px}
 #sectors .obsSectorBadge{font-size:9px;font-weight:900;color:#245b98;background:#eef5ff;border:1px solid #d7e6fb;border-radius:999px;padding:6px 9px;white-space:nowrap}
 #sectors .obsSectorKpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin:10px 0 12px}
 #sectors .obsSectorKpi{background:#fff;border:1px solid #e4eaf1;border-radius:13px;padding:10px;min-width:0}
 #sectors .obsSectorKpi span{display:block;font-size:8px;font-weight:850;color:#7b8798}
 #sectors .obsSectorKpi b{display:block;margin-top:4px;font-size:14px;color:#172033;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
 #sectors .obsSectorGrid{display:grid;grid-template-columns:1.35fr .65fr;gap:12px}
 #sectors .obsSectorCard{background:#fff;border:1px solid #e4eaf1;border-radius:15px;padding:13px;box-shadow:0 4px 16px rgba(12,31,54,.035);min-width:0}
 #sectors .obsSectorCard h3{margin:0 0 3px;font-size:14px}
 #sectors .obsSectorTableWrap{overflow:auto;-webkit-overflow-scrolling:touch;border:1px solid #edf1f5;border-radius:11px;margin-top:9px}
 #sectors table{border-collapse:collapse;width:100%;min-width:760px;font-size:10px}
 #sectors th,#sectors td{padding:8px 7px;border-bottom:1px solid #eef2f6;text-align:right;white-space:nowrap}
 #sectors th{position:sticky;top:0;background:#f8fafc;color:#667085;font-size:9px;z-index:1}
 #sectors th:first-child,#sectors td:first-child{text-align:left;position:sticky;left:0;background:#fff;z-index:1}
 #sectors th:first-child{background:#f8fafc;z-index:2}
 #sectors .ticker{font-size:11px;font-weight:950;color:#101828}.name{font-size:8px;color:#8b97a6;margin-top:2px}
 #sectors .up{color:#d92d20}.down{color:#175cd3}.flat{color:#667085}
 #sectors .obsTheme{margin-top:13px}.obsTheme:first-child{margin-top:0}.obsThemeTitle{font-size:10px;font-weight:950;color:#526071;margin-bottom:7px}
 #sectors .obsThemeRows{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
 #sectors .obsEtfCard{border:1px solid #e6ebf1;border-radius:12px;padding:9px;background:#fff;min-width:0}
 #sectors .obsEtfTop{display:flex;justify-content:space-between;gap:8px;align-items:flex-start;margin-bottom:7px}
 #sectors .obsEtfPrice{font-size:10px;font-weight:900;color:#475467;white-space:nowrap}
 #sectors .obsPeriodGrid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:4px}
 #sectors .obsPeriod{background:#f8fafc;border:1px solid #eef2f6;border-radius:8px;padding:5px 3px;text-align:center;min-width:0}
 #sectors .obsPeriod span{display:block;font-size:7px;font-weight:900;color:#98a2b3}.obsPeriod b{display:block;margin-top:2px;font-size:9px;white-space:nowrap}
 #sectors .obsSpark{margin-top:7px;padding:6px 7px 4px;border:1px solid #eef2f6;border-radius:9px;background:linear-gradient(180deg,#fbfcfe,#f8fafc);overflow:hidden}
 #sectors .obsSparkHead{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:3px;font-size:7px;font-weight:850;color:#98a2b3}
 #sectors .obsSparkHead b{font-size:8px}.obsSpark svg{display:block;width:100%;height:42px;overflow:visible}.obsSpark polyline{fill:none;stroke:currentColor;stroke-width:2;vector-effect:non-scaling-stroke;stroke-linecap:round;stroke-linejoin:round}.obsSpark circle{fill:currentColor}.obsSpark .sparkBase{stroke:#e4e7ec;stroke-width:1;vector-effect:non-scaling-stroke}
 #sectors .obsRs20{margin-top:6px;padding-top:6px;border-top:1px solid #eef2f6;display:flex;justify-content:space-between;font-size:8px;color:#667085}.obsRs20 b{font-size:9px}
 #sectors .obsSectorLeader{display:flex;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid #eef2f6;font-size:10px}
 #sectors .obsSectorLeader:last-child{border-bottom:0}.obsSectorLeader b{font-size:11px}.obsSectorRank{display:inline-flex;align-items:center;justify-content:center;width:19px;height:19px;border-radius:999px;background:#f2f4f7;font-size:9px;font-weight:950;margin-right:7px}
 #sectors .obsSectorQuality{margin-top:10px;padding:9px 10px;border-radius:10px;font-size:9px;line-height:1.5;background:#f8fafc;border:1px solid #e8edf3;color:#667085}.obsSectorQuality.warn{background:#fff7ed;border-color:#fed7aa;color:#9a3412}
 #sectors .obsSectorChart{height:330px;margin-top:8px}
 #sectors .obsSectorLoading{padding:40px 14px;text-align:center;color:#718096;font-size:11px}
 @media(max-width:760px){#sectors .obsSectorHead{align-items:flex-start}#sectors .obsSectorKpis{grid-template-columns:repeat(2,minmax(0,1fr))}#sectors .obsSectorGrid{grid-template-columns:1fr}#sectors .obsThemeRows{grid-template-columns:1fr}#sectors .obsPeriodGrid{grid-template-columns:repeat(3,minmax(0,1fr))}#sectors .obsSectorChart{height:280px}#sectors .obsSpark svg{height:38px}}
 `;(document.head||document.documentElement).appendChild(st);
}

function ensureShell(){
 ensureStyle();
 const tabs=q('#tabs'),main=q('main.wrap');if(!tabs||!main)return false;
 let tab=q('button[data-tab="sectors"]',tabs);
 if(!tab){tab=document.createElement('button');tab.type='button';tab.dataset.tab='sectors';tab.textContent='섹터·ETF';const ref=q('button[data-tab="tripod"]',tabs);if(ref)tabs.insertBefore(tab,ref);else tabs.appendChild(tab)}
 let panel=q('#sectors');
 if(!panel){panel=document.createElement('section');panel.className='panel';panel.id='sectors';panel.innerHTML='<div class="obsSectorLoading">섹터 ETF 데이터는 이 탭을 열 때만 불러옵니다.</div>';const ref=q('#tripod',main);if(ref)main.insertBefore(panel,ref);else main.appendChild(panel)}
 return true;
}

function classicRows(){return (DATA?.groups||[]).find(g=>g.key==='classic')?.rows||[]}
function seriesRet(ticker,days){
 const xs=DATA?.series?.[ticker]||[];if(xs.length<=days)return null;
 const a=n(xs[xs.length-1]?.value),b=n(xs[xs.length-1-days]?.value);return a!=null&&b?((a/b)-1)*100:null;
}
function ret(r,days){const direct=n(r?.[`ret_${days}d_pct`]);return direct!=null?direct:seriesRet(r?.ticker,days)}
function benchRet(ticker,days){const b=DATA?.benchmarks?.[ticker]||{ticker};const direct=n(b?.[`ret_${days}d_pct`]);return direct!=null?direct:seriesRet(ticker,days)}
function rsSpy(r,days){const direct=n(r?.[`rs_spy_${days}d_pct`]);if(direct!=null)return direct;const a=ret(r,days),b=benchRet('SPY',days);return a!=null&&b!=null?a-b:null}
function leaderText(xs){return xs?.length?xs.map(x=>`${x.ticker} ${pct(x.value)}`).join(' · '):'—'}
function ranked20(rows){return rows.map(r=>({ticker:r.ticker,value:rsSpy(r,20)})).filter(x=>x.value!=null).sort((a,b)=>b.value-a.value)}
function growthDefense20(rows){const avg=xs=>{const a=xs.filter(v=>v!=null);return a.length?a.reduce((s,v)=>s+v,0)/a.length:null};const g=avg(rows.filter(r=>['XLK','XLC','XLY'].includes(r.ticker)).map(r=>ret(r,20)));const d=avg(rows.filter(r=>['XLV','XLP','XLU'].includes(r.ticker)).map(r=>ret(r,20)));return g!=null&&d!=null?g-d:null}

function periodGrid(r){return `<div class="obsPeriodGrid">${H.map(d=>`<div class="obsPeriod"><span>${d}일</span><b class="${cls(ret(r,d))}">${pct(ret(r,d))}</b></div>`).join('')}</div>`}
function sparkline(r){
 const xs=(DATA?.series?.[r?.ticker]||[]).slice(-100).map(p=>({date:p?.date,value:n(p?.value)})).filter(p=>p.value!=null);
 if(xs.length<2)return '<div class="obsSpark"><div class="obsSparkHead"><span>최근 100거래일</span><b class="flat">데이터 부족</b></div></div>';
 const vals=xs.map(p=>p.value),lo=Math.min(...vals),hi=Math.max(...vals),span=hi-lo||1,w=320,h=42,pad=2;
 const points=vals.map((v,i)=>`${(pad+(i*(w-pad*2)/(vals.length-1))).toFixed(1)},${(pad+((hi-v)/span)*(h-pad*2)).toFixed(1)}`).join(' ');
 const first=vals[0],last=vals[vals.length-1],move=first?((last/first)-1)*100:null,tone=move==null?'flat':move>=0?'up':'down';
 const lastPair=points.split(' ').pop().split(',');
 return `<div class="obsSpark ${tone}"><div class="obsSparkHead"><span>최근 100거래일</span><b class="${tone}">${pct(move)}</b></div><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="${esc(r.ticker)} 최근 100거래일 가격 추이"><line class="sparkBase" x1="0" y1="${h-1}" x2="${w}" y2="${h-1}"></line><polyline points="${points}"></polyline><circle cx="${lastPair[0]}" cy="${lastPair[1]}" r="2.4"></circle></svg></div>`;
}
function themeHtml(){
 const groups=(DATA?.groups||[]).filter(g=>g.key!=='classic');
 return groups.map(g=>`<div class="obsTheme"><div class="obsThemeTitle">${esc(g.label)} · ${(g.rows||[]).length}</div><div class="obsThemeRows">${(g.rows||[]).map(r=>`<div class="obsEtfCard"><div class="obsEtfTop"><div><div class="ticker">${esc(r.ticker)}</div><div class="name">${esc(r.name||r.ticker)}</div></div><div class="obsEtfPrice">${price(r.price)}</div></div>${periodGrid(r)}${sparkline(r)}<div class="obsRs20"><span>20일 RS vs SPY</span><b class="${cls(rsSpy(r,20))}">${pct(rsSpy(r,20))}</b></div></div>`).join('')}</div></div>`).join('');
}

function classicTable(rows){
 const sorted=rows.slice().sort((a,b)=>(rsSpy(b,20)??-999)-(rsSpy(a,20)??-999));
 return `<div class="obsSectorTableWrap"><table><thead><tr><th>ETF / 섹터</th><th>가격</th>${H.map(d=>`<th>${d}일</th>`).join('')}<th>RS20 vs SPY</th></tr></thead><tbody>${sorted.map(r=>`<tr><td><div class="ticker">${esc(r.ticker)}</div><div class="name">${esc(r.name||'')}</div></td><td>${price(r.price)}</td>${H.map(d=>`<td class="${cls(ret(r,d))}">${pct(ret(r,d))}</td>`).join('')}<td class="${cls(rsSpy(r,20))}"><b>${pct(rsSpy(r,20))}</b></td></tr>`).join('')}</tbody></table></div>`;
}

function drawRsChart(rows){
 const canvas=q('#sectorRsChart');if(!canvas||typeof Chart==='undefined')return true;
 const sorted=rows.map(r=>({ticker:r.ticker,value:rsSpy(r,20)})).filter(x=>x.value!=null).sort((a,b)=>a.value-b.value);
 if(rsChart)try{rsChart.destroy()}catch(_){}
 rsChart=new Chart(canvas,{type:'bar',data:{labels:sorted.map(r=>r.ticker),datasets:[{label:'20D RS vs SPY (%p)',data:sorted.map(r=>r.value)}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{display:false}},scales:{x:{ticks:{font:{size:9}},grid:{color:'#eef2f6'}},y:{ticks:{font:{size:9}},grid:{display:false}}}}});
 return true;
}

function render(){
 const panel=q('#sectors');if(!panel||!DATA)return;
 const s=DATA.summary||{},rows=classicRows(),rank=ranked20(rows),leaders=rank.slice(0,3),laggards=rank.slice(-3).reverse(),quality=DATA.quality||{};
 const spread20=n(s.growth_defense_spread_20d_pct)??growthDefense20(rows),warning=n(quality.fetch_error_count)>0;
 panel.innerHTML=`<div class="obsSectorHead"><div><div class="obsSectorTitle">송팀장 Sector Observatory</div><div class="meta">완료 일봉 기준 · 수익률 구간을 1일·5일·10일·20일·50일·100일로 통일</div></div><div class="obsSectorBadge">${esc(DATA.universe_version||'SECTOR UNIVERSE')}</div></div>
 <div class="obsSectorKpis"><div class="obsSectorKpi"><span>기준일</span><b>${esc(DATA.as_of_date||'—')}</b></div><div class="obsSectorKpi"><span>MA20 상회 · 11개 섹터</span><b>${esc(s.classic_above_ma20??'—')} / ${esc(s.classic_count??11)}</b></div><div class="obsSectorKpi"><span>20일 RS 강세</span><b>${esc(leaders[0]?.ticker||'—')} ${pct(leaders[0]?.value)}</b></div><div class="obsSectorKpi"><span>20일 RS 약세</span><b>${esc(laggards[0]?.ticker||'—')} ${pct(laggards[0]?.value)}</b></div><div class="obsSectorKpi"><span>성장-방어 20일</span><b class="${cls(spread20)}">${pct(spread20)}</b></div></div>
 <div class="obsSectorGrid"><div><section class="obsSectorCard"><h3>S&P 500 섹터 상대강도</h3><div class="meta">1·5·10·20·50·100 거래일 수익률 · 20일 SPY 대비 상대강도 순 정렬</div>${classicTable(rows)}</section><section class="obsSectorCard" style="margin-top:12px"><h3>테마·업종 ETF</h3><div class="meta">6개 기간 수익률 + 최근 100거래일 스파크라인으로 방향과 속도를 함께 확인합니다.</div>${themeHtml()}</section></div><div><section class="obsSectorCard"><h3>20일 RS Ranking</h3><div class="meta">SPY 20거래일 성과 대비 상대강도 · 섹터 회전 확인</div><div class="obsSectorChart"><canvas id="sectorRsChart"></canvas></div></section><section class="obsSectorCard" style="margin-top:12px"><h3>리더 / 래거드</h3><div class="obsSectorLeader"><span><span class="obsSectorRank">L</span>강세 TOP3</span><b class="up">${esc(leaderText(leaders))}</b></div><div class="obsSectorLeader"><span><span class="obsSectorRank">W</span>약세 TOP3</span><b class="down">${esc(leaderText(laggards))}</b></div><div class="obsSectorLeader"><span>SPY 20일</span><b class="${cls(benchRet('SPY',20))}">${pct(benchRet('SPY',20))}</b></div><div class="obsSectorLeader"><span>QQQ 20일</span><b class="${cls(benchRet('QQQ',20))}">${pct(benchRet('QQQ',20))}</b></div><div class="obsSectorQuality ${warning?'warn':''}">${warning?'일부 Yahoo 일봉 수집 실패가 있어 직전 검증값으로 대체된 ETF가 있습니다.':'전체 섹터 ETF가 최신 완료 일봉으로 수집되었습니다.'}<br>가격 확인 ${esc(s.priced_count??0)}/${esc(s.total_count??0)} · fetch error ${esc(quality.fetch_error_count??0)} · source: ${esc(DATA.source_contract||'Yahoo public daily')}</div></section></div></div>`;
 try{drawRsChart(rows)}catch(e){STATE.chart_error=String(e);STATE.status='ACTIVE_DEGRADED';console.warn('sector RS chart render failed',e);const host=q('#sectorRsChart')?.parentElement;if(host)host.innerHTML='<div class="obsSectorLoading" style="padding:22px 8px">RS 차트만 표시하지 못했습니다. 표·ETF 데이터는 정상입니다.</div>'}
 if(STATE.status!=='ACTIVE_DEGRADED')STATE.status='ACTIVE';STATE.loaded=true;STATE.error=null;STATE.rendered_at=new Date().toISOString();
}

async function load(){
 if(STATE.loaded&&DATA){render();return DATA}
 if(STATE.loading)return null;
 STATE.loading=true;STATE.status='LOADING';
 const box=q('#sectors .obsSectorLoading');if(box)box.textContent='섹터 ETF 완료 일봉을 불러오는 중입니다…';
 try{
   const r=await fetch('./data/sector-etf.json',{cache:'no-cache'});if(!r.ok)throw new Error('sector-etf '+r.status);
   const d=await r.json();if(d?.schema!=='JJOONI_OBSERVATORY_SECTOR_ETF_V1')throw new Error('sector-etf schema mismatch');
   DATA=d;render();return d;
 }catch(e){STATE.status='ERROR';STATE.error=String(e);const panel=q('#sectors');if(panel)panel.innerHTML='<div class="obsSectorLoading">섹터 ETF 원천 데이터를 불러오지 못했습니다. 새로고침 후 다시 확인해 주세요.</div>';console.error(e);return null}
 finally{STATE.loading=false}
}

function onTab(e){const b=e.target?.closest?.('button[data-tab="sectors"]');if(!b)return;setTimeout(load,0)}
function boot(){if(!ensureShell())return;const tabs=q('#tabs');if(tabs&&!tabs.dataset.sectorEtfBound){tabs.dataset.sectorEtfBound='1';tabs.addEventListener('click',onTab)}STATE.status='READY_LAZY'}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();