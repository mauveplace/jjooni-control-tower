(()=>{
'use strict';
const RAW={};
const RANGE_ORDER=['1M','3M','6M','1Y','3Y','5Y','10Y','20Y','30Y','ALL'];
const DAYS={'1M':31,'3M':92,'6M':184,'1Y':366,'3Y':1096,'5Y':1827,'10Y':3653,'20Y':7306,'30Y':10958,'ALL':999999};
const LONG_RANGES=new Set(['5Y','10Y','20Y','30Y','ALL']);
const active={};
const CURVE_IDS=new Set();
const CURVE_MODES=[
  {key:'NOW',label:'현재'},
  {key:'1M',label:'1개월 전'},
  {key:'3M',label:'3개월 전'},
  {key:'1Y',label:'1년 전'},
  {key:'ALL',label:'전체'}
];
const curveActive={usCurve:'ALL',jpCurve:'ALL'};
let fullChart=null,historyState='idle',historyPromise=null;

function fullCommon(keys){
  const map=new Map();
  if(typeof DATA==='undefined'||!DATA?.series)return[];
  for(const k of keys)for(const p of(DATA.series[k]||[])){
    if(!p?.date)continue;
    if(!map.has(p.date))map.set(p.date,{date:p.date});
    map.get(p.date)[k]=p.value;
  }
  return[...map.values()].sort((a,b)=>String(a.date).localeCompare(String(b.date)));
}
try{globalThis.common=fullCommon}catch(_){}

function cutoffFor(labels,range){
  if(range==='ALL'||!labels?.length)return null;
  const last=String(labels[labels.length-1]);
  const d=new Date(last+'T00:00:00Z');
  if(Number.isNaN(d.getTime()))return null;
  d.setUTCDate(d.getUTCDate()-DAYS[range]);
  return d.toISOString().slice(0,10);
}
function filtered(labels,sets,range){
  const cut=cutoffFor(labels,range);
  if(!cut)return{labels,sets};
  let i=labels.findIndex(x=>String(x)>=cut);
  if(i<0)i=0;
  return{labels:labels.slice(i),sets:sets.map(s=>({...s,data:(s.data||[]).slice(i)}))};
}
function tickLabel(raw,range){
  const s=String(raw??'');
  if(!/^\d{4}-\d{2}-\d{2}/.test(s))return s;
  if(['1M','3M','6M'].includes(range))return s.slice(5,10);
  if(['1Y','3Y'].includes(range))return s.slice(0,7).replace('-','.');
  return s.slice(0,4);
}
function tickLimit(range){
  if(['1M','3M','6M'].includes(range))return 6;
  if(['1Y','3Y'].includes(range))return 7;
  return 6;
}
function chartConfig(labels,sets,range='5Y'){
  return{
    type:'line',
    data:{labels,datasets:sets.map(x=>({label:x.label,data:x.data,borderWidth:2,pointRadius:0,tension:.12,spanGaps:true}))},
    options:{
      responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},animation:false,
      layout:{padding:{bottom:2}},
      plugins:{
        legend:{display:true,position:'bottom',labels:{boxWidth:12,font:{size:10}}},
        zoom:{limits:{x:{min:'original',max:'original'}},pan:{enabled:true,mode:'x'},zoom:{wheel:{enabled:true,speed:.08},pinch:{enabled:true},mode:'x'}}
      },
      scales:{
        x:{
          ticks:{display:true,color:'#667085',padding:6,maxTicksLimit:tickLimit(range),maxRotation:0,minRotation:0,font:{size:9},callback:function(v){return tickLabel(this.getLabelForValue(v),range)}},
          grid:{color:'#eef2f6',drawTicks:true},border:{color:'#cfd8e3'}
        },
        y:{ticks:{maxTicksLimit:6,font:{size:9},color:'#667085'},grid:{color:'#e8edf3'},border:{color:'#cfd8e3'}}
      }
    }
  };
}

function curveModeLabel(mode){return (CURVE_MODES.find(x=>x.key===mode)||{}).label||mode}
function curveFiltered(id){
  const r=RAW[id];
  if(!r)return{labels:[],sets:[]};
  const sets=r.sets||[],mode=curveActive[id]||'ALL';
  if(mode==='ALL')return{labels:r.labels||[],sets};
  const current=sets.find(s=>String(s.label||'').includes('현재'))||sets[0];
  if(mode==='NOW')return{labels:r.labels||[],sets:current?[current]:[]};
  const wanted={1:'1개월 전',3:'3개월 전',Y:'1년 전'};
  const targetLabel=mode==='1M'?wanted[1]:mode==='3M'?wanted[3]:wanted.Y;
  const target=sets.find(s=>String(s.label||'').includes(targetLabel));
  return{labels:r.labels||[],sets:[current,target].filter(Boolean)};
}
function curveChartConfig(labels,sets){
  return{
    type:'line',
    data:{labels,datasets:sets.map((x,i)=>({
      label:x.label,data:x.data,borderWidth:i===0?3:2,pointRadius:3,pointHoverRadius:5,tension:.08,spanGaps:true
    }))},
    options:{
      responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},animation:false,
      plugins:{
        legend:{display:true,position:'bottom',labels:{boxWidth:12,font:{size:10}}},
        tooltip:{callbacks:{label:ctx=>`${ctx.dataset.label}: ${Number(ctx.parsed.y).toFixed(2)}%`}}
      },
      scales:{
        x:{title:{display:true,text:'만기'},ticks:{color:'#667085',font:{size:10}},grid:{color:'#eef2f6'},border:{color:'#cfd8e3'}},
        y:{title:{display:true,text:'금리 (%)'},ticks:{maxTicksLimit:6,font:{size:9},color:'#667085',callback:v=>Number(v).toFixed(2)+'%'},grid:{color:'#e8edf3'},border:{color:'#cfd8e3'}}
      }
    }
  };
}
function tenorIndex(labels,years){
  const re=new RegExp('^'+years+'(?:\\s*(?:Y|Yr|Year|년))','i');
  return (labels||[]).findIndex(x=>re.test(String(x).trim()));
}
function curveDeltaText(id){
  const r=RAW[id];if(!r?.labels?.length)return'';
  const mode=curveActive[id]||'ALL';
  if(mode==='ALL')return '전체 비교 · 현재 / 1개월 전 / 3개월 전 / 1년 전 · x축=만기 · y축=금리(%)';
  if(mode==='NOW')return '현재 곡선만 표시 · x축=만기 · y축=금리(%)';
  const f=curveFiltered(id),cur=f.sets[0],prev=f.sets[1];
  if(!cur||!prev)return `현재 vs ${curveModeLabel(mode)} · 비교 데이터 대기`;
  const bits=[];
  for(const y of [2,10,30]){
    const i=tenorIndex(r.labels,y);
    const a=Number(cur.data?.[i]),b=Number(prev.data?.[i]);
    if(i>=0&&Number.isFinite(a)&&Number.isFinite(b)){
      const bp=(a-b)*100;
      bits.push(`${y}Y ${bp>=0?'+':''}${bp.toFixed(0)}bp`);
    }
  }
  return `현재 vs ${curveModeLabel(mode)}${bits.length?' · '+bits.join(' · '):''}`;
}

