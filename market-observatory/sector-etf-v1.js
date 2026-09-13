(()=>{
'use strict';
if(window.__JJOONI_OBSERVATORY_SECTOR_ETF_V1)return;
const STATE={version:'1.0',status:'BOOTING',loaded:false,loading:false,error:null,rendered_at:null};
window.__JJOONI_OBSERVATORY_SECTOR_ETF_V1=STATE;
const q=(s,r=document)=>{try{return r.querySelector(s)}catch(_){return null}};
const qa=(s,r=document)=>{try{return Array.from(r.querySelectorAll(s))}catch(_){return[]}};
const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null};
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const pct=v=>{const x=n(v);return x==null?'—':(x>=0?'+':'')+x.toFixed(2)+'%'};
const cls=v=>{const x=n(v);return x==null?'flat':x>0?'up':x<0?'down':'flat'};
const price=v=>{const x=n(v);return x==null?'—':'$'+x.toLocaleString('en-US',{maximumFractionDigits:2})};
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
 #sectors .obsSectorGrid{display:grid;grid-template-columns:1.3fr .7fr;gap:12px}
 #sectors .obsSectorCard{background:#fff;border:1px solid #e4eaf1;border-radius:15px;padding:13px;box-shadow:0 4px 16px rgba(12,31,54,.035);min-width:0}
 #sectors .obsSectorCard h3{margin:0 0 3px;font-size:14px}
 #sectors .obsSectorTableWrap{overflow:auto;-webkit-overflow-scrolling:touch;border:1px solid #edf1f5;border-radius:11px;margin-top:9px}
 #sectors table{border-collapse:collapse;width:100%;min-width:860px;font-size:10px}
 #sectors th,#sectors td{padding:8px 7px;border-bottom:1px solid #eef2f6;text-align:right;white-space:nowrap}
 #sectors th{position:sticky;top:0;background:#f8fafc;color:#667085;font-size:9px;z-index:1}
 #sectors th:first-child,#sectors td:first-child{text-align:left;position:sticky;left:0;background:#fff;z-index:1}
 #sectors th:first-child{background:#f8fafc;z-index:2}
 #sectors .ticker{font-size:11px;font-weight:950;color:#101828}.name{font-size:8px;color:#8b97a6;margin-top:2px}
 #sectors .up{color:#d92d20}.down{color:#175cd3}.flat{color:#667085}
 #sectors .obsSectorLeader{display:flex;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid #eef2f6;font-size:10px}
 #sectors .obsSectorLeader:last-child{border-bottom:0}.obsSectorLeader b{font-size:11px}.obsSectorRank{display:inline-flex;align-items:center;justify-content:center;width:19px;height:19px;border-radius:999px;background:#f2f4f7;font-size:9px;font-weight:950;margin-right:7px}
 #sectors .obsTheme{margin-top:12px}.obsTheme:first-child{margin-top:0}.obsThemeTitle{font-size:10px;font-weight:950;color:#526071;margin-bottom:6px}
 #sectors .obsThemeRows{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.obsThemeRow{border:1px solid #edf1f5;border-radius:10px;padding:8px 9px;display:flex;justify-content:space-between;gap:8px;min-width:0}.obsThemeRow .left{min-width:0}.obsThemeRow .right{text-align:right}.obsThemeRow .name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:175px}
 #sectors .obsSectorQuality{margin-top:10px;padding:9px 10px;border-radius:10px;font-size:9px;line-height:1.5;background:#f8fafc;border:1px solid #e8edf3;color:#667085}.obsSectorQuality.warn{background:#fff7ed;border-color:#fed7aa;color:#9a3412}
 #sectors .obsSectorChart{height:330px;margin-top:8px}
 #sectors .obsSectorLoading{padding:40px 14px;text-align:center;color:#718096;font-size:11px}
 @media(max-width:760px){#sectors .obsSectorHead{align-items:flex-start}#sectors .obsSectorKpis{grid-template-columns:repeat(2,minmax(0,1fr))}#sectors .obsSectorGrid{grid-template-columns:1fr}#sectors .obsThemeRows{grid-template-columns:1fr}#sectors .obsSectorChart{height:280px}}
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

function flattenGroups(d){return (d?.groups||[]).flatMap(g=>Array.isArray(g.rows)?g.rows:[])}
function classicRows(){return (DATA?.groups||[]).find(g=>g.key==='classic')?.rows||[]}
function leaderText(xs){return xs?.length?xs.map(x=>`${x.ticker} ${pct(x.value)}`).join(' · '):'—'}

function themeHtml(){
 const groups=(DATA?.groups||[]).filter(g=>g.key!=='classic');
 return groups.map(g=>`<div class="obsTheme"><div class="obsThemeTitle">${esc(g.label)} · ${(g.rows||[]).length}</div><div class="obsThemeRows">${(g.rows||[]).map(r=>`<div class="obsThemeRow"><div class="left"><div class="ticker">${esc(r.ticker)}</div><div class="name">${esc(r.name||r.ticker)}</div></div><div class="right"><div>${price(r.price)}</div><div class="${cls(r.ret_1m_pct)}" style="font-weight:950;margin-top:2px">1M ${pct(r.ret_1m_pct)}</div><div class="${cls(r.rs_spy_1m_pct)}" style="font-size:8px;margin-top:2px">RS ${pct(r.rs_spy_1m_pct)}</div></div></div>`).join('')}</div></div>`).join('');
}

function classicTable(rows){
 const sorted=rows.slice().sort((a,b)=>(n(b.rs_spy_1m_pct)??-999)-(n(a.rs_spy_1m_pct)??-999));
 return `<div class="obsSectorTableWrap"><table><thead><tr><th>ETF / 섹터</th><th>가격</th><th>1D</th><th>5D</th><th>1M</th><th>3M</th><th>YTD</th><th>RS vs SPY 1M</th><th>MA20</th><th>MA60</th><th>20D 고점대비</th></tr></thead><tbody>${sorted.map(r=>`<tr><td><div class="ticker">${esc(r.ticker)}</div><div class="name">${esc(r.name||'')}</div></td><td>${price(r.price)}</td><td class="${cls(r.ret_1d_pct)}">${pct(r.ret_1d_pct)}</td><td class="${cls(r.ret_5d_pct)}">${pct(r.ret_5d_pct)}</td><td class="${cls(r.ret_1m_pct)}"><b>${pct(r.ret_1m_pct)}</b></td><td class="${cls(r.ret_3m_pct)}">${pct(r.ret_3m_pct)}</td><td class="${cls(r.ytd_pct)}">${pct(r.ytd_pct)}</td><td class="${cls(r.rs_spy_1m_pct)}"><b>${pct(r.rs_spy_1m_pct)}</b></td><td class="${r.above_ma20?'up':'down'}">${pct(r.vs_ma20_pct)}</td><td class="${r.above_ma60?'up':'down'}">${pct(r.vs_ma60_pct)}</td><td class="${cls(r.high20_gap_pct)}">${pct(r.high20_gap_pct)}</td></tr>`).join('')}</tbody></table></div>`;
}

function drawRsChart(rows){
 const canvas=q('#sectorRsChart');if(!canvas||typeof Chart==='undefined')return;
 const sorted=rows.filter(r=>n(r.rs_spy_1m_pct)!=null).slice().sort((a,b)=>a.rs_spy_1m_pct-b.rs_spy_1m_pct);
 if(rsChart)try{rsChart.destroy()}catch(_){}
 rsChart=new Chart(canvas,{type:'bar',data:{labels:sorted.map(r=>r.ticker),datasets:[{label:'1M RS vs SPY (%p)',data:sorted.map(r=>r.rs_spy_1m_pct)}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{display:false}},scales:{x:{ticks:{font:{size:9}},grid:{color:'#eef2f6'}},y:{ticks:{font:{size:9}},grid:{display:false}}}}});
}

function render(){
 const panel=q('#sectors');if(!panel||!DATA)return;
 const s=DATA.summary||{},rows=classicRows(),leaders=s.leaders_1m_rs_spy||[],laggards=s.laggards_1m_rs_spy||[],q=DATA.quality||{};
 const warning=n(q.fetch_error_count)>0;
 panel.innerHTML=`<div class="obsSectorHead"><div><div class="obsSectorTitle">송팀장 Sector Observatory</div><div class="meta">S&P 500 11개 섹터 + 반도체·소프트웨어·바이오·은행·방산·인프라·로봇 ETF · 완료 일봉 기준</div></div><div class="obsSectorBadge">${esc(DATA.universe_version||'SECTOR UNIVERSE')}</div></div>
 <div class="obsSectorKpis"><div class="obsSectorKpi"><span>기준일</span><b>${esc(DATA.as_of_date||'—')}</b></div><div class="obsSectorKpi"><span>MA20 상회 · 11개 섹터</span><b>${esc(s.classic_above_ma20??'—')} / ${esc(s.classic_count??11)}</b></div><div class="obsSectorKpi"><span>1M RS 강세</span><b>${esc(leaders[0]?.ticker||'—')} ${pct(leaders[0]?.value)}</b></div><div class="obsSectorKpi"><span>1M RS 약세</span><b>${esc(laggards[0]?.ticker||'—')} ${pct(laggards[0]?.value)}</b></div><div class="obsSectorKpi"><span>성장-방어 1M 스프레드</span><b class="${cls(s.growth_defense_spread_1m_pct)}">${pct(s.growth_defense_spread_1m_pct)}</b></div></div>
 <div class="obsSectorGrid"><div><section class="obsSectorCard"><h3>S&P 500 섹터 상대강도</h3><div class="meta">1개월 성과에서 SPY 1개월 성과를 차감한 상대강도(%p) · 높은 순으로 표 정렬</div>${classicTable(rows)}</section><section class="obsSectorCard" style="margin-top:12px"><h3>테마·업종 ETF</h3><div class="meta">송팀장 기존 섹터 Watchlist를 Observatory용 시장관측 Universe로 확장</div>${themeHtml()}</section></div><div><section class="obsSectorCard"><h3>1M RS Ranking</h3><div class="meta">SPY 대비 상대강도 · 회전 방향을 빠르게 확인</div><div class="obsSectorChart"><canvas id="sectorRsChart"></canvas></div></section><section class="obsSectorCard" style="margin-top:12px"><h3>리더 / 래거드</h3><div class="obsSectorLeader"><span><span class="obsSectorRank">L</span>강세 TOP3</span><b class="up">${esc(leaderText(leaders))}</b></div><div class="obsSectorLeader"><span><span class="obsSectorRank">W</span>약세 TOP3</span><b class="down">${esc(leaderText(laggards))}</b></div><div class="obsSectorQuality ${warning?'warn':''}">${warning?'일부 Yahoo 일봉 수집 실패가 있어 직전 검증값으로 대체된 ETF가 있습니다.':'전체 섹터 ETF가 최신 완료 일봉으로 수집되었습니다.'}<br>가격 확인 ${esc(s.priced_count??0)}/${esc(s.total_count??0)} · fetch error ${esc(q.fetch_error_count??0)} · source: ${esc(DATA.source_contract||'Yahoo public daily')}</div></section></div></div>`;
 drawRsChart(rows);STATE.status='ACTIVE';STATE.loaded=true;STATE.rendered_at=new Date().toISOString();
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
 }catch(e){STATE.status='ERROR';STATE.error=String(e);const panel=q('#sectors');if(panel)panel.innerHTML='<div class="obsSectorLoading">섹터 ETF 데이터를 불러오지 못했습니다. 다음 Observatory 갱신 후 다시 확인해 주세요.</div>';console.error(e);return null}
 finally{STATE.loading=false}
}

function onTab(e){const b=e.target?.closest?.('button[data-tab="sectors"]');if(!b)return;setTimeout(load,0)}
function boot(){if(!ensureShell())return;const tabs=q('#tabs');if(tabs&&!tabs.dataset.sectorEtfBound){tabs.dataset.sectorEtfBound='1';tabs.addEventListener('click',onTab)}STATE.status='READY_LAZY'}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
