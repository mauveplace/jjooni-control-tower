(function(){
'use strict';

const CFG={
  primary:['overview','trades','portfolio','accounts'],
  secondary:['compare','ai','tripod','decisions','quality','watchlist','cost'],
  recentDays:90,
  pendingDays:7,
  pageSize:30
};
const state={filter:'open',sort:'error',expanded:new Set(),ready:false};

const qs=(s,r=document)=>{try{return r.querySelector(s)}catch(_){return null}};
const qsa=(s,r=document)=>{try{return Array.from(r.querySelectorAll(s))}catch(_){return []}};
const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null};
const z=v=>n(v)==null?0:n(v);
const sym=v=>String(v||'').trim().toUpperCase().replace(/\.(KS|KQ)$/,'');
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const fmtPct=v=>n(v)==null?'—':(v>=0?'+':'')+(v*100).toFixed(1)+'%';
const fmtWon=v=>n(v)==null?'—':(v>=0?'+':'-')+'₩'+Math.round(Math.abs(v)).toLocaleString('ko-KR');
const fmtPx=(v,currency)=>{if(n(v)==null)return '—';return String(currency||'').toUpperCase()==='USD'?'$'+Number(v).toLocaleString('en-US',{maximumFractionDigits:2}):'₩'+Math.round(v).toLocaleString('ko-KR')};

function parseTs(t){
  const raw=String(t.filled_at_kst||t.trade_date||t.date||'').trim();
  const ms=Date.parse(raw.length<=10?raw+'T00:00:00+09:00':raw);
  return Number.isFinite(ms)?ms:0;
}
function side(t){const s=String(t.side||'').toUpperCase();return s.includes('SELL')||s.includes('매도')?'SELL':s.includes('BUY')||s.includes('매수')?'BUY':'OTHER'}
function account(t){return String(t.account||t.account_type||'UNKNOWN').toUpperCase()}
function sleeve(t){
  const explicit=String(t.strategy_sleeve||t.sleeve||t.strategy||t.book||'').trim();
  if(explicit)return explicit;
  const a=account(t);
  if(a==='TRIPOD')return 'TRI-POD';
  if(a==='AI')return 'AI BOT';
  return a;
}
function keyOf(t){return sym(t.ticker||t.symbol)+'|'+sleeve(t)}
function labelTicker(t){return String(t.name||t.stock_name||t.ticker||t.symbol||'UNKNOWN').trim()}
function tradePx(t){return n(t.price||t.filled_price||t.avg_price)}
function qty(t){return Math.abs(z(t.qty||t.quantity||t.filled_qty))}
function currency(t){return String(t.currency||((String(t.market||'').toUpperCase()==='US')?'USD':'KRW')).toUpperCase()}
function currentPx(t){return n(t.current_price)}
function realizedPnl(t){
  for(const k of ['realized_pnl','realized_pnl_krw','pnl_realized','realized_profit']){if(n(t[k])!=null)return n(t[k])}
  return null;
}
function daysSince(ms){return ms?Math.floor((Date.now()-ms)/86400000):9999}

function collectTrades(){
  const out=[];
  try{if(window.D&&D.human&&Array.isArray(D.human.trades))out.push(...D.human.trades)}catch(_){}
  try{if(window.D&&D.ai&&D.ai.latest&&Array.isArray(D.ai.latest.trades))out.push(...D.ai.latest.trades.map(x=>({...x,account:x.account||'AI'})))}catch(_){}
  const seen=new Set(),dedup=[];
  out.forEach(t=>{
    const k=[account(t),parseTs(t),sym(t.ticker||t.symbol),side(t),qty(t),tradePx(t)].join('|');
    if(!seen.has(k)){seen.add(k);dedup.push(t)}
  });
  return dedup.sort((a,b)=>parseTs(a)-parseTs(b));
}

function canonicalPositionMap(){
  const m=new Map();
  try{
    const C=window.__JJOONI_CANONICAL_SSOT||{};
    Object.entries(C.accounts||{}).forEach(([acct,a])=>{
      (a.positions||[]).forEach(p=>{
        const k=sym(p.ticker||p.symbol)+'|'+(String(p.strategy_sleeve||p.sleeve||'').trim()||acct);
        m.set(k,{...p,account:acct});
        const fallback=sym(p.ticker||p.symbol)+'|'+acct;
        if(!m.has(fallback))m.set(fallback,{...p,account:acct});
      });
    });
  }catch(_){}
  return m;
}

function buildGroups(){
  const trades=collectTrades(),posMap=canonicalPositionMap(),groups=new Map();
  const cutoff=Date.now()-CFG.recentDays*86400000;
  trades.forEach(t=>{
    if(parseTs(t)<cutoff)return;
    const ticker=sym(t.ticker||t.symbol);if(!ticker)return;
    const sl=sleeve(t),k=ticker+'|'+sl;
    if(!groups.has(k))groups.set(k,{key:k,ticker,name:labelTicker(t),sleeve:sl,account:account(t),trades:[],buyCount:0,sellCount:0,buyQty:0,sellQty:0,buyCost:0,sellProceeds:0,realizedKnown:0,realizedSum:0,lastTs:0,currency:currency(t)});
    const g=groups.get(k);g.trades.push(t);g.lastTs=Math.max(g.lastTs,parseTs(t));g.currency=currency(t)||g.currency;
    const q=qty(t),p=tradePx(t);
    if(side(t)==='BUY'){g.buyCount++;g.buyQty+=q;if(p!=null)g.buyCost+=q*p}
    if(side(t)==='SELL'){g.sellCount++;g.sellQty+=q;if(p!=null)g.sellProceeds+=q*p;const rp=realizedPnl(t);if(rp!=null){g.realizedKnown++;g.realizedSum+=rp}}
  });
  const arr=[];
  groups.forEach(g=>{
    const pos=posMap.get(g.key)||posMap.get(g.ticker+'|'+g.account)||null;
    const qOpen=n(pos&&pos.qty)!=null?Math.abs(n(pos.qty)):Math.max(0,g.buyQty-g.sellQty);
    const avg=n(pos&&(pos.avg_price||pos.avg))!=null?n(pos.avg_price||pos.avg):(g.buyQty>0?g.buyCost/g.buyQty:null);
    const cur=n(pos&&(pos.current_price||pos.price))!=null?n(pos.current_price||pos.price):currentPx(g.trades.slice().reverse().find(x=>currentPx(x)!=null)||{});
    const mv=n(pos&&(pos.market_value||pos.value_krw||pos.value));
    let unreal=n(pos&&(pos.unrealized_pnl||pos.pnl));
    if(unreal==null&&avg!=null&&cur!=null&&qOpen>0)unreal=(cur-avg)*qOpen;
    const avgReturn=avg!=null&&avg>0&&cur!=null?(cur/avg)-1:null;
    const sells=g.trades.filter(t=>side(t)==='SELL'&&tradePx(t)!=null&&currentPx(t)!=null);
    let missed=null,lastSellTs=0;
    if(sells.length){
      let weighted=0,w=0;
      sells.forEach(t=>{const r=currentPx(t)/tradePx(t)-1,qq=Math.max(qty(t),1);weighted+=r*qq;w+=qq;lastSellTs=Math.max(lastSellTs,parseTs(t))});
      missed=w?weighted/w:null;
    }
    const pending=lastSellTs>0&&daysSince(lastSellTs)<CFG.pendingDays;
    const closed=qOpen<=0.0000001&&g.sellCount>0;
    const realized=g.realizedKnown?g.realizedSum:null;
    const totalPnl=realized!=null&&unreal!=null?realized+unreal:(closed?realized:unreal);
    const errorScore=Math.max(Math.abs(avgReturn||0),Math.abs(missed||0));
    arr.push({...g,pos,qOpen,avg,cur,mv,unreal,avgReturn,missed,pending,closed,realized,totalPnl,errorScore,lastSellTs});
  });
  return arr;
}

function verdict(g){
  if(g.pending)return {icon:'⋯',text:'평가 중'};
  if(g.closed){
    if(g.missed!=null)return g.missed<=0?{icon:'✓',text:'잘 팔았음'}:{icon:'✕',text:'매도 후 상승'};
    if(g.realized!=null)return g.realized>=0?{icon:'✓',text:'청산 이익'}:{icon:'✕',text:'청산 손실'};
    return {icon:'○',text:'청산 완료'};
  }
  if(g.avgReturn!=null)return g.avgReturn>=0?{icon:'✓',text:'매수 유효'}:{icon:'✕',text:'평단 아래'};
  return {icon:'○',text:'판정 대기'};
}

function filtered(groups){
  let a=groups.filter(g=>state.filter==='all'||(state.filter==='closed'?g.closed:!g.closed));
  if(state.sort==='missed')a.sort((x,y)=>Math.abs(y.missed||0)-Math.abs(x.missed||0));
  else if(state.sort==='recent')a.sort((x,y)=>y.lastTs-x.lastTs);
  else a.sort((x,y)=>y.errorScore-x.errorScore);
  return a;
}

function ensureStyle(){
  if(qs('#ctTradeReviewV2Style'))return;
  const st=document.createElement('style');st.id='ctTradeReviewV2Style';st.textContent=`
@media(max-width:767px){
 .tabs{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:3px!important;height:56px!important;overflow:visible!important}
 .tabs>.tab[data-tab]{display:none!important;font-size:11px!important;min-width:0!important;width:auto!important;height:48px!important;padding:4px 3px!important}
 .tabs>.tab[data-tab="overview"],.tabs>.tab[data-tab="trades"],.tabs>.tab[data-tab="portfolio"],.tabs>.tab[data-tab="accounts"]{display:flex!important}
 #ctMoreTab{display:flex!important;font-size:11px!important}
 #ctTradeReviewV2{margin:4px 0 18px}.ctTrHead{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;margin:4px 0 10px}.ctTrTitle{font-size:18px;font-weight:900;color:#14243a}.ctTrSub{font-size:10px;color:#7d8b9d;margin-top:2px}.ctTrFilters,.ctTrSorts{display:flex;gap:5px;flex-wrap:wrap}.ctTrToolbar{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:9px}.ctTrChip{border:1px solid #d8e1ea;background:#fff;color:#475467;border-radius:999px;padding:7px 9px;font:800 10px/1 system-ui}.ctTrChip.on{background:#0b2f5d;color:#fff;border-color:#0b2f5d}.ctTrGroup{background:#fff;border:1px solid #e5eaf0;border-radius:14px;margin-bottom:7px;overflow:hidden;box-shadow:0 6px 16px rgba(12,31,54,.04)}.ctTrRow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:10px 11px;align-items:center;cursor:pointer}.ctTrName{font-size:13px;font-weight:900;color:#101828}.ctTrMeta{font-size:9px;color:#7d8b9d;margin-top:3px}.ctTrRight{text-align:right}.ctTrRet{font-size:13px;font-weight:900}.ctTrRet.pos{color:#d92d20}.ctTrRet.neg{color:#175cd3}.ctTrVerdict{font-size:9px;color:#667085;margin-top:3px}.ctTrDetail{display:none;border-top:1px solid #edf1f5;background:#fbfcfe;padding:8px 10px}.ctTrGroup.open .ctTrDetail{display:block}.ctTrMetric{display:grid;grid-template-columns:1fr auto;gap:8px;padding:4px 0;font-size:10px;color:#475467}.ctTrMetric b{color:#101828}.ctTrTimeline{margin-top:7px;border-top:1px dashed #dce4ec;padding-top:6px}.ctTrEvent{display:grid;grid-template-columns:52px 42px minmax(0,1fr) auto;gap:5px;padding:5px 0;font-size:9px;color:#475467}.ctTrEvent b{color:#101828}.ctTrSide.buy{color:#175cd3;font-weight:900}.ctTrSide.sell{color:#d92d20;font-weight:900}.ctTrEmpty{background:#fff;border:1px dashed #d0d5dd;border-radius:14px;padding:18px;text-align:center;color:#667085;font-size:11px}
}
`;(document.head||document.documentElement).appendChild(st);
}

function ensureNav(){
  const tabs=qs('.tabs');if(!tabs)return;
  const more=qs('#ctMoreTab');
  qsa('.tab[data-tab]').forEach(t=>{const id=t.dataset.tab;t.style.removeProperty('display');if(window.innerWidth<=767)t.style.setProperty('display',CFG.primary.includes(id)?'flex':'none','important')});
  if(more&&window.innerWidth<=767){more.style.setProperty('display','flex','important');more.textContent='더보기'}
  const menu=qs('#ctMoreMenu');
  if(menu){
    menu.innerHTML='';
    const labels={compare:'성과분석',ai:'AI BOT',tripod:'TRI-POD',decisions:'의사결정',quality:'데이터품질',watchlist:'시황/워치',cost:'COST'};
    CFG.secondary.forEach(id=>{const src=qs('.tab[data-tab="'+id+'"]');if(!src)return;const b=document.createElement('button');b.type='button';b.dataset.tab=id;b.textContent=labels[id]||src.textContent.trim()||id;b.onclick=()=>{src.click();menu.classList.remove('open');if(more)more.setAttribute('aria-expanded','false')};menu.appendChild(b)});
  }
}

function render(){
  if(window.innerWidth>767)return;
  const panel=qs('#panel-trades');if(!panel)return;
  let root=qs('#ctTradeReviewV2',panel);
  if(!root){root=document.createElement('div');root.id='ctTradeReviewV2';panel.prepend(root)}
  qsa(':scope > *',panel).forEach(e=>{if(e!==root)e.style.setProperty('display','none','important')});
  const groups=filtered(buildGroups());
  const cards=groups.map(g=>{
    const v=verdict(g),ret=g.closed?(g.missed!=null?g.missed:null):g.avgReturn;
    const cls=ret==null?'':ret>=0?'pos':'neg';
    const id=encodeURIComponent(g.key),open=state.expanded.has(g.key);
    const timeline=g.trades.slice().sort((a,b)=>parseTs(b)-parseTs(a)).map(t=>{
      const d=new Date(parseTs(t)),ds=Number.isFinite(d.getTime())?String(d.getMonth()+1).padStart(2,'0')+'/'+String(d.getDate()).padStart(2,'0'):'—';
      const s=side(t),p=tradePx(t),q=qty(t);return `<div class="ctTrEvent"><span>${ds}</span><span class="ctTrSide ${s==='BUY'?'buy':'sell'}">${s==='BUY'?'매수':s==='SELL'?'매도':'거래'}</span><b>${esc(q)}주</b><span>${fmtPx(p,currency(t))}</span></div>`;
    }).join('');
    return `<div class="ctTrGroup ${open?'open':''}" data-key="${esc(g.key)}"><div class="ctTrRow"><div><div class="ctTrName">${esc(g.name||g.ticker)} <span style="font-size:9px;color:#7d8b9d;font-weight:800">· ${esc(g.sleeve)}</span></div><div class="ctTrMeta">매수 ${g.buyCount}회 · 매도 ${g.sellCount}회 · ${g.closed?'청산 완료':'진행 중'}</div></div><div class="ctTrRight"><div class="ctTrRet ${cls}">${ret==null?'—':fmtPct(ret)}</div><div class="ctTrVerdict">${v.icon} ${esc(v.text)}</div></div></div><div class="ctTrDetail"><div class="ctTrMetric"><span>평균매수가 → 현재가</span><b>${fmtPx(g.avg,g.currency)} → ${fmtPx(g.cur,g.currency)}</b></div><div class="ctTrMetric"><span>평단 대비</span><b>${fmtPct(g.avgReturn)}</b></div><div class="ctTrMetric"><span>매도 후 등락</span><b>${g.pending?'평가 중':fmtPct(g.missed)}</b></div><div class="ctTrMetric"><span>실현손익</span><b>${fmtWon(g.realized)}</b></div><div class="ctTrMetric"><span>평가손익</span><b>${fmtWon(g.unreal)}</b></div><div class="ctTrMetric"><span>실현+평가</span><b>${fmtWon(g.totalPnl)}</b></div><div class="ctTrTimeline">${timeline}</div></div></div>`;
  }).join('');
  root.innerHTML=`<div class="ctTrHead"><div><div class="ctTrTitle">매매복기</div><div class="ctTrSub">종목 × 전략 단위 · 최근 ${CFG.recentDays}일</div></div></div><div class="ctTrToolbar"><div class="ctTrFilters"><button class="ctTrChip ${state.filter==='open'?'on':''}" data-filter="open">진행 중</button><button class="ctTrChip ${state.filter==='closed'?'on':''}" data-filter="closed">청산 완료</button><button class="ctTrChip ${state.filter==='all'?'on':''}" data-filter="all">전체</button></div><div class="ctTrSorts"><button class="ctTrChip ${state.sort==='error'?'on':''}" data-sort="error">오차순</button><button class="ctTrChip ${state.sort==='missed'?'on':''}" data-sort="missed">놓친폭</button><button class="ctTrChip ${state.sort==='recent'?'on':''}" data-sort="recent">최근순</button></div></div>${cards||'<div class="ctTrEmpty">표시할 매매복기 데이터가 없습니다.</div>'}`;
  qsa('[data-filter]',root).forEach(b=>b.onclick=()=>{state.filter=b.dataset.filter;render()});
  qsa('[data-sort]',root).forEach(b=>b.onclick=()=>{state.sort=b.dataset.sort;render()});
  qsa('.ctTrRow',root).forEach(r=>r.onclick=()=>{const k=r.parentElement.dataset.key;if(state.expanded.has(k))state.expanded.delete(k);else state.expanded.add(k);render()});
  window.__JJOONI_TRADE_REVIEW_V2={state:'ACTIVE',grouping:'ticker+sleeve',filter:state.filter,sort:state.sort,groups:groups.length};
}

function run(){ensureStyle();ensureNav();const p=qs('#panel-trades');if(p&&p.classList.contains('on'))render();}
setTimeout(run,0);setTimeout(run,900);setTimeout(run,2200);
setInterval(()=>{if(!document.hidden)run()},2000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)run()});
window.addEventListener('resize',run,{passive:true});
})();
