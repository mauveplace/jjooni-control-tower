(function(root){
'use strict';

const VERSION='43.0';
const num=v=>{
 if(v===null||v===undefined||v===''||typeof v==='boolean'||typeof v==='object')return null;
 const x=Number(String(v).replace(/,/g,'').replace(/₩/g,'').replace(/원/g,'').trim());
 return Number.isFinite(x)?x:null;
};
const won=v=>num(v)==null?'—':'₩'+Math.round(num(v)).toLocaleString('ko-KR');
const norm=v=>String(v||'').replace(/\s+/g,' ').trim();
const parseWonText=v=>{
 const s=norm(v);
 if(!/^[-+]?₩?\s*[\d,]+(?:\.\d+)?(?:원)?$/.test(s))return null;
 return num(s);
};
const API={num,won,parseWonText};
if(typeof module==='object'&&module.exports)module.exports=API;
root.__JJOONI_TOSS_ACCOUNT_BASIS_API_V43=API;
if(!root.document)return;
if(root.__JJOONI_TOSS_ACCOUNT_BASIS_V43)return;

const S={state:'BOOTING',version:VERSION,patched_current:0,patched_history:0,patched_modal:0};
root.__JJOONI_TOSS_ACCOUNT_BASIS_V43=S;
const q=(s,r=document)=>{try{return r.querySelector(s)}catch(_){return null}};
const qa=(s,r=document)=>{try{return Array.from(r.querySelectorAll(s))}catch(_){return[]}};
const leaf=e=>e&&e.children&&e.children.length===0;
const canon=()=>root.__JJOONI_CANONICAL_SSOT||{};
const toss=()=>((canon().accounts||{}).TOSS)||{};
const currentNav=()=>num(toss().nav);

function ensureStyle(){
 if(q('#ctTossBasisV43Style'))return;
 const st=document.createElement('style');st.id='ctTossBasisV43Style';st.textContent=`
 .ctTossBasisNoteV43{margin-top:6px;font-size:10px;line-height:1.45;color:#667085;font-weight:750}
 .ctTossBasisNoteV43 b{color:#175cd3;font-weight:900}
 .ctTossHistoryNoteV43{margin:8px 0 4px;padding:8px 10px;border-radius:10px;background:#f8fafc;border:1px solid #e4e7ec;font-size:10px;line-height:1.5;color:#667085}
 .ctTossHistoryNoteV43 b{color:#101828}
 @media(max-width:767px){.ctTossBasisNoteV43,.ctTossHistoryNoteV43{font-size:10px}}
 `; (document.head||document.documentElement).appendChild(st);
}

function tossCurrentCards(){
 return qa('.ctAcct').filter(c=>/Toss/i.test(norm(q('.ctAcctName',c)?.textContent)));
}
function maxWonLeaf(container){
 const xs=qa('div,span,b,strong',container).filter(leaf).map(e=>({e,v:parseWonText(e.textContent)})).filter(x=>x.v!=null);
 if(!xs.length)return null;
 xs.sort((a,b)=>Math.abs(b.v)-Math.abs(a.v));
 return xs[0];
}
function patchCurrentCard(card,nav){
 const hit=maxWonLeaf(card);
 if(hit&&Math.abs(hit.v-nav)>0.5){hit.e.textContent=won(nav);hit.e.dataset.tossCanonicalNavV43='1'}
 qa('div,span,small,b,strong',card).filter(leaf).forEach(e=>{
  const t=norm(e.textContent);
  if(/30거래일\s*Flow-adjusted\s*누적수익률/i.test(t))e.textContent='30D Flow-adjusted 운용수익률';
 });
 let note=q('.ctTossBasisNoteV43',card);
 if(!note){note=document.createElement('div');note.className='ctTossBasisNoteV43';card.appendChild(note)}
 note.innerHTML='<b>Toss 현재 NAV</b> · CT Overview 계좌별 Canonical NAV 기준';
 S.patched_current++;
}

function historicalCards(){
 const labels=qa('h1,h2,h3,h4,div,span,b,strong').filter(e=>leaf(e)&&/^Toss$/i.test(norm(e.textContent)));
 const out=[];
 for(const label of labels){
  // Historical Toss correction must never touch the Overview hero/6-account total.
  if(label.closest&&label.closest('#panel-overview'))continue;
  let e=label.parentElement;
  for(let i=0;e&&i<10;i++,e=e.parentElement){
   const t=norm(e.textContent);
   if(/정규장\s*P&L/i.test(t)&&/누적수익률/i.test(t)&&(/환율효과/i.test(t)||/NAV\s*정합성/i.test(t))){
    out.push(e);break;
   }
  }
 }
 return [...new Set(out)].filter(x=>!x.classList.contains('ctAcct'));
}
function relabelHistory(card){
 qa('div,span,small,b,strong',card).filter(leaf).forEach(e=>{
  const t=norm(e.textContent);
  if(t==='누적수익률')e.textContent='Historical 누적수익률';
  else if(t==='누적손익')e.textContent='Historical 누적손익';
  else if(t==='정규장 수익률')e.textContent='Historical 정규장 수익률';
  else if(t==='NAV 정합성 차이')e.textContent='Historical NAV 정합성 차이';
 });
}
function patchHistoryCard(card,nav){
 const existing=q('.ctTossHistoryNoteV43',card);
 let hist=existing?num(existing.dataset.historyNav):null;
 const hit=maxWonLeaf(card);
 if(hist==null&&hit){
  hist=hit.v;
  // Do not capture an already patched current canonical NAV as the historical basis.
  if(Math.abs(hist-nav)<0.5){
   const saved=num(card.dataset.tossHistoricalNavV43);
   if(saved!=null)hist=saved;
  }else card.dataset.tossHistoricalNavV43=String(hist);
 }
 if(hit&&Math.abs(hit.v-nav)>0.5){hit.e.textContent=won(nav);hit.e.dataset.tossCanonicalNavV43='1'}
 relabelHistory(card);
 let note=existing;
 if(!note){note=document.createElement('div');note.className='ctTossHistoryNoteV43';const head=q('h1,h2,h3,h4',card)||card.firstElementChild;head?.insertAdjacentElement('afterend',note)}
 if(note){
  if(hist!=null)note.dataset.historyNav=String(hist);
  note.innerHTML='<b>Toss 현재 NAV '+won(nav)+'</b> · CT Overview 계좌별 Canonical NAV<br>Historical 성과 계산 기준 NAV '+(hist!=null?won(hist):'확인 중')+' · 현재 총자산과 별도';
 }
 S.patched_history++;
}

function patchTossModal(nav){
 const m=q('#accountDrillModal');if(!m||!/Toss/i.test(norm(m.textContent)))return;
 let touched=false;
 qa('.v2Kpi',m).forEach(k=>{
  const label=norm(q('.label',k)?.textContent);
  if(label==='현재 NAV'||label==='총자산'){
   const v=q('.value',k);if(v){v.textContent=won(nav);v.dataset.tossCanonicalNavV43='1';touched=true}
  }
 });
 if(touched){
  let note=q('.ctTossBasisNoteV43',m);
  if(!note){note=document.createElement('div');note.className='ctTossBasisNoteV43';const hero=q('.accountHeroPrimary',m)||m.firstElementChild;hero?.insertAdjacentElement('afterend',note)}
  if(note)note.innerHTML='<b>현재 총자산</b> · CT Overview Canonical NAV와 동일 기준';
  S.patched_modal++;
 }
}

function apply(){
 const nav=currentNav();
 if(nav==null||nav<=0){S.state='WAITING_CANONICAL_TOSS_NAV';return}
 ensureStyle();
 S.patched_current=0;S.patched_history=0;S.patched_modal=0;
 tossCurrentCards().forEach(c=>patchCurrentCard(c,nav));
 historicalCards().forEach(c=>patchHistoryCard(c,nav));
 patchTossModal(nav);
 S.state='ACTIVE';S.canonical_nav=nav;S.authority='CT_OVERVIEW_CANONICAL_TOSS_NAV';S.updated_at=new Date().toISOString();
}

let queued=false;
function schedule(){if(queued)return;queued=true;setTimeout(()=>{queued=false;apply()},45)}
document.addEventListener('jjooni:live-applied',schedule);
document.addEventListener('click',schedule,true);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});
try{new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true,characterData:true})}catch(_){}
setTimeout(apply,0);setTimeout(apply,600);setTimeout(apply,1800);setTimeout(apply,4000);
})(typeof window==='object'?window:globalThis);