function ensureFullscreen(){
  let o=document.getElementById('obsFullChart');if(o)return o;
  o=document.createElement('div');o.id='obsFullChart';
  o.innerHTML='<div class="obsFullHead"><b id="obsFullTitle">차트 크게 보기</b><button id="obsFullReset">줌 초기화</button><button id="obsFullClose">닫기 ✕</button></div><div class="obsFullBody"><canvas id="obsFullCanvas"></canvas></div><div class="obsFullHint">두 손가락 확대/축소 · 좌우 드래그 이동 · 기기를 가로로 돌리면 더 넓게 볼 수 있습니다.</div>';
  document.body.appendChild(o);
  o.querySelector('#obsFullClose').onclick=closeFullscreen;
  o.querySelector('#obsFullReset').onclick=()=>{try{fullChart?.resetZoom()}catch(_){}};
  o.addEventListener('click',e=>{if(e.target===o)closeFullscreen()});
  return o;
}
function openFullscreen(id){
  const r=RAW[id];if(!r)return;
  const o=ensureFullscreen();
  o.classList.add('on');document.body.classList.add('obsNoScroll');
  const title=document.querySelector(`#${id}`)?.closest('.card')?.querySelector('h3')?.textContent||id;
  if(fullChart)fullChart.destroy();
  if(CURVE_IDS.has(id)){
    const f=curveFiltered(id),mode=curveActive[id]||'ALL';
    o.querySelector('#obsFullTitle').textContent=title+' · '+curveModeLabel(mode);
    fullChart=new Chart(o.querySelector('#obsFullCanvas'),curveChartConfig(f.labels,f.sets));
  }else{
    const range=active[id]||'5Y',f=filtered(r.labels,r.sets,range);
    o.querySelector('#obsFullTitle').textContent=title+' · '+range;
    fullChart=new Chart(o.querySelector('#obsFullCanvas'),chartConfig(f.labels,f.sets,range));
  }
}
function closeFullscreen(){
  const o=document.getElementById('obsFullChart');if(o)o.classList.remove('on');
  document.body.classList.remove('obsNoScroll');
  if(fullChart){fullChart.destroy();fullChart=null}
}
function coverageText(id){
  const r=RAW[id];if(!r?.labels?.length)return'';
  if(CURVE_IDS.has(id))return curveDeltaText(id);
  const range=active[id]||'5Y',f=filtered(r.labels,r.sets,range);
  if(!f.labels.length)return'';
  const first=f.labels[0],last=f.labels[f.labels.length-1];
  const suffix=historyState==='loading'?' · 장기이력 로딩중':historyState==='error'&&LONG_RANGES.has(range)?' · 장기이력 재시도 필요':'';
  return `${range} 표시 ${first} → ${last} · ${f.labels.length.toLocaleString()}pt${suffix}`;
}
function refreshCoverage(id){const el=document.querySelector(`[data-coverage="${id}"]`);if(el)el.textContent=coverageText(id)}
function refreshAllCoverage(){Object.keys(RAW).forEach(refreshCoverage)}
function ensureCurveToolbar(id){
  const canvas=document.getElementById(id);if(!canvas||canvas.dataset.rangeReady)return;
  canvas.dataset.rangeReady='1';
  const wrap=canvas.parentElement,bar=document.createElement('div');bar.className='range obsRange obsCurveRange';bar.dataset.for=id;
  for(const m of CURVE_MODES){
    const b=document.createElement('button');b.textContent=m.label;b.dataset.curveMode=m.key;b.classList.toggle('on',(curveActive[id]||'ALL')===m.key);
    b.onclick=()=>{
      curveActive[id]=m.key;
      bar.querySelectorAll('button[data-curve-mode]').forEach(x=>x.classList.toggle('on',x===b));
      redraw(id);refreshCoverage(id);
    };
    bar.appendChild(b);
  }
  const full=document.createElement('button');full.textContent='⛶ 크게 보기';full.className='obsFullBtn';full.onclick=()=>openFullscreen(id);bar.appendChild(full);
  const cov=document.createElement('span');cov.className='obsCoverage obsCurveSummary';cov.dataset.coverage=id;cov.textContent=coverageText(id);
  wrap.insertBefore(bar,canvas);wrap.insertBefore(cov,canvas);
}
function ensureToolbar(id){
  if(CURVE_IDS.has(id)){ensureCurveToolbar(id);return}
  const canvas=document.getElementById(id);if(!canvas||canvas.dataset.rangeReady)return;
  canvas.dataset.rangeReady='1';
  const wrap=canvas.parentElement,bar=document.createElement('div');bar.className='range obsRange';bar.dataset.for=id;
  for(const r of RANGE_ORDER){
    const b=document.createElement('button');b.textContent=r;b.dataset.range=r;b.classList.toggle('on',(active[id]||'5Y')===r);
    b.onclick=async()=>{
      active[id]=r;
      bar.querySelectorAll('button[data-range]').forEach(x=>x.classList.toggle('on',x===b));
      refreshCoverage(id);
      if(LONG_RANGES.has(r)&&historyState!=='loaded')await hydrateHistory(historyState==='error');
      redraw(id);
    };
    bar.appendChild(b);
  }
  const reset=document.createElement('button');reset.textContent='줌 초기화';reset.onclick=()=>{try{charts[id]?.resetZoom()}catch(_){}};bar.appendChild(reset);
  const full=document.createElement('button');full.textContent='⛶ 크게 보기';full.className='obsFullBtn';full.onclick=()=>openFullscreen(id);bar.appendChild(full);
  const note=document.createElement('span');note.className='meta obsGesture';note.textContent='휠/핀치 확대 · 드래그 이동';bar.appendChild(note);
  const cov=document.createElement('span');cov.className='obsCoverage';cov.dataset.coverage=id;cov.textContent=coverageText(id);
  wrap.insertBefore(bar,canvas);wrap.insertBefore(cov,canvas);
}
function draw(id,labels,sets){
  if(charts[id])charts[id].destroy();
  const c=document.getElementById(id);if(!c)return;
  if(CURVE_IDS.has(id)){
    const f=curveFiltered(id);
    charts[id]=new Chart(c,curveChartConfig(f.labels,f.sets));
    ensureToolbar(id);refreshCoverage(id);return;
  }
  const range=active[id]||'5Y',f=filtered(labels,sets,range);
  charts[id]=new Chart(c,chartConfig(f.labels,f.sets,range));
  ensureToolbar(id);refreshCoverage(id);
}
function redraw(id){const r=RAW[id];if(r)draw(id,r.labels,r.sets)}
window.chart=function(id,labels,sets){RAW[id]={labels:[...(labels||[])],sets:(sets||[]).map(s=>({...s,data:[...(s.data||[])]}))};draw(id,labels,sets)};

