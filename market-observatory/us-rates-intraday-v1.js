(function(root){
'use strict';
const TENORS={US13W:'13주 단기물',US5Y:'5년물',US10Y:'10년물',US30Y:'30년물'};
const GRAINS={intraday:'일중',daily:'일간',weekly:'주간',monthly:'월간'};
const formatDate=zone=>new Intl.DateTimeFormat('sv-SE',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'});
const kst=formatDate('Asia/Seoul'),ny=formatDate('America/New_York');
const fullClock=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
function day(stamp,basis='kst'){return (basis==='ny'?ny:kst).format(new Date(stamp*1000));}
function rowsForDay(points,date,basis='kst'){return (points||[]).filter(p=>day(p.timestamp,basis)===date).sort((a,b)=>a.timestamp-b.timestamp);}
function periodKey(stamp,grain){
  const date=day(stamp,'ny');if(grain==='monthly')return date.slice(0,7);
  if(grain==='weekly'){const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10);}
  return date;
}
function aggregate(points,grain){
  const periods=new Map();[...(points||[])].sort((a,b)=>a.timestamp-b.timestamp).forEach(p=>periods.set(periodKey(p.timestamp,grain),p));
  return [...periods.values()];
}
function historyRows(points,grain,end,months){
  // Filter before aggregation: never leak observations after the selected as-of date.
  const cutoff=new Date(end+'T00:00:00Z'),dateOfMonth=cutoff.getUTCDate();cutoff.setUTCDate(1);cutoff.setUTCMonth(cutoff.getUTCMonth()-months);const last=new Date(Date.UTC(cutoff.getUTCFullYear(),cutoff.getUTCMonth()+1,0)).getUTCDate();cutoff.setUTCDate(Math.min(dateOfMonth,last));const start=cutoff.toISOString().slice(0,10);
  return aggregate((points||[]).filter(p=>{const date=day(p.timestamp,'ny');return date>=start&&date<=end;}),grain);
}
function chartPoints(rows,mode,grain='intraday'){
  const first=rows[0]?.yield_pct,points=[];
  rows.forEach((p,i)=>{
    if(grain==='intraday'&&i&&p.timestamp-rows[i-1].timestamp>15*60)points.push({x:(rows[i-1].timestamp+300)*1000,y:null});
    points.push({x:p.timestamp*1000,y:mode==='bp'?(p.yield_pct-first)*100:p.yield_pct});
  });return points;
}
function axisLabel(value,grain){return grain==='intraday'?fullClock.format(new Date(value)).slice(5):day(value/1000,'ny');}
if(typeof module!=='undefined'&&module.exports){module.exports={day,rowsForDay,chartPoints,periodKey,aggregate,historyRows,axisLabel};return;}
const doc=root.document;if(!doc)return;
let host,data=null,inflight=null,chart=null,selected='US10Y',mode='yield',grain='intraday',basis='ny',months=12,date=day(Date.now()/1000,'ny'),dateChosen=false;
function available(){const source=data?.series?.[selected];return (grain==='intraday'?source?.points:source?.daily_points)||[];}
function dateBasis(){return grain==='intraday'?basis:'ny';}
function latest(){const points=available();if(points.length)date=day(points.at(-1).timestamp,dateBasis());}
function render(){
  if(!host)return;
  const source=data?.series?.[selected],points=available(),rows=grain==='intraday'?rowsForDay(points,date,basis):historyRows(points,grain,date,months),status=host.querySelector('[data-rate-status]');
  for(const [name,value] of [['tenor',selected],['mode',mode],['grain',grain],['basis',basis],['range',String(months)]])host.querySelectorAll('[data-rate-'+name+']').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset['rate'+name[0].toUpperCase()+name.slice(1)]===value)));
  host.querySelector('[data-rate-bases]').hidden=grain!=='intraday';host.querySelector('[data-rate-ranges]').hidden=grain==='intraday';
  const dateInput=host.querySelector('input');dateInput.value=date;dateInput.max=day(Date.now()/1000,dateBasis());
  dateInput.setAttribute('aria-label',grain==='intraday'?(basis==='ny'?'미국 거래일':'한국 관측 날짜'):'조회 종료일 (미국 거래일)');
  host.querySelector('[data-rate-date-label]').textContent=grain==='intraday'?(basis==='ny'?'미국 거래일':'한국 날짜'):'조회 종료일';
  const dates=points.map(p=>day(p.timestamp,dateBasis())).sort();if(dates.length)dateInput.min=dates[0];else dateInput.removeAttribute('min');
  host.querySelector('[data-rate-title]').textContent=TENORS[selected]+' · '+GRAINS[grain]+' · '+(grain==='intraday'?date:rows.length?day(rows[0].timestamp,'ny')+' → '+day(rows.at(-1).timestamp,'ny'):date)+(grain==='intraday'?(basis==='ny'?' (미국 거래일 · 시각 KST)':' (한국 날짜 · KST)'):' (미국 거래일)');
  const stamp=grain==='intraday'?source?.last_success_kst:source?.daily_last_success_kst,state=grain==='intraday'?source?.state:source?.daily_state;
  status.textContent=data?`수집 ${String(stamp||data.generated_kst||'').replace('T',' ').slice(0,16)} KST · 선택 구간 마지막 관측 ${rows.length?fullClock.format(new Date(rows.at(-1).timestamp*1000))+' KST':'없음'}${state!=='AVAILABLE'?' · 원천 수집 실패, 이전 관측 유지':''}`:'금리 관측 자료를 읽는 중…';
  const summary=host.querySelector('[data-rate-summary]');
  if(rows.length){const first=rows[0].yield_pct,last=rows.at(-1).yield_pct,values=rows.map(p=>p.yield_pct),change=(last-first)*100;
    summary.textContent=`마지막 ${last.toFixed(3)}% · 첫 관측 ${first.toFixed(3)}% · 변화 ${change>=0?'+':''}${change.toFixed(2)}bp · 최저 ${Math.min(...values).toFixed(3)}% · 최고 ${Math.max(...values).toFixed(3)}% · ${rows.length}개 관측`;
  }else summary.textContent=data?'선택한 기간에 저장된 관측이 없습니다. 최근 자료일 또는 다른 날짜를 선택해 주세요.':'자료를 읽는 중입니다.';
  let gaps=0;for(let i=1;i<rows.length;i++)if(rows[i].timestamp-rows[i-1].timestamp>900)gaps++;
  host.querySelector('[data-rate-explanation]').textContent=grain==='intraday'?(basis==='ny'?'미국 현지 날짜로 한 거래일을 모았습니다. 가로축은 날짜를 포함한 한국시간입니다.':'한국 날짜 하루에는 전일 미국장 마감과 당일 미국장 시작이 함께 들어갈 수 있습니다.')+(gaps?` · 15분 초과 관측 공백 ${gaps}곳: 휴장·거래 외 시간 또는 원천 미제공 구간이며 값을 채우지 않았습니다.`:' · 관측 시각 사이의 실제 간격을 표시합니다.'):'일간은 원천의 완료된 거래일 종가, 주간·월간은 각 기간의 마지막 실제 일간 관측값입니다. 마지막 주·월은 조회 종료일까지의 값이며, 휴일에는 관측점을 만들지 않습니다. 최저·최고는 화면에 표시한 관측값 기준입니다.';
  const canvas=host.querySelector('canvas');canvas.hidden=!rows.length;
  if(chart){chart.destroy();chart=null;}
  if(!rows.length||typeof root.Chart!=='function')return;
  chart=new root.Chart(canvas,{type:'line',data:{datasets:[{label:TENORS[selected],data:chartPoints(rows,mode,grain),borderColor:'#175cd3',borderWidth:2,pointRadius:rows.length===1?3:0,pointHitRadius:12,pointHoverRadius:4,spanGaps:false,tension:0}]},options:{responsive:true,maintainAspectRatio:false,parsing:false,animation:false,interaction:{mode:'nearest',axis:'x',intersect:false},plugins:{legend:{display:false},tooltip:{filter:c=>c.parsed.y!=null,callbacks:{title:items=>items.length?(grain==='intraday'?fullClock.format(new Date(items[0].parsed.x))+' KST':day(items[0].parsed.x/1000,'ny')+' 미국 거래일'):'',label:c=>mode==='bp'?c.parsed.y.toFixed(2)+'bp (표시 구간 첫 관측 대비)':c.parsed.y.toFixed(3)+'%'}}},scales:{x:{type:'linear',min:rows[0].timestamp*1000,max:rows.at(-1).timestamp*1000+(rows.length===1?300000:0),ticks:{maxTicksLimit:root.innerWidth<600?4:6,callback:value=>axisLabel(value,grain)},title:{display:true,text:grain==='intraday'?'날짜 · 한국시간 (KST)':'미국 거래일 · 기간 마지막 관측'}},y:{title:{display:true,text:mode==='bp'?'첫 관측 대비 (bp)':'수익률 (%)'},ticks:{callback:value=>Number(value).toFixed(mode==='bp'?1:3)}}}}});
}
async function load(){
  if(inflight)return inflight;
  const button=host.querySelector('[data-rate-read]');button.disabled=true;button.textContent='읽는 중…';
  inflight=(async()=>{try{
    const r=await fetch('./data/us-rates-intraday.json?cb='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error('HTTP '+r.status);
    const next=await r.json();if(next.schema!=='JJOONI_US_RATES_INTRADAY_V1')throw new Error('자료 형식 불일치');data=next;if(!dateChosen)latest();render();
  }catch(error){render();host.querySelector('[data-rate-status]').textContent='금리 자료 조회 실패 · 기존 관측 유지 · '+error.message;
  }finally{inflight=null;button.disabled=false;button.textContent='게시 자료 다시 읽기';}})();return inflight;
}
function buttons(values,key){return Object.entries(values).map(([k,v])=>`<button type="button" data-rate-${key}="${k}" aria-pressed="false">${v}</button>`).join('');}
function ensure(){
  const panel=doc.querySelector('#rates');if(!panel)return false;
  if(!host){
    host=doc.createElement('section');host.id='usRatesIntraday';host.className='card usRateIntraday';
    host.innerHTML=`<h3>미국 금리 · 기간별 흐름</h3><p class="usRateNote">동일한 시장 수익률 지수 · 일중 5분 / 과거 일간 관측 · 공식 일별 국채금리와 별도 자료</p><div class="usRateControls" aria-label="금리 만기">${buttons(TENORS,'tenor')}<a href="https://www.tradingview.com/symbols/TVC-US02Y/" target="_blank" rel="noopener noreferrer">2년물 원천 차트 ↗</a></div><div class="usRateControls" aria-label="그래프 집계 단위">${buttons(GRAINS,'grain')}</div><div class="usRateControls" data-rate-bases aria-label="일중 날짜 기준">${buttons({ny:'미국 거래일',kst:'한국 날짜'},'basis')}</div><div class="usRateControls" data-rate-ranges aria-label="조회 기간" hidden>${buttons({1:'1개월',3:'3개월',12:'1년',60:'5년',120:'10년'},'range')}</div><div class="usRateControls"><label><span data-rate-date-label>미국 거래일</span> <input type="date" aria-label="미국 거래일"></label><button type="button" data-rate-today>오늘</button><button type="button" data-rate-latest>최근 자료일</button><button type="button" data-rate-mode="yield">수익률 (%)</button><button type="button" data-rate-mode="bp">변화 (bp)</button><button type="button" data-rate-read>게시 자료 다시 읽기</button></div><strong data-rate-title></strong><p data-rate-summary class="usRateSummary" role="status"></p><div class="usRateCanvas"><canvas aria-label="미국 국채 수익률 기간별 그래프" role="img"></canvas></div><p data-rate-status class="usRateNote"></p><p data-rate-explanation class="usRateNote"></p><p class="usRateNote">선을 터치하거나 마우스를 올리면 날짜·값을 확인할 수 있습니다. 변화는 표시 구간 첫 관측 대비이며 1bp = 0.01%p입니다. 일중은 최근 30일 보관분, 일간·주간·월간은 최대 10년의 실제 제공 자료입니다. 13주물은 단기 할인수익률 지수입니다.</p><p class="usRateNote">자료: Yahoo Finance / Cboe 국채 수익률 지수 · 새 원천 수집은 상단 ‘데이터 최신화’에서 실행합니다. 2년물은 별도 원천 차트에서 확인합니다.</p>`;
    panel.prepend(host);
    host.addEventListener('click',e=>{
      const b=e.target.closest('button');if(!b)return;
      if(b.dataset.rateTenor){selected=b.dataset.rateTenor;if(!dateChosen)latest();render();}
      else if(b.dataset.rateGrain){grain=b.dataset.rateGrain;months=grain==='monthly'?120:grain==='weekly'?60:12;dateChosen=false;latest();render();}
      else if(b.dataset.rateBasis){basis=b.dataset.rateBasis;dateChosen=false;latest();render();}
      else if(b.dataset.rateRange){months=Number(b.dataset.rateRange);render();}
      else if(b.dataset.rateMode){mode=b.dataset.rateMode;render();}
      else if(b.hasAttribute('data-rate-today')){dateChosen=true;date=day(Date.now()/1000,dateBasis());render();}
      else if(b.hasAttribute('data-rate-latest')){dateChosen=false;latest();render();}
      else if(b.hasAttribute('data-rate-read'))load();
    });
    host.querySelector('input').addEventListener('change',e=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(e.target.value))return;dateChosen=true;date=e.target.value;render();});
    render();
  }return true;
}
function activate(){if(ensure())load();}
const style=doc.createElement('style');style.textContent='.usRateIntraday{grid-column:1/-1;min-width:0}.usRateIntraday h3{margin:0 0 6px}.usRateNote{font-size:11px;color:#667085;line-height:1.65;margin:7px 0}.usRateControls{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin:10px 0}.usRateControls[hidden]{display:none}.usRateControls button,.usRateControls a,.usRateControls input{font:inherit;font-size:12px;border:1px solid #ccd8ea;border-radius:8px;padding:8px 10px;background:#fff;color:#184c82;min-height:40px;max-width:100%}.usRateControls button{cursor:pointer;touch-action:manipulation}.usRateControls a{text-decoration:none}.usRateControls button[aria-pressed=true]{background:#175cd3;border-color:#175cd3;color:#fff}.usRateControls label{font-size:12px;display:flex;align-items:center;gap:7px;flex-wrap:wrap}.usRateSummary{font-size:12px;line-height:1.7;color:#344054;overflow-wrap:anywhere}.usRateCanvas{position:relative;height:350px;max-width:100%;min-width:0}.usRateCanvas:has(canvas[hidden]){height:20px}.usRateCanvas canvas{max-width:100%}@media(max-width:600px){.usRateCanvas{height:300px}.usRateControls{gap:5px}.usRateControls button,.usRateControls a{font-size:11px;padding:7px 8px}}';doc.head.appendChild(style);
doc.querySelector('#tabs')?.addEventListener('click',e=>{if(e.target.closest('button[data-tab="rates"]'))activate();});
doc.addEventListener('visibilitychange',()=>{if(!doc.hidden&&doc.querySelector('#rates.on'))activate();});
setInterval(()=>{if(!doc.hidden&&doc.querySelector('#rates.on'))load();},60000);
ensure();if(doc.querySelector('#rates.on'))activate();
root.__JJOONI_US_RATES_INTRADAY={version:'2.0',load,activate,timezone:'Asia/Seoul'};
})(typeof window!=='undefined'?window:globalThis);
