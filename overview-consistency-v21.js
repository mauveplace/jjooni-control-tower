(function(){
'use strict';
if(window.__JJOONI_OVERVIEW_CONSISTENCY_V21)return;
const STATE={state:'BOOTING',version:'21.5',applied:0,hero_kospi:null,context_kospi:null,codes_scrubbed:0,dd_guarded:0};
window.__JJOONI_OVERVIEW_CONSISTENCY_V21=STATE;
const qs=(s,r=document)=>{try{return r.querySelector(s)}catch(_){return null}};
const qsa=(s,r=document)=>{try{return Array.from(r.querySelectorAll(s))}catch(_){return []}};
const leaf=e=>e&&e.children.length===0;
const text=e=>String(e&&e.textContent||'').trim().replace(/\s+/g,' ');
const num=v=>window.JjooniMetrics.number(v);
const pct=v=>num(v)==null?'—':(num(v)>0?'+':'')+num(v).toFixed(2)+'%';
function parseMs(v){let s=String(v||'').trim();if(!s)return null;if(!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(s)&&/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(s))s=s.replace(' ','T')+'+09:00';const x=Date.parse(s);return Number.isFinite(x)?x:null}
function stamp(v){const ms=parseMs(v);if(ms==null)return '시각 확인 필요';return new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(ms)).replace(/\.\s*/g,'/').replace(/\/$/,'')}
function setText(e,v){if(e&&String(e.textContent||'')!==String(v))e.textContent=String(v)}
function ensureStyle(){if(qs('#ctOverviewConsistencyV21Style'))return;const s=document.createElement('style');s.id='ctOverviewConsistencyV21Style';s.textContent=`
#ctSourceHealthBannerV15[data-v21="1"]{font-size:12px!important;line-height:1.45!important;padding:9px 12px!important}
.ctPerformanceDay .loss,#overviewAccounts .loss{color:#175cd3!important}.ctPerformanceDay .gain,#overviewAccounts .gain{color:#b42318!important}.ctPerformanceDay .neutral{color:#475467!important}.ctAcctComparisons{grid-column:1/-1;width:100%;margin-top:8px;padding-top:8px;border-top:1px solid #e3e9f1}.ctAcctComparisonRow{display:grid;grid-template-columns:90px minmax(0,1fr) 65px;gap:6px;align-items:center;margin:6px 0;font-size:12px!important;line-height:1.5}.ctAcctComparisonRow strong,.ctAcctComparisonRow b{text-align:right;font-size:12px!important;white-space:nowrap}.ctAcctComparisonNote{display:block;color:#64748b;font-size:11px!important;line-height:1.5;word-break:keep-all}
.ctDailyProfitChange{margin-top:10px;padding:10px;border-radius:8px;background:#f5f8fc}.ctDailyProfitChange strong{font-variant-numeric:tabular-nums}
#panel-overview .ctOvMini,#panel-overview .ctOvLabel,#panel-overview .ctAcctStats,#panel-overview .ctAcctStats span,#panel-overview .ctAcctStats b,#panel-overview .ctHumanAccountLineV6{font-size:11px!important;line-height:1.45!important}
#panel-overview .ctOvValue{font-size:max(20px,1.35vw)!important}
#panel-overview #overviewAccounts .ctAcctStats[data-periods]{display:flex!important;flex-direction:column!important;align-items:stretch!important;gap:10px!important;width:100%!important}
#panel-overview #overviewAccounts .ctAccountPeriodRow{display:grid!important;grid-template-columns:60px minmax(0,1fr) 76px!important;gap:8px!important;align-items:center!important;width:100%!important}
#panel-overview #overviewAccounts .ctAccountPeriodRow strong,#panel-overview #overviewAccounts .ctAccountPeriodRow b{display:block!important;visibility:visible!important;font-size:14px!important;line-height:1.5!important;white-space:nowrap!important}
#panel-overview #overviewAccounts .ctAccountPeriodLabel{text-align:left!important;color:#475467!important}
#panel-overview #overviewAccounts .ctAccountPeriodAmount,#panel-overview #overviewAccounts .ctAccountPeriodRate{text-align:right!important}
#panel-overview #overviewAccounts .ctAccountPeriodRow .gain{color:#b42318!important}
#panel-overview #overviewAccounts .ctAccountPeriodRow .loss{color:#175cd3!important}
#panel-overview #overviewAccounts .ctAccountCapitalRow{display:flex!important;justify-content:space-between!important;gap:8px!important;border-top:1px solid #e7ebf0!important;padding-top:8px!important;color:#667085!important;font-size:13px!important}
.ctDdGuardV21{color:#b45309!important;font-weight:900!important;font-size:11px!important;white-space:nowrap}
.ctPerformanceDay{font-size:16px}.ctPerformanceDayMetric>span,.ctPerformanceDayMetric>small,.ctPerformanceDayAccounts small{font-size:14px}.ctPriceEffectRow{display:flex;flex-direction:column!important;align-items:stretch;gap:5px;border-top:1px solid #e5ebf2;padding:10px 0}.ctPriceEffectRow span,.ctPriceEffectRow small{overflow-wrap:anywhere;word-break:keep-all}.ctPerformanceDayGrid,.ctPerformanceDayAccounts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.ctPerformanceDayMetric,.ctPerformanceDayAccounts>article{padding:12px;border:1px solid #dbe4ef;border-radius:12px;background:#fff;min-width:0}.ctPerformanceDayMetric>span,.ctPerformanceDayMetric>strong,.ctPerformanceDayMetric>b,.ctPerformanceDayMetric>small{display:block;word-break:keep-all;overflow-wrap:anywhere}.ctPerformanceDayMetric>strong{font-size:24px;line-height:1.4;margin:8px 0}.ctPerformanceDayMetric>small{margin-top:6px;color:#667085}.ctPerformanceDay summary{cursor:pointer;min-height:44px;padding:12px 0;font-weight:800}.ctPerformanceDay p{line-height:1.6;color:#526071}.ctPerformanceDayAccounts article>div{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin:8px 0}.ctPerformanceDayReference{border-top:1px solid #e5ebf2;padding-top:8px;color:#667085}.ctPerformanceDay h3,.ctPerformanceDay h4{word-break:keep-all}.ctPerformanceDayMetric b{font-size:14px}@media(max-width:480px){.ctPerformanceDayMetric{padding:10px}.ctPerformanceDayMetric>strong{font-size:21px}.ctPerformanceDayAccounts{grid-template-columns:1fr}.ctPerformanceDayGrid{gap:8px}}
`; (document.head||document.documentElement).appendChild(s)}
function context(){const L=window.__JJOONI_LIVE_PAYLOAD||{};return (L.market_context||{}).items||{}}
function marketSourceLabel(v){const s=String(v||'').toUpperCase();if(s==='KIS_INDEX')return 'KIS 당일지수';if(s==='YAHOO_REFERENCE'||s.includes('YAHOO'))return '시장 참고값';return '당일 시장값'}
function heroCellForLabel(label){if(!label)return null;let e=label;for(let i=0;e&&i<6;i++,e=e.parentElement){if(e.classList&&e.classList.contains('ctOvHeroCell'))return e;const t=text(e);if(t.length<260&&/KOSPI/.test(t)&&/[+-]?\d+(?:\.\d+)?%/.test(t))return e}return label.parentElement}
function patchKospi(){const L=window.__JJOONI_LIVE_PAYLOAD||{},k=(context().KOSPI)||{},move=num(k.change_pct);STATE.context_kospi=move;if(move==null)return;const root=qs('#panel-overview');if(!root)return;const labels=qsa('*',root).filter(e=>leaf(e)&&/KOSPI/.test(text(e))&&/(벤치마크|정규장)/.test(text(e)));const label=labels[0];if(!label)return;setText(label,'KOSPI 벤치마크');const cell=heroCellForLabel(label);if(!cell)return;let value=qs('.ctOvValue',cell);if(!value){const candidates=qsa('div,span,b,strong',cell).filter(e=>leaf(e)&&/^[+-]?\d+(?:\.\d+)?%$/.test(text(e)));candidates.sort((a,b)=>(parseFloat(getComputedStyle(b).fontSize)||0)-(parseFloat(getComputedStyle(a).fontSize)||0));value=candidates[0]||null}if(value)setText(value,pct(move));const mini=qs('.ctOvMini',cell);if(mini)setText(mini,'당일 기준 · '+marketSourceLabel(k.source)+' · '+stamp((L.market_context||{}).as_of_kst||L.generated_kst||L.observed_at));if(mini)mini.title='시장 원본 '+stamp((L.market_context||{}).as_of_kst||L.generated_kst||L.observed_at);STATE.hero_kospi=move}
function scrubCodes(){let count=0;const root=document.body;if(!root)return;const re=/(?:YAHOO_FALLBACK_NONLIVE|YAHOO_REGULAR_MARKET|Yahoo\s*정규장\s*(?:참고|시세)?)/g;const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[];while(w.nextNode())nodes.push(w.currentNode);for(const n of nodes){const s=String(n.nodeValue||''),x=s.replace(re,'시장 참고값').replace(/KOSPI 정규장/g,'KOSPI 벤치마크');if(x!==s){n.nodeValue=x;count++}}for(const e of qsa('[title]')){const s=String(e.title||''),x=s.replace(re,'시장 참고값');if(x!==s){e.title=x;count++}}STATE.codes_scrubbed=count}
function health(){const L=window.__JJOONI_LIVE_PAYLOAD||{};const generated=L.generated_kst||L.observed_at;const liveMs=parseMs(generated);const liveAge=liveMs==null?Infinity:Math.max(0,Date.now()-liveMs);const session=L.session||{};const marketOpen=String(session.state||'').toUpperCase()==='OPEN'||L.market_closed===false;const pb=((L.source_health||{}).pb_history)||{};const pbState=String(pb.state||'').toUpperCase();const historyAt=pb.as_of||L.pb_history_as_of||'';const historyStale=!['OK','VERIFIED'].includes(pbState);return {L,generated,liveAge,marketOpen,pb,pbState,historyAt,historyStale}}
function patchHealth(){const h=health();let b=qs('#ctSourceHealthBannerV15');const liveLate=['STALE','UNKNOWN'].includes(window.JjooniMetrics.freshness(h.L).state);if(!liveLate&&!h.historyStale){if(b)b.remove();document.documentElement.dataset.ctDataState='live';STATE.health_state=window.JjooniMetrics.freshness(h.L).state;return}if(!b){b=document.createElement('div');b.id='ctSourceHealthBannerV15';const top=qs('.top'),root=qs('.app')||document.body;if(top&&top.parentNode)top.parentNode.insertBefore(b,top.nextSibling);else root.insertBefore(b,root.firstChild)}b.dataset.v21='1';if(liveLate){b.style.cssText+=';border-color:#f04438!important;background:#fff1f0!important;color:#b42318!important';setText(b,'⚠ 현재 시세 업데이트 지연 · 마지막 수집 '+stamp(h.generated)+' · 새 값 수집을 확인 중입니다.');document.documentElement.dataset.ctDataState='live-stale';STATE.health_state='LIVE_STALE'}else{b.style.cssText+=';border-color:#f7b27a!important;background:#fff7ed!important;color:#9a3412!important';setText(b,h.historyAt?'현재 계좌·시세 수집 정상 · 성과 이력 '+stamp(h.historyAt)+' 검증 대기 · DD/누적성과 제한':'현재 계좌·시세 수집 정상 · 성과 이력 검증정보 미수신 · DD/누적성과 제한');document.documentElement.dataset.ctDataState='history-limited';STATE.health_state='HISTORY_LIMITED'}}
function pctLeaf(e){return leaf(e)&&/^[+-]?\d+(?:\.\d+)?%$/.test(text(e))}
function guardMetricLabel(labelEl){
 // The risk-summary notice has no numeric DD. Never walk up to a grid or
 // market-context sibling looking for an unrelated percentage to blank.
 const box=labelEl.closest('.ctOvHeroCell');if(!box)return 0;
 const vals=qsa('div,span,b,strong,small',box).filter(pctLeaf);
 if(vals.length!==1)return 0;
 setText(vals[0],'이력 갱신 대기');vals[0].classList.add('ctDdGuardV21');return 1;
}
function guardDd(){const h=health();if(!h.historyStale){STATE.dd_guarded=0;return}let c=0;const root=qs('#panel-overview');if(!root)return;for(const e of qsa('div,span,small,b,strong',root).filter(leaf)){const t=text(e);if(t==='DD'||/^현재 낙폭/.test(t)||/^Toss DD$/.test(t)||/^ISA DD$/.test(t)||/^연금저축 DD$/.test(t)||/^IRP DD$/.test(t))c+=guardMetricLabel(e)}STATE.dd_guarded=c}
function audit(){const root=qs('#panel-overview')||document.body;STATE.internal_codes_visible=(text(root).match(/YAHOO_FALLBACK_NONLIVE|YAHOO_REGULAR_MARKET/g)||[]).length;STATE.kospi_match=STATE.hero_kospi!=null&&STATE.context_kospi!=null&&Math.abs(STATE.hero_kospi-STATE.context_kospi)<0.0001;STATE.updated_at=new Date().toISOString();STATE.state='ACTIVE'}
// Common presentation owner. Canonical account facts are shared by cards,
// detail dialogs and every viewport; historical data never masquerades as live.
const ACCOUNT_IDS=['TOSS','ISA','PENSION','IRP'];
const ACCOUNT_NAMES={TOSS:'Toss',ISA:'ISA',PENSION:'연금저축',IRP:'IRP'};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>num(v)==null?'산정 대기':(Math.round(v)<0?'-':'')+'₩'+Math.abs(Math.round(v)).toLocaleString('ko-KR');
const signed=v=>num(v)==null?'자료 없음':(v>0?'+':'')+money(v);
function writeHtml(root,html){if(root&&root.innerHTML!==html){const keep=Array.from(root.querySelectorAll?.('.ctPerformanceDay details[open]')||[]).map(e=>e.dataset.priceAccount||'root');root.innerHTML=html;for(const key of keep){const detail=key==='root'?root.querySelector?.('.ctPerformanceDay>details'):root.querySelector?.('[data-price-account=\"'+key+'\"]');if(detail)detail.open=true}}}
function ownedRoot(panel,id){let root=qs('#'+id,panel);if(!root){root=document.createElement('section');root.id=id;root.className='ctCommonView';panel.prepend(root)}return root}
function cardByHeading(root,label){return qsa('h2,h3',root).find(e=>text(e)===label)?.closest('.card')||null}
function commonModel(){const C=window.__JJOONI_CANONICAL_SSOT||{},L=window.__JJOONI_LIVE_PAYLOAD||{};return {C,L,total:window.JjooniMetrics.aggregate(C.accounts),history:health()}}
function currentPerformance(){
 const panel=qs('#panel-compare');if(!panel)return;const {C,L,total,history}=commonModel(),root=ownedRoot(panel,'ctCurrentPerformance');
 panel.dataset.ctHistoryLimited=history.historyStale?'1':'0';
 const performanceDay=window.JjooniPerformanceDay?.html(L)||'';
 if(performanceDay){writeHtml(root,`<h2>성과분석</h2><p>현재 총자산 · ${money(total.nav)} · 원본 ${esc(stamp(L.generated_kst||L.observed_at))}</p>${performanceDay}`);return}
 const max=Math.max(1,...ACCOUNT_IDS.map(id=>Math.abs(num(C.accounts?.[id]?.today_pnl)||0)));
 const rows=ACCOUNT_IDS.map(id=>{const a=C.accounts?.[id]||{},p=num(a.today_pnl);return `<div class="ctCommonAccount"><div><b>${ACCOUNT_NAMES[id]}</b><span>${money(a.nav)}</span></div><div class="ctCommonBar" aria-hidden="true"><i class="${p<0?'loss':'gain'}" style="width:${p==null?0:100*Math.abs(p)/max}%"></i></div><strong class="${p<0?'loss':'gain'}">${signed(p)}</strong><small>오늘 수익률 ${pct(a.today_return)}</small></div>`}).join('');
 writeHtml(root,`<h2>성과분석</h2><p>현재 계좌 원본 ${esc(stamp(L.generated_kst||L.observed_at))} · 오늘 투자손익과 순입출금을 구분합니다.</p><div class="ctCommonMetrics"><article><span>현재 총자산 · 4계좌</span><strong>${money(total.nav)}</strong></article><article><span>오늘 투자손익 · ${total.known_day}/4계좌</span><strong>${signed(total.day)}</strong></article><article><span>오늘 순입출금</span><strong>${signed(total.flow)}</strong></article></div><h3>계좌별 오늘 투자손익</h3><div class="ctCommonAccountGrid">${rows}</div>${history.historyStale?'<div class="ctCommonNotice"><b>기간 성과 검증 대기</b><p>과거 원장의 기준일·입출금 대사가 확인되기 전에는 누적수익률·낙폭·일별 성과 그래프를 현재 성과로 표시하지 않습니다.</p></div>':''}`);
}
function qualityView(){
 const panel=qs('#panel-quality');if(!panel)return;const {C,L,total,history}=commonModel(),root=ownedRoot(panel,'ctCurrentQuality'),fresh=window.JjooniMetrics.freshness(L);
 panel.dataset.ctCanonicalView='1';const rows=ACCOUNT_IDS.map(id=>{const a=C.accounts?.[id]||{},has=num(a.nav)!=null,ps=Array.isArray(a.positions);return `<article><h3>${ACCOUNT_NAMES[id]}</h3><b>${has?'계좌 원본 연결':'계좌 원본 누락'}</b><dl><dt>자산</dt><dd>${money(a.nav)}</dd><dt>보유 자료</dt><dd>${ps?a.positions.length+'종목':'확인 필요'}</dd><dt>오늘손익</dt><dd>${num(a.today_pnl)==null?'손익 원천 미확인':esc(a.today_pnl_quality||'산정방식 미확인')}</dd><dt>수집 기준</dt><dd>${esc(stamp(a.observed_at||a.generated_kst||C.observed_at||L.generated_kst))}</dd><dt>원천</dt><dd>${esc(a.source||a.quality||'확인 필요')}</dd></dl></article>`}).join('');
 writeHtml(root,`<h2>데이터품질</h2><p>계좌 원본 · 시세 갱신 · 기간 성과를 각각 확인합니다.</p><div class="ctCommonNotice">계좌 원본: ${esc(fresh.text)} · ${total.known_day}/4계좌 오늘손익 확인<br>마지막 원본 ${esc(stamp(L.generated_kst||L.observed_at))}</div><div class="ctCommonAccountGrid">${rows}</div><div class="ctCommonNotice"><b>기간 성과: ${history.historyStale?'검증 대기':'검증 완료'}</b><p>이력 기준 ${esc(stamp(history.historyAt))} · 현재 계좌 원본과 별도 관리</p></div>`);
}
function cleanLegacy(){
 qs('#ctSideAI')?.remove();
 for(const root of qsa('#panel-overview,#panel-compare,#panel-portfolio')){
  for(const heading of qsa('h3',root)){if(/Human vs AI/.test(text(heading)))heading.closest('.card')?.remove()}
  for(const row of qsa('.ctAction,.ctBenchRow,.ctAttribRow,.ctRiskItem,.ctAcct',root)){
   const name=qs('.ctActionWho,.ctBenchAcct,.ctRiskTitle,.ctAcctName',row);
   if(name&&/AI BOT|AI Bot|AUTOBOT|^TRI-POD$/.test(text(name))&&!row.querySelector('.ctStrategySleeve'))row.remove();
  }
 }
 // The old footer describes retired sources, not the current four-account feed.
 for(const e of qsa('.app div,.app p,.app small,.footer'))if((!e.children.length||e.classList.contains('footer'))&&/^(Human = PB DB SSOT|CURRENT는 최신 운용값|현재 전체자산 = Broker Actual NAV)/.test(text(e)))e.hidden=true;
 const decisions=qs('#panel-decisions');if(decisions){const p=qsa('div,p',decisions).find(e=>!e.children.length&&text(e)==='표시 가능한 Decision 데이터가 없습니다.');if(p)setText(p,'연결된 PB 판단 자료가 없습니다. 판단 생성·연결 여부를 확인해 주세요. 계좌 수집 정상과는 별도 상태입니다.')}
}
function accountPeriods(stats,a){
 const principal=num(a.principal),result=window.JjooniMetrics.cumulative(a),pnl=result.pnl,ret=result.return_pct;
 const tone=v=>num(v)==null?'unknown':v<0?'loss':'gain';
 const row=(kind,label,amount,rate)=>`<div class="ctAccountPeriodRow" data-period="${kind}"><strong class="ctAccountPeriodLabel">${label}</strong><strong class="ctAccountPeriodAmount ${tone(amount)}">${signed(amount)}</strong><b class="ctAccountPeriodRate ${tone(amount)}">${pct(rate)}</b></div>`;
 stats.dataset.periods='daily-cumulative';
 const daily=window.JjooniPerformanceDay?.daily(a)||{pnl:a.today_pnl,rate:a.today_return};
 writeHtml(stats,row('daily',daily.brokerOnly?'증권사 당일':daily.priceOnly?'가격변동':'당일',daily.pnl,daily.rate)+row('cumulative','누적',pnl,ret)+`<div class="ctAccountCapitalRow"><strong>납입원금</strong><b>${money(principal)}</b></div>`);
}
function overviewCommon(){
 const panel=qs('#panel-overview');if(!panel)return;const {C,L,total,history}=commonModel();
 if(L.performance_day){setText(qs('#ctPrevNav',panel),num(total.previous)!=null?money(total.previous):'마감 기준자산 확인 중');if(L.performance_day.price_effect?.known_count>0)setText(qs('#ctExtendedTotal',panel),'미국 정규장 마감 후 · 현재 보유수량 기준');if(num(total.day)==null)setText(qs('#ctBmState',panel),'계좌 수익률 대사 후 비교');}
 for(const e of qsa('.ctAcctSpark,.ctSparkHead',panel))e.hidden=history.historyStale;
 const dayHeading=qsa('h3',panel).find(e=>/^오늘 손익/.test(text(e)));let dayCard=qs('#ctCanonicalDailySummary',panel)||dayHeading?.closest('.card');
 if(!dayCard&&L.performance_day){dayCard=document.createElement('section');dayCard.className='card';dayCard.id='ctCanonicalDailySummary';const accounts=qs('#overviewAccounts',panel);if(accounts?.parentNode)accounts.parentNode.insertBefore(dayCard,accounts);else panel.prepend(dayCard)}
 if(dayCard){dayCard.id='ctCanonicalDailySummary';const dayHtml=window.JjooniPerformanceDay?.html(L);if(dayHtml)writeHtml(dayCard,dayHtml);else writeHtml(dayCard,`<h3>계좌별 오늘 투자손익</h3><p>상단과 동일한 계좌 원본 · ${total.known_day}/4계좌 확인</p>${ACCOUNT_IDS.map(id=>`<div class="ctCommonLine"><span>${ACCOUNT_NAMES[id]}</span><b>${signed(C.accounts?.[id]?.today_pnl)}</b></div>`).join('')}<div class="ctCommonLine"><b>4계좌 합계</b><strong>${signed(total.day)}</strong></div>`)}
 let qualityCard=qs('#ctDailyQualityGroups',panel);const dq=total.day_quality;
 if(dq&&dq.state!=='MISSING'){
  if(!qualityCard){qualityCard=document.createElement('section');qualityCard.id='ctDailyQualityGroups';qualityCard.className='card';panel.appendChild(qualityCard)}
  const names={BROKER_MEASURED:'증권사 측정',MODELED:'모델 계산',UNKNOWN:'산정방식 미확인'};
  writeHtml(qualityCard,`<h3>당일손익 산정방식${dq.state==='MIXED'?' · 혼합':''}</h3>${Object.entries(dq.groups).filter(([,g])=>g.ids.length).map(([key,g])=>`<div class="ctCommonLine"><span>${names[key]} · ${g.ids.map(id=>esc(ACCOUNT_NAMES[id]||id)).join(' · ')}</span><strong>${signed(g.subtotal)}</strong></div>`).join('')}<p>${dq.comparable_period?'동일한 명시 기준기간으로 비교합니다.':'계좌별 기준기간이 같다고 확인되지 않았습니다. 그룹별 소계를 먼저 확인하세요.'}${dq.state==='MIXED'?' 합계에는 측정·계산 방식이 다른 손익이 포함됩니다.':''}</p>`);
 }else qualityCard?.remove();
 let coverage=qs('#ctCumulativeCoverage',panel);
 if(total.missing_cumulative.length){if(!coverage){coverage=document.createElement('section');coverage.id='ctCumulativeCoverage';coverage.className='card';panel.appendChild(coverage)}writeHtml(coverage,`<h3>누적손익 확인 범위</h3><p>${total.known_cumulative}/${total.account_count}계좌 확인 · 미확정: ${total.missing_cumulative.map(id=>esc(ACCOUNT_NAMES[id]||id)).join(' · ')}</p><div class="ctCommonLine"><span>확인된 계좌 누적손익 소계</span><strong>${num(total.known_cumulative_subtotal)==null?'확인된 손익 없음':signed(total.known_cumulative_subtotal)}</strong></div><p>미확정 계좌를 제외한 소계입니다. IRP는 검증된 증권사 누적손익 또는 확정 순납입원금이 필요합니다. 전체 누적손익과 수익률은 모든 계좌의 원천이 확인된 뒤 확정합니다.</p>`)}else coverage?.remove();
 const bench=qs('#ctBenchmarkTable',panel);if(bench){bench.hidden=true;const card=bench.closest('.card');const badge=qs('.badge',card);if(badge)setText(badge,'검증 대기');if(card){let note=qs('.ctCommonNotice',card);if(!note){note=document.createElement('p');note.className='ctCommonNotice';card.append(note)}setText(note,'계좌별 정규장 비교는 같은 거래일·시세 범위 대사 후 표시합니다. 상단 시장지표는 마지막 원본 기준입니다.')}}
 const exposure=qs('#ctCanonicalExposure',panel)||cardByHeading(panel,'노출 구성 (Look-through)');
 if(exposure){exposure.id='ctCanonicalExposure';const amounts={KRW:0,USD:0};let covered=0;for(const id of ACCOUNT_IDS){const a=C.accounts?.[id]||{};for(const p of window.JjooniMetrics.positions(a)){const v=window.JjooniMetrics.valueKrw(p,a);if(v!=null){const cur=window.JjooniMetrics.currency(p);amounts[cur]=(amounts[cur]||0)+v;covered+=v}}const kr=num(a.cash_krw),us=num(a.cash_usd),fx=window.JjooniMetrics.fx(a)||num(L.fx_reference?.krw_per_usd);if(kr!=null){amounts.KRW+=kr;covered+=kr}if(us!=null&&(us===0||fx>0)){const v=us===0?0:us*fx;amounts.USD+=v;covered+=v}}
   writeHtml(exposure,`<h3>계좌·통화 구성</h3><p>현재 4계좌 자산 기준 · 전략 자산 중복 합산 없음</p>${ACCOUNT_IDS.map(id=>`<div class="ctCommonLine"><span>${ACCOUNT_NAMES[id]}</span><b>${total.nav>0&&num(C.accounts?.[id]?.nav)!=null?(100*C.accounts[id].nav/total.nav).toFixed(1)+'%':'산정 대기'}</b></div>`).join('')}<h4>통화 노출 · 원화 환산</h4>${Object.entries(amounts).map(([k,v])=>`<div class="ctCommonLine"><span>${esc(k)}</span><b>${money(v)}</b></div>`).join('')}<p>환산 가능한 자산 ${money(covered)}${total.nav!=null?' · 잔여·대사 차이 '+money(total.nav-covered):''}. 통화는 상장 시장 기준과 다를 수 있습니다.</p>`)
 }
 if(history.historyStale){for(const root of qsa('.ctAcct',document)){for(const e of qsa('.ctAcctSpark,.ctSparkHead',root))e.hidden=true;for(const e of qsa('div,span,b,strong',root)){if(e.children.length)continue;const t=text(e);if(/^(?:30D|30거래일|NDX Proxy)/.test(t))setText(e,'기간 성과 · 검증 대기');else if(t==='DD')guardMetricLabel(e)}}const risk=qsa('.ctRiskTitle',panel).find(e=>/^현재 낙폭/.test(text(e)));if(risk)setText(risk,'현재 낙폭 · 검증 대기');}
 for(const card of qsa('#overviewAccounts .ctAcct',panel)){const name=text(qs('.ctAcctName',card)),id=ACCOUNT_IDS.find(id=>ACCOUNT_NAMES[id]===name);if(!id)continue;const a=C.accounts?.[id]||{},stats=qs('.ctAcctStats',card);if(stats){if(['ISA','PENSION'].includes(id))accountPeriods(stats,a);else if(id==='TOSS'){
 const daily=window.JjooniPerformanceDay?.daily(a)||{pnl:a.today_pnl,rate:a.today_return};
 const h=window.JjooniMetrics.tossHoldingPerformance(a);
 const tone=v=>num(v)==null?'unknown':v<0?'loss':'gain';
 const row=(kind,label,amount,rate)=>`<div class="ctAccountPeriodRow" data-period="${kind}"><strong class="ctAccountPeriodLabel">${label}</strong><strong class="ctAccountPeriodAmount ${tone(amount)}">${num(amount)==null?'자료 확인 필요':signed(amount)}</strong><b class="ctAccountPeriodRate ${tone(rate)}">${pct(rate)}</b></div>`;
 stats.dataset.periods='daily-holdings';
 writeHtml(stats,row('daily',daily.brokerOnly?'증권사 당일':daily.priceOnly?'가격변동':'당일',daily.pnl,daily.rate)+row('holdings','전체 보유 평가손익',h.pnl,h.return_pct));
 }else{const daily=window.JjooniPerformanceDay?.daily(a)||{pnl:a.today_pnl,rate:a.today_return,label:'오늘 투자손익'};writeHtml(stats,`<span>${daily.label}</span><div class="ctAcctTodayValue ${daily.pnl<0?'loss':daily.pnl>0?'gain':'neutral'}">${signed(daily.pnl)}</div><span>${daily.priceOnly?'보유가격 수익률':'오늘 수익률'}</span><b class="${daily.pnl<0?'loss':daily.pnl>0?'gain':'neutral'}">${pct(daily.rate)}</b>`) }}}
 const proof=C.performance_day?.price_comparisons,valid=proof?.snapshot_id===C.snapshot_id&&proof?.current?.start_kst===C.performance_day?.start_kst&&Date.now()<Date.parse(C.performance_day?.end_kst);
 for(const card of qsa('#overviewAccounts .ctAcct',panel)){const id=ACCOUNT_IDS.find(id=>ACCOUNT_NAMES[id]===text(qs('.ctAcctName',card)));if(!id)continue;let box=qs('.ctAcctComparisons',card);if(!valid){box?.remove();continue}if(!box){box=document.createElement('section');box.className='ctAcctComparisons';box.dataset.account=id;box.setAttribute('aria-label',ACCOUNT_NAMES[id]+' 전일·전주 손익 비교');card.appendChild(box)}const c=Object.fromEntries(['current','previous','week','day_change'].map(k=>[k,proof[k]?.accounts?.[id]]));writeHtml(box,window.JjooniPerformanceDay?.accountComparisonHtml(c)||'');}
 const risk=qs('#ctCanonicalRisk',panel)||cardByHeading(panel,'Risk Alert');if(risk){risk.id='ctCanonicalRisk';const values=ACCOUNT_IDS.flatMap(id=>window.JjooniMetrics.positions(C.accounts?.[id]).map(p=>({id,p,value:window.JjooniMetrics.valueKrw(p,C.accounts[id])}))).filter(x=>x.value!=null).sort((a,b)=>b.value-a.value);const largest=values[0];writeHtml(risk,`<h3>리스크 확인</h3><div class="ctCommonNotice">${history.historyStale?'현재 낙폭 · 기간 성과 검증 대기':'기간 성과 검증 완료'}</div>${largest?`<p>최대 보유 평가액: ${esc(largest.p.name||largest.p.ticker)} · ${ACCOUNT_NAMES[largest.id]}<br>${money(largest.value)} · 전체 자산 대비 ${total.nav>0?(100*largest.value/total.nav).toFixed(1)+'%':'산정 대기'}</p>`:''}<p>실제 보유 원본 기준입니다. 손익·시세가 누락된 종목은 0으로 판단하지 않습니다.</p>`)}
 const meta=qs('.ctOvMetaRow .ctOvMeta',panel);if(meta)setText(meta,'계좌 원본 '+stamp(L.generated_kst||L.observed_at));
 // Stale regular/off-hours components cannot explain canonical account P&L.
 for(const e of qsa('.ctOvMini',panel))if(/^정규장.*장외/.test(text(e)))setText(e,'오늘 투자손익은 계좌 원본 기준 · 장별 분해 대기');
 for(const e of qsa('.ctOvSession,.ctSessionChip,.ctOvMetaRow>.badge',panel))setText(e,'원본 '+stamp(L.generated_kst||L.observed_at));
}
let moverFilter='all';
function renderMovers(){
 const panel=qs('#panel-overview'),card=qs('#ctCanonicalMovers',panel)||qs('.ctOvLossCard',panel);if(!card)return;card.id='ctCanonicalMovers';
 const {C}=commonModel(),positions=ACCOUNT_IDS.flatMap(id=>Array.isArray(C.accounts?.[id]?.holding_price_effect?.positions)?C.accounts[id].holding_price_effect.positions.map(p=>({id,p,day:num(p.price_effect_krw)})):window.JjooniMetrics.positions(C.accounts?.[id]).map(p=>({id,p,day:window.JjooniMetrics.positionDay(p,C.accounts[id])}))),known=positions.filter(x=>x.day!=null),selected=known.filter(x=>moverFilter==='all'||(moverFilter==='up'?x.day>0:x.day<0)).sort((a,b)=>Math.abs(b.day)-Math.abs(a.day));
 writeHtml(card,`<h3>${C.performance_day?.price_effect?'보유종목 가격변동 · 미국 마감 기준':window.__JJOONI_LIVE_PAYLOAD?.performance_day?'보유종목 가격효과 · 원천 구간 참고':'보유종목 당일손익'}</h3><p>종목별 손익 확인 ${known.length}/${positions.length}개 · 계좌 손익에는 매매·비용 등이 별도로 포함됩니다.</p><div class="ctCommonFilters" role="group" aria-label="보유종목 필터">${[['all','전체'],['up','상승'],['down','하락']].map(([key,label])=>`<button type="button" data-cm-filter="${key}" aria-pressed="${moverFilter===key}">${label}</button>`).join('')}</div>${selected.slice(0,12).map(x=>`<div class="ctCommonLine"><span>${esc(x.p.name||x.p.ticker)}<small> · ${ACCOUNT_NAMES[x.id]}</small></span><b class="${x.day<0?'loss':'gain'}">${signed(x.day)}</b></div>`).join('')||'<p>이 조건에서 확인된 종목별 손익이 없습니다. 전일 종가·종목별 손익 자료를 확인해 주세요.</p>'}`);
 if(!card.dataset.filterBound){card.dataset.filterBound='1';card.addEventListener('click',e=>{const b=e.target.closest('[data-cm-filter]');if(b){moverFilter=b.dataset.cmFilter;renderMovers()}})}
}

function currentPortfolio(){
 const panel=qs('#panel-portfolio');if(!panel)return;
 const {C,L,total,history}=commonModel(),root=ownedRoot(panel,'ctCurrentPortfolio');
 for(const id of ['accounts','risks','humanPositions']){const old=qs('#'+id,panel);if(old){const card=old.closest('.card');if(card)card.hidden=true;else old.hidden=true}}
 const extra=qs('#portfolio-extra');if(extra)extra.hidden=history.historyStale;
 const positions=ACCOUNT_IDS.flatMap(id=>window.JjooniMetrics.positions(C.accounts?.[id]).map(p=>({id,p,value:window.JjooniMetrics.valueKrw(p,C.accounts[id])}))).sort((a,b)=>(b.value??-Infinity)-(a.value??-Infinity));
 writeHtml(root,`<h2>현재 보유분석</h2><p>4계좌 동일 원본 · ${esc(stamp(L.generated_kst||L.observed_at))} · 전략 보유분 중복 합산 없음</p><div class="ctCommonMetrics"><article><span>총자산</span><strong>${money(total.nav)}</strong></article><article><span>보유 자료</span><strong>${positions.length}종목</strong></article></div><h3>계좌별 자산·보유 가격변동</h3>${ACCOUNT_IDS.map(id=>{const a=C.accounts?.[id]||{},day=window.JjooniPerformanceDay?.daily(a);return `<div class="ctCommonLine"><span>${ACCOUNT_NAMES[id]}<small> · ${day?.label||'오늘 손익'}</small></span><b>${money(a.nav)}<small> · ${signed(day?day.pnl:a.today_pnl)}</small></b></div>`}).join('')}<h3>현재 보유 평가액</h3><p>같은 종목도 계좌별 실제 보유분을 표시합니다. 가격변동은 계좌 전체 투자손익과 구분합니다.</p>${positions.map(x=>`<div class="ctCommonLine"><span>${esc(x.p.name||x.p.ticker)}<small> · ${ACCOUNT_NAMES[x.id]} · ${String(x.p.record_type||'').toUpperCase()==='FUND'?'펀드 · 좌수 별도 확인':esc(x.p.qty??x.p.quantity??'미확인')+'주'}</small></span><b>${money(x.value)}<small> · ${total.nav>0&&x.value!=null?(100*x.value/total.nav).toFixed(2)+'%':'비중 미확인'}</small></b></div>`).join('')}${history.historyStale?'<div class="ctCommonNotice">과거 성과 원장 검증 대기 · 이전 원장의 손익 0원·벤치마크·낙폭을 현재 성과로 표시하지 않습니다. 현재 보유수량·평가액과 일중 그래프는 별도 조회합니다.</div>':''}`);
}
function commonViews(){if(!window.__JJOONI_CANONICAL_SSOT?.accounts)return;cleanLegacy();currentPerformance();qualityView();overviewCommon();currentPortfolio();renderMovers()}

function apply(){ensureStyle();commonViews();patchKospi();scrubCodes();patchHealth();guardDd();audit();STATE.applied++}
let queued=false;function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply();setTimeout(apply,80)})}
apply();setTimeout(apply,350);setTimeout(apply,1600);document.addEventListener('jjooni:live-applied',schedule);document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});window.addEventListener('resize',schedule,{passive:true});document.addEventListener('click',e=>{if(e.target.closest?.('.tab[data-tab],#ctMoreMenu button'))setTimeout(schedule,120)});
})();