function val(v){return v==null||v===''?'—':String(v)}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]))}
function eventMetricsHtml(e){
  const ms=(e.market_metrics||[]).filter(m=>m&&m.label);
  if(ms.length)return `<div class="obsMetricTable">${ms.map(m=>{const market=m.metric_type==='market_probability_snapshot';return `<div class="obsMetricRow"><div class="obsMetricName">${esc(m.label)}</div><div class="obsPrev">${market?'1거래일 전':'이전'} <b>${esc(val(m.previous))}</b></div><div class="forecast">${market?'현재 시장예측':'예측'} <b>${esc(val(m.consensus))}</b></div><div class="actual">${market?'발표 결과':'실제'} <b>${esc(val(m.actual))}</b></div></div>`}).join('')}</div>`;
  return `<div class="obsEventMetrics"><span>이전 <b>${esc(val(e.previous))}</b></span><span>예측 <b>${esc(val(e.consensus))}</b></span><span>실제 <b>${esc(val(e.actual))}</b></span></div>`;
}
function releasedActual(e){const ms=(e.market_metrics||[]).filter(Boolean);if(ms.length)return ms.some(m=>m.metric_type!=='market_probability_snapshot'&&m.actual!=null&&m.actual!=='');return e.actual!=null&&e.actual!==''}
function eventStatus(e){const t=Date.parse(e.datetime_kst||e.date||'');if(Number.isFinite(t)&&Date.now()<t)return'<span class="obsPending">예정</span>';if(releasedActual(e))return'<span class="obsDone">발표완료</span>';if(Number.isFinite(t)&&Date.now()-t<=86400000)return'<span class="obsAwaiting">결과 대기</span>';return'<span class="obsMissing">값 미수집</span>'}
window.renderCalendar=function(){
  if(typeof CAL==='undefined')return;
  const month=typeof calMonth!=='undefined'?calMonth:new Date().toISOString().slice(0,7);
  const title=document.querySelector('#calendarMonth');if(title)title.textContent=month;
  const xs=(CAL.events||[]).filter(e=>String(e.datetime_kst||e.date||'').startsWith(month));
  const box=document.querySelector('#events');if(!box)return;
  box.innerHTML=xs.length?xs.map(e=>{
    const dt=(e.datetime_kst||e.date||'').slice(5,16).replace('T',' '),status=eventStatus(e);
    return `<div class="event"><div class="date">${esc(dt)}</div><div class="country">${esc(e.country)}</div><div class="obsEventMain"><div class="event-title">${esc(e.title)}</div><div class="event-meta">${esc(e.category||'')}${e.reference_period?' · '+esc(e.reference_period):''} · ${status}</div>${eventMetricsHtml(e)}</div><div class="importance">${'★'.repeat(e.importance||1)}<div class="source">${esc(e.source||'')}${e.market_data_source?' · '+esc(e.market_data_source):''}</div></div></div>`;
  }).join(''):'<div class="meta" style="padding:20px 0">등록된 일정이 없습니다.</div>';
};

