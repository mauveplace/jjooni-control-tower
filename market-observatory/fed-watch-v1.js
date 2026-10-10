(()=>{
'use strict';
let DATA=null,PROMISE=null,CURRENT=null,HISTORY=null,SELECTION='latest',historyRequest=0;
const $=s=>document.querySelector(s);
const pct=v=>v==null||!Number.isFinite(Number(v))?'—':`${(Number(v)*100).toFixed(1)}%`;
const pp=v=>v==null||!Number.isFinite(Number(v))?'—':`${Number(v)>=0?'+':''}${Number(v).toFixed(1)}%p`;
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function active(){return document.querySelector('#tabs button.on[data-tab]')?.dataset.tab||'overview'}
function load(){
  if(DATA)return Promise.resolve(DATA);
  if(PROMISE)return PROMISE;
  PROMISE=fetch('./data/fed-watch.json?cb='+Date.now(),{cache:'no-store'})
    .then(r=>{if(!r.ok)throw new Error(`fed-watch ${r.status}`);return r.json()})
    .then(d=>{if(d?.schema!=='JJOONI_FED_WATCH_V1')throw new Error('fed-watch schema');DATA=d;CURRENT=d;return d})
    .finally(()=>{PROMISE=null});
  return PROMISE;
}

async function loadHistory(){
  if(!HISTORY){
    const r=await fetch('./data/fedwatch-history/index.json?cb='+Date.now(),{cache:'no-store'});
    if(!r.ok)throw Error('history '+r.status);
    const d=await r.json();
    if(d.schema!=='JJOONI_FEDWATCH_HISTORY_INDEX_V1')throw Error('history schema');
    HISTORY=d;
  }
  return HISTORY;
}
async function selectHistory(value){
  const id=++historyRequest,previous=SELECTION;
  try{
    if(value==='latest'){SELECTION=value;DATA=CURRENT;render();return;}
    const entry=(HISTORY?.entries||[]).find(e=>e.market_data_as_of===value);
    if(!entry||!/^fedwatch-history\/\d{4}-\d{2}-\d{2}\/[a-f0-9]{64}\.json$/.test(entry.path))throw Error('invalid archive path');
    const r=await fetch('./data/'+entry.path,{cache:'no-store'});
    if(!r.ok)throw Error('archive '+r.status);
    const d=await r.json();
    if(d.schema!=='JJOONI_FED_WATCH_V1'||d.market_data_as_of!==value)throw Error('archive schema');
    if(id!==historyRequest)return;
    SELECTION=value;DATA=d;render();
  }catch(err){
    if(id!==historyRequest)return;
    SELECTION=previous;render();
    const notice=document.getElementById('fedWatchArchiveNotice');
    if(notice)notice.textContent='과거 자료 로딩 실패 · 마지막 표시 자료를 유지합니다.';
  }
}
function historyToolbar(){
  const options=(HISTORY?.entries||[]).map(e=>'<option value="'+esc(e.market_data_as_of)+'" '+(SELECTION===e.market_data_as_of?'selected':'')+'>'+esc(e.market_data_as_of)+'</option>').join('');
  return '<div class="fedWatchArchive"><label>정산 기준일 <select id="fedWatchArchiveDate" aria-label="FedWatch 정산 기준일"><option value="latest" '+(SELECTION==='latest'?'selected':'')+'>최신 관측</option>'+options+'</select></label><a href="./data/fedwatch-history/brief.md" target="_blank" rel="noopener">PB 읽기 안내</a><a href="./data/fedwatch-history/index.json" target="_blank" rel="noopener">이력 JSON</a><a href="./data/fedwatch-history/probabilities.csv" download>확률 CSV</a><div id="fedWatchArchiveNotice">'+(SELECTION==='latest'?'하루 한 번 정산자료 갱신 · 기준일별 원문 보존':'과거 관측 자료 · 아래 상태는 수집 당시 판정입니다. 현재 투자판단에는 최신 자료를 확인하세요.')+'</div></div>';
}

function ensureCard(){
  const grid=document.querySelector('#rates .grid');
  if(!grid)return null;
  let card=document.getElementById('fedWatchCard');
  if(card)return card;
  card=document.createElement('div');
  card.className='card fedWatchCard';card.id='fedWatchCard';
  card.innerHTML='<div class="fedWatchHead"><div><h3>FOMC Market Pricing · FedWatch</h3><div class="meta">CME 30-Day Fed Funds futures settlement 기반 · 전체 FOMC 조건부 금리확률 경로</div></div><span id="fedWatchFresh" class="fedWatchBadge">LOADING</span></div><div id="fedWatchBody" class="fedWatchBody"><div class="meta">FedWatch 데이터를 불러오는 중입니다…</div></div>';
  grid.insertBefore(card,grid.firstChild);
  return card;
}
function outcomeLabel(x){
  const a=x?.action||'';
  if(a==='HOLD')return '동결';
  if(a.startsWith('HIKE_'))return `+${Math.abs(Number(x.move_bp||0))}bp`;
  if(a.startsWith('CUT_'))return `-${Math.abs(Number(x.move_bp||0))}bp`;
  return a||'기타';
}
function matrixRanges(d){
  const r=Array.isArray(d.target_ranges)?d.target_ranges.slice():[];
  if(r.length)return r;
  const seen=new Set();for(const row of(d.meeting_probability_matrix||[]))for(const k of Object.keys(row.probabilities||{}))seen.add(k);
  return [...seen].sort((a,b)=>Number(a.split('-')[0])-Number(b.split('-')[0]));
}
function deltaText(row,target){
  const v=row?.change_1d_pp?.[target];
  if(v==null||!Number.isFinite(Number(v))||Math.abs(Number(v))<0.05)return '';
  return `<small class="fedWatchDelta ${Number(v)>0?'up':'down'}">${Number(v)>0?'+':''}${Number(v).toFixed(1)}p</small>`;
}
function matrixHtml(d){
  const rows=d.meeting_probability_matrix||[],ranges=matrixRanges(d);
  if(!rows.length||!ranges.length)return '<div class="meta">전체 회의 확률 매트릭스 생성 대기 · 다음 FOMC 요약만 표시합니다.</div>';
  const head=ranges.map(r=>`<th>${esc(r)}<span>%</span></th>`).join('');
  const body=rows.map(row=>{
    const max=Number(row.most_likely_probability||0);
    const cells=ranges.map(r=>{
      const p=Number((row.probabilities||{})[r]||0),isMax=p>0&&Math.abs(p-max)<1e-7;
      const alpha=Math.min(.24,.035+p*.34);
      return `<td class="${isMax?'mode':''}" style="background:rgba(23,92,211,${alpha.toFixed(3)})"><b>${(p*100).toFixed(1)}%</b>${deltaText(row,r)}</td>`;
    }).join('');
    return `<tr><th class="dateCol">${esc(row.meeting_date||'—')}<small>${esc(row.most_likely_target||'')}</small></th>${cells}</tr>`;
  }).join('');
  return `<div class="fedWatchMatrixTitle"><b>Conditional Meeting Probabilities</b><span>각 행 = 해당 FOMC 종료 후 목표금리 분포 · 작은 숫자 = 전 거래일 대비 변화(%p)</span></div><div class="fedWatchMatrixWrap"><table class="fedWatchMatrix"><thead><tr><th class="dateCol">FOMC</th>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}
function render(){
  const card=ensureCard();if(!card)return;
  if(!DATA){card.querySelector('#fedWatchBody').innerHTML='<div class="meta">FedWatch 데이터를 불러오는 중입니다…</div>';return}
  const d=DATA,outs=d.outcomes||[],fresh=d.freshness||'UNKNOWN';
  const badge=card.querySelector('#fedWatchFresh');badge.textContent=fresh;badge.className=`fedWatchBadge ${fresh==='LIVE'?'live':fresh==='LAGGING'?'lagging':'stale'}`;
  const next=String(d.meeting_date||'—'),path=d.path_summary||{},first=(d.meeting_probability_matrix||[])[0]||{};
  const cards=[
    ['다음 FOMC',next,'정책결정일'],
    ['현재 Target',d.current_target?`${d.current_target}%`:'—',`EFFR ${d.effr==null?'—':Number(d.effr).toFixed(2)+'%'}`],
    ['다음 최빈구간',first.most_likely_target?`${first.most_likely_target}%`:'—',pct(first.most_likely_probability)],
    ['동결',pct(d.hold_probability),'다음 회의'],
    ['+25bp',pct(d.hike_25bp_probability),'다음 회의'],
    ['1일 변화',pp(d.change_1d_pctpt),'인상확률'],
    ['1주 변화',pp(d.change_1w_pctpt),'인상확률'],
    ['Terminal',path.terminal_most_likely_target?`${path.terminal_most_likely_target}%`:'—',path.terminal_meeting_date||'최종 산출 회의']
  ];
  const outcomes=outs.map(x=>`<div class="fedWatchOutcome"><div><b>${esc(outcomeLabel(x))}</b><span>${esc(x.target||'')}%</span></div><strong>${esc(pct(x.probability))}</strong><div class="fedWatchBar"><i style="width:${Math.max(0,Math.min(100,Number(x.probability||0)*100))}%"></i></div></div>`).join('');
  const hist=(d.history||[]).slice(-8).map(x=>`<div class="fedWatchHist"><span>${esc(String(x.trade_date||'').slice(5))}</span><b>${esc(pct(x.hike_any_probability))}</b></div>`).join('');
  const calc=d.calculation||{},src=d.usage_contract?.attribution||d.source||'',q=d.quality||{};
  const expectedTerminal=path.terminal_expected_target_midpoint==null?'—':`${Number(path.terminal_expected_target_midpoint).toFixed(3)}%`;
  const peak=path.peak_expected_target_midpoint==null?'—':`${Number(path.peak_expected_target_midpoint).toFixed(3)}%`;
  card.querySelector('#fedWatchBody').innerHTML=`
    ${historyToolbar()}
    <div class="fedWatchKpis">${cards.map(([a,b,c])=>`<div class="fedWatchKpi"><small>${esc(a)}</small><b>${esc(b)}</b><span>${esc(c)}</span></div>`).join('')}</div>
    <div class="fedWatchPath"><span>기대 Terminal midpoint <b>${esc(expectedTerminal)}</b></span><span>기대 Peak midpoint <b>${esc(peak)}</b></span><span>상방확률 50% 최초 <b>${esc(path.first_majority_above_current||'—')}</b></span><span>하방확률 50% 최초 <b>${esc(path.first_majority_below_current||'—')}</b></span></div>
    ${matrixHtml(d)}
    <div class="fedWatchDetailGrid">
      <div class="fedWatchBox"><div class="fedWatchBoxTitle">다음 FOMC outcome</div>${outcomes||'<div class="meta">outcome 없음</div>'}</div>
      <div class="fedWatchBox"><div class="fedWatchBoxTitle">최근 다음회의 인상확률</div><div class="fedWatchHistory">${hist||'<div class="meta">history 없음</div>'}</div></div>
    </div>
    <div class="fedWatchMeta"><span>CME 기준 ${esc(d.market_data_as_of||'—')}</span><span>기대 기준일 ${esc(d.expected_market_data_date||'—')}</span><span>회의 ${esc(d.meeting_count??1)}개</span><span>산출 revision ${esc(d.schema_revision||'1.x')}</span><span>lag ${esc(q.cme_trade_date_gap_business_days??q.cme_trade_date_gap_days??'—')}영업일</span><span>다음회의 조건부 변화 ${calc.next_meeting_conditional_expected_change_bp==null?(calc.expected_change_bp==null?'—':esc(Number(calc.expected_change_bp).toFixed(1)+'bp')):esc(Number(calc.next_meeting_conditional_expected_change_bp).toFixed(1)+'bp')}</span></div>
    <div class="fedWatchSource">${esc(src)}</div>`;
  card.querySelector('#fedWatchArchiveDate')?.addEventListener('change',e=>selectHistory(e.target.value));
}
function run(){ensureCard();render();load().then(async()=>{try{await loadHistory()}catch(err){console.warn('fedwatch history',err)}if(active()==='rates')render()}).catch(err=>{console.error('fed-watch',err);const c=ensureCard();if(c){c.querySelector('#fedWatchFresh').textContent='ERROR';c.querySelector('#fedWatchFresh').className='fedWatchBadge stale';c.querySelector('#fedWatchBody').innerHTML='<div class="meta">FedWatch 데이터 로딩 실패 · 전략 근거로 사용 금지</div>'}})}
const st=document.createElement('style');st.textContent=`
.fedWatchArchive{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:12px 0;font-size:11px}.fedWatchArchive select{padding:6px;border:1px solid #d0d5dd;border-radius:6px;background:white}.fedWatchArchive a{color:#175cd3}.fedWatchArchive #fedWatchArchiveNotice{width:100%;color:#667085}.fedWatchCard{grid-column:1/-1}.fedWatchHead{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.fedWatchHead h3{margin:0 0 4px}.fedWatchBadge{border-radius:999px;padding:4px 8px;font-size:9px;font-weight:950;background:#f2f4f7;color:#667085}.fedWatchBadge.live{background:#eafbf3;color:#087443}.fedWatchBadge.lagging{background:#fff7e6;color:#b54708}.fedWatchBadge.stale{background:#fff0ed;color:#b42318}.fedWatchKpis{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:7px;margin-top:10px}.fedWatchKpi{border:1px solid #e7edf4;background:#f8fafc;border-radius:11px;padding:9px;min-width:0}.fedWatchKpi small,.fedWatchKpi span{display:block;font-size:8px;color:#7d8b9d}.fedWatchKpi b{display:block;font-size:14px;margin:3px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.fedWatchPath{display:flex;gap:8px;flex-wrap:wrap;margin:9px 0}.fedWatchPath span{background:#f8fafc;border:1px solid #e7edf4;border-radius:999px;padding:6px 9px;font-size:9px;color:#667085}.fedWatchPath b{color:#13243a}.fedWatchMatrixTitle{display:flex;justify-content:space-between;gap:12px;align-items:end;margin:10px 0 6px}.fedWatchMatrixTitle b{font-size:11px}.fedWatchMatrixTitle span{font-size:8px;color:#7d8b9d;text-align:right}.fedWatchMatrixWrap{overflow:auto;border:1px solid #e7edf4;border-radius:12px}.fedWatchMatrix{border-collapse:separate;border-spacing:0;width:max-content;min-width:100%;font-size:9px}.fedWatchMatrix th,.fedWatchMatrix td{border-right:1px solid #edf1f5;border-bottom:1px solid #edf1f5;padding:7px 8px;text-align:center;white-space:nowrap;min-width:78px}.fedWatchMatrix tr:last-child th,.fedWatchMatrix tr:last-child td{border-bottom:0}.fedWatchMatrix th:last-child,.fedWatchMatrix td:last-child{border-right:0}.fedWatchMatrix thead th{position:sticky;top:0;background:#f8fafc;z-index:2;color:#425466}.fedWatchMatrix th span{display:block;font-size:7px;color:#98a2b3}.fedWatchMatrix .dateCol{position:sticky;left:0;z-index:3;background:#fff;min-width:100px;text-align:left;font-weight:900}.fedWatchMatrix thead .dateCol{background:#f8fafc;z-index:4}.fedWatchMatrix .dateCol small{display:block;font-size:7px;color:#7d8b9d;margin-top:2px}.fedWatchMatrix td.mode{outline:2px solid #175cd3;outline-offset:-2px}.fedWatchMatrix td b{display:block;font-size:10px}.fedWatchDelta{display:block;font-size:7px;margin-top:2px}.fedWatchDelta.up{color:#175cd3}.fedWatchDelta.down{color:#b42318}.fedWatchDetailGrid{display:grid;grid-template-columns:1.35fr 1fr;gap:9px;margin-top:9px}.fedWatchBox{border:1px solid #e7edf4;border-radius:12px;padding:10px}.fedWatchBoxTitle{font-size:10px;font-weight:900;margin-bottom:7px;color:#425466}.fedWatchOutcome{display:grid;grid-template-columns:1fr auto;gap:5px;align-items:center;margin:7px 0}.fedWatchOutcome>div:first-child{display:flex;gap:6px;align-items:baseline}.fedWatchOutcome b{font-size:11px}.fedWatchOutcome span{font-size:8px;color:#7d8b9d}.fedWatchOutcome strong{font-size:12px}.fedWatchBar{grid-column:1/-1;height:6px;background:#eef2f6;border-radius:999px;overflow:hidden}.fedWatchBar i{display:block;height:100%;background:#0b3b70;border-radius:999px}.fedWatchHistory{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.fedWatchHist{background:#f8fafc;border-radius:8px;padding:7px;text-align:center}.fedWatchHist span{display:block;font-size:8px;color:#7d8b9d}.fedWatchHist b{display:block;font-size:11px;margin-top:2px}.fedWatchMeta{display:flex;gap:10px;flex-wrap:wrap;margin-top:8px;font-size:8px;color:#718096}.fedWatchSource{font-size:8px;color:#98a2b3;margin-top:5px}
@media(max-width:980px){.fedWatchKpis{grid-template-columns:repeat(4,minmax(0,1fr))}}@media(max-width:760px){.fedWatchKpis{grid-template-columns:repeat(2,minmax(0,1fr))}.fedWatchDetailGrid{grid-template-columns:1fr}.fedWatchHistory{grid-template-columns:repeat(3,minmax(0,1fr))}.fedWatchHead{align-items:flex-start}.fedWatchMatrixTitle{display:block}.fedWatchMatrixTitle span{display:block;text-align:left;margin-top:3px}}
`;document.head.appendChild(st);
const tabs=document.getElementById('tabs');if(tabs)tabs.addEventListener('click',e=>{const b=e.target.closest('button[data-tab]');if(b?.dataset.tab==='rates')setTimeout(run,0)});
if(active()==='rates')run();

const AUTO_REFRESH_MS=60*60*1000;
const AUTO_REFRESH_HEARTBEAT_MS=60*1000;
const AUTO_REFRESH_STATE_KEY='JJOONI_OBSERVATORY_AUTO_REFRESH_V1';
let autoRefreshDueAt=Date.now()+AUTO_REFRESH_MS;
let autoRefreshPending=false;
function reloadPreservingView(){
  try{sessionStorage.setItem(AUTO_REFRESH_STATE_KEY,JSON.stringify({tab:active(),scrollY:Math.max(0,window.scrollY||0),savedAt:Date.now()}));}catch(_){ }
  try{const u=new URL(window.location.href);u.searchParams.set('refresh_ts',String(Date.now()));window.location.replace(u.toString());}catch(_){window.location.reload();}
}
function restoreViewAfterAutoRefresh(){
  try{
    const raw=sessionStorage.getItem(AUTO_REFRESH_STATE_KEY);if(!raw)return;
    sessionStorage.removeItem(AUTO_REFRESH_STATE_KEY);
    const state=JSON.parse(raw);if(!state||Date.now()-Number(state.savedAt||0)>5*60*1000)return;
    const tab=String(state.tab||'overview');
    const restore=()=>{const button=document.querySelector(`#tabs button[data-tab="${tab}"]`);if(button&&!button.classList.contains('on'))button.click();setTimeout(()=>window.scrollTo({top:Number(state.scrollY||0),left:0,behavior:'auto'}),500);};
    setTimeout(restore,350);
  }catch(_){ }
}
function autoRefreshTick(){const now=Date.now();if(now<autoRefreshDueAt)return;autoRefreshDueAt=now+AUTO_REFRESH_MS;if(document.visibilityState==='visible')reloadPreservingView();else autoRefreshPending=true;}
setInterval(autoRefreshTick,AUTO_REFRESH_HEARTBEAT_MS);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='visible')return;if(autoRefreshPending||Date.now()>=autoRefreshDueAt){autoRefreshPending=false;reloadPreservingView();}});
restoreViewAfterAutoRefresh();

window.__JJOONI_FED_WATCH={version:'2.0',data:'./data/fed-watch.json',contract:'CME_CONDITIONAL_MEETING_MATRIX_V2',legacy_fields:['hike_25bp_probability','change_1w_pctpt']};
window.__JJOONI_AUTO_REFRESH={version:'1.1',interval_minutes:60,mode:'PAGE_RELOAD_LATEST_PUBLISHED_DATA',preserve_view:true};
})();
