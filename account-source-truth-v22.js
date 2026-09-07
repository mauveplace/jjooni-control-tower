(function(){
'use strict';
if(window.__JJOONI_ACCOUNT_SOURCE_V22)return;
window.__JJOONI_ACCOUNT_SOURCE_V22={state:'BOOTING',version:'22.0'};

const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null};
const q=(s,r=document)=>{try{return r.querySelector(s)}catch(_){return null}};
const qa=(s,r=document)=>{try{return Array.from(r.querySelectorAll(s))}catch(_){return []}};

function patchCanonical(){
 const L=window.__JJOONI_LIVE_PAYLOAD||{};
 const C=window.__JJOONI_CANONICAL_SSOT||{};
 if(!C.accounts)return false;
 const liveA=(L.accounts||{}).AI||{};
 const ai=C.accounts.AI||{};
 const aiMode=String(liveA.mode||ai.source||'').toUpperCase();
 const aiStatus=String(liveA.status||ai.account_quality||'').toUpperCase();
 const kisDirect=aiMode.includes('BROKER_DIRECT_KIS')||aiMode.includes('KIS_DIRECT')||aiStatus==='LIVE';
 if(kisDirect){
   ai.source='BROKER_DIRECT_KIS_KR+OVERSEAS';
   ai.quality='BROKER_DIRECT_KIS_API';
   ai.account_quality='BROKER_DIRECT_KIS_API';
   ai.holdings_quality='BROKER_DIRECT_KIS_API';
   ai.cash_quality='BROKER_DIRECT_KIS_API';
   ai.broker='한국투자증권';
   ai.broker_api='KIS Open API';
   ai.today_pnl_quality=String(liveA.today_pnl_quality||ai.today_pnl_quality||'UNSPECIFIED');
 }
 const liveT=(L.accounts||{}).TOSS||{};
 const toss=C.accounts.TOSS||{};
 if(String(liveT.status||toss.quality||'').toUpperCase()==='BROKER_LIVE_FULL'){
   toss.quality='BROKER_DIRECT_TOSS_API';
   toss.account_quality='BROKER_DIRECT_TOSS_API';
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

function patchUi(){
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
   if(name==='AI BOT')src.textContent='한국투자증권 API';
   else if(name==='Toss')src.textContent='Toss API';
 });
 const aiLine=q('#ctHumanAIV6');
 if(aiLine){
   aiLine.innerHTML=aiLine.innerHTML.replace(/<span class="measured">증권사 확인<\/span>/,'<span class="measured">한국투자증권 API</span>');
   const pq=String(ai.today_pnl_quality||'').toUpperCase();
   if((pq.includes('MODEL')||pq.includes('MTM')||pq.includes('PARTIAL'))&&!aiLine.textContent.includes('오늘손익 시세산출'))aiLine.insertAdjacentText('beforeend',' · 오늘손익 시세산출');
 }
}

function apply(){
 const direct=patchCanonical();
 patchUi();
 const C=window.__JJOONI_CANONICAL_SSOT||{},ai=(C.accounts||{}).AI||{},toss=(C.accounts||{}).TOSS||{};
 window.__JJOONI_ACCOUNT_SOURCE_V22={
   state:direct?'ACTIVE':'WAITING',version:'22.0',
   ai_account_source:ai.source||null,ai_account_quality:ai.account_quality||null,
   ai_cash_krw_present:n(ai.cash_krw)!=null,ai_cash_usd_present:n(ai.cash_usd)!=null,
   ai_position_count:Array.isArray(ai.positions)?ai.positions.length:0,
   ai_today_pnl_quality:ai.today_pnl_quality||null,
   toss_account_quality:toss.account_quality||toss.quality||null,
   contract:'TOSS and AI account holdings/cash/NAV are broker-API truth. Derived daily-PnL quality is separate and must never downgrade the account source to modeled.'
 };
}

let queued=false;function schedule(){if(queued)return;queued=true;setTimeout(()=>{queued=false;apply()},80)}
document.addEventListener('jjooni:live-applied',schedule);
document.addEventListener('jjooni:source-truth-applied',schedule);
try{new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true,characterData:true});}catch(_){}
setTimeout(apply,0);setTimeout(apply,500);setTimeout(apply,1500);
})();