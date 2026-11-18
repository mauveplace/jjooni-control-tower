/* Observatory V3 default visual system.
 * Source-first, read-only: does not touch trading, collection, or existing V1/V2.
 * V3 is default. Explicit ?ui=v2 and ?ui=v1 remain available.
 */
(function (root) {
'use strict';
const V3 = 'v3';
const isV3 = search => !['v1','v2'].includes(new URLSearchParams(search||'').get('ui'));
const finite = v => typeof v === 'number' && Number.isFinite(v);
const escapeHtml = v => String(v??'').replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[x]));
const fmt = (v,n=2) => finite(v) ? v.toLocaleString('ko-KR',{minimumFractionDigits:n,maximumFractionDigits:n}) : '—';
const pct = v => finite(v) ? (v>0?'+':'')+v.toFixed(2)+'%' : '—';
const changeClass = v => finite(v) ? (v>0?'gain':v<0?'loss':'neutral') : 'neutral';
const pointKeys=['lower','now','upper','tri'];
const pointLabels={lower:'하락 전환 후보 · MA250×0.95',now:'현재 NDX',upper:'상승 복귀 참고 · MA250×1.01',tri:'TRIPOD 낙폭 조건 · DD -9%'};
let selectedPoint='now';
const distanceText=(target,now)=>{
 if(!finite(target)||!finite(now)||now<=0)return '현재 대비 거리 확인 불가';
 const delta=target-now;
 if(Math.abs(delta)<0.005)return '현재 위치 · 0.00pt (0.00%)';
 return '현재 대비 '+fmt(Math.abs(delta))+'pt 더 '+(delta>0?'상승':'하락')+' ('+pct(delta/now*100)+')';
};
const dailyMoveText = m => {
 const rate=pct(m.ndxChangePct);
 if(!finite(m.ndxChangePts))return '전일 대비 '+rate+' · 포인트 확인 대기';
 return '전일 대비 '+(m.ndxChangePts>0?'+':'')+fmt(m.ndxChangePts)+'pt ('+rate+')';
};
const pointSummary=(key,m)=>key==='now'?dailyMoveText(m):distanceText(m.axis[key],m.axis.now);
const pointLabel=(key,m)=>key==='now'?'현재 NDX · '+(m.pod||'—'):pointLabels[key];
const note=(key,m,scope)=>{
 const on=selectedPoint===key;
 return '<div class="ov3Threshold '+key+(on?' selected':'')+'" id="ov3Threshold-'+scope+'-'+key+'" data-ov3-card="'+key+'">'
 +'<span>'+escapeHtml(pointLabel(key,m))+'</span><b>'+fmt(m.axis[key])+'</b>'
 +'<small class="ov3Distance">'+escapeHtml(pointSummary(key,m))+'</small></div>';
};
function model(glance, fresh, sectors, nowMs=Date.now(), publicDaily=null) {
 const t=glance?.tripod||{},line=t.lines||{},g=fresh?.groups?.market||{};
 const generated=Date.parse(fresh?.generated_kst||''),expected=fresh?.session_alignment?.expected_session;
 const age=nowMs-generated,maxAge=(fresh?.freshness_policy?.max_status_age_seconds||7200)*1000;
 const statusOk=Number.isFinite(generated)&&age>=-60000&&age<=maxAge;
 const us=glance?.groups?.find(x=>x.name==='미국')?.items||[];
 const ndx=us.find(x=>x.key==='NASDAQ100');
 const ready=glance?.read_only===true&&glance?.no_trade===true
  &&glance?.consistency?.status==='OK'&&glance?.us_session
  &&t.session===glance.us_session&&ndx?.date===glance.us_session
  &&finite(ndx?.value)&&ndx.value>0&&finite(ndx.d1_pct)
  &&finite(t.ndx)&&Math.abs(t.ndx-ndx.value)<0.06
  &&finite(t.ma250)&&t.ma250>0&&finite(t.vix10)&&finite(t.drawdown_52w_pct)
  &&finite(line.ma250_lower)&&finite(line.ma250_upper)&&finite(line.tripod_return)
  &&line.ma250_lower>0&&line.tripod_return>line.ma250_lower
  &&g.state==='LIVE'&&g.source==='observatory.json'
  &&g.as_of===glance.us_session&&fresh?.session_alignment?.aligned===true
  &&expected===glance.us_session;
 if(!ready)return {ready:false,reason:'완료 세션·NDX·TRI-POD·신선도 원장 정합성 확인 대기',
  session:glance?.us_session||'—'};
 const ref=publicDaily?.market_context?.items?.NASDAQ100;
 // Previous-close point change is only trusted when all exact daily records
 // match; never infer points from the rounded daily-glance d1 percentage.
 const refOk=publicDaily?.read_only===true
  &&ref?.session_date===glance.us_session&&ref?.as_of_date===glance.us_session
  &&ref?.basis==='LATEST_COMPLETED_DAILY_CLOSE_VS_PREVIOUS_CLOSE'
  &&ref?.market_state==='COMPLETED_DAILY_REFERENCE'
  &&finite(ref?.value)&&finite(ref?.prev_close)&&ref.prev_close>0
  &&finite(ref?.change)&&finite(ref?.change_pct)
  &&Math.abs(ref.value-ndx.value)<0.06
  &&Math.abs(ref.value-ref.prev_close-ref.change)<0.06
  &&Math.abs(ref.change_pct-ndx.d1_pct)<0.011;
 const ndxChangePts=refOk?ref.change:null;
 const ndxChangePct=refOk?ref.change_pct:ndx.d1_pct;
 const axis={lower:line.ma250_lower,upper:line.ma250_upper,tri:line.tripod_return,now:ndx.value};
 const span=axis.tri-axis.lower, min=Math.min(axis.lower,axis.now)-span*.12,max=Math.max(axis.tri,axis.now)+span*.12;
 const position=v=>Math.max(0,Math.min(100,(v-min)/(max-min)*100));
 const dist=v=>(v/axis.now-1)*100;
 const rows=Array.isArray(sectors?.groups)?sectors.groups:[];
 const all=rows.flatMap(x=>x.rows||[]);
 const sectorReady=sectors?.read_only===true&&sectors?.no_trade===true
  &&sectors?.completed_cutoffs?.US===glance.us_session
  &&sectors?.completed_cutoffs?.KR===glance.us_session
  &&all.length===34&&rows.find(x=>x.key==='classic')?.rows?.length===11
  &&rows.find(x=>x.key==='kr_sector')?.rows?.length===10
  &&all.every(x=>x.status==='OK'&&x.current_session===sectors.completed_cutoffs[x.market]
    &&finite(x.current_return_pct));
 return {ready:true,session:glance.us_session,pod:t.pod,regime:t.regime,ma250:t.ma250,vix10:t.vix10,dd:t.drawdown_52w_pct,
  ndx:axis.now,ndxPct:ndx.d1_pct,ndxChangePts,ndxChangePct,axis,points:Object.fromEntries(Object.entries(axis).map(([key,value])=>[key,position(value)])),
  differences:{lower:dist(axis.lower),upper:dist(axis.upper),tri:dist(axis.tri)},
  us,sectorReady,sectors:sectorReady?[...rows.find(x=>x.key==='classic').rows].sort((a,b)=>b.current_return_pct-a.current_return_pct):[],
  generated:glance.generated_kst,freshnessGenerated:fresh.generated_kst,freshnessCurrent:statusOk,
  officialVerified:glance?.brief_check?.status==='MATCH' && glance.brief_check.official_eod_verified===true
   && glance.brief_check.source_date===glance.us_session && glance.brief_check.match_rule==='INTEGER_PART_EQUAL',
  referenceOnly:glance?.brief_check?.official_eod_verified!==true,noTrade:true};
}
function rail(m,scope='preview'){
  const points=pointKeys.map(key=>{
   const where=m.points[key];
   return '<button type="button" class="ov3Mark '+key+(selectedPoint===key?' selected':'')+'" style="left:'+where.toFixed(2)+'%"'
    +' data-ov3-point="'+key+'" aria-pressed="'+(selectedPoint===key)+'" aria-controls="ov3Threshold-'+scope+'-'+key+'"'
    +' title="'+escapeHtml(pointLabel(key,m))+'" aria-label="'+escapeHtml(pointLabel(key,m)+' · '+pointSummary(key,m))+'"></button>';
  }).join('');
 return '<section class="ov3Rail" aria-label="TRI-POD 지수 기준점">'
  +'<div class="ov3DataGuard" role="note">'+(m.officialVerified
   ?'NDX Nasdaq 공식 종가 · 정수자리 일치 검증 완료 · TRI-POD 기타 조건 확인 · 자동주문 없음'
   :'제공자 완료 일봉 참고 · NDX 공식 종가 독립검증 대기 · 전환 확정 금지')+'</div>'
  +(m.freshnessCurrent?'':'<p class="ov3Stale" role="status">최신성 재확인 필요 · 아래 수치는 '+escapeHtml(m.session)+' 완료일봉의 마지막 게시 참고값입니다.</p>')
  +'<div class="ov3RailHeading"><strong>전환 기준점 한눈에 보기</strong><small>미국 '+escapeHtml(m.session)+' 완료 일봉 참고 · 가격 간격 비례</small></div>'
  +'<div class="ov3Track" role="group" aria-label="기준점 선택 · 빨강 하락, 검정 현재, 파랑 상승, 초록 낙폭 조건"><span aria-hidden="true"></span>'+points+'</div>'
   +'<p class="ov3SelectedDistance" role="status" aria-live="polite" data-ov3-selected>'
   +escapeHtml(pointLabel(selectedPoint,m)+' · '+pointSummary(selectedPoint,m))+'</p>'
   +'<div class="ov3Thresholds">'+pointKeys.map(key=>note(key,m,scope)).join('')
   +'</div><p class="ov3RailNote">NDX '+fmt(m.ndx)+' · VIX10 '+fmt(m.vix10)+' · DD '+pct(m.dd)+' · '
  +'TRIPOD은 상승 레짐·DD -9% 이내·VIX10&lt;28을 함께 확인하며, NOPOD도 하락 레짐과 VIX10≥18 확인이 필요합니다.</p>'
  +'<p class="ov3Small">하락 레짐 전환 후보와 NO-POD 과거 진입일 고정선·손절선은 다른 값입니다. '+(m.officialVerified?'Nasdaq 종가 정수자리 검증 완료':'공식 Nasdaq EOD 독립검증 전')+' · 완료세션 날짜 유지 · 주문 신호 아님</p>'
   +'<button class="ov3DetailLink" type="button" data-ov3-tab="jjooni-tripod">NO-POD 진입 고정 기준점·손절선 상세 보기</button></section>';
}
function marketStrip(m){
 const picks=['NASDAQ100','SP500','SOX','VIX'].map(k=>m.us.find(x=>x.key===k)).filter(x=>x&&finite(x.value)&&x.date===m.session);
 return '<section class="ov3MarketStrip" aria-label="오늘의 지수">'
  +'<div class="ov3StripTitle"><strong>MARKET CLOSE</strong><small>미국 '+escapeHtml(m.session)+' · '+(m.freshnessCurrent?(m.officialVerified?'Nasdaq 공식 종가 정수자리 일치':'제공자 완료일봉 참고'):'상태 최신성 재확인 필요 · 마지막 게시 참고')+'</small></div>'
  +'<div class="ov3StripData">'+picks.map(x=>'<div class="ov3StripTile"><span>'+escapeHtml(x.label)+'</span><strong>'+fmt(x.value)+'</strong><small class="'+changeClass(x.d1_pct)+'">'+pct(x.d1_pct)+'</small></div>').join('')+'</div></section>';
}
function sectorChart(m){
  if(!m.sectorReady)return '<p class="ov3Small">섹터 34종의 동일 완료세션 검증이 끝나지 않아 수익률 시각화를 보류합니다.</p>';
  // A shared absolute-percentage scale, with a real 0% midpoint for both sides.
  const max=Math.max(1,...m.sectors.map(x=>Math.abs(x.current_return_pct)));
  return '<div class="ov3Sectors" aria-label="미국 S&P500 섹터 · 0% 중앙 기준 수익률">'
    +'<div class="ov3SectorsHead"><strong>미국 S&P500 업종 11개 · 전체 강약</strong>'
    +'<small>일간 수익률 · <b class="loss">파랑 ← 하락</b> · <b>0%</b> · <b class="gain">상승 → 빨강</b> · 실제 자금흐름 아님</small></div>'
    +m.sectors.map(x=>{
      const value=x.current_return_pct;
      const width=Math.min(100,Math.abs(value)/max*100).toFixed(1);
      const left=value<0?width:'0.0',right=value>0?width:'0.0';
      const direction=value<0?'하락 · 중앙 왼쪽':value>0?'상승 · 중앙 오른쪽':'보합 · 중앙 기준선';
      return '<div class="ov3SectorLine" data-direction="'+changeClass(value)+'"><span>'+escapeHtml(x.label)+'</span>'
        +'<div class="ov3SectorTrack" role="img" aria-label="'+escapeHtml(x.label+' '+pct(value)+' · '+direction)+'">'
        +'<span class="ov3SectorHalf left"><i class="loss" style="width:'+left+'%"></i></span>'
        +'<span class="ov3SectorHalf right"><i class="gain" style="width:'+right+'%"></i></span></div>'
        +'<strong class="'+changeClass(value)+'">'+pct(value)+'</strong></div>';
    }).join('')+'</div>';
}
function queryData() {
 const paths=['./data/daily-glance.json','./data/freshness-status.json','./data/sector-rotation-brief.json','../public-market-daily.json'];
 return Promise.allSettled(paths.map(path=>fetch(path+'?cb='+Date.now(),{cache:'no-store'})
  .then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()}))).then(xs=>xs.map(x=>x.status==='fulfilled'?x.value:null));
}
function selectPoint(key){
 if(!pointKeys.includes(key))return;
 selectedPoint=key;
 document.querySelectorAll('.ov3Rail').forEach(railEl=>{
  railEl.querySelectorAll('[data-ov3-point]').forEach(btn=>{
   const on=btn.dataset.ov3Point===key;
   btn.classList.toggle('selected',on);
   btn.setAttribute('aria-pressed',String(on));
  });
  railEl.querySelectorAll('[data-ov3-card]').forEach(card=>card.classList.toggle('selected',card.dataset.ov3Card===key));
  const selected=railEl.querySelector('[data-ov3-selected]');
  const card=railEl.querySelector('[data-ov3-card="'+key+'"]');
  if(selected&&card)selected.textContent=card.querySelector('span').textContent+' · '+card.querySelector('.ov3Distance').textContent;
 });
}
function draw(m) {
 const today=document.querySelector('.todayV2');
 if(today){
  today.querySelector('#ov3MarketStrip')?.remove();
  today.querySelector('#ov3TripodRail')?.remove();
  today.querySelector('#ov3SectorChart')?.remove();
  // Core decision rail belongs ABOVE the market board, not deep inside
  // the existing V2 strategy card. Keep V2 data/guards untouched.
  const firstGrid=today.querySelector('.tV2Grid');
  const tri=document.createElement('div');tri.id='ov3TripodRail';
  tri.innerHTML=m.ready?rail(m,'home'):'<div class="ov3Pending">TRI-POD 기준점 검증 대기 · '+escapeHtml(m.reason)+'</div>';
  const top=document.createElement('div');top.id='ov3MarketStrip';
  top.innerHTML=m.ready?marketStrip(m):'<div class="ov3Pending">시장 지수 검증 대기 · '+escapeHtml(m.reason)+'</div>';
  if(firstGrid){firstGrid.before(tri);tri.after(top);}else today.append(tri,top);
  const sector=today.querySelector('.tV2SectorBtns');
  if(sector){const r=document.createElement('div');r.id='ov3SectorChart';r.innerHTML=m.ready?sectorChart(m):'';
    sector.before(r);
  }
 }
 const original=document.querySelector('#tripod > .grid');
 if(original){
  let r=document.getElementById('ov3TripodDetail');
  if(!r){r=document.createElement('div');r.id='ov3TripodDetail';original.before(r);}
  r.innerHTML=m.ready?rail(m,'strategy'):'<div class="ov3Pending">TRI-POD 기준점 확인 대기 · '+escapeHtml(m.reason)+'</div>';
 }
}
const runtime={version:'3.1-default',model,rail,distanceText,dailyMoveText,pointSummary,marketStrip,sectorChart,enabled:isV3};
if(typeof module==='object'&&module.exports){module.exports=runtime;return;}
root.__JJOONI_OBS_V3=runtime;
function mount(){
 const brand=document.querySelector('header.top .brand');
 if(!isV3(location.search)){
  if(brand&&!brand.querySelector('.ov3Try')){
   const a=document.createElement('a');a.className='ov3Try';a.href='?ui=v3'+(location.hash||'');
   a.textContent='V3 기본화면';a.title='Observatory V3 기본화면으로 이동';brand.appendChild(a);}
  return;
 }
 document.body.classList.add('obsV3');
 if(brand&&!brand.querySelector('.ov3Back')){
  const a=document.createElement('a');a.className='ov3Back';a.href='?ui=v2'+(location.hash||'');a.textContent='V2로 돌아가기';brand.appendChild(a);}
 const css=document.createElement('link');css.rel='stylesheet';css.href='./observatory-v3.css?v=20261118-sector-zero-centered-1';css.id='observatoryV3Skin';document.head.appendChild(css);
 const shell=document.querySelector('main.wrap');if(!shell)return;
 document.addEventListener('click',e=>{
   const marker=e.target.closest('button[data-ov3-point]');
   if(marker){selectPoint(marker.dataset.ov3Point);return;}
   const btn=e.target.closest('button[data-ov3-tab]');
   if(btn?.dataset.ov3Tab==='jjooni-tripod')document.querySelector('#tabs button[data-tab="jjooni-tripod"]')?.click();
  });
 let current=null,pending=null,last=0;
 async function update(force=false){
  if(pending)return pending;
  if(!force&&current&&Date.now()-last<15000){draw(current);return}
  pending=queryData().then(([g,f,s,d])=>{current=model(g,f,s,Date.now(),d);last=Date.now();draw(current)})
   .catch(()=>{current={ready:false,reason:'공개 원장 조회 실패'};draw(current)})
   .finally(()=>{pending=null});
  return pending;
 }
 root.__JJOONI_OBS_V3.refresh=()=>update(true);
 const observer=new MutationObserver(changes=>{
  if(!current)return;
  if(changes.some(c=>[...c.addedNodes].some(x=>x.nodeType===1&&
   (x.classList?.contains('todayV2')||x.querySelector?.('.todayV2')))))draw(current);
 });
 // Today V2 lives before #tabs as a body child, not inside main.wrap.
 // Watching only main.wrap misses refresh-created Today and its shortcuts.
 observer.observe(document.body,{childList:true,subtree:true});
 update(true);
 const tabs=document.getElementById('tabs');
 if(tabs)tabs.addEventListener('click',e=>{
  if(e.target.closest('button[data-tab="overview"],button[data-tab="tripod"]'))update();
 });
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)update()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})(typeof window==='object'?window:globalThis);
