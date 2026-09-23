(function(){
'use strict';
if(window.__JJOONI_AUTOBOT_AUDIT_BOARD_V1)return;
window.__JJOONI_AUTOBOT_AUDIT_BOARD_V1={state:'WAITING',version:'1.0',updated_at:null,error:null};

const SHEET_ID='1t8TNfIHxSIc_uoSxAgmSbkqCz00923nF1u-b6jlCgYE';
const TAB='GITHUB_CT_LIVE',REFRESH_MS=60000;
const q=(s,r=document)=>{try{return r.querySelector(s)}catch(_){return null}};
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const b64=s=>Uint8Array.from(atob(String(s||'')),c=>c.charCodeAt(0));

function loadGviz(){return new Promise((resolve,reject)=>{
 const cb='__ct_audit_'+Date.now()+'_'+Math.random().toString(36).slice(2),s=document.createElement('script');let done=false;
 const finish=(e,v)=>{if(done)return;done=true;try{delete window[cb]}catch(_){};try{s.remove()}catch(_){};clearTimeout(timer);e?reject(e):resolve(v)};
 window[cb]=resp=>{try{const o={};((((resp||{}).table||{}).rows)||[]).forEach(r=>{const c=r.c||[],k=c[0]?.v!=null?String(c[0].v):'',v=c[1]?.v!=null?String(c[1].v):'';if(k)o[k]=v});finish(null,o)}catch(e){finish(e)}};
 const timer=setTimeout(()=>finish(new Error('AUDIT_GVIZ_TIMEOUT')),15000);
 s.onerror=()=>finish(new Error('AUDIT_GVIZ_LOAD_FAIL'));
 s.src='https://docs.google.com/spreadsheets/d/'+SHEET_ID+'/gviz/tq?sheet='+encodeURIComponent(TAB)+'&tqx='+encodeURIComponent('responseHandler:'+cb)+'&_='+Date.now();
 document.head.appendChild(s);
})}

async function decryptEnvelope(env,password){
 const raw=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
 const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:b64(env.salt),iterations:Number(env.iterations),hash:'SHA-256'},raw,{name:'AES-GCM',length:256},false,['decrypt']);
 const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64(env.nonce),additionalData:b64(env.aad),tagLength:128},key,b64(env.ciphertext));
 return JSON.parse(new TextDecoder().decode(plain));
}

function ensureStyle(){
 if(q('#ctAutobotAuditStyleV1'))return;
 const s=document.createElement('style');s.id='ctAutobotAuditStyleV1';
 s.textContent=
 '#ctAutobotAuditBoardV1{margin:10px 0 18px;font-family:system-ui,-apple-system,sans-serif;color:#172b45}'+
 '.ctAaHead{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin:4px 2px 10px}.ctAaTitle{font-size:18px;font-weight:950}.ctAaSub{font-size:10px;color:#748398;margin-top:3px}.ctAaBadge{font-size:9px;font-weight:900;border-radius:999px;padding:5px 8px;background:#eef4fa;color:#38526c;border:1px solid #dbe5ef;white-space:nowrap}'+
 '.ctAaGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.ctAaCard{background:#fff;border:1px solid #e1e7ee;border-radius:12px;padding:10px 11px;min-width:0}.ctAaCard span{display:block;font-size:9px;color:#7b8798;font-weight:800}.ctAaCard b{display:block;margin-top:4px;font-size:16px;color:#101828}'+
 '.ctAaSection{margin-top:8px;background:#fff;border:1px solid #e1e7ee;border-radius:12px;padding:11px}.ctAaSection h4{margin:0 0 7px;font-size:12px;color:#101828}.ctAaMuted{font-size:9px;color:#8794a5}.ctAaRow{display:grid;grid-template-columns:92px 68px minmax(0,1fr);gap:8px;padding:7px 0;border-bottom:1px solid #f0f3f6;font-size:9px;align-items:start}.ctAaRow:last-child{border-bottom:0}.ctAaVerdict{font-weight:950}.ctAaVerdict.PASS{color:#087443}.ctAaVerdict.WARN{color:#b45309}.ctAaVerdict.FAIL{color:#be123c}.ctAaText{color:#475467;line-height:1.4;overflow-wrap:anywhere}.ctAaCandidate{padding:7px 0;border-bottom:1px solid #f0f3f6;font-size:9px}.ctAaCandidate:last-child{border-bottom:0}.ctAaCandidate b{font-size:10px}.ctAaTag{display:inline-block;margin-left:5px;padding:2px 5px;border-radius:999px;background:#fff7ed;color:#b45309;font-size:8px;font-weight:900}.ctAaSafety{margin-top:7px;font-size:8px;color:#667085}'+
 '@media(max-width:767px){.ctAaGrid{grid-template-columns:1fr 1fr}.ctAaHead{display:block}.ctAaBadge{display:inline-block;margin-top:6px}.ctAaRow{grid-template-columns:74px 55px minmax(0,1fr)}}';
 (document.head||document.documentElement).appendChild(s);
}

