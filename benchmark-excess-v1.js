(function(root){
'use strict';

const IDS=['TOSS','ISA','PENSION','IRP','AI','TRIPOD'];
const US_HINT=/(미국|NASDAQ|나스닥|S&P|필라델피아|GLOBAL|글로벌|SOXX|QQQ|TQQQ|QLD|UPRO|VOO|SPY|NVDA|AMAT|VRT|ANET|IONQ)/i;

const n=v=>{
 if(v===null||v===undefined||v===''||typeof v==='boolean'||typeof v==='object')return null;
 const x=Number(String(v).replace(/,/g,'').replace(/%/g,'').trim());
 return Number.isFinite(x)?x:null;
};
const pct=v=>n(v)==null?'—':(Number(v)>0?'+':'')+Number(v).toFixed(2)+'%';
const dateShort=v=>{
 const s=String(v||'');
 const m=s.match(/(20\d{2})-(\d{2})-(\d{2})/);
 return m?m[2]+'-'+m[3]:'--';
};

function classifyPosition(p){
 const currency=String(p?.currency||'').toUpperCase();
 const market=String(p?.market||'').toUpperCase();
 const name=[p?.name,p?.ticker,p?.symbol].filter(Boolean).join(' ');
 if(currency==='USD'||market==='US'||market==='USA'||US_HINT.test(name))return'US';
 return'KR';
}

function computeMixed({portfolio_return,kospi_return,ndx_return,kr_value,us_value}){
 const pr=n(portfolio_return),kr=n(kospi_return),us=n(ndx_return),kv=n(kr_value),uv=n(us_value);
 const total=(kv||0)+(uv||0);
 if(pr==null||kr==null||us==null||!(total>0)||kv==null||uv==null)return null;
 const kr_weight=kv/total,us_weight=uv/total;
 const benchmark_return=kr_weight*kr+us_weight*us;
 return{
  portfolio_return:pr,
  benchmark_return,
  excess_return:pr-benchmark_return,
  kr_weight,
  us_weight,
  kr_value:kv,
  us_value:uv
 };
}

const API={classifyPosition,computeMixed};
if(typeof module==='object'&&module.exports)module.exports=API;
root.__JJOONI_BENCHMARK_EXCESS_API_V1=API;
if(!root.document)return;

if(root.__JJOONI_BENCHMARK_EXCESS_V1)return;
const S={state:'BOOTING',version:'1.0',renders:0,last_reason:null};
root.__JJOONI_BENCHMARK_EXCESS_V1=S;

const q=(s,r=document)=>{try{return r.querySelector(s)}catch(_){return null}};
const qa=(s,r=document)=>{try{return Array.from(r.querySelectorAll(s))}catch(_){return[]}};
const text=e=>String(e?.textContent||'').trim().replace(/\s+/g,' ');

function canonical(){
 return root.__JJOONI_CANONICAL_SSOT||root.__JJOONI_LIVE_PAYLOAD||{};
}
function metrics(){return root.JjooniMetrics||{}}
function marketDaily(){return root.__JJOONI_PUBLIC_MARKET_DAILY||{}}

function portfolioDayReturn(){
 const C=canonical(),M=metrics();
 if(typeof M.aggregate!=='function')return null;
 const a=M.aggregate(C.accounts||{},IDS);
 return n(a?.day_return);
}

function exposure(){
 const C=canonical(),M=metrics();
 if(typeof M.positions!=='function'||typeof M.valueKrw!=='function')return null;
 let kr=0,us=0,missing=0,count=0;
 for(const id of IDS){
  const a=(C.accounts||{})[id]||{};
  const ps=M.positions(a);
  for(const p of ps){
   count++;
   const v=n(M.valueKrw(p,a));
   if(v==null||v<0){missing++;continue}
   if(classifyPosition(p)==='US')us+=v;else kr+=v;
  }
 }
 if(count===0||kr+us<=0)return null;
 return{kr,us,missing,count,coverage:(count-missing)/count};
}

function kospi(){
 const L=root.__JJOONI_LIVE_PAYLOAD||{};
 const row=((L.market_context||{}).items||{}).KOSPI||{};
 const ret=n(row.change_pct);
 const d=row.session_date||row.as_of_date||(L.market_context||{}).as_of_kst||L.generated_kst||L.observed_at;
 return ret==null?null:{return_pct:ret,date:d,source:row.source||'KOSPI_LIVE'};
}
function ndx(){
 const d=marketDaily(),row=(((d.market_context||{}).items||{}).NASDAQ100)||{};
 const ret=n(row.change_pct),date=row.session_date||row.as_of_date;
 if(ret==null||!date)return null;
 return{return_pct:ret,date,source:row.source||'PUBLIC_MARKET_DAILY',basis:row.basis};
}

function findLabel(){
 const rootEl=q('#panel-overview')||document;
 return qa('div,span,small,b,strong',rootEl).find(e=>e.children.length===0&&/^혼합\s*BM\s*대비\s*초과수익$/.test(text(e)))||null;
}
function findCell(label){
 let e=label;
 for(let i=0;e&&i<7;i++,e=e.parentElement){
  if(e.classList?.contains('ctOvHeroCell'))return e;
  if(q('.ctOvValue',e)&&q('.ctOvMini',e))return e;
 }
 return label?.parentElement||null;
}
function valueNode(cell){
 if(!cell)return null;
 const direct=q('.ctOvValue',cell);if(direct)return direct;
 const xs=qa('div,span,b,strong',cell).filter(e=>e.children.length===0&&(/^[+-]?\d+(?:\.\d+)?%$/.test(text(e))||text(e)==='—'));
 xs.sort((a,b)=>(parseFloat(getComputedStyle(b).fontSize)||0)-(parseFloat(getComputedStyle(a).fontSize)||0));
 return xs[0]||null;
}
function miniNode(cell){return q('.ctOvMini',cell)||qa('div,span,small',cell).find(e=>e.children.length===0&&/(KR\s*\d{2}-\d{2}|NDX\s*\d{2}-\d{2}|CLOSE|PRE)/i.test(text(e)))||null}

function render(){
 const label=findLabel();if(!label){S.state='WAITING_CARD';S.last_reason='CARD_NOT_FOUND';return}
 const cell=findCell(label),value=valueNode(cell),mini=miniNode(cell);
 const pr=portfolioDayReturn(),ex=exposure(),k=kospi(),x=ndx();
 if(!value||!mini){S.state='WAITING_DOM';S.last_reason='VALUE_OR_MINI_NOT_FOUND';return}
 if(pr==null||!ex||!k||!x||ex.coverage<0.95){
  value.textContent='—';
  mini.textContent='BM 입력값 검증 대기';
  value.title='6계좌 당일수익률·KOSPI·최신 완료 NDX·투자비중이 모두 확인돼야 계산합니다.';
  S.state='BLOCKED';S.last_reason=pr==null?'PORTFOLIO_RETURN_MISSING':!ex?'EXPOSURE_MISSING':!k?'KOSPI_MISSING':!x?'NDX_MISSING':'EXPOSURE_COVERAGE_LOW';
  return;
 }
 const r=computeMixed({portfolio_return:pr,kospi_return:k.return_pct,ndx_return:x.return_pct,kr_value:ex.kr,us_value:ex.us});
 if(!r){S.state='BLOCKED';S.last_reason='COMPUTE_FAILED';return}
 value.textContent=pct(r.excess_return);
 value.dataset.bmExcessV1='1';
 value.classList.toggle('pos',r.excess_return>0);
 value.classList.toggle('neg',r.excess_return<0);
 const kw=(r.kr_weight*100).toFixed(0),uw=(r.us_weight*100).toFixed(0);
 mini.textContent=`KR ${dateShort(k.date)} · NDX ${dateShort(x.date)} CLOSE · 비중 ${kw}/${uw}`;
 value.title=`6계좌 당일수익률 ${pct(r.portfolio_return)} - 혼합 BM ${pct(r.benchmark_return)} = 초과수익 ${pct(r.excess_return)}. 혼합 BM = KOSPI×${kw}% + NASDAQ-100×${uw}%. 현금 제외, 현재 보유 투자자산 기준.`;
 S.state='ACTIVE';S.last_reason=null;S.renders++;S.portfolio_return=r.portfolio_return;S.benchmark_return=r.benchmark_return;S.excess_return=r.excess_return;S.kr_weight=r.kr_weight;S.us_weight=r.us_weight;S.kospi_date=dateShort(k.date);S.ndx_date=dateShort(x.date);S.updated_at=new Date().toISOString();
}

let pending=false;
function schedule(){
 if(pending)return;pending=true;
 setTimeout(()=>{pending=false;render()},40);
}
document.addEventListener('jjooni:live-applied',schedule);
document.addEventListener('jjooni:public-market-loaded',schedule);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});
try{new MutationObserver(()=>{if(findLabel())schedule()}).observe(document.documentElement,{subtree:true,childList:true})}catch(_){}
setTimeout(render,250);setTimeout(render,1200);setTimeout(render,3000);
})(typeof window==='object'?window:globalThis);
