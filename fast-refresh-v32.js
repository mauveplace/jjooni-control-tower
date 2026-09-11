(function(){
'use strict';
if(window.__JJOONI_CT_FAST_V32_2_LOADED)return;
window.__JJOONI_CT_FAST_V32_2_LOADED=true;

const SHEET_ID='1t8TNfIHxSIc_uoSxAgmSbkqCz00923nF1u-b6jlCgYE';
const TAB='GITHUB_CT_LIVE';
const DEFAULT_FAST_URL='https://jjooni-ct-fast-apgynr7pea-du.a.run.app';
const COOLDOWN_MS=45000;
const REQUEST_TIMEOUT_MS=12000;
const BRIDGE_RECOVERY_WINDOW_MS=28000;
const BRIDGE_RECOVERY_PULSE_MS=900;
let lastKick=0,busy=false,fastUrl='';
let recoveryTimer=null,recoveryStarted=0,recoveryPulses=0;
let verifiedBootRecoveryInFlight=false;

function badge(text,state,title){
 const e=document.getElementById('ctEncryptedLiveBadge');if(!e)return;
 e.textContent=text;if(title)e.title=title;
 if(state==='good'){e.style.background='#ecfdf3';e.style.borderColor='#abefc6';e.style.color='#087443'}
 else if(state==='warn'){e.style.background='#fff7ed';e.style.borderColor='#fed7aa';e.style.color='#b45309'}
}

function liveReadyFacts(){
 return !!(window.__JJOONI_CANONICAL_SSOT&&window.__JJOONI_LIVE_PAYLOAD);
}
function lineageReady(){
 const g=window.__JJOONI_LINEAGE_GUARD;
 return !!(g&&String(g.version||'').length);
}

function tradeDate(row){
 const raw=String(row?.trade_date||row?.filled_at_kst||row?.filled_at||row?.date||'').trim();
 const m=raw.match(/^(\d{4})[-/.]?(\d{2})[-/.]?(\d{2})/);
 return m?`${m[1]}-${m[2]}-${m[3]}`:raw.slice(0,10);
}
function tradeAccount(row){
 const raw=String(row?.account||row?.account_type||'').trim().toUpperCase().replace(/[^A-Z0-9가-힣]/g,'');
 if(['연금','연금저축','PENSION'].includes(raw))return 'PENSION';
 if(['TRIPOD','TRIPODACCOUNT'].includes(raw))return 'TRIPOD';
 if(['토스','TOSS'].includes(raw))return 'TOSS';
 return raw;
}
function tradeSide(row){
 const raw=String(row?.side||'').trim().toUpperCase();
 if(raw.includes('SELL')||raw.includes('매도'))return 'SELL';
 if(raw.includes('BUY')||raw.includes('매수'))return 'BUY';
 return raw;
}
function tradeTicker(row){return String(row?.ticker||row?.symbol||'').trim().toUpperCase().replace(/\.(KS|KQ)$/,'')}
function tradeNum(v){const n=Number(String(v??'').replace(/,/g,''));return Number.isFinite(n)?n:0}
function tradeKey(row){return [tradeAccount(row),tradeDate(row),tradeSide(row),tradeTicker(row),tradeNum(row?.qty??row?.quantity??row?.filled_qty),tradeNum(row?.price??row?.filled_price??row?.avg_price)].join('|')}
function runtimeData(){
 try{if(window.D&&typeof window.D==='object')return window.D}catch(_){}
 try{if(typeof D!=='undefined'&&D&&typeof D==='object')return D}catch(_){}
 return null;
}
function receiptTradeRows(receipt){
 const overlay=receipt?.master_overlay?.trade_overlay;
 if(!overlay||overlay.schema!=='JJOONI_CT_MASTER_TRADE_OVERLAY_V1'||!Array.isArray(overlay.rows))return [];
 return overlay.rows.filter(r=>r&&['BUY','SELL'].includes(tradeSide(r))&&tradeTicker(r)&&tradeNum(r?.qty??r?.quantity)>0&&tradeNum(r?.price??r?.filled_price)>0);
}
function applyMasterTrades(receipt,reason){
 const rows=receiptTradeRows(receipt);
 if(!rows.length)return false;
 window.__JJOONI_CT_MASTER_TRADE_ROWS=rows.map(r=>({...r}));
 const d=runtimeData();
 if(!d)return false;
 d.human=d.human||{};
 const current=Array.isArray(d.human.trades)?d.human.trades:[];
 const authoritativeDates=new Set(rows.map(tradeDate).filter(Boolean));
 const merged=current.filter(r=>!(String(r?.source||'').toUpperCase()==='MASTER_TRADE_LEDGER'&&authoritativeDates.has(tradeDate(r))));
 const seen=new Set(merged.map(tradeKey));
 let added=0;
 for(const row of rows){
  const k=tradeKey(row);if(seen.has(k))continue;
  merged.push({...row,source:'MASTER_TRADE_LEDGER'});seen.add(k);added++;
 }
 merged.sort((a,b)=>String(a?.filled_at_kst||a?.trade_date||a?.date||'').localeCompare(String(b?.filled_at_kst||b?.trade_date||b?.date||'')));
 d.human.trades=merged;
 const sells=rows.filter(r=>tradeSide(r)==='SELL').length;
 window.__JJOONI_CT_MASTER_TRADE_BRIDGE={state:'APPLIED',version:'1.0',reason:String(reason||''),latest_trade_date:tradeDate(rows[0]),receipt_rows:rows.length,receipt_sells:sells,added,at:new Date().toISOString()};
 return true;
}
function reapplyStoredMasterTrades(reason){
 const receipt=window.__JJOONI_CT_MASTER_RECEIPT;
 if(receipt&&applyMasterTrades(receipt,reason))return true;
 const rows=window.__JJOONI_CT_MASTER_TRADE_ROWS;
 if(!Array.isArray(rows)||!rows.length)return false;
 return applyMasterTrades({master_overlay:{trade_overlay:{schema:'JJOONI_CT_MASTER_TRADE_OVERLAY_V1',rows}}},reason);
}

function recoverVerifiedBoot(){
 const boot=window.__JJOONI_UI_BOOT_V14;
 if(!boot||boot.state!=='BLOCKED'||String(boot.failed||'')!=='SSOT_READY_TIMEOUT')return false;
 if(verifiedBootRecoveryInFlight)return true;
 verifiedBootRecoveryInFlight=true;
 window.__JJOONI_CT_FAST_BOOT_RECOVERY={state:'RELOADING_VERIFIED_BOOT',reason:'SSOT_READY_TIMEOUT',at:new Date().toISOString()};
 const shield=document.getElementById('ctUiBootShieldV14');
 if(shield){
  const title=shield.querySelector('#ctUiBootTitleV14'),text=shield.querySelector('#ctUiBootTextV14'),btn=shield.querySelector('#ctUiBootReloadV14');
  if(title)title.textContent='검증된 화면 재구성 중';
  if(text)text.textContent='SSOT 연결이 복구되어 필수 UI 모듈을 다시 검증합니다.';
  if(btn)btn.style.display='none';
 }
 try{
  window.__JJOONI_UI_BOOT_V14=null;
  const s=document.createElement('script');
  s.dataset.ctVerifiedBootRecovery='1';
  s.src='trade-review-loader.js?v=14.20-recovery&_='+Date.now();
  s.async=false;
  s.onload=()=>{
   verifiedBootRecoveryInFlight=false;
   window.__JJOONI_CT_FAST_BOOT_RECOVERY={state:'VERIFIED_BOOT_RELOADED',at:new Date().toISOString()};
  };
  s.onerror=()=>{
   verifiedBootRecoveryInFlight=false;
   window.__JJOONI_CT_FAST_BOOT_RECOVERY={state:'VERIFIED_BOOT_RELOAD_FAILED',at:new Date().toISOString()};
   badge('UI BOOT 재시도 실패','warn','trade-review-loader.js 재로딩 실패');
  };
  (document.head||document.documentElement).appendChild(s);
  return true;
 }catch(e){
  verifiedBootRecoveryInFlight=false;
  window.__JJOONI_CT_FAST_BOOT_RECOVERY={state:'VERIFIED_BOOT_RECOVERY_ERROR',error:String(e&&e.message||e),at:new Date().toISOString()};
  return false;
 }
}

function releaseLateReady(){
 if(!liveReadyFacts()||!lineageReady())return false;
 window.__JJOONI_LIVE_READY=true;
 const shield=document.getElementById('ctSsotSafetyShield');if(shield)shield.remove();
 recoverVerifiedBoot();
 return true;
}

function nudgeBridge(reason){
 if(document.hidden||liveReadyFacts())return;
 recoveryPulses++;
 window.__JJOONI_CT_FAST_BRIDGE_RECOVERY={state:'NUDGE',reason:String(reason||''),pulses:recoveryPulses,at:new Date().toISOString()};
 document.dispatchEvent(new Event('visibilitychange'));
}

function startBridgeRecovery(reason){
 if(liveReadyFacts()){releaseLateReady();return;}
 if(!recoveryStarted)recoveryStarted=Date.now();
 if(recoveryTimer)return;
 nudgeBridge(reason||'start');
 recoveryTimer=setInterval(()=>{
  if(liveReadyFacts()){
   releaseLateReady();
   clearInterval(recoveryTimer);recoveryTimer=null;
   window.__JJOONI_CT_FAST_BRIDGE_RECOVERY={state:'READY',pulses:recoveryPulses,at:new Date().toISOString()};
   return;
  }
  if(Date.now()-recoveryStarted>=BRIDGE_RECOVERY_WINDOW_MS){
   clearInterval(recoveryTimer);recoveryTimer=null;
   window.__JJOONI_CT_FAST_BRIDGE_RECOVERY={state:'TIMEOUT',pulses:recoveryPulses,at:new Date().toISOString()};
   return;
  }
  nudgeBridge('pulse');
 },BRIDGE_RECOVERY_PULSE_MS);
}

function loadGviz(){return new Promise((resolve,reject)=>{
 const cb='__ctfast_'+Date.now()+'_'+Math.random().toString(36).slice(2),s=document.createElement('script');let done=false;
 const finish=(err,val)=>{if(done)return;done=true;try{delete window[cb]}catch(_){};try{s.remove()}catch(_){};clearTimeout(timer);err?reject(err):resolve(val)};
 window[cb]=resp=>{try{const out={};((((resp||{}).table||{}).rows)||[]).forEach(r=>{const c=r.c||[],k=c[0]&&c[0].v!=null?String(c[0].v):'',v=c[1]&&c[1].v!=null?String(c[1].v):'';if(k)out[k]=v});finish(null,out)}catch(e){finish(e)}};
 const timer=setTimeout(()=>finish(new Error('FAST_DISCOVERY_TIMEOUT')),5000);s.onerror=()=>finish(new Error('FAST_DISCOVERY_FAIL'));
 s.src='https://docs.google.com/spreadsheets/d/'+SHEET_ID+'/gviz/tq?sheet='+encodeURIComponent(TAB)+'&tqx='+encodeURIComponent('responseHandler:'+cb)+'&_='+Date.now();
 (document.head||document.documentElement).appendChild(s);
});}

async function proof(password,bucket){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sig=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('ct-fast:'+bucket)));
 return Array.from(sig,b=>b.toString(16).padStart(2,'0')).join('');
}

