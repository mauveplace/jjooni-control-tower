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
 const L=window.__JJOONI_LIVE_PAYLOAD||{},C=window.__JJOONI_CANONICAL_SSOT||{};
 if(!C.accounts)return false;
 const liveT=(L.accounts||{}).TOSS||{},toss=C.accounts.TOSS||{};
 const state=String(liveT.status||toss.quality||'').toUpperCase();
 const mode=String(liveT.mode||liveT.source||toss.source||'').toUpperCase();
 const direct=state==='BROKER_LIVE_FULL'||mode.includes('TOSS');
 if(direct){toss.quality=String(liveT.status||toss.quality||'UNKNOWN');toss.account_quality=toss.quality;toss.holdings_quality='BROKER_DIRECT_TOSS_API';toss.cash_quality='BROKER_DIRECT_TOSS_API';toss.broker='Toss증권';}
 (C.registry||[]).forEach(r=>{if(String(r.id||'').toUpperCase()==='TOSS')r.broker='Toss증권'});
 C.accounts.TOSS=toss;return direct;
}
function patchUi(){
 const sub=q('.ctTrustDetailSubV6');if(sub)sub.textContent='계좌별 보유자산·예수금·NAV는 각 계좌의 확인된 원천을 사용합니다. 오늘손익 산출 품질은 별도로 구분합니다.';
 qa('.ctTrustRowV6').forEach(row=>{const name=String(q('b',row)?.textContent||'').trim(),src=q('.ctTrustSourceV6',row);if(src&&name==='Toss')src.textContent='Toss API'});
 qa('#ctDesktopAccountsV8 .ctA8Card').forEach(card=>{const name=norm(q('.ctA8Name',card)?.textContent),src=q('.ctA8Source',card);if(!src||name!=='Toss')return;const basis=(src.textContent||'').split('· 기준').slice(1).join('· 기준').trim();src.textContent='Toss API'+(basis?' · 기준 '+basis:'')});
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
 if(t.includes('TRI-POD')||t.includes('TRIPOD'))return'TRIPOD';if(t.includes('연금'))return'PENSION';if(/\bISA\b/.test(t))return'ISA';if(/\bIRP\b/.test(t))return'IRP';if(t.includes('TOSS'))return'TOSS';
 const C=window.__JJOONI_CANONICAL_SSOT||{},txt=norm(m.textContent);
 for(const id of ['TOSS','ISA','PENSION','IRP','TRIPOD']){const v=n((C.accounts||{})[id]?.nav);if(v!=null&&txt.includes(won(v)))return id}
 return null;
}
function valueNode(el){return q('.value,.v2Value,[class*="Value"],[class*="value"]',el)}
function routeMain(raw,panel){
 const t=norm(raw);
 if(panel.includes('quality')||/Source|Observed/i.test(t))return['disable','TECH_METADATA'];
 if(t.startsWith('전체 5계좌 NAV'))return['total-nav'];if(t.startsWith('총 누적손익'))return['total-pnl'];if(t.startsWith('총 수익률'))return['total-return'];
 if(t.startsWith('Human MDD'))return['disable','HISTORY_REQUIRED'];if(t.startsWith('현재 보유 TQQQ')||t.startsWith('평균단가')||t.startsWith('현재가')||t.startsWith('평가손익')||t.startsWith('수익률'))return['tp'];
 if(t.startsWith('송팀장 목표'))return['disable','STRATEGY_REFERENCE'];if(t.startsWith('Human 정규장 P&L'))return['human-day'];if(t.startsWith('장외변동'))return['disable','NO_COMPONENT'];if(t.startsWith('현재 Human NAV'))return['human-nav'];if(t.startsWith('정규장 수익률'))return['human-dayr'];if(t.startsWith('누적수익률'))return['human-ret'];
 if(t.startsWith('현재 Drawdown')||t.startsWith('최대 MDD'))return['disable','HISTORY_REQUIRED'];if(t.startsWith('보유종목 상승 기여')||t.startsWith('보유종목 하락 기여'))return['contrib'];if(/^Human\s/.test(t)&&/%/.test(t))return['human-ret'];

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
 const direct=patchCanonical();patchUi();const metric=patchMetricRuntime();
 const C=window.__JJOONI_CANONICAL_SSOT||{},toss=(C.accounts||{}).TOSS||{};
 window.__JJOONI_ACCOUNT_SOURCE_V22={state:'ACTIVE',version:'22.2',toss_account_quality:toss.account_quality||toss.quality||null,dynamic_metric_rebind:metric,contract:'Active Control Tower account source truth; Toss broker facts come from Toss API when available.'};
 try{document.dispatchEvent(new CustomEvent('jjooni:source-truth-applied',{detail:{toss_direct:direct}}))}catch(_){}
}

let queued=false;function schedule(){if(queued)return;queued=true;setTimeout(()=>{queued=false;apply()},80)}
document.addEventListener('jjooni:live-applied',schedule);
document.addEventListener('jjooni:source-truth-applied',schedule);
try{new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true,characterData:true});}catch(_){}
setTimeout(apply,0);setTimeout(apply,500);setTimeout(apply,1500);setTimeout(apply,2600);
})();