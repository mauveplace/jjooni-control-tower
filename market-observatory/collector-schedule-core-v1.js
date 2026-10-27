(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.JjooniCollectorSchedule=api;
})(typeof window==='object'?window:globalThis,function(){
'use strict';
// Operational GitHub Actions schedule health, independent of market-session freshness.
// 15-minute cron is best effort; a 75-minute grace avoids treating normal jitter as an outage.
const CADENCE_MIN=15, GRACE_MIN=75, PRODUCER_GRACE_MIN=90;
const ms=value=>typeof value==='string'&&value.trim()?Date.parse(value):NaN;
function evaluate(runs,receipt,now=Date.now()){
  const candidates=(Array.isArray(runs)?runs:[]).filter(r=>r&&r.event==='schedule'&&Number.isFinite(ms(r.created_at))).sort((a,b)=>ms(b.created_at)-ms(a.created_at));
  const last=candidates[0]||null, producer=ms(receipt?.generated_kst);
  const producerAge=Number.isFinite(producer)&&producer<=now+60000?Math.max(0,(now-producer)/60000):null;
  if(!last)return {state:'UNVERIFIED',reason:'예약 실행 기록을 확인할 수 없습니다.',last:null,producer_age_min:producerAge,cadence_min:CADENCE_MIN,grace_min:GRACE_MIN,recovery_due:false};
  const age=Math.max(0,(now-ms(last.created_at))/60000);
  const gap=age>GRACE_MIN;
  const failed=last.status==='completed'&&last.conclusion!=='success';
  const recoveryDue=gap&&(producerAge===null||producerAge>PRODUCER_GRACE_MIN);
  return {
    state:gap?'SCHEDULE_GAP':failed?'SCHEDULE_FAILED':last.status!=='completed'?'RUNNING':'SCHEDULE_OBSERVED',
    reason:gap?'예약 실행 기록이 허용 지연 한계를 초과했습니다.':'예약 실행 기록을 확인했습니다. 데이터 정상 여부와 별개입니다.',
    last:{id:last.id,created_at:last.created_at,conclusion:last.conclusion||last.status,url:last.html_url||null},
    last_age_min:age,producer_age_min:producerAge,cadence_min:CADENCE_MIN,grace_min:GRACE_MIN,
    due_at:new Date(ms(last.created_at)+GRACE_MIN*60000).toISOString(),
    recovery_due:recoveryDue
  };
}
return {evaluate,CADENCE_MIN,GRACE_MIN,PRODUCER_GRACE_MIN};
});