async function resolveUrl(){
 if(fastUrl)return fastUrl;
 try{
  const kv=await loadGviz();
  const discovered=String(kv.FAST_REFRESH_URL||'').replace(/\/$/,'');
  fastUrl=/^https:\/\//.test(discovered)?discovered:DEFAULT_FAST_URL;
 }catch(_){
  fastUrl=DEFAULT_FAST_URL;
 }
 return fastUrl;
}

async function kick(reason){
 if(document.hidden||busy)return;
 const now=Date.now();if(now-lastKick<COOLDOWN_MS)return;
 const pw=sessionStorage.getItem('jjooni_ct_session_pw');if(!pw)return;
 lastKick=now;busy=true;
 try{
  const url=await resolveUrl();if(!/^https:\/\//.test(url))return;
  const bucket=Math.floor(Date.now()/1000/30),sig=await proof(pw,bucket),ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),REQUEST_TIMEOUT_MS);
  badge('마스터 변경 확인 · 최신화 중…','warn','Master Sheet 변경 여부와 ISA·연금·IRP 구조 및 최신 거래를 우선 확인합니다. PB/DEEP·전체 시장 갱신은 이 조회의 선행조건이 아닙니다.');
  let r;
  try{r=await fetch(url+'/master-sync',{method:'POST',mode:'cors',cache:'no-store',signal:ctrl.signal,headers:{'X-CT-Epoch':String(bucket),'X-CT-Proof':sig}})}finally{clearTimeout(timer)}
  if(!r.ok)throw new Error('MASTER_FAST_HTTP_'+r.status);
  const receipt=await r.json().catch(()=>({}));
  window.__JJOONI_CT_FAST_RECEIPT=receipt;
  window.__JJOONI_CT_MASTER_RECEIPT=receipt;
  const tradesApplied=applyMasterTrades(receipt,'master-sync');
  const master=(receipt&&receipt.master_refresh)||{};
  const ms=String(master.status||'');
  const elapsed=receipt&&receipt.duration_ms!=null?(Number(receipt.duration_ms)/1000).toFixed(1)+'초':'';
  const tradeMeta=receipt?.master_overlay?.trade_overlay||{};
  const tradeSuffix=Number(tradeMeta.row_count||0)>0?' · 거래 '+Number(tradeMeta.row_count||0)+'건':'';
  if(ms==='MASTER_AHEAD'){
   badge('MASTER 최신값 반영'+tradeSuffix+' · DEEP 후처리 중','good','Master Sheet 변경분을 화면에 먼저 반영했습니다. PB/SSOT/DEEP 정합성 반영은 별도 경로입니다. '+elapsed);
  }else if(ms==='BASELINE_DIRECT_READ'){
   badge('MASTER 직접조회 반영'+tradeSuffix+' · '+elapsed,'good','Master Sheet를 직접 읽어 최신 구조와 거래를 반영했습니다. PB/DEEP 완료를 기다리지 않습니다.');
  }else if(ms==='MATCH'){
   badge('MASTER 변경 없음'+tradeSuffix+' · '+elapsed,'good','Master Sheet가 직전 직접조회 기준과 일치합니다.');
  }else if(ms==='UNAVAILABLE'){
   badge('MASTER 확인 실패 · 기존 검증값','warn','Master 직접조회 실패로 마지막 검증값을 유지합니다. '+String(master.error||'').slice(0,100));
  }else if(receipt&&receipt.status==='SKIP_RECENT'){
   badge('MASTER 최근 확인값 사용'+tradeSuffix,'good','최근 Master 확인 결과를 재사용합니다.');
  }else if(receipt&&receipt.duration_ms!=null){
   badge('MASTER 확인 완료'+tradeSuffix+' · '+elapsed,'good','Master 직접조회 경로 완료.');
  }
  if(tradesApplied){
   document.dispatchEvent(new CustomEvent('jjooni:master-trades-applied',{detail:window.__JJOONI_CT_MASTER_TRADE_BRIDGE}));
   document.dispatchEvent(new Event('jjooni:live-applied'));
  }
  setTimeout(()=>startBridgeRecovery('master-published'),180);
 }catch(e){
  console.warn('CT MASTER sync',e);
  badge('MASTER 확인 대기 · 기존값 표시','warn','Master 직접조회 실패 시 마지막 검증값을 유지합니다: '+String(e&&e.message||e).slice(0,100));
  startBridgeRecovery('master-failed-use-last-verified');
 }finally{busy=false}
}

window.__JJOONI_CT_FAST={version:'1.7',kick:()=>kick('manual'),mode:'MASTER_SYNC_FIRST+MASTER_TRADE_OVERLAY',bridge_recovery:'BOUNDED_28S_READ_ONLY',verified_boot_recovery:'LINEAGE_OBJECT_CONTRACT'};
document.addEventListener('jjooni:live-applied',()=>{reapplyStoredMasterTrades('live-applied');releaseLateReady();kick('live-applied')});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){reapplyStoredMasterTrades('visible');kick('visible')}});
setTimeout(()=>startBridgeRecovery('startup'),350);
setTimeout(()=>kick('startup'),1200);
})();