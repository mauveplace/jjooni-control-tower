(function(){
'use strict';
if(window.__JJOONI_DRILLDOWN_READABILITY_V19)return;
const STATE={state:'ACTIVE',version:'19.2',patched:0,last_at:null};
window.__JJOONI_DRILLDOWN_READABILITY_V19=STATE;

function ensureStyle(){
 if(document.getElementById('ctDrilldownReadabilityV19Style'))return;
 const s=document.createElement('style');
 s.id='ctDrilldownReadabilityV19Style';
 s.textContent=`
/* V19.2: tablet/desktop drilldowns are decision surfaces, not micro-copy. */
#accountDrillModal,#positionDrillModal,#posDrillModal,.ctPositionDrillModal,[data-ct-position-modal],[role="dialog"]{font-family:system-ui,-apple-system,'Noto Sans KR',sans-serif!important}
#accountDrillModal .v2Kpi,#positionDrillModal .v2Kpi,#posDrillModal .v2Kpi,.ctPositionDrillModal .v2Kpi,[data-ct-position-modal] .v2Kpi{min-height:88px!important;padding:14px 15px!important}
#accountDrillModal .v2Kpi .label,#positionDrillModal .v2Kpi .label,#posDrillModal .v2Kpi .label,.ctPositionDrillModal .v2Kpi .label,[data-ct-position-modal] .v2Kpi .label{font-size:13px!important;line-height:1.35!important;font-weight:800!important;letter-spacing:-.01em!important}
#accountDrillModal .v2Kpi .value,#positionDrillModal .v2Kpi .value,#posDrillModal .v2Kpi .value,.ctPositionDrillModal .v2Kpi .value,[data-ct-position-modal] .v2Kpi .value{font-size:21px!important;line-height:1.2!important;font-weight:900!important;margin-top:7px!important}
#accountDrillModal .name,#positionDrillModal .name,#posDrillModal .name,.ctPositionDrillModal .name,[data-ct-position-modal] .name{font-size:14px!important;line-height:1.4!important;font-weight:850!important}
#accountDrillModal .sub,#positionDrillModal .sub,#posDrillModal .sub,.ctPositionDrillModal .sub,[data-ct-position-modal] .sub{font-size:11.5px!important;line-height:1.45!important}
#accountDrillModal .trade,#positionDrillModal .trade,#posDrillModal .trade,.ctPositionDrillModal .trade,[data-ct-position-modal] .trade{min-height:58px!important;padding:11px 12px!important;gap:12px!important}
#accountDrillModal .trade .right b,#positionDrillModal .trade .right b,#posDrillModal .trade .right b,.ctPositionDrillModal .trade .right b,[data-ct-position-modal] .trade .right b{font-size:13px!important;line-height:1.35!important}
#accountDrillModal h1,#accountDrillModal h2,#accountDrillModal h3,#positionDrillModal h1,#positionDrillModal h2,#positionDrillModal h3,#posDrillModal h1,#posDrillModal h2,#posDrillModal h3,.ctPositionDrillModal h1,.ctPositionDrillModal h2,.ctPositionDrillModal h3{letter-spacing:-.02em!important}
#accountDrillModal h2,#accountDrillModal h3,#positionDrillModal h2,#positionDrillModal h3,#posDrillModal h2,#posDrillModal h3,.ctPositionDrillModal h2,.ctPositionDrillModal h3{font-size:17px!important;line-height:1.35!important}
@media(min-width:768px){
 #accountDrillModal,[id*="position"][id*="Modal"],[id*="Position"][id*="Modal"]{font-size:13px!important}
 #accountDrillModal button,[id*="position"][id*="Modal"] button,[id*="Position"][id*="Modal"] button{font-size:12px!important;min-height:34px!important}
 #accountDrillModal [style*="font:800 12px"],#accountDrillModal [style*="font:600 10px"],#accountDrillModal [style*="font:800 11px"]{font-size:12px!important;line-height:1.45!important}
}
`;
 (document.head||document.documentElement).appendChild(s);
}

const REPLACEMENTS=[
 ['CURRENT SESSION P&L · LIVE','당일 손익 · LIVE'],
 ['Session Engine 정규장 기준 손익 원인','당일 손익 구성'],
 ['종목별 정규장 가격효과','종목별 당일 가격효과'],
 ['종목 기준 정규장 손익','종목 기준 당일 손익'],
 ['정규장 투자성과','당일 투자성과'],
 ['정규장 기준 P&L','당일 손익'],
 ['정규장 P&L','당일 손익'],
 ['정규장 현재가','현재가'],
 ['직전 정규장 종가 대비 최신 정규장 시세','직전 기준가 대비 최신 가격'],
 ['직전 정규장 종가','직전 기준가'],
 ['정규장 손익','당일 손익'],
 ['정규장 등락률','당일 등락률'],
 ['정규장 상승','당일 상승'],
 ['정규장 하락','당일 하락'],
 ['정규장 시세 확인중','당일 시세 확인중'],
 ['정규장 —','당일 —'],
 ['Session Engine 기준','당일 기준']
];
function isDrillRoot(el){
 if(!el||el.nodeType!==1)return false;
 const id=String(el.id||''),cls=String(el.className||'');
 if(id==='accountDrillModal'||/position.*modal/i.test(id)||/posDrillModal/i.test(id)||/PositionDrillModal/i.test(cls))return true;
 if(el.getAttribute&&el.getAttribute('role')==='dialog'){
   const t=String(el.innerText||'');return t.includes('DRILLDOWN')||t.includes('최근 매매')||t.includes('보유수량');
 }
 return false;
}
function roots(){
 const found=[...document.querySelectorAll('#accountDrillModal,#positionDrillModal,#posDrillModal,.ctPositionDrillModal,[data-ct-position-modal],[role="dialog"]')].filter(isDrillRoot);
 if(found.length)return found;
 return [...document.body.children].filter(el=>{const t=String(el.innerText||'');return t.includes('POSITION DRILLDOWN')||t.includes('ACCOUNT DRILLDOWN')});
}
function replaceText(root){
 const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[];while(w.nextNode())nodes.push(w.currentNode);
 let changed=0;
 for(const node of nodes){let v=node.nodeValue||'',next=v;for(const [a,b] of REPLACEMENTS)next=next.split(a).join(b);if(next!==v){node.nodeValue=next;changed++}}
 return changed;
}
function markDynamicRoot(root){
 if(root.id==='accountDrillModal')return;
 const txt=String(root.innerText||'');if(txt.includes('POSITION DRILLDOWN')||txt.includes('보유수량')){root.dataset.ctPositionModal='1';root.classList.add('ctPositionDrillModal')}
}
function patch(){ensureStyle();let count=0;for(const root of roots()){markDynamicRoot(root);count+=replaceText(root)}STATE.patched+=count;STATE.last_at=new Date().toISOString()}
function burst(){[20,70,160,320,560,900,1300,1900].forEach(ms=>setTimeout(patch,ms))}
function wrapAccountOpen(){
 const fn=window.openAccountDrilldown;if(typeof fn!=='function'||fn.__jjooniReadabilityV19)return;
 const w=function(){const r=fn.apply(this,arguments);burst();return r};
 w.__jjooniReadabilityV19=true;
 if(fn.__jjooniIntegrityV17)w.__jjooniIntegrityV17=true;
 w.__originalReadability=fn;
 window.openAccountDrilldown=w;
}

ensureStyle();patch();wrapAccountOpen();
// Event-driven only: no polling loop / no global MutationObserver. A finite
// render burst follows drilldown opens because legacy modules finish async
// account content in several waves after the first modal paint.
document.addEventListener('click',e=>{const hit=e.target&&e.target.closest&&e.target.closest('[data-position-drill],[data-account-drill],.trade,.v2Kpi');if(hit)burst()},{capture:true});
document.addEventListener('jjooni:live-applied',()=>{wrapAccountOpen();setTimeout(patch,60);setTimeout(patch,700)});
})();