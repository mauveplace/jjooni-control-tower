(function(){
'use strict';

const SHEET_ID='1t8TNfIHxSIc_uoSxAgmSbkqCz00923nF1u-b6jlCgYE';
const TAB='GITHUB_CT_LIVE';
const COOLDOWN_MS=45000;
const REQUEST_TIMEOUT_MS=12000;
let lastKick=0,busy=false,fastUrl='';

function badge(text,state,title){
 const e=document.getElementById('ctEncryptedLiveBadge');if(!e)return;
 e.textContent=text;if(title)e.title=title;
 if(state==='good'){e.style.background='#ecfdf3';e.style.borderColor='#abefc6';e.style.color='#087443'}
 else if(state==='warn'){e.style.background='#fff7ed';e.style.borderColor='#fed7aa';e.style.color='#b45309'}
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
 const kv=await loadGviz();
 fastUrl=String(kv.FAST_REFRESH_URL||'').replace(/\/$/,'');
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
  try{r=await fetch(url+'/refresh',{method:'POST',mode:'cors',cache:'no-store',signal:ctrl.signal,headers:{'X-CT-Epoch':String(bucket),'X-CT-Proof':sig,'X-CT-Requester':'browser'}})}finally{clearTimeout(timer)}
  if(!r.ok)throw new Error('FAST_HTTP_'+r.status);
  const receipt=await r.json().catch(()=>({}));
  window.__JJOONI_CT_FAST_RECEIPT=receipt;
  if(receipt&&receipt.duration_ms!=null)badge('FAST '+(Number(receipt.duration_ms)/1000).toFixed(1)+'초','good','핵심 계좌/시세 FAST 갱신 완료. PB/DEEP 참고자료는 별도 주기로 갱신됩니다.');
  // live-bridge already owns decryption/rendering.  Ask its existing visibility
  // listener to re-read the newly published encrypted display envelope now.
  setTimeout(()=>document.dispatchEvent(new Event('visibilitychange')),180);
 }catch(e){
  console.warn('CT FAST refresh',e);
  badge('FAST 대기 · 기존값 표시','warn','FAST 갱신 실패 시 마지막 검증값을 유지합니다: '+String(e&&e.message||e).slice(0,100));
 }finally{busy=false}
}

window.__JJOONI_CT_FAST={version:'1.0',kick:()=>kick('manual'),mode:'DIRECT_HMAC_ON_DEMAND'};
document.addEventListener('jjooni:live-applied',()=>kick('live-applied'));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)kick('visible')});
setTimeout(()=>kick('startup'),1200);
})();
