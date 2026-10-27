(()=>{
'use strict';
const details=document.querySelector('.obsFreshDetails'),meta=document.querySelector('#obsWatchMeta');
if(!details||!meta||!window.JjooniCollectorSchedule)return;
const host=document.createElement('div');host.id='obsCollectorSchedule';host.className='obsCollectorSchedule';
host.innerHTML='<strong>예약 수집 실행 <span id="obsCollectorState">미조회</span></strong><span id="obsCollectorDetail">상태를 열면 실행 이력을 확인합니다.</span><button type="button" id="obsCollectorRetry">재확인</button><a href="https://github.com/mauveplace/jjooni-control-tower/actions/workflows/market-observatory-daily.yml" target="_blank" rel="noopener noreferrer">실행 이력 ↗</a>';
meta.after(host);const state=host.querySelector('#obsCollectorState'),detail=host.querySelector('#obsCollectorDetail'),button=host.querySelector('#obsCollectorRetry');let pending=null,loaded=false;
const label={UNVERIFIED:'확인 불가',SCHEDULE_GAP:'예약 지연',SCHEDULE_FAILED:'예약 실행 실패',RUNNING:'실행 중',SCHEDULE_OBSERVED:'예약 실행 기록 확인'};
const fmt=x=>x?new Date(x).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}):'확인 불가';
async function load(){
 if(pending)return pending;button.disabled=true;state.textContent='확인 중';
 pending=(async()=>{const [runResult,statusResult]=await Promise.allSettled([
  fetch('https://api.github.com/repos/mauveplace/jjooni-control-tower/actions/workflows/market-observatory-daily.yml/runs?event=schedule&per_page=10',{cache:'no-store',headers:{Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(12000)}).then(r=>{if(!r.ok)throw Error('GitHub '+r.status);return r.json()}),
  window.JjooniDataReads.read('./data/freshness-status.json',30000)
 ]);
 const runs=runResult.status==='fulfilled'&&Array.isArray(runResult.value.workflow_runs)?runResult.value.workflow_runs:[];
 const status=statusResult.status==='fulfilled'?statusResult.value:null;
 const result=window.JjooniCollectorSchedule.evaluate(runs,status);
 state.textContent=label[result.state]||'확인 불가';host.dataset.state=result.state;
 const last=result.last?'최근 예약 '+fmt(result.last.created_at)+' KST · '+(result.last.conclusion||result.last.status):'예약 실행 기록 확인 불가';
 const market=result.market_age_min===null?'시장 생성시각 재확인 필요':'시장 파일 생성 '+Math.floor(result.market_age_min)+'분 전'+(result.market_check==='CHECK_REQUIRED'?' · 원천 재점검 필요':'');
 detail.textContent=last+' · '+market+' · 예약 15분 간격 / 75분 지연 허용. 실행 기록은 수집 완료나 자동 복구를 보장하지 않습니다.';loaded=true;
 })().catch(()=>{state.textContent='확인 불가';host.dataset.state='UNVERIFIED';detail.textContent='실행 이력을 확인하지 못했습니다.'}).finally(()=>{button.disabled=false;pending=null});return pending;
}
button.addEventListener('click',load);details.addEventListener('toggle',()=>{if(details.open&&!loaded)load()});if(details.open)load();
const css=document.createElement('style');css.textContent='.obsCollectorSchedule{display:flex;gap:7px 12px;flex-wrap:wrap;align-items:center;margin-top:10px;padding:10px;border:1px solid #dbe3ef;border-radius:10px;background:#f8fafc;font-size:11px;color:#475467}.obsCollectorSchedule span#obsCollectorDetail{flex:1 1 340px}.obsCollectorSchedule button{border:1px solid #cbd5e1;background:#fff;border-radius:7px;padding:6px}.obsCollectorSchedule a{color:#175cd3}.obsCollectorSchedule[data-state=SCHEDULE_GAP],.obsCollectorSchedule[data-state=SCHEDULE_FAILED]{background:#fff7ed;border-color:#fed7aa}.obsCollectorSchedule[data-state=UNVERIFIED]{background:#f2f4f7}';document.head.appendChild(css);
})();
