(function(root){
'use strict';
const TENORS={US13W:'13주 단기물',US5Y:'5년물',US10Y:'10년물',US30Y:'30년물'};
const kst=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'});
const clock=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false});
const fullClock=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
function day(stamp){return kst.format(new Date(stamp*1000));}
function rowsForDay(points,date){return (points||[]).filter(p=>day(p.timestamp)===date).sort((a,b)=>a.timestamp-b.timestamp);}
function chartPoints(rows,mode){
  const first=rows[0]?.yield_pct,points=[];
  rows.forEach((p,i)=>{
    if(i&&p.timestamp-rows[i-1].timestamp>15*60)points.push({x:(rows[i-1].timestamp+300)*1000,y:null});
    points.push({x:p.timestamp*1000,y:mode==='bp'?(p.yield_pct-first)*100:p.yield_pct});
  });return points;
}
if(typeof module!=='undefined'&&module.exports){module.exports={day,rowsForDay,chartPoints};return;}
const doc=root.document;if(!doc)return;
let host,data=null,inflight=null,chart=null,selected='US10Y',mode='yield',date=day(Date.now()/1000);
function render(){
  if(!host)return;
  const source=data?.series?.[selected],rows=rowsForDay(source?.points,date),status=host.querySelector('[data-rate-status]');
  host.querySelectorAll('[data-rate-tenor]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.rateTenor===selected));});
  host.querySelectorAll('[data-rate-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.rateMode===mode)));
  const dateInput=host.querySelector('input');dateInput.value=date;dateInput.max=day(Date.now()/1000);
  host.querySelector('[data-rate-title]').textContent=TENORS[selected]+' · '+date+' (KST)';
  const dates=Object.values(data?.series||{}).flatMap(s=>(s.points||[]).map(p=>day(p.timestamp))).sort();if(dates.length)dateInput.min=dates[0];
  status.textContent=data?`수집 ${String(data.generated_kst||'').replace('T',' ').slice(0,16)} KST · 마지막 관측 ${String(source?.last_observed_kst||'없음').replace('T',' ').slice(0,16)} KST${source?.state!=='AVAILABLE'?' · 원천 수집 실패, 이전 관측 유지':''}`:'장중 관측 자료를 읽는 중…';
  const summary=host.querySelector('[data-rate-summary]');
  if(rows.length){const first=rows[0].yield_pct,last=rows.at(-1).yield_pct,values=rows.map(p=>p.yield_pct),change=(last-first)*100;
    summary.textContent=`마지막 ${last.toFixed(3)}% · 첫 관측 ${first.toFixed(3)}% · 변화 ${change>=0?'+':''}${change.toFixed(2)}bp · 최저 ${Math.min(...values).toFixed(3)}% · 최고 ${Math.max(...values).toFixed(3)}% · ${rows.length}개 관측`;
  }else summary.textContent=data?'선택한 한국시간 날짜에 저장된 관측이 없습니다. 최근 자료일 또는 다른 날짜를 선택해 주세요.':'자료를 읽는 중입니다.';
  const canvas=host.querySelector('canvas');canvas.hidden=!rows.length;
  if(chart){chart.destroy();chart=null;}
  if(!rows.length||typeof root.Chart!=='function')return;
  chart=new root.Chart(canvas,{type:'line',data:{datasets:[{label:TENORS[selected],data:chartPoints(rows,mode),borderColor:'#175cd3',borderWidth:2,pointRadius:0,pointHitRadius:12,pointHoverRadius:4,spanGaps:false,tension:0}]},options:{responsive:true,maintainAspectRatio:false,parsing:false,animation:false,interaction:{mode:'nearest',axis:'x',intersect:false},plugins:{legend:{display:false},tooltip:{filter:c=>c.parsed.y!=null,callbacks:{title:items=>items.length?fullClock.format(new Date(items[0].parsed.x))+' KST':'',label:c=>mode==='bp'?c.parsed.y.toFixed(2)+'bp (첫 관측 대비)':c.parsed.y.toFixed(3)+'%'}}},scales:{x:{type:'linear',ticks:{maxTicksLimit:7,callback:value=>clock.format(new Date(value))},title:{display:true,text:'한국시간 (KST)'}},y:{title:{display:true,text:mode==='bp'?'첫 관측 대비 (bp)':'수익률 (%)'},ticks:{callback:value=>Number(value).toFixed(mode==='bp'?1:3)}}}}});
}
async function load(){
  if(inflight)return inflight;
  const button=host.querySelector('[data-rate-read]');button.disabled=true;button.textContent='읽는 중…';
  inflight=(async()=>{try{
    const r=await fetch('./data/us-rates-intraday.json?cb='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error('HTTP '+r.status);
    const next=await r.json();if(next.schema!=='JJOONI_US_RATES_INTRADAY_V1')throw new Error('자료 형식 불일치');data=next;render();
  }catch(error){render();host.querySelector('[data-rate-status]').textContent='장중 자료 조회 실패 · 기존 관측 유지 · '+error.message;
  }finally{inflight=null;button.disabled=false;button.textContent='게시 자료 다시 읽기';}})();return inflight;
}
function ensure(){
  const panel=doc.querySelector('#rates');if(!panel)return false;
  if(!host){
    host=doc.createElement('section');host.id='usRatesIntraday';host.className='card usRateIntraday';
    host.innerHTML=`<h3>미국 금리 · 장중 흐름</h3><p class="usRateNote">시장 수익률 지수 · 5분 관측 · 한국시간 기준 하루 · 일별 공식금리와 별도 자료</p><div class="usRateControls" aria-label="장중 금리 만기">${Object.entries(TENORS).map(([k,v])=>`<button type="button" data-rate-tenor="${k}" aria-pressed="${k===selected}">${v}</button>`).join('')}<a href="https://www.tradingview.com/symbols/TVC-US02Y/" target="_blank" rel="noopener noreferrer">2년물 원천 차트 ↗</a></div><div class="usRateControls"><label>관측 날짜 <input type="date" aria-label="미국 금리 장중 관측 날짜 (한국시간)"></label><button type="button" data-rate-today>오늘</button><button type="button" data-rate-latest>최근 자료일</button><button type="button" data-rate-mode="yield" aria-pressed="true">수익률 (%)</button><button type="button" data-rate-mode="bp" aria-pressed="false">변화 (bp)</button><button type="button" data-rate-read>게시 자료 다시 읽기</button></div><strong data-rate-title></strong><p data-rate-summary class="usRateSummary" role="status"></p><div class="usRateCanvas"><canvas aria-label="미국 국채 수익률 장중 그래프" role="img"></canvas></div><p data-rate-status class="usRateNote"></p><p class="usRateNote">마우스를 올리거나 선을 터치해 시각·값을 확인하세요. 변화는 해당 날짜 첫 관측 대비이며 1bp = 0.01%p입니다. 제공되지 않은 시간은 선을 연결하지 않습니다. 13주물은 단기 할인수익률 지수이며, 2년물은 별도 원천 차트에서 확인합니다.</p><p class="usRateNote">자료: Yahoo Finance / Cboe 국채 수익률 지수 · 새 원천 수집은 상단 ‘데이터 최신화’에서 실행합니다.</p>`;
    panel.prepend(host);
    host.addEventListener('click',e=>{
      const b=e.target.closest('button');if(!b)return;
      if(b.dataset.rateTenor){selected=b.dataset.rateTenor;render();}
      else if(b.dataset.rateMode){mode=b.dataset.rateMode;render();}
      else if(b.hasAttribute('data-rate-today')){date=day(Date.now()/1000);render();}
      else if(b.hasAttribute('data-rate-latest')){const rows=data?.series?.[selected]?.points||[];if(rows.length)date=day(rows.at(-1).timestamp);render();}
      else if(b.hasAttribute('data-rate-read'))load();
    });
    host.querySelector('input').addEventListener('change',e=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(e.target.value))return;date=e.target.value;render();});
    render();
  }return true;
}
function activate(){if(ensure())load();}
const style=doc.createElement('style');style.textContent='.usRateIntraday{grid-column:1/-1;min-width:0}.usRateIntraday h3{margin:0 0 6px}.usRateNote{font-size:11px;color:#667085;line-height:1.65;margin:7px 0}.usRateControls{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin:10px 0}.usRateControls button,.usRateControls a,.usRateControls input{font:inherit;font-size:12px;border:1px solid #ccd8ea;border-radius:8px;padding:8px 10px;background:#fff;color:#184c82;min-height:36px;max-width:100%}.usRateControls button{cursor:pointer}.usRateControls a{text-decoration:none}.usRateControls button[aria-pressed=true]{background:#175cd3;border-color:#175cd3;color:#fff}.usRateControls label{font-size:12px;display:flex;align-items:center;gap:7px}.usRateSummary{font-size:12px;line-height:1.7;color:#344054;overflow-wrap:anywhere}.usRateCanvas{position:relative;height:330px;max-width:100%;min-width:0}.usRateCanvas:has(canvas[hidden]){height:20px}.usRateCanvas canvas{max-width:100%}@media(max-width:600px){.usRateCanvas{height:280px}.usRateControls{gap:5px}.usRateControls button,.usRateControls a{font-size:11px;padding:7px 8px}}';doc.head.appendChild(style);
doc.querySelector('#tabs')?.addEventListener('click',e=>{if(e.target.closest('button[data-tab="rates"]'))activate();});
doc.addEventListener('visibilitychange',()=>{if(!doc.hidden&&doc.querySelector('#rates.on'))activate();});
ensure();if(doc.querySelector('#rates.on'))activate();
root.__JJOONI_US_RATES_INTRADAY={version:'1.0',load,activate,timezone:'Asia/Seoul'};
})(typeof window!=='undefined'?window:globalThis);
