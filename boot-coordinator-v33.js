(function(){
'use strict';
if(typeof window!=='object'||typeof document!=='object')return;
if(window.__JJOONI_BOOT_COORDINATOR_V33)return;

const S={version:'33.2',state:'WAITING_FOR_LIVE',started_at:new Date().toISOString(),pulses:0,last_diag:null};
window.__JJOONI_BOOT_COORDINATOR_V33=S;

function factsReady(){return !!(window.__JJOONI_CANONICAL_SSOT&&window.__JJOONI_LIVE_PAYLOAD)}
function lineageReady(){
 const g=window.__JJOONI_LINEAGE_GUARD;
 return !!(g&&String(g.version||'').length);
}
function verifiedReady(){return factsReady()&&lineageReady()}
function scriptLoaded(name){return [...document.scripts].some(s=>String(s.src||'').includes(name))}
function bridgeDiag(){
 const b=document.getElementById('ctEncryptedLiveBadge');
 const title=String((b&&b.title)||'').trim();
 const text=String((b&&b.textContent)||'').trim();
 if(title){S.last_diag=title;return title}
 if(text&&/WAIT|BLOCKED|실패|대기/i.test(text)){S.last_diag=text;return text}
 return S.last_diag;
}
function ensureShield(){
 let s=document.getElementById('ctUiBootShieldV14');
 if(!s){
  s=document.createElement('div');s.id='ctUiBootShieldV14';
  s.style.cssText='position:fixed;inset:0;z-index:100200;display:grid;place-items:center;padding:24px;background:rgba(244,247,251,.97);backdrop-filter:blur(4px);font-family:system-ui,-apple-system,sans-serif;color:#10233d;text-align:center';
  s.innerHTML='<div style="width:min(92vw,430px);padding:24px;border:1px solid #d7e1ec;border-radius:18px;background:#fff;box-shadow:0 18px 60px #10233d22"><div style="font-size:12px;font-weight:900;letter-spacing:.08em;color:#60758d">CONTROL TOWER · VERIFIED BOOT</div><div id="ctUiBootTitleV14" style="margin-top:8px;font-size:20px;font-weight:900">실시간 데이터 연결 중</div><div id="ctUiBootTextV14" style="margin-top:8px;font-size:13px;line-height:1.55;color:#66788b">검증된 SSOT가 준비되면 화면 모듈을 시작합니다.</div><button id="ctUiBootReloadV14" type="button" style="display:none;margin:16px auto 0;padding:10px 14px;border:0;border-radius:10px;background:#0b3b70;color:#fff;font-weight:850;cursor:pointer">새로고침</button></div>';
  document.body.appendChild(s);
 }
 return s;
}
function paint(text,failed){
 const s=ensureShield(),t=s.querySelector('#ctUiBootTitleV14'),x=s.querySelector('#ctUiBootTextV14'),b=s.querySelector('#ctUiBootReloadV14');
 if(t)t.textContent=failed?'SSOT 연결 진단':'실시간 데이터 연결 중';
 if(x)x.textContent=text;
 if(b){b.style.display=failed?'inline-block':'none';b.onclick=()=>location.reload()}
}
function nudge(){
 S.pulses++;
 try{document.dispatchEvent(new Event('visibilitychange'))}catch(_){}
 // Existing verified SSOT should open first. FAST refresh is a post-open freshness
 // improvement, not a prerequisite for rendering the dashboard.
 if(S.pulses>8){try{window.__JJOONI_CT_FAST?.kick?.()}catch(_){}}
}
function startVerifiedUi(){
 if(S.state==='UI_LOADING'||S.state==='ACTIVE'||S.state==='UI_LOADER_STARTED')return;
 S.state='UI_LOADING';S.live_ready_at=new Date().toISOString();
 window.__JJOONI_LIVE_READY=true;
 const ss=document.getElementById('ctSsotSafetyShield');if(ss)ss.remove();
 const old=document.getElementById('ctUiBootShieldV14');if(old)old.remove();
 window.__JJOONI_UI_BOOT_V14=null;
 const s=document.createElement('script');
 s.id='ctVerifiedUiLoaderV33';
 s.src='trade-review-loader.js?v=14.20-v33.2&_='+Date.now();
 s.async=false;
 s.onload=()=>{S.state='UI_LOADER_STARTED';S.ui_loader_at=new Date().toISOString()};
 s.onerror=()=>{S.state='UI_LOADER_LOAD_FAILED';S.failed_at=new Date().toISOString();paint('UI 로더 파일을 불러오지 못했습니다. 새로고침 없이 재시도합니다.',true);setTimeout(startVerifiedUi,1500)};
 (document.head||document.documentElement).appendChild(s);
}

// Hold the legacy eager loader. canonical-metrics runs before the legacy
// trade-review-loader tag, so the old loader sees ACTIVE and returns. We only
// clear this hold after verified live SSOT exists.
if(!window.__JJOONI_UI_BOOT_V14)window.__JJOONI_UI_BOOT_V14={state:'ACTIVE',version:'V33_DEFERRED_BOOT_HOLD'};
paint('저장된 검증 SSOT를 먼저 연결합니다. 최신 FAST 갱신은 화면 진입 후 이어집니다.',false);

let lastPaint=0;
const timer=setInterval(()=>{
 if(verifiedReady()){
  clearInterval(timer);startVerifiedUi();return;
 }
 const now=Date.now();
 if(now-lastPaint>2000){
  lastPaint=now;
  const sec=Math.max(0,Math.round((now-Date.parse(S.started_at))/1000));
  if(!factsReady()){
   const lg=scriptLoaded('lineage-guard.js'),lb=scriptLoaded('live-bridge.js'),diag=bridgeDiag();
   window.__JJOONI_BOOT_DIAG={sec,lineage_script:lg,live_bridge_script:lb,bridge_error:diag||null,at:new Date().toISOString()};
   if(diag){paint('SSOT 읽기/복호화 실패 · '+String(diag).slice(0,150),true)}
   else if(sec>=6&&!lg){paint('LINEAGE GUARD 스크립트가 시작되지 않았습니다. · '+sec+'초',true)}
   else if(sec>=8&&lg&&!lb){paint('LIVE BRIDGE 스크립트가 시작되지 않았습니다. · '+sec+'초',true)}
   else paint('SSOT 읽기/복호화 · '+sec+'초 · bridge='+(lb?'ON':'WAIT')+' · lineage='+(lg?'ON':'WAIT'),false);
  }else if(!lineageReady()){
   window.__JJOONI_BOOT_DIAG={sec,lineage_script:scriptLoaded('lineage-guard.js'),live_bridge_script:scriptLoaded('live-bridge.js'),bridge_error:bridgeDiag()||null,at:new Date().toISOString()};
   paint('SSOT는 도착했지만 LINEAGE GUARD 확인 대기 · '+sec+'초',sec>=8);
  }else paint('UI 준비 · '+sec+'초',false);
 }
 nudge();
},900);

document.addEventListener('jjooni:live-applied',()=>{if(verifiedReady()){clearInterval(timer);startVerifiedUi()}},{passive:true});
})();
