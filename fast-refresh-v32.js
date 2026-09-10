(function(){
'use strict';

const SHEET_ID='1t8TNfIHxSIc_uoSxAgmSbkqCz00923nF1u-b6jlCgYE';
const TAB='GITHUB_CT_LIVE';
const DEFAULT_FAST_URL='https://jjooni-ct-fast-apgynr7pea-du.a.run.app';
const COOLDOWN_MS=45000;
const REQUEST_TIMEOUT_MS=12000;
const BRIDGE_RECOVERY_WINDOW_MS=28000;
const BRIDGE_RECOVERY_PULSE_MS=900;
let lastKick=0,busy=false,fastUrl='';
let recoveryTimer=null,recoveryStarted=0,recoveryPulses=0;

function badge(text,state,title){
 const e=document.getElementById('ctEncryptedLiveBadge');if(!e)return;
 e.textContent=text;if(title)e.title=title;
 if(state==='good'){e.style.background='#ecfdf3';e.style.borderColor='#abefc6';e.style.color='#087443'}
 else if(state==='warn'){e.style.background='#fff7ed';e.style.borderColor='#fed7aa';e.style.color='#b45309'}
}

function liveReadyFacts(){
 return !!(window.__JJOONI_CANONICAL_SSOT&&window.__JJOONI_LIVE_PAYLOAD);
}

function releaseLateReady(){
 if(!liveReadyFacts()||window.__LINEAGE_GUARD_ACTIVE!==true)return false;
 // lineage-guard uses this exact canonical+live predicate. If its 25s timer
 // already displayed the fail-closed shield, allow a late successful read to
 // recover without forcing the user into a reload loop.
 window.__JJOONI_LIVE_READY=true;
 const shield=document.getElementById('ctSsotSafetyShield');if(shield)shield.remove();
 return true;
}

function nudgeBridge(reason){
 if(document.hidden||liveReadyFacts())return;
 recoveryPulses++;
 window.__JJOONI_CT_FAST_BRIDGE_RECOVERY={
  state:'NUDGE',reason:String(reason||''),pulses:recoveryPulses,at:new Date().toISOString()
 };
 // live-bridge owns decryption and canonicalization. Its refresh function is
 // intentionally private; visibilitychange is its public re-read hook. Multiple
 // pulses are safe because live-bridge itself has refreshBusy single-flight.
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
  badge('FAST 최신화 중…','warn','Control Tower 핵심 숫자만 저지연으로 갱신 중입니다. PB/DEEP 분석은 별도입니다.');
  let r;
  try{r=await fetch(url+'/refresh',{method:'POST',mode:'cors',cache:'no-store',signal:ctrl.signal,headers:{'X-CT-Epoch':String(bucket),'X-CT-Proof':sig}})}finally{clearTimeout(timer)}
  if(!r.ok)throw new Error('FAST_HTTP_'+r.status);
  const receipt=await r.json().catch(()=>({}));
  window.__JJOONI_CT_FAST_RECEIPT=receipt;
  if(receipt&&receipt.duration_ms!=null)badge('FAST '+(Number(receipt.duration_ms)/1000).toFixed(1)+'초','good','핵심 계좌/시세 FAST 갱신 완료. PB/DEEP 참고자료는 별도 주기로 갱신됩니다.');
  // FAST publishes the encrypted sheet while live-bridge may already be in its
  // initial GViz read. One visibility event can be lost while refreshBusy=true,
  // which caused VERIFIED BOOT to time out even though the new snapshot existed.
  // Keep nudging only the read side for a bounded 28s window; FAST itself remains
  // protected by the 45s cooldown, so this does not create extra Cloud Run work.
  setTimeout(()=>startBridgeRecovery('fast-published'),180);
 }catch(e){
  console.warn('CT FAST refresh',e);
  badge('FAST 대기 · 기존값 표시','warn','FAST 갱신 실패 시 마지막 검증값을 유지합니다: '+String(e&&e.message||e).slice(0,100));
  startBridgeRecovery('fast-failed-use-last-verified');
 }finally{busy=false}
}

window.__JJOONI_CT_FAST={version:'1.2',kick:()=>kick('manual'),mode:'DIRECT_HMAC_ON_DEMAND',bridge_recovery:'BOUNDED_28S_READ_ONLY'};
document.addEventListener('jjooni:live-applied',()=>{releaseLateReady();kick('live-applied')});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)kick('visible')});
// Start read-side recovery before/alongside the first FAST call. This closes the
// startup race without re-enabling any Control Tower scheduler.
setTimeout(()=>startBridgeRecovery('startup'),350);
setTimeout(()=>kick('startup'),1200);
})();