function mergeSeries(base,recent){
  const m=new Map();
  for(const x of(base||[]))if(x?.date)m.set(x.date,x);
  for(const x of(recent||[]))if(x?.date)m.set(x.date,x);
  return[...m.values()].sort((a,b)=>String(a.date).localeCompare(String(b.date)));
}
async function hydrateHistory(force=false){
  if(historyState==='loaded')return true;
  if(historyPromise&&!force)return historyPromise;
  historyState='loading';refreshAllCoverage();
  historyPromise=(async()=>{
    try{
      const h=await fetch('./data/history-lite.json?v=1',{cache:'force-cache'}).then(r=>r.ok?r.json():Promise.reject(new Error('history-lite '+r.status)));
      if(h?.schema!=='JJOONI_MARKET_HISTORY_LITE_V1')throw new Error('history-lite schema');
      if(typeof DATA==='undefined'||!DATA)throw new Error('DATA unavailable');
      const merged={},hs=h.series||{},rs=DATA.series||{};
      for(const k of new Set([...Object.keys(hs),...Object.keys(rs)]))merged[k]=mergeSeries(hs[k],rs[k]);
      DATA.series=merged;DATA.history_loaded=true;DATA.history_sampling=h.sampling||null;DATA.history_base_generated_kst=h.generated_from||null;
      historyState='loaded';
      try{globalThis.common=fullCommon}catch(_){}
      if(typeof render==='function')render();
      refreshAllCoverage();
      return true;
    }catch(e){
      historyState='error';console.warn('30Y history lite unavailable',e);refreshAllCoverage();return false;
    }finally{historyPromise=null;window.__JJOONI_OBSERVATORY_UI.history_state=historyState}
  })();
  return historyPromise;
}

