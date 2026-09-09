(function(){
'use strict';
if(window.__JJOONI_CONSULTANT_MARKET_V29?.state==='ACTIVE')return;

const S={state:'BOOTING',version:'29.0',renders:0};
window.__JJOONI_CONSULTANT_MARKET_V29=S;
const q=(s,r=document)=>{try{return r.querySelector(s)}catch(_){return null}};
const qa=(s,r=document)=>{try{return Array.from(r.querySelectorAll(s))}catch(_){return[]}};
const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null};
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const MACROS=[
 ['KOSPI','KOSPI'],['KOSDAQ','KOSDAQ'],['USDKRW','원/달러'],['NASDAQ100','NASDAQ 100'],['SP500','S&P 500'],['WTI','WTI 유가'],['US10Y','미국채 10년'],['VIX','VIX'],['DXY','달러인덱스']
];
const GROUP_ORDER=['S&P 500 섹터','반도체·메모리','소프트웨어','바이오','지역은행','한국 관심종목','기타'];

function payload(){
  const P=window.__JJOONI_LIVE_PAYLOAD||{};
  const C=window.__JJOONI_CANONICAL_SSOT||{};
  return {
    market:P.market_context||C.market_context||{},
    consultant:P.consultant_watchlist||C.consultant_watchlist||{}
  };
}
function pct(v){const x=n(v);return x==null?'—':(x>=0?'+':'')+x.toFixed(2)+'%'}
function cls(v){const x=n(v);return x==null?'flat':x>0?'up':x<0?'down':'flat'}
function price(v,unit,currency,key){
  const x=n(v);if(x==null)return'—';
  if(key==='USDKRW')return '₩'+x.toLocaleString('ko-KR',{maximumFractionDigits:2});
  if(key==='WTI'||String(unit).toUpperCase()==='USD/BBL')return '$'+x.toLocaleString('en-US',{maximumFractionDigits:2});
  if(key==='US10Y'||unit==='%')return x.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:3})+'%';
  if(String(currency||'').toUpperCase()==='USD')return '$'+x.toLocaleString('en-US',{maximumFractionDigits:2});
  if(String(currency||'').toUpperCase()==='KRW')return '₩'+x.toLocaleString('ko-KR',{maximumFractionDigits:0});
  return x.toLocaleString('en-US',{maximumFractionDigits:2});
}
function sourceLabel(s){const x=String(s||'').toUpperCase();if(x.includes('KIS'))return'KIS';if(x.includes('YAHOO'))return'Yahoo 참고';if(x==='UNAVAILABLE')return'확인 불가';return s||'—'}
function asof(v){
  if(!v)return'—';const d=new Date(v);if(!Number.isFinite(d.getTime()))return String(v);
  return d.toLocaleString('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
}

function ensureStyle(){
 if(q('#ctConsultantMarketV29Style'))return;
 const st=document.createElement('style');st.id='ctConsultantMarketV29Style';st.textContent=`
 #panel-consultant{display:none;min-width:0}
 #panel-consultant.on{display:block}
 .ctCm{width:100%;max-width:1380px;margin:0 auto;padding:2px 0 26px;color:#172033}
 .ctCmHead{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin:4px 0 14px}
 .ctCmTitle{font-size:24px;font-weight:950;letter-spacing:-.5px;color:#10233d}.ctCmSub{font-size:11px;color:#7b8798;margin-top:5px}
 .ctCmBadge{display:inline-flex;align-items:center;gap:5px;padding:6px 9px;border-radius:999px;background:#eef5ff;border:1px solid #d7e6fb;color:#245b98;font:850 10px/1 system-ui;white-space:nowrap}
 .ctCmMacro{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:14px}
 .ctCmMacroCard{background:#fff;border:1px solid #e2e8ef;border-radius:14px;padding:12px 13px;min-width:0;box-shadow:0 3px 12px rgba(12,31,54,.035)}
 .ctCmMacroTop{display:flex;align-items:center;justify-content:space-between;gap:6px}.ctCmMacroName{font-size:10px;font-weight:900;color:#667085}.ctCmSrc{font-size:8px;color:#98a2b3;white-space:nowrap}
 .ctCmMacroValue{font-size:20px;font-weight:950;color:#101828;margin-top:7px;white-space:nowrap}.ctCmMacroMove{font-size:11px;font-weight:900;margin-top:3px}.ctCmMacroMove.up,.ctCmDay.up{color:#d92d20}.ctCmMacroMove.down,.ctCmDay.down{color:#175cd3}.ctCmMacroMove.flat,.ctCmDay.flat{color:#667085}
 .ctCmSection{background:#fff;border:1px solid #e2e8ef;border-radius:15px;padding:13px;margin-bottom:12px;box-shadow:0 3px 12px rgba(12,31,54,.035)}
 .ctCmSectionHead{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px}.ctCmSectionTitle{font-size:15px;font-weight:950;color:#10233d}.ctCmSectionMeta{font-size:9px;color:#8793a3;text-align:right}
 .ctCmBreadth{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-bottom:12px}.ctCmBreadth>div{border:1px solid #edf1f5;border-radius:11px;background:#f8fafc;padding:9px 10px}.ctCmBreadth span{display:block;font-size:8px;color:#8b97a6}.ctCmBreadth b{display:block;margin-top:4px;font-size:12px;color:#172033;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
 .ctCmGroup{margin-top:12px}.ctCmGroup:first-of-type{margin-top:0}.ctCmGroupTitle{font-size:10px;font-weight:950;color:#526071;margin:0 2px 6px}
 .ctCmRows{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.ctCmRow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;border:1px solid #edf1f5;border-radius:11px;padding:9px 10px;background:#fff;min-width:0}.ctCmRowName{min-width:0}.ctCmTicker{font-size:11px;font-weight:950;color:#101828}.ctCmName{font-size:8px;color:#8b97a6;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ctCmRowRight{text-align:right}.ctCmPx{font-size:10px;font-weight:850;color:#344054}.ctCmDay{font-size:10px;font-weight:950;margin-top:2px}.ctCmFoot{font-size:8px;color:#98a2b3;margin-top:2px}
 .ctCmEmpty{padding:24px 14px;text-align:center;color:#7f8b9b;font-size:11px;border:1px dashed #d8e0e8;border-radius:12px;background:#fafbfd}
 @media(max-width:767px){
  .ctCm{padding:2px 0 78px}.ctCmHead{align-items:flex-start}.ctCmTitle{font-size:20px}.ctCmSub{font-size:10px}.ctCmBadge{font-size:9px;padding:5px 7px}
  .ctCmMacro{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.ctCmMacroCard{padding:10px}.ctCmMacroValue{font-size:16px}.ctCmMacroMove{font-size:10px}
  .ctCmSection{padding:10px;border-radius:13px}.ctCmBreadth{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.ctCmRows{grid-template-columns:1fr}.ctCmRow{padding:9px}.ctCmSectionMeta{max-width:150px}
 }
 `;(document.head||document.documentElement).appendChild(st);
}

function activate(){
 const tab=q('.tab[data-tab="consultant"]'),panel=q('#panel-consultant');if(!tab||!panel)return;
 qa('.tab[data-tab]').forEach(t=>t.classList.toggle('on',t===tab));
 qa('[id^="panel-"]').forEach(p=>{const on=p===panel;p.classList.toggle('on',on);if(on)p.style.setProperty('display','block','important');else p.style.setProperty('display','none','important')});
 try{sessionStorage.setItem('jjooni_ct_active_tab_v1','consultant')}catch(_){}
 const more=q('#ctMoreMenu');if(more)qa('button[data-tab]',more).forEach(b=>b.classList.toggle('active',b.dataset.tab==='consultant'));
 render();
}
function ensureShell(){
 const tabs=q('.tabs');if(!tabs)return false;
 let tab=q('.tab[data-tab="consultant"]');
 if(!tab){tab=document.createElement('button');tab.type='button';tab.className='tab';tab.dataset.tab='consultant';tab.textContent='시장·섹터';const before=q('.tab[data-tab="watchlist"]',tabs)||q('.tab[data-tab="cost"]',tabs);if(before)tabs.insertBefore(tab,before);else tabs.appendChild(tab);tab.addEventListener('click',e=>{e.preventDefault();activate();setTimeout(activate,0)})}
 let panel=q('#panel-consultant');
 if(!panel){panel=document.createElement('section');panel.id='panel-consultant';panel.className='panel';const ref=q('#panel-watchlist')||q('#panel-overview');const parent=ref?.parentElement||q('.app')||document.body;if(ref&&ref.parentElement===parent)parent.insertBefore(panel,ref.nextSibling);else parent.appendChild(panel)}
 return true;
}
function ensureMore(){
 const menu=q('#ctMoreMenu');if(!menu)return;
 let b=q('button[data-tab="consultant"]',menu);
 if(!b){b=document.createElement('button');b.type='button';b.dataset.tab='consultant';b.textContent='시장·섹터';b.setAttribute('role','menuitem');b.onclick=()=>{activate();menu.classList.remove('open');const more=q('#ctMoreTab');if(more)more.setAttribute('aria-expanded','false')};const cost=q('button[data-tab="cost"]',menu);if(cost)menu.insertBefore(b,cost);else menu.appendChild(b)}
}

function macroHtml(market){
 const items=market?.items||{};
 return MACROS.map(([key,label])=>{const r=items[key]||{};return `<div class="ctCmMacroCard"><div class="ctCmMacroTop"><span class="ctCmMacroName">${esc(label)}</span><span class="ctCmSrc">${esc(sourceLabel(r.source))}</span></div><div class="ctCmMacroValue">${price(r.value,r.unit,null,key)}</div><div class="ctCmMacroMove ${cls(r.change_pct)}">${pct(r.change_pct)}</div></div>`}).join('');
}
function rowsHtml(rows){
 const groups=new Map();for(const r of rows){const g=r.group||'기타';if(!groups.has(g))groups.set(g,[]);groups.get(g).push(r)}
 const ordered=[...groups.keys()].sort((a,b)=>{const ia=GROUP_ORDER.indexOf(a),ib=GROUP_ORDER.indexOf(b);return (ia<0?99:ia)-(ib<0?99:ib)});
 return ordered.map(g=>{const rs=groups.get(g).slice().sort((a,b)=>(n(b.change_pct)??-999)-(n(a.change_pct)??-999));return `<div class="ctCmGroup"><div class="ctCmGroupTitle">${esc(g)} · ${rs.length}</div><div class="ctCmRows">${rs.map(r=>`<div class="ctCmRow"><div class="ctCmRowName"><div class="ctCmTicker">${esc(r.ticker)}</div><div class="ctCmName">${esc(r.name||r.ticker)}</div></div><div class="ctCmRowRight"><div class="ctCmPx">${price(r.current_price,null,r.currency,r.ticker)}</div><div class="ctCmDay ${cls(r.change_pct)}">${pct(r.change_pct)}</div><div class="ctCmFoot">${esc(sourceLabel(r.source))}</div></div></div>`).join('')}</div></div>`}).join('');
}
function render(){
 const panel=q('#panel-consultant');if(!panel)return;
 const {market,consultant}=payload(),rows=Array.isArray(consultant?.rows)?consultant.rows:[];
 const priced=rows.filter(r=>n(r.current_price)!=null),moves=rows.filter(r=>n(r.change_pct)!=null),up=moves.filter(r=>n(r.change_pct)>0).length,down=moves.filter(r=>n(r.change_pct)<0).length;
 const sorted=moves.slice().sort((a,b)=>n(b.change_pct)-n(a.change_pct)),leader=sorted[0],laggard=sorted[sorted.length-1];
 panel.innerHTML=`<div class="ctCm"><div class="ctCmHead"><div><div class="ctCmTitle">시장·섹터</div><div class="ctCmSub">송팀장 Consultant View · 주요 지수 + 마스터시트 섹터 Watchlist</div></div><div class="ctCmBadge">● 마스터시트 consultant 자동연동</div></div><div class="ctCmMacro">${macroHtml(market)}</div><section class="ctCmSection"><div class="ctCmSectionHead"><div class="ctCmSectionTitle">Consultant 섹터 보드</div><div class="ctCmSectionMeta">${esc(consultant.state||'WAITING')} · ${priced.length}/${rows.length} 가격 · ${esc(asof(consultant.as_of_kst||market.as_of_kst))}</div></div>${rows.length?`<div class="ctCmBreadth"><div><span>상승 / 하락</span><b>${up} / ${down}</b></div><div><span>가격 확인</span><b>${priced.length} / ${rows.length}</b></div><div><span>강세 1위</span><b class="${leader?cls(leader.change_pct):'flat'}">${leader?esc(leader.ticker)+' '+pct(leader.change_pct):'—'}</b></div><div><span>약세 1위</span><b class="${laggard?cls(laggard.change_pct):'flat'}">${laggard?esc(laggard.ticker)+' '+pct(laggard.change_pct):'—'}</b></div></div>${rowsHtml(rows)}`:'<div class="ctCmEmpty">마스터시트의 WATCHLIST / consultant 데이터를 기다리는 중입니다.</div>'}</section></div>`;
 S.state='ACTIVE';S.renders++;S.consultant_count=rows.length;S.priced_count=priced.length;S.market_state=market.state||'WAITING';S.updated_at=new Date().toISOString();
}
function sync(){ensureStyle();if(!ensureShell())return;ensureMore();render()}

document.addEventListener('click',e=>{const t=e.target.closest?.('.tab[data-tab]');if(t&&t.dataset.tab!=='consultant'){const p=q('#panel-consultant'),ct=q('.tab[data-tab="consultant"]');if(p){p.classList.remove('on');p.style.removeProperty('display')}if(ct)ct.classList.remove('on')}});
document.addEventListener('jjooni:live-applied',()=>setTimeout(sync,0));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync()});
window.addEventListener('resize',()=>setTimeout(sync,0),{passive:true});
try{new MutationObserver(()=>{if(!q('.tab[data-tab="consultant"]')||!q('#ctMoreMenu button[data-tab="consultant"]'))setTimeout(sync,0)}).observe(document.documentElement,{subtree:true,childList:true});}catch(_){}
setTimeout(sync,0);setTimeout(sync,500);setTimeout(sync,1500);setTimeout(sync,3000);
})();
