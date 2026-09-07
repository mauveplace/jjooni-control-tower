(function(){
'use strict';
if(window.__JJOONI_POSITION_COMPLETENESS_V25?.booted)return;

const S={booted:true,state:'BOOTING',version:'25.0',accounts:{},rows_patched:0,metric_sections:0,missing_pnl:0,missing_day:0,updated_at:null};
window.__JJOONI_POSITION_COMPLETENESS_V25=S;
const IDS=['TOSS','ISA','PENSION','IRP','AI','TRIPOD'];
const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null};
const z=v=>n(v)==null?0:n(v);
const norm=s=>String(s||'').replace(/\s+/g,' ').trim();
const sym=v=>String(v||'').trim().toUpperCase().replace(/\.(KS|KQ)$/,'');
const C=()=>window.__JJOONI_CANONICAL_SSOT||{};
const L=()=>window.__JJOONI_LIVE_PAYLOAD||{};
const currency=p=>String(p?.currency||((String(p?.market||'').toUpperCase()==='US')?'USD':'KRW')).toUpperCase();
const qty=p=>Math.abs(n(p?.qty??p?.quantity??p?.held_qty??p?.balance_qty)||0);
const cur=p=>n(p?.current_price??p?.price??p?.last_price);
const avg=p=>n(p?.avg_price??p?.avg??p?.average_price);
const prev=p=>n(p?.prev_close??p?.previous_close??p?.baseline_price??p?.base_price);
function validFx(v){const x=n(v);return x!=null&&x>500&&x<3000?x:null}
function fxFor(id,a,p){
  for(const v of [p?.fx_krw_per_usd,p?.fx,a?.fx_krw_per_usd,a?.fx,(L().accounts?.[id]||{}).fx_krw_per_usd,(L().accounts?.[id]||{}).fx]){const x=validFx(v);if(x!=null)return{x,source:'ACCOUNT_SPECIFIC'}}
  const r=L().fx_reference||{},x=validFx(r.krw_per_usd);if(x!=null&&String(r.source||'').toUpperCase()!=='FX_REFERENCE_MISSING')return{x,source:String(r.source||'FX_REFERENCE')};
  return null;
}
function first(o,keys){for(const k of keys){const x=n(o?.[k]);if(x!=null)return{key:k,value:x}}return null}
function toKrw(v,ccy,fx){const x=n(v);if(x==null)return null;if(String(ccy||'KRW').toUpperCase()!=='USD')return x;return fx?x*fx.x:null}
function valueKrw(id,a,p){
  const e=first(p,['market_value_krw','evaluation_amount_krw','eval_amount_krw','valuation_krw','evlu_amt_krw','value_krw']);if(e)return e.value;
  const f=currency(p)==='USD'?fxFor(id,a,p):null;
  const q=qty(p),c=cur(p);if(q>0&&c!=null)return currency(p)==='USD'?(f?q*c*f.x:null):q*c;
  const g=first(p,['market_value','evaluation_amount','eval_amount','valuation','evlu_amt','evaluation_value','value']);if(!g)return null;return toKrw(g.value,currency(p),f);
}
function cumPnlKrw(id,a,p){
  const k=first(p,['holding_pnl_krw','unrealized_pnl_krw','evaluation_pnl_krw','eval_pnl_krw','pnl_krw','evlu_pfls_amt']);if(k)return k.value;
  const f=currency(p)==='USD'?fxFor(id,a,p):null;
  const raw=first(p,['holding_pnl','unrealized_pnl','evaluation_pnl','eval_pnl','pnl']);if(raw){const v=toKrw(raw.value,currency(p),f);if(v!=null)return v}
  const q=qty(p),c=cur(p),a0=avg(p);if(q>0&&c!=null&&a0!=null){const v=(c-a0)*q;return toKrw(v,currency(p),f)}
  return null;
}
function cumReturn(p){const x=first(p,['holding_return','holding_return_pct','return_pct','unrealized_return_pct','pnl_rate']);if(x)return x.value;const c=cur(p),a0=avg(p);return c!=null&&a0>0?(c/a0-1)*100:null}
function dayPnlKrw(id,a,p){
  const k=first(p,['day_pnl_krw','daily_pnl_krw','today_pnl_krw','regular_pnl_krw','market_pnl_krw']);if(k)return k.value;
  const raw=first(p,['daily_pnl','day_pnl','today_pnl','regular_pnl','market_pnl']);
  if(raw){if(id==='TOSS')return raw.value;const f=currency(p)==='USD'?fxFor(id,a,p):null;const v=toKrw(raw.value,currency(p),f);if(v!=null)return v}
  const q=qty(p),c=cur(p),b=prev(p);if(q>0&&c!=null&&b!=null){const f=currency(p)==='USD'?fxFor(id,a,p):null;return toKrw((c-b)*q,currency(p),f)}
  return null;
}
function dayReturn(p){const x=first(p,['daily_return','daily_return_pct','day_return','day_return_pct','today_return','today_return_pct']);if(x)return x.value;const c=cur(p),b=prev(p);return c!=null&&b>0?(c/b-1)*100:null}
function posMetrics(id,p){const a=C().accounts?.[id]||{},v=valueKrw(id,a,p),cp=cumPnlKrw(id,a,p),cr=cumReturn(p),dp=dayPnlKrw(id,a,p),dr=dayReturn(p);return{value:v,cum_pnl:cp,cum_return:cr,day_pnl:dp,day_return:dr,pnl_ok:cp!=null||cr!=null,day_ok:dp!=null||dr!=null}}
function positions(id){return (C().accounts?.[id]?.positions||[]).filter(p=>['POSITION','FUND'].includes(String(p?.record_type||'POSITION').toUpperCase()))}
function won(v){const x=n(v);return x==null?'산정 대기':(x>=0?'+':'-')+'₩'+Math.round(Math.abs(x)).toLocaleString('ko-KR')}
function wonAbs(v){const x=n(v);return x==null?'산정 대기':'₩'+Math.round(Math.abs(x)).toLocaleString('ko-KR')}
function pct(v){const x=n(v);return x==null?'산정 대기':(x>=0?'+':'')+x.toFixed(2)+'%'}
function accountIdFromModal(m){const t=norm(m?.textContent).toUpperCase();if(t.includes('AI BOT'))return'AI';if(t.includes('TRI-POD')||t.includes('TRIPOD'))return'TRIPOD';if(t.includes('연금'))return'PENSION';if(/\bISA\b/.test(t))return'ISA';if(/\bIRP\b/.test(t))return'IRP';if(t.includes('TOSS'))return'TOSS';return null}
function ensureStyle(){if(document.getElementById('ctPositionCompletenessV25Style'))return;const s=document.createElement('style');s.id='ctPositionCompletenessV25Style';s.textContent=`.ctPosCompletenessV25{grid-column:1/-1;margin-top:6px;padding-top:6px;border-top:1px dashed rgba(127,143,164,.28);font:700 9px/1.45 system-ui,-apple-system,sans-serif;color:#667085;white-space:normal}.ctPosCompletenessV25 b{color:#344054}.ctPosCompletenessV25 .miss{color:#b45309}.ctPositionMetricV25{margin:12px 0 4px;padding:10px 12px;border:1px solid #e5eaf0;border-radius:12px;background:#f8fafc}.ctPositionMetricV25 h4{margin:0 0 8px;font:900 12px/1.3 system-ui;color:#172033}.ctPositionMetricV25 .r{display:grid;grid-template-columns:minmax(100px,1.25fr) repeat(4,minmax(70px,.75fr));gap:6px;padding:6px 0;border-top:1px solid #edf1f5;font:700 9px/1.35 system-ui;color:#667085}.ctPositionMetricV25 .r:first-of-type{border-top:0}.ctPositionMetricV25 .r b{color:#172033}.ctPositionMetricV25 .miss{color:#b45309}@media(max-width:767px){.ctPositionMetricV25 .r{grid-template-columns:minmax(120px,1fr) 1fr}.ctPositionMetricV25 .r span:nth-child(4),.ctPositionMetricV25 .r span:nth-child(5){grid-column:auto}}`;document.head.appendChild(s)}
function patchAccountModal(){
  const m=document.getElementById('accountDrillModal');if(!m)return;const id=accountIdFromModal(m);if(!id)return;const ps=positions(id),map=new Map(ps.map(p=>[sym(p.ticker||p.symbol),p]));let patched=0,missP=0,missD=0;
  m.querySelectorAll('[data-position-drill]').forEach(row=>{const parts=String(row.dataset.positionDrill||'').split('|'),ticker=sym(parts[1]||parts[0]),p=map.get(ticker);if(!p)return;const x=posMetrics(id,p);let e=row.querySelector('.ctPosCompletenessV25');if(!e){e=document.createElement('div');e.className='ctPosCompletenessV25';row.appendChild(e)}e.dataset.pnlState=x.pnl_ok?'OK':'MISSING';e.dataset.dayState=x.day_ok?'OK':'MISSING';e.innerHTML=`평가액 <b>${wonAbs(x.value)}</b> · 누적 <b class="${x.pnl_ok?'':'miss'}">${won(x.cum_pnl)} (${pct(x.cum_return)})</b> · 오늘 <b class="${x.day_ok?'':'miss'}">${won(x.day_pnl)} (${pct(x.day_return)})</b>`;patched++;if(!x.pnl_ok)missP++;if(!x.day_ok)missD++});
  S.accounts[id]={position_count:ps.length,rows_patched:patched,missing_pnl:missP,missing_day:missD};S.rows_patched=Object.values(S.accounts).reduce((s,x)=>s+z(x.rows_patched),0);S.missing_pnl=Object.values(S.accounts).reduce((s,x)=>s+z(x.missing_pnl),0);S.missing_day=Object.values(S.accounts).reduce((s,x)=>s+z(x.missing_day),0);
}
function patchMetricModal(){
  const m=document.getElementById('metricInfoModal');if(!m)return;const st=window.__JJOONI_METRIC_DRILL_V11?.last||window.__JJOONI_METRIC_DRILL_V12?.last||{};const id=String(st.account||'').toUpperCase(),lab=String(st.label||'');if(!IDS.includes(id)||!['보유종목','주식 평가액','KR','US'].includes(lab)){m.querySelector('#ctPositionMetricV25')?.remove();return}
  const ps=positions(id).filter(p=>lab==='KR'?currency(p)!=='USD':lab==='US'?currency(p)==='USD':true);let box=m.querySelector('#ctPositionMetricV25');if(!box){box=document.createElement('div');box.id='ctPositionMetricV25';box.className='ctPositionMetricV25';m.appendChild(box)}
  const rows=ps.map(p=>{const x=posMetrics(id,p),name=norm(p.name||p.ticker||p.symbol||'종목');return `<div class="r" data-v25-ticker="${sym(p.ticker||p.symbol)}" data-v25-pnl="${x.pnl_ok?'OK':'MISSING'}" data-v25-day="${x.day_ok?'OK':'MISSING'}"><b>${name}</b><span>평가 ${wonAbs(x.value)}</span><span class="${x.pnl_ok?'':'miss'}">누적 ${won(x.cum_pnl)} / ${pct(x.cum_return)}</span><span class="${x.day_ok?'':'miss'}">오늘 ${won(x.day_pnl)}</span><span class="${x.day_ok?'':'miss'}">당일 ${pct(x.day_return)}</span></div>`}).join('');box.innerHTML=`<h4>보유종목 상세 · 평가/누적손익/당일증감</h4>${rows||'<div class="r"><b>보유종목 없음</b></div>'}`;S.metric_sections++;
}
function audit(){let mp=0,md=0,pc=0;const a={};for(const id of IDS){const ps=positions(id);let p0=0,d0=0;for(const p of ps){const x=posMetrics(id,p);pc++;if(!x.pnl_ok){p0++;mp++}if(!x.day_ok){d0++;md++}}a[id]={position_count:ps.length,missing_pnl:p0,missing_day:d0}}S.accounts={...S.accounts,...a};S.position_count=pc;S.missing_pnl=mp;S.missing_day=md;S.state='ACTIVE';S.updated_at=new Date().toISOString()}
function apply(){ensureStyle();audit();patchAccountModal();patchMetricModal()}
let queued=false;function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply()})}
apply();[100,350,900,1800,3200].forEach(ms=>setTimeout(schedule,ms));document.addEventListener('jjooni:live-applied',schedule);document.addEventListener('jjooni:source-authority-v24-applied',schedule);document.addEventListener('click',()=>setTimeout(schedule,80),true);try{new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true})}catch(_){}
})();
