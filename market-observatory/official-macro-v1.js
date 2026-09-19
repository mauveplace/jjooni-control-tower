(()=>{
'use strict';
if(window.__JJOONI_OFFICIAL_MACRO_V1)return;
const STATE={version:'1.0',status:'BOOTING',loaded:false,error:null,selected:null,range:'10Y',chart:null};
window.__JJOONI_OFFICIAL_MACRO_V1=STATE;
let DATA=null;
const q=(s,r=document)=>{try{return r.querySelector(s)}catch(_){return null}};
const qa=(s,r=document)=>{try{return [...r.querySelectorAll(s)]}catch(_){return[]}};
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const n=v=>{const x=Number(v);return Number.isFinite(x)?x:null};
const fmt=(v,d=2)=>n(v)==null?'—':Number(v).toLocaleString('ko-KR',{maximumFractionDigits:d});
const signed=(v,d=2)=>n(v)==null?'—':(Number(v)>0?'+':'')+fmt(v,d);
const COLORS={GREEN:'🟢',ORANGE:'🟠',RED:'🔴',GRAY:'⚪'};
const GROUPS={
 us:[['inflation','Inflation'],['labor','Labor'],['growth','Growth'],['fed','Fed']],
 kr:[['inflation','Inflation'],['growth','Growth'],['exports','Export'],['semiconductor','Semiconductor']]
};
function inject(){
 const tabs=q('#tabs'),main=q('main.wrap');if(!tabs||!main)return false;
 if(!q('button[data-tab="official-macro"]')){
   const b=document.createElement('button');b.dataset.tab='official-macro';b.textContent='공식 거시';
   const overview=q('button[data-tab="overview"]',tabs);overview?.insertAdjacentElement('afterend',b);
 }
 if(!q('#official-macro')){
   const s=document.createElement('section');s.className='panel';s.id='official-macro';
   s.innerHTML='<div class="card"><h3>Macro Official Data</h3><div class="meta obsMacroLoading">공식 거시데이터를 불러오는 중입니다…</div></div>';
   const overview=q('#overview');overview?.insertAdjacentElement('afterend',s);
 }
 if(!q('#officialMacroStyle')){
   const st=document.createElement('style');st.id='officialMacroStyle';st.textContent=`
#official-macro{min-width:0}.obsMacroHero{display:grid;grid-template-columns:1fr 1fr;gap:12px}.obsMacroCard{background:#fff;border:1px solid #e5ebf2;border-radius:16px;padding:14px;min-width:0}.obsMacroHead{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.obsMacroTitle{font-size:16px;font-weight:950}.obsMacroSub{font-size:10px;color:#718096;margin-top:3px}.obsMacroStatusGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-top:10px}.obsMacroStatus{border:1px solid #e7ecf2;border-radius:11px;padding:9px;background:#fafbfd;min-width:0}.obsMacroStatus small{display:block;color:#718096;font-size:9px;font-weight:800}.obsMacroStatus b{display:block;margin-top:4px;font-size:11px;overflow-wrap:anywhere}.obsMacroBadge{display:inline-flex;align-items:center;border-radius:999px;padding:4px 7px;font-size:9px;font-weight:900;background:#f2f4f7;color:#475467}.obsMacroBadge.live{background:#ecfdf3;color:#067647}.obsMacroBadge.pending{background:#f2f4f7;color:#667085}.obsMacroSection{margin-top:12px}.obsMacroGroup{background:#fff;border:1px solid #e5ebf2;border-radius:16px;overflow:hidden;margin-top:10px}.obsMacroGroup h4{margin:0;padding:12px 13px;background:#f8fafc;border-bottom:1px solid #e8edf3;font-size:13px}.obsMacroRow{display:grid;grid-template-columns:minmax(150px,1.45fr) repeat(5,minmax(72px,.72fr));gap:0;border-top:1px solid #edf1f5;cursor:pointer;align-items:center}.obsMacroRow:first-of-type{border-top:0}.obsMacroRow:hover{background:#fafcff}.obsMacroRow>div{padding:9px 8px;min-width:0;font-size:10px;overflow-wrap:anywhere}.obsMacroName{font-weight:900}.obsMacroName small{display:block;color:#718096;font-size:8px;font-weight:700;margin-top:2px}.obsMacroCell b{display:block;font-size:11px}.obsMacroCell span{font-size:8px;color:#8090a3}.obsMacroDetail{margin-top:12px;background:#fff;border:1px solid #e5ebf2;border-radius:16px;padding:14px}.obsMacroDetailHead{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.obsMacroKpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:7px;margin:10px 0}.obsMacroKpi{background:#f8fafc;border:1px solid #e8edf3;border-radius:10px;padding:9px;min-width:0}.obsMacroKpi small{display:block;font-size:8px;color:#718096}.obsMacroKpi b{display:block;margin-top:3px;font-size:12px;overflow-wrap:anywhere}.obsMacroChart{height:330px;position:relative}.obsMacroRange{display:flex;gap:5px;flex-wrap:wrap;margin:7px 0}.obsMacroRange button{border:1px solid #d8e0e9;background:#fff;border-radius:8px;padding:5px 8px;font-size:9px;font-weight:850}.obsMacroRange button.on{background:#eef4ff;color:#175cd3;border-color:#bfd2ff}.obsMacroNotes{font-size:9px;color:#667085;line-height:1.55;margin-top:8px}.obsMacroQuality{margin-top:10px;padding:9px 10px;border-radius:10px;background:#f8fafc;font-size:9px;color:#667085}.obsMacroSource{display:flex;gap:5px;flex-wrap:wrap;margin-top:6px}.obsMacroSource span{border:1px solid #dfe6ee;border-radius:999px;padding:4px 7px;font-size:8px;font-weight:850;background:#fff}.obsMacroInfo{margin-top:10px;padding:9px 10px;border-left:3px solid #98a2b3;background:#f8fafc;font-size:9px;color:#667085;line-height:1.5}
@media(max-width:760px){.obsMacroHero{grid-template-columns:1fr}.obsMacroStatusGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.obsMacroRow{grid-template-columns:minmax(130px,1.5fr) repeat(2,minmax(68px,.8fr))}.obsMacroRow>div:nth-child(n+4){display:none}.obsMacroKpis{grid-template-columns:repeat(2,minmax(0,1fr))}.obsMacroChart{height:300px}.obsMacroDetailHead{display:block}.obsMacroGroup{overflow-x:hidden}}
`;
   document.head.appendChild(st);
 }
 return true;
}
function statusCard(label,obj){
 const c=obj?.color||'GRAY',r=obj?.regime||'DATA_PENDING';
 return '<div class="obsMacroStatus"><small>'+esc(label)+'</small><b>'+esc(COLORS[c]||'⚪')+' '+esc(r)+'</b></div>';
}
function metric(key){return DATA?.metrics?.[key]||null}
function currentValue(m){
 const x=m?.latest||{};
 if(m?.key==='US_FED_FUNDS'&&x.lower!=null&&x.upper!=null)return fmt(x.lower)+'–'+fmt(x.upper)+'%';
 if(x.yoy!=null&&['US_CPI','US_CORE_CPI','US_PCE','US_CORE_PCE','KR_CPI','KR_CORE_CPI'].includes(m?.key))return fmt(x.yoy)+'%';
 if(x.value==null)return '—';
 return fmt(x.value)+(m?.unit&&String(m.unit).includes('%')?'%':'');
}
function trendValue(m){
 const x=m?.latest||{};
 if(x.ann_3m!=null)return fmt(x.ann_3m)+'%';
 if(x.avg_3m!=null)return fmt(x.avg_3m);
 if(x.qoq!=null)return fmt(x.qoq)+'%';
 return '—';
}
function rowHtml(k){
 const m=metric(k);if(!m)return'';
 const pending=m.status==='SOURCE_PENDING';
 const src=m.primary_source?.institution||m.primary_source?.name||'';
 const r=m.release||{};
 const cls=pending?'pending':'live';
 return '<div class="obsMacroRow" data-macro-key="'+esc(k)+'">'+
  '<div class="obsMacroName">'+esc(m.name||k)+' <span class="obsMacroBadge '+cls+'">'+esc(src)+'</span><small>'+esc(m.status||'')+'</small></div>'+
  '<div class="obsMacroCell"><span>현재</span><b>'+esc(currentValue(m))+'</b></div>'+
  '<div class="obsMacroCell"><span>이전</span><b>'+esc(r.previous==null?'—':fmt(r.previous))+'</b></div>'+
  '<div class="obsMacroCell"><span>예상</span><b>'+esc(r.consensus==null?'—':fmt(r.consensus))+'</b></div>'+
  '<div class="obsMacroCell"><span>Surprise</span><b>'+esc(r.surprise==null?'—':signed(r.surprise))+'</b></div>'+
  '<div class="obsMacroCell"><span>최근 3M</span><b>'+esc(trendValue(m))+'</b></div></div>';
}
function groupHtml(country,key,label){
 const g=DATA?.macro?.official?.[country]?.[key]||{};const ks=g.metrics||[];
 return '<div class="obsMacroGroup"><h4>'+esc(label)+' · '+esc(COLORS[g.regime?.color]||'⚪')+' '+esc(g.regime?.regime||'')+'</h4>'+ks.map(rowHtml).join('')+'</div>';
}
function render(){
 const panel=q('#official-macro');if(!panel||!DATA)return;
 const us=DATA.regimes?.us||{},kr=DATA.regimes?.kr||{};
 panel.innerHTML='<div class="obsMacroHero">'+
 '<div class="obsMacroCard"><div class="obsMacroHead"><div><div class="obsMacroTitle">🇺🇸 US MACRO</div><div class="obsMacroSub">Fed · BLS · BEA 공식치 / FRED 전송계층</div></div><span class="obsMacroBadge live">OFFICIAL</span></div><div class="obsMacroStatusGrid">'+GROUPS.us.map(x=>statusCard(x[1],us[x[0]])).join('')+'</div></div>'+
 '<div class="obsMacroCard"><div class="obsMacroHead"><div><div class="obsMacroTitle">🇰🇷 KR MACRO</div><div class="obsMacroSub">한국은행 · 통계청 · 관세/산업부 공식치</div></div><span class="obsMacroBadge live">OFFICIAL</span></div><div class="obsMacroStatusGrid">'+GROUPS.kr.map(x=>statusCard(x[1],kr[x[0]])).join('')+'</div></div></div>'+
 '<div class="obsMacroInfo">공식 경제통계와 시장가격 지표는 분리합니다. 이번 화면은 <b>Macro Official Data</b> 전용이며 실질금리·HY Spread·Breadth·SOXX/QQQ 등 시장지표는 포함하지 않습니다. Regime은 정보 feature이며 AUTOBOT의 단독 매매 트리거가 아닙니다.</div>'+
 '<div class="obsMacroSection">'+GROUPS.us.map(x=>groupHtml('us',x[0],'US · '+x[1])).join('')+GROUPS.kr.map(x=>groupHtml('kr',x[0],'KR · '+x[1])).join('')+'</div>'+
 '<div class="obsMacroDetail" id="officialMacroDetail"><div class="meta">지표를 누르면 10년 히스토리 · 추세 · 출처 · revision/vintage를 표시합니다.</div></div>'+
 '<div class="obsMacroQuality">generated '+esc(DATA.generated_kst||'—')+' · live '+esc(DATA.quality?.live_metrics??0)+' · pending '+esc((DATA.quality?.pending_metrics||[]).length)+' · vintage keys '+esc(DATA.quality?.vintage_keys??0)+'</div>';
 qa('.obsMacroRow',panel).forEach(r=>r.onclick=()=>showDetail(r.dataset.macroKey));
 STATE.loaded=true;STATE.status='ACTIVE';
 const first='US_CORE_PCE';if(metric(first))showDetail(first);
}
function primarySeries(m){
 const hist=m?.history||[];
 const inflation=['US_CPI','US_CORE_CPI','US_PCE','US_CORE_PCE','KR_CPI','KR_CORE_CPI'].includes(m?.key);
 return {label:inflation?'YoY %':(m?.name||m?.key),points:hist.map(x=>({date:x.period,value:inflation?x.yoy:x.value})).filter(x=>n(x.value)!=null)};
}
function cutoff(points,range){
 if(!points.length||range==='ALL')return points;
 const last=new Date(points[points.length-1].date+'T00:00:00Z');const days={3Y:1096,5Y:1827,10Y:3653}[range]||3653;
 last.setUTCDate(last.getUTCDate()-days);const cut=last.toISOString().slice(0,10);return points.filter(x=>x.date>=cut);
}
const markerPlugin={id:'officialMacroMarkers',afterDatasetsDraw(chart,args,opts){
 const marks=opts?.markers||[];const x=chart.scales.x;if(!x)return;const labels=chart.data.labels||[];const ctx=chart.ctx;
 ctx.save();ctx.font='9px system-ui';ctx.fillStyle='#667085';ctx.strokeStyle='#c9d3df';ctx.lineWidth=1;
 for(const m of marks){let i=labels.findIndex(d=>String(d)>=m.date);if(i<0)continue;const px=x.getPixelForValue(i);ctx.beginPath();ctx.moveTo(px,chart.chartArea.top);ctx.lineTo(px,chart.chartArea.bottom);ctx.stroke();ctx.save();ctx.translate(px+3,chart.chartArea.top+10);ctx.rotate(-Math.PI/2);ctx.fillText(m.label,0,0);ctx.restore();}
 ctx.restore();
}};
function drawDetailChart(m){
 const c=q('#officialMacroChart');if(!c||typeof Chart==='undefined')return;
 if(STATE.chart){STATE.chart.destroy();STATE.chart=null}
 const ps=primarySeries(m),pts=cutoff(ps.points,STATE.range);
 STATE.chart=new Chart(c,{type:'line',data:{labels:pts.map(x=>x.date),datasets:[{label:ps.label,data:pts.map(x=>x.value),borderWidth:2,pointRadius:0,tension:.12,spanGaps:true}]},plugins:[markerPlugin],options:{responsive:true,maintainAspectRatio:false,animation:false,interaction:{mode:'index',intersect:false},plugins:{legend:{display:true,position:'bottom'},officialMacroMarkers:{markers:DATA?.historical_markers||[]}},scales:{x:{ticks:{maxTicksLimit:7,font:{size:9},callback:function(v){const s=this.getLabelForValue(v);return String(s).slice(0,7)}},grid:{color:'#eef2f6'}},y:{ticks:{maxTicksLimit:6,font:{size:9}},grid:{color:'#e8edf3'}}}}});
}
function kpi(label,val){return '<div class="obsMacroKpi"><small>'+esc(label)+'</small><b>'+esc(val==null?'—':val)+'</b></div>'}
function showDetail(key){
 const m=metric(key),box=q('#officialMacroDetail');if(!m||!box)return;STATE.selected=key;
 const l=m.latest||{},r=m.release||{};const vint=r.vintage_history||[];
 const src=[m.primary_source?.name||m.primary_source?.institution,m.transport_source?.provider,m.transport_source?.series_id].filter(Boolean);
 box.innerHTML='<div class="obsMacroDetailHead"><div><div class="obsMacroTitle">'+esc(m.name||key)+'</div><div class="obsMacroSub">'+esc(key)+' · '+esc(m.frequency||'')+' · '+esc(m.status||'')+'</div><div class="obsMacroSource">'+src.map(x=>'<span>'+esc(x)+'</span>').join('')+'</div></div><span class="obsMacroBadge '+(m.status==='SOURCE_PENDING'?'pending':'live')+'">'+esc(m.primary_source?.institution||'OFFICIAL')+'</span></div>'+
 '<div class="obsMacroKpis">'+
  kpi('현재',currentValue(m))+kpi('Previous',r.previous==null?'—':fmt(r.previous))+kpi('Consensus',r.consensus==null?'—':fmt(r.consensus))+kpi('Surprise',r.surprise==null?'—':signed(r.surprise))+
  kpi('3M annualized / avg',l.ann_3m!=null?fmt(l.ann_3m)+'%':(l.avg_3m!=null?fmt(l.avg_3m):'—'))+kpi('6M annualized / avg',l.ann_6m!=null?fmt(l.ann_6m)+'%':(l.avg_6m!=null?fmt(l.avg_6m):'—'))+'</div>'+
 '<div class="obsMacroRange">'+['3Y','5Y','10Y','ALL'].map(x=>'<button data-macro-range="'+x+'" class="'+(STATE.range===x?'on':'')+'">'+x+'</button>').join('')+'</div>'+
 '<div class="obsMacroChart"><canvas id="officialMacroChart"></canvas></div>'+
 '<div class="obsMacroNotes"><b>Actual SSOT:</b> '+esc(m.primary_source?.name||m.primary_source?.institution||'—')+' · <b>Consensus:</b> '+esc(r.consensus_source?.provider||'별도 시장데이터')+'<br>'+
 (m.note?esc(m.note)+'<br>':'')+
 '<b>Vintage:</b> '+(vint.length?vint.map(x=>esc(x.version)+' '+esc(x.value)).join(' → '):'기록 대기')+'</div>';
 qa('button[data-macro-range]',box).forEach(b=>b.onclick=()=>{STATE.range=b.dataset.macroRange;qa('button[data-macro-range]',box).forEach(x=>x.classList.toggle('on',x===b));drawDetailChart(m)});
 drawDetailChart(m);
}
async function load(){
 try{
  const r=await fetch('./data/official-macro.json?cb='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error('official-macro '+r.status);
  DATA=await r.json();if(DATA?.schema!=='JJOONI_OFFICIAL_MACRO_V1')throw new Error('official-macro schema');
  render();
 }catch(e){STATE.status='ACTIVE_DEGRADED';STATE.error=String(e);const p=q('#official-macro');if(p)p.innerHTML='<div class="card"><h3>Macro Official Data</h3><div class="meta">공식 거시데이터 생성 대기 · '+esc(String(e))+'</div></div>';console.warn(e)}
}
function boot(){if(!inject()){setTimeout(boot,200);return}load()}
boot();
})();