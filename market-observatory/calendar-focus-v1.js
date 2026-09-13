(()=>{
'use strict';
function kstDate(){
  const p=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const m=Object.fromEntries(p.map(x=>[x.type,x.value]));
  return m.year+'-'+m.month+'-'+m.day;
}
function addDays(s,n){
  const d=new Date(s+'T00:00:00+09:00');
  d.setDate(d.getDate()+n);
  return d.toISOString().slice(0,10);
}
function d(e){return String(e.datetime_kst||e.date||'').slice(0,10)}
function t(e){return String(e.datetime_kst||e.date||'')}
function sortEvents(){
  if(typeof CAL==='undefined'||!CAL||!Array.isArray(CAL.events)||typeof calMonth==='undefined')return null;
  const today=kstDate(),end=addDays(today,7),current=today.slice(0,7);
  CAL.events.sort((a,b)=>{
    const da=d(a),db=d(b);
    const ra=da.slice(0,7)!==calMonth?3:(da>=today&&da<=end?0:(da>end?1:2));
    const rb=db.slice(0,7)!==calMonth?3:(db>=today&&db<=end?0:(db>end?1:2));
    if(ra!==rb)return ra-rb;
    if(ra===2)return t(b).localeCompare(t(a));
    return t(a).localeCompare(t(b));
  });
  return {today,end,current:calMonth===current};
}
function drawStatus(x){
  const box=document.querySelector('#events');if(!box)return;
  let s=document.querySelector('#obsCalFocusStatus');
  if(!s){s=document.createElement('div');s.id='obsCalFocusStatus';box.parentNode.insertBefore(s,box)}
  if(x&&x.current){s.style.display='block';s.innerHTML='<b>향후 7일 우선</b> · '+x.today.slice(5).replace('-','/')+' → '+x.end.slice(5).replace('-','/')+' · 이후 일정 → 지난 발표 순'}
  else{s.style.display='none';s.textContent=''}
}
function hook(){
  const base=window.renderCalendar;
  if(typeof base!=='function'||base.__next7)return false;
  const w=function(){const x=sortEvents();const r=base.apply(this,arguments);drawStatus(x);return r};
  w.__next7=true;window.renderCalendar=w;return true;
}
let n=0;const id=setInterval(()=>{n++;if(hook()){try{calMonth=kstDate().slice(0,7);window.renderCalendar()}catch(e){}clearInterval(id)}else if(n>100)clearInterval(id)},100);
const st=document.createElement('style');st.textContent='#obsCalFocusStatus{margin:10px 0 2px;padding:8px 10px;border:1px solid #cdddf1;background:#f6f9fe;border-radius:10px;font-size:10px;color:#667085}#obsCalFocusStatus b{color:#0b3b70}';document.head.appendChild(st);
window.__JJOONI_CALENDAR_FOCUS={version:'1.0-next7-first'};
})();
