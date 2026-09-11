(function(){
'use strict';
if(window.__JJOONI_FX_ATTR_V16)return;
const STATE={state:'BOOTING',version:'16.1-usd-primary',rows:0,fx_state:'NO_DATA',updated_at:null};
window.__JJOONI_FX_ATTR_V16=STATE;
const IDS=['TOSS','ISA','PENSION','IRP','AI','TRIPOD'];
const NAME={TOSS:'Toss',ISA:'ISA',PENSION:'연금저축',IRP:'IRP',AI:'AI BOT',TRIPOD:'TRI-POD'};
const q=(s,r=document)=>{try{return r.querySelector(s)}catch(_){return null}};
const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null};
const z=v=>n(v)==null?0:n(v);
const signedKrw=v=>{const x=Number(v)||0;return(x>=0?'+':'-')+'₩'+Math.round(Math.abs(x)).toLocaleString('ko-KR')};
const signedUsd=v=>{const x=Number(v)||0;return(x>=0?'+':'-')+'$'+Math.abs(x).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})};
const fmtFx=v=>n(v)==null?'—':Number(v).toLocaleString('ko-KR',{minimumFractionDigits:2,maximumFractionDigits:2});
const pct=v=>n(v)==null?'—':(Number(v)>=0?'+':'')+Number(v).toFixed(2)+'%';
const fmtAsOf=v=>{const s=String(v||'').trim();if(!s)return '시각 확인 불가';const ms=Date.parse(s);if(!Number.isFinite(ms))return s.slice(0,16);const p=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).formatToParts(new Date(ms));const g=t=>(p.find(x=>x.type===t)||{}).value||'';return `${g('month')}/${g('day')} ${g('hour')}:${g('minute')}:${g('second')}`};
function ensureStyle(){if(q('#ctFxAttrV16Style'))return;const s=document.createElement('style');s.id='ctFxAttrV16Style';s.textContent=`
#ctFxAttrV16{margin:12px 0 16px;background:#fff;border:1px solid #e3e9f0;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(12,31,54,.05)}
.ctFxHead{display:flex;justify-content:space-between;gap:12px;align-items:flex-end;padding:14px 16px 10px}.ctFxTitle{font-size:16px;font-weight:950;color:#13243a}.ctFxSub{font-size:10px;color:#7b8a9c;margin-top:3px}.ctFxRef{text-align:right;font-size:10px;color:#53657a;font-weight:800}.ctFxRef small{display:block;color:#8a99aa;font-size:8px;margin-top:2px;font-weight:700}
.ctFxSummary{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid #eef2f6;border-bottom:1px solid #eef2f6}.ctFxSum{padding:10px 14px;border-right:1px solid #eef2f6}.ctFxSum:last-child{border-right:0}.ctFxSumLabel{font-size:9px;color:#7d8b9d;font-weight:800}.ctFxSumValue{font-size:15px;font-weight:950;margin-top:2px;color:#14243a}.ctFxSumSub{font-size:8px;color:#7d8b9d;margin-top:3px;font-weight:750}.ctFxSumValue.pos,.ctFxPrimary.pos{color:#d92d20}.ctFxSumValue.neg,.ctFxPrimary.neg{color:#175cd3}
.ctFxTable{width:100%;border-collapse:collapse}.ctFxTable th,.ctFxTable td{padding:9px 12px;border-bottom:1px solid #f0f3f6;font-size:10px;text-align:right;white-space:nowrap;vertical-align:middle}.ctFxTable th{font-size:9px;color:#7d8b9d;background:#fafbfd}.ctFxTable th:first-child,.ctFxTable td:first-child{text-align:left}.ctFxName{font-weight:900;color:#172b43}.ctFxMeta{font-size:8px;color:#98a2b3;margin-top:2px}.ctFxPrimary{font-size:11px;font-weight:950}.ctFxSecondary{font-size:8px;color:#7d8b9d;margin-top:3px;font-weight:750}.ctFxPos{color:#d92d20;font-weight:900}.ctFxNeg{color:#175cd3;font-weight:900}.ctFxEmpty{padding:18px 16px;color:#8a99aa;font-size:11px}
@media(max-width:767px){.ctFxHead{display:block}.ctFxRef{text-align:left;margin-top:7px}.ctFxSummary{grid-template-columns:1fr 1fr 1fr}.ctFxSum{padding:9px 8px}.ctFxSumValue{font-size:12px}.ctFxTable th,.ctFxTable td{padding:8px 7px;font-size:9px}.ctFxPrimary{font-size:10px}.ctFxTable th:nth-child(4),.ctFxTable td:nth-child(4){display:none}}
`;(document.head||document.documentElement).appendChild(s)}
function fxRef(){const L=window.__JJOONI_LIVE_PAYLOAD||{},f=L.fx_reference||{};return{state:String(f.state||'NO_DATA'),cur:n(f.krw_per_usd),prev:n(f.prev_close_krw_per_usd),as_of:f.as_of||f.observed_at||L.generated_kst||L.observed_at||null,source:f.source||'FX_REFERENCE_MISSING'}}
function isUsd(p){return String(p?.currency||'').toUpperCase()==='USD'||String(p?.market||'').toUpperCase()==='US'}
function buildRows(){
 const C=window.__JJOONI_CANONICAL_SSOT||{},f=fxRef();
 if(!(f.cur>0&&f.prev>0))return{f,rows:[],price_usd:null,price_krw_live:null,price_krw_decomp:null,fx:null,total:null};
 const rows=[];
 for(const id of IDS){
  const a=(C.accounts||{})[id]||{};
  for(const p of a.positions||[]){
   if(!isUsd(p)||String(p.record_type||'POSITION').toUpperCase()!=='POSITION')continue;
   const qty=Math.abs(z(p.qty??p.quantity)),p1=n(p.current_price??p.price),p0=n(p.prev_close);
   if(!(qty>0&&p1>0&&p0>0))continue;
   const priceEffectUsd=qty*(p1-p0);
   const priceEffectKrwLive=priceEffectUsd*f.cur;
   const priceEffectKrwDecomp=priceEffectUsd*(f.prev+f.cur)/2;
   const fxEffect=qty*(f.cur-f.prev)*(p0+p1)/2;
   const total=qty*(p1*f.cur-p0*f.prev);
   rows.push({account:id,ticker:p.ticker||p.symbol||'',name:p.name||p.ticker||p.symbol||'USD 보유종목',qty,p0,p1,price_effect_usd:priceEffectUsd,price_effect_krw_live:priceEffectKrwLive,price_effect_krw:priceEffectKrwDecomp,fx_effect_krw:fxEffect,total_effect_krw:total,check_gap_krw:total-priceEffectKrwDecomp-fxEffect});
  }
 }
 rows.sort((a,b)=>Math.abs(b.fx_effect_krw)-Math.abs(a.fx_effect_krw));
 return{f,rows,price_usd:rows.reduce((s,x)=>s+x.price_effect_usd,0),price_krw_live:rows.reduce((s,x)=>s+x.price_effect_krw_live,0),price_krw_decomp:rows.reduce((s,x)=>s+x.price_effect_krw,0),fx:rows.reduce((s,x)=>s+x.fx_effect_krw,0),total:rows.reduce((s,x)=>s+x.total_effect_krw,0)};
}
function enrichAccounts(calc){const C=window.__JJOONI_CANONICAL_SSOT||{};for(const id of IDS){const a=(C.accounts||{})[id];if(!a)continue;const xs=calc.rows.filter(x=>x.account===id);a.reference_usd_price_effect_usd=xs.length?xs.reduce((s,x)=>s+x.price_effect_usd,0):null;a.reference_usd_price_effect_krw=xs.length?xs.reduce((s,x)=>s+x.price_effect_krw,0):null;a.reference_usd_price_effect_krw_live=xs.length?xs.reduce((s,x)=>s+x.price_effect_krw_live,0):null;a.reference_usd_fx_effect_krw=xs.length?xs.reduce((s,x)=>s+x.fx_effect_krw,0):null;a.fx_attribution_position_count=xs.length;}window.__JJOONI_FX_ATTRIBUTION_ROWS=calc.rows}
function ensureRoot(){ensureStyle();let e=q('#ctFxAttrV16');if(e)return e;e=document.createElement('section');e.id='ctFxAttrV16';const anchor=q('#overviewAccounts');if(anchor&&anchor.parentNode)anchor.parentNode.insertBefore(e,anchor.nextSibling);else{const panel=q('#panel-overview')||q('.app')||document.body;panel.appendChild(e)}return e}
function cls(v){return Number(v)>0?'pos':Number(v)<0?'neg':''}
function cellCls(v){return Number(v)>0?'ctFxPos':Number(v)<0?'ctFxNeg':''}
function render(){
 const calc=buildRows(),root=ensureRoot(),f=calc.f;enrichAccounts(calc);STATE.fx_state=f.state;STATE.rows=calc.rows.length;STATE.updated_at=new Date().toISOString();
 if(!(f.cur>0&&f.prev>0)){
  const html=`<div class="ctFxHead"><div><div class="ctFxTitle">💱 종목별 환율 기여도</div><div class="ctFxSub">미국 종목은 달러를 기본 통화로 표시하고 실시간 USD/KRW로 원화 환산합니다.</div></div></div><div class="ctFxEmpty">USDKRW 현재값과 직전 종가가 아직 Feed에 없습니다. 임의 환율로 환산하지 않고 기준값 수집 대기 상태로 둡니다.</div>`;
  if(root.innerHTML!==html)root.innerHTML=html;STATE.state='WAIT_FX';return;
 }
 const fxMove=(f.cur/f.prev-1)*100,session=(window.__JJOONI_LIVE_PAYLOAD||{}).market_closed?'최근 완료 세션':'현재 세션';
 const body=calc.rows.length?calc.rows.map(x=>`<tr><td><div class="ctFxName">${x.name}</div><div class="ctFxMeta">${NAME[x.account]||x.account} · ${x.ticker||''} · USD</div></td><td class="${cellCls(x.fx_effect_krw)}">${signedKrw(x.fx_effect_krw)}</td><td><div class="ctFxPrimary ${cls(x.price_effect_usd)}">${signedUsd(x.price_effect_usd)}</div><div class="ctFxSecondary">현재환율 환산 ${signedKrw(x.price_effect_krw_live)}</div></td><td class="${cellCls(x.total_effect_krw)}">${signedKrw(x.total_effect_krw)}</td></tr>`).join(''):'<tr><td colspan="4" style="text-align:center;color:#98a2b3">계산 가능한 USD 보유종목이 없습니다.</td></tr>';
 const html=`<div class="ctFxHead"><div><div class="ctFxTitle">💱 종목별 환율 기여도</div><div class="ctFxSub">${session} · 미국 종목은 USD 원통화 손익을 우선 표시하고 현재 USD/KRW로 환산 원화를 함께 표시합니다.</div></div><div class="ctFxRef">USD/KRW 현재 ${fmtFx(f.cur)} · 전일 ${fmtFx(f.prev)} · ${pct(fxMove)}<small>${fmtAsOf(f.as_of)} · ${f.source}</small></div></div><div class="ctFxSummary"><div class="ctFxSum"><div class="ctFxSumLabel">가격 기여 · USD</div><div class="ctFxSumValue ${cls(calc.price_usd)}">${signedUsd(calc.price_usd)}</div><div class="ctFxSumSub">현재환율 환산 ${signedKrw(calc.price_krw_live)}</div></div><div class="ctFxSum"><div class="ctFxSumLabel">환율 효과 · KRW</div><div class="ctFxSumValue ${cls(calc.fx)}">${signedKrw(calc.fx)}</div><div class="ctFxSumSub">USD/KRW 변동분</div></div><div class="ctFxSum"><div class="ctFxSumLabel">원화 가치변동</div><div class="ctFxSumValue ${cls(calc.total)}">${signedKrw(calc.total)}</div><div class="ctFxSumSub">가격+환율 총효과</div></div></div><table class="ctFxTable"><thead><tr><th>종목 / 계좌</th><th>환율 기여 · KRW</th><th>가격 기여 · USD</th><th>원화 총효과</th></tr></thead><tbody>${body}</tbody></table>`;
 if(root.innerHTML!==html)root.innerHTML=html;STATE.state='ACTIVE';STATE.currency_display='USD_PRIMARY_KRW_LIVE_CONVERTED';STATE.fx_rate=f.cur;STATE.fx_as_of=f.as_of;
}
let queued=false;function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;render()})}
document.addEventListener('jjooni:live-applied',schedule);setTimeout(schedule,300);setTimeout(schedule,1600);
})();
