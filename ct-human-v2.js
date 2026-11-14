(function(){
'use strict';
if(window.__JJOONI_CT_HUMAN_V2)return;
const MODE_KEY='jjooni-ct-human-ui-v2';
const PRIMARY=[['overview','오늘','◉'],['accounts','계좌','▣'],['compare','성과','▥'],['tripod','전략','◇']];
const IDS=['TOSS','ISA','PENSION','IRP'];
const qs=(s,r=document)=>r.querySelector(s);
let enabled=true,initialized=false,observer=null,renderQueued=false;
const mode=new URLSearchParams(window.location.search).get('ctui');
try{
  if(mode==='v1'||mode==='v2')localStorage.setItem(MODE_KEY,mode);
  enabled=(mode==='v1'||mode==='v2'?mode:localStorage.getItem(MODE_KEY))!=='v1';
}catch(_){enabled=mode!=='v1'}
window.__JJOONI_CT_HUMAN_V2={version:'1.0',mode:enabled?'v2':'v1',navigation:'PENDING',financial_calculation:'UNCHANGED'};

function changeMode(next){
  try{localStorage.setItem(MODE_KEY,next)}catch(_){}
  const url=new URL(window.location.href);
  url.searchParams.set('ctui',next);
  window.location.assign(url.toString());
}
function knownTabs(){
 const seen=new Set();
 return Array.from(document.querySelectorAll('.tabs .tab[data-tab]')).filter(t=>{
  const id=t.dataset.tab;
  if(!id||seen.has(id)||t.dataset.ctNavDuplicate||/^(ai|aibot|autobot)$/i.test(id))return false;
  seen.add(id);return true;
 });
}
function selected(){
 const active=knownTabs().find(t=>t.classList.contains('on')||t.getAttribute('aria-selected')==='true');
 const hash=window.location.hash.replace(/^#/,'').toLowerCase();
 return active?.dataset.tab||knownTabs().find(t=>t.dataset.tab===hash)?.dataset.tab||'overview';
}
function activate(id){
 const tab=knownTabs().find(t=>t.dataset.tab===id);
 if(!tab)return;
 closeMenu();
 tab.click();
 try{sessionStorage.setItem('jjooni_ct_active_tab_v1',id)}catch(_){}
 window.setTimeout(updateSelection,0);
 window.setTimeout(updateSelection,160);
}
function closeMenu(){
 const menu=qs('#ctHumanV2More');
 if(menu)menu.hidden=true;
 const more=qs('#ctHumanV2MoreButton');
 if(more)more.setAttribute('aria-expanded','false');
}
function toggleMenu(){
 const menu=qs('#ctHumanV2More');
 if(!menu)return;
 menu.hidden=!menu.hidden;
 const opened=!menu.hidden;
 const btn=qs('#ctHumanV2MoreButton');
 if(btn)btn.setAttribute('aria-expanded',String(opened));
 if(opened)qs('button[data-ct-destination]',menu)?.focus();
 else btn?.focus();
}
function button(label,id,symbol){
 const b=document.createElement('button');
 b.type='button';b.dataset.ctDestination=id;
 const ico=document.createElement('span');ico.className='ctHumanV2Icon';ico.setAttribute('aria-hidden','true');ico.textContent=symbol;
 const caption=document.createElement('span');caption.textContent=label;
 b.append(ico,caption);
 b.setAttribute('aria-label',label);
 if(id!=='more')b.setAttribute('aria-controls','panel-'+id);
 return b;
}
function ensureMenuItems(){
 const menu=qs('#ctHumanV2More');if(!menu)return;
 const tabs=knownTabs(),core=PRIMARY.map(x=>x[0]),secondary=tabs.filter(t=>!core.includes(t.dataset.tab));
 const signature=secondary.map(t=>t.dataset.tab+':'+t.textContent.trim()).join('|');
 if(menu.dataset.signature===signature)return;
 menu.dataset.signature=signature;
 const header=document.createElement('div');header.className='ctHumanV2MoreHead';
 const title=document.createElement('strong');title.textContent='전체 메뉴';
 const close=document.createElement('button');close.type='button';close.dataset.ctClose='1';close.textContent='닫기';
 header.append(title,close);
 const items=document.createElement('div');items.className='ctHumanV2MoreGrid';
 for(const t of secondary){
  const b=document.createElement('button');b.type='button';b.dataset.ctDestination=t.dataset.tab;
  b.textContent=t.textContent.trim()||t.dataset.tab;
  items.append(b);
 }
 const sep=document.createElement('div');sep.className='ctHumanV2MoreFoot';
 const legacy=document.createElement('button');legacy.type='button';legacy.dataset.ctLegacy='1';
 legacy.textContent='기존 화면으로 전환 (V1)';
 sep.append(legacy);
 menu.replaceChildren(header,items,sep);
}
function ensureNav(){
 if(!enabled)return;
 const tabs=qs('.tabs');if(!tabs)return;
 let nav=qs('#ctHumanBottomV2');
 if(!nav){
  nav=document.createElement('nav');
  nav.id='ctHumanBottomV2';nav.setAttribute('aria-label','투자 컨트롤타워 주요 메뉴');
  for(const [id,label,symbol] of PRIMARY)nav.append(button(label,id,symbol));
  const more=button('더보기','more','⋯');
  more.id='ctHumanV2MoreButton';more.setAttribute('aria-expanded','false');more.setAttribute('aria-controls','ctHumanV2More');
  nav.append(more);document.body.append(nav);
  const menu=document.createElement('div');menu.id='ctHumanV2More';menu.hidden=true;
  menu.setAttribute('role','region');menu.setAttribute('aria-label','추가 화면');
  document.body.append(menu);
  nav.addEventListener('click',e=>{
   const b=e.target.closest('button[data-ct-destination]');if(!b)return;
   if(b.dataset.ctDestination==='more')toggleMenu();else activate(b.dataset.ctDestination);
  });
  menu.addEventListener('click',e=>{
   if(e.target.closest('[data-ct-close]')){closeMenu();return}
   if(e.target.closest('[data-ct-legacy]')){changeMode('v1');return}
   const b=e.target.closest('button[data-ct-destination]');if(b)activate(b.dataset.ctDestination);
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!qs('#ctHumanV2More')?.hidden){closeMenu();qs('#ctHumanV2MoreButton')?.focus()}});
  document.addEventListener('click',e=>{
   const m=qs('#ctHumanV2More'),n=qs('#ctHumanBottomV2');
   if(m&&!m.hidden&&!m.contains(e.target)&&!n?.contains(e.target))closeMenu();
  });
 }
 ensureMenuItems();
 if(!observer){
  observer=new MutationObserver(()=>queueUpdate());
  observer.observe(tabs,{subtree:true,childList:true,attributes:true,attributeFilter:['class','aria-selected','data-tab']});
 }
 updateSelection();
 window.__JJOONI_CT_HUMAN_V2.navigation='MOBILE_BOTTOM_5';
}
function updateSelection(){
 const active=selected();
 for(const b of document.querySelectorAll('#ctHumanBottomV2 button[data-ct-destination]')){
  const id=b.dataset.ctDestination,isActive=id==='more'?!PRIMARY.some(x=>x[0]===active):id===active;
  b.classList.toggle('is-active',isActive);
  if(isActive)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
 }
}
function formattedAmount(value){
 if(typeof value!=='number'||!Number.isFinite(value))return '확인 대기';
 return (value<0?'-':'+')+'₩'+Math.abs(Math.round(value)).toLocaleString('ko-KR');
}
function statusText(L,M){
 const f=M.freshness(L);
 let when='기준시각 확인 필요';
 const raw=L.generated_kst||L.observed_at;
 const date=raw?new Date(raw):null;
 if(date&&Number.isFinite(date.getTime()))when=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(date);
 return (f.state==='STALE'||f.state==='UNKNOWN'?'⚠ 이전 수집 기준 · ':'')+when+' · '+f.text;
}
function ensureQuickView(){
 if(!enabled)return;
 const panel=qs('#panel-overview'),C=window.__JJOONI_CANONICAL_SSOT,L=window.__JJOONI_LIVE_PAYLOAD,M=window.JjooniMetrics;
 if(!panel||!C?.accounts||!M?.aggregate||!M?.freshness)return;
 const m=M.aggregate(C.accounts,IDS);
 let box=qs('#ctHumanQuickV2',panel);
 if(!box){
  box=document.createElement('section');box.id='ctHumanQuickV2';box.setAttribute('aria-label','오늘의 투자 변화');
  const hero=qs('.ctOvHero',panel);
  if(hero)hero.insertAdjacentElement('afterend',box);else panel.prepend(box);
  box.addEventListener('click',e=>{
   const b=e.target.closest('button[data-ct-open]');if(b)activate(b.dataset.ctOpen);
  });
 }
 const comparable=m.known_day===4&&m.day_quality?.comparable_period&&m.day!=null;
 const dayText=comparable?formattedAmount(m.day):'합산 확인 대기';
 const dayNote=comparable?'동일 기간 4계좌 확인':('확인 '+m.known_day+'/4계좌 · 기준기간 대사 필요');
 const flowText=m.flow==null?'확인 대기':formattedAmount(m.flow);
 const signature=[C.snapshot_id,L?.generated_kst,dayText,dayNote,flowText,statusText(L||{},M)].join('|');
 if(box.dataset.signature===signature)return;
 box.dataset.signature=signature;
 box.replaceChildren();
 const heading=document.createElement('div');heading.className='ctHumanV2QuickHead';
 const title=document.createElement('strong');title.textContent='오늘의 투자 변화';
 const stamp=document.createElement('span');stamp.textContent=statusText(L||{},M);
 heading.append(title,stamp);
 const grid=document.createElement('div');grid.className='ctHumanV2QuickGrid';
 for(const [label,amount,note] of [['투자손익',dayText,dayNote],['순입출금',flowText,'투자손익과 분리 · 원천 제공 기간']]){
  const item=document.createElement('div');item.className='ctHumanV2QuickMetric';
  const l=document.createElement('span');l.textContent=label;
  const v=document.createElement('strong');v.textContent=amount;
  const n=document.createElement('small');n.textContent=note;
  if(amount==='합산 확인 대기'||amount==='확인 대기')v.classList.add('is-pending');
  item.append(l,v,n);grid.append(item);
 }
 const footer=document.createElement('div');footer.className='ctHumanV2QuickFoot';
 const text=document.createElement('span');text.textContent='TRI-POD는 별도 계좌가 아닌 Toss 내 전략입니다.';
 const link=document.createElement('button');link.type='button';link.dataset.ctOpen='compare';link.textContent='성과 자세히 보기';
 footer.append(text,link);box.append(heading,grid,footer);
}
function showOldModeShortcut(){
 const top=qs('.top');if(!top||qs('#ctHumanV2Activate'))return;
 const b=document.createElement('button');b.id='ctHumanV2Activate';b.type='button';
 b.textContent='새 화면(V2) 열기';b.addEventListener('click',()=>changeMode('v2'));
 top.append(b);
}
function update(){
 if(!enabled){showOldModeShortcut();window.__JJOONI_CT_HUMAN_V2.navigation='LEGACY';return}
 ensureNav();ensureQuickView();
 if(!initialized){initialized=true;document.documentElement.dataset.ctHumanUi='v2'}
}
function queueUpdate(){
 if(renderQueued)return;renderQueued=true;
 window.setTimeout(()=>{renderQueued=false;update()},60);
}
if(enabled){
 document.documentElement.dataset.ctHumanUi='v2';
 const link=document.createElement('link');link.rel='stylesheet';link.href='ct-human-v2.css?v=1';
 (document.head||document.documentElement).append(link);
}
document.addEventListener('jjooni:live-applied',queueUpdate);
document.addEventListener('click',e=>{if(e.target.closest?.('.tabs .tab[data-tab],#ctMoreMenu button'))window.setTimeout(updateSelection,120)});
window.addEventListener('hashchange',queueUpdate);
window.addEventListener('resize',queueUpdate,{passive:true});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)queueUpdate()});
window.setTimeout(update,0);
window.setTimeout(update,800);
window.setTimeout(update,2200);
})();