function ensureRoot(){
 const panel=q('#panel-ai');if(!panel)return null;
 let root=q('#ctAutobotAuditBoardV1',panel);
 if(!root){root=document.createElement('section');root.id='ctAutobotAuditBoardV1';panel.prepend(root)}
 return root;
}

function verdictCount(summary,key){return Number((summary?.verdicts||{})[key]||0)}

function render(det,ai){
 ensureStyle();const root=ensureRoot();if(!root)return false;
 const summary=det?.summary||{},learning=det?.learning||{},safety=det?.safety||{};
 const audits=Array.isArray(det?.recent_audits)?det.recent_audits:[];
 const candidates=Array.isArray(learning?.candidates)?learning.candidates:[];
 const aiReviews=Array.isArray(ai?.reviews)?ai.reviews:[];
 const overall=String(ai?.overall_assessment||'').trim();
 const updated=String(ai?.generated_kst||det?.generated_kst||'').replace('T',' ').slice(0,16);

 const auditRows=audits.slice(-8).reverse().map(x=>{
  const p=x.process||{},issues=(p.issues||[]).map(y=>y.code).filter(Boolean).slice(0,3).join(', '),ref=x.decision_id||x.response_id||'—';
  return '<div class="ctAaRow"><div>'+esc((x.session||'')+' '+(x.action||''))+'</div><div class="ctAaVerdict '+esc(p.verdict||'')+'">'+esc(p.verdict||'—')+' · '+esc(p.score??'—')+'</div><div class="ctAaText">'+esc(issues||'이슈 없음')+'<div class="ctAaMuted">'+esc(ref)+'</div></div></div>';
 }).join('');

 const candidateRows=candidates.slice(0,6).map(c=>{
  const p=c.pattern||{},e=c.evidence||{};
  return '<div class="ctAaCandidate"><b>'+esc(c.candidate_id||'Learning Candidate')+'</b><span class="ctAaTag">'+esc(c.status||'SHADOW_ONLY')+'</span><div class="ctAaText">'+esc((p.session||'')+' '+(p.action||'')+' · '+(p.issue_code||''))+' · '+esc(e.issue_observations??0)+'/'+esc(e.population??0)+' ('+esc(Math.round(Number(e.issue_rate||0)*100))+'%)</div></div>';
 }).join('');

 const aiRows=aiReviews.slice(0,6).map(x=>{
  const issues=(x.issues||[]).slice(0,2).join(' / ');
  return '<div class="ctAaRow"><div>'+esc(x.decision_ref||'—')+'</div><div class="ctAaVerdict '+esc(x.process_verdict||'')+'">'+esc(x.process_verdict||'—')+' · '+esc(x.process_score??'—')+'</div><div class="ctAaText">'+esc(issues||x.challenger_comment||'검토 완료')+'</div></div>';
 }).join('');

 root.innerHTML=
  '<div class="ctAaHead"><div><div class="ctAaTitle">AUTOBOT AUDIT BOARD</div><div class="ctAaSub">JJOONI 독립감사 · 판단 품질 / 실행 품질 / 학습후보 분리</div></div><div class="ctAaBadge">'+esc(updated||'대기 중')+'</div></div>'+
  '<div class="ctAaGrid">'+
   '<div class="ctAaCard"><span>감사 의사결정</span><b>'+esc(summary.decision_count??0)+'</b></div>'+
   '<div class="ctAaCard"><span>평균 Process Score</span><b>'+esc(summary.average_process_score??'—')+'</b></div>'+
   '<div class="ctAaCard"><span>PASS / WARN / FAIL</span><b>'+verdictCount(summary,'PASS')+' / '+verdictCount(summary,'WARN')+' / '+verdictCount(summary,'FAIL')+'</b></div>'+
   '<div class="ctAaCard"><span>Learning Candidate</span><b>'+esc(learning.candidate_count??0)+'</b></div>'+
  '</div>'+
  '<div class="ctAaSection"><h4>JJOONI AI Auditor</h4><div class="ctAaText">'+esc(overall||'AI 감사 결과 생성 대기')+'</div>'+(aiRows||'<div class="ctAaMuted">AI 세부 리뷰 대기</div>')+'</div>'+
  '<div class="ctAaSection"><h4>최근 판단 감사</h4>'+(auditRows||'<div class="ctAaMuted">감사 데이터 대기</div>')+'</div>'+
  '<div class="ctAaSection"><h4>Shadow Learning Candidates</h4>'+(candidateRows||'<div class="ctAaMuted">아직 통계 임계치를 충족한 학습후보가 없습니다.</div>')+
   '<div class="ctAaSafety">자동 전략변경 '+(safety.auto_promote?'ON':'OFF')+' · Production mutation '+(safety.production_mutation_allowed?'ON':'OFF')+' · Broker calls '+esc(safety.broker_calls??0)+'</div></div>';

 window.__JJOONI_AUTOBOT_AUDIT_BOARD_V1={
  state:'ACTIVE',version:'1.0',updated_at:updated||null,error:null,
  decision_count:Number(summary.decision_count||0),candidate_count:Number(learning.candidate_count||0),
  ai_review_count:aiReviews.length,read_only:safety.read_only===true,
  production_mutation_allowed:safety.production_mutation_allowed===true
 };
 return true;
}