const style=document.createElement('style');style.textContent=`
html,body{max-width:100%;overflow-x:hidden}.wrap,.panel,.grid,.card,.chart,.events,.event,.obsEventMain{min-width:0}.card{overflow:hidden}.chart{width:100%;max-width:100%;padding-bottom:2px}.chart canvas{max-width:100%!important}.tabs{-webkit-overflow-scrolling:touch;scrollbar-width:none}.tabs::-webkit-scrollbar{display:none}.pulse{min-width:0}.chip{white-space:nowrap}.kpi{min-width:0}.kpi b{overflow-wrap:anywhere}.calendar-head>div:first-child{min-width:0}.calendar-head h3,.event-title,.event-meta,.source{overflow-wrap:anywhere;word-break:keep-all}
.obsRange{align-items:center;margin:8px 0 2px;overflow-x:auto;flex-wrap:nowrap;padding-bottom:5px;-webkit-overflow-scrolling:touch;scrollbar-width:none}.obsRange::-webkit-scrollbar{display:none}.obsRange button{white-space:nowrap;flex:0 0 auto;min-height:30px}.obsFullBtn{font-weight:900!important}.obsGesture{align-self:center;white-space:nowrap}.obsCoverage{display:block;margin:2px 0 5px;color:#718096;font-size:9px;line-height:1.35;font-weight:650}.obsCurveSummary{font-size:10px;color:#506176}.obsCurveRange button.on{box-shadow:inset 0 0 0 1px rgba(25,77,137,.08)}.obsEventMetrics{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;font-size:10px}.obsEventMetrics span{background:#f6f8fb;border:1px solid #e7ecf2;padding:5px 7px;border-radius:7px;min-width:0}.obsEventMetrics b{margin-left:3px}.event{align-items:start}.obsNoScroll{overflow:hidden!important}.obsDone{color:#087443;font-weight:900}.obsPending{color:#718096}.obsAwaiting{color:#b54708;font-weight:900}.obsMissing{color:#b42318;font-weight:900}.obsMetricTable{margin-top:7px;border:1px solid #e7ecf2;border-radius:10px;overflow:hidden;width:100%;max-width:680px}.obsMetricRow{display:grid;grid-template-columns:minmax(120px,1.35fr) repeat(3,minmax(72px,.8fr));background:#fff;font-size:10px;border-top:1px solid #eef2f6}.obsMetricRow:first-child{border-top:0}.obsMetricRow>div{padding:6px 7px;border-left:1px solid #eef2f6;min-width:0;overflow-wrap:anywhere}.obsMetricRow>div:first-child{border-left:0}.obsMetricName{font-weight:900;color:#27364a}.obsMetricRow .forecast{background:#f4f7ff}.obsMetricRow .actual{background:#f1fbf5}.obsMetricRow b{margin-left:3px}
#obsFullChart{display:none;position:fixed;inset:0;z-index:9999;background:#f4f7fb;padding:10px;flex-direction:column}#obsFullChart.on{display:flex}.obsFullHead{display:flex;align-items:center;gap:8px;padding:5px 2px 10px;min-width:0}.obsFullHead b{flex:1;font-size:14px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.obsFullHead button{border:1px solid #d8e0e9;background:#fff;border-radius:9px;padding:7px 10px;font-weight:850;flex:0 0 auto}.obsFullBody{flex:1;min-height:0;min-width:0;background:#fff;border:1px solid #e5ebf2;border-radius:14px;padding:8px}.obsFullBody canvas{width:100%!important;height:100%!important;max-width:100%!important}.obsFullHint{padding:7px 3px 1px;color:#718096;font-size:10px;text-align:center}
@media(min-width:761px) and (max-width:1100px){.wrap{padding:12px}.grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.card{padding:12px}.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.chart{height:330px!important}.event{grid-template-columns:78px 54px minmax(0,1fr) auto;gap:7px}.obsMetricRow{grid-template-columns:minmax(110px,1.2fr) repeat(3,minmax(66px,.8fr))}.tabs button{padding:8px 10px}}
@media(max-width:760px){.top{padding:12px 12px 10px}.brand{font-size:17px}.sub{font-size:10px}.pulse{gap:5px;margin-top:8px}.chip{font-size:9px;padding:5px 7px}.tabs{top:90px;padding:8px 10px;gap:5px}.tabs button{padding:8px 10px;font-size:11px}.wrap{padding:10px}.grid{grid-template-columns:1fr!important;gap:10px}.card{padding:11px;border-radius:14px}.card h3{font-size:14px}.kpis{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.kpi{padding:8px}.kpi b{font-size:13px}.chart{height:360px!important;margin-top:6px}.chart canvas{min-height:330px}.obsRange{margin:7px -1px 2px}.obsRange .obsGesture{display:none}.obsRange button{font-size:9px;padding:5px 7px}.obsCoverage{font-size:8px}.calendar-head{align-items:flex-start}.calendar-head>div:last-child{display:flex;gap:4px;flex:0 0 auto}.calendar-head button{padding:7px 9px}.event{grid-template-columns:minmax(0,1fr) auto!important;gap:5px 8px;padding:11px 0!important}.event .date{grid-column:1;font-size:11px}.event .country{grid-column:2;justify-self:end}.event .obsEventMain,.event>div:nth-child(3){grid-column:1/-1;min-width:0}.event .importance{grid-column:1/-1!important;display:flex;justify-content:space-between;align-items:center;gap:8px;white-space:normal}.event .source{display:block!important;text-align:right;max-width:75%;font-size:8px}.event-title{font-size:12px;line-height:1.35}.event-meta{font-size:9px}.obsMetricTable{max-width:none;border-radius:9px;overflow:hidden}.obsMetricRow{grid-template-columns:repeat(3,minmax(0,1fr));font-size:9px}.obsMetricName{grid-column:1/-1;background:#f8fafc;border-left:0!important;border-bottom:1px solid #eef2f6}.obsMetricRow>div{padding:6px 5px;white-space:normal}.obsPrev{border-left:0!important}.obsEventMetrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px}.obsEventMetrics span{text-align:center;padding:5px 3px}.foot{padding:16px 12px 28px}#obsFullChart{padding:max(8px,env(safe-area-inset-top)) 8px max(8px,env(safe-area-inset-bottom))}.obsFullBody{min-height:68vh}.obsFullHead button{padding:8px 9px;font-size:10px}.obsFullHead b{font-size:12px}}
@media(max-width:430px){.chart{height:380px!important}.obsFullBody{min-height:72vh}.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.calendar-head h3{font-size:13px}.calendar-head .meta{font-size:9px}}
@media(max-width:350px){.kpis{grid-template-columns:1fr}.tabs button{padding:7px 8px}.obsMetricRow{grid-template-columns:1fr}.obsMetricName,.obsPrev,.obsMetricRow .forecast,.obsMetricRow .actual{grid-column:1}.obsMetricRow>div{border-left:0!important;border-top:1px solid #eef2f6}.obsMetricName{border-top:0}}
@media(orientation:landscape) and (max-height:600px){#obsFullChart{padding:6px}.obsFullHead{padding-bottom:5px}.obsFullHint{display:none}.obsFullBody{min-height:0}}
`;document.head.appendChild(style);
window.addEventListener('keydown',e=>{if(e.key==='Escape')closeFullscreen()});
window.addEventListener('load',()=>{
  try{globalThis.common=fullCommon}catch(_){}
  document.querySelectorAll('canvas').forEach(c=>ensureToolbar(c.id));
  try{if(typeof renderCalendar==='function')renderCalendar()}catch(_){}
  setTimeout(()=>hydrateHistory(false),80);
});
window.__JJOONI_OBSERVATORY_UI={version:'2.8.0-yield-maturity-trends',responsive:true,history_common:'LITE_30Y_PLUS_RECENT',history_state:historyState,ranges:RANGE_ORDER,yield_chart:'MATURITY_TIME_SERIES',x_axis_dates:true};
})();
