(()=>{
'use strict';
let HISTORY=null,loading=null;
const seriesLoading=new Map();
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const missing=v=>v==null||String(v).trim()==='';
const value=v=>missing(v)?'—':String(v);
const forecastValue=v=>missing(v)?'미발표':String(v);
function selectedMonth(){return ($('#calendarMonth')?.textContent||'').trim()||(typeof calMonth!=='undefined'?calMonth:'')}
function currentEvents(){if(typeof CAL==='undefined'||!CAL?.events)return[];const month=selectedMonth();return CAL.events.filter(e=>String(e.datetime_kst||e.date||'').startsWith(month))}
function numeric(v){if(v==null)return null;const s=String(v).replace(/,/g,'').trim();const m=s.match(/[-+]?\d+(?:\.\d+)?/);if(!m)return null;let n=Number(m[0]);if(!Number.isFinite(n))return null;if(/\bK\b/i.test(s))n*=1e3;else if(/\bM\b/i.test(s))n*=1e6;else if(/\bB\b/i.test(s))n*=1e9;return n}
function surpriseLabel(row){const a=numeric(row.actual),c=numeric(row.consensus);if(a==null||c==null)return'—';const scale=Math.max(1,Math.abs(a),Math.abs(c));if(Math.abs(a-c)<=scale*1e-6)return'일치';return a>c?'상회':'하회'}
function refsFor(e){const out=[];for(const m of(e.market_metrics||[])){if(!m||m.metric_type==='market_probability_snapshot'||!m.history_ref)continue;const b=HISTORY?.series?.[m.history_ref];if(b&&(b.rows?.length||b.count))out.push({ref:m.history_ref,label:m.label||m.key,bucket:b})}if(!out.length&&e.history_ref){const b=HISTORY?.series?.[e.history_ref];if(b&&(b.rows?.length||b.count))out.push({ref:e.history_ref,label:e.title,bucket:b})}return out}
function countFor(e){return refsFor(e).reduce((n,x)=>n+(x.bucket.count||x.bucket.rows?.length||0),0)}
function table(group){const rows=[...(group.bucket.rows||[])].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));return `<section class="obsHistGroup"><div class="obsHistGroupHead"><b>${esc(group.label)}</b><span>${rows.length}회</span></div><div class="obsHistTable"><div class="obsHistRow head"><div>발표일</div><div>이전</div><div>예측</div><div>실제</div><div>대비</div></div>${rows.map(r=>`<div class="obsHistRow"><div>${esc(String(r.date||'').slice(2))}</div><div>${esc(value(r.previous))}</div><div>${esc(forecastValue(r.consensus))}</div><div>${esc(value(r.actual))}</div><div>${esc(surpriseLabel(r))}</div></div>`).join('')}</div></section>`}
function historyHtml(e){if(!HISTORY)return'<div class="obsHistEmpty">10년 이력을 불러오는 중입니다.</div>';const groups=refsFor(e);const full=HISTORY.coverage_status==='FULL';const coverage=full?'최근 10년 수집구간 확보 · 지표별 완전성 검증 전':`최근 10년 백필 진행 중 (${esc(HISTORY.coverage_status||'PARTIAL')})`;const range=[HISTORY.available_from,HISTORY.available_to].filter(Boolean).join(' → ');if(!groups.length)return`<div class="obsHistMeta">${esc(coverage)}${range?' · '+esc(range):''}</div><div class="obsHistEmpty">이 일정의 확인 가능한 과거 발표값은 아직 없습니다. 과거 원본과 신규 발표값을 계속 누적합니다.</div>`;return `<div class="obsHistMeta">${esc(coverage)}${range?' · '+esc(range):''} · 이전/예측/실제는 확인된 값만 표시 · 예측값 없음은 ‘미발표’</div>${groups.map(table).join('')}`}
function normalizeMissingLabels(row,e){const metricRows=[...row.querySelectorAll('.obsMetricRow')];if(metricRows.length){const ms=(e.market_metrics||[]).filter(m=>m&&m.label);metricRows.forEach((r,i)=>{const m=ms[i];if(!m)return;const forecast=r.querySelector('.forecast b');if(forecast&&forecast.textContent.trim()==='—'&&missing(m.consensus))forecast.textContent='미발표';const prev=r.querySelector('.obsPrev b');if(prev&&prev.textContent.trim()==='—'&&m.previous_source==='CALENDAR_HISTORY_LAST_ACTUAL')prev.textContent=value(m.previous)})}else{const metrics=[...row.querySelectorAll('.obsEventMetrics span')];if(metrics[1]){const b=metrics[1].querySelector('b');if(b&&b.textContent.trim()==='—'&&missing(e.consensus))b.textContent='미발표'}}}
function decorate(){const rows=[...document.querySelectorAll('#events .event')],events=currentEvents();rows.forEach((row,i)=>{const e=events[i];if(!e)return;normalizeMissingLabels(row,e);const host=row.querySelector('.obsEventMain')||row.children[2]||row;let line=host.querySelector('.obsHistLine');if(!line){line=document.createElement('div');line.className='obsHistLine';host.appendChild(line)}let btn=line.querySelector('.obsHistBtn');if(!btn){btn=document.createElement('button');btn.className='obsHistBtn';line.appendChild(btn);btn.onclick=async ev=>{ev.preventDefault();ev.stopPropagation();let panel=host.querySelector('.obsHistPanel');if(!panel){panel=document.createElement('div');panel.className='obsHistPanel';host.appendChild(panel)}const opening=!panel.classList.contains('on');panel.classList.toggle('on',opening);btn.classList.toggle('on',opening);if(opening){panel.innerHTML='<div class="obsHistEmpty">이력을 불러오는 중입니다.</div>';try{await loadEventHistory(e);if(panel.classList.contains('on'))panel.innerHTML=historyHtml(e)}catch(err){if(panel.classList.contains('on'))panel.innerHTML='<div class="obsHistEmpty">이력을 불러오지 못했습니다. 잠시 후 다시 눌러주세요.</div>';console.warn(err)}}}}const n=HISTORY?countFor(e):0;btn.textContent=n?`최근 10년 이력 ${n}건`:'최근 10년 이력';btn.title='같은 일정/세부지표의 최근 약 10년 이전·예측·실제값';const panel=host.querySelector('.obsHistPanel.on');if(panel)panel.innerHTML=historyHtml(e)})}
async function loadHistory(force=false){
 if(HISTORY&&!force)return HISTORY;if(loading&&!force)return loading;
 loading=(async()=>{try{const r=await fetch('./data/calendar-history-index.json?cb='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error('index '+r.status);const j=await r.json();if(j.schema!=='JJOONI_CALENDAR_HISTORY_INDEX_V1')throw new Error('index schema');HISTORY=j;decorate();return j}catch(e){console.warn('calendar index unavailable',e);return null}finally{loading=null}})();return loading
}
async function loadEventHistory(e){
 await loadHistory();
 // Backward-compatible full archive is fetched only after an explicit history click.
 if(!HISTORY){const r=await fetch('./data/economic-calendar-history.json?cb='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error('history '+r.status);const j=await r.json();if(j.schema!=='JJOONI_ECONOMIC_CALENDAR_HISTORY_V1')throw new Error('history schema');HISTORY=j;return}
 const snapshot=HISTORY.snapshot_id;
 await Promise.all(refsFor(e).map(async group=>{
  const bucket=group.bucket;if(bucket.rows)return;
  const key=snapshot+'::'+group.ref;
  if(!seriesLoading.has(key))seriesLoading.set(key,(async()=>{
   const url=new URL(bucket.path,new URL('./data/',location.href));
   if(url.origin!==location.origin||!url.pathname.includes('/calendar-history/series/'))throw new Error('invalid series path');
   const r=await fetch(url);if(!r.ok)throw new Error('series '+r.status);
   const raw=await r.arrayBuffer();
   const hash=await crypto.subtle.digest('SHA-256',raw);
   const digest=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
   if(digest!==bucket.sha256)throw new Error('series checksum mismatch');
   const j=JSON.parse(new TextDecoder().decode(raw));
   if(j.schema!=='JJOONI_CALENDAR_HISTORY_SERIES_V1'||j.ref!==group.ref)throw new Error('series identity mismatch');
   if(HISTORY.snapshot_id!==snapshot)throw new Error('history snapshot changed');
   Object.assign(bucket,j.bucket);
  })().finally(()=>seriesLoading.delete(key)));
  await seriesLoading.get(key);
 }));
}

function hook(){const base=window.renderCalendar;if(typeof base!=='function'||base.__obsHistoryHooked)return false;const wrapped=function(){const r=base.apply(this,arguments);setTimeout(decorate,0);return r};wrapped.__obsHistoryHooked=true;window.renderCalendar=wrapped;return true}
function init(){let n=0;const tick=()=>{n++;if(hook()){setTimeout(decorate,0);return}if(n<100)setTimeout(tick,100)};tick()}
const style=document.createElement('style');style.textContent=`
.obsHistLine{margin-top:6px;display:flex;gap:6px;flex-wrap:wrap}.obsHistBtn{border:1px solid #bfd2ea;background:#f6f9fe;color:#0b3b70;border-radius:7px;padding:4px 8px;font-size:9px;font-weight:900}.obsHistBtn.on{background:#0b3b70;color:#fff;border-color:#0b3b70}.obsHistPanel{display:none;margin-top:8px;border:1px solid #dce5ef;border-radius:11px;background:#fff;overflow:hidden}.obsHistPanel.on{display:block}.obsHistMeta{padding:8px 9px;background:#f8fafc;color:#667085;font-size:9px;border-bottom:1px solid #e8edf3}.obsHistEmpty{padding:12px 9px;color:#718096;font-size:10px}.obsHistGroup{border-top:1px solid #e8edf3}.obsHistGroup:first-of-type{border-top:0}.obsHistGroupHead{display:flex;justify-content:space-between;gap:8px;padding:8px 9px;background:#fbfcfe;font-size:10px}.obsHistGroupHead span{color:#718096}.obsHistTable{max-height:420px;overflow:auto}.obsHistRow{display:grid;grid-template-columns:82px repeat(4,minmax(72px,1fr));font-size:9px;border-top:1px solid #eef2f6}.obsHistRow>div{padding:6px 7px;border-left:1px solid #eef2f6;overflow-wrap:anywhere}.obsHistRow>div:first-child{border-left:0;font-weight:800}.obsHistRow.head{position:sticky;top:0;z-index:1;background:#f4f7fb;font-weight:900;color:#526172}.obsHistRow:not(.head)>div:nth-child(3){background:#f6f8ff}.obsHistRow:not(.head)>div:nth-child(4){background:#f2fbf6}@media(max-width:600px){.obsHistRow{grid-template-columns:62px repeat(4,minmax(58px,1fr));font-size:8px}.obsHistRow>div{padding:6px 4px}.obsHistTable{overflow:auto;max-height:360px}.obsHistGroupHead{font-size:9px}}
`;document.head.appendChild(style);init();window.__JJOONI_CALENDAR_HISTORY={version:'3.0',window_days:3650,window_years:10,contract:'ALL_EVENTS_EVENT_AND_METRIC_HISTORY_10Y'};
})();

