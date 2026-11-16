/* Read-only visual digest for the already published morning analysis.
 * Renders only exact-session canonical reference; never upgrades to official EOD.
 */
(function(root){
'use strict';
const num=x=>typeof x==='number'&&Number.isFinite(x);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=x=>num(x)?x.toLocaleString('ko-KR',{minimumFractionDigits:2,maximumFractionDigits:2}):'—';
const pct=x=>num(x)?(x>0?'+':'')+x.toFixed(2)+'%':'—';
const distance=(a,b)=>(a/b-1)*100;
const item=(g,key)=>(g.groups||[]).flatMap(x=>x.items||[]).find(x=>x.key===key);
function build({brief:d,glance:g,pulse:p,sector:s,latest}={}){
 if(!latest||!d||!g||!p)return {ready:false,reason:'동일 세션의 공개 자료를 확인하지 못했습니다.'};
 const day=d.market_date_us,t=g.tripod||{},raw=p.raw?.tradingview_cross_asset?.ndx||{},q=item(g,'NASDAQ100');
 const ok=day&&g.us_session===day&&t.session===day&&p.market_date_us===day
  &&p.read_only===true&&p.snapshot_status==='FINAL'&&p.session_gate?.aligned===true
  &&p.session_gate?.core_dates?.NASDAQ100===day&&g.no_trade===true&&g.consistency?.status==='OK'
  &&q?.date===day&&raw.market_date===day&&num(q.value)&&num(q.d1_pct)&&num(raw.value)
  &&Math.abs(q.value-raw.value)<0.06&&num(t.ndx)&&Math.abs(t.ndx-raw.value)<0.06
  &&num(t.ma250)&&t.ma250>0&&num(t.vix10)&&num(t.drawdown_52w_pct)
  &&num(t.lines?.ma250_lower)&&num(t.lines?.ma250_upper)&&num(t.lines?.tripod_return)
  &&t.lines.ma250_lower>0&&t.lines.tripod_return>t.lines.ma250_lower
  &&['TRIPOD','BIPOD','NOPOD'].includes(t.pod)
  &&Number.isFinite(Date.parse(g.source_generated_kst||''))
  &&Number.isFinite(Date.parse(g.generated_kst||''))
  &&Number.isFinite(Date.parse(p.generated_kst||''))
  &&Date.parse(g.source_generated_kst)<=Date.parse(g.generated_kst)
  &&Date.parse(p.generated_kst)<=Date.parse(g.generated_kst);
 if(!ok)return {ready:false,reason:'NDX·TRI-POD·원장 시각 및 동일 거래일 확인에 실패했습니다.'};
 const axis={lower:t.lines.ma250_lower,up:t.lines.ma250_upper,tri:t.lines.tripod_return,current:raw.value};
 const gap=axis.tri-axis.lower,min=Math.min(axis.lower,axis.current)-gap*.14,max=Math.max(axis.tri,axis.current)+gap*.14;
 const pos=v=>Math.max(0,Math.min(100,(v-min)/(max-min)*100));
 const all=s?.groups||[],rows=all.flatMap(x=>x.rows||[]);
 const sectorReady=s?.read_only===true&&s?.no_trade===true
   &&s?.completed_cutoffs?.US===day&&s?.completed_cutoffs?.KR===day
   &&rows.length===34&&all.find(x=>x.key==='classic')?.rows?.length===11
   &&all.find(x=>x.key==='kr_sector')?.rows?.length===10
   &&rows.every(r=>r.status==='OK'&&r.current_session===s.completed_cutoffs[r.market]
      &&num(r.current_return_pct)&&num(r.previous_return_pct));
 const markets=['NASDAQ100','SP500','SOX'].map(key=>item(g,key)).filter(x=>x?.date===day&&num(x.value)&&num(x.d1_pct));
 return {ready:true,day,pod:t.pod,regime:t.regime,target:t.target,ndx:raw.value,ma250:t.ma250,vix10:t.vix10,
   dd:t.drawdown_52w_pct,ndxPct:q.d1_pct,axis,markets,sectorReady,sectorTotal:rows.length,
   us:sectorReady?[...all.find(x=>x.key==='classic').rows].sort((a,b)=>b.current_return_pct-a.current_return_pct):[],
   kr:sectorReady?[...all.find(x=>x.key==='kr_sector').rows].sort((a,b)=>b.current_return_pct-a.current_return_pct):[],
   distances:{lower:distance(axis.lower,raw.value),up:distance(axis.up,raw.value),tri:distance(axis.tri,raw.value)},
   points:{lower:pos(axis.lower),current:pos(axis.current),up:pos(axis.up),tri:pos(axis.tri)},
   origin:g.source_generated_kst,referenceOnly:true,tradeEligible:false};
}
function metric(label,value,desc){return '<div class="bdMetric"><small>'+esc(label)+'</small><b>'+esc(value)+'</b><small>'+esc(desc)+'</small></div>'}
function sectorRows(rows){const max=Math.max(1,...rows.map(x=>Math.abs(x.current_return_pct)));return rows.map(r=>
 '<div class="bdSectorRow"><span>'+esc(r.label)+'</span><i><em class="'+(r.current_return_pct>=0?'gain':'loss')+'" style="width:'+
 Math.max(2,Math.abs(r.current_return_pct)/max*100).toFixed(1)+'%"></em></i><strong class="'+(r.current_return_pct>=0?'gain':'loss')+'">'+pct(r.current_return_pct)+'</strong></div>').join('')}
function bound(label,value,delta,desc){return '<div class="bdBound"><small>'+esc(label)+'</small><b>'+n(value)+'</b><small>'+pct(delta)+' · '+esc(desc)+'</small></div>'}
function render(host,input){
 if(!host)return null;
 const m=build(input);host.hidden=false;
 if(!m.ready){host.innerHTML='<div class="bdHold" role="status"><b>TRI-POD 기준점 확인 대기</b><p>'+esc(m.reason)+'</p><small>원문은 발행 당시 기록이며, 확인되지 않은 값으로 시각화를 채우지 않습니다.</small></div>';return m;}
 const bars=m.sectorReady?'<div class="bdSectors"><div><h3>미국 S&P500 11개 업종</h3>'+sectorRows(m.us)+'</div><details><summary>한국 10개 업종 펼쳐보기</summary>'+sectorRows(m.kr)+'</details></div>':
 '<p class="bdHint">34개 섹터의 동일 완료거래일 확인 전이므로 업종 순위를 표시하지 않습니다.</p>';
 const labels=['TRIPOD','BIPOD','NOPOD'].map(x=>'<span class="'+(m.pod===x?'active':'')+'">'+x+'</span>').join('');
 const points=['lower','current','up','tri'].map(k=>'<i class="bdDot '+k+'" style="left:'+m.points[k].toFixed(2)+'%" aria-hidden="true"></i>').join('');
 host.innerHTML='<div class="bdVisual">'
 +'<section class="bdPanel"><h2>지수 <small>미국 '+esc(m.day)+' 완료 일봉</small></h2>'
 +'<div class="bdIndex"><div><small>NASDAQ 100</small><strong class="'+(m.ndxPct>=0?'gain':'loss')+'">'+pct(m.ndxPct)+'</strong><small>'+n(m.ndx)+' · 제공자 참고</small></div>'
 +'<div class="bdIndexOther">'+m.markets.filter(x=>x.key!=='NASDAQ100').map(x=>metric(x.label,n(x.value),pct(x.d1_pct)+' · 참고')).join('')+'</div></div></section>'
 +'<section class="bdPanel"><h2>업종 <small>미국 11 · 한국 10 · 테마 13</small></h2><p class="bdHint">완료일봉 수익률 상대 강약이며 실제 자금 유입·유출 증거가 아닙니다.</p>'
 +bars+'<p class="bdHint">전체 34개 업종 및 기업 사건 연결 해석은 아래 분석 본문에서 확인</p></section>'
 +'<section class="bdPanel"><h2>트라이팟 (TRI-POD) <small>현재 단계와 전환 기준점</small></h2>'
 +'<div class="bdStage"><div><small>현재 원장 단계 · '+esc(m.regime)+'</small><strong>'+esc(m.pod)+'</strong><small>'+esc(m.target||'목표 미확인')+'</small></div><div class="bdStages">'+labels+'</div></div>'
 +'<div class="bdMetrics">'+metric('NDX / MA250',n(m.ndx)+' / '+n(m.ma250),pct(distance(m.ndx,m.ma250))+' · 250일선 대비')
 +metric('VIX10',n(m.vix10),'상승 TRIPOD 기준 < 28 / 하락 NOPOD 기준 ≥ 18')
 +metric('52주 고점 대비 DD',pct(m.dd),'TRIPOD 조건 -9% 이내')+'</div>'
 +'<div class="bdAxisIntro"><strong>지수 구간과 기준점</strong><small>아래 위치는 실제 지수 간격에 비례합니다.</small></div>'
 +'<div class="bdAxis" role="img" aria-label="하락 기준 '+n(m.axis.lower)+', 현재 '+n(m.axis.current)+', 상승 복귀 참고선 '+n(m.axis.up)+', 트라이팟 복귀선 '+n(m.axis.tri)+'"><div></div>'+points+'</div>'
 +'<div class="bdBounds">'+bound('하락 전환선 · MA250×0.95',m.axis.lower,m.distances.lower,'하락 레짐 + VIX10≥18이면 NOPOD 검토')
 +bound('현재 NDX · BIPOD',m.ndx,0,'현재 원장 상태')
 +bound('상승 복귀 참고선 · MA250×1.01',m.axis.up,m.distances.up,'하락 레짐 이후 상승 재진입 경계')
 +bound('TRIPOD 낙폭 조건선 · DD -9%',m.axis.tri,m.distances.tri,'상승 레짐 + VIX10<28도 필요')+'</div>'
 +'<p class="bdCall">현재 NDX에서 <b>하락 전환 후보까지 '+Math.abs(m.distances.lower).toFixed(2)+'%</b>, <b>TRIPOD 낙폭 조건선까지 +'+m.distances.tri.toFixed(2)+'%</b>. 단일 기준선 돌파만으로 단계가 확정되는 것이 아닙니다.</p>'
 +'<p class="bdHint">출처 '+esc(m.origin)+' · Observatory 동일 원장 완료 일봉 참고 · Nasdaq 공식 종가 독립검증은 별도 · 관찰용 NO_TRADE_REVIEW_ONLY</p></section>'
 +'<p class="bdHint">아래 8개 원문 분석은 최초 발행 기록입니다. 시각 요약만 동일 세션의 최신 공개 원장을 참조합니다.</p></div>';
 return m;
}
const css='.bdVisual{display:grid;gap:14px;margin:15px 0;color:#181818}.bdPanel{background:#fff;border:1px solid #e0e3e8;border-radius:14px;padding:16px}.bdPanel h2{margin:0 0 15px;background:#151515;color:#ffe100;padding:10px 12px;font-size:19px;display:flex;gap:12px;flex-wrap:wrap;align-items:baseline}.bdPanel h2 small{color:#fdf3bd;font-size:12px}.bdIndex{display:grid;grid-template-columns:1fr 1.5fr;gap:16px}.bdIndex>div:first-child{display:grid;align-content:start;gap:4px}.bdIndex strong{font-size:40px;font-variant-numeric:tabular-nums}.bdIndex small{font-size:12px;color:#626b77}.bdIndexOther{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.bdMetrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0}.bdMetric{border:1px solid #eaecf1;background:#f8fafc;border-radius:8px;padding:10px;display:grid;gap:5px;min-width:0}.bdMetric small{font-size:11px;line-height:1.5;color:#5e6c7c}.bdMetric b{font-size:16px;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}.bdVisual .gain{color:#137c57}.bdVisual .loss{color:#b8332c}.bdHint{font-size:11px;line-height:1.6;color:#667085}.bdSectors{display:grid;grid-template-columns:1fr 1fr;gap:18px}.bdSectors h3{font-size:13px}.bdSectors summary{font-size:13px;font-weight:700;cursor:pointer;padding:8px}.bdSectorRow{display:grid;grid-template-columns:minmax(70px,95px) minmax(40px,1fr) 65px;gap:7px;align-items:center;border-bottom:1px solid #f0f2f5;padding:4px 0;font-size:12px}.bdSectorRow i{height:7px;background:#edf0f4;border-radius:4px;overflow:hidden}.bdSectorRow em{display:block;height:100%;border-radius:4px;background:#137c57}.bdSectorRow em.loss{background:#bb3830}.bdSectorRow strong{font-size:12px;text-align:right}.bdStage{display:flex;gap:12px;flex-wrap:wrap;justify-content:space-between;align-items:center}.bdStage>div:first-child{display:grid;gap:4px}.bdStage strong{font-size:32px;color:#193e7c}.bdStage small{font-size:12px;color:#5e6a79}.bdStages{display:flex;gap:5px;flex-wrap:wrap}.bdStages span{padding:7px 10px;border-radius:7px;background:#f1f3f6;color:#667085;font-size:12px;font-weight:800}.bdStages .active{background:#164b98;color:#fff}.bdAxisIntro{margin-top:16px;display:flex;gap:7px;flex-wrap:wrap;justify-content:space-between}.bdAxisIntro strong{font-size:14px}.bdAxisIntro small{font-size:11px;color:#667085}.bdAxis{height:38px;margin:12px 9px 6px;position:relative}.bdAxis>div{position:absolute;top:15px;left:0;right:0;height:8px;background:linear-gradient(90deg,#b4cafa,#eef0f5,#fce9a0);border-radius:6px}.bdDot{position:absolute;top:10px;transform:translateX(-50%);width:15px;height:20px;border:2px solid #fff;box-shadow:0 0 0 1px #aaa;border-radius:6px;background:#9bacc4}.bdDot.lower{background:#c73630}.bdDot.up{background:#77899e}.bdDot.tri{background:#188457}.bdDot.current{top:5px;height:29px;width:19px;background:#151515;z-index:2;border-color:#ffe100;box-shadow:0 0 0 2px #111}.bdBounds{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.bdBound{border:1px solid #e8eaf0;padding:10px;border-radius:8px;display:grid;gap:5px}.bdBound small{font-size:11px;color:#5e6e82;line-height:1.5}.bdBound b{font-size:17px;font-variant-numeric:tabular-nums}.bdCall{background:#fff8d5;border-left:4px solid #e8ce14;padding:11px;font-size:12px;line-height:1.6}.bdHold{background:#fff8e7;border:1px dashed #ebce86;border-radius:8px;padding:15px;font-size:12px}.bdHold p{margin:5px 0}@media(max-width:760px){.bdPanel{padding:10px}.bdPanel h2{font-size:17px}.bdIndex,.bdSectors{grid-template-columns:1fr}.bdIndex strong{font-size:34px}.bdMetrics{grid-template-columns:repeat(2,minmax(0,1fr))}.bdBounds{grid-template-columns:repeat(2,minmax(0,1fr))}.bdBound b{font-size:15px}}@media(max-width:360px){.bdMetrics,.bdBounds{grid-template-columns:1fr}}';
if(typeof module==='object'&&module.exports){module.exports={build,render,css};return;}
root.JjooniBriefVisual={build,render,css};
if(root.document&&!root.document.getElementById('briefDigestCSS')){const e=root.document.createElement('style');e.id='briefDigestCSS';e.textContent=css;root.document.head.appendChild(e);}
})(typeof window==='object'?window:globalThis);
