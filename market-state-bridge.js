(function(){
'use strict';

const KST='Asia/Seoul';
const NY='America/New_York';

function parts(tz){
  const fmt=new Intl.DateTimeFormat('en-US',{timeZone:tz,weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false});
  const out={};
  for(const p of fmt.formatToParts(new Date()))out[p.type]=p.value;
  return {weekday:out.weekday||'',hour:Number(out.hour||0),minute:Number(out.minute||0)};
}
function mins(x){return x.hour*60+x.minute}
function weekday(x){return !['Sat','Sun'].includes(x.weekday)}
function phase(){
  const kr=parts(KST),ny=parts(NY),km=mins(kr),nm=mins(ny);
  if(weekday(ny)&&nm>=4*60&&nm<9*60+30)return {id:'US_PRE',label:'미국 프리마켓',max:75*60*1000};
  if(weekday(ny)&&nm>=9*60+30&&nm<16*60)return {id:'US_REGULAR',label:'미국 정규장',max:15*60*1000};
  if(weekday(ny)&&nm>=16*60&&nm<20*60)return {id:'US_POST',label:'미국 애프터마켓',max:75*60*1000};
  if(weekday(kr)&&km>=9*60&&km<=15*60+30)return {id:'KR_REGULAR',label:'한국 정규장',max:25*60*1000};
  if(weekday(kr)&&km>15*60+30&&km<18*60)return {id:'KR_POST',label:'한국 장후 · 종가 기준',max:180*60*1000};
  return {id:'MARKET_CLOSED',label:'장 마감 · 마지막 종가 기준',max:null};
}
function observed(){
  const live=window.__JJOONI_LIVE_PAYLOAD||{};
  const ts=Date.parse(String(live.observed_at||''));
  return Number.isFinite(ts)?ts:null;
}
function stamp(){
  const live=window.__JJOONI_LIVE_PAYLOAD||{};
  return String(live.observed_at||'').replace('T',' ').slice(5,16);
}
function paint(){
  const b=document.getElementById('ctEncryptedLiveBadge');
  if(!b)return;
  const p=phase(),ts=observed(),age=ts==null?Infinity:Date.now()-ts;
  b.dataset.marketPhase=p.id;
  if(p.id==='MARKET_CLOSED'){
    b.textContent='● '+p.label;
    b.title='정상적인 휴장/비거래 시간입니다. 마지막 검증 스냅샷을 표시합니다.';
    b.style.background='#f2f4f7';b.style.border='1px solid #d0d5dd';b.style.color='#475467';
    return;
  }
  if(age>p.max){
    b.textContent='SSOT STALE · '+p.label+' · '+stamp();
    b.title='현재 '+p.label+' 허용 지연을 초과했습니다.';
    b.style.background='#fff7ed';b.style.border='1px solid #fed7aa';b.style.color='#b45309';
    return;
  }
  if(/^SSOT STALE/.test(String(b.textContent||''))){
    b.textContent='SSOT LIVE · '+p.label+' · '+stamp();
    b.title='현재 세션 SLO 안의 최신 스냅샷입니다.';
    b.style.background='#ecfdf3';b.style.border='1px solid #abefc6';b.style.color='#087443';
  }
}

let busy=false;
const run=()=>{if(busy)return;busy=true;try{paint()}finally{setTimeout(()=>{busy=false},0)}};
run();
setInterval(()=>{if(!document.hidden)run()},15000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)run()});
try{new MutationObserver(()=>run()).observe(document.documentElement,{subtree:true,childList:true,characterData:true});}catch(_){}
})();