let busy=false;
async function refresh(){
 if(busy)return;busy=true;
 try{
  const pw=sessionStorage.getItem('jjooni_ct_session_pw');if(!pw)return;
  const kv=await loadGviz();
  if(kv.AUTOBOT_AUDIT_SCHEMA!=='JJOONI_CT_AUTOBOT_AUDIT_ENCRYPTED_V1')throw new Error('AUDIT_SIDECAR_NOT_READY');
  if(!kv.AUTOBOT_AUDIT_ENVELOPE)throw new Error('AUDIT_ENVELOPE_MISSING');
  const det=await decryptEnvelope(JSON.parse(kv.AUTOBOT_AUDIT_ENVELOPE),pw);
  const ai=kv.AUTOBOT_AI_AUDIT_ENVELOPE?await decryptEnvelope(JSON.parse(kv.AUTOBOT_AI_AUDIT_ENVELOPE),pw):null;
  if(!render(det,ai))throw new Error('AI_PANEL_NOT_READY');
 }catch(e){
  window.__JJOONI_AUTOBOT_AUDIT_BOARD_V1={state:'WAITING',version:'1.0',updated_at:null,error:String(e&&e.message||e)};
 }finally{busy=false}
}

refresh();setTimeout(refresh,1200);setTimeout(refresh,4000);
setInterval(()=>{if(!document.hidden)refresh()},REFRESH_MS);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
document.addEventListener('jjooni:live-applied',()=>setTimeout(refresh,250));
})();