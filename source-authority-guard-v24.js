(function(){
'use strict';
if(window.__JJOONI_SOURCE_AUTHORITY_V24?.booted)return;

const S={booted:true,state:'BOOTING',version:'24.2',kis_verified:false,kis_reason:'UNVERIFIED',unsafe_valuations_removed:0,valuations_repaired:0,fx_missing_accounts:[],updated_at:null};
window.__JJOONI_SOURCE_AUTHORITY_V24=S;
const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null};
const z=v=>n(v)==null?0:n(v);
const C=()=>window.__JJOONI_CANONICAL_SSOT||{};
const L=()=>window.__JJOONI_LIVE_PAYLOAD||{};
const isUsd=p=>String(p?.currency||'').toUpperCase()==='USD'||String(p?.market||'').toUpperCase()==='US';
const qty=p=>Math.abs(z(p?.qty??p?.quantity??p?.held_qty??p?.balance_qty));
const px=p=>n(p?.current_price??p?.price??p?.last_price);
const explicitKrwKeys=['market_value_krw','evaluation_amount_krw','eval_amount_krw','valuation_krw','evlu_amt_krw'];

function firstNumber(o,keys){for(const k of keys){const x=n(o?.[k]);if(x!=null)return{key:k,value:x}}return null}
function validFx(v){const x=n(v);return x!=null&&x>500&&x<3000?x:null}
function fxFor(id,a,p){
 const live=(L().accounts||{})[id]||{};
 for(const v of [p?.fx_krw_per_usd,p?.fx,a?.fx_krw_per_usd,a?.fx,live?.fx_krw_per_usd,live?.fx]){const x=validFx(v);if(x)return{value:x,source:'ACCOUNT_SPECIFIC'}}
 const ref=L().fx_reference||{};
 const refFx=validFx(ref.krw_per_usd);
 if(refFx&&String(ref.source||'').toUpperCase()!=='FX_REFERENCE_MISSING')return{value:refFx,source:String(ref.source||'FX_REFERENCE')};
 return null;
}
function kisEvidence(){
 const live=(L().accounts||{}).AI||{};
 const canon=(C().accounts||{}).AI||{};
 const a=Object.keys(live).length?live:canon;
 const status=String(a.status||'').toUpperCase();
 const mode=String(a.mode||'').toUpperCase();
 const nav=n(a.nav);
 const balance=String(a.balance_authority||'').toUpperCase();
 const position=String(a.position_authority||'').toUpperCase();
 const provider=String(a.provider||'').toUpperCase();
 const strong=balance.includes('KIS_OPEN_API_BROKER_BALANCE')||position.includes('KIS_OPEN_API_BROKER_BALANCE')||a.broker_direct===true||provider.includes('KOREA INVESTMENT');
 const identity=mode.includes('KIS')||String(a.broker_code||'').toUpperCase()==='KIS'||String(a.source||'').toUpperCase().includes('KIS')||strong;
 const base=status==='LIVE'&&identity&&nav!=null&&nav>0;
 if(base)return{ok:true,reason:strong?'LIVE_KIS_BACKEND_AUTHORITY':'LIVE_KIS_IDENTITY_NAV'};
 return{ok:false,reason:`status=${status||'MISSING'} mode=${mode||'MISSING'} nav=${nav==null?'MISSING':nav}`};
}
function enforceKis(){
 const ev=kisEvidence();S.kis_verified=ev.ok;S.kis_reason=ev.reason;
 const label=ev.ok?'한국투자증권':'한국투자증권 · API 원천 미확인';
 for(const root of [L(),C()]){
  const a=root?.accounts?.AI;if(!a)continue;
  a.broker='한국투자증권';a.broker_name='한국투자증권';a.broker_code='KIS';
  a.source_verified=!!ev.ok;
  if(ev.ok){
   a.holdings_quality='BROKER_DIRECT_KIS_API';a.cash_quality='BROKER_DIRECT_KIS_API';
   if(String(a.quality||'').toUpperCase()==='SOURCE_UNVERIFIED'&&String(a.status||'').toUpperCase()==='LIVE')a.quality='LIVE';
   if(String(a.account_quality||'').toUpperCase()==='SOURCE_UNVERIFIED'&&String(a.status||'').toUpperCase()==='LIVE')a.account_quality='LIVE';
   if(!String(a.source||'').toUpperCase().includes('KIS'))a.source='BROKER_DIRECT_KIS_KR+OVERSEAS';
  }else{
   a.quality='SOURCE_UNVERIFIED';a.account_quality='SOURCE_UNVERIFIED';a.holdings_quality='SOURCE_UNVERIFIED';a.cash_quality='SOURCE_UNVERIFIED';
   if(/KIS|BROKER_DIRECT_KIS/.test(String(a.source||'').toUpperCase()))a.source='KIS_SOURCE_UNVERIFIED';
  }
 }
 window.__JJOONI_BROKER_OVERRIDE={...(window.__JJOONI_BROKER_OVERRIDE||{}),AI:label};
 const nodes=[...document.querySelectorAll('.ctP8Card,.ctA8Card,.accountCard,.card,[data-account-drill],#accountDrillModal')];
 const trustRows=[...document.querySelectorAll('.ctTrustRowV6')];for(const row of trustRows){if(String(row.querySelector('b')?.textContent||'').trim()==='AI BOT'){const x=row.querySelector('.ctTrustSourceV6');if(x)x.textContent=ev.ok?'한국투자증권 API':label}}
 for(const card of document.querySelectorAll('#ctDesktopAccountsV8 .ctA8Card')){if(String(card.querySelector('.ctA8Name')?.textContent||'').trim()==='AI BOT'){const x=card.querySelector('.ctA8Source');if(x){const basis=String(x.textContent||'').split('· 기준').slice(1).join('· 기준').trim();x.textContent=(ev.ok?'한국투자증권 API':label)+(basis?' · 기준 '+basis:'')}}}
 for(const root of nodes){const text=String(root.innerText||root.textContent||'');if(!/AI\s*BOT|\bAI\b/i.test(text))continue;root.querySelectorAll('.ctAcctSource,.ctTrustDetailSubV6,.ctTrustFootV6,[data-source-label]').forEach(e=>{e.textContent=ev.ok?'한국투자증권 API':label});}
}
function isUnsafeDerivedKrw(p){
 const contract=String(p?.market_value_contract||'');
 const mode=String(p?.market_value_reconcile_mode||'').toUpperCase();
 const source=String(p?.market_value_reconcile_source||'').toUpperCase();
 return /^CANONICAL_KRW_V13(?:$|_)/.test(contract)||(contract==='SOURCE_AUTHORITY_V24'&&(mode==='USD_NATIVE_TO_KRW'||source==='VERIFIED_FX'));
}
function safeValue(id,a,p){
 const usd=isUsd(p),derived=isUnsafeDerivedKrw(p),explicit=firstNumber(p,explicitKrwKeys);
 if(!usd){const value=window.JjooniMetrics.valueKrw(p,a);return value==null?null:{value,mode:'DECLARED_CURRENCY',source:'CANONICAL_CONTRACT'};}
 // A non-derived, explicitly KRW-denominated field is already a KRW source value.
 if(explicit&&!derived)return{value:explicit.value,mode:'EXPLICIT_KRW',source:explicit.key};
 // Any USD-native or previously derived KRW value needs a currently verified FX source.
 const f=fxFor(id,a,p);if(!f)return null;
 const native=firstNumber(p,['value']);
 const marketCurrency=String(p?.market_value_currency||'').toUpperCase();
 const marketNative=marketCurrency==='USD'?n(p?.market_value):null;
 const q=n(p?.qty??p?.quantity??p?.held_qty??p?.balance_qty),price=px(p);
 const nativeValue=native?.value??marketNative??(q!=null&&price!=null?q*price:null);
 if(nativeValue==null)return null;
 return{value:nativeValue*f.value,mode:'USD_NATIVE_TO_KRW',source:'VERIFIED_FX',fx:f.value,fx_source:f.source};
}
function clearDerivedKrw(p){for(const k of ['market_value_krw','market_value_currency','market_value_contract','market_value_reconcile_mode','market_value_reconcile_source','market_value_fx','market_value_fx_source'])delete p[k]}

function reconcileValuations(){
 const c=C();let removed=0,repaired=0;const missing=new Set();
 for(const [id,a] of Object.entries(c.accounts||{})){
  for(const p of a?.positions||[]){
   if(!['POSITION','FUND'].includes(String(p?.record_type||'POSITION').toUpperCase()))continue;
   const derived=isUnsafeDerivedKrw(p);
   const r=safeValue(id,a,p);
   if(!r){
    if(isUsd(p))missing.add(id);
    if(derived){clearDerivedKrw(p);removed++;}
    continue;
   }
   if(derived||n(p.market_value_krw)==null){
    p.market_value_krw=r.value;p.market_value_currency='KRW';p.market_value_contract='SOURCE_AUTHORITY_V24';p.market_value_reconcile_mode=r.mode;p.market_value_reconcile_source=r.source;
    if(r.fx!=null){p.market_value_fx=r.fx;p.market_value_fx_source=r.fx_source;}
    repaired++;
   }
  }
 }
 S.unsafe_valuations_removed=removed;S.valuations_repaired=repaired;S.fx_missing_accounts=[...missing];
}
function accountStockValue(id){const a=(C().accounts||{})[id]||{},ps=window.JjooniMetrics.positions(a),vals=ps.map(p=>safeValue(id,a,p)?.value??null);return ps.length?window.JjooniMetrics.sum(vals):0}

function patchOpenModal(){
 const m=document.getElementById('accountDrillModal');if(!m)return;
 const title=String(m.querySelector('h1,h2,h3,.modalTitle,.title')?.textContent||'').toUpperCase();let id=null;
 for(const x of ['TOSS','ISA','PENSION','IRP','AI','TRIPOD']){if(x==='AI'?/AI\s*BOT|\bAI\b/i.test(title):title.includes(x)){id=x;break}}
 if(!id)return;const v=accountStockValue(id);
 m.querySelectorAll('.v2Kpi').forEach(k=>{const lab=String(k.querySelector('.label')?.textContent||'').trim();if(lab!=='주식 평가액')return;const el=k.querySelector('.value');if(!el)return;el.textContent=v==null?'환율/평가 근거 미확인':'₩'+Math.round(v).toLocaleString('ko-KR');if(v==null)el.title='검증된 KRW 평가값 또는 환율 원천이 없어 숫자를 표시하지 않습니다.';});
}
function apply(){enforceKis();reconcileValuations();patchOpenModal();S.state='ACTIVE';S.updated_at=new Date().toISOString();document.dispatchEvent(new CustomEvent('jjooni:source-authority-v24-applied',{detail:{kis_verified:S.kis_verified,fx_missing_accounts:S.fx_missing_accounts}}));}
let queued=false;function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply()})}
function wrapModal(){const fn=window.openAccountDrilldown;if(typeof fn!=='function'||fn.__jjooniSourceAuthorityV24)return;const w=function(){const r=fn.apply(this,arguments);[0,80,220,500,1000].forEach(ms=>setTimeout(schedule,ms));return r};w.__jjooniSourceAuthorityV24=true;w.__jjooniSourceAuthorityOriginal=fn;window.openAccountDrilldown=w;}
apply();wrapModal();[100,400,1200,3000].forEach(ms=>setTimeout(()=>{wrapModal();schedule()},ms));document.addEventListener('jjooni:live-applied',schedule);document.addEventListener('jjooni:source-truth-applied',schedule);document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});window.addEventListener('resize',schedule,{passive:true});setInterval(()=>{if(!document.hidden)schedule()},1000);
})();
