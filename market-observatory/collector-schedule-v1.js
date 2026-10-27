(()=>{
'use strict';
// One read on page entry, then manual refresh only. No extra scheduler, no automatic polling.
const endpoint='https://api.github.com/repos/mauveplace/jjooni-control-tower/actions/workflows/market-observatory-daily.yml/runs?event=schedule&per_page=10';
const actions='https://github.com/mauveplace/jjooni-control-tower/actions/workflows/market-observatory-daily.yml';
const root=document.getElementById('obsFreshnessPanel')||document.getElementById('tabs');
if(!root||!window.JjooniCollectorSchedule)return;
const host=document.createElement('aside');
host.id='obsCollectorSchedule';
host.className='obsCollectorSchedule';
host.setAttribute('aria-live','polite');
host.innerHTML='<strong>예약 수집 실행 · <span id="obsCollectorState">확인 중</span></strong><span id="obsCollectorDetail">GitHub 예약 실행 이력 조회 중…</span><a target="_blank" rel="noopener noreferrer" href="'+actions+'">실행 이력·수동 복구 ↗</a><button type="button" id="obsCollectorRetry">재확인</button>';
root.after(host);
const state=host.querySelector('#obsCollectorState'),detail=host.querySelector('#obsCollectorDetail'),button=host.querySelector('#obsCollectorRetry');
const fmt=v=>v?new Date(v).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}):'확인 불가';
const mins=v=>Number.isFinite(v)?Math.round(v)+'분':'확인 불가';
let pending=false;
async function load(){
 if(pending)return;pending=true;button.disabled=true;state.textContent='확인 중';
 let receipt={},runs=[],error='';
 const [a,b]=await Promise.allSettled([
   fetch(endpoint,{cache:'no-store',headers:{Accept:'application/vnd.github+json'}}).then(async r=>{if(!r.ok)throw Error('GitHub API '+r.status);return r.json()}),
   fetch('./data/refresh-receipt.json',{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('게시 기록 '+r.status);return r.json()})
 ]);
 if(a.status==='fulfilled'&&Array.isArray(a.value.workflow_runs))runs=a.value.workflow_runs;
 else error=a.status==='rejected'?String(a.reason):'GitHub 실행 목록 형식 오류';
 if(b.status==='fulfilled')receipt=b.value;
 else error+=(error?' · ':'')+(b.status==='rejected'?String(b.reason):'게시 기록 확인 불가');
 const s=window.JjooniCollectorSchedule.evaluate(runs,receipt,Date.now());
 const code=s.recovery_due?'RECOVERY_DUE':s.state;
 state.textContent=code;
 host.dataset.state=code;
 const last=s.last?'최근 예약 '+fmt(s.last.created_at)+' KST ('+s.last.conclusion+', '+mins(s.last_age_min)+' 전)':'최근 예약 확인 불가';
 const pub='최근 게시 '+fmt(receipt.generated_kst)+' KST ('+mins(s.producer_age_min)+' 전, '+String(receipt.event||'이벤트 미확인')+')';
 detail.textContent=last+' · '+pub+' · 기준 15분/허용 지연 75분'+(error?' · 조회 제한: '+error:'')+(s.recovery_due?' · 게시 지연도 동반: 수동 복구 확인 필요':'')+'. 시장 기준일 LIVE와 별도 판정입니다.';
 pending=false;button.disabled=false;
}
button.addEventListener('click',load);
load();
const css=document.createElement('style');
css.textContent='.obsCollectorSchedule{max-width:1152px;margin:8px auto 10px;padding:10px 14px;border:1px solid #d6e1ef;border-radius:12px;background:#f7faff;color:#334155;display:flex;align-items:center;flex-wrap:wrap;gap:8px 12px;font-size:11px;line-height:1.5}.obsCollectorSchedule strong{white-space:nowrap;color:#334155}.obsCollectorSchedule span#obsCollectorDetail{flex:1 1 400px}.obsCollectorSchedule a{color:#175a9e;text-decoration:underline;white-space:nowrap}.obsCollectorSchedule button{border:1px solid #cbd5e1;background:white;border-radius:7px;padding:5px 9px;cursor:pointer}.obsCollectorSchedule[data-state="SCHEDULE_GAP"],.obsCollectorSchedule[data-state="SCHEDULE_FAILED"]{background:#fff8e8;border-color:#f5c873}.obsCollectorSchedule[data-state="RECOVERY_DUE"]{background:#fff0f0;border-color:#f4a4a4}.obsCollectorSchedule[data-state="UNVERIFIED"]{background:#f6f6f6}@media(max-width:760px){.obsCollectorSchedule{margin:8px 10px;padding:10px}}';
document.head.appendChild(css);
})();
