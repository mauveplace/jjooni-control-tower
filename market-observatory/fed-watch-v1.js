(()=>{
'use strict';
let DATA=null,PROMISE=null;
const $=s=>document.querySelector(s);
const pct=v=>v==null||!Number.isFinite(Number(v))?'—':`${(Number(v)*100).toFixed(1)}%`;
const pp=v=>v==null||!Number.isFinite(Number(v))?'—':`${Number(v)>=0?'+':''}${Number(v).toFixed(1)}%p`;
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function active(){return document.querySelector('#tabs button.on[data-tab]')?.dataset.tab||'overview'}
function load(){
  if(DATA)return Promise.resolve(DATA);
  if(PROMISE)return PROMISE;
  PROMISE=fetch('./data/fed-watch.json',{cache:'no-cache'})
    .then(r=>{if(!r.ok)throw new Error(`fed-watch ${r.status}`);return r.json()})
    .then(d=>{if(d?.schema!=='JJOONI_FED_WATCH_V1')throw new Error('fed-watch schema');DATA=d;return d})
    .finally(()=>{PROMISE=null});
  return PROMISE;
}
function ensureCard(){
  const grid=document.querySelector('#rates .grid');
  if(!grid)return null;
  let card=document.getElementById('fedWatchCard');
  if(card)return card;
  card=document.createElement('div');
  card.className='card fedWatchCard';card.id='fedWatchCard';
  card.innerHTML='<div class="fedWatchHead"><div><h3>FOMC Market Pricing · FedWatch</h3><div class="meta">CME 30-Day Fed Funds futures settlement 기반 · CME FedWatch 방법론</div></div><span id="fedWatchFresh" class="fedWatchBadge">LOADING</span></div><div id="fedWatchBody" class="fedWatchBody"><div class="meta">FedWatch 데이터를 불러오는 중입니다…</div></div>';
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
function tone(v){return v>0?'up':v<0?'down':'flat'}
function render(){
  const card=ensureCard();if(!card)return;
  if(!DATA){card.querySelector('#fedWatchBody').innerHTML='<div class="meta">FedWatch 데이터를 불러오는 중입니다…</div>';return}
  const d=DATA,outs=d.outcomes||[],fresh=d.freshness||'UNKNOWN';
  const badge=card.querySelector('#fedWatchFresh');badge.textContent=fresh;badge.className=`fedWatchBadge ${fresh==='LIVE'?'live':'stale'}`;
  const next=String(d.meeting_date||'—');
  const cards=[
    ['다음 FOMC',next,'정책결정일'],
    ['현재 Target',d.current_target?`${d.current_target}%`:'—',`EFFR ${d.effr==null?'—':Number(d.effr).toFixed(2)+'%'}`],
    ['동결',pct(d.hold_probability),'현재 확률'],
    ['+25bp',pct(d.hike_25bp_probability),'25bp 인상'],
    ['인상 합계',pct(d.hike_any_probability),'모든 인상 outcome'],
    ['1일 변화',pp(d.change_1d_pctpt),'인상확률 변화'],
    ['1주 변화',pp(d.change_1w_pctpt),'인상확률 변화']
  ];
  const outcomes=outs.map(x=>`<div class="fedWatchOutcome"><div><b>${esc(outcomeLabel(x))}</b><span>${esc(x.target||'')}%</span></div><strong>${esc(pct(x.probability))}</strong><div class="fedWatchBar"><i style="width:${Math.max(0,Math.min(100,Number(x.probability||0)*100))}%"></i></div></div>`).join('');
  const hist=(d.history||[]).slice(-8).map(x=>`<div class="fedWatchHist"><span>${esc(String(x.trade_date||'').slice(5))}</span><b>${esc(pct(x.hike_any_probability))}</b></div>`).join('');
  const calc=d.calculation||{},src=d.usage_contract?.attribution||d.source||'';
  card.querySelector('#fedWatchBody').innerHTML=`
    <div class="fedWatchKpis">${cards.map(([a,b,c])=>`<div class="fedWatchKpi"><small>${esc(a)}</small><b>${esc(b)}</b><span>${esc(c)}</span></div>`).join('')}</div>
    <div class="fedWatchDetailGrid">
      <div class="fedWatchBox"><div class="fedWatchBoxTitle">Outcome probability</div>${outcomes||'<div class="meta">outcome 없음</div>'}</div>
      <div class="fedWatchBox"><div class="fedWatchBoxTitle">최근 인상확률</div><div class="fedWatchHistory">${hist||'<div class="meta">history 없음</div>'}</div></div>
    </div>
    <div class="fedWatchMeta"><span>시장데이터 ${esc(d.market_data_as_of||'—')}</span><span>기대 기준일 ${esc(d.expected_market_data_date||'—')}</span><span>예상 정책변화 ${calc.expected_change_bp==null?'—':esc(Number(calc.expected_change_bp).toFixed(1)+'bp')}</span><span>anchor ${esc(calc.anchor_month||'—')}</span></div>
    <div class="fedWatchSource">${esc(src)}</div>`;
}
function run(){ensureCard();render();load().then(()=>{if(active()==='rates')render()}).catch(err=>{console.error('fed-watch',err);const c=ensureCard();if(c){c.querySelector('#fedWatchFresh').textContent='ERROR';c.querySelector('#fedWatchFresh').className='fedWatchBadge stale';c.querySelector('#fedWatchBody').innerHTML='<div class="meta">FedWatch 데이터 로딩 실패 · 전략 근거로 사용 금지</div>'}})}
const st=document.createElement('style');st.textContent=`
.fedWatchCard{grid-column:1/-1}.fedWatchHead{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.fedWatchHead h3{margin:0 0 4px}.fedWatchBadge{border-radius:999px;padding:4px 8px;font-size:9px;font-weight:950;background:#f2f4f7;color:#667085}.fedWatchBadge.live{background:#eafbf3;color:#087443}.fedWatchBadge.stale{background:#fff0ed;color:#b42318}.fedWatchKpis{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:7px;margin-top:10px}.fedWatchKpi{border:1px solid #e7edf4;background:#f8fafc;border-radius:11px;padding:9px;min-width:0}.fedWatchKpi small,.fedWatchKpi span{display:block;font-size:8px;color:#7d8b9d}.fedWatchKpi b{display:block;font-size:14px;margin:3px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.fedWatchDetailGrid{display:grid;grid-template-columns:1.35fr 1fr;gap:9px;margin-top:9px}.fedWatchBox{border:1px solid #e7edf4;border-radius:12px;padding:10px}.fedWatchBoxTitle{font-size:10px;font-weight:900;margin-bottom:7px;color:#425466}.fedWatchOutcome{display:grid;grid-template-columns:1fr auto;gap:5px;align-items:center;margin:7px 0}.fedWatchOutcome>div:first-child{display:flex;gap:6px;align-items:baseline}.fedWatchOutcome b{font-size:11px}.fedWatchOutcome span{font-size:8px;color:#7d8b9d}.fedWatchOutcome strong{font-size:12px}.fedWatchBar{grid-column:1/-1;height:6px;background:#eef2f6;border-radius:999px;overflow:hidden}.fedWatchBar i{display:block;height:100%;background:#0b3b70;border-radius:999px}.fedWatchHistory{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.fedWatchHist{background:#f8fafc;border-radius:8px;padding:7px;text-align:center}.fedWatchHist span{display:block;font-size:8px;color:#7d8b9d}.fedWatchHist b{display:block;font-size:11px;margin-top:2px}.fedWatchMeta{display:flex;gap:10px;flex-wrap:wrap;margin-top:8px;font-size:8px;color:#718096}.fedWatchSource{font-size:8px;color:#98a2b3;margin-top:5px}
@media(max-width:900px){.fedWatchKpis{grid-template-columns:repeat(4,minmax(0,1fr))}}@media(max-width:760px){.fedWatchKpis{grid-template-columns:repeat(2,minmax(0,1fr))}.fedWatchDetailGrid{grid-template-columns:1fr}.fedWatchHistory{grid-template-columns:repeat(4,minmax(0,1fr))}.fedWatchHead{align-items:flex-start}}
`;document.head.appendChild(st);
const tabs=document.getElementById('tabs');if(tabs)tabs.addEventListener('click',e=>{const b=e.target.closest('button[data-tab]');if(b?.dataset.tab==='rates')setTimeout(run,0)});
if(active()==='rates')run();

const AUTO_REFRESH_MS=60*60*1000;
const AUTO_REFRESH_HEARTBEAT_MS=60*1000;
const AUTO_REFRESH_STATE_KEY='JJOONI_OBSERVATORY_AUTO_REFRESH_V1';
let autoRefreshDueAt=Date.now()+AUTO_REFRESH_MS;
let autoRefreshPending=false;
function reloadPreservingView(){
  try{
    sessionStorage.setItem(AUTO_REFRESH_STATE_KEY,JSON.stringify({tab:active(),scrollY:Math.max(0,window.scrollY||0),savedAt:Date.now()}));
  }catch(_){ }
  window.location.reload();
}
function restoreViewAfterAutoRefresh(){
  try{
    const raw=sessionStorage.getItem(AUTO_REFRESH_STATE_KEY);if(!raw)return;
    sessionStorage.removeItem(AUTO_REFRESH_STATE_KEY);
    const state=JSON.parse(raw);if(!state||Date.now()-Number(state.savedAt||0)>5*60*1000)return;
    const tab=String(state.tab||'overview');
    const restore=()=>{
      const button=document.querySelector(`#tabs button[data-tab="${tab}"]`);
      if(button&&!button.classList.contains('on'))button.click();
      setTimeout(()=>window.scrollTo({top:Number(state.scrollY||0),left:0,behavior:'auto'}),500);
    };
    setTimeout(restore,350);
  }catch(_){ }
}
function autoRefreshTick(){
  const now=Date.now();if(now<autoRefreshDueAt)return;
  autoRefreshDueAt=now+AUTO_REFRESH_MS;
  if(document.visibilityState==='visible')reloadPreservingView();
  else autoRefreshPending=true;
}
setInterval(autoRefreshTick,AUTO_REFRESH_HEARTBEAT_MS);
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState!=='visible')return;
  if(autoRefreshPending||Date.now()>=autoRefreshDueAt){autoRefreshPending=false;reloadPreservingView();}
});
restoreViewAfterAutoRefresh();

window.__JJOONI_FED_WATCH={version:'1.1',data:'./data/fed-watch.json',contract:'CME_SETTLEMENT_DERIVED_FEDWATCH'};
window.__JJOONI_AUTO_REFRESH={version:'1.0',interval_minutes:60,mode:'PAGE_RELOAD_LATEST_PUBLISHED_DATA',preserve_view:true};
})();