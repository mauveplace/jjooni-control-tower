(function(){
'use strict';
if(window.__JJOONI_INVESTOR_FLOW_V1)return;
const S={state:'BOOTING',version:'1.0',renders:0};
window.__JJOONI_INVESTOR_FLOW_V1=S;

const q=(s,r=document)=>{try{return r.querySelector(s)}catch(_){return null}};
const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(String(v).replace(/,/g,''));return Number.isFinite(x)?x:null};
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const SLOT_TIME={'1':'09:30','2':'10:00','3':'11:20','4':'13:20','5':'14:30'};
const CORE={'005930':'삼성전자','000660':'SK하이닉스'};
const CONTRACT='MARKET_WIDE_NEVER_SUM_STOCK_ESTIMATE';

function payload(){
 const P=window.__JJOONI_LIVE_PAYLOAD||{};
 return {
  market:P.kr_market_investor_flow||{},
  stock:P.kr_intraday_investor_flow||{},
  consumer:P.kr_investor_flow_consumer||{},
  context:P.market_context||{}
 };
}
function signed(v){
 const x=n(v);if(x==null)return '—';
 return (x>0?'+':'')+Math.round(x).toLocaleString('ko-KR');
}
function direction(v){
 const x=n(v);if(x==null)return '확인불가';
 return x>0?'순매수':x<0?'순매도':'중립';
}
function cls(v){const x=n(v);return x==null?'flat':x>0?'up':x<0?'down':'flat'}
function pct(v){const x=n(v);return x==null?'—':(x>0?'+':'')+x.toFixed(2)+'%'}
function marketCard(name,label,row){
 const foreign=n(row?.foreign_net_amount),inst=n(row?.institution_net_amount);
 const d=row?.delta_from_previous||{};
 return `<div class="ctIfMarketCard"><div class="ctIfCardTop"><b>${esc(label)}</b><span>시장 전체</span></div>
  <div class="ctIfMain ${cls(foreign)}">외국인 ${direction(foreign)}</div>
  <div class="ctIfRaw">순매수대금 ${signed(foreign)} · Δ직전수집 ${signed(d.foreign_net_amount)}</div>
  <div class="ctIfSub">기관 ${direction(inst)} ${signed(inst)} · ${esc(row?.status||'UNAVAILABLE')}</div>
 </div>`;
}
function normalizedEstimates(row){
 const arr=Array.isArray(row?.estimates)?row.estimates.slice():[];
 arr.sort((a,b)=>Number(a?.input_slot||0)-Number(b?.input_slot||0));
 let prev=null;
 return arr.filter(x=>SLOT_TIME[String(x?.input_slot||'')]).map(x=>{
  const foreign=n(x?.foreign_estimated_net_qty),inst=n(x?.institution_estimated_net_qty);
  const pf=prev?n(prev.foreign_estimated_net_qty):null,pi=prev?n(prev.institution_estimated_net_qty):null;
  const out={slot:String(x.input_slot),time:SLOT_TIME[String(x.input_slot)],foreign,inst,fd:foreign!=null&&pf!=null?foreign-pf:null,id:inst!=null&&pi!=null?inst-pi:null};
  prev=x;return out;
 });
}
function stockCard(symbol,row){
 const items=normalizedEstimates(row),last=items[items.length-1]||{};
 const timeline=items.length?items.map(x=>`<span class="ctIfSlot"><b>${x.time}</b> 외 ${signed(x.foreign)} <em>Δ${signed(x.fd)}</em></span>`).join(''):'<span class="ctIfNoData">공식 슬롯 데이터 확인 중</span>';
 return `<div class="ctIfStockCard"><div class="ctIfCardTop"><b>${esc(CORE[symbol]||symbol)}</b><span>종목 가집계</span></div>
  <div class="ctIfStockNow"><span>외국인 <b class="${cls(last.foreign)}">${signed(last.foreign)}</b></span><span>기관 <b class="${cls(last.inst)}">${signed(last.inst)}</b></span></div>
  <div class="ctIfDelta">최근 슬롯 Δ · 외국인 <b class="${cls(last.fd)}">${signed(last.fd)}</b> · 기관 <b class="${cls(last.id)}">${signed(last.id)}</b></div>
  <div class="ctIfTimeline">${timeline}</div>
 </div>`;
}
function checkCard(regime,context){
 const items=context?.items||{};
 const checks=regime?.checks||{};
 const ok=Object.values(checks).filter(v=>v===true).length,total=Object.keys(checks).length;
 const asia=['NIKKEI225','HANGSENG','TAIEX'].map(k=>n(items[k]?.change_pct)).filter(v=>v!=null);
 const asiaUp=asia.filter(v=>v>=0).length;
 return `<div class="ctIfMarketCard"><div class="ctIfCardTop"><b>교차 확인</b><span>가격·FX·아시아</span></div>
  <div class="ctIfMain">${ok}/${total||'—'} 조건 확인</div>
  <div class="ctIfRaw">KOSPI ${pct(items.KOSPI?.change_pct)} · KOSDAQ ${pct(items.KOSDAQ?.change_pct)}</div>
  <div class="ctIfSub">USD/KRW ${pct(items.USDKRW?.change_pct)} · 아시아 비음(-) 아님 ${asiaUp}/${asia.length||0}</div>
 </div>`;
}
function ensureStyle(){
 if(q('#ctInvestorFlowV1Style'))return;
 const st=document.createElement('style');st.id='ctInvestorFlowV1Style';st.textContent=`
 #ctInvestorFlowV1{margin:0 0 14px;padding:13px;border:1px solid #dfe7ef;border-radius:15px;background:#fff;box-shadow:0 3px 12px rgba(12,31,54,.035);color:#172033}
 .ctIfHead{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:10px}.ctIfTitle{font-size:15px;font-weight:950;color:#10233d}.ctIfSubTitle{font-size:9.5px;color:#7b8798;margin-top:3px;line-height:1.45}
 .ctIfBadge{padding:6px 9px;border-radius:999px;font-size:9px;font-weight:900;background:#f2f4f7;color:#344054;white-space:nowrap}.ctIfBadge.confirm{background:#ecfdf3;color:#027a48}.ctIfBadge.warn{background:#fff7ed;color:#b54708}.ctIfBadge.risk{background:#fff1f3;color:#c01048}
 .ctIfMarketGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.ctIfMarketCard,.ctIfStockCard{border:1px solid #edf1f5;border-radius:12px;padding:10px;background:#f9fbfd;min-width:0}.ctIfCardTop{display:flex;justify-content:space-between;gap:8px;align-items:center}.ctIfCardTop b{font-size:10.5px}.ctIfCardTop span{font-size:8px;color:#98a2b3}
 .ctIfMain{font-size:14px;font-weight:950;margin-top:7px}.ctIfRaw{font-size:9.5px;color:#475467;margin-top:4px;overflow-wrap:anywhere}.ctIfSub{font-size:8.5px;color:#98a2b3;margin-top:4px}.ctIfMain.up,.ctIfStockNow .up,.ctIfDelta .up{color:#d92d20}.ctIfMain.down,.ctIfStockNow .down,.ctIfDelta .down{color:#175cd3}.flat{color:#667085}
 .ctIfStocks{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:7px}.ctIfStockNow{display:flex;gap:12px;margin-top:7px;font-size:10px}.ctIfDelta{font-size:9px;color:#667085;margin-top:4px}.ctIfTimeline{display:flex;flex-wrap:wrap;gap:4px;margin-top:7px}.ctIfSlot{font-size:8px;padding:4px 5px;border-radius:7px;background:#fff;border:1px solid #e6ebf0;color:#475467}.ctIfSlot b{color:#101828}.ctIfSlot em{font-style:normal;color:#98a2b3}.ctIfNoData{font-size:8.5px;color:#98a2b3}
 .ctIfInterpret{margin-top:8px;padding:9px 10px;border-radius:10px;background:#f8fafc;font-size:10px;line-height:1.5;color:#344054}.ctIfEvidence{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}.ctIfEvidence span{font-size:8px;padding:4px 6px;border-radius:999px;background:#eef4ff;color:#344054}.ctIfRule{font-size:8.5px;color:#98a2b3;margin-top:7px;line-height:1.45}
 @media(max-width:767px){.ctIfMarketGrid{grid-template-columns:1fr}.ctIfStocks{grid-template-columns:1fr}.ctIfHead{align-items:flex-start}.ctIfBadge{max-width:46%;white-space:normal;text-align:center}}
 `; (document.head||document.documentElement).appendChild(st);
}
function badgeClass(state){state=String(state||'');if(state==='TREND_REVERSAL_CONFIRMED')return'confirm';if(state==='RISK_OFF')return'risk';return'warn'}
function render(){
 ensureStyle();
 const panel=q('#panel-consultant'),root=q('.ctCm',panel);if(!panel||!root)return;
 const {market,stock,consumer,context}=payload(),regime=consumer?.regime||{};
 let box=q('#ctInvestorFlowV1',root);
 if(!box){box=document.createElement('section');box.id='ctInvestorFlowV1';const macro=q('.ctCmMacro',root);if(macro?.parentNode)macro.parentNode.insertBefore(box,macro.nextSibling);else root.prepend(box)}
 const markets=market?.markets||{},results=stock?.results||{};
 const label=regime?.label||'판정 보류',state=regime?.state||'UNAVAILABLE';
 const evidence=Array.isArray(regime?.evidence)?regime.evidence.slice(0,6):[];
 box.innerHTML=`<div class="ctIfHead"><div><div class="ctIfTitle">수급 판정 · 시장전체 / 종목별 분리</div><div class="ctIfSubTitle">시장 전체는 KOSPI·KOSDAQ 누적 순매수대금, 종목은 KIS 공식 가집계 슬롯 누적·증분으로 별도 해석</div></div><span class="ctIfBadge ${badgeClass(state)}">${esc(label)}${regime?.trend_reversal_confirmed?'':' · 추세전환 미확인'}</span></div>
 <div class="ctIfMarketGrid">${marketCard('KOSPI','KOSPI',markets.KOSPI||{})}${marketCard('KOSDAQ','KOSDAQ',markets.KOSDAQ||{})}${checkCard(regime,context)}</div>
 <div class="ctIfStocks">${stockCard('005930',results['005930']||{})}${stockCard('000660',results['000660']||{})}</div>
 <div class="ctIfInterpret"><b>${esc(label)}</b> · ${esc(regime?.interpretation||'시장 전체 수급과 종목별 수급을 분리해 확인 중입니다.')}<div class="ctIfEvidence">${evidence.map(x=>`<span>${esc(x)}</span>`).join('')}</div></div>
 <div class="ctIfRule">판정 규칙: 외국인 시장전체 순매수 하나만으로 추세전환을 선언하지 않습니다. KOSPI·KOSDAQ 확산, 시장수급 증분, 종목 수급 확산, USD/KRW, 아시아 시장을 함께 확인합니다. · ${CONTRACT}</div>`;
 S.state='ACTIVE';S.renders++;S.regime=state;S.updated_at=new Date().toISOString();
}
let scheduled=false;
function schedule(){if(scheduled)return;scheduled=true;setTimeout(()=>{scheduled=false;render()},30)}
document.addEventListener('jjooni:live-applied',schedule);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});
try{new MutationObserver(()=>{if(q('#panel-consultant')&&!q('#ctInvestorFlowV1'))schedule()}).observe(document.documentElement,{subtree:true,childList:true})}catch(_){}
setTimeout(render,200);setTimeout(render,900);setTimeout(render,2200);
})();
