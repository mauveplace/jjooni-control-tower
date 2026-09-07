(function(){
'use strict';
if(window.__JJOONI_ACCOUNT_SOURCE_V22)return;
window.__JJOONI_ACCOUNT_SOURCE_V22={state:'BOOTING',version:'22.1'};

const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null};
const q=(s,r=document)=>{try{return r.querySelector(s)}catch(_){return null}};
const qa=(s,r=document)=>{try{return Array.from(r.querySelectorAll(s))}catch(_){return []}};
const norm=s=>String(s||'').replace(/\s+/g,' ').trim();
const ACCOUNT_METRICS=new Set(['당일 투자성과','당일 손익','정규장 투자성과','순입출금','현재 NAV','오늘 수익률','전체 영향도','주식 평가액','예수금','📈 보유종목 가격효과','💱 보유종목 환율효과','🧩 당일매매·비용 Bridge','정규장 P&L','정규장 수익률','보유종목','KR','US','Best','Worst']);

function patchCanonical(){
 const L=window.__JJOONI_LIVE_PAYLOAD||{};
 const C=window.__JJOONI_CANONICAL_SSOT||{};
 if(!C.accounts)return false;
 const liveA=(L.accounts||{}).AI||{};
 const ai=C.accounts.AI||{};
 const aiMode=String(liveA.mode||ai.source||'').toUpperCase();
 const aiBrokerCode=String(liveA.broker_code||ai.broker_code||'').toUpperCase();
 const aiProvider=String(liveA.provider||liveA.source||ai.provider||ai.source||'').toUpperCase();
 const aiStatus=String(liveA.status||'').toUpperCase();
 const aiNav=n(liveA.nav??ai.nav);
 const kisIdentity=aiMode.includes('KIS')||aiBrokerCode==='KIS'||aiProvider.includes('KIS_OPEN_API')||aiProvider.includes('KOREA INVESTMENT')||liveA.broker_direct===true||String(liveA.position_authority||'').toUpperCase().includes('KIS_OPEN_API_BROKER_BALANCE');
 const kisDirect=aiStatus==='LIVE'&&aiNav!=null&&aiNav>0&&kisIdentity;
 if(kisDirect){
   ai.source='BROKER_DIRECT_KIS_KR+OVERSEAS';
   ai.quality=String(liveA.status||'UNKNOWN');
   ai.account_quality=String(liveA.status||'UNKNOWN');
   ai.holdings_quality='BROKER_DIRECT_KIS_API';
   ai.cash_quality='BROKER_DIRECT_KIS_API';
   ai.broker='한국투자증권';
   ai.broker_code='KIS';
   ai.broker_api='KIS Open API';
   ai.today_pnl_quality=String(liveA.today_pnl_quality||ai.today_pnl_quality||'UNSPECIFIED');
 }
 const liveT=(L.accounts||{}).TOSS||{};
 const toss=C.accounts.TOSS||{};
 const tossState=String(liveT.status||toss.quality||'').toUpperCase();
 const tossMode=String(liveT.mode||liveT.source||toss.source||'').toUpperCase();
 if(tossState==='BROKER_LIVE_FULL'||tossMode.includes('TOSS')){
   toss.quality=String(liveT.status||'UNKNOWN');
   toss.account_quality=String(liveT.status||'UNKNOWN');
   toss.holdings_quality='BROKER_DIRECT_TOSS_API';
   toss.cash_quality='BROKER_DIRECT_TOSS_API';
   toss.broker='Toss증권';
 }
 (C.registry||[]).forEach(r=>{
   if(String(r.id||'').toUpperCase()==='AI')r.broker='한국투자증권';
   if(String(r.id||'').toUpperCase()==='TOSS')r.broker='Toss증권';
 });
 C.accounts.AI=ai;C.accounts.TOSS=toss;
 return kisDirect;
}

function patchUi(kisDirect){
 const C=window.__JJOONI_CANONICAL_SSOT||{};
 const ai=(C.accounts||{}).AI||{};
 const measured=qa('#ctHeroTrustStripV6 button.measured')[0];
 if(measured&&/증권사 확인/.test(measured.textContent||''))measured.textContent=(measured.textContent||'').replace('증권사 확인','API 원천');
 const modeled=qa('#ctHeroTrustStripV6 button.modeled')[0];
 if(modeled&&/계산값/.test(modeled.textContent||''))modeled.textContent=(modeled.textContent||'').replace('계산값','모델/계산');
 const title=q('.ctTrustDetailTitleV6');if(title)title.textContent='계좌 데이터 원천 / 오늘손익 품질';
 const sub=q('.ctTrustDetailSubV6');if(sub)sub.textContent='Toss와 AI BOT의 보유자산·예수금·NAV는 증권사 API 원천값입니다. 오늘손익의 시세산출 여부는 별도 품질로 구분합니다.';
 qa('.ctTrustRowV6').forEach(row=>{
   const name=String(q('b',row)?.textContent||'').trim();
   const src=q('.ctTrustSourceV6',row);
   if(!src)return;
   if(name==='AI BOT')src.textContent=kisDirect?'한국투자증권 API':'한국투자증권 · API 원천 미확인';
   else if(name==='Toss')src.textContent='Toss API';
 });
 const aiLine=q('#ctHumanAIV6');
 if(aiLine){
   aiLine.innerHTML=aiLine.innerHTML.replace(/<span class="measured">증권사 확인<\/span>/,'<span class="measured">한국투자증권 API</span>');
   const pq=String(ai.today_pnl_quality||'').toUpperCase();
   if((pq.includes('MODEL')||pq.includes('MTM')||pq.includes('PARTIAL'))&&!aiLine.textContent.includes('오늘손익 시세산출'))aiLine.insertAdjacentText('beforeend',' · 오늘손익 시세산출');
 }
 qa('#ctDesktopAccountsV8 .ctA8Card').forEach(card=>{
   const name=norm(q('.ctA8Name',card)?.textContent);
   const src=q('.ctA8Source',card);if(!src)return;
   const basis=(src.textContent||'').split('· 기준').slice(1).join('· 기준').trim();
   if(name==='AI BOT')src.textContent=(kisDirect?'한국투자증권 API':'한국투자증권 · API 원천 미확인')+(basis?' · 기준 '+basis:'');
   if(name==='Toss')src.textContent='Toss API'+(basis?' · 기준 '+basis:'');
 });
}

function fx(id,p){
 const L=window.__JJOONI_LIVE_PAYLOAD||{},C=window.__JJOONI_CANONICAL_SSOT||{};
 const a=(C.accounts||{})[id]||{},live=(L.accounts||{})[id]||{};
 for(const v of [p?.fx_krw_per_usd,p?.fx,a.fx_krw_per_usd,a.fx,live.fx_krw_per_usd,live.fx]){const x=n(v);if(x&&x>500&&x<3000)return x}
 const ref=L.fx_reference||{},x=n(ref.krw_per_usd);
 if(x&&x>500&&x<3000&&String(ref.source||'').toUpperCase()!=='FX_REFERENCE_MISSING')return x;
 return null;
}
function currency(p){return String(p?.currency||((String(p?.market||'').toUpperCase()==='US')?'USD':'KRW')).toUpperCase()}
function positionValueKrw(p){return window.JjooniMetrics.valueKrw(p,window.__JJOONI_CANONICAL_SSOT?.accounts?.[p.account||p.account_type])}
function stockValue(id){return window.JjooniMetrics.stock(window.__JJOONI_CANONICAL_SSOT?.accounts?.[id])}
function won(v){return '₩'+Math.round(Math.abs(Number(v)||0)).toLocaleString('ko-KR')}
function modalAccountId(){
 const m=q('#accountDrillModal');if(!m)return null;
 const t=norm(q('h1,h2,h3,.modalTitle,.title',m)?.textContent).toUpperCase();
 if(t.includes('AI BOT'))return'AI';if(t.includes('TRI-POD')||t.includes('TRIPOD'))return'TRIPOD';if(t.includes('연금'))return'PENSION';if(/\bISA\b/.test(t))return'ISA';if(/\bIRP\b/.test(t))return'IRP';if(t.includes('TOSS'))return'TOSS';
 const C=window.__JJOONI_CANONICAL_SSOT||{},txt=norm(m.textContent);
 for(const id of ['TOSS','ISA','PENSION','IRP','AI','TRIPOD']){const v=n((C.accounts||{})[id]?.nav);if(v!=null&&txt.includes(won(v)))return id}
 return null;
}
function valueNode(el){return q('.value,.v2Value,[class*="Value"],[class*="value"]',el)}
function routeMain(raw,panel){
 const t=norm(raw);
 if(panel.includes('quality')||/Source|Observed/i.test(t))return['disable','TECH_METADATA'];
 if(t.startsWith('전체 6계좌 NAV'))return['total-nav'];if(t.startsWith('총 누적손익'))return['total-pnl'];if(t.startsWith('총 수익률'))return['total-return'];
 if(t.startsWith('Human MDD'))return['disable','HISTORY_REQUIRED'];if(t.startsWith('현재 보유 TQQQ')||t.startsWith('평균단가')||t.startsWith('현재가')||t.startsWith('평가손익')||t.startsWith('수익률'))return['tp'];
 if(t.startsWith('송팀장 목표'))return['disable','STRATEGY_REFERENCE'];if(t.startsWith('Human 정규장 P&L'))return['human-day'];if(t.startsWith('장외변동'))return['disable','NO_COMPONENT'];if(t.startsWith('현재 Human NAV'))return['human-nav'];if(t.startsWith('정규장 수익률'))return['human-dayr'];if(t.startsWith('누적수익률'))return['human-ret'];
 if(t.startsWith('현재 Drawdown')||t.startsWith('최대 MDD'))return['disable','HISTORY_REQUIRED'];if(t.startsWith('보유종목 상승 기여')||t.startsWith('보유종목 하락 기여'))return['contrib'];if(/^Human\s/.test(t)&&/%/.test(t))return['human-ret'];
 if(t.startsWith('AI Bot')||(/^Return\s/.test(t)&&panel.includes('ai')))return['ai-ret'];if(t.startsWith('AI α'))return['disable','BENCHMARK_REQUIRED'];if(t.startsWith('AI NAV')||(/^NAV\s/.test(t)&&panel.includes('ai')))return['ai-nav'];if(t.startsWith('AI MDD')||(/^MDD\s/.test(t)&&panel.includes('ai')))return['disable','HISTORY_REQUIRED'];if(t.startsWith('AI 체결'))return['ai-trades'];
 return['disable','NO_DETAIL'];
}
function disableMetric(el,why){
 delete el.dataset.autoDrill;el.dataset.noAutoDrill='1';delete el.dataset.metricDrillV11;delete el.dataset.metricKindV11;delete el.dataset.metricAccountV11;delete el.dataset.metricLabelV11;el.dataset.metricDisabledV11=why||'NO_DETAIL';el.style.cursor='default';el.removeAttribute('role');el.removeAttribute('tabindex');
}
function patchMetricRuntime(){
 if(!window.__JJOONI_METRIC_DRILL_V12)return {account:0,main:0,disabled:0,corrected:0,remaining:qa('[data-auto-drill]').length};
 let account=0,main=0,disabled=0,corrected=0;
 const m=q('#accountDrillModal'),id=modalAccountId();
 if(m&&id){
   qa('.v2Kpi',m).forEach(el=>{
     if(el.dataset.tradeMetricDetail)return;
     const label=norm(q('.label',el)?.textContent);if(!label)return;
     if(label==='주식 평가액'){
       const s=stockValue(id),v=valueNode(el);if(s!=null&&v&&norm(v.textContent)!==won(s)){v.textContent=won(s);corrected++}
     }
     if(ACCOUNT_METRICS.has(label)){
       delete el.dataset.autoDrill;delete el.dataset.metricDisabledV11;el.dataset.noAutoDrill='1';el.dataset.metricDrillV11='account';el.dataset.metricAccountV11=id;el.dataset.metricLabelV11=label;el.style.cursor='pointer';el.setAttribute('role','button');account++;
     }else if(el.dataset.autoDrill){disableMetric(el,'UNSUPPORTED_DYNAMIC_ACCOUNT');disabled++}
   });
 }
 qa('[data-auto-drill]').forEach(el=>{
   if(m&&m.contains(el))return;
   const panel=el.closest('[id^="panel-"]')?.id||'',r=routeMain(el.textContent,panel);
   delete el.dataset.autoDrill;el.dataset.noAutoDrill='1';
   if(r[0]==='disable'){disableMetric(el,r[1]);disabled++;return}
   delete el.dataset.metricDisabledV11;el.dataset.metricDrillV11='main';el.dataset.metricKindV11=r[0];el.style.cursor='pointer';el.setAttribute('role','button');main++;
 });
 return {account,main,disabled,corrected,remaining:qa('[data-auto-drill]').length};
}

function apply(){
 const direct=patchCanonical();
 patchUi(direct);
 const metric=patchMetricRuntime();
 const C=window.__JJOONI_CANONICAL_SSOT||{},ai=(C.accounts||{}).AI||{},toss=(C.accounts||{}).TOSS||{};
 window.__JJOONI_ACCOUNT_SOURCE_V22={
   state:direct?'ACTIVE':'WAITING',version:'22.1',
   ai_account_source:ai.source||null,ai_account_quality:ai.account_quality||null,
   ai_cash_krw_present:n(ai.cash_krw)!=null,ai_cash_usd_present:n(ai.cash_usd)!=null,
   ai_position_count:Array.isArray(ai.positions)?ai.positions.length:0,
   ai_today_pnl_quality:ai.today_pnl_quality||null,
   toss_account_quality:toss.account_quality||toss.quality||null,
   dynamic_metric_rebind:metric,
   contract:'TOSS and AI account holdings/cash/NAV are broker-API truth. Derived daily-PnL quality is separate and must never downgrade the account source to modeled.'
 };
}

let queued=false;function schedule(){if(queued)return;queued=true;setTimeout(()=>{queued=false;apply()},80)}
document.addEventListener('jjooni:live-applied',schedule);
document.addEventListener('jjooni:source-truth-applied',schedule);
try{new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true,characterData:true});}catch(_){}
setTimeout(apply,0);setTimeout(apply,500);setTimeout(apply,1500);setTimeout(apply,2600);
})();