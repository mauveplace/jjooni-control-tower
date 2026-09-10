(function(){
'use strict';
if(window.__JJOONI_TRIPOD_DAILY_FRESHNESS_V35)return;
const STATE={state:'ACTIVE',version:'35.0',renders:0,last:null};
window.__JJOONI_TRIPOD_DAILY_FRESHNESS_V35=STATE;
const SOURCE='YAHOO_RULE_ENGINE_FAST_V31';
const BASIS='LAST_10_DAILY_CLOSES_ARITHMETIC_MEAN';
const q=(s,r=document)=>{try{return r.querySelector(s)}catch(_){return null}};
const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null};
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const num=(v,d=2)=>n(v)==null?'—':Number(v).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
const pct=v=>n(v)==null?'—':(Number(v)>=0?'+':'')+Number(v).toFixed(2)+'%';
function signal(){
 const P=window.__JJOONI_LIVE_PAYLOAD||{},C=window.__JJOONI_CANONICAL_SSOT||{};
 const p=((P.accounts||{}).TRIPOD||{}).signal||P.tripod_signal||{};
 const c=((C.accounts||{}).TRIPOD||{}).signal||C.tripod_signal||{};
 return String(p.source||'')===SOURCE?p:String(c.source||'')===SOURCE?c:p&&Object.keys(p).length?p:c;
}
function ymd(v){const s=String(v||'');const m=s.match(/\b(20\d{2}-\d{2}-\d{2})\b/);return m?m[1]:''}
function daysFromTodayKst(date){
 if(!/^20\d{2}-\d{2}-\d{2}$/.test(date))return null;
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const a=Date.parse(date+'T12:00:00+09:00'),b=Date.parse(today+'T12:00:00+09:00');
 return Number.isFinite(a)&&Number.isFinite(b)?Math.round((b-a)/86400000):null;
}
function marketSessionDate(){
 const P=window.__JJOONI_LIVE_PAYLOAD||{},C=window.__JJOONI_CANONICAL_SSOT||{};
 const pools=[P.market_context,C.market_context];
 for(const pool of pools){
  const items=(pool||{}).items||{};
  for(const key of ['VIX','NASDAQ100','SP500']){
   const r=items[key]||{};
   const d=ymd(r.session_date||r.as_of_date||r.as_of_kst||r.observed_at);
   if(d&&n(r.value)!=null)return d;
  }
 }
 return '';
}
function trust(sig){
 const date=ymd(sig.date||sig.session_date||sig.as_of_date);
 const age=daysFromTodayKst(date),marketDate=marketSessionDate();
 const contract=!!(sig&&sig.ok===true&&String(sig.source||'')===SOURCE&&String(sig.vix_basis||'')===BASIS&&Number(sig.vix_window_count)===10&&n(sig.vix10)!=null&&n(sig.ndx)!=null&&n(sig.ma250)!=null&&n(sig.drawdown_52w_pct)!=null&&date);
 if(!contract)return {ok:false,reason:'AUTHORITY_CONTRACT_MISSING',date,age,marketDate};
 if(age==null||age<0||age>4)return {ok:false,reason:'SESSION_DATE_STALE',date,age,marketDate};
 if(marketDate&&marketDate!==date)return {ok:false,reason:'MARKET_SIGNAL_DATE_MISMATCH',date,age,marketDate};
 return {ok:true,reason:'VERIFIED_DAILY_SIGNAL',date,age,marketDate};
}
function ensureStyle(){
 if(q('#ctTripodDailyFreshnessStyleV35'))return;
 const s=document.createElement('style');s.id='ctTripodDailyFreshnessStyleV35';s.textContent=`
#panel-tripod[data-ct-tripod-daily-quarantine="1"]>*:not(#ctTripodDailyVerifiedV35){display:none!important}
#ctTripodDailyVerifiedV35{margin:8px 0 14px;padding:15px;border-radius:16px;font-family:system-ui,-apple-system,sans-serif}
#ctTripodDailyVerifiedV35 .ctTpHead{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
#ctTripodDailyVerifiedV35 .ctTpTitle{font-weight:900;font-size:16px}.ctTpBadge{font-size:10px;font-weight:900;white-space:nowrap}
#ctTripodDailyVerifiedV35 .ctTpGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}
#ctTripodDailyVerifiedV35 .ctTpCell{padding:10px;border:1px solid #e4eaf2;border-radius:12px;background:#fff;min-width:0}
#ctTripodDailyVerifiedV35 .ctTpLabel{font-size:9px;color:#667085;font-weight:800}.ctTpValue{display:block;margin-top:4px;font-size:17px;color:#101828;font-weight:900;overflow-wrap:anywhere}
#ctTripodDailyVerifiedV35 .ctTpNote{margin-top:10px;font-size:10px;line-height:1.55;color:#475467}
@media(max-width:560px){#ctTripodDailyVerifiedV35 .ctTpGrid{grid-template-columns:1fr 1fr}#ctTripodDailyVerifiedV35{padding:13px}}
`;(document.head||document.documentElement).appendChild(s);
}
function ensureBox(panel){let b=q('#ctTripodDailyVerifiedV35',panel);if(!b){b=document.createElement('section');b.id='ctTripodDailyVerifiedV35';panel.insertBefore(b,panel.firstChild)}return b}
function render(){
 const panel=q('#panel-tripod');if(!panel)return false;
 ensureStyle();const sig=signal(),t=trust(sig),box=ensureBox(panel);
 // Stability rule: the decrypted legacy TRI-POD card is a historical snapshot.
 // Never present it as today's decision surface. The verified daily surface below
 // is the only current strategy display; if authority is missing, fail closed.
 panel.dataset.ctTripodDailyQuarantine='1';
 const observed=ymd(sig.observed_at)||String(sig.observed_at||'').replace('T',' ').slice(0,19);
 if(!t.ok){
  box.style.cssText+=';border:1px solid #fed7aa;background:#fff7ed;color:#7c2d12';
  const legacy=ymd(sig.date||sig.session_date||sig.as_of_date)||'확인 불가';
  const market=t.marketDate||'확인 불가';
  const signature=['BLOCK',t.reason,legacy,market,String(sig.source||'')].join('|');
  if(box.dataset.signature!==signature){box.dataset.signature=signature;box.innerHTML='<div class="ctTpHead"><div><div class="ctTpTitle" style="color:#9a3412">TRI-POD 오늘 신호 검증 대기</div><div style="margin-top:4px;font-size:10px">구형 정적 판단화면은 안전을 위해 숨겼습니다.</div></div><span class="ctTpBadge" style="color:#9a3412">STALE BLOCKED</span></div><div class="ctTpGrid"><div class="ctTpCell"><span class="ctTpLabel">마지막 신호 기준일</span><b class="ctTpValue">'+esc(legacy)+'</b></div><div class="ctTpCell"><span class="ctTpLabel">시장 데이터 기준일</span><b class="ctTpValue">'+esc(market)+'</b></div><div class="ctTpCell"><span class="ctTpLabel">현재 전략 판단</span><b class="ctTpValue">사용 금지</b></div><div class="ctTpCell"><span class="ctTpLabel">복구 조건</span><b class="ctTpValue">FAST V31 일봉 검증</b></div></div><div class="ctTpNote">기준일·NDX·MA250·VIX 최근 10거래일 종가·52주 낙폭·목표비중이 같은 스냅샷으로 검증되기 전에는 TQQQ/QLD/QQQ 비중과 HOLD/REBALANCE를 현재 지시처럼 표시하지 않습니다. 원인: '+esc(t.reason)+'</div>'}
  STATE.last={trusted:false,...t,source:sig.source||null};STATE.renders++;return false;
 }
 const regime=String(sig.regime||'—'),target=String(sig.target||'—'),action=String(sig.action||'—'),spot=n(sig.vix_latest_close),vix10=n(sig.vix10),ndx=n(sig.ndx),ma250=n(sig.ma250),dd=n(sig.drawdown_52w_pct),gap=ndx!=null&&ma250>0?(ndx/ma250-1)*100:null;
 box.style.cssText+=';border:1px solid #b7e4cc;background:#f7fffb;color:#153b2a';
 const signature=[t.date,regime,target,action,spot,vix10,ndx,ma250,dd].join('|');
 if(box.dataset.signature!==signature){box.dataset.signature=signature;box.innerHTML='<div class="ctTpHead"><div><div class="ctTpTitle" style="color:#087443">TRI-POD 검증된 일별 신호</div><div style="margin-top:4px;font-size:10px">공식 기준 '+esc(t.date)+' · 최근 완료 일봉</div></div><span class="ctTpBadge" style="color:#087443">VERIFIED DAILY</span></div><div class="ctTpGrid"><div class="ctTpCell"><span class="ctTpLabel">CURRENT REGIME</span><b class="ctTpValue">'+esc(regime)+'</b></div><div class="ctTpCell"><span class="ctTpLabel">TARGET EXPOSURE</span><b class="ctTpValue">'+esc(target)+'</b></div><div class="ctTpCell"><span class="ctTpLabel">TODAY ACTION</span><b class="ctTpValue">'+esc(action)+'</b></div><div class="ctTpCell"><span class="ctTpLabel">NASDAQ-100 / MA250</span><b class="ctTpValue">'+num(ndx,2)+' / '+num(ma250,2)+'</b><div style="font-size:9px;margin-top:3px;color:#667085">MA250 대비 '+pct(gap)+'</div></div><div class="ctTpCell"><span class="ctTpLabel">VIX 최근 완료 일봉</span><b class="ctTpValue">'+num(spot,2)+'</b></div><div class="ctTpCell"><span class="ctTpLabel">VIX 10일 평균 · 전략 입력</span><b class="ctTpValue">'+num(vix10,2)+'</b></div><div class="ctTpCell"><span class="ctTpLabel">52주 고점 대비 낙폭</span><b class="ctTpValue">'+pct(dd)+'</b></div><div class="ctTpCell"><span class="ctTpLabel">DATA AUTHORITY</span><b class="ctTpValue" style="font-size:11px">FAST V31</b><div style="font-size:9px;margin-top:3px;color:#667085">'+esc(observed||'')+'</div></div></div><div class="ctTpNote">TRI-POD 전략 입력 VIX는 현물 숫자가 아니라 최근 10개 완료 거래일 종가의 산술평균입니다. 이 화면은 주문을 실행하지 않는 read-only 판단 화면입니다.</div>'}
 STATE.last={trusted:true,...t,regime,target,action,vix10,spot};STATE.renders++;return true;
}
let pending=false;function queue(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;render()})}
document.addEventListener('jjooni:live-applied',()=>setTimeout(queue,0));
try{new MutationObserver(queue).observe(document.documentElement,{subtree:true,childList:true})}catch(_){ }
setTimeout(queue,200);setTimeout(queue,1000);
})();