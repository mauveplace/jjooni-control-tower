(function(root){
'use strict';

const IDS=['TOSS','ISA','PENSION','IRP','TRIPOD'];
const LABEL={TOSS:'Toss',ISA:'ISA',PENSION:'연금저축',IRP:'IRP',TRIPOD:'TRI-POD'};
const WINDOW=30;
const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null};
const dayKey=v=>{try{return root.JjooniMetrics?.dayKey?root.JjooniMetrics.dayKey(v):String(v||'').slice(0,10)}catch(_){return String(v||'').slice(0,10)}};

function dailyRate(row){
 for(const k of ['flow_adj_daily_return','daily_return','flow_adj_return']){
  const x=n(row&&row[k]);
  if(x!=null&&x>-1&&x<=1)return x;
 }
 return null;
}

function actualRows(id,source){
 const rows=Array.isArray(source)?source:[];
 const byDay=new Map();
 for(const row of rows){
  if(String(row?.account||'').toUpperCase()!==id)continue;
  const series=String(row?.series_id||'ACTUAL').toUpperCase();
  if(series!=='ACTUAL')continue;
  const d=dayKey(row?.date||row?.observed_at||row?.sync_kst);if(!d)continue;
  const r=dailyRate(row);if(r==null)continue;
  byDay.set(d,{date:d,rate:r,row});
 }
 return [...byDay.values()].sort((a,b)=>a.date.localeCompare(b.date));
}

function compound30(id,source){
 const rows=actualRows(id,source);
 if(rows.length<WINDOW)return {state:'INSUFFICIENT_HISTORY',count:rows.length,return_pct:null,start:rows[0]?.date||null,end:rows.at(-1)?.date||null};
 const used=rows.slice(-WINDOW);
 let growth=1;
 for(const x of used)growth*=1+x.rate;
 if(!Number.isFinite(growth)||growth<=0)return {state:'INVALID_HISTORY',count:used.length,return_pct:null,start:used[0]?.date||null,end:used.at(-1)?.date||null};
 return {state:'OK',count:used.length,return_pct:(growth-1)*100,start:used[0].date,end:used.at(-1).date};
}

const API={WINDOW,dailyRate,actualRows,compound30};
if(typeof module==='object'&&module.exports){module.exports=API;return}
if(typeof window!=='object'||typeof document!=='object')return;
if(window.__JJOONI_ACCOUNT_RETURN_30D_V46)return;

const S={state:'BOOTING',version:'46.0',window:WINDOW,accounts:{},patched:0};
window.__JJOONI_ACCOUNT_RETURN_30D_V46=S;
const q=(s,r=document)=>{try{return r.querySelector(s)}catch(_){return null}};
const qa=(s,r=document)=>{try{return Array.from(r.querySelectorAll(s))}catch(_){return []}};
const norm=s=>String(s||'').replace(/\s+/g,' ').trim();
const pct=v=>n(v)==null?'—':(Number(v)>=0?'+':'')+Number(v).toFixed(1)+'%';

function historyHealth(){
 const L=window.__JJOONI_LIVE_PAYLOAD||{};
 const pb=(L.source_health||{}).pb_history||{};
 const raw=String(pb.state||'').toUpperCase();
 if(!raw)return {trusted:false,state:'UNKNOWN'};
 return {trusted:['OK','VERIFIED'].includes(raw),state:raw,as_of:pb.as_of||L.pb_history_as_of||null};
}
function performance(){try{return Array.isArray(D?.human?.performance)?D.human.performance:[]}catch(_){return []}}
function cardFor(id){
 const target=LABEL[id].toLowerCase();
 return qa('.ctAcct').find(card=>norm(q('.ctAcctName',card)?.textContent).toLowerCase().includes(target))||null;
}
function leaves(root){return qa('div,span,b,strong,small',root).filter(e=>e.children.length===0)}
function metricParts(card){
 if(!card)return {};
 const stats=q('.ctAcctStats',card)||card;
 const xs=leaves(stats);
 let label=xs.find(e=>/30\s*거래일.*Flow[- ]?adjusted.*누적수익률/i.test(norm(e.textContent)))||
           xs.find(e=>/30D.*Flow[- ]?adjust/i.test(norm(e.textContent)))||
           xs.find(e=>/Flow[- ]?adjusted.*누적수익률/i.test(norm(e.textContent)));
 let value=null;
 if(label){
  let box=label.parentElement;
  for(let depth=0;box&&depth<4&&!value;depth++,box=box.parentElement){
   const candidates=leaves(box).filter(e=>e!==label&&/^[+-]?\d+(?:\.\d+)?%$/.test(norm(e.textContent)));
   if(candidates.length)value=candidates.at(-1);
  }
 }
 if(!value){
  const candidates=xs.filter(e=>/^[+-]?\d+(?:\.\d+)?%$/.test(norm(e.textContent)));
  value=candidates.length?candidates.at(-1):null;
 }
 return {label,value};
}
function setLeaf(el,text){if(el&&norm(el.textContent)!==text)el.textContent=text}
function paint(id,result,health){
 const card=cardFor(id),parts=metricParts(card);if(!card||!parts.value)return false;
 let text,title;
 if(id==='TRIPOD'&&result.state!=='OK'){
  text='이력 부족';title=`TRI-POD 실제 NAV 기반 유효 일별수익률 ${result.count}/${WINDOW}일. NDX proxy는 계좌 수익률로 사용하지 않습니다.`;
 }else if(!health.trusted){
  text='이력 갱신 대기';title=`성과 이력 원장 상태 ${health.state}. 검증되지 않은 과거 숫자는 표시하지 않습니다.`;
 }else if(result.state==='OK'){
  text=pct(result.return_pct);title=`실제 ${result.start}~${result.end} ${WINDOW}개 거래일 Flow-adjusted 일별수익률 기하연결(TWR)`;
 }else{
  text='이력 부족';title=`유효 Flow-adjusted 일별수익률 ${result.count}/${WINDOW}일`;
 }
 setLeaf(parts.value,text);parts.value.dataset.ctReturn30dV46=result.state;parts.value.title=title;
 if(parts.label){
  const label=id==='TRIPOD'?'30거래일 실제 NAV 누적수익률':'30거래일 Flow-adjusted 누적수익률';
  setLeaf(parts.label,label);parts.label.title=title;
 }
 return true;
}

let busy=false,queued=false;
function apply(){
 if(busy)return;busy=true;
 try{
  const rows=performance(),health=historyHealth();let patched=0;const out={};
  for(const id of IDS){
   const result=compound30(id,rows);out[id]={...result,history_state:health.state};
   if(paint(id,result,health))patched++;
  }
  Object.assign(S,{state:'ACTIVE',version:'46.0',window:WINDOW,accounts:out,history:health,patched,updated_at:new Date().toISOString()});
 }finally{busy=false}
}
function schedule(){if(queued)return;queued=true;setTimeout(()=>{queued=false;apply()},60)}

apply();setTimeout(apply,350);setTimeout(apply,1200);
document.addEventListener('jjooni:live-applied',schedule);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});
try{
 const root=document.getElementById('overviewAccounts')||document.body;
 new MutationObserver(schedule).observe(root,{subtree:true,childList:true,characterData:true});
}catch(_){}
})(typeof window==='object'?window:globalThis);
