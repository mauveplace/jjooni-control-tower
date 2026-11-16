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
// V2 owns exactly one visible global navigation surface at a time.
// The original mobile-first stylesheet also sets .tabs to display:grid!important;
// explicitly arbitrate CSS-owner races, including a late injected legacy sheet.
function syncNavigationOwner(){
 if(!enabled)return;
 const tabs=qs('.tabs'),bottom=qs('#ctHumanBottomV2'),legacyMore=qs('#ctMoreMenu');
 if(!tabs||!bottom)return;
 const mobile=window.matchMedia
  ?window.matchMedia('(max-width: 767px)').matches:window.innerWidth<768;
 // The legacy loader observes style mutations; keep ownership changes
 // idempotent or both observers can schedule a re-render loop.
 const force=(node,display)=>{
  if(node.style.getPropertyValue('display')!==display||node.style.getPropertyPriority('display')!=='important')
   node.style.setProperty('display',display,'important');
 };
 const clear=node=>{if(node.style.getPropertyValue('display'))node.style.removeProperty('display')};
 const hideAria=node=>{if(node.getAttribute('aria-hidden')!=='true')node.setAttribute('aria-hidden','true')};
 const showAria=node=>{if(node.hasAttribute('aria-hidden'))node.removeAttribute('aria-hidden')};
 if(mobile){
  // Inline !important overrides historical .tabs !important rules, including
  // those injected after ct-human-v2.css. Hidden tab buttons stay clickable
  // programmatically, preserving legacy panel routing without duplicate UI.
  force(tabs,'none');hideAria(tabs);
  force(bottom,'grid');showAria(bottom);
  if(legacyMore){
   if(legacyMore.classList.contains('open'))legacyMore.classList.remove('open');
   force(legacyMore,'none');hideAria(legacyMore);
  }
 }else{
  clear(tabs);showAria(tabs);
  force(bottom,'none');hideAria(bottom);
  if(legacyMore){
   if(legacyMore.classList.contains('open'))legacyMore.classList.remove('open');
   clear(legacyMore);showAria(legacyMore);
  }
  closeMenu();
 }
 window.__JJOONI_CT_HUMAN_V2.navigation=mobile?'MOBILE_BOTTOM_5':'DESKTOP_TOP_ONLY';
}
window.__JJOONI_CT_HUMAN_V2.enforceNavigation=syncNavigationOwner;
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
 syncNavigationOwner();
 if(!observer){
  observer=new MutationObserver(()=>queueUpdate());
  observer.observe(tabs,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','aria-selected','data-tab']});
 }
 updateSelection();
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
 // Both source snapshot IDs are required before a combined financial display.
 // Missing IDs or divergent snapshots suppress P&L and net flows together.
 const snapshotAligned=Boolean(C.snapshot_id&&L?.snapshot_id)&&String(C.snapshot_id)===String(L.snapshot_id);
 let box=qs('#ctHumanQuickV2',panel);
 if(!box){
  box=document.createElement('section');box.id='ctHumanQuickV2';box.setAttribute('aria-label','오늘의 투자 변화');
  const hero=qs('.ctOvHero',panel);
  if(hero)hero.insertAdjacentElement('afterend',box);else panel.prepend(box);
  box.addEventListener('click',e=>{
   const b=e.target.closest('button[data-ct-open]');if(b)activate(b.dataset.ctOpen);
  });
 }
 const comparable=snapshotAligned&&m.known_day===4&&m.day_quality?.comparable_period&&m.day!=null;
 const dayText=comparable?formattedAmount(m.day):'합산 확인 대기';
 const dayTrust={BROKER_MEASURED:'증권사 실측',MODELED:'계산값',MIXED:'실측·계산 혼합',UNKNOWN:'원천 신뢰도 확인 필요'}[m.day_quality?.state]||'원천 검증 대기';
 const dayNote=!snapshotAligned?'현재 계좌 스냅샷 정합성 확인 대기':comparable?('동일 기간 4계좌 · '+dayTrust):('확인 '+m.known_day+'/4계좌 · 기준기간 대사 필요');
 const flowText=!snapshotAligned||m.flow==null?'확인 대기':formattedAmount(m.flow);
 const accounts=IDS.map((id,index)=>{
  const a=C.accounts[id]||{},day=snapshotAligned?M.number(a.today_pnl):null;
  return {id,label:{TOSS:'Toss',ISA:'ISA',PENSION:'연금저축',IRP:'IRP'}[id],day,nav:snapshotAligned?M.number(a.nav):null,scope:String(a.today_pnl_scope||''),kind:String(a.today_pnl_quality||'UNKNOWN'),index};
 });
 // A blank day-P&L bar is not a data visualization. When a common-day P&L
 // cannot be reconciled, use independently available same-snapshot account NAV
 // to show allocation instead (NOT profit, period change or investment return).
 const navShareReady=!comparable&&snapshotAligned&&m.nav>0
   &&accounts.every(a=>a.nav!=null&&a.nav>=0)
   &&Math.abs(accounts.reduce((v,a)=>v+a.nav,0)-m.nav)<=2;
 const ordered=comparable?accounts.slice().sort((a,b)=>Math.abs(b.day)-Math.abs(a.day)||a.index-b.index):
   navShareReady?accounts.slice().sort((a,b)=>b.nav-a.nav||a.index-b.index):accounts;
 const maxDay=Math.max(0,...accounts.map(a=>a.day==null?0:Math.abs(a.day)));
 const accountSignature=accounts.map(a=>[a.id,a.day,a.nav,a.kind,a.scope].join(':')).join(',');
 const signature=[C.snapshot_id,L?.snapshot_id,L?.generated_kst,dayText,dayNote,flowText,statusText(L||{},M),accountSignature].join('|');
 if(box.dataset.signature===signature)return;
 box.dataset.signature=signature;
 box.replaceChildren();
 const heading=document.createElement('div');heading.className='ctHumanV2QuickHead';
 const title=document.createElement('strong');title.textContent='오늘의 투자 변화';
 const stamp=document.createElement('span');const syncNotice=snapshotAligned?'':(!C.snapshot_id||!L?.snapshot_id?'⚠ 계좌 동기화 확인 대기 · ':'⚠ 계좌 동기화 불일치 · ');stamp.textContent=syncNotice+statusText(L||{},M);
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
 footer.append(text,link);
 const drivers=document.createElement('section');drivers.className='ctHumanV2Drivers';
 drivers.setAttribute('aria-label','계좌별 투자손익 영향');
 const driverHeader=document.createElement('div');driverHeader.className='ctHumanV2DriversHeader';
 const driverTitle=document.createElement('strong');driverTitle.textContent=comparable?'계좌별 손익 영향':navShareReady?'4계좌 현재 순자산 비중':'계좌별 손익 검증 대기';
 const driverMeta=document.createElement('small');driverMeta.textContent=!snapshotAligned?'스냅샷 연결 확인 필요 · 그래프 미표시':comparable?'동일 기준기간 · 손익규모순':
  navShareReady?'동일 스냅샷의 현재 NAV 구성 · 투자손익 아님':'손익·NAV 원천 확인 대기 · 빈 그래프는 숨김';
 driverHeader.append(driverTitle,driverMeta);
 const list=document.createElement('div');list.className='ctHumanV2DriverRows';
 for(const a of ordered){
  const item=document.createElement('button');item.type='button';item.className='ctHumanV2DriverRow';
  item.dataset.ctOpen='accounts';item.setAttribute('aria-label',a.label+' 계좌성과 열기');
  const name=document.createElement('span');name.className='ctHumanV2DriverLabel';name.textContent=a.label;
  const track=document.createElement('span');track.className='ctHumanV2DriverTrack';
  track.setAttribute('aria-hidden','true');
  const bar=document.createElement('span');bar.className='ctHumanV2DriverBar';
  if(comparable&&a.day!=null&&maxDay>0){
   bar.style.width=(100*Math.abs(a.day)/maxDay).toFixed(1)+'%';
   bar.dataset.direction=a.day<0?'down':a.day>0?'up':'flat';
   track.dataset.ctMetric='DAY_PNL_MAGNITUDE';
  }else if(navShareReady){
   bar.style.width=(100*a.nav/m.nav).toFixed(1)+'%';
   bar.dataset.direction='nav';
   track.dataset.ctMetric='NAV_SHARE';
  }else{
   track.hidden=true;
  }
  track.append(bar);
  const amount=document.createElement('strong');
  amount.textContent=!snapshotAligned?'동기화 확인 대기':comparable?formattedAmount(a.day):
   navShareReady?('₩'+Math.round(a.nav).toLocaleString('ko-KR')+' · '+(100*a.nav/m.nav).toFixed(1)+'%'):'손익 비교 대기';
  amount.dataset.direction=comparable?(a.day<0?'down':a.day>0?'up':'flat'):'unknown';
  const source=document.createElement('small');
  source.textContent=!snapshotAligned?'원천 동기화 확인 필요':comparable?({BROKER_MEASURED:'증권사 측정',MODELED:'모델 계산'}[a.kind]||'산정방식 확인 필요'):
   navShareReady?'현재 NAV 잔액의 구성비 · 수익률 아님':'동일 기간 4계좌 손익 대사 필요';
  item.append(name,track,amount,source);list.append(item);
 }
 drivers.append(driverHeader,list);
 const actions=document.createElement('nav');actions.className='ctHumanV2QuickPaths';
 actions.setAttribute('aria-label','자주 찾는 투자 분석');
 for(const [id,label] of [['accounts','계좌 상세'],['portfolio','보유분석'],['compare','성과분석'],['tripod','TRI-POD'],['quality','데이터품질']]){
  if(!knownTabs().some(t=>t.dataset.tab===id))continue;
  const action=document.createElement('button');action.type='button';action.dataset.ctOpen=id;action.textContent=label;
  actions.append(action);
 }
 box.append(heading,grid,drivers,footer,actions);
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
 const link=document.createElement('link');link.rel='stylesheet';link.href='ct-human-v2.css?v=4';
 (document.head||document.documentElement).append(link);
}
document.addEventListener('jjooni:live-applied',queueUpdate);
document.addEventListener('click',e=>{if(e.target.closest?.('.tabs .tab[data-tab],#ctMoreMenu button'))window.setTimeout(updateSelection,120)});
window.addEventListener('hashchange',queueUpdate);
window.addEventListener('resize',()=>{syncNavigationOwner();queueUpdate()},{passive:true});
window.addEventListener('orientationchange',()=>{syncNavigationOwner();queueUpdate()},{passive:true});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)queueUpdate()});
window.setTimeout(update,0);
window.setTimeout(update,800);
window.setTimeout(update,2200);
